import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

import type { SharedData } from '@/types';

const roleLabels: Record<string, string> = {
    superadmin: 'Superadmin',
    admin: 'Clinic Admin',
    doctor: 'Doctor',
    patient: 'Patient',
};

export default function AppLayout({ children }: PropsWithChildren) {
    const page = usePage<SharedData>();
    const { auth, app } = page.props;
    const user = auth?.user ?? null;
    const appName = app?.name ?? 'CliniQueue';
    const isAdminWorkspace = user?.role === 'admin' || user?.role === 'superadmin';
    const isDoctorWorkspace = user?.role === 'doctor';

    if (isAdminWorkspace) {
        const adminNavigation = [
            { href: '/dashboard', label: 'Dashboard', enabled: true },
            { href: '/reservations', label: 'Reservasi', enabled: true },
            { href: '/queue', label: 'Manajemen Antrean', enabled: true },
            { href: '/doctors', label: 'Data Dokter', enabled: true },
            { href: '/patients', label: 'Data Pasien', enabled: true },
            ...(user?.role === 'superadmin' ? [] : [{ href: '/medical-records', label: 'Data Rekam Medis', enabled: true }]),
            { href: '/reports', label: 'Laporan', enabled: true },
            user?.role === 'superadmin'
                ? { href: '/clinics', label: 'Data Klinik', enabled: true, activePrefixes: ['/clinics', '/clinic-settings'] }
                : { href: '/clinic-settings', label: 'Pengaturan Klinik', enabled: true, activePrefixes: ['/clinic-settings'] },
        ];
        const pageTitle = page.url.startsWith('/doctors/') ? 'Edit Data Dokter Page' : page.url.startsWith('/patients/') ? 'Detail Pasien Page' : page.url.startsWith('/clinic-settings/') ? 'Pengaturan Klinik Page' : {
            '/dashboard': 'Dashboard Page',
            '/reservations': 'Reservasi Page',
            '/queue': 'Manajemen Antrean Page',
            '/doctors': 'Data Dokter Page',
            '/patients': 'Data Pasien Page',
            '/medical-records': 'Data Rekam Medis Page',
            '/clinic-settings': 'Pengaturan Klinik Page',
            '/clinics': 'Data Klinik Page',
        }[page.url.split('?')[0]] ?? 'Admin Page';
        const clinicLabel = user?.role === 'admin'
            ? user.clinic?.name ?? 'Klinik'
            : 'Superadmin';

        return (
            <div className="flex h-screen overflow-hidden bg-[#DFE0DF] font-sans text-[#40311D]">
                <aside className="hidden w-[220px] shrink-0 flex-col bg-[#40311D] text-white md:flex">
                    <div className="border-b border-white/10 px-4 py-5">
                        <p className="text-[15px] font-bold leading-snug">Clini&gt;Queue&gt; Admin</p>
                        <p className="mt-1 text-[11px] text-white/50">{clinicLabel}</p>
                    </div>

                    <nav className="flex-1 py-3">
                        {adminNavigation.map((item) => {
                            const activePrefixes = 'activePrefixes' in item ? item.activePrefixes : [item.href];
                            const active = item.href !== '#' && activePrefixes.some((prefix) => page.url.startsWith(prefix));

                            if (!item.enabled) {
                                return (
                                    <span key={item.label} className="block px-4 py-2.5 text-[13px] text-white/45">
                                        {item.label}
                                    </span>
                                );
                            }

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`block px-4 py-2.5 text-[13px] transition-colors ${
                                        active ? 'bg-[#2c2115] font-medium text-[#DED0B6]' : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="border-t border-white/10 p-4">
                        <button
                            type="button"
                            onClick={() => router.post('/logout')}
                            className="w-full rounded-lg bg-[#2c2115] px-4 py-2.5 text-left text-[13px] font-medium text-white/80 transition-colors hover:bg-[#1a140d] hover:text-white"
                        >
                            Logout
                        </button>
                    </div>
                </aside>

                <div className="flex flex-1 flex-col overflow-hidden">
                    <header className="border-b border-[#c8bfb0] bg-[#DED0B6] px-6 py-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <h1 className="text-[22px] font-bold text-[#40311D]">{pageTitle}</h1>
                            <div className="flex items-center justify-between gap-3 md:hidden">
                                <span className="text-sm font-bold text-[#40311D]">{appName} Admin</span>
                                <button
                                    type="button"
                                    onClick={() => router.post('/logout')}
                                    className="rounded-md bg-[#40311D] px-4 py-2 text-sm font-bold text-white"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                        <nav className="mt-4 flex gap-2 overflow-x-auto md:hidden">
                            {adminNavigation.filter((item) => item.enabled).map((item) => {
                                const activePrefixes = 'activePrefixes' in item ? item.activePrefixes : [item.href];
                                const active = item.href !== '#' && activePrefixes.some((prefix) => page.url.startsWith(prefix));

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`shrink-0 rounded-md px-3 py-2 text-xs font-bold ${
                                            active ? 'bg-[#40311D] text-white' : 'bg-white/60 text-[#40311D]'
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </header>

                    <main className="flex-1 overflow-hidden">{children}</main>
                </div>
            </div>
        );
    }

    if (isDoctorWorkspace) {
        const doctorNavigation = [
            { href: '/dashboard', label: 'Dashboard', activePrefixes: ['/dashboard'] },
            { href: '/queue', label: 'Antrean Saya', activePrefixes: ['/queue'] },
            { href: '/medical-records', label: 'Rekam Medis', activePrefixes: ['/medical-records'] },
            { href: '/doctor-schedules', label: 'Jadwal Praktik', activePrefixes: ['/doctor-schedules'] },
            { href: '/reports', label: 'Laporan', activePrefixes: ['/reports'] },
            { href: '/profile', label: 'Profil Dokter', activePrefixes: ['/profile'] },
        ];
        const pageTitle = {
            '/dashboard': 'Dashboard Dokter Page',
            '/queue': 'Antrean Saya Page',
            '/medical-records': 'Rekam Medis Page',
            '/doctor-schedules': 'Jadwal Praktik Page',
            '/reports': 'Laporan Dokter Page',
            '/profile': 'Profil Dokter Page',
        }[page.url.split('?')[0]] ?? 'Dokter Page';

        return (
            <div className="flex h-screen overflow-hidden bg-[#DFE0DF] font-sans text-[#40311D]">
                <aside className="hidden w-[220px] shrink-0 flex-col bg-[#40311D] text-white md:flex">
                    <div className="border-b border-white/10 px-4 py-5">
                        <p className="text-[15px] font-bold leading-snug">Clini&gt;Queue&gt; Doctor</p>
                        <p className="mt-1 text-[11px] text-white/50">{user?.name ?? 'Doctor'}</p>
                    </div>

                    <nav className="flex-1 py-3">
                        {doctorNavigation.map((item) => {
                            const active = item.activePrefixes.some((prefix) => page.url.startsWith(prefix));

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`block px-4 py-2.5 text-[13px] transition-colors ${
                                        active ? 'bg-[#2c2115] font-medium text-[#DED0B6]' : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="border-t border-white/10 p-4">
                        <button
                            type="button"
                            onClick={() => router.post('/logout')}
                            className="w-full rounded-lg bg-[#2c2115] px-4 py-2.5 text-left text-[13px] font-medium text-white/80 transition-colors hover:bg-[#1a140d] hover:text-white"
                        >
                            Logout
                        </button>
                    </div>
                </aside>

                <div className="flex flex-1 flex-col overflow-hidden">
                    <header className="border-b border-[#c8bfb0] bg-[#DED0B6] px-6 py-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <h1 className="text-[22px] font-bold text-[#40311D]">{pageTitle}</h1>
                            <div className="flex items-center justify-between gap-3 md:hidden">
                                <span className="text-sm font-bold text-[#40311D]">{appName} Doctor</span>
                                <button
                                    type="button"
                                    onClick={() => router.post('/logout')}
                                    className="rounded-md bg-[#40311D] px-4 py-2 text-sm font-bold text-white"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                        <nav className="mt-4 flex gap-2 overflow-x-auto md:hidden">
                            {doctorNavigation.map((item) => {
                                const active = item.activePrefixes.some((prefix) => page.url.startsWith(prefix));

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`shrink-0 rounded-md px-3 py-2 text-xs font-bold ${
                                            active ? 'bg-[#40311D] text-white' : 'bg-white/60 text-[#40311D]'
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </header>

                    <main className="flex-1 overflow-hidden">{children}</main>
                </div>
            </div>
        );
    }

    const navigation = [
        { href: '/dashboard', label: 'Dashboard', visible: true },
        { href: '/reservations', label: 'Reservations', visible: user?.role === 'patient' || user?.role === 'admin' },
        { href: '/queue', label: 'Queue', visible: user?.role === 'patient' || user?.role === 'admin' || user?.role === 'doctor' },
        { href: '/medical-records', label: 'Medical Records', visible: user?.role === 'patient' || user?.role === 'admin' || user?.role === 'doctor' },
        { href: '/profile', label: 'Profile', visible: user?.role === 'patient' || user?.role === 'doctor' },
    ].filter((item) => item.visible);

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(244,248,246,0.95))]">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 lg:px-10">
                <header className="flex flex-col gap-4 rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(16,24,39,0.08)] backdrop-blur lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-night-900 text-sm font-bold tracking-[0.3em] text-white">
                            CQ
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-700">{appName}</p>
                            <h1 className="text-lg font-bold text-night-900">Application Workspace</h1>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                        <div className="text-sm text-ink-700">
                            <span className="font-semibold text-night-900">{user?.name}</span>
                            <span className="mx-2 text-ink-500">|</span>
                            <span>{user ? roleLabels[user.role] ?? user.role : 'Guest'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {navigation.map((item) => {
                                const active = page.url.split('?')[0] === item.href;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                            active
                                                ? 'bg-night-900 text-white'
                                                : 'border border-night-900/10 text-night-900 hover:bg-night-900 hover:text-white'
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => router.post('/logout')}
                                className="rounded-full bg-clinic-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-clinic-700"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 py-8">{children}</main>
            </div>
        </div>
    );
}
