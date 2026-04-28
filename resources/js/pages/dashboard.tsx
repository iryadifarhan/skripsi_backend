import { Head, router, usePage } from '@inertiajs/react';
import { type ReactNode, useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import { WalkInReservationModal } from '@/components/walk-in-reservation-modal';
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
