import { Head, router, usePage } from '@inertiajs/react';
import { useMemo } from 'react';

import AppLayout from '@/layouts/app-layout';
import type { QueueEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type QueuePageProps = {
    context: WorkspaceContext;
    queues: QueueEntry[];
    filters: {
        clinicId: number | null;
        reservationDate: string;
        queueStatus: string;
        includeHistory: boolean;
    };
};

const queueStatuses = ['', 'waiting', 'called', 'in_progress', 'skipped', 'completed', 'cancelled'];

export default function QueuePage({ context, queues, filters }: QueuePageProps) {
    const page = usePage<SharedData & { errors?: ValidationErrors }>();
    const canView = context.role === 'patient' || context.role === 'admin' || context.role === 'doctor';

    const summary = useMemo(() => {
        return {
            total: queues.length,
            called: queues.filter((entry) => entry.queue.status === 'called').length,
            waiting: queues.filter((entry) => entry.queue.status === 'waiting').length,
            current: queues.find((entry) => entry.queue.is_current)?.queue.number ?? null,
        };
    }, [queues]);

    const updateFilters = (updates: Partial<QueuePageProps['filters']>) => {
        const nextFilters = { ...filters, ...updates };

        router.get('/queue', cleanQuery({
            clinic_id: nextFilters.clinicId,
            reservation_date: nextFilters.reservationDate,
            queue_status: nextFilters.queueStatus,
            include_history: nextFilters.includeHistory ? 1 : null,
        }), {
            preserveScroll: true,
        });
    };

    const updateQueue = (entry: QueueEntry, updates: { queue_status?: string; queue_number?: number }) => {
        const clinicId = filters.clinicId ?? entry.clinic?.id;

        if (!clinicId) {
            return;
        }

        router.patch(`/queue/${entry.reservation_id}`, {
            clinic_id: clinicId,
            ...updates,
        }, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout>
            <Head title="Queue" />

            <section className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[2rem] border border-white/80 bg-night-900 p-8 text-white shadow-[0_25px_80px_rgba(16,24,39,0.18)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-300">Queue workspace</p>
                        <h2 className="mt-4 text-4xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                            {context.role === 'patient' ? 'Track your queue progression' : 'Monitor the active clinic line'}
                        </h2>
                        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">
                            Queue data is now provided by Laravel web controllers through Inertia props and same-origin web actions.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            ['Entries', summary.total],
                            ['Waiting', summary.waiting],
                            ['Called', summary.called],
                            ['Current', summary.current ?? '-'],
                        ].map(([label, value]) => (
                            <article key={label} className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">{label}</p>
                                <p className="mt-4 text-3xl font-black text-night-900" style={{ fontFamily: 'var(--font-display)' }}>
                                    {value}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>

                <section className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                    <div className="grid gap-4 lg:grid-cols-4">
                        {(context.role === 'admin' || context.role === 'superadmin' || context.role === 'doctor') ? (
                            <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                                Clinic
                                <select
                                    value={filters.clinicId ?? ''}
                                    onChange={(event) => updateFilters({ clinicId: event.target.value === '' ? null : Number(event.target.value) })}
                                    className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                                >
                                    {context.clinics.map((clinic) => (
                                        <option key={clinic.id} value={clinic.id}>
                                            {clinic.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}

                        <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                            Reservation date
                            <input
                                type="date"
                                value={filters.reservationDate}
                                onChange={(event) => updateFilters({ reservationDate: event.target.value })}
                                className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                            />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                            Queue status
                            <select
                                value={filters.queueStatus}
                                onChange={(event) => updateFilters({ queueStatus: event.target.value })}
                                className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                            >
                                <option value="">All statuses</option>
                                {queueStatuses.filter(Boolean).map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-end gap-3 rounded-[1.5rem] border border-night-900/10 bg-white px-4 py-3 text-sm font-medium text-night-900">
                            <input
                                type="checkbox"
                                checked={filters.includeHistory}
                                onChange={(event) => updateFilters({ includeHistory: event.target.checked })}
                                className="h-4 w-4 rounded border-night-900/20 text-clinic-500 focus:ring-clinic-500"
                            />
                            Include completed or cancelled history
                        </label>
                    </div>
                </section>

                {page.props.flash?.status ? (
                    <section className="rounded-2xl border border-clinic-500/20 bg-clinic-100 px-5 py-4 text-sm font-semibold text-clinic-700">
                        {page.props.flash.status}
                    </section>
                ) : null}

                {page.props.errors && Object.keys(page.props.errors).length > 0 ? (
                    <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-7 text-red-700">
                        {Object.values(page.props.errors).flat().join(' ')}
                    </section>
                ) : null}

                {!canView ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        Queue monitoring is limited to patients, clinic admins, and doctors.
                    </section>
                ) : queues.length === 0 ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        No queue entries matched the current filters.
                    </section>
                ) : (
                    <section className="grid gap-5">
                        {queues.map((entry) => (
                            <article key={entry.reservation_id} className="rounded-[1.75rem] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">{entry.reservation_number}</p>
                                            <h3 className="mt-2 text-xl font-bold text-night-900">
                                                {entry.patient?.name ?? entry.guest_name ?? 'Walk-in Patient'}
                                            </h3>
                                        </div>
                                        <div className="grid gap-2 text-sm leading-7 text-ink-700 sm:grid-cols-2">
                                            <p>Clinic: {entry.clinic?.name ?? '-'}</p>
                                            <p>Doctor: {entry.doctor?.name ?? '-'}</p>
                                            <p>Reservation date: {entry.reservation_date.slice(0, 10)}</p>
                                            <p>Window: {entry.window.start_time} - {entry.window.end_time}</p>
                                            <p>Queue number: {entry.queue.number ?? '-'}</p>
                                            <p>Queue status: {entry.queue.status}</p>
                                            <p>Position: {entry.queue.position ?? '-'}</p>
                                            <p>Waiting ahead: {entry.queue.waiting_ahead ?? '-'}</p>
                                        </div>
                                        {entry.complaint ? <p className="text-sm leading-7 text-ink-700">Complaint: {entry.complaint}</p> : null}
                                    </div>

                                    <div className="flex flex-col gap-3 lg:min-w-56">
                                        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                                            entry.queue.is_current ? 'bg-clinic-500 text-white' : 'bg-clinic-100 text-clinic-700'
                                        }`}>
                                            {entry.queue.is_current ? 'Current active queue' : `Current called: ${entry.queue.current_called_number ?? '-'}`}
                                        </div>

                                        {(context.role === 'admin' || context.role === 'superadmin') ? (
                                            <div className="grid gap-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQueue(entry, { queue_status: 'called' })}
                                                        className="rounded-2xl bg-night-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-night-700"
                                                    >
                                                        Call
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQueue(entry, { queue_status: 'waiting' })}
                                                        className="rounded-2xl border border-night-900/10 bg-white px-3 py-2 text-xs font-bold text-night-900 transition hover:bg-night-50"
                                                    >
                                                        Waiting
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQueue(entry, { queue_status: 'skipped' })}
                                                        className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                                                    >
                                                        Skip
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQueue(entry, { queue_status: 'cancelled' })}
                                                        className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={!entry.queue.number || entry.queue.number <= 1}
                                                        onClick={() => updateQueue(entry, { queue_number: (entry.queue.number ?? 1) - 1 })}
                                                        className="rounded-2xl bg-[#e2e4e8] px-3 py-2 text-xs font-bold text-[#555] transition hover:bg-[#d8dbe0] disabled:cursor-not-allowed disabled:opacity-45"
                                                    >
                                                        Move Up
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!entry.queue.number}
                                                        onClick={() => updateQueue(entry, { queue_number: (entry.queue.number ?? 0) + 1 })}
                                                        className="rounded-2xl bg-[#e2e4e8] px-3 py-2 text-xs font-bold text-[#555] transition hover:bg-[#d8dbe0] disabled:cursor-not-allowed disabled:opacity-45"
                                                    >
                                                        Move Down
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
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

function cleanQuery(query: Record<string, string | number | boolean | null | undefined>) {
    return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}
