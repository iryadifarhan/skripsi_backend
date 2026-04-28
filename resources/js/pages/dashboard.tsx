import { Head, router, usePage } from '@inertiajs/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import type { ClinicDetail, QueueEntry, ReservationEntry, SharedData, WorkspaceContext } from '@/types';

type Module = {
    title: string;
    description: string;
};

type DashboardProps = {
    context: WorkspaceContext;
    dashboardData: AdminDashboardData | null;
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

type WalkInScheduleOption = {
    id: number;
    start_time: string;
    end_time: string;
    window_minutes: number;
    max_patients_per_window: number;
};

type BookingWindow = {
    window_start_time: string;
    window_end_time: string;
    max_slots: number;
    booked_slots: number;
    available_slots: number;
    slot_numbers_available: number[];
    is_available: boolean;
};

type PatientOption = {
    id: number;
    name: string;
    username?: string | null;
    email?: string | null;
    phone_number?: string | null;
    gender?: string | null;
};

const activeReservationStatuses = ['pending', 'approved'];

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
    schedules: ScheduleEntry[];
    today: string;
    selectedScheduleDay: number;
    selectedScheduleDayLabel: string;
};

type TableRow = ReactNode[];

type QueueDoctorRow = {
    doctorName: string;
    current: number | null;
    next: number | null;
};

export default function Dashboard({ context, dashboardData, modules }: DashboardProps) {
    const { auth } = usePage<SharedData>().props;

    if (auth?.user?.role === 'admin' || auth?.user?.role === 'superadmin') {
        return <AdminDashboard context={context} dashboardData={dashboardData} />;
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
    const queueRows = useMemo(() => queueRowsByDoctor(queues), [queues]);
    const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

    const visitDashboard = (overrides: Record<string, string | number>) => {
        const query: Record<string, string | number> = {
            schedule_day: selectedScheduleDay,
        };

        if (dashboardData?.selectedClinicId) {
            query.clinic_id = dashboardData.selectedClinicId;
        }

        router.get('/dashboard', { ...query, ...overrides }, { preserveScroll: true, preserveState: true });
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
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <label className="flex w-full flex-col gap-2 text-[12px] font-medium text-[#40311D] md:w-80">
                                Klinik
                                <select
                                    value={dashboardData?.selectedClinicId ?? ''}
                                    onChange={(event) => visitDashboard({ clinic_id: event.target.value })}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                >
                                    {context.clinics.map((clinic) => (
                                        <option key={clinic.id} value={clinic.id}>
                                            {clinic.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
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
                        <CardHeader title={`Jadwal Dokter ${selectedScheduleDayLabel}`} subtitle={`Ringkasan jadwal praktik${clinic?.name ? ` ${clinic.name}` : ''}`}>
                            <label className="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                                Hari
                                <select
                                    value={selectedScheduleDay}
                                    onChange={(event) => visitDashboard({ schedule_day: event.target.value })}
                                    disabled={dashboardData === null}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-[#40311D] outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-400"
                                >
                                    {scheduleDayOptions.map((day) => (
                                        <option key={day.value} value={day.value}>
                                            {day.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </CardHeader>
                        <DataTable
                            headers={['Dokter', 'Jam', 'Window', 'Kapasitas', 'Status']}
                            rows={schedules.map((schedule) => [
                                schedule.doctor_name,
                                `${formatTime(schedule.start_time)}-${formatTime(schedule.end_time)}`,
                                scheduleWindowLabel(schedule.start_time),
                                `${schedule.max_patients_per_window} pasien/window`,
                                <StatusBadge key={schedule.id} status={schedule.is_active ? 'Aktif' : 'Belum Buka'} />,
                            ])}
                            emptyText={`Tidak ada jadwal praktik pada hari ${selectedScheduleDayLabel}.`}
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

function StatCard({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="mb-1 text-[11px] text-gray-400">{label}</p>
            <p className="text-[26px] font-medium text-[#40311D]">{value}</p>
        </div>
    );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${className}`}>{children}</div>;
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

function DataTable({ headers, rows, emptyText }: { headers: string[]; rows: TableRow[]; emptyText: string }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
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
                                    <td key={cellIndex} className="px-4 py-2.5 text-gray-700">
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
        Pending: 'bg-amber-50 text-amber-700',
        'Akan Mulai': 'bg-sky-50 text-sky-700',
        Cancelled: 'bg-red-50 text-red-600',
        Rejected: 'bg-red-50 text-red-600',
        'Belum Buka': 'bg-gray-100 text-gray-500',
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
            className={`cursor-pointer rounded-lg px-3 py-2 text-[12px] transition-colors disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 ${variants[variant]}`}
        >
            {children}
        </button>
    );
}

function WalkInReservationModal({ clinic, today, onClose }: { clinic: ClinicDetail; today: string; onClose: () => void }) {
    const [patientMode, setPatientMode] = useState<'registered' | 'guest'>('registered');
    const [patientSearch, setPatientSearch] = useState('');
    const [patients, setPatients] = useState<PatientOption[]>([]);
    const [patientId, setPatientId] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestPhoneNumber, setGuestPhoneNumber] = useState('');
    const [doctorId, setDoctorId] = useState(clinic.doctors[0]?.id ? String(clinic.doctors[0].id) : '');
    const [reservationDate, setReservationDate] = useState(today);
    const [schedules, setSchedules] = useState<WalkInScheduleOption[]>([]);
    const [scheduleId, setScheduleId] = useState('');
    const [windows, setWindows] = useState<BookingWindow[]>([]);
    const [windowStart, setWindowStart] = useState('');
    const [complaint, setComplaint] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [patientReservationConflict, setPatientReservationConflict] = useState<ReservationEntry | null>(null);
    const [isLoadingPatients, setIsLoadingPatients] = useState(false);
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
    const [isLoadingWindows, setIsLoadingWindows] = useState(false);
    const [isCheckingPatientReservation, setIsCheckingPatientReservation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (patientMode !== 'registered') {
            return;
        }

        const controller = new AbortController();

        setIsLoadingPatients(true);
        setError(null);

        getJson<{ patients: PatientOption[] }>(
            `/admin/patients/search?${new URLSearchParams({ search: patientSearch }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.patients ?? [];
                const selectedStillExists = options.some((patient) => String(patient.id) === patientId);

                setPatients(options);
                setPatientId(selectedStillExists ? patientId : (options[0]?.id ? String(options[0].id) : ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setPatients([]);
                    setPatientId('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsLoadingPatients(false));

        return () => controller.abort();
    }, [patientId, patientMode, patientSearch]);

    useEffect(() => {
        if (patientMode !== 'registered' || !patientId || !reservationDate) {
            setPatientReservationConflict(null);
            setIsCheckingPatientReservation(false);
            return;
        }

        const controller = new AbortController();

        setIsCheckingPatientReservation(true);
        setPatientReservationConflict(null);

        getJson<{ reservations: ReservationEntry[] }>(
            `/admin/reservations?${new URLSearchParams({
                clinic_id: String(clinic.id),
                reservation_date: reservationDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const conflict = (data.reservations ?? []).find((reservation) =>
                    String(reservation.patient?.id ?? '') === patientId
                    && activeReservationStatuses.includes(reservation.status),
                );

                setPatientReservationConflict(conflict ?? null);
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setPatientReservationConflict(null);
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsCheckingPatientReservation(false));

        return () => controller.abort();
    }, [clinic.id, patientId, patientMode, reservationDate]);

    useEffect(() => {
        if (!doctorId || !reservationDate) {
            setSchedules([]);
            setScheduleId('');
            return;
        }

        const controller = new AbortController();

        setIsLoadingSchedules(true);
        setError(null);

        getJson<{ schedules: WalkInScheduleOption[] }>(
            `/reservations/schedules?${new URLSearchParams({
                clinic_id: String(clinic.id),
                doctor_id: doctorId,
                reservation_date: reservationDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.schedules ?? [];
                const selectedStillExists = options.some((schedule) => String(schedule.id) === scheduleId);

                setSchedules(options);
                setScheduleId(selectedStillExists ? scheduleId : (options[0]?.id ? String(options[0].id) : ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setSchedules([]);
                    setScheduleId('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsLoadingSchedules(false));

        return () => controller.abort();
    }, [clinic.id, doctorId, reservationDate, scheduleId]);

    useEffect(() => {
        if (!scheduleId || !reservationDate) {
            setWindows([]);
            setWindowStart('');
            return;
        }

        const controller = new AbortController();

        setIsLoadingWindows(true);
        setError(null);

        getJson<{ windows: BookingWindow[] }>(
            `/reservations/booking/windows?${new URLSearchParams({
                doctor_clinic_schedule_id: scheduleId,
                reservation_date: reservationDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.windows ?? [];
                const activeOptions = options.filter((window) => window.is_available);
                const selectedStillExists = activeOptions.some((window) => window.window_start_time.slice(0, 5) === windowStart);

                setWindows(options);
                setWindowStart(selectedStillExists ? windowStart : (activeOptions[0]?.window_start_time.slice(0, 5) ?? ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setWindows([]);
                    setWindowStart('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsLoadingWindows(false));

        return () => controller.abort();
    }, [reservationDate, scheduleId, windowStart]);

    const activeWindows = windows.filter((window) => window.is_available);
    const selectedPatient = patients.find((patient) => String(patient.id) === patientId);
    const isGuestValid = patientMode === 'guest' && guestName.trim() !== '';
    const isRegisteredValid = patientMode === 'registered' && patientId !== '';
    const canSubmit = (isGuestValid || isRegisteredValid)
        && patientReservationConflict === null
        && doctorId !== ''
        && reservationDate !== ''
        && scheduleId !== ''
        && windowStart !== ''
        && activeWindows.length > 0
        && !isSubmitting
        && !isCheckingPatientReservation
        && !isLoadingSchedules
        && !isLoadingWindows;

    const submit = async () => {
        if (!canSubmit) {
            setError('Lengkapi data pasien, jadwal dokter, dan window reservasi terlebih dahulu.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const payload: Record<string, string | number | null> = {
            clinic_id: clinic.id,
            status: 'approved',
            doctor_clinic_schedule_id: Number(scheduleId),
            reservation_date: reservationDate,
            window_start_time: windowStart,
            complaint: complaint.trim() === '' ? null : complaint.trim(),
        };

        if (patientMode === 'registered') {
            payload.patient_id = Number(patientId);
        } else {
            payload.guest_name = guestName.trim();
            payload.guest_phone_number = guestPhoneNumber.trim() === '' ? null : guestPhoneNumber.trim();
        }

        const result = await postJson('/reservations', payload);

        setIsSubmitting(false);

        if (!result.ok) {
            setError(result.message ?? 'Gagal membuat reservasi walk-in.');
            return;
        }

        onClose();
        router.reload({ preserveScroll: true });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2115]/55 px-4 py-6">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#e4ddd4] bg-white shadow-[0_24px_80px_rgba(44,33,21,0.25)]">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <p className="text-[15px] font-medium text-[#40311D]">Buat Reservasi Walk-In</p>
                    <p className="mt-1 text-[12px] text-gray-500">{clinic.name}</p>
                </div>

                <div className="grid gap-4 px-5 py-4">
                    {error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                        <ModeButton active={patientMode === 'registered'} onClick={() => setPatientMode('registered')} title="Pasien Terdaftar" description="Pilih akun pasien yang sudah ada." />
                        <ModeButton active={patientMode === 'guest'} onClick={() => setPatientMode('guest')} title="Pasien Tanpa Akun" description="Isi nama dan nomor telepon walk-in." />
                    </div>

                    {patientMode === 'registered' ? (
                        <div className="grid gap-3 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4">
                            <TextField type="text" label="Cari pasien" value={patientSearch} onChange={setPatientSearch} placeholder="Nama, email, username, atau nomor telepon" />
                            <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Pasien
                                <select
                                    value={patientId}
                                    onChange={(event) => setPatientId(event.target.value)}
                                    disabled={isLoadingPatients || patients.length === 0}
                                    className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                                >
                                    {isLoadingPatients ? <option value="">Memuat pasien...</option> : null}
                                    {!isLoadingPatients && patients.length === 0 ? <option value="">Tidak ada pasien ditemukan</option> : null}
                                    {patients.map((patient) => (
                                        <option key={patient.id} value={patient.id}>
                                            {patient.name} - {patient.email ?? patient.phone_number ?? patient.username}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {selectedPatient ? (
                                <p className="text-[11px] text-gray-500">
                                    Terpilih: {selectedPatient.name}{selectedPatient.phone_number ? `, ${selectedPatient.phone_number}` : ''}
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <div className="grid gap-3 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4 sm:grid-cols-2">
                            <TextField type="text" label="Nama pasien walk-in" value={guestName} onChange={setGuestName} placeholder="Contoh: Budi Santoso" required />
                            <TextField type="tel" label="Nomor telepon" value={guestPhoneNumber} onChange={setGuestPhoneNumber} placeholder="Opsional, untuk notifikasi WhatsApp" />
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Dokter
                            <select
                                value={doctorId}
                                onChange={(event) => setDoctorId(event.target.value)}
                                disabled={clinic.doctors.length === 0}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                            >
                                {clinic.doctors.length === 0 ? <option value="">Tidak ada dokter di klinik ini</option> : null}
                                {clinic.doctors.map((doctor) => (
                                    <option key={doctor.id} value={doctor.id}>
                                        {doctor.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Tanggal reservasi
                            <input
                                type="date"
                                value={reservationDate}
                                min={today}
                                onChange={(event) => setReservationDate(event.target.value)}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                            />
                        </label>

                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Jadwal dokter
                            <select
                                value={scheduleId}
                                onChange={(event) => setScheduleId(event.target.value)}
                                disabled={isLoadingSchedules || schedules.length === 0}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                            >
                                {isLoadingSchedules ? <option value="">Memuat jadwal...</option> : null}
                                {!isLoadingSchedules && schedules.length === 0 ? <option value="">Tidak ada jadwal aktif pada tanggal ini</option> : null}
                                {schedules.map((schedule) => (
                                    <option key={schedule.id} value={schedule.id}>
                                        {schedule.start_time} - {schedule.end_time} ({schedule.window_minutes} menit)
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Window tersedia
                            <select
                                value={windowStart}
                                onChange={(event) => setWindowStart(event.target.value)}
                                disabled={isLoadingWindows || activeWindows.length === 0}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                            >
                                {isLoadingWindows ? <option value="">Memuat window...</option> : null}
                                {!isLoadingWindows && activeWindows.length === 0 ? <option value="">Tidak ada window tersedia</option> : null}
                                {activeWindows.map((window) => (
                                    <option key={window.window_start_time} value={window.window_start_time.slice(0, 5)}>
                                        {window.window_start_time} - {window.window_end_time} ({window.available_slots} slot tersisa)
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <RegisteredPatientReservationCue
                        isChecking={isCheckingPatientReservation}
                        conflict={patientReservationConflict}
                        reservationDate={reservationDate}
                    />

                    <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                        Keluhan
                        <textarea
                            value={complaint}
                            onChange={(event) => setComplaint(event.target.value)}
                            rows={3}
                            placeholder="Keluhan singkat pasien"
                            className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                        />
                    </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="rounded-lg bg-[#00917B] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#006d5c] disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isSubmitting ? 'Menyimpan...' : 'Buat Reservasi'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModeButton({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl border px-4 py-3 text-left transition ${active ? 'border-[#40311D] bg-[#40311D] text-white' : 'border-gray-200 bg-white text-[#40311D] hover:bg-[#DFE0DF]'}`}
        >
            <span className="block text-[12px] font-medium">{title}</span>
            <span className={`mt-1 block text-[11px] ${active ? 'text-white/70' : 'text-gray-400'}`}>{description}</span>
        </button>
    );
}

function RegisteredPatientReservationCue({ isChecking, conflict, reservationDate }: { isChecking: boolean; conflict: ReservationEntry | null; reservationDate: string }) {
    if (conflict) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-6 text-amber-800">
                <p className="font-medium">Pasien ini sudah memiliki reservasi aktif pada tanggal {formatDateLabel(reservationDate)}.</p>
                <p className="mt-1">
                    {conflict.reservation_number} - {conflict.doctor?.name ?? 'Dokter'} - {formatTime(conflict.window_start_time)}-{formatTime(conflict.window_end_time)} - status {formatReservationStatus(conflict.status)}
                </p>
                <p className="mt-1 text-amber-700">Pilih tanggal lain atau kelola reservasi yang sudah ada.</p>
            </div>
        );
    }
}

function TextField({ type, label, value, onChange, placeholder, required = false }: { type: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
    return (
        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
            {label}{required ? ' *' : ''}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
            />
        </label>
    );
}

function QueueNumberBadge({ value }: { value: number }) {
    return <span className="inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">{value}</span>;
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

function scheduleDayLabel(day: number, fallback?: string): string {
    return scheduleDayOptions.find((option) => option.value === day)?.label ?? fallback ?? 'Hari ini';
}

function formatTime(value: string): string {
    return value.slice(0, 5);
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

async function postJson(url: string, payload: Record<string, string | number | null>): Promise<{ ok: boolean; message?: string }> {
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const response = await fetch(url, {
        method: 'POST',
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

    return { ok: true };
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
