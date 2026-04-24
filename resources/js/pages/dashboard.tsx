import { Head, usePage } from '@inertiajs/react';

import AppLayout from '@/layouts/app-layout';
import type { SharedData } from '@/types';

type Module = {
    title: string;
    description: string;
};

type DashboardProps = {
    modules: Module[];
};

export default function Dashboard({ modules }: DashboardProps) {
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
                        <li>Domain APIs remain the main integration contract for reservation and queue operations.</li>
                        <li>Additional pages can now be migrated incrementally without rewriting the backend core.</li>
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
