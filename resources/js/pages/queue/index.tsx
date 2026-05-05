import { Head, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { ClinicSelector } from '@/components/clinic-selector';
import { WalkInReservationModal } from '@/components/walk-in-reservation-modal';
import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { ClinicDetail, QueueEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type QueuePageProps = {
    context: WorkspaceContext;
    clinic: ClinicDetail | null;
    today: string;
    queues: QueueEntry[];
    filters: {
        clinicId: number | null;
        reservationDate: string;
        queueStatus: string;
        includeHistory: boolean;
    };
};

type DoctorOption = {
    key: string;
    id: number | null;
    name: string;
};

type MedicalRecordCompletionForm = {
    diagnosis: string;
    treatment: string;
    prescription_notes: string;
    doctor_notes: string;
};

type JsonResult = {
    ok: boolean;
    message?: string;
    errors?: ValidationErrors;
};

type QueuePrefixMap = Record<string, string>;

const queueStatusFilters = ['waiting', 'called', 'in_progress', 'skipped', 'cancelled', 'completed'];
const terminalQueueStatuses = ['completed', 'cancelled'];

export default function QueuePage({ context, clinic, today, queues, filters }: QueuePageProps) {
    const page = usePage<SharedData & { errors?: ValidationErrors }>();
    const isAdminWorkspace = context.role === 'admin' || context.role === 'superadmin';

    if (isAdminWorkspace) {
        return <AdminQueuePage context={context} clinic={clinic} today={today} queues={queues} filters={filters} page={page} />;
    }

    if (context.role === 'doctor') {
        return <DoctorQueuePage context={context} clinic={clinic} queues={queues} filters={filters} page={page} />;
    }

    return <ReadOnlyQueuePage context={context} queues={queues} filters={filters} page={page} />;
}

function AdminQueuePage({
    context,
    clinic,
    today,
    queues,
    filters,
    page,
}: {
    context: WorkspaceContext;
    clinic: ClinicDetail | null;
    today: string;
    queues: QueueEntry[];
    filters: QueuePageProps['filters'];
    page: ReturnType<typeof usePage<SharedData & { errors?: ValidationErrors }>>;
}) {
    const [selectedReservationId, setSelectedReservationId] = useState<number | null>(queues[0]?.reservation_id ?? null);
    const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
    const [reservationNumberSearch, setReservationNumberSearch] = useState('');
    const [doctorFilter, setDoctorFilter] = useState<string>('');
    const [queueNumberDraft, setQueueNumberDraft] = useState('');
    const [completionQueue, setCompletionQueue] = useState<QueueEntry | null>(null);
    const [completionForm, setCompletionForm] = useState<MedicalRecordCompletionForm>({
        diagnosis: '',
        treatment: '',
        prescription_notes: '',
        doctor_notes: '',
    });
    const [completionError, setCompletionError] = useState<string | null>(null);
    const [completionErrors, setCompletionErrors] = useState<ValidationErrors>({});
    const [completionSubmitting, setCompletionSubmitting] = useState(false);

    const doctorOptions = useMemo(() => buildDoctorOptions(queues), [queues]);
    const queuePrefixes = useMemo(() => buildQueuePrefixes(doctorOptions), [doctorOptions]);
    const filteredQueues = useMemo(() => {
        const reservationSearch = reservationNumberSearch.trim().toLowerCase();

        return queues.filter((entry) => {
            const matchesReservationNumber = reservationSearch === '' || entry.reservation_number.toLowerCase().includes(reservationSearch);
            const matchesDoctor = doctorFilter === '' || doctorKey(entry) === doctorFilter;

            return matchesReservationNumber && matchesDoctor;
        });
    }, [doctorFilter, queues, reservationNumberSearch]);
    const queuePagination = useClientPagination(filteredQueues);
    const selectedQueue = queuePagination.paginatedItems.find((entry) => entry.reservation_id === selectedReservationId)
        ?? queuePagination.paginatedItems[0]
        ?? null;

    useEffect(() => {
        if (selectedReservationId !== null && queuePagination.paginatedItems.some((entry) => entry.reservation_id === selectedReservationId)) {
            return;
        }

        setSelectedReservationId(queuePagination.paginatedItems[0]?.reservation_id ?? null);
    }, [queuePagination.paginatedItems, selectedReservationId]);

    useEffect(() => {
        setQueueNumberDraft(selectedQueue?.queue.number ? String(selectedQueue.queue.number) : '');
    }, [selectedQueue?.reservation_id, selectedQueue?.queue.number]);

    const updateFilters = (updates: Partial<QueuePageProps['filters']>) => {
        const nextFilters = { ...filters, ...updates };

        router.get('/queue', cleanQuery({
            clinic_id: nextFilters.clinicId,
            reservation_date: nextFilters.reservationDate,
            queue_status: nextFilters.queueStatus,
        }), {
            preserveScroll: true,
        });
    };

    const updateQueue = (entry: QueueEntry, updates: { queue_status?: string; queue_number?: number }) => {
        const clinicId = filters.clinicId ?? entry.clinic?.id;

        if (!clinicId) {
            return;
        }

        router.patch(`/queue/${entry.reservation_id}`, {
            clinic_id: clinicId,
            ...updates,
        }, {
            preserveScroll: true,
        });
    };

    const saveQueueNumber = () => {
        if (!selectedQueue) {
            return;
        }

        const nextQueueNumber = Number(queueNumberDraft);

        if (!Number.isInteger(nextQueueNumber) || nextQueueNumber < 1) {
            return;
        }

        updateQueue(selectedQueue, { queue_number: nextQueueNumber });
    };

    const selectedIsTerminal = selectedQueue ? terminalQueueStatuses.includes(selectedQueue.queue.status) : true;
    const canCall = selectedQueue !== null && !selectedIsTerminal && selectedQueue.queue.status !== 'called' && selectedQueue.queue.status !== 'in_progress';
    const canStart = selectedQueue !== null && selectedQueue.queue.status === 'called';
    const canSkip = selectedQueue !== null && ['waiting', 'called'].includes(selectedQueue.queue.status);
    const canCancel = selectedQueue !== null && !selectedIsTerminal;
    const canResetWaiting = selectedQueue !== null && ['called', 'skipped'].includes(selectedQueue.queue.status);
    const canEditQueueNumber = selectedQueue !== null && !selectedIsTerminal && queueNumberDraft !== '' && Number(queueNumberDraft) >= 1;
    const canComplete = context.role === 'admin'
        && selectedQueue !== null
        && selectedQueue.queue.status === 'in_progress'
        && selectedQueue.reservation_status === 'approved';

    const openCompletionModal = (entry: QueueEntry) => {
        setCompletionQueue(entry);
        setCompletionForm({
            diagnosis: '',
            treatment: '',
            prescription_notes: '',
            doctor_notes: '',
        });
        setCompletionError(null);
        setCompletionErrors({});
    };

    const closeCompletionModal = () => {
        if (completionSubmitting) {
            return;
        }

        setCompletionQueue(null);
        setCompletionError(null);
        setCompletionErrors({});
    };

    const submitCompletion = async () => {
        if (!completionQueue) {
            return;
        }

        const clinicId = filters.clinicId ?? completionQueue.clinic?.id;

        if (!clinicId) {
            setCompletionError('Clinic context is missing for this queue entry.');
            return;
        }

        setCompletionSubmitting(true);
        setCompletionError(null);
        setCompletionErrors({});

        const result = await requestJson(`/admin/reservations/${completionQueue.reservation_id}/medical-records`, 'POST', {
            clinic_id: clinicId,
            diagnosis: completionForm.diagnosis.trim() === '' ? null : completionForm.diagnosis.trim(),
            treatment: completionForm.treatment.trim() === '' ? null : completionForm.treatment.trim(),
            prescription_notes: completionForm.prescription_notes.trim() === '' ? null : completionForm.prescription_notes.trim(),
            doctor_notes: completionForm.doctor_notes.trim(),
        });

        setCompletionSubmitting(false);

        if (!result.ok) {
            setCompletionError(result.message ?? 'Gagal menyelesaikan antrean.');
            setCompletionErrors(result.errors ?? {});
            return;
        }

        setCompletionQueue(null);
        router.reload({ preserveScroll: true });
    };

    return (
        <AppLayout>
            <Head title="Manajemen Antrean" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    <FlashAndErrors page={page} />

                    {context.role === 'superadmin' && context.clinics.length > 0 ? (
                        <ClinicSelector
                                clinics={context.clinics}
                                value={filters.clinicId}
                                onChange={(clinicId) => updateFilters({ clinicId: clinicId === '' ? null : Number(clinicId) })}
                            />
                    ) : null}

                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <p className="mb-2 text-[12px] font-medium text-[#40311D]">Filter Antrean</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1">
                                <span className="text-[12px] text-gray-400">Kode</span>
                                <input
                                    value={reservationNumberSearch}
                                    onChange={(event) => setReservationNumberSearch(event.target.value)}
                                    placeholder="Reservation code..."
                                    type="text"
                                    className="w-40 bg-transparent text-[12px] italic outline-none placeholder:text-gray-400"
                                />
                            </div>
                            <label className="flex min-w-48 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-[12px] text-gray-600 transition focus-within:border-[#40311D]">
                                <span className="whitespace-nowrap text-gray-400">Dokter</span>
                                <select
                                    value={doctorFilter}
                                    onChange={(event) => setDoctorFilter(event.target.value)}
                                    className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-700 outline-none"
                                >
                                    <option value="">Semua Dokter</option>
                                    {doctorOptions.map((doctor) => (
                                        <option key={doctor.key} value={doctor.key}>
                                            {doctor.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex min-w-44 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-[12px] text-gray-600 transition focus-within:border-[#40311D]">
                                <span className="whitespace-nowrap text-gray-400">Tanggal</span>
                                <input
                                    type="date"
                                    value={filters.reservationDate}
                                    onChange={(event) => updateFilters({ reservationDate: event.target.value })}
                                    className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-700 outline-none"
                                />
                            </label>
                            {queueStatusFilters.map((status) => (
                                <FilterChip key={status} active={filters.queueStatus === status} onClick={() => updateFilters({ queueStatus: filters.queueStatus === status ? '' : status })}>
                                    {formatQueueStatus(status)}
                                </FilterChip>
                            ))}
                        </div>
                    </div>

                    <div className="grid items-start gap-4 xl:grid-cols-[1fr_280px]">
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <div className='flex flex-row'>
                                <CardHeader title="Daftar Antrean" subtitle="Antrean aktif clinic-scoped hari ini" />
                                <ActionButton  walkinClass='border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-2 content-center' className='min-w-[100px]' disabled={clinic === null} variant="primary" onClick={() => setIsWalkInModalOpen(true)}>
                                    Buat Walk-In
                                </ActionButton>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[920px] border-collapse text-[12px]">
                                    <thead>
                                        <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                            {['No', 'Kode Reservasi', 'Queue', 'Pasien', 'Dokter', 'Tanggal', 'Window', 'Status Queue'].map((header) => (
                                                <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredQueues.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                                                    Tidak ada antrean yang sesuai filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            queuePagination.paginatedItems.map((entry, index) => (
                                                <tr
                                                    key={entry.reservation_id}
                                                    onClick={() => setSelectedReservationId(entry.reservation_id)}
                                                    className={`cursor-pointer border-b border-[#ede8e2] transition-colors last:border-0 hover:bg-[#faf9f7] ${selectedQueue?.reservation_id === entry.reservation_id ? 'bg-[#faf9f7]' : ''}`}
                                                >
                                                    <td className="px-4 py-2.5 text-gray-700">{String(queuePagination.startItem + index).padStart(3, '0')}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{entry.reservation_number}</td>
                                                    <td className="py-2.5 text-gray-700">
                                                        <QueueCodeBadge>{formatQueueCode(entry, entry.queue.number, queuePrefixes)}</QueueCodeBadge>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-gray-700">{queuePatientName(entry)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{entry.doctor?.name ?? '-'}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{formatDateLabel(entry.reservation_date)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{entry.window.start_time} - {entry.window.end_time}</td>
                                                    <td className="px-4 py-2.5 text-gray-700"><QueueStatusBadge status={entry.queue.status} /></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls
                                page={queuePagination.page}
                                perPage={queuePagination.perPage}
                                total={queuePagination.total}
                                pageCount={queuePagination.pageCount}
                                startItem={queuePagination.startItem}
                                endItem={queuePagination.endItem}
                                perPageOptions={queuePagination.perPageOptions}
                                onPageChange={queuePagination.setPage}
                                onPerPageChange={queuePagination.setPerPage}
                            />
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <CardHeader title="Aksi Antrean" subtitle="Operasi antrean terpilih" />
                                <div className="grid grid-cols-2 gap-2 p-4">
                                    <ActionButton disabled={!canCall} variant="primary" onClick={() => selectedQueue && updateQueue(selectedQueue, { queue_status: 'called' })}>
                                        Call
                                    </ActionButton>
                                    <ActionButton disabled={!canStart} variant="primary" onClick={() => selectedQueue && updateQueue(selectedQueue, { queue_status: 'in_progress' })}>
                                        Start
                                    </ActionButton>
                                    <ActionButton disabled={!canSkip} onClick={() => selectedQueue && updateQueue(selectedQueue, { queue_status: 'skipped' })}>
                                        Skip
                                    </ActionButton>
                                    <ActionButton disabled={!canCancel} danger onClick={() => selectedQueue && updateQueue(selectedQueue, { queue_status: 'cancelled' })}>
                                        Cancel
                                    </ActionButton>
                                    <ActionButton disabled={!canComplete} variant="primary" className="col-span-2" onClick={() => selectedQueue && openCompletionModal(selectedQueue)}>
                                        Selesaikan & Isi Rekam Medis
                                    </ActionButton>
                                    <ActionButton disabled={!canResetWaiting} className="col-span-2" onClick={() => selectedQueue && updateQueue(selectedQueue, { queue_status: 'waiting' })}>
                                        Reset Waiting
                                    </ActionButton>
                                </div>
                                <div className="border-t border-[#e4ddd4] p-4">
                                    <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                        Edit queue number
                                        <input
                                            type="number"
                                            min="1"
                                            value={queueNumberDraft}
                                            onChange={(event) => setQueueNumberDraft(event.target.value)}
                                            placeholder="Nomor antrean"
                                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                        />
                                    </label>
                                    <p className="mt-2 text-[11px] text-gray-400">
                                        Preview: {selectedQueue ? formatQueueCode(selectedQueue, Number(queueNumberDraft), queuePrefixes) : '-'}
                                    </p>
                                    <ActionButton disabled={!canEditQueueNumber} className="mt-3 w-full" onClick={saveQueueNumber}>
                                        Simpan Nomor
                                    </ActionButton>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <CardHeader title="Antrean Terpilih" subtitle="Preview data utama" />
                                <div className="min-h-[160px] space-y-2 p-4 text-[12px] text-gray-600">
                                    {selectedQueue ? (
                                        <SelectedQueuePreview entry={selectedQueue} prefixes={queuePrefixes} />
                                    ) : (
                                        <p className="italic text-gray-400">Pilih antrean untuk melihat detail</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {isWalkInModalOpen && clinic !== null ? (
                <WalkInReservationModal
                    clinic={clinic}
                    today={today}
                    initialDate={filters.reservationDate}
                    onClose={() => setIsWalkInModalOpen(false)}
                />
            ) : null}

            {completionQueue ? (
                <CompleteQueueModal
                    entry={completionQueue}
                    form={completionForm}
                    errors={completionErrors}
                    error={completionError}
                    submitting={completionSubmitting}
                    onChange={(updates) => setCompletionForm((current) => ({ ...current, ...updates }))}
                    onClose={closeCompletionModal}
                    onSubmit={submitCompletion}
                />
            ) : null}
        </AppLayout>
    );
}

function DoctorQueuePage({
    context,
    clinic,
    queues,
    filters,
    page,
}: {
    context: WorkspaceContext;
    clinic: ClinicDetail | null;
    queues: QueueEntry[];
    filters: QueuePageProps['filters'];
    page: ReturnType<typeof usePage<SharedData & { errors?: ValidationErrors }>>;
}) {
    const [selectedReservationId, setSelectedReservationId] = useState<number | null>(queues[0]?.reservation_id ?? null);
    const [completionQueue, setCompletionQueue] = useState<QueueEntry | null>(null);
    const [completionForm, setCompletionForm] = useState<MedicalRecordCompletionForm>({
        diagnosis: '',
        treatment: '',
        prescription_notes: '',
        doctor_notes: '',
    });
    const [completionError, setCompletionError] = useState<string | null>(null);
    const [completionErrors, setCompletionErrors] = useState<ValidationErrors>({});
    const [completionSubmitting, setCompletionSubmitting] = useState(false);
    const queuePrefixes = useMemo(() => buildQueuePrefixes(buildDoctorOptions(queues)), [queues]);
    const queuePagination = useClientPagination(queues);
    const selectedQueue = queuePagination.paginatedItems.find((entry) => entry.reservation_id === selectedReservationId)
        ?? queuePagination.paginatedItems[0]
        ?? null;

    useEffect(() => {
        if (selectedReservationId !== null && queuePagination.paginatedItems.some((entry) => entry.reservation_id === selectedReservationId)) {
            return;
        }

        setSelectedReservationId(queuePagination.paginatedItems[0]?.reservation_id ?? null);
    }, [queuePagination.paginatedItems, selectedReservationId]);

    const updateFilters = (updates: Partial<QueuePageProps['filters']>) => {
        const nextFilters = { ...filters, ...updates };

        router.get('/queue', cleanQuery({
            clinic_id: nextFilters.clinicId,
            reservation_date: nextFilters.reservationDate,
            queue_status: nextFilters.queueStatus,
        }), {
            preserveScroll: true,
        });
    };

    const startQueue = (entry: QueueEntry) => {
        const clinicId = filters.clinicId ?? entry.clinic?.id;

        if (!clinicId) {
            return;
        }

        router.patch(`/queue/${entry.reservation_id}`, {
            clinic_id: clinicId,
            queue_status: 'in_progress',
        }, {
            preserveScroll: true,
        });
    };

    const openCompletionModal = (entry: QueueEntry) => {
        setCompletionQueue(entry);
        setCompletionForm({
            diagnosis: '',
            treatment: '',
            prescription_notes: '',
            doctor_notes: '',
        });
        setCompletionError(null);
        setCompletionErrors({});
    };

    const closeCompletionModal = () => {
        if (completionSubmitting) {
            return;
        }

        setCompletionQueue(null);
        setCompletionError(null);
        setCompletionErrors({});
    };

    const submitCompletion = async () => {
        if (!completionQueue) {
            return;
        }

        const clinicId = filters.clinicId ?? completionQueue.clinic?.id;

        if (!clinicId) {
            setCompletionError('Clinic context is missing for this queue entry.');
            return;
        }

        setCompletionSubmitting(true);
        setCompletionError(null);
        setCompletionErrors({});

        const result = await requestJson(`/doctor/reservations/${completionQueue.reservation_id}/medical-records`, 'POST', {
            clinic_id: clinicId,
            diagnosis: completionForm.diagnosis.trim() === '' ? null : completionForm.diagnosis.trim(),
            treatment: completionForm.treatment.trim() === '' ? null : completionForm.treatment.trim(),
            prescription_notes: completionForm.prescription_notes.trim() === '' ? null : completionForm.prescription_notes.trim(),
            doctor_notes: completionForm.doctor_notes.trim(),
        });

        setCompletionSubmitting(false);

        if (!result.ok) {
            setCompletionError(result.message ?? 'Gagal menyelesaikan antrean.');
            setCompletionErrors(result.errors ?? {});
            return;
        }

        setCompletionQueue(null);
        router.reload({ preserveScroll: true });
    };

    const canStart = selectedQueue !== null && selectedQueue.queue.status === 'called';
    const canComplete = selectedQueue !== null && selectedQueue.queue.status === 'in_progress' && selectedQueue.reservation_status === 'approved';
    const startDisabledHint = canStart ? undefined : doctorQueueActionHint(selectedQueue, 'start');
    const completeDisabledHint = canComplete ? undefined : doctorQueueActionHint(selectedQueue, 'complete');

    return (
        <AppLayout>
            <Head title="Antrean Saya" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    <FlashAndErrors page={page} />

                    {context.clinics.length > 1 ? (
                        <ClinicSelector
                            clinics={context.clinics}
                            value={filters.clinicId}
                            onChange={(clinicId) => updateFilters({ clinicId: clinicId === '' ? null : Number(clinicId) })}
                        />
                    ) : null}

                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <p className="mb-2 text-[12px] font-medium text-[#40311D]">Filter Antrean Saya</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="flex min-w-48 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-[12px] text-gray-600 transition focus-within:border-[#40311D]">
                                <span className="whitespace-nowrap text-gray-400">Tanggal</span>
                                <input
                                    type="date"
                                    value={filters.reservationDate}
                                    onChange={(event) => updateFilters({ reservationDate: event.target.value })}
                                    className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-700 outline-none"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <CardHeader title="Daftar Antrean Saya" subtitle={`Antrean approved ${clinic?.name ?? 'klinik terpilih'}`} />
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[860px] border-collapse text-[12px]">
                                    <thead>
                                        <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                            {['No', 'Kode Reservasi', 'Queue', 'Pasien', 'Tanggal', 'Window', 'Status Queue'].map((header) => (
                                                <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queues.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                                                    Tidak ada antrean yang sesuai filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            queuePagination.paginatedItems.map((entry, index) => (
                                                <tr
                                                    key={entry.reservation_id}
                                                    onClick={() => setSelectedReservationId(entry.reservation_id)}
                                                    className={`cursor-pointer border-b border-[#ede8e2] transition-colors last:border-0 hover:bg-[#faf9f7] ${selectedQueue?.reservation_id === entry.reservation_id ? 'bg-[#faf9f7]' : ''}`}
                                                >
                                                    <td className="px-4 py-2.5 text-gray-700">{String(queuePagination.startItem + index).padStart(3, '0')}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{entry.reservation_number}</td>
                                                    <td className="py-2.5 text-gray-700">
                                                        <QueueCodeBadge>{formatQueueCode(entry, entry.queue.number, queuePrefixes)}</QueueCodeBadge>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-gray-700">{queuePatientName(entry)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{formatDateLabel(entry.reservation_date)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{entry.window.start_time} - {entry.window.end_time}</td>
                                                    <td className="px-4 py-2.5 text-gray-700"><QueueStatusBadge status={entry.queue.status} /></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls
                                page={queuePagination.page}
                                perPage={queuePagination.perPage}
                                total={queuePagination.total}
                                pageCount={queuePagination.pageCount}
                                startItem={queuePagination.startItem}
                                endItem={queuePagination.endItem}
                                perPageOptions={queuePagination.perPageOptions}
                                onPageChange={queuePagination.setPage}
                                onPerPageChange={queuePagination.setPerPage}
                            />
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <CardHeader title="Aksi Dokter" subtitle="Operasi antrean terpilih" />
                                <div className="grid gap-2 p-4">
                                    <ActionButton disabled={!canStart} variant="primary" tooltip={startDisabledHint} onClick={() => selectedQueue && startQueue(selectedQueue)}>
                                        Start/In Progress
                                    </ActionButton>
                                    <ActionButton disabled={!canComplete} variant="primary" tooltip={completeDisabledHint} onClick={() => selectedQueue && openCompletionModal(selectedQueue)}>
                                        Selesaikan & Isi Rekam Medis
                                    </ActionButton>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <CardHeader title="Antrean Terpilih" subtitle="Preview data utama" />
                                <div className="min-h-[160px] space-y-2 p-4 text-[12px] text-gray-600">
                                    {selectedQueue ? (
                                        <SelectedQueuePreview entry={selectedQueue} prefixes={queuePrefixes} />
                                    ) : (
                                        <p className="italic text-gray-400">Pilih antrean untuk melihat detail</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {completionQueue ? (
                <CompleteQueueModal
                    entry={completionQueue}
                    form={completionForm}
                    errors={completionErrors}
                    error={completionError}
                    submitting={completionSubmitting}
                    onChange={(updates) => setCompletionForm((current) => ({ ...current, ...updates }))}
                    onClose={closeCompletionModal}
                    onSubmit={submitCompletion}
                />
            ) : null}
        </AppLayout>
    );
}

function ReadOnlyQueuePage({ context, queues, filters, page }: { context: WorkspaceContext; queues: QueueEntry[]; filters: QueuePageProps['filters']; page: ReturnType<typeof usePage<SharedData & { errors?: ValidationErrors }>> }) {
    const queuePrefixes = useMemo(() => buildQueuePrefixes(buildDoctorOptions(queues)), [queues]);
    const canView = context.role === 'patient' || context.role === 'admin' || context.role === 'superadmin' || context.role === 'doctor';

    return (
        <AppLayout>
            <Head title="Queue" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    <FlashAndErrors page={page} />

                    {!canView ? (
                        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-[12px] leading-7 text-gray-600">
                            Queue monitoring is limited to patients, clinic admins, and doctors.
                        </section>
                    ) : queues.length === 0 ? (
                        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-[12px] leading-7 text-gray-600">
                            No queue entries matched the current filters.
                        </section>
                    ) : (
                        <div className="grid gap-4">
                            {queues.map((entry) => (
                                <article key={entry.reservation_id} className="rounded-xl border border-gray-200 bg-white p-5">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#40311D]">{entry.reservation_number}</p>
                                            <h3 className="mt-2 text-xl font-bold text-[#2c2115]">{queuePatientName(entry)}</h3>
                                            <div className="mt-4 grid gap-2 text-[12px] leading-7 text-gray-700 sm:grid-cols-2">
                                                <p>Clinic: {entry.clinic?.name ?? '-'}</p>
                                                <p>Doctor: {entry.doctor?.name ?? '-'}</p>
                                                <p>Reservation date: {formatDateLabel(entry.reservation_date)}</p>
                                                <p>Window: {entry.window.start_time} - {entry.window.end_time}</p>
                                                <p>Queue: {formatQueueCode(entry, entry.queue.number, queuePrefixes)}</p>
                                                <p>Queue status: {formatQueueStatus(entry.queue.status)}</p>
                                                <p>Position: {entry.queue.position ?? '-'}</p>
                                                <p>Waiting ahead: {entry.queue.waiting_ahead ?? '-'}</p>
                                            </div>
                                        </div>
                                        <div className="rounded-xl bg-teal-50 px-4 py-3 text-[12px] font-medium text-teal-700">
                                            {entry.queue.is_current ? 'Current active queue' : `Current called: ${formatQueueCode(entry, entry.queue.current_called_number, queuePrefixes)}`}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </AppLayout>
    );
}

function CompleteQueueModal({
    entry,
    form,
    errors,
    error,
    submitting,
    onChange,
    onClose,
    onSubmit,
}: {
    entry: QueueEntry;
    form: MedicalRecordCompletionForm;
    errors: ValidationErrors;
    error: string | null;
    submitting: boolean;
    onChange: (updates: Partial<MedicalRecordCompletionForm>) => void;
    onClose: () => void;
    onSubmit: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    onSubmit();
                }}
                className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <p className="text-[16px] font-medium text-[#40311D]">Selesaikan Antrean</p>
                    <p className="mt-1 text-[12px] text-gray-400">
                        Buat rekam medis untuk {queuePatientName(entry)}. Dokter penanggung jawab: {entry.doctor?.name ?? '-'}.
                    </p>
                </div>

                <div className="space-y-4 p-5">
                    {error ? (
                        <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                            {error}
                        </section>
                    ) : null}

                    <div className="grid gap-3 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4 text-[12px] text-gray-600 md:grid-cols-2">
                        <PreviewRow label="Kode Reservasi" value={entry.reservation_number} />
                        <PreviewRow label="Pasien" value={queuePatientName(entry)} />
                        <PreviewRow label="Tanggal" value={formatDateLabel(entry.reservation_date)} />
                        <PreviewRow label="Window" value={`${entry.window.start_time} - ${entry.window.end_time}`} />
                    </div>

                    <TextAreaField
                        label="Doctor notes"
                        required
                        value={form.doctor_notes}
                        error={errors.doctor_notes?.[0]}
                        placeholder="Catatan dokter wajib diisi."
                        onChange={(value) => onChange({ doctor_notes: value })}
                    />
                    <TextAreaField
                        label="Diagnosis"
                        value={form.diagnosis}
                        error={errors.diagnosis?.[0]}
                        placeholder="Opsional."
                        onChange={(value) => onChange({ diagnosis: value })}
                    />
                    <TextAreaField
                        label="Treatment"
                        value={form.treatment}
                        error={errors.treatment?.[0]}
                        placeholder="Opsional."
                        onChange={(value) => onChange({ treatment: value })}
                    />
                    <TextAreaField
                        label="Prescription note"
                        value={form.prescription_notes}
                        error={errors.prescription_notes?.[0]}
                        placeholder="Opsional."
                        onChange={(value) => onChange({ prescription_notes: value })}
                    />
                </div>

                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition-colors hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || form.doctor_notes.trim() === ''}
                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Menyimpan...' : 'Selesaikan Antrean'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function SelectedQueuePreview({ entry, prefixes }: { entry: QueueEntry; prefixes: QueuePrefixMap }) {
    return (
        <div className="grid gap-3">
            <PreviewRow label="Kode Reservasi" value={entry.reservation_number} />
            <PreviewRow label="Pasien" value={queuePatientName(entry)} />
            <PreviewRow label="Email pasien" value={queuePatientEmailLabel(entry)} />
            <PreviewRow label="Telepon pasien" value={queuePatientPhoneLabel(entry)} />
            <PreviewRow label="Dokter" value={entry.doctor?.name ?? '-'} />
            <PreviewRow label="Tanggal" value={formatDateLabel(entry.reservation_date)} />
            <PreviewRow label="Queue number" value={formatQueueCode(entry, entry.queue.number, prefixes)} />
            <PreviewRow label="Queue position" value={entry.queue.position !== null ? String(entry.queue.position) : '-'} />
            <PreviewRow label="Menunggu Antrean" value={entry.queue.waiting_ahead !== null ? String(entry.queue.waiting_ahead) : '-'} />
            {entry.complaint ? <PreviewRow label="Complaint" value={entry.complaint} /> : null}
        </div>
    );
}

function TextAreaField({
    label,
    value,
    onChange,
    error,
    placeholder,
    required = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
    required?: boolean;
}) {
    return (
        <label className="flex flex-col gap-1 text-[11px] font-medium text-[#40311D]">
            {label}
            <textarea
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                rows={required ? 4 : 3}
                className="resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#40311D]"
            />
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </label>
    );
}

function FlashAndErrors({ page }: { page: ReturnType<typeof usePage<SharedData & { errors?: ValidationErrors }>> }) {
    return (
        <>
            {page.props.flash?.status ? (
                <section className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[12px] font-medium text-teal-700">
                    {page.props.flash.status}
                </section>
            ) : null}

            {page.props.errors && Object.keys(page.props.errors).length > 0 ? (
                <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                    {Object.values(page.props.errors).flat().join(' ')}
                </section>
            ) : null}
        </>
    );
}

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3 w-full">
            <p className="text-[13px] font-medium text-[#40311D]">{title}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
        </div>
    );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${active ? 'border-[#40311D] bg-[#40311D] text-white' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
        >
            {children}
        </button>
    );
}

function ActionButton({
    children,
    disabled,
    onClick,
    variant = 'secondary',
    danger = false,
    className = '',
    walkinClass = '',
    tooltip,
}: {
    children: string;
    disabled: boolean;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
    danger?: boolean;
    className?: string;
    walkinClass?: string;
    tooltip?: string;
}) {
    const enabledClasses = danger
        ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        : variant === 'primary'
            ? 'bg-[#40311D] text-white hover:bg-[#2c2115]'
            : 'border border-gray-200 bg-white text-[#40311D] hover:bg-[#DFE0DF]';

    const button = (
        <span className="group relative block">
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                aria-describedby={disabled && tooltip ? `${children.replace(/\W+/g, '-').toLowerCase()}-hint` : undefined}
                className={`w-full cursor-pointer rounded-lg px-3 py-1.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400 ${enabledClasses} ${className}`}
            >
                {children}
            </button>
            {disabled && tooltip ? (
                <span
                    id={`${children.replace(/\W+/g, '-').toLowerCase()}-hint`}
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-[#e4ddd4] bg-[#2c2115] px-3 py-2 text-center text-[11px] leading-4 text-white shadow-lg group-hover:block group-focus-within:block"
                >
                    {tooltip}
                </span>
            ) : null}
        </span>
    );

    return walkinClass ? (
        <div className={walkinClass}>{button}</div>
    ) : (
        button
    );
}

function QueueCodeBadge({ children }: { children: ReactNode }) {
    return <span className="inline-block rounded-full bg-teal-50 px-4 py-1 text-[10px] font-medium text-teal-700">{children}</span>;
}

function QueueStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        waiting: 'bg-amber-50 text-amber-700',
        called: 'bg-sky-50 text-sky-700',
        in_progress: 'bg-teal-50 text-teal-700',
        skipped: 'bg-orange-50 text-orange-700',
        cancelled: 'bg-red-50 text-red-600',
        completed: 'bg-gray-100 text-gray-500',
    };

    return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>{formatQueueStatus(status)}</span>;
}

function doctorQueueActionHint(entry: QueueEntry | null, action: 'start' | 'complete'): string {
    if (entry === null) {
        return 'Pilih antrean terlebih dahulu untuk menjalankan aksi ini.';
    }

    if (action === 'start') {
        if (entry.queue.status === 'waiting') {
            return 'Antrean harus dipanggil oleh admin terlebih dahulu sebelum dokter bisa memulai pemeriksaan.';
        }

        if (entry.queue.status === 'in_progress') {
            return 'Antrean ini sudah dalam proses pemeriksaan.';
        }

        return `Aksi Start hanya tersedia untuk antrean berstatus Called. Status saat ini: ${formatQueueStatus(entry.queue.status)}.`;
    }

    if (entry.reservation_status !== 'approved') {
        return 'Rekam medis hanya bisa dibuat untuk reservasi yang masih berstatus Approved.';
    }

    if (entry.queue.status === 'called') {
        return 'Klik Start/In Progress terlebih dahulu sebelum menyelesaikan antrean dan mengisi rekam medis.';
    }

    if (entry.queue.status === 'waiting') {
        return 'Antrean belum dipanggil dan belum dimulai, sehingga belum bisa diselesaikan.';
    }

    return `Aksi selesai hanya tersedia untuk antrean berstatus In Progress. Status saat ini: ${formatQueueStatus(entry.queue.status)}.`;
}

function ReservationStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: 'bg-amber-50 text-amber-700',
        approved: 'bg-teal-50 text-teal-700',
        completed: 'bg-teal-50 text-teal-700',
        cancelled: 'bg-red-50 text-red-600',
        rejected: 'bg-red-50 text-red-600',
    };

    return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>{formatReservationStatus(status)}</span>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">{label}</p>
            <p className="mt-0.5 text-[12px] text-gray-700">{value}</p>
        </div>
    );
}

function buildDoctorOptions(entries: QueueEntry[]): DoctorOption[] {
    const doctors = new Map<string, DoctorOption>();

    entries.forEach((entry) => {
        const key = doctorKey(entry);
        doctors.set(key, {
            key,
            id: entry.doctor?.id ?? null,
            name: entry.doctor?.name ?? 'Dokter tidak diketahui',
        });
    });

    return Array.from(doctors.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function buildQueuePrefixes(doctors: DoctorOption[]): QueuePrefixMap {
    return Object.fromEntries(doctors.map((doctor, index) => [doctor.key, indexToLetters(index)]));
}

function doctorKey(entry: QueueEntry): string {
    return entry.doctor?.id ? `doctor-${entry.doctor.id}` : `doctor-${entry.doctor?.name ?? 'unknown'}`;
}

function indexToLetters(index: number): string {
    let value = index + 1;
    let letters = '';

    while (value > 0) {
        const remainder = (value - 1) % 26;
        letters = String.fromCharCode(65 + remainder) + letters;
        value = Math.floor((value - 1) / 26);
    }

    return letters;
}

function formatQueueCode(entry: QueueEntry, queueNumber: number | null | undefined, prefixes: QueuePrefixMap): string {
    if (!queueNumber || Number.isNaN(queueNumber)) {
        return '-';
    }

    const prefix = prefixes[doctorKey(entry)] ?? 'Q';

    return `${prefix}-${String(queueNumber).padStart(2, '0')}`;
}

function queuePatientName(entry: QueueEntry): string {
    return entry.patient?.name ?? `(Walk-In) ${entry.guest_name ?? 'Patient'}`;
}

function queuePatientEmailLabel(entry: QueueEntry): string {
    return entry.patient?.email ?? '-';
}

function queuePatientPhoneLabel(entry: QueueEntry): string {
    return entry.patient?.phone_number ?? entry.guest_phone_number ?? '-';
}

function formatQueueStatus(status: string): string {
    const labels: Record<string, string> = {
        waiting: 'Waiting',
        called: 'Called',
        in_progress: 'In Progress',
        skipped: 'Skipped',
        cancelled: 'Cancelled',
        completed: 'Completed',
    };

    return labels[status] ?? status;
}

function formatReservationStatus(status: string): string {
    const labels: Record<string, string> = {
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
        completed: 'Completed',
    };

    return labels[status] ?? status;
}

function formatDateLabel(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthIndex = Number(month) - 1;

    if (!year || !month || !day || monthIndex < 0 || monthIndex > 11) {
        return value;
    }

    return `${day} ${monthNames[monthIndex]} ${year}`;
}

function cleanQuery(query: Record<string, string | number | boolean | null | undefined>) {
    return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

async function requestJson(url: string, method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>): Promise<JsonResult> {
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
        return {
            ok: false,
            message: body?.message ?? Object.values(body?.errors ?? {}).flat().join(' ') ?? 'Request failed.',
            errors: normalizeJsonErrors(body?.errors ?? {}),
        };
    }

    return { ok: true, message: body?.message };
}

function normalizeJsonErrors(errors: Record<string, unknown>): ValidationErrors {
    return Object.fromEntries(
        Object.entries(errors).map(([field, messages]) => [
            field,
            Array.isArray(messages) ? messages.map((message) => String(message)) : [String(messages)],
        ]),
    );
}


