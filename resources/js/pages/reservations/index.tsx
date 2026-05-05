import { Head, router, usePage } from '@inertiajs/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { ClinicSelector } from '@/components/clinic-selector';
import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { ReservationEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type BookingWindow = {
    window_start_time: string;
    window_end_time: string;
    max_slots: number;
    booked_slots: number;
    available_slots: number;
    slot_numbers_available: number[];
    is_available: boolean;
};

type BookingOptions = {
    clinics: { id: number; name: string }[];
    selectedClinicId: number | null;
    doctors: { id: number; name: string }[];
    selectedDoctorId: number | null;
    reservationDate: string;
    schedules: {
        id: number;
        start_time: string;
        end_time: string;
        window_minutes: number;
        max_patients_per_window: number;
    }[];
    selectedScheduleId: number | null;
    windows: BookingWindow[];
} | null;

type ReservationsPageProps = {
    context: WorkspaceContext;
    reservations: ReservationEntry[];
    booking: BookingOptions;
    filters: {
        status: string;
        clinicId: number | null;
    };
};

type PageProps = SharedData & { errors?: ValidationErrors };

type PracticeScheduleOption = {
    id: number;
    start_time: string;
    end_time: string;
    window_minutes: number;
    max_patients_per_window: number;
};

type AdminActionModalType = 'approve' | 'reject' | 'cancel' | 'edit' | 'reschedule';

type AdminActionModal = {
    type: AdminActionModalType;
    reservation: ReservationEntry;
};

const adminStatusFilters = ['pending', 'approved', 'completed', 'cancelled'];

export default function ReservationsPage({ context, reservations, booking, filters }: ReservationsPageProps) {
    const page = usePage<PageProps>();
    const isAdminWorkspace = context.role === 'admin' || context.role === 'superadmin';
    const queueOf = (reservation: ReservationEntry) => reservation.queue_summary;

    const updateFilters = (updates: Partial<ReservationsPageProps['filters']>) => {
        const nextFilters = { ...filters, ...updates };

        router.get('/reservations', cleanQuery({
            status: nextFilters.status,
            clinic_id: nextFilters.clinicId,
            booking_clinic_id: booking?.selectedClinicId,
            booking_doctor_id: booking?.selectedDoctorId,
            booking_reservation_date: booking?.reservationDate,
            booking_schedule_id: booking?.selectedScheduleId,
        }), {
            preserveScroll: true,
        });
    };

    const processReservation = (
        reservation: ReservationEntry,
        status: 'approved' | 'rejected' | 'cancelled',
        cancellationReason?: string,
        callbacks?: { onSuccess?: () => void; onFinish?: () => void },
    ) => {
        const clinicId = reservation.clinic_id ?? reservation.clinic?.id ?? filters.clinicId;

        if (!clinicId) {
            return;
        }

        const payload: Record<string, string | number> = {
            clinic_id: clinicId,
            status,
        };

        if (status === 'approved' && cancellationReason !== undefined) {
            payload.admin_notes = cancellationReason;
        }

        if (status === 'cancelled' || status === 'rejected') {
            if (!cancellationReason) {
                return;
            }

            payload.cancellation_reason = cancellationReason;
        }

        router.patch(`/reservations/${reservation.id}/process`, payload, {
            preserveScroll: true,
            onSuccess: callbacks?.onSuccess,
            onFinish: callbacks?.onFinish,
        });
    };

    if (isAdminWorkspace) {
        return (
            <AdminReservationsPage
                context={context}
                reservations={reservations}
                filters={filters}
                page={page}
                queueOf={queueOf}
                updateFilters={updateFilters}
                processReservation={processReservation}
            />
        );
    }

    return (
        <PatientReservationsPage
            reservations={reservations}
            booking={booking}
            filters={filters}
            page={page}
            queueOf={queueOf}
        />
    );
}

function AdminReservationsPage({
    context,
    reservations,
    filters,
    page,
    queueOf,
    updateFilters,
    processReservation,
}: {
    context: WorkspaceContext;
    reservations: ReservationEntry[];
    filters: ReservationsPageProps['filters'];
    page: ReturnType<typeof usePage<PageProps>>;
    queueOf: (reservation: ReservationEntry) => ReservationEntry['queue_summary'];
    updateFilters: (updates: Partial<ReservationsPageProps['filters']>) => void;
    processReservation: (
        reservation: ReservationEntry,
        status: 'approved' | 'rejected' | 'cancelled',
        cancellationReason?: string,
        callbacks?: { onSuccess?: () => void; onFinish?: () => void },
    ) => void;
}) {
    const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
    const [reservationNumberSearch, setReservationNumberSearch] = useState('');
    const [patientSearch, setPatientSearch] = useState('');
    const [doctorFilter, setDoctorFilter] = useState<number | null>(null);
    const [actionModal, setActionModal] = useState<AdminActionModal | null>(null);
    const [reason, setReason] = useState('');
    const [admin_notes, setAdminNotes] = useState('');
    const [editComplaint, setEditComplaint] = useState('');
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleScheduleId, setRescheduleScheduleId] = useState('');
    const [rescheduleWindowStart, setRescheduleWindowStart] = useState('');
    const [rescheduleSchedules, setRescheduleSchedules] = useState<PracticeScheduleOption[]>([]);
    const [rescheduleWindows, setRescheduleWindows] = useState<BookingWindow[]>([]);
    const [modalError, setModalError] = useState<string | null>(null);
    const [isModalSubmitting, setIsModalSubmitting] = useState(false);
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
    const [isLoadingWindows, setIsLoadingWindows] = useState(false);

    const selectedReservation = reservations.find((reservation) => reservation.id === selectedReservationId) ?? null;
    const doctorOptions = useMemo(() => {
        const doctors = new Map<number, string>();

        reservations.forEach((reservation) => {
            if (reservation.doctor?.id && reservation.doctor.name) {
                doctors.set(reservation.doctor.id, reservation.doctor.name);
            }
        });

        return Array.from(doctors.entries()).map(([id, name]) => ({ id, name }));
    }, [reservations]);
    const filteredReservations = useMemo(() => {
        const reservationSearch = reservationNumberSearch.trim().toLowerCase();
        const patientNameSearch = patientSearch.trim().toLowerCase();

        return reservations.filter((reservation) => {
            const matchesReservationNumber = reservationSearch === '' || reservation.reservation_number.toLowerCase().includes(reservationSearch);
            const matchesPatient = patientNameSearch === '' || patientDisplayName(reservation).toLowerCase().includes(patientNameSearch);
            const matchesDoctor = doctorFilter === null || reservation.doctor?.id === doctorFilter;

            return matchesReservationNumber && matchesPatient && matchesDoctor;
        });
    }, [doctorFilter, patientSearch, reservationNumberSearch, reservations]);
    const reservationPagination = useClientPagination(filteredReservations);

    useEffect(() => {
        if (selectedReservationId !== null && reservationPagination.paginatedItems.some((reservation) => reservation.id === selectedReservationId)) {
            return;
        }

        setSelectedReservationId(reservationPagination.paginatedItems[0]?.id ?? null);
    }, [reservationPagination.paginatedItems, selectedReservationId]);

    const canApprove = selectedReservation?.status === 'pending';
    const canReject = selectedReservation?.status === 'pending';
    const canManageActive = selectedReservation !== null && ['pending', 'approved'].includes(selectedReservation.status);

    const updateReservationDetails = async (reservation: ReservationEntry, payload: Record<string, string | number | null>) => {
        const clinicId = reservation.clinic_id ?? reservation.clinic?.id ?? filters.clinicId;

        if (!clinicId) {
            return { ok: false, message: 'Clinic context is missing for this reservation.' };
        }

        return patchJson(`/admin/reservations/${reservation.id}/details`, {
            clinic_id: clinicId,
            ...payload,
        });
    };

    const openActionModal = (type: AdminActionModalType, reservation: ReservationEntry) => {
        setActionModal({ type, reservation });
        setReason('');
        setAdminNotes(reservation.admin_notes ?? '');
        setEditComplaint(reservation.complaint ?? '');
        setRescheduleDate(reservation.reservation_date.slice(0, 10));
        setRescheduleScheduleId(reservation.doctor_clinic_schedule_id ? String(reservation.doctor_clinic_schedule_id) : '');
        setRescheduleWindowStart(reservation.window_start_time.slice(0, 5));
        setRescheduleSchedules([]);
        setRescheduleWindows([]);
        setModalError(null);
    };

    const closeActionModal = (force = false) => {
        if (isModalSubmitting && !force) {
            return;
        }

        setActionModal(null);
        setReason('');
        setAdminNotes('');
        setEditComplaint('');
        setModalError(null);
    };

    useEffect(() => {
        if (actionModal?.type !== 'reschedule' || !rescheduleDate) {
            return;
        }

        const reservation = actionModal.reservation;
        const clinicId = reservation.clinic_id ?? reservation.clinic?.id ?? filters.clinicId;
        const doctorId = reservation.doctor?.id;

        if (!clinicId || !doctorId) {
            setModalError('Clinic or doctor data is missing for this reservation.');
            return;
        }

        const controller = new AbortController();

        setIsLoadingSchedules(true);
        setModalError(null);

        getJson<{ schedules: PracticeScheduleOption[] }>(
            `/reservations/schedules?${new URLSearchParams({
                clinic_id: String(clinicId),
                doctor_id: String(doctorId),
                reservation_date: rescheduleDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const schedules = data.schedules ?? [];
                const currentScheduleStillExists = schedules.some((schedule) => String(schedule.id) === rescheduleScheduleId);

                setRescheduleSchedules(schedules);
                setRescheduleScheduleId(currentScheduleStillExists ? rescheduleScheduleId : (schedules[0]?.id ? String(schedules[0].id) : ''));
            })
            .catch((error: Error) => {
                if (error.name !== 'AbortError') {
                    setRescheduleSchedules([]);
                    setRescheduleScheduleId('');
                    setModalError(error.message);
                }
            })
            .finally(() => setIsLoadingSchedules(false));

        return () => controller.abort();
    }, [actionModal, filters.clinicId, rescheduleDate]);

    useEffect(() => {
        if (actionModal?.type !== 'reschedule' || !rescheduleDate || !rescheduleScheduleId) {
            setRescheduleWindows([]);
            return;
        }

        const controller = new AbortController();

        setIsLoadingWindows(true);
        setModalError(null);

        getJson<{ windows: BookingWindow[] }>(
            `/reservations/booking/windows?${new URLSearchParams({
                doctor_clinic_schedule_id: rescheduleScheduleId,
                reservation_date: rescheduleDate,
                ignore_reservation_id: String(actionModal.reservation.id),
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const windows = data.windows ?? [];
                const currentWindowStart = actionModal.reservation.window_start_time.slice(0, 5);
                const preferredWindow = windows.find((window) => window.is_available && window.window_start_time.slice(0, 5) === currentWindowStart)
                    ?? windows.find((window) => window.is_available);

                setRescheduleWindows(windows);
                setRescheduleWindowStart(preferredWindow?.window_start_time.slice(0, 5) ?? '');
            })
            .catch((error: Error) => {
                if (error.name !== 'AbortError') {
                    setRescheduleWindows([]);
                    setRescheduleWindowStart('');
                    setModalError(error.message);
                }
            })
            .finally(() => setIsLoadingWindows(false));

        return () => controller.abort();
    }, [actionModal, rescheduleDate, rescheduleScheduleId]);

    const submitActionModal = async () => {
        if (!actionModal) {
            return;
        }

        setModalError(null);

        if (actionModal.type === 'approve') {
            setIsModalSubmitting(true);
            processReservation(
                actionModal.reservation,
                'approved',
                admin_notes.trim(),
                {
                    onSuccess: () => closeActionModal(true),
                    onFinish: () => setIsModalSubmitting(false),
                },
            );
            return;
        }

        if (actionModal.type === 'reject' || actionModal.type === 'cancel') {
            const trimmedReason = reason.trim();

            if (!trimmedReason) {
                setModalError(actionModal.type === 'reject' ? 'Rejection reason is required.' : 'Cancellation reason is required.');
                return;
            }

            setIsModalSubmitting(true);
            processReservation(
                actionModal.reservation,
                actionModal.type === 'reject' ? 'rejected' : 'cancelled',
                trimmedReason,
                {
                    onSuccess: () => closeActionModal(true),
                    onFinish: () => setIsModalSubmitting(false),
                },
            );
            return;
        }

        if (actionModal.type === 'edit') {
            setIsModalSubmitting(true);

            const result = await updateReservationDetails(actionModal.reservation, { complaint: editComplaint });

            setIsModalSubmitting(false);

            if (!result.ok) {
                setModalError(result.message ?? 'Failed to update reservation details.');
                return;
            }

            closeActionModal();
            return;
        }

        if (!rescheduleDate || !rescheduleScheduleId || !rescheduleWindowStart) {
            setModalError('Please select reservation date, schedule, and window.');
            return;
        }

        setIsModalSubmitting(true);

        const result = await updateReservationDetails(actionModal.reservation, {
            doctor_clinic_schedule_id: Number(rescheduleScheduleId),
            reservation_date: rescheduleDate,
            window_start_time: rescheduleWindowStart,
            admin_notes: admin_notes.trim() === '' ? null : admin_notes.trim(),
        });

        setIsModalSubmitting(false);

        if (!result.ok) {
            setModalError(result.message ?? 'Failed to reschedule reservation.');
            return;
        }

        closeActionModal();
    };

    return (
        <AppLayout>
            <Head title="Reservasi" />

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
                        <p className="mb-2 text-[12px] font-medium text-[#40311D]">Filter Reservasi</p>
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
                                    value={doctorFilter ?? ''}
                                    onChange={(event) => setDoctorFilter(event.target.value === '' ? null : Number(event.target.value))}
                                    className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-700 outline-none"
                                >
                                    <option value="">Semua Dokter</option>
                                    {doctorOptions.map((doctor) => (
                                        <option key={doctor.id} value={doctor.id}>
                                            {doctor.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1">
                                <span className="text-[12px] text-gray-400">Search</span>
                                <input
                                    value={patientSearch}
                                    onChange={(event) => setPatientSearch(event.target.value)}
                                    placeholder="Patient name..."
                                    type="text"
                                    className="w-32 bg-transparent text-[12px] italic outline-none placeholder:text-gray-400"
                                />
                            </div>
                            {adminStatusFilters.map((status) => (
                                <FilterChip key={status} active={filters.status === status} onClick={() => updateFilters({ status: filters.status === status ? '' : status })}>
                                    {capitalize(status)}
                                </FilterChip>
                            ))}
                        </div>
                    </div>

                    <div className="grid items-start gap-4 xl:grid-cols-[1fr_260px]">
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <CardHeader title="Daftar Reservasi" subtitle="Reservasi clinic-scoped" />
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] border-collapse text-[12px]">
                                    <thead>
                                        <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                            {['No', 'Kode Reservasi', 'Pasien', 'Dokter', 'Tanggal', 'Window', 'Status'].map((header) => (
                                                <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredReservations.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                                                    Tidak ada reservasi yang sesuai filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            reservationPagination.paginatedItems.map((reservation, index) => (
                                                <tr
                                                    key={reservation.id}
                                                    onClick={() => setSelectedReservationId(reservation.id)}
                                                    className={`cursor-pointer border-b border-[#ede8e2] transition-colors last:border-0 hover:bg-[#faf9f7] ${selectedReservationId === reservation.id ? 'bg-[#faf9f7]' : ''}`}
                                                >
                                                    <td className="px-4 py-2.5 text-gray-700">{String(reservationPagination.startItem + index).padStart(3, '0')}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{reservation.reservation_number ?? '-'}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{patientDisplayName(reservation)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{reservation.doctor?.name ?? '-'}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{formatDateLabel(reservation.reservation_date)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{scheduleWindowLabel(reservation.window_start_time)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700"><StatusBadge status={capitalize(reservation.status)} /></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls
                                page={reservationPagination.page}
                                perPage={reservationPagination.perPage}
                                total={reservationPagination.total}
                                pageCount={reservationPagination.pageCount}
                                startItem={reservationPagination.startItem}
                                endItem={reservationPagination.endItem}
                                perPageOptions={reservationPagination.perPageOptions}
                                onPageChange={reservationPagination.setPage}
                                onPerPageChange={reservationPagination.setPerPage}
                            />
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <CardHeader title="Aksi Reservasi" subtitle="Operasi reservasi terpilih" />
                                <div className="grid grid-cols-2 gap-2 p-4">
                                    <ActionButton disabled={!canApprove} variant="primary" onClick={() => selectedReservation && openActionModal('approve', selectedReservation)}>
                                        Approve
                                    </ActionButton>
                                    <ActionButton disabled={!canReject} onClick={() => selectedReservation && openActionModal('reject', selectedReservation)}>
                                        Reject
                                    </ActionButton>
                                    <ActionButton disabled={!canManageActive} onClick={() => selectedReservation && openActionModal('cancel', selectedReservation)}>
                                        Cancel
                                    </ActionButton>
                                    <ActionButton disabled={!canManageActive} onClick={() => selectedReservation && openActionModal('edit', selectedReservation)}>
                                        Edit Detail
                                    </ActionButton>
                                    <ActionButton disabled={!canManageActive} className="col-span-2" onClick={() => selectedReservation && openActionModal('reschedule', selectedReservation)}>
                                        Reschedule
                                    </ActionButton>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <CardHeader title="Reservasi Terpilih" subtitle="Preview data utama" />
                                <div className="min-h-[120px] space-y-2 p-4 text-[12px] text-gray-600">
                                    {selectedReservation ? (
                                        <SelectedReservationPreview reservation={selectedReservation} />
                                    ) : (
                                        <p className="italic text-gray-400">Pilih reservasi untuk melihat detail</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {actionModal ? (
                    <AdminReservationActionModal
                        modal={actionModal}
                        admin_notes={admin_notes}
                        reason={reason}
                        editComplaint={editComplaint}
                        rescheduleDate={rescheduleDate}
                        rescheduleScheduleId={rescheduleScheduleId}
                        rescheduleWindowStart={rescheduleWindowStart}
                        rescheduleSchedules={rescheduleSchedules}
                        rescheduleWindows={rescheduleWindows}
                        isLoadingSchedules={isLoadingSchedules}
                        isLoadingWindows={isLoadingWindows}
                        isSubmitting={isModalSubmitting}
                        error={modalError}
                        onClose={closeActionModal}
                        onSubmit={submitActionModal}
                        onReasonChange={setReason}
                        onAdminNotesChange={setAdminNotes}
                        onComplaintChange={setEditComplaint}
                        onRescheduleDateChange={setRescheduleDate}
                        onRescheduleScheduleChange={setRescheduleScheduleId}
                        onRescheduleWindowChange={setRescheduleWindowStart}
                    />
                ) : null}
            </section>
        </AppLayout>
    );
}

function AdminReservationActionModal({
    modal,
    admin_notes,
    reason,
    editComplaint,
    rescheduleDate,
    rescheduleScheduleId,
    rescheduleWindowStart,
    rescheduleSchedules,
    rescheduleWindows,
    isLoadingSchedules,
    isLoadingWindows,
    isSubmitting,
    error,
    onClose,
    onSubmit,
    onAdminNotesChange,
    onReasonChange,
    onComplaintChange,
    onRescheduleDateChange,
    onRescheduleScheduleChange,
    onRescheduleWindowChange,
}: {
    modal: AdminActionModal;
    reason: string;
    admin_notes: string;
    editComplaint: string;
    rescheduleDate: string;
    rescheduleScheduleId: string;
    rescheduleWindowStart: string;
    rescheduleSchedules: PracticeScheduleOption[];
    rescheduleWindows: BookingWindow[];
    isLoadingSchedules: boolean;
    isLoadingWindows: boolean;
    isSubmitting: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: () => void;
    onReasonChange: (value: string) => void;
    onAdminNotesChange: (value: string) => void;
    onComplaintChange: (value: string) => void;
    onRescheduleDateChange: (value: string) => void;
    onRescheduleScheduleChange: (value: string) => void;
    onRescheduleWindowChange: (value: string) => void;
}) {
    const title = {
        approve: 'Approve Reservation',
        reject: 'Reject Reservation',
        cancel: 'Cancel Reservation',
        edit: 'Edit Reservation Detail',
        reschedule: 'Reschedule Reservation',
    }[modal.type];
    const submitLabel = {
        approve: 'Submit Approval',
        reject: 'Submit Rejection',
        cancel: 'Submit Cancellation',
        edit: 'Save Detail',
        reschedule: 'Save Reschedule',
    }[modal.type];
    const isReasonModal = modal.type === 'reject' || modal.type === 'cancel';
    const activeWindows = rescheduleWindows.filter((window) => window.is_available);
    const disableSubmit = isSubmitting
        || (isReasonModal && reason.trim() === '')
        || (modal.type === 'reschedule' && (!rescheduleDate || !rescheduleScheduleId || !rescheduleWindowStart || activeWindows.length === 0));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2115]/55 px-4 py-6">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#e4ddd4] bg-white shadow-[0_24px_80px_rgba(44,33,21,0.25)]">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <p className="text-[15px] font-medium text-[#40311D]">{title}</p>
                    <p className="mt-1 text-[12px] text-gray-500">
                        {modal.reservation.reservation_number} - {patientDisplayName(modal.reservation)}
                    </p>
                </div>

                <div className="space-y-4 px-5 py-4">
                    {error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {isReasonModal ? (
                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            {modal.type === 'reject' ? 'Rejection reason' : 'Cancellation reason'}
                            <textarea
                                value={reason}
                                onChange={(event) => onReasonChange(event.target.value)}
                                rows={4}
                                placeholder={modal.type === 'reject' ? 'Jelaskan alasan penolakan.' : 'Jelaskan alasan pembatalan.'}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                            />
                        </label>
                    ) : null}

                    {modal.type === 'approve' ? (
                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Admin notes <span className="font-normal text-gray-400">(opsional)</span>
                            <textarea
                                value={admin_notes}
                                onChange={(event) => onAdminNotesChange(event.target.value)}
                                rows={4}
                                placeholder="Tambahkan catatan admin jika diperlukan."
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                            />
                        </label>
                    ) : null}

                    {modal.type === 'edit' ? (
                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Complaint
                            <textarea
                                value={editComplaint}
                                onChange={(event) => onComplaintChange(event.target.value)}
                                rows={4}
                                placeholder="Update patient complaint."
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                            />
                        </label>
                    ) : null}

                    {modal.type === 'reschedule' ? (
                        <div className="grid gap-4">
                            <div className="rounded-xl border border-[#e4ddd4] bg-[#faf9f7] px-4 py-3 text-[12px] text-gray-600">
                                <p>Doctor: {modal.reservation.doctor?.name ?? '-'}</p>
                                <p>Current window: {modal.reservation.window_start_time} - {modal.reservation.window_end_time}</p>
                            </div>

                            <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Reservation date
                                <input
                                    type="date"
                                    value={rescheduleDate}
                                    onChange={(event) => onRescheduleDateChange(event.target.value)}
                                    className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                />
                            </label>

                            <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Doctor schedule
                                <select
                                    value={rescheduleScheduleId}
                                    onChange={(event) => onRescheduleScheduleChange(event.target.value)}
                                    disabled={isLoadingSchedules || rescheduleSchedules.length === 0}
                                    className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                                >
                                    {isLoadingSchedules ? <option value="">Loading schedules...</option> : null}
                                    {!isLoadingSchedules && rescheduleSchedules.length === 0 ? <option value="">No schedule available for this date</option> : null}
                                    {rescheduleSchedules.map((schedule) => (
                                        <option key={schedule.id} value={schedule.id}>
                                            {schedule.start_time} - {schedule.end_time} ({schedule.window_minutes} min, {schedule.max_patients_per_window} patients/window)
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Available window
                                <select
                                    value={rescheduleWindowStart}
                                    onChange={(event) => onRescheduleWindowChange(event.target.value)}
                                    disabled={isLoadingWindows || activeWindows.length === 0}
                                    className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                                >
                                    {isLoadingWindows ? <option value="">Loading windows...</option> : null}
                                    {!isLoadingWindows && activeWindows.length === 0 ? <option value="">No available window for this schedule</option> : null}
                                    {activeWindows.map((window) => (
                                        <option key={window.window_start_time} value={window.window_start_time.slice(0, 5)}>
                                            {window.window_start_time} - {window.window_end_time} ({window.available_slots} slots left)
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Admin Notes
                                <textarea
                                    value={admin_notes}
                                    onChange={(event) => onAdminNotesChange(event.target.value)}
                                    rows={4}
                                    placeholder="Tambahkan catatan admin..."
                                    className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                />
                            </label>
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={disableSubmit}
                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isSubmitting ? 'Saving...' : submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PatientReservationsPage({
    reservations,
    booking,
    filters,
    page,
    queueOf,
}: {
    reservations: ReservationEntry[];
    booking: BookingOptions;
    filters: ReservationsPageProps['filters'];
    page: ReturnType<typeof usePage<PageProps>>;
    queueOf: (reservation: ReservationEntry) => ReservationEntry['queue_summary'];
}) {
    const summary = useMemo(() => ({
        total: reservations.length,
        pending: reservations.filter((reservation) => reservation.status === 'pending').length,
        approved: reservations.filter((reservation) => reservation.status === 'approved').length,
        completed: reservations.filter((reservation) => reservation.status === 'completed').length,
    }), [reservations]);

    return (
        <AppLayout>
            <Head title="Reservations" />

            <section className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[2rem] border border-white/80 bg-night-900 p-8 text-white shadow-[0_25px_80px_rgba(16,24,39,0.18)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-300">Reservations workspace</p>
                        <h2 className="mt-4 text-4xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                            Book and track your reservation
                        </h2>
                        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">
                            This screen tests the core end-to-end reservation flow using Laravel web routes and Inertia actions.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(summary).map(([label, value]) => (
                            <article key={label} className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">{capitalize(label)}</p>
                                <p className="mt-4 text-3xl font-black text-night-900" style={{ fontFamily: 'var(--font-display)' }}>
                                    {value}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>

                <FlashAndErrors page={page} />
                {booking ? <PatientBookingPanel booking={booking} currentStatusFilter={filters.status} /> : null}

                {reservations.length === 0 ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        No reservations matched the current filter.
                    </section>
                ) : (
                    <section className="grid gap-5">
                        {reservations.map((reservation) => (
                            <article key={reservation.id} className="rounded-[1.75rem] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">{reservation.reservation_number}</p>
                                            <h3 className="mt-2 text-xl font-bold text-night-900">
                                                {reservation.doctor?.name ?? 'Doctor not assigned'} at {reservation.clinic?.name ?? 'Clinic'}
                                            </h3>
                                        </div>
                                        <div className="grid gap-2 text-sm leading-7 text-ink-700 sm:grid-cols-2">
                                            <p>Reservation date: {reservation.reservation_date.slice(0, 10)}</p>
                                            <p>Window: {reservation.window_start_time} - {reservation.window_end_time}</p>
                                            <p>Status: {reservation.status}</p>
                                            <p>Queue status: {queueOf(reservation)?.status ?? '-'}</p>
                                            <p>Queue number: {queueOf(reservation)?.number ?? '-'}</p>
                                            <p>Queue position: {queueOf(reservation)?.position ?? '-'}</p>
                                        </div>
                                        {reservation.complaint ? <p className="text-sm leading-7 text-ink-700">Complaint: {reservation.complaint}</p> : null}
                                        {reservation.reschedule_reason ? <p className="text-sm leading-7 text-ink-700">Reschedule reason: {reservation.reschedule_reason}</p> : null}
                                        {reservation.cancellation_reason ? <p className="text-sm leading-7 text-ink-700">{cancellationReasonLabel(reservation)}: {reservation.cancellation_reason}</p> : null}
                                    </div>

                                    <div className="rounded-2xl bg-clinic-100 px-4 py-3 text-sm font-semibold text-clinic-700 lg:min-w-48">
                                        Waiting ahead: {queueOf(reservation)?.waiting_ahead ?? '-'}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </section>
        </AppLayout>
    );
}

function PatientBookingPanel({ booking, currentStatusFilter }: { booking: NonNullable<BookingOptions>; currentStatusFilter: string }) {
    const availableWindow = booking.windows.find((window) => window.is_available);
    const [selectedWindow, setSelectedWindow] = useState(availableWindow?.window_start_time.slice(0, 5) ?? '');
    const [complaint, setComplaint] = useState('');

    useEffect(() => {
        setSelectedWindow(booking.windows.find((window) => window.is_available)?.window_start_time.slice(0, 5) ?? '');
        setComplaint('');
    }, [booking.selectedClinicId, booking.selectedDoctorId, booking.reservationDate, booking.selectedScheduleId, booking.windows]);

    const updateBookingFilters = (updates: Record<string, string | number | null | undefined>) => {
        router.get('/reservations', cleanQuery({
            status: currentStatusFilter,
            booking_clinic_id: booking.selectedClinicId,
            booking_doctor_id: booking.selectedDoctorId,
            booking_reservation_date: booking.reservationDate,
            booking_schedule_id: booking.selectedScheduleId,
            ...updates,
        }), {
            preserveScroll: true,
        });
    };

    const submitBooking = () => {
        if (!booking.selectedScheduleId || !selectedWindow) {
            return;
        }

        router.post('/reservations', {
            doctor_clinic_schedule_id: booking.selectedScheduleId,
            reservation_date: booking.reservationDate,
            window_start_time: selectedWindow,
            complaint,
        }, {
            preserveScroll: true,
        });
    };

    return (
        <section className="rounded-[2rem] border border-clinic-500/20 bg-white/90 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
            <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">Patient booking test</p>
                <h3 className="text-2xl font-black text-night-900" style={{ fontFamily: 'var(--font-display)' }}>
                    Create reservation
                </h3>
                <p className="text-sm leading-7 text-ink-700">
                    Pilih klinik, dokter, tanggal, jadwal, lalu window yang masih memiliki slot kosong.
                </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-4">
                <SelectField label="Clinic" value={booking.selectedClinicId ?? ''} onChange={(value) => updateBookingFilters({ booking_clinic_id: value, booking_doctor_id: null, booking_schedule_id: null })}>
                    {booking.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
                </SelectField>
                <SelectField label="Doctor" value={booking.selectedDoctorId ?? ''} onChange={(value) => updateBookingFilters({ booking_doctor_id: value, booking_schedule_id: null })}>
                    {booking.doctors.length === 0 ? <option value="">No doctors assigned</option> : null}
                    {booking.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
                </SelectField>
                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Date
                    <input
                        type="date"
                        value={booking.reservationDate}
                        onChange={(event) => updateBookingFilters({ booking_reservation_date: event.target.value, booking_schedule_id: null })}
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    />
                </label>
                <SelectField label="Schedule" value={booking.selectedScheduleId ?? ''} onChange={(value) => updateBookingFilters({ booking_schedule_id: value })}>
                    {booking.schedules.length === 0 ? <option value="">No schedule on this date</option> : null}
                    {booking.schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.start_time} - {schedule.end_time}</option>)}
                </SelectField>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_2fr]">
                <SelectField label="Available window" value={selectedWindow} onChange={setSelectedWindow}>
                    {booking.windows.length === 0 ? <option value="">No windows available</option> : null}
                    {booking.windows.map((window) => (
                        <option key={window.window_start_time} value={window.window_start_time.slice(0, 5)} disabled={!window.is_available}>
                            {window.window_start_time} - {window.window_end_time} ({window.available_slots}/{window.max_slots} slots left)
                        </option>
                    ))}
                </SelectField>
                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Complaint
                    <input
                        value={complaint}
                        onChange={(event) => setComplaint(event.target.value)}
                        placeholder="Keluhan singkat pasien"
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    />
                </label>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    type="button"
                    onClick={submitBooking}
                    disabled={!booking.selectedScheduleId || !selectedWindow}
                    className="rounded-2xl bg-night-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-night-700 disabled:cursor-not-allowed disabled:bg-night-900/35"
                >
                    Submit Reservation
                </button>
            </div>
        </section>
    );
}

function SelectedReservationPreview({ reservation }: { reservation: ReservationEntry }) {
    return (
        <div className="space-y-2">
            <PreviewRow label="Kode Reservasi" value={reservation.reservation_number} />
            <PreviewRow label="Pasien" value={patientDisplayName(reservation)} />
            <PreviewRow label="Email pasien" value={patientEmailLabel(reservation)} />
            <PreviewRow label="Telepon pasien" value={patientPhoneLabel(reservation)} />
            <PreviewRow label="Dokter" value={reservation.doctor?.name ?? '-'} />
            <PreviewRow label="Keluhan" value={reservation.complaint ?? '-'} />
            <PreviewRow label="Waktu window" value={`${reservation.window_start_time} - ${reservation.window_end_time}`} />
            {reservation.status !== 'cancelled' && reservation.status !== 'rejected' ? 
            <>
                <PreviewRow label="Window slot" value={reservation.window_slot_number ? `Slot ke-${reservation.window_slot_number}` : '-'} />
            </>
            : null}
            {reservation.cancellation_reason ? <PreviewRow label={cancellationReasonLabel(reservation)} value={reservation.cancellation_reason} /> : null}
            {reservation.reschedule_reason ? <PreviewRow label="Reschedule reason" value={reservation.reschedule_reason} /> : null}
        </div>
    );
}

function FlashAndErrors({ page }: { page: ReturnType<typeof usePage<PageProps>> }) {
    return (
        <>
            {page.props.flash?.status ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[12px] font-medium text-teal-700">
                    {page.props.flash.status}
                </div>
            ) : null}
            {page.props.errors && Object.keys(page.props.errors).length > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                    {Object.values(page.props.errors).flat().join(' ')}
                </div>
            ) : null}
        </>
    );
}

function SelectField({ children, label, value, onChange }: { children: ReactNode; label: string; value: string | number; onChange: (value: string) => void }) {
    return (
        <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
            {label}
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
            >
                {children}
            </select>
        </label>
    );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">{label}</p>
            <p className="mt-0.5 text-[12px] text-gray-700">{value}</p>
        </div>
    );
}

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
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
            {active ? 'Selected ' : ''}{children}
        </button>
    );
}

function ActionButton({ children, disabled, onClick, variant = 'secondary', className = '' }: { children: string; disabled: boolean; onClick: () => void; variant?: 'primary' | 'secondary'; className?: string }) {
    const enabledClasses = variant === 'primary'
        ? 'bg-[#40311D] text-white hover:bg-[#2c2115]'
        : 'border border-gray-200 bg-white text-[#40311D] hover:bg-[#DFE0DF]';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400 ${enabledClasses} ${className}`}
        >
            {children}
        </button>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        Pending: 'bg-amber-50 text-amber-700',
        Approved: 'bg-teal-50 text-teal-700',
        Completed: 'bg-teal-50 text-teal-700',
        Cancelled: 'bg-red-50 text-red-600',
        Rejected: 'bg-red-50 text-red-600',
    };

    return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>{status}</span>;
}

async function patchJson(url: string, payload: Record<string, string | number | null>): Promise<{ ok: boolean; message?: string }> {
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const errorText = Object.values(body?.errors ?? {}).flat().join(' ');
        return { ok: false, message: body?.message ?? errorText ?? 'Request failed.' };
    }

    router.reload();

    return { ok: true };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        signal,
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const errorText = Object.values(body?.errors ?? {}).flat().join(' ');
        throw new Error(body?.message ?? errorText ?? 'Request failed.');
    }

    return response.json() as Promise<T>;
}

function patientDisplayName(reservation: ReservationEntry): string {
    return reservation.patient?.name ?? `(Walk-In) ${reservation.guest_name ?? 'Patient'}`;
}

function patientEmailLabel(reservation: ReservationEntry): string {
    return reservation.patient?.email ?? '-';
}

function patientPhoneLabel(reservation: ReservationEntry): string {
    return reservation.patient?.phone_number ?? reservation.guest_phone_number ?? '-';
}

function cancellationReasonLabel(reservation: ReservationEntry): string {
    return reservation.status === 'rejected' ? 'Rejection reason' : 'Cancellation reason';
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

function scheduleWindowLabel(startTime: string): string {
    const hour = Number(startTime.slice(0, 2));

    if (Number.isNaN(hour)) {
        return '-';
    }

    if (hour < 12) {
        return 'Pagi';
    }

    if (hour < 17) {
        return 'Siang';
    }

    return 'Malam';
}

function capitalize(value: string): string {
    if (value === '') {
        return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

function cleanQuery(query: Record<string, string | number | boolean | null | undefined>) {
    return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}


