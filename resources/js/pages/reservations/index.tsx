import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import type { ReservationEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type BookingWindow = {
    window_start_time: string;
    window_end_time: string;
    max_slots: number;
    booked_slots: number;
    available_slots: number;
    slot_numbers_available: number[];
    is_available: boolean;
};

type BookingOptions = {
    clinics: { id: number; name: string }[];
    selectedClinicId: number | null;
    doctors: { id: number; name: string }[];
    selectedDoctorId: number | null;
    reservationDate: string;
    schedules: {
        id: number;
        start_time: string;
        end_time: string;
        window_minutes: number;
        max_patients_per_window: number;
    }[];
    selectedScheduleId: number | null;
    windows: BookingWindow[];
} | null;

type ReservationsPageProps = {
    context: WorkspaceContext;
    reservations: ReservationEntry[];
    booking: BookingOptions;
    filters: {
        status: string;
        clinicId: number | null;
    };
};

const reservationStatuses = ['', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];

export default function ReservationsPage({ context, reservations, booking, filters }: ReservationsPageProps) {
    const page = usePage<SharedData & { errors?: ValidationErrors }>();
    const canView = context.role === 'patient' || context.role === 'admin' || context.role === 'superadmin';
    const queueOf = (reservation: ReservationEntry) => reservation.queue_summary;

    const summary = useMemo(() => {
        return {
            total: reservations.length,
            pending: reservations.filter((reservation) => reservation.status === 'pending').length,
            approved: reservations.filter((reservation) => reservation.status === 'approved').length,
            completed: reservations.filter((reservation) => reservation.status === 'completed').length,
        };
    }, [reservations]);

    const updateFilters = (updates: Partial<ReservationsPageProps['filters']>) => {
        const nextFilters = { ...filters, ...updates };

        router.get('/reservations', cleanQuery({
            status: nextFilters.status,
            clinic_id: nextFilters.clinicId,
            booking_clinic_id: booking?.selectedClinicId,
            booking_doctor_id: booking?.selectedDoctorId,
            booking_reservation_date: booking?.reservationDate,
            booking_schedule_id: booking?.selectedScheduleId,
        }), {
            preserveScroll: true,
        });
    };

    const processReservation = (reservation: ReservationEntry, status: 'approved' | 'rejected') => {
        const clinicId = reservation.clinic_id ?? reservation.clinic?.id ?? filters.clinicId;

        if (!clinicId) {
            return;
        }

        router.patch(`/reservations/${reservation.id}/process`, {
            clinic_id: clinicId,
            status,
            admin_notes: status === 'approved' ? 'Approved from web admin UI.' : 'Rejected from web admin UI.',
        }, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout>
            <Head title="Reservations" />

            <section className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[2rem] border border-white/80 bg-night-900 p-8 text-white shadow-[0_25px_80px_rgba(16,24,39,0.18)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-300">Reservations workspace</p>
                        <h2 className="mt-4 text-4xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                            {context.role === 'patient' ? 'Book and track your reservation' : 'Clinic reservation approval'}
                        </h2>
                        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">
                            This screen tests the core end-to-end reservation flow using Laravel web routes and Inertia actions.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

                {booking ? <PatientBookingPanel booking={booking} currentStatusFilter={filters.status} /> : null}

                <section className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
                    <div className="grid gap-4 lg:grid-cols-3">
                        {(context.role === 'admin' || context.role === 'superadmin') && context.clinics.length > 0 ? (
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
                            Status
                            <select
                                value={filters.status}
                                onChange={(event) => updateFilters({ status: event.target.value })}
                                className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
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
                        Reservations remain focused on patient, clinic-admin, and superadmin workflows.
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
                                            <p>Queue status: {queueOf(reservation)?.status ?? '-'}</p>
                                            <p>Queue number: {queueOf(reservation)?.number ?? '-'}</p>
                                            <p>Queue position: {queueOf(reservation)?.position ?? '-'}</p>
                                        </div>
                                        {reservation.complaint ? <p className="text-sm leading-7 text-ink-700">Complaint: {reservation.complaint}</p> : null}
                                        {reservation.reschedule_reason ? <p className="text-sm leading-7 text-ink-700">Reschedule reason: {reservation.reschedule_reason}</p> : null}
                                        {reservation.cancellation_reason ? <p className="text-sm leading-7 text-ink-700">Cancellation reason: {reservation.cancellation_reason}</p> : null}
                                    </div>

                                    <div className="flex flex-col gap-3 lg:min-w-48">
                                        <div className="rounded-2xl bg-clinic-100 px-4 py-3 text-sm font-semibold text-clinic-700">
                                            Waiting ahead: {queueOf(reservation)?.waiting_ahead ?? '-'}
                                        </div>
                                        {(context.role === 'admin' || context.role === 'superadmin') && reservation.status === 'pending' ? (
                                            <div className="grid gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => processReservation(reservation, 'approved')}
                                                    className="rounded-2xl bg-night-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-night-700"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => processReservation(reservation, 'rejected')}
                                                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                                                >
                                                    Reject
                                                </button>
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

function PatientBookingPanel({ booking, currentStatusFilter }: { booking: NonNullable<BookingOptions>; currentStatusFilter: string }) {
    const availableWindow = booking.windows.find((window) => window.is_available);
    const [selectedWindow, setSelectedWindow] = useState(availableWindow?.window_start_time.slice(0, 5) ?? '');
    const [complaint, setComplaint] = useState('');

    useEffect(() => {
        setSelectedWindow(booking.windows.find((window) => window.is_available)?.window_start_time.slice(0, 5) ?? '');
        setComplaint('');
    }, [booking.selectedClinicId, booking.selectedDoctorId, booking.reservationDate, booking.selectedScheduleId, booking.windows]);

    const updateBookingFilters = (updates: Record<string, string | number | null | undefined>) => {
        router.get('/reservations', cleanQuery({
            status: currentStatusFilter,
            booking_clinic_id: booking.selectedClinicId,
            booking_doctor_id: booking.selectedDoctorId,
            booking_reservation_date: booking.reservationDate,
            booking_schedule_id: booking.selectedScheduleId,
            ...updates,
        }), {
            preserveScroll: true,
        });
    };

    const submitBooking = () => {
        if (!booking.selectedScheduleId || !selectedWindow) {
            return;
        }

        router.post('/reservations', {
            doctor_clinic_schedule_id: booking.selectedScheduleId,
            reservation_date: booking.reservationDate,
            window_start_time: selectedWindow,
            complaint,
        }, {
            preserveScroll: true,
        });
    };

    return (
        <section className="rounded-[2rem] border border-clinic-500/20 bg-white/90 p-6 shadow-[0_18px_48px_rgba(16,24,39,0.08)] backdrop-blur">
            <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">Patient booking test</p>
                <h3 className="text-2xl font-black text-night-900" style={{ fontFamily: 'var(--font-display)' }}>
                    Create reservation
                </h3>
                <p className="text-sm leading-7 text-ink-700">
                    Pilih klinik, dokter, tanggal, jadwal, lalu window yang masih memiliki slot kosong.
                </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-4">
                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Clinic
                    <select
                        value={booking.selectedClinicId ?? ''}
                        onChange={(event) => updateBookingFilters({
                            booking_clinic_id: event.target.value,
                            booking_doctor_id: null,
                            booking_schedule_id: null,
                        })}
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    >
                        {booking.clinics.map((clinic) => (
                            <option key={clinic.id} value={clinic.id}>
                                {clinic.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Doctor
                    <select
                        value={booking.selectedDoctorId ?? ''}
                        onChange={(event) => updateBookingFilters({
                            booking_doctor_id: event.target.value,
                            booking_schedule_id: null,
                        })}
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    >
                        {booking.doctors.length === 0 ? <option value="">No doctors assigned</option> : null}
                        {booking.doctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                                {doctor.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Date
                    <input
                        type="date"
                        value={booking.reservationDate}
                        onChange={(event) => updateBookingFilters({
                            booking_reservation_date: event.target.value,
                            booking_schedule_id: null,
                        })}
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Schedule
                    <select
                        value={booking.selectedScheduleId ?? ''}
                        onChange={(event) => updateBookingFilters({ booking_schedule_id: event.target.value })}
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    >
                        {booking.schedules.length === 0 ? <option value="">No schedule on this date</option> : null}
                        {booking.schedules.map((schedule) => (
                            <option key={schedule.id} value={schedule.id}>
                                {schedule.start_time} - {schedule.end_time}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_2fr]">
                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Available window
                    <select
                        value={selectedWindow}
                        onChange={(event) => setSelectedWindow(event.target.value)}
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    >
                        {booking.windows.length === 0 ? <option value="">No windows available</option> : null}
                        {booking.windows.map((window) => (
                            <option key={window.window_start_time} value={window.window_start_time.slice(0, 5)} disabled={!window.is_available}>
                                {window.window_start_time} - {window.window_end_time} ({window.available_slots}/{window.max_slots} slots left)
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-night-900">
                    Complaint
                    <input
                        value={complaint}
                        onChange={(event) => setComplaint(event.target.value)}
                        placeholder="Keluhan singkat pasien"
                        className="rounded-2xl border border-night-900/10 bg-white px-4 py-3 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    />
                </label>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    type="button"
                    onClick={submitBooking}
                    disabled={!booking.selectedScheduleId || !selectedWindow}
                    className="rounded-2xl bg-night-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-night-700 disabled:cursor-not-allowed disabled:bg-night-900/35"
                >
                    Submit Reservation
                </button>
            </div>
        </section>
    );
}

function cleanQuery(query: Record<string, string | number | boolean | null | undefined>) {
    return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}
