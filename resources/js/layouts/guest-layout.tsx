import { Head, Link, usePage } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

import type { SharedData } from '@/types';

type GuestLayoutProps = PropsWithChildren<{
    title: string;
    subtitle: string;
}>;

export default function GuestLayout({ children, title, subtitle }: GuestLayoutProps) {
    const { app } = usePage<SharedData>().props;
    const appName = app?.name ?? 'CliniQueue';

    return (
        <>
            <Head title={title} />
            <div className="relative min-h-screen overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,#9fd9c3_0%,transparent_55%)] opacity-80" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,#d8cfba_0%,transparent_60%)] opacity-50" />

                <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 lg:px-10">
                    <header className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-night-900 text-sm font-bold tracking-[0.3em] text-white">
                                CQ
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-700">
                                    {appName}
                                </p>
                                <p className="text-sm text-ink-700">Clinic reservation and queue platform</p>
                            </div>
                        </Link>

                        <nav className="flex items-center gap-4 text-sm font-medium text-ink-700">
                            <Link href="/login" className="transition hover:text-night-900">
                                Login
                            </Link>
                            <Link
                                href="/register"
                                className="rounded-full border border-night-900/15 bg-white/80 px-4 py-2 text-night-900 shadow-sm backdrop-blur transition hover:-translate-y-0.5"
                            >
                                Register
                            </Link>
                        </nav>
                    </header>

                    <main className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr]">
                        <section className="space-y-6">
                            <div className="inline-flex rounded-full border border-clinic-500/20 bg-white/65 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700 shadow-sm backdrop-blur">
                                Full-stack migration foundation
                            </div>
                            <div className="space-y-4">
                                <h1 className="max-w-xl text-4xl font-black leading-tight text-night-900 md:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
                                    {title}
                                </h1>
                                <p className="max-w-2xl text-base leading-7 text-ink-700 md:text-lg">{subtitle}</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(16,24,39,0.08)] backdrop-blur">
                                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">Safe Core</p>
                                    <p className="mt-3 text-sm leading-6 text-ink-700">
                                        Reservation, queue, medical record, report, notification, and clinic-scoped authorization remain on the existing Laravel domain layer.
                                    </p>
                                </div>
                                <div className="rounded-3xl border border-white/70 bg-night-900 p-5 text-white shadow-[0_20px_60px_rgba(16,24,39,0.18)]">
                                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-300">Flexible Auth UI</p>
                                    <p className="mt-3 text-sm leading-6 text-white/80">
                                        Authentication screens can evolve independently while reusing the current session-based backend behavior during migration.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(16,24,39,0.12)] backdrop-blur md:p-8">
                            {children}
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}
