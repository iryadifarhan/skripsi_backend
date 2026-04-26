import { Head, router } from '@inertiajs/react';

import AppLayout from '@/layouts/app-layout';
import type { MedicalRecordEntry, WorkspaceContext } from '@/types';

type MedicalRecordsPageProps = {
    context: WorkspaceContext;
    medicalRecords: MedicalRecordEntry[];
    filters: {
        clinicId: number | null;
        reservationDate: string;
    };
};

export default function MedicalRecordsPage({ context, medicalRecords, filters }: MedicalRecordsPageProps) {
    const canView = context.role === 'patient' || context.role === 'admin' || context.role === 'doctor';

    const updateFilters = (updates: Partial<MedicalRecordsPageProps['filters']>) => {
        const nextFilters = { ...filters, ...updates };

        router.get('/medical-records', cleanQuery({
            clinic_id: nextFilters.clinicId,
            reservation_date: nextFilters.reservationDate,
        }), {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout>
            <Head title="Medical Records" />

            <section className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[2rem] border border-white/80 bg-night-900 p-8 text-white shadow-[0_25px_80px_rgba(16,24,39,0.18)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-300">Medical record workspace</p>
                        <h2 className="mt-4 text-4xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                            Secure consultation outcomes
                        </h2>
                        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">
                            Completed reservations become medical records here. This page now receives scoped records from web controllers through Inertia props.
                        </p>
                    </div>

                    <div className="rounded-[2rem] border border-white/80 bg-white/85 p-8 shadow-[0_25px_80px_rgba(16,24,39,0.08)] backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-700">Record count</p>
                        <p className="mt-4 text-5xl font-black text-night-900" style={{ fontFamily: 'var(--font-display)' }}>
                            {medicalRecords.length}
                        </p>
                        <p className="mt-4 text-sm leading-7 text-ink-700">
                            Filters trigger same-origin web requests through the Laravel/Inertia stack.
                        </p>
                    </div>
                </div>

                <section className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                    <div className="grid gap-4 lg:grid-cols-3">
                        {(context.role === 'admin' || context.role === 'doctor') ? (
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
                    </div>
                </section>

                {!canView ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        Medical records are available to patients, clinic admins, and doctors only.
                    </section>
                ) : medicalRecords.length === 0 ? (
                    <section className="rounded-[2rem] border border-dashed border-night-900/15 bg-white/70 p-8 text-sm leading-7 text-ink-700 shadow-[0_18px_48px_rgba(16,24,39,0.05)]">
                        No medical records matched the current filters.
                    </section>
                ) : (
                    <section className="grid gap-5">
                        {medicalRecords.map((record) => (
                            <article key={record.id} className="rounded-[1.75rem] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">
                                                {record.reservation?.reservation_number ?? `Record #${record.id}`}
                                            </p>
                                            <h3 className="mt-2 text-xl font-bold text-night-900">
                                                {record.patient?.name ?? record.guest_name ?? 'Walk-in Patient'}
                                            </h3>
                                        </div>
                                        <div className="rounded-2xl bg-clinic-100 px-4 py-3 text-sm font-semibold text-clinic-700">
                                            Issued at {record.issued_at.slice(0, 16).replace('T', ' ')}
                                        </div>
                                    </div>

                                    <div className="grid gap-2 text-sm leading-7 text-ink-700 sm:grid-cols-2">
                                        <p>Clinic: {record.clinic?.name ?? '-'}</p>
                                        <p>Doctor: {record.doctor?.name ?? '-'}</p>
                                        <p>Reservation date: {record.reservation?.reservation_date.slice(0, 10) ?? '-'}</p>
                                        <p>Reservation status: {record.reservation?.status ?? '-'}</p>
                                    </div>

                                    <div className="grid gap-3 rounded-[1.5rem] bg-ink-50 p-5 text-sm leading-7 text-ink-700">
                                        <p><span className="font-semibold text-night-900">Doctor notes:</span> {record.doctor_notes}</p>
                                        {record.diagnosis ? <p><span className="font-semibold text-night-900">Diagnosis:</span> {record.diagnosis}</p> : null}
                                        {record.treatment ? <p><span className="font-semibold text-night-900">Treatment:</span> {record.treatment}</p> : null}
                                        {record.prescription_notes ? <p><span className="font-semibold text-night-900">Prescription notes:</span> {record.prescription_notes}</p> : null}
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
