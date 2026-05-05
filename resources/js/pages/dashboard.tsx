import { Head, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import { ClinicSelector } from '@/components/clinic-selector';
import { WalkInReservationModal } from '@/components/walk-in-reservation-modal';
import { ScheduleWindowCompactSummary, ScheduleWindowReadonlyModal } from '@/components/schedule-window';
import { buildScheduleWindowPreview } from '@/lib/schedule-window';
import type { ClinicDetail, MedicalRecordEntry, QueueEntry, ReservationEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type Module = {
    title: string;
    description: string;
};

type DashboardProps = {
    context: WorkspaceContext;
    dashboardData: AdminDashboardData | null;
    doctorDashboardData: DoctorDashboardData | null;
    modules: Module[];
};

type ScheduleEntry = {
    id: number;
    doctor_id: number;
    doctor_name: string;
    start_time: string;
    end_time: string;
    window_minutes: number;
    max_patients_per_window: number;
    is_active: boolean;
};

type AdminScheduleEntry = ScheduleEntry & {
    day_of_week: number;
    day_label: string;
    schedule_date: string;
    slot_summary: ScheduleSlotSummary;
    windows: ScheduleWindowSlot[];
};

type ScheduleSlotSummary = {
    total_windows: number;
    total_capacity: number;
    booked_slots: number;
    available_slots: number;
};

type ScheduleWindowSlot = {
    window_start_time: string;
    window_end_time: string;
    max_slots: number;
    booked_slots: number;
    available_slots: number;
    slot_numbers_available: number[];
    is_available: boolean;
};

type ScheduleWeekOption = {
    value: number;
    label: string;
    start_date: string;
    end_date: string;
};

type ScheduleDayOption = {
    date: string;
    day_of_week: number;
    label: string;
};

const scheduleDayOptions = [
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
    { value: 0, label: 'Minggu' },
];

type AdminDashboardData = {
    selectedClinicId: number;
    clinic: ClinicDetail;
    reservations: ReservationEntry[];
    queues: QueueEntry[];
    schedules: AdminScheduleEntry[];
    today: string;
    selectedScheduleDay: number;
    selectedScheduleDayLabel: string;
    selectedScheduleMonth: string;
    selectedScheduleWeek: number;
    selectedScheduleDate: string;
    selectedScheduleDateLabel: string;
    scheduleWeekOptions: ScheduleWeekOption[];
    scheduleDayOptions: ScheduleDayOption[];
};

type DoctorScheduleEntry = ScheduleEntry & {
    day_of_week: number;
    day_label: string;
};

type DoctorDashboardData = {
    selectedClinicId: number;
    clinic: ClinicDetail;
    today: string;
    stats: {
        today_reservations: number;
        waiting_queues: number;
        called_or_in_progress: number;
        completed_today: number;
        medical_records_today: number;
    };
    queues: QueueEntry[];
    currentPatient: QueueEntry | null;
    latestMedicalRecords: MedicalRecordEntry[];
    schedules: DoctorScheduleEntry[];
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

type TableRow = ReactNode[];

type QueueDoctorRow = {
    doctorName: string;
    current: number | null;
    next: number | null;
};

export default function Dashboard({ context, dashboardData, doctorDashboardData, modules }: DashboardProps) {
    const { auth } = usePage<SharedData>().props;

    if (auth?.user?.role === 'admin' || auth?.user?.role === 'superadmin') {
        return <AdminDashboard context={context} dashboardData={dashboardData} />;
    }

    if (auth?.user?.role === 'doctor') {
        return <DoctorDashboard context={context} dashboardData={doctorDashboardData} />;
    }

    return <DefaultDashboard modules={modules} />;
}

function AdminDashboard({ context, dashboardData }: { context: WorkspaceContext; dashboardData: AdminDashboardData | null }) {
    const { auth } = usePage<SharedData>().props;
    const clinic = dashboardData?.clinic ?? null;
    const reservations = dashboardData?.reservations ?? [];
    const queues = dashboardData?.queues ?? [];
    const schedules = dashboardData?.schedules ?? [];
    const selectedScheduleDay = dashboardData?.selectedScheduleDay ?? 1;
    const selectedScheduleDayLabel = scheduleDayLabel(selectedScheduleDay, dashboardData?.selectedScheduleDayLabel);
    const selectedScheduleMonth = dashboardData?.selectedScheduleMonth ?? '';
    const selectedScheduleWeek = dashboardData?.selectedScheduleWeek ?? 1;
    const selectedScheduleDateLabel = dashboardData?.selectedScheduleDateLabel ?? '';
    const scheduleWeekOptions = dashboardData?.scheduleWeekOptions ?? [];
    const scheduleDayChoices = dashboardData?.scheduleDayOptions ?? [];
    const queueRows = useMemo(() => queueRowsByDoctor(queues), [queues]);
    const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
    const [expandedScheduleIds, setExpandedScheduleIds] = useState<number[]>([]);

    const visitDashboard = (overrides: Record<string, string | number>, includeScheduleSelection = true) => {
        const query: Record<string, string | number> = {};

        if (dashboardData?.selectedClinicId) {
            query.clinic_id = dashboardData.selectedClinicId;
        }

        if (includeScheduleSelection && selectedScheduleMonth !== '') {
            query.schedule_month = selectedScheduleMonth;
            query.schedule_week = selectedScheduleWeek;
            query.schedule_day = selectedScheduleDay;
        }

        router.get('/dashboard', { ...query, ...overrides }, { preserveScroll: true, preserveState: true });
    };

    const toggleScheduleSlotPreview = (scheduleId: number) => {
        setExpandedScheduleIds((current) => (
            current.includes(scheduleId)
                ? current.filter((id) => id !== scheduleId)
                : [...current, scheduleId]
        ));
    };

    const statCards = useMemo(() => {
        const activeDoctorIds = new Set(schedules.filter((schedule) => schedule.is_active).map((schedule) => schedule.doctor_id));

        return [
            ['Reservasi', reservations.length],
            ['Antrean Aktif', queues.length],
            ['Pending Approval', reservations.filter((reservation) => reservation.status === 'pending').length],
            ['Dokter Bertugas', activeDoctorIds.size],
            [auth?.user?.role === 'superadmin' ? 'Klinik Terdaftar' : 'Admin Terdaftar', auth?.user?.role === 'superadmin' ? context.clinics.length : 1],
        ];
    }, [auth?.user?.role, context.clinics.length, queues.length, reservations, schedules]);

    return (
        <AppLayout>
            <Head title="Dashboard Admin" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    {context.role === 'superadmin' ? (
                        <ClinicSelector
                                clinics={context.clinics}
                                value={dashboardData?.selectedClinicId}
                                onChange={(clinicId) => visitDashboard({ clinic_id: clinicId })}
                            />
                    ) : null}

                    {dashboardData === null ? (
                        <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-[12px] font-medium text-red-600">Tidak ada klinik yang tersedia untuk akun ini.</div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {statCards.map(([label, value]) => (
                            <StatCard key={label} label={String(label)} value={value} />
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_350px]">
                        <Card>
                            <CardHeader title="Reservasi Terbaru" subtitle="Daftar reservasi masuk terbaru" />
                            <DataTable
                                headers={['No', 'Kode Reservasi', 'Pasien', 'Dokter', 'Tanggal', 'Status']}
                                rows={reservations.slice(0, 6).map((reservation, index) => [
                                    String(index + 1).padStart(3, '0'),
                                    reservation.reservation_number ?? '-',
                                    reservation.patient?.name ?? `(Walk-In) ${reservation.guest_name ?? 'Pasien'}`,
                                    reservation.doctor?.name ?? '-',
                                    formatDateLabel(reservation.reservation_date),
                                    <StatusBadge key={reservation.id} status={formatReservationStatus(reservation.status)} />,
                                ])}
                                emptyText="Belum ada reservasi."
                            />
                        </Card>

                        <div className="flex flex-col gap-4">
                            <Card>
                                <CardHeader title="Quick Actions" subtitle="Akses cepat admin" />
                                <div className="flex flex-wrap gap-2 p-4">
                                    <ActionButton onClick={() => router.visit('/reports')}>Lihat Laporan</ActionButton>
                                    <ActionButton onClick={() => router.visit('/queue')}>Buka Antrean</ActionButton>
                                    <ActionButton variant="primary" disabled={dashboardData === null} onClick={() => setIsWalkInModalOpen(true)}>Buat Walk-In</ActionButton>
                                </div>
                            </Card>

                            <Card>
                                <CardHeader title="Antrean per Dokter" subtitle="Ringkasan queue aktif" />
                                <DataTable
                                    headers={['Dokter', 'Current', 'Next']}
                                    rows={queueRows.map((row) => [
                                        row.doctorName,
                                        row.current !== null ? <QueueNumberBadge key={`${row.doctorName}-current`} value={row.current} /> : '-',
                                        row.next !== null ? String(row.next) : '-',
                                    ])}
                                    emptyText="Belum ada antrean aktif."
                                />
                            </Card>
                        </div>
                    </div>

                    <Card>
                        <CardHeader
                            title={`Jadwal Dokter ${selectedScheduleDayLabel}`}
                            subtitle={`Cek slot praktik ${selectedScheduleDateLabel}${clinic?.name ? ` di ${clinic.name}` : ''}`}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                                    Bulan
                                    <input
                                        type="month"
                                        value={selectedScheduleMonth}
                                        onChange={(event) => visitDashboard({ schedule_month: event.target.value }, false)}
                                        disabled={dashboardData === null}
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-[#40311D] outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-400"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                                    Minggu ke
                                    <select
                                        value={selectedScheduleWeek}
                                        onChange={(event) => visitDashboard({ schedule_month: selectedScheduleMonth, schedule_week: event.target.value }, false)}
                                        disabled={dashboardData === null || scheduleWeekOptions.length === 0}
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-[#40311D] outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-400"
                                    >
                                        {scheduleWeekOptions.map((week) => (
                                            <option key={week.value} value={week.value}>
                                                {week.label} ({formatShortDate(week.start_date)}-{formatShortDate(week.end_date)})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                                    Hari
                                    <select
                                        value={selectedScheduleDay}
                                        onChange={(event) => visitDashboard({
                                            schedule_month: selectedScheduleMonth,
                                            schedule_week: selectedScheduleWeek,
                                            schedule_day: event.target.value,
                                        }, false)}
                                        disabled={dashboardData === null || scheduleDayChoices.length === 0}
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-[#40311D] outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-400"
                                    >
                                        {scheduleDayChoices.map((day) => (
                                            <option key={day.date} value={day.day_of_week}>
                                                {day.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </CardHeader>
                        <DataTable
                            headers={['Dokter', 'Tanggal', 'Jam', 'Slot']}
                            fixedLayout
                            minTableWidth="980px"
                            columnWidths={['10%', '10%', '10%', '70%']}
                            rows={schedules.map((schedule) => [
                                schedule.doctor_name,
                                `${schedule.day_label}, ${formatDateLabel(schedule.schedule_date)}`,
                                `${formatTime(schedule.start_time)}-${formatTime(schedule.end_time)}`,
                                <ScheduleSlotCell
                                    key={`${schedule.id}-slot`}
                                    schedule={schedule}
                                    expanded={expandedScheduleIds.includes(schedule.id)}
                                    onToggle={() => toggleScheduleSlotPreview(schedule.id)}
                                />
                            ])}
                            emptyText={`Tidak ada jadwal praktik pada ${selectedScheduleDayLabel}, ${selectedScheduleDateLabel}.`}
                        />
                    </Card>
                </div>

                {isWalkInModalOpen && dashboardData !== null ? (
                    <WalkInReservationModal
                        clinic={dashboardData.clinic}
                        today={dashboardData.today}
                        onClose={() => setIsWalkInModalOpen(false)}
                    />
                ) : null}
            </section>
        </AppLayout>
    );
}

function DoctorDashboard({ context, dashboardData }: { context: WorkspaceContext; dashboardData: DoctorDashboardData | null }) {
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
    const queues = dashboardData?.queues ?? [];
    const currentPatient = dashboardData?.currentPatient ?? null;
    const latestMedicalRecords = dashboardData?.latestMedicalRecords ?? [];
    const schedules = dashboardData?.schedules ?? [];
    const [previewSchedule, setPreviewSchedule] = useState<DoctorScheduleEntry | null>(null);
    const queuePrefixes = useMemo(() => ({ doctor: 'A' }), []);
    const previewScheduleData = previewSchedule
        ? buildScheduleWindowPreview(
            previewSchedule.start_time,
            previewSchedule.end_time,
            String(previewSchedule.window_minutes),
            String(previewSchedule.max_patients_per_window),
        )
        : null;

    const visitDashboard = (overrides: Record<string, string | number>) => {
        router.get('/dashboard', overrides, { preserveScroll: true, preserveState: true });
    };

    const startQueue = (entry: QueueEntry) => {
        const clinicId = dashboardData?.selectedClinicId ?? entry.clinic?.id;

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

        const clinicId = dashboardData?.selectedClinicId ?? completionQueue.clinic?.id;

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

    const statCards = [
        ['Reservasi Hari Ini', dashboardData?.stats.today_reservations ?? 0],
        ['Antrean Waiting', dashboardData?.stats.waiting_queues ?? 0],
        ['Called/In Progress', dashboardData?.stats.called_or_in_progress ?? 0],
        ['Selesai Hari Ini', dashboardData?.stats.completed_today ?? 0],
        ['Rekam Medis Hari Ini', dashboardData?.stats.medical_records_today ?? 0],
    ];

    return (
        <AppLayout>
            <Head title="Dashboard Dokter" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    {context.clinics.length > 1 ? (
                        <ClinicSelector
                                clinics={context.clinics}
                                value={dashboardData?.selectedClinicId}
                                onChange={(clinicId) => visitDashboard({ clinic_id: clinicId })}
                            />
                    ) : null}

                    {dashboardData === null ? (
                        <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-[12px] font-medium text-red-600">Tidak ada klinik yang terhubung untuk akun dokter ini.</div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {statCards.map(([label, value]) => (
                            <StatCard key={label} label={String(label)} value={value} />
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                        <Card>
                            <CardHeader title="Antrean Saya Hari Ini" subtitle={`Queue aktif ${dashboardData?.clinic.name ?? ''}`} />
                            <DataTable
                                headers={['No', 'Kode Reservasi', 'Queue', 'Pasien', 'Window', 'Status', 'Keluhan']}
                                rows={queues.map((entry, index) => [
                                    String(index + 1).padStart(3, '0'),
                                    entry.reservation_number,
                                    <QueueNumberBadge key={entry.reservation_id} value={formatDoctorQueueCode(entry.queue.number, queuePrefixes)} />,
                                    queuePatientName(entry),
                                    `${entry.window.start_time} - ${entry.window.end_time}`,
                                    <StatusBadge key={`${entry.reservation_id}-status`} status={formatQueueStatus(entry.queue.status)} />,
                                    entry.complaint ?? '-',
                                ])}
                                emptyText="Belum ada antrean aktif hari ini."
                            />
                        </Card>

                        <Card>
                            <CardHeader title="Pasien Saat Ini" subtitle="Prioritas in progress lalu called" />
                            {currentPatient ? (
                                <div className="space-y-3 p-4 text-[12px] text-gray-600">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#40311D]">{currentPatient.reservation_number}</p>
                                    <p className="text-[18px] font-semibold text-[#2c2115]">{queuePatientName(currentPatient)}</p>
                                    <InfoLine label="Queue" value={formatDoctorQueueCode(currentPatient.queue.number, queuePrefixes)} />
                                    <InfoLine label="Status" value={formatQueueStatus(currentPatient.queue.status)} />
                                    <InfoLine label="Window" value={`${currentPatient.window.start_time} - ${currentPatient.window.end_time}`} />
                                    <InfoLine label="Keluhan" value={currentPatient.complaint ?? '-'} />
                                    <div className="grid gap-2 pt-2">
                                        <ActionButton
                                            disabled={currentPatient.queue.status !== 'called'}
                                            variant="primary"
                                            onClick={() => startQueue(currentPatient)}
                                        >
                                            Start/In Progress
                                        </ActionButton>
                                        <ActionButton
                                            disabled={currentPatient.queue.status !== 'in_progress'}
                                            variant="primary"
                                            onClick={() => openCompletionModal(currentPatient)}
                                        >
                                            Selesaikan & Isi Rekam Medis
                                        </ActionButton>
                                    </div>
                                </div>
                            ) : (
                                <p className="p-4 text-[12px] italic text-gray-400">Belum ada pasien yang sedang dipanggil atau diproses.</p>
                            )}
                        </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <Card>
                            <CardHeader title="Riwayat Rekam Medis Terbaru" subtitle="Latest 10 rekam medis dokter" />
                            <DataTable
                                headers={['Tanggal', 'Pasien/Walk-In', 'Reservation', 'Diagnosis', 'Doctor Notes']}
                                rows={latestMedicalRecords.map((record) => [
                                    dateTimeLabel(record.issued_at),
                                    medicalRecordPatientName(record),
                                    record.reservation?.reservation_number ?? '-',
                                    record.diagnosis ?? '-',
                                    record.doctor_notes,
                                ])}
                                emptyText="Belum ada rekam medis terbaru."
                            />
                        </Card>

                        <Card>
                            <CardHeader title="Jadwal Praktik Dokter" subtitle={`Jadwal di ${dashboardData?.clinic.name ?? 'klinik terpilih'}`} />
                            <DataTable
                                headers={['Hari', 'Jam', 'Window', 'Status']}
                                rows={schedules.map((schedule) => [
                                    schedule.day_label,
                                    `${formatTime(schedule.start_time)}-${formatTime(schedule.end_time)}`,
                                    <ScheduleWindowCompactSummary
                                        key={`${schedule.id}-window`}
                                        windowMinutes={schedule.window_minutes}
                                        capacity={schedule.max_patients_per_window}
                                        preview={buildScheduleWindowPreview(
                                            schedule.start_time,
                                            schedule.end_time,
                                            String(schedule.window_minutes),
                                            String(schedule.max_patients_per_window),
                                        )}
                                        displayTotal={false}
                                        actionLabel="Preview Window"
                                        onOpen={() => setPreviewSchedule(schedule)}
                                    />,
                                    <StatusBadge key={`${schedule.id}-status`} status={schedule.is_active ? 'Aktif' : 'Belum Buka'} />,
                                ])}
                                emptyText="Belum ada jadwal praktik pada klinik ini."
                            />
                        </Card>
                    </div>
                </div>

                {previewSchedule && previewScheduleData ? (
                    <ScheduleWindowReadonlyModal
                        title="Preview Window Jadwal"
                        subtitle={`${previewSchedule.day_label}, ${formatTime(previewSchedule.start_time)} - ${formatTime(previewSchedule.end_time)}`}
                        windowMinutes={previewSchedule.window_minutes}
                        capacity={previewSchedule.max_patients_per_window}
                        preview={previewScheduleData}
                        onClose={() => setPreviewSchedule(null)}
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
            </section>
        </AppLayout>
    );
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="mb-1 text-[11px] text-gray-400">{label}</p>
            <p className="text-[26px] font-medium text-[#40311D]">{value}</p>
        </div>
    );
}

function Card({ children, className = '', allowOverflow = false }: { children: ReactNode; className?: string; allowOverflow?: boolean }) {
    return <div className={`${allowOverflow ? 'overflow-visible' : 'overflow-hidden'} rounded-xl border border-gray-200 bg-white ${className}`}>{children}</div>;
}

function CardHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-[13px] font-medium text-[#40311D]">{title}</p>
                {subtitle ? <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p> : null}
            </div>
            {children ? <div className="flex shrink-0 items-center">{children}</div> : null}
        </div>
    );
}

function DataTable({
    headers,
    rows,
    emptyText,
    fixedLayout = false,
    minTableWidth,
    columnWidths,
}: {
    headers: string[];
    rows: TableRow[];
    emptyText: string;
    fixedLayout?: boolean;
    minTableWidth?: string;
    columnWidths?: string[];
}) {
    return (
        <div className="overflow-x-auto">
            <table
                className={`${fixedLayout ? 'table-fixed' : ''} w-full border-collapse text-[12px]`}
                style={minTableWidth ? { minWidth: minTableWidth } : undefined}
            >
                {columnWidths ? (
                    <colgroup>
                        {columnWidths.map((width, index) => (
                            <col key={`${width}-${index}`} style={{ width }} />
                        ))}
                    </colgroup>
                ) : null}
                <thead>
                    <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                        {headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-medium text-gray-400">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={headers.length} className="px-4 py-8 text-center text-[12px] text-gray-400">
                                {emptyText}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-[#ede8e2] transition-colors last:border-0 hover:bg-[#faf9f7]">
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="px-4 py-2.5 align-middle text-gray-700">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        Confirmed: 'bg-teal-50 text-teal-700',
        Approved: 'bg-teal-50 text-teal-700',
        Aktif: 'bg-teal-50 text-teal-700',
        Completed: 'bg-teal-50 text-teal-700',
        Waiting: 'bg-amber-50 text-amber-700',
        Called: 'bg-sky-50 text-sky-700',
        'In Progress': 'bg-teal-50 text-teal-700',
        Pending: 'bg-amber-50 text-amber-700',
        'Akan Mulai': 'bg-sky-50 text-sky-700',
        Cancelled: 'bg-red-50 text-red-600',
        Rejected: 'bg-red-50 text-red-600',
        'Belum Buka': 'bg-gray-100 text-gray-500',
        Tersedia: 'bg-teal-50 text-teal-700',
        Penuh: 'bg-red-50 text-red-600',
    };

    return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>{status}</span>;
}

function ActionButton({ children, onClick, variant = 'secondary', disabled = false }: { children: ReactNode; onClick: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }) {
    const variants = {
        primary: 'bg-[#00917B] text-white hover:bg-[#006d5c]',
        secondary: 'border border-gray-200 bg-white text-[#40311D] hover:bg-[#DFE0DF]',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`cursor-pointer rounded-lg p-2 text-[12px] transition-colors disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 ${variants[variant]}`}
        >
            {children}
        </button>
    );
}

function QueueNumberBadge({ value }: { value: ReactNode }) {
    return <span className="inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">{value}</span>;
}

function ScheduleSlotCell({
    schedule,
    expanded,
    onToggle,
}: {
    schedule: AdminScheduleEntry;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-4 2xl:gap-8 py-1 2xl:flex-row">
            <div className="flex flex-col shrink-0 items-start gap-2">
                <div className="grid min-w-[150px] gap-1 text-[11px] text-gray-600">
                    <p className="truncate"><strong>Durasi:</strong> {schedule.window_minutes} menit/window</p>
                    <p className="truncate"><strong>Kapasitas:</strong> {schedule.max_patients_per_window} pasien/window</p>
                    <p className="text-teal-700">
                        Terisi {schedule.slot_summary.booked_slots}, tersisa {schedule.slot_summary.available_slots}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    className="w-full max-w-[150px] rounded-lg border border-[#e4ddd4] bg-white px-3 py-1.5 text-[11px] font-medium text-[#40311D] transition-colors hover:bg-[#faf9f7]"
                >
                    Cek slot
                </button>
            </div>

            {expanded ? (
                <div className="min-w-0 flex-1">
                    <ScheduleSlotPreview windows={schedule.windows} />
                </div>
            ) : null}
        </div>
    );
}

function ScheduleSlotPreview({ windows }: { windows: ScheduleWindowSlot[] }) {
    const totalCapacity = windows.reduce((total, window) => total + window.max_slots, 0);
    const totalBooked = windows.reduce((total, window) => total + window.booked_slots, 0);
    const totalAvailable = windows.reduce((total, window) => total + window.available_slots, 0);

    return (
        <div className="overflow-hidden rounded-xl border border-[#e4ddd4] bg-[#faf9f7]">
            <div className="flex flex-col gap-2 border-b border-[#e4ddd4] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[12px] font-medium text-[#40311D]">Preview window reservasi</p>
                    <p className="text-[11px] text-gray-400">
                        {windows.length} window, {totalBooked} terisi, {totalAvailable} tersisa dari {totalCapacity} slot
                    </p>
                </div>
                <span className="w-fit rounded-full bg-teal-50 px-3 py-1 text-[11px] font-medium text-teal-700">Display</span>
            </div>

            {windows.length === 0 ? (
                <p className="px-3 py-4 text-[12px] italic text-gray-400">Window belum bisa ditampilkan.</p>
            ) : (
                <div className="max-h-56 overflow-auto">
                    <table className="w-full min-w-[300px] border-collapse text-[12px]">
                        <thead>
                            <tr className="border-b border-[#e4ddd4] bg-white/60">
                                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400">No</th>
                                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400">Window</th>
                                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400">Slot</th>
                            </tr>
                        </thead>
                        <tbody>
                            {windows.map((window, index) => (
                                <tr key={window.window_start_time} className="border-b border-[#ede8e2] last:border-0">
                                    <td className="px-3 py-2 text-gray-700">{String(index + 1).padStart(2, '0')}</td>
                                    <td className="px-3 py-2 text-gray-700">{formatTime(window.window_start_time)} - {formatTime(window.window_end_time)}</td>
                                    <td className="px-3 py-2">
                                        <SlotFillBadge filled={window.booked_slots} capacity={window.max_slots} available={window.available_slots} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function SlotFillBadge({ filled, capacity, available }: { filled: number; capacity: number; available: number }) {
    const safeCapacity = Math.max(capacity, 0);
    const safeFilled = Math.max(filled, 0);
    const safeAvailable = Math.max(available, 0);
    const availabilityRatio = safeCapacity > 0 ? safeAvailable / safeCapacity : 0;
    const isFull = safeCapacity > 0 && safeFilled >= safeCapacity;

    const colorClass = isFull
        ? 'bg-red-50 text-red-600'
        : availabilityRatio <= 0.5
            ? 'bg-orange-50 text-orange-700'
            : availabilityRatio <= 0.75
                ? 'bg-amber-50 text-amber-700'
                : 'bg-teal-50 text-teal-700';

    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
            {safeFilled}/{safeCapacity}
        </span>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3 border-b border-[#ede8e2] pb-2 last:border-0">
            <span className="text-gray-400">{label}</span>
            <span className="text-right font-medium text-[#40311D]">{value}</span>
        </div>
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
                        Buat rekam medis untuk {queuePatientName(entry)}.
                    </p>
                </div>

                <div className="space-y-4 p-5">
                    {error ? (
                        <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                            {error}
                        </section>
                    ) : null}

                    <div className="grid gap-3 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4 text-[12px] text-gray-600 md:grid-cols-2">
                        <InfoLine label="Kode Reservasi" value={entry.reservation_number} />
                        <InfoLine label="Pasien" value={queuePatientName(entry)} />
                        <InfoLine label="Tanggal" value={formatDateLabel(entry.reservation_date)} />
                        <InfoLine label="Window" value={`${entry.window.start_time} - ${entry.window.end_time}`} />
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

function queueRowsByDoctor(queues: QueueEntry[]): QueueDoctorRow[] {
    const grouped = new Map<string, QueueEntry[]>();

    queues.forEach((entry) => {
        const doctorName = entry.doctor?.name ?? 'Dokter';
        grouped.set(doctorName, [...(grouped.get(doctorName) ?? []), entry]);
    });

    return Array.from(grouped.entries()).map(([doctorName, entries]) => {
        const current = entries.find((entry) => entry.queue.is_current) ?? entries.find((entry) => entry.queue.status === 'called');
        const next = entries.find((entry) => entry.queue.status === 'waiting' && entry.reservation_id !== current?.reservation_id);

        return {
            doctorName,
            current: current?.queue.number ?? null,
            next: next?.queue.number ?? null,
        };
    });
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

function formatShortDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthIndex = Number(month) - 1;

    if (!year || !month || !day || monthIndex < 0 || monthIndex > 11) {
        return value;
    }

    return `${day} ${monthNames[monthIndex]}`;
}

function scheduleDayLabel(day: number, fallback?: string): string {
    return scheduleDayOptions.find((option) => option.value === day)?.label ?? fallback ?? 'Hari ini';
}

function formatTime(value: string): string {
    return value.slice(0, 5);
}

function queuePatientName(entry: QueueEntry): string {
    return entry.patient?.name ?? entry.guest_name ?? 'Walk-In Patient';
}

function medicalRecordPatientName(record: MedicalRecordEntry): string {
    return record.patient?.name ?? record.guest_name ?? 'Walk-In Patient';
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

function formatDoctorQueueCode(value: number | null, prefixes: Record<string, string>): string {
    if (value === null || Number.isNaN(value)) {
        return '-';
    }

    return `${prefixes.doctor ?? 'A'}-${String(value).padStart(2, '0')}`;
}

function dateTimeLabel(value: string): string {
    if (!value) {
        return '-';
    }

    return value.replace('T', ' ').slice(0, 16);
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

function DefaultDashboard({ modules }: { modules: Module[] }) {
    const { auth } = usePage<SharedData>().props;
    const userName = auth?.user?.name ?? 'User';

    return (
        <AppLayout>
            <Head title="Dashboard" />

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[2rem] border border-white/80 bg-night-900 p-8 text-white shadow-[0_25px_80px_rgba(16,24,39,0.18)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-300">Migration-ready shell</p>
                    <h2 className="mt-4 text-4xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                        Welcome back, {userName}.
                    </h2>
                    <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">
                        The frontend shell now runs on Inertia and React, while the booking, queue, notifications, medical records, and reporting services still rely on the existing Laravel backend contracts.
                    </p>
                </div>

                <div className="rounded-[2rem] border border-white/80 bg-white/85 p-8 shadow-[0_25px_80px_rgba(16,24,39,0.08)] backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-700">Current state</p>
                    <ul className="mt-4 space-y-4 text-sm leading-7 text-ink-700">
                        <li>Session-based authentication is active for the web workspace.</li>
                        <li>Web controllers now handle reservation, queue, medical-record, and reporting workflows.</li>
                        <li>Additional pages can build on the same service layer without a separate frontend client.</li>
                    </ul>
                </div>
            </section>

            <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => (
                    <article key={module.title} className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">{module.title}</p>
                        <p className="mt-3 text-sm leading-7 text-ink-700">{module.description}</p>
                    </article>
                ))}
            </section>
        </AppLayout>
    );
}


