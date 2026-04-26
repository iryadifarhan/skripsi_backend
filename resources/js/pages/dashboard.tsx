import { Head, router, usePage } from '@inertiajs/react';
import { useMemo } from 'react';

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

type AdminDashboardData = {
    selectedClinicId: number;
    clinic: ClinicDetail;
    reservations: ReservationEntry[];
    queues: QueueEntry[];
    schedules: ScheduleEntry[];
    today: string;
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

    const statCards = useMemo(() => {
        const activeDoctorIds = new Set(schedules.map((schedule) => schedule.doctor_id));

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

            <section className="space-y-6">
                {context.role === 'superadmin' ? (
                    <div className="flex justify-end">
                        <label className="flex w-full flex-col gap-2 text-sm font-semibold text-[#555] md:w-80">
                            Klinik
                            <select
                                value={dashboardData?.selectedClinicId ?? ''}
                                onChange={(event) => router.get('/dashboard', { clinic_id: event.target.value }, { preserveScroll: true })}
                                className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888]"
                            >
                                {context.clinics.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : null}

                {dashboardData === null ? (
                    <div className="rounded-lg border border-red-200 bg-white p-4 text-sm font-semibold text-red-600">Tidak ada klinik yang tersedia untuk akun ini.</div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-5">
                    {statCards.map(([label, value]) => (
                        <article key={label} className="min-h-[104px] rounded-lg border border-[#ccd2da] bg-white px-4 py-3">
                            <div className="text-sm font-bold text-[#929292]">{label}</div>
                            <div className="mt-2 text-right text-5xl font-extrabold leading-none text-[#6f7584]">{value}</div>
                        </article>
                    ))}
                </div>

                <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
                    <section className="rounded-lg border border-[#ccd2da] bg-white">
                        <div className="px-4 py-4">
                            <h2 className="text-sm font-extrabold text-[#929292]">Reservasi Terbaru</h2>
                            <p className="mt-2 text-xs font-semibold text-[#7d8491]">Daftar reservasi masuk terbaru</p>
                        </div>
                        <AdminTable
                            headers={['No', 'Pasien', 'Dokter', 'Tanggal', 'Status']}
                            rows={reservations.slice(0, 6).map((reservation, index) => [
                                String(index + 1),
                                reservation.patient?.name ?? 'Walk-In',
                                reservation.doctor?.name ?? '-',
                                reservation.reservation_date.slice(0, 10),
                                reservation.status,
                            ])}
                            emptyText="Belum ada reservasi."
                        />
                    </section>

                    <div className="space-y-4">
                        <section className="rounded-lg border border-[#ccd2da] bg-white p-4">
                            <h2 className="text-sm font-extrabold text-[#929292]">Quick Actions</h2>
                            <p className="mt-2 text-xs font-semibold text-[#7d8491]">Akses cepat admin</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <button type="button" onClick={() => router.visit('/reservations')} className="rounded-md bg-[#dedede] px-4 py-3 text-sm font-extrabold text-[#8b8b8b]">
                                    Lihat Laporan
                                </button>
                                <button type="button" onClick={() => router.visit('/queue')} className="rounded-md bg-[#dedede] px-4 py-3 text-sm font-extrabold text-[#8b8b8b]">
                                    Buka Antrean
                                </button>
                                <button type="button" onClick={() => router.visit('/reservations')} className="rounded-md bg-[#8d8d8d] px-4 py-3 text-sm font-extrabold text-white">
                                    Buat Walk-In
                                </button>
                            </div>
                        </section>

                        <section className="rounded-lg border border-[#ccd2da] bg-white">
                            <div className="px-4 py-4">
                                <h2 className="text-sm font-extrabold text-[#929292]">Antrean per Dokter</h2>
                                <p className="mt-2 text-xs font-semibold text-[#7d8491]">Ringkasan queue aktif</p>
                            </div>
                            <AdminTable
                                headers={['Dokter', 'Current', 'Next']}
                                rows={queueRowsByDoctor(queues)}
                                emptyText="Belum ada antrean aktif."
                            />
                        </section>
                    </div>
                </div>

                <section className="rounded-lg border border-[#ccd2da] bg-white">
                    <div className="px-4 py-4">
                        <h2 className="text-sm font-extrabold text-[#929292]">Jadwal Dokter Hari Ini</h2>
                        <p className="mt-2 text-xs font-semibold text-[#7d8491]">Ringkasan jadwal praktik {clinic?.name ?? ''}</p>
                    </div>
                    <AdminTable
                        headers={['Dokter', 'Jam', 'Window', 'Kapasitas', 'Status']}
                        rows={schedules.map((schedule) => [
                            schedule.doctor_name,
                            `${schedule.start_time} - ${schedule.end_time}`,
                            `${schedule.window_minutes} menit`,
                            `${schedule.max_patients_per_window} pasien/window`,
                            schedule.is_active ? 'Aktif' : 'Tidak Aktif',
                        ])}
                        emptyText="Tidak ada jadwal praktik hari ini."
                    />
                </section>
            </section>
        </AppLayout>
    );
}

function AdminTable({ headers, rows, emptyText }: { headers: string[]; rows: string[][]; emptyText: string }) {
    const fillerRows = Math.max(0, 5 - rows.length);

    return (
        <div className="overflow-hidden border-t border-[#d6dbe3]">
            <table className="w-full table-fixed text-left text-xs text-[#7d8491]">
                <thead>
                    <tr className="border-b border-[#e2e5ea]">
                        {headers.map((header) => (
                            <th key={header} className="px-3 py-3 font-extrabold">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr className="h-[52px] border-b border-[#e2e5ea]">
                            <td colSpan={headers.length} className="px-3 text-sm font-semibold text-[#9a9a9a]">
                                {emptyText}
                            </td>
                        </tr>
                    ) : rows.map((row, index) => (
                        <tr key={`${row.join('-')}-${index}`} className="h-[52px] border-b border-[#e2e5ea]">
                            {row.map((cell, cellIndex) => (
                                <td key={`${cell}-${cellIndex}`} className="truncate px-3 font-semibold">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {Array.from({ length: fillerRows }).map((_, index) => (
                        <tr key={`filler-${index}`} className="h-[52px] border-b border-[#e2e5ea]">
                            <td colSpan={headers.length}>&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function queueRowsByDoctor(queues: QueueEntry[]): string[][] {
    const grouped = new Map<string, QueueEntry[]>();

    queues.forEach((entry) => {
        const doctorName = entry.doctor?.name ?? 'Dokter';
        grouped.set(doctorName, [...(grouped.get(doctorName) ?? []), entry]);
    });

    return Array.from(grouped.entries()).map(([doctorName, entries]) => {
        const current = entries.find((entry) => entry.queue.is_current) ?? entries.find((entry) => entry.queue.status === 'called');
        const next = entries.find((entry) => entry.queue.status === 'waiting');

        return [
            doctorName,
            current?.queue.number !== undefined && current?.queue.number !== null ? String(current.queue.number) : '-',
            next?.queue.number !== undefined && next?.queue.number !== null ? String(next.queue.number) : '-',
        ];
    });
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
