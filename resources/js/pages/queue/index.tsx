import axios from 'axios';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

import { currentDateInputValue, extractErrorMessage } from '@/lib/http';
import AppLayout from '@/layouts/app-layout';
import type { QueueEntry, WorkspaceContext } from '@/types';

type QueuePageProps = {
    context: WorkspaceContext;
};

const queueStatuses = ['', 'waiting', 'called', 'in_progress', 'skipped', 'completed', 'cancelled'];

export default function QueuePage({ context }: QueuePageProps) {
    const [queues, setQueues] = useState<QueueEntry[]>([]);
    const [reservationDate, setReservationDate] = useState(currentDateInputValue());
    const [selectedClinicId, setSelectedClinicId] = useState<number | ''>(context.clinicId ?? context.clinics[0]?.id ?? '');
    const [queueStatus, setQueueStatus] = useState('');
    const [includeHistory, setIncludeHistory] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canView = context.role === 'patient' || context.role === 'admin' || context.role === 'doctor';

    useEffect(() => {
        if (!canView) {
            setLoading(false);

            return;
        }

        if ((context.role === 'admin' || context.role === 'doctor') && selectedClinicId === '') {
            setQueues([]);
            setLoading(false);
            setError('No clinic is available for this account.');

            return;
        }

        let active = true;

        const loadQueues = async () => {
            setLoading(true);
            setError(null);

            try {
                const params: Record<string, string | number | boolean> = {};
                let endpoint = '/api/queues/my';

                if (reservationDate !== '') {
                    params.reservation_date = reservationDate;
                }

                if (queueStatus !== '') {
                    params.queue_status = queueStatus;
                }

                if (includeHistory) {
                    params.include_history = true;
                }

                if (context.role === 'admin') {
                    endpoint = '/api/admin/queues';
                    params.clinic_id = selectedClinicId as number;
                }

                if (context.role === 'doctor') {
                    endpoint = '/api/doctor/queues';
                    params.clinic_id = selectedClinicId as number;
                }

                const response = await axios.get<{ queues: QueueEntry[] }>(endpoint, { params });

                if (active) {
                    setQueues(response.data.queues);
                }
            } catch (requestError) {
                if (active) {
                    setQueues([]);
                    setError(extractErrorMessage(requestError, 'Unable to load queue data.'));
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void loadQueues();

        return () => {
            active = false;
        };
    }, [canView, context.role, includeHistory, queueStatus, reservationDate, selectedClinicId]);

    const summary = useMemo(() => {
        return {
            total: queues.length,
            called: queues.filter((entry) => entry.queue.status === 'called').length,
            waiting: queues.filter((entry) => entry.queue.status === 'waiting').length,
            current: queues.find((entry) => entry.queue.is_current)?.queue.number ?? null,
        };
    }, [queues]);

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
                            This page keeps the queue logic on the existing API layer while exposing a first-party web view for patient, admin, and doctor roles.
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
                        {(context.role === 'admin' || context.role === 'doctor') ? (
                            <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                                Clinic
                                <select
                                    value={selectedClinicId}
                                    onChange={(event) => setSelectedClinicId(event.target.value === '' ? '' : Number(event.target.value))}
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
                                value={reservationDate}
                                onChange={(event) => setReservationDate(event.target.value)}
                                className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                            />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                            Queue status
                            <select
                                value={queueStatus}
                                onChange={(event) => setQueueStatus(event.target.value)}
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
                                checked={includeHistory}
                                onChange={(event) => setIncludeHistory(event.target.checked)}
                                className="h-4 w-4 rounded border-night-900/20 text-clinic-500 focus:ring-clinic-500"
                            />
                            Include completed or cancelled history
                        </label>
                    </div>
                </section>

                {!canView ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        Queue monitoring is limited to patients, clinic admins, and doctors.
                    </section>
                ) : loading ? (
                    <section className="rounded-[2rem] border border-white/80 bg-white/85 p-8 text-sm text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.08)]">
                        Loading queue entries...
                    </section>
                ) : error ? (
                    <section className="rounded-[2rem] border border-alert-500/20 bg-white/85 p-8 text-sm text-alert-500 shadow-[0_18px_48px_rgba(16,24,39,0.08)]">
                        {error}
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

                                    <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                                        entry.queue.is_current ? 'bg-clinic-500 text-white' : 'bg-clinic-100 text-clinic-700'
                                    }`}>
                                        {entry.queue.is_current ? 'Current active queue' : `Current called: ${entry.queue.current_called_number ?? '-'}`}
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
