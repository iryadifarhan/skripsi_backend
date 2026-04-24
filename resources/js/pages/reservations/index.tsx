import axios from 'axios';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

import { extractErrorMessage } from '@/lib/http';
import AppLayout from '@/layouts/app-layout';
import type { ReservationEntry, WorkspaceContext } from '@/types';

type ReservationsPageProps = {
    context: WorkspaceContext;
};

const reservationStatuses = ['', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];

export default function ReservationsPage({ context }: ReservationsPageProps) {
    const [reservations, setReservations] = useState<ReservationEntry[]>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canView = context.role === 'patient' || context.role === 'admin';

    useEffect(() => {
        if (!canView) {
            setLoading(false);

            return;
        }

        if (context.role === 'admin' && context.clinicId === null) {
            setReservations([]);
            setLoading(false);
            setError('No clinic is attached to this admin account.');

            return;
        }

        let active = true;

        const loadReservations = async () => {
            setLoading(true);
            setError(null);

            try {
                const params: Record<string, string | number> = {};

                if (status !== '') {
                    params.status = status;
                }

                if (context.role === 'admin' && context.clinicId !== null) {
                    params.clinic_id = context.clinicId;
                }

                const response = await axios.get<{ reservations: ReservationEntry[] }>('/api/reservations', {
                    params,
                });

                if (active) {
                    setReservations(response.data.reservations);
                }
            } catch (requestError) {
                if (active) {
                    setReservations([]);
                    setError(extractErrorMessage(requestError, 'Unable to load reservations.'));
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void loadReservations();

        return () => {
            active = false;
        };
    }, [canView, context.clinicId, context.role, status]);

    const summary = useMemo(() => {
        return {
            total: reservations.length,
            pending: reservations.filter((reservation) => reservation.status === 'pending').length,
            approved: reservations.filter((reservation) => reservation.status === 'approved').length,
            completed: reservations.filter((reservation) => reservation.status === 'completed').length,
        };
    }, [reservations]);

    return (
        <AppLayout>
            <Head title="Reservations" />

            <section className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[2rem] border border-white/80 bg-night-900 p-8 text-white shadow-[0_25px_80px_rgba(16,24,39,0.18)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-300">Reservations workspace</p>
                        <h2 className="mt-4 text-4xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                            {context.role === 'admin' ? 'Clinic reservation oversight' : 'Your reservation timeline'}
                        </h2>
                        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">
                            This page is now served directly by the Laravel and React web shell. The data still comes from the same reservation APIs that already drive the system.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        {[
                            ['Total', summary.total],
                            ['Pending', summary.pending],
                            ['Approved', summary.approved],
                            ['Completed', summary.completed],
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
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">Filters</p>
                            <p className="mt-2 text-sm leading-7 text-ink-700">
                                {context.role === 'admin'
                                    ? 'Clinic admins review bookings scoped to their assigned clinic.'
                                    : 'Patients review the full lifecycle of their own reservations.'}
                            </p>
                        </div>

                        <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                            Status
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                className="min-w-52 rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                            >
                                <option value="">All statuses</option>
                                {reservationStatuses.filter(Boolean).map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </section>

                {!canView ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        Reservations remain focused on patient and clinic-admin workflows. Doctors operate from queue and medical-record screens, while superadmins stay on clinic governance.
                    </section>
                ) : loading ? (
                    <section className="rounded-[2rem] border border-white/80 bg-white/85 p-8 text-sm text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.08)]">
                        Loading reservations...
                    </section>
                ) : error ? (
                    <section className="rounded-[2rem] border border-alert-500/20 bg-white/85 p-8 text-sm text-alert-500 shadow-[0_18px_48px_rgba(16,24,39,0.08)]">
                        {error}
                    </section>
                ) : reservations.length === 0 ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        No reservations matched the current filter.
                    </section>
                ) : (
                    <section className="grid gap-5">
                        {reservations.map((reservation) => (
                            <article key={reservation.id} className="rounded-[1.75rem] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">{reservation.reservation_number}</p>
                                            <h3 className="mt-2 text-xl font-bold text-night-900">
                                                {reservation.doctor?.name ?? 'Doctor not assigned'} at {reservation.clinic?.name ?? 'Clinic'}
                                            </h3>
                                        </div>
                                        <div className="grid gap-2 text-sm leading-7 text-ink-700 sm:grid-cols-2">
                                            <p>Reservation date: {reservation.reservation_date.slice(0, 10)}</p>
                                            <p>Window: {reservation.window_start_time} - {reservation.window_end_time}</p>
                                            <p>Status: {reservation.status}</p>
                                            <p>Queue status: {reservation.queue?.queue_status ?? '-'}</p>
                                            <p>Queue number: {reservation.queue?.queue_number ?? '-'}</p>
                                            <p>Queue position: {reservation.queue?.position_in_queue ?? '-'}</p>
                                        </div>
                                        {reservation.complaint ? <p className="text-sm leading-7 text-ink-700">Complaint: {reservation.complaint}</p> : null}
                                        {reservation.reschedule_reason ? <p className="text-sm leading-7 text-ink-700">Reschedule reason: {reservation.reschedule_reason}</p> : null}
                                        {reservation.cancellation_reason ? <p className="text-sm leading-7 text-ink-700">Cancellation reason: {reservation.cancellation_reason}</p> : null}
                                    </div>

                                    <div className="rounded-2xl bg-clinic-100 px-4 py-3 text-sm font-semibold text-clinic-700">
                                        Waiting ahead: {reservation.queue?.waiting_ahead ?? '-'}
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
