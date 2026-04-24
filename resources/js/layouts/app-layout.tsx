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
