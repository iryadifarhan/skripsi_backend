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

    if (isAdminWorkspace) {
        const adminNavigation = [
            { href: '/dashboard', label: 'Dashboard', enabled: true },
            { href: '/reservations', label: 'Reservasi', enabled: true },
            { href: '/queue', label: 'Manajemen Antrean', enabled: true },
            { href: '/doctors', label: 'Data Dokter', enabled: true },
            { href: '#', label: 'Data Pasien', enabled: false },
            { href: '/medical-records', label: 'Data Rekam Medis', enabled: true },
            { href: '#', label: 'Laporan', enabled: false },
            { href: '#', label: 'Pengaturan Klinik', enabled: false },
        ];
        const pageTitle = page.url.startsWith('/doctors/') ? 'Edit Data Dokter Page' : {
            '/dashboard': 'Dashboard Page',
            '/reservations': 'Reservasi Page',
            '/queue': 'Manajemen Antrean Page',
            '/doctors': 'Data Dokter Page',
            '/medical-records': 'Data Rekam Medis Page',
        }[page.url.split('?')[0]] ?? 'Admin Page';
        const clinicLabel = user?.role === 'admin'
            ? user.clinic?.name ?? 'Klinik'
            : 'Superadmin';

        return (
            <div className="min-h-screen bg-[#f1f2f4] text-[#303236]">
                <aside className="fixed inset-y-0 left-0 z-20 hidden w-[264px] bg-[#7d7f82] px-4 py-7 text-white md:block">
                    <div className="text-center">
                        <div className="text-xl font-extrabold tracking-tight">Clini&gt;Queue&gt; Admin</div>
                        <div className="mt-1 text-lg font-bold">{clinicLabel}</div>
                    </div>

                    <nav className="mt-6 space-y-3">
                        {adminNavigation.map((item) => {
                            const active = item.href !== '#' && page.url.startsWith(item.href);

                            if (!item.enabled) {
                                return (
                                    <span key={item.label} className="block rounded-md px-4 py-3 text-sm text-white/70">
                                        {item.label}
                                    </span>
                                );
                            }

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`block rounded-md px-4 py-3 text-sm transition ${
                                        active ? 'bg-[#343434] font-bold text-white' : 'text-white hover:bg-[#6d6f72]'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="absolute bottom-7 left-4 right-4 rounded-md bg-[#343434] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#222]"
                    >
                        Logout
                    </button>
                </aside>

                <div className="min-h-screen md:pl-[264px]">
                    <header className="border-b border-[#d9dde3] bg-white px-6 py-5 md:px-8">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <h1 className="text-3xl font-extrabold text-[#898989]">{pageTitle}</h1>
                            <div className="flex items-center justify-between gap-3 md:hidden">
                                <span className="text-sm font-bold text-[#666]">{appName} Admin</span>
                                <button
                                    type="button"
                                    onClick={() => router.post('/logout')}
                                    className="rounded-md bg-[#343434] px-4 py-2 text-sm font-bold text-white"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                        <nav className="mt-4 flex gap-2 overflow-x-auto md:hidden">
                            {adminNavigation.filter((item) => item.enabled).map((item) => {
                                const active = item.href !== '#' && page.url.startsWith(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`shrink-0 rounded-md px-3 py-2 text-xs font-bold ${
                                            active ? 'bg-[#343434] text-white' : 'bg-[#eef0f3] text-[#666]'
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </header>

                    <main className="px-4 py-6 md:px-8">{children}</main>
                </div>
            </div>
        );
    }

    const navigation = [
        { href: '/dashboard', label: 'Dashboard', visible: true },
        { href: '/reservations', label: 'Reservations', visible: user?.role === 'patient' || user?.role === 'admin' },
        { href: '/queue', label: 'Queue', visible: user?.role === 'patient' || user?.role === 'admin' || user?.role === 'doctor' },
        { href: '/medical-records', label: 'Medical Records', visible: user?.role === 'patient' || user?.role === 'admin' || user?.role === 'doctor' },
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
                                const active = page.url === item.href;

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
