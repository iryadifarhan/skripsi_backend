import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import { csrfHeaders } from '@/lib/csrf';
import type { ReservationEntry, SharedData } from '@/types';

type PatientReservationsProps = {
    reservations: ReservationEntry[];
};

type PracticeScheduleOption = {
    id: number;
    clinic_id: number;
    doctor_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    window_minutes: number;
    max_patients_per_window: number;
    is_active: boolean;
};

type BookingWindow = {
    window_start_time: string;
    window_end_time: string;
    max_slots: number;
    booked_slots: number;
    available_slots: number;
    slot_numbers_available: number[];
    is_available: boolean;
};

type ModalKind = 'cancel' | 'reschedule' | null;

type RequestResult = {
    ok: boolean;
    message?: string;
};

const ACTIVE_STATUSES = new Set(['pending', 'approved']);
const CARDS_PER_PAGE = 4;

const STATUS_META: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: '#b38600' },
    approved: { label: 'Approved', color: '#00917B' },
    completed: { label: 'Completed', color: '#40311D' },
    cancelled: { label: 'Cancelled', color: '#c0392b' },
    rejected: { label: 'Rejected', color: '#c0392b' },
};

function dateKey(value?: string | null): string {
    return value ? value.slice(0, 10) : '';
}

function localDate(value?: string | null): Date | null {
    const key = dateKey(value);

    if (!key) {
        return null;
    }

    const [year, month, day] = key.split('-').map(Number);

    return new Date(year, month - 1, day);
}

function dateLabel(value?: string | null): string {
    const date = localDate(value);

    if (!date) {
        return '-';
    }

    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
}

function compactDateLabel(value?: string | null): string {
    const date = localDate(value);

    if (!date) {
        return '-';
    }

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

function shortTime(value?: string | null): string {
    return value ? value.slice(0, 5) : '-';
}

function timeRange(reservation: ReservationEntry): string {
    return `${shortTime(reservation.window_start_time)} - ${shortTime(reservation.window_end_time)}`;
}

function queueNumber(value?: number | null): string {
    return value === null || value === undefined ? '--' : String(value).padStart(2, '0');
}

function slotLabel(value?: number | null): string {
    return value === null || value === undefined ? '-' : String(value);
}

function reservationStatus(reservation: ReservationEntry) {
    return STATUS_META[reservation.status] ?? { label: reservation.status, color: '#40311D' };
}

function patientName(reservation: ReservationEntry): string {
    return reservation.patient?.name ?? reservation.guest_name ?? '-';
}

function clinicAddress(reservation: ReservationEntry): string {
    return [reservation.clinic?.address, reservation.clinic?.city?.name ?? reservation.clinic?.city_name].filter(Boolean).join(', ') || '-';
}

function compareReservationDateTime(a: ReservationEntry, b: ReservationEntry): number {
    return `${dateKey(a.reservation_date)} ${shortTime(a.window_start_time)}`.localeCompare(`${dateKey(b.reservation_date)} ${shortTime(b.window_start_time)}`);
}

function todayKey(): string {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
    ].join('-');
}

function currentReservationFrom(reservations: ReservationEntry[]): ReservationEntry | null {
    const active = reservations.filter((reservation) => ACTIVE_STATUSES.has(reservation.status));

    if (active.length === 0) {
        return null;
    }

    const today = todayKey();
    const upcoming = active.filter((reservation) => dateKey(reservation.reservation_date) >= today);
    const candidates = upcoming.length > 0 ? upcoming : active;

    return [...candidates].sort(compareReservationDateTime)[0] ?? null;
}

function estimateWait(reservation: ReservationEntry): string {
    const waitingAhead = reservation.queue_summary?.waiting_ahead;
    const windowMinutes = reservation.doctor_clinic_schedule?.window_minutes;

    if (waitingAhead === null || waitingAhead === undefined || !windowMinutes) {
        return '-';
    }

    return `${waitingAhead * windowMinutes} menit`;
}

async function readJsonResponse(response: Response): Promise<RequestResult> {
    let data: { message?: string; errors?: Record<string, string[]> } = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    const firstError = data.errors ? Object.values(data.errors).flat()[0] : null;

    return {
        ok: response.ok,
        message: firstError ?? data.message ?? (response.ok ? undefined : 'Permintaan gagal diproses.'),
    };
}

async function patchJson(url: string, payload: Record<string, unknown>): Promise<RequestResult> {
    const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...csrfHeaders(),
        },
        body: JSON.stringify(payload),
    });

    return readJsonResponse(response);
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        signal,
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        const result = await readJsonResponse(response);
        throw new Error(result.message ?? 'Gagal mengambil data.');
    }

    return response.json() as Promise<T>;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <p className="mb-0.5 whitespace-nowrap text-[10px] text-[#40311D]/40">{label}</p>
            <p className="whitespace-nowrap text-xs font-medium text-[#40311D]">{value || '-'}</p>
        </div>
    );
}

function StatusTooltip() {
    const [visible, setVisible] = useState(false);

    return (
        <span className="relative inline-flex items-center">
            <button
                type="button"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onFocus={() => setVisible(true)}
                onBlur={() => setVisible(false)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[#40311D]/45 hover:text-[#40311D]"
                aria-label="Lihat alur status reservasi"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </button>
            {visible ? (
                <div className="absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 w-max -translate-x-1/2 rounded-xl bg-[#1c1c1c] px-3 py-2 text-xs text-white shadow-lg">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">Alur reservasi</p>
                    <div className="flex items-center gap-1.5">
                        {['Pending', 'Approved', 'Completed'].map((item, index) => (
                            <span key={item} className="flex items-center gap-1.5">
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">{item}</span>
                                {index < 2 ? <span className="text-white/35">-&gt;</span> : null}
                            </span>
                        ))}
                    </div>
                    <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#1c1c1c]" />
                </div>
            ) : null}
        </span>
    );
}

function ActionButton({ children, onClick, href, disabled = false }: { children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean }) {
    const className = `inline-flex items-center gap-1 rounded-full bg-[#40311D] px-4 py-2 text-xs font-semibold text-[#DED0B6] transition hover:bg-[#2c2115] ${disabled ? 'cursor-not-allowed opacity-45 hover:bg-[#40311D]' : ''}`;
    const arrow = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );

    if (href && !disabled) {
        return (
            <a href={href} className={className}>
                {children}
            </a>
        );
    }

    return (
        <button type="button" onClick={onClick} disabled={disabled} className={className}>
            {children}
            {onClick ? arrow : null}
        </button>
    );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            {children}
        </div>
    );
}

function ModalCard({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
    return (
        <div className={`max-h-[90vh] w-full overflow-y-auto rounded-[18px] bg-[#1c1c1c] p-7 text-white shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-sm'}`}>
            {children}
        </div>
    );
}

function CancelModal({ reservation, onClose }: { reservation: ReservationEntry; onClose: () => void }) {
    const [reason, setReason] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const submit = async () => {
        setLoading(true);
        setError(null);

        const result = await patchJson(`/reservations/${reservation.id}/cancel`, {
            cancellation_reason: reason.trim() === '' ? null : reason.trim(),
        });

        setLoading(false);

        if (!result.ok) {
            setError(result.message ?? 'Pembatalan reservasi gagal diproses.');
            return;
        }

        setSuccess(true);
        setTimeout(() => {
            onClose();
            router.reload({ only: ['reservations'], preserveScroll: true });
        }, 800);
    };

    return (
        <ModalShell onClose={onClose}>
            <ModalCard>
                {success ? (
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00917B]/20 text-[#00917B]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h3 className="text-base font-semibold">Pembatalan reservasi berhasil diajukan.</h3>
                        <p className="mt-2 text-xs text-white/50">Data reservasi akan diperbarui sebentar lagi.</p>
                    </div>
                ) : (
                    <>
                        <h3 className="text-base font-semibold">Batalkan reservasi?</h3>
                        <p className="mt-2 text-xs leading-6 text-white/55">Reservasi akan berubah menjadi cancelled dan antrean akan disesuaikan ulang oleh sistem.</p>

                        <label className="mt-5 block text-xs font-semibold text-white/70">Alasan pembatalan</label>
                        <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value.slice(0, 1000))}
                            rows={4}
                            className="mt-2 w-full resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#00917B]"
                            placeholder="Ketik alasan pembatalan"
                        />

                        <label className="mt-4 flex cursor-pointer gap-2 text-xs leading-5 text-white/60">
                            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 accent-[#00917B]" />
                            Saya setuju untuk membatalkan reservasi ini.
                        </label>

                        {error ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-100">{error}</p> : null}

                        <div className="mt-6 flex gap-2">
                            <button type="button" onClick={onClose} disabled={loading} className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-50">
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!agreed || loading}
                                className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1c1c1c] transition hover:bg-[#DED0B6] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {loading ? 'Memproses...' : 'Batalkan'}
                            </button>
                        </div>
                    </>
                )}
            </ModalCard>
        </ModalShell>
    );
}

function RescheduleModal({ reservation, onClose }: { reservation: ReservationEntry; onClose: () => void }) {
    const initialDate = dateKey(reservation.reservation_date) >= todayKey() ? dateKey(reservation.reservation_date) : todayKey();
    const [reservationDate, setReservationDate] = useState(initialDate);
    const [scheduleId, setScheduleId] = useState(reservation.doctor_clinic_schedule_id ? String(reservation.doctor_clinic_schedule_id) : '');
    const [windowStart, setWindowStart] = useState(shortTime(reservation.window_start_time));
    const [reason, setReason] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [schedules, setSchedules] = useState<PracticeScheduleOption[]>([]);
    const [windows, setWindows] = useState<BookingWindow[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [loadingWindows, setLoadingWindows] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const clinicId = reservation.clinic_id ?? reservation.clinic?.id;
        const doctorId = reservation.doctor_id ?? reservation.doctor?.id;

        if (!clinicId || !doctorId || !reservationDate) {
            setSchedules([]);
            setScheduleId('');
            return;
        }

        const controller = new AbortController();
        setLoadingSchedules(true);
        setError(null);

        getJson<{ schedules: PracticeScheduleOption[] }>(
            `/reservations/schedules?${new URLSearchParams({
                clinic_id: String(clinicId),
                doctor_id: String(doctorId),
                reservation_date: reservationDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.schedules ?? [];
                const currentExists = options.some((schedule) => String(schedule.id) === scheduleId);
                setSchedules(options);
                setScheduleId(currentExists ? scheduleId : (options[0]?.id ? String(options[0].id) : ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setSchedules([]);
                    setScheduleId('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setLoadingSchedules(false));

        return () => controller.abort();
    }, [reservation, reservationDate, scheduleId]);

    useEffect(() => {
        if (!scheduleId || !reservationDate) {
            setWindows([]);
            setWindowStart('');
            return;
        }

        const controller = new AbortController();
        setLoadingWindows(true);
        setError(null);

        getJson<{ windows: BookingWindow[] }>(
            `/reservations/booking/windows?${new URLSearchParams({
                doctor_clinic_schedule_id: scheduleId,
                reservation_date: reservationDate,
                ignore_reservation_id: String(reservation.id),
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.windows ?? [];
                const currentAvailable = options.some((window) => window.is_available && shortTime(window.window_start_time) === windowStart);
                const fallback = options.find((window) => window.is_available);

                setWindows(options);
                setWindowStart(currentAvailable ? windowStart : (fallback ? shortTime(fallback.window_start_time) : ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setWindows([]);
                    setWindowStart('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setLoadingWindows(false));

        return () => controller.abort();
    }, [reservation.id, reservationDate, scheduleId, windowStart]);

    const submit = async () => {
        if (!reservationDate || !scheduleId || !windowStart) {
            setError('Pilih tanggal, jadwal praktik, dan slot waktu terlebih dahulu.');
            return;
        }

        if (!reason.trim()) {
            setError('Alasan reschedule wajib diisi.');
            return;
        }

        setSubmitting(true);
        setError(null);

        const result = await patchJson(`/reservations/${reservation.id}/reschedule`, {
            doctor_clinic_schedule_id: Number(scheduleId),
            reservation_date: reservationDate,
            window_start_time: windowStart,
            reschedule_reason: reason.trim(),
        });

        setSubmitting(false);

        if (!result.ok) {
            setError(result.message ?? 'Reschedule reservasi gagal diproses.');
            return;
        }

        setSuccess(true);
        setTimeout(() => {
            onClose();
            router.reload({ only: ['reservations'], preserveScroll: true });
        }, 800);
    };

    return (
        <ModalShell onClose={onClose}>
            <ModalCard wide>
                {success ? (
                    <div className="py-3 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00917B]/20 text-[#00917B]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h3 className="text-base font-semibold">Perubahan jadwal berhasil diajukan.</h3>
                        <p className="mt-2 text-xs text-white/50">Reservasi kembali ke status pending untuk diproses admin klinik.</p>
                    </div>
                ) : (
                    <>
                        <h3 className="text-base font-semibold">Reschedule reservasi</h3>
                        <p className="mt-1 text-xs text-white/50">
                            {reservation.clinic?.name ?? '-'} - {reservation.doctor?.name ?? '-'} - {dateLabel(reservation.reservation_date)}
                        </p>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="block text-xs font-semibold text-white/70">
                                Tanggal baru
                                <input
                                    type="date"
                                    value={reservationDate}
                                    min={todayKey()}
                                    onChange={(event) => setReservationDate(event.target.value)}
                                    className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#00917B]"
                                />
                            </label>
                            <label className="block text-xs font-semibold text-white/70">
                                Jadwal dokter
                                <select
                                    value={scheduleId}
                                    onChange={(event) => setScheduleId(event.target.value)}
                                    disabled={loadingSchedules || schedules.length === 0}
                                    className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#00917B] disabled:opacity-45"
                                >
                                    {schedules.length === 0 ? <option value="">Tidak ada jadwal</option> : null}
                                    {schedules.map((schedule) => (
                                        <option key={schedule.id} value={schedule.id} className="bg-[#1c1c1c]">
                                            {shortTime(schedule.start_time)} - {shortTime(schedule.end_time)} ({schedule.window_minutes} menit)
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="mt-5">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/45">Slot waktu tersedia</p>
                            {loadingWindows ? (
                                <p className="rounded-lg bg-white/5 px-3 py-3 text-xs text-white/50">Memuat slot waktu...</p>
                            ) : windows.length === 0 ? (
                                <p className="rounded-lg bg-white/5 px-3 py-3 text-xs text-white/50">Tidak ada slot untuk tanggal ini.</p>
                            ) : (
                                <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                                    {windows.map((window) => {
                                        const selected = shortTime(window.window_start_time) === windowStart;
                                        const disabled = !window.is_available;

                                        return (
                                            <button
                                                key={`${window.window_start_time}-${window.window_end_time}`}
                                                type="button"
                                                onClick={() => setWindowStart(shortTime(window.window_start_time))}
                                                disabled={disabled}
                                                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                                                    selected
                                                        ? 'border-[#00917B] bg-[#00917B]/20 text-[#00917B]'
                                                        : 'border-white/15 bg-white/5 text-white/75 hover:border-white/35'
                                                } ${disabled ? 'cursor-not-allowed opacity-35 hover:border-white/15' : ''}`}
                                            >
                                                <span className="block font-semibold">
                                                    {shortTime(window.window_start_time)} - {shortTime(window.window_end_time)}
                                                </span>
                                                <span className="mt-1 block text-[11px] opacity-70">
                                                    {window.available_slots}/{window.max_slots} slot tersedia
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <label className="mt-5 block text-xs font-semibold text-white/70">Alasan reschedule</label>
                        <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value.slice(0, 1000))}
                            rows={3}
                            className="mt-2 w-full resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#00917B]"
                            placeholder="Ketik alasan perubahan jadwal"
                        />

                        <label className="mt-4 flex cursor-pointer gap-2 text-xs leading-5 text-white/60">
                            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 accent-[#00917B]" />
                            Saya setuju untuk mengajukan perubahan jadwal reservasi ini.
                        </label>

                        {error ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-100">{error}</p> : null}

                        <div className="mt-6 flex gap-2">
                            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-50">
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!agreed || submitting || loadingSchedules || loadingWindows}
                                className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1c1c1c] transition hover:bg-[#DED0B6] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {submitting ? 'Mengajukan...' : 'Ajukan'}
                            </button>
                        </div>
                    </>
                )}
            </ModalCard>
        </ModalShell>
    );
}

function CurrentReservationPanel({ reservation, openModal }: { reservation: ReservationEntry | null; openModal: (kind: ModalKind) => void }) {
    if (!reservation) {
        return (
            <div className="mb-16 overflow-hidden rounded-[14px] border border-[#40311D]/15 bg-[#DED0B6]/40 p-8 text-center">
                <p className="text-lg font-semibold text-[#40311D]">Belum ada reservasi aktif.</p>
                <p className="mt-2 text-sm text-[#40311D]/55">Pilih klinik atau dokter untuk membuat reservasi baru.</p>
                <div className="mt-5 flex justify-center gap-2">
                    <Link href="/klinik" className="rounded-full bg-[#40311D] px-4 py-2 text-xs font-semibold text-[#DED0B6] transition hover:bg-[#2c2115]">
                        Cari Klinik
                    </Link>
                    <Link href="/dokter" className="rounded-full border border-[#40311D]/25 px-4 py-2 text-xs font-semibold text-[#40311D] transition hover:bg-[#40311D]/5">
                        Cari Dokter
                    </Link>
                </div>
            </div>
        );
    }

    const status = reservationStatus(reservation);
    const canChange = ACTIVE_STATUSES.has(reservation.status);
    const clinicPhone = reservation.clinic?.phone_number;
    const waitEstimate = estimateWait(reservation);

    return (
        <div className="mb-16 overflow-hidden rounded-[14px] border border-[#40311D]/15 lg:flex">
            <div className="flex shrink-0">
                <div className="flex min-w-[150px] flex-1 flex-col justify-start bg-[#40311D] px-7 py-8 text-[#DED0B6] sm:min-w-[185px]">
                    <p className="mb-3 whitespace-nowrap text-sm font-semibold text-[#DED0B6]/70 sm:text-base">Nomor saat ini</p>
                    <p className="text-7xl font-medium leading-none tracking-[-0.06em] sm:text-8xl">{queueNumber(reservation.queue_summary?.current_called_number)}</p>
                </div>
                <div className="flex min-w-[150px] flex-1 flex-col justify-start px-7 py-8 sm:min-w-[185px]">
                    <p className="mb-3 whitespace-nowrap text-sm font-semibold text-[#40311D]/55 sm:text-base">Nomor antrian mu</p>
                    <p className="text-7xl font-medium leading-none tracking-[-0.06em] sm:text-8xl">{queueNumber(reservation.queue_summary?.number)}</p>
                </div>
            </div>

            <div className="min-w-0 flex-1 border-t border-[#40311D]/15 lg:flex lg:border-l lg:border-t-0">
                <div className="border-b border-[#40311D]/15 p-7 lg:w-[290px] lg:border-b-0 lg:border-r">
                    <p className="mb-4 text-lg font-semibold">Reservasi mu saat ini</p>
                    <p className="text-base">Kode reservasi</p>
                    <p className="break-all text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{reservation.reservation_number}</p>
                    <p className="mt-1 text-xl font-semibold">SLOT NO.{slotLabel(reservation.window_slot_number)}</p>
                    <p className="mt-2 text-sm font-medium text-[#40311D]/70">A.n {patientName(reservation)}</p>
                    <p className="mt-3 text-[11px] leading-5 text-[#40311D]/40">
                        *harap datang 20 menit
                        <br />
                        sebelum waktu janji dimulai
                    </p>
                </div>

                <div className="min-w-0 flex-1 p-7">
                    <p className="mb-5 text-lg font-semibold">Detail Reservasi</p>
                    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailItem label="Nama Klinik" value={reservation.clinic?.name ?? '-'} />
                        <DetailItem label="Nama Dokter" value={reservation.doctor?.name ?? '-'} />
                        <DetailItem label="Nomor klinik" value={reservation.clinic?.phone_number ?? '-'} />
                        <DetailItem label="Lokasi klinik" value={clinicAddress(reservation)} />
                        <DetailItem label="Nama Pasien" value={patientName(reservation)} />
                        <DetailItem label="Waktu reservasi" value={timeRange(reservation)} />
                        <DetailItem label="Tanggal Reservasi" value={dateLabel(reservation.reservation_date)} />
                        <DetailItem label="Email Klinik" value={reservation.clinic?.email ?? '-'} />
                    </div>

                    <div className="mt-6 flex flex-wrap items-end gap-8">
                        <div>
                            <div className="mb-1 flex items-center gap-1">
                                <p className="text-[11px] text-[#40311D]/40">Status reservasi saat ini</p>
                                <StatusTooltip />
                            </div>
                            <p className="text-2xl font-semibold" style={{ color: status.color }}>
                                {status.label}
                                {canChange ? '...' : ''}
                            </p>
                        </div>
                        <div>
                            <p className="mb-1 text-[11px] text-[#40311D]/40">Estimasi waktu tunggu</p>
                            <p className="text-2xl font-medium">
                                {waitEstimate}
                                {waitEstimate !== '-' ? '~' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="mt-7 flex flex-wrap gap-2">
                        <ActionButton href={clinicPhone ? `tel:${clinicPhone}` : undefined} disabled={!clinicPhone}>
                            Kontak klinik
                        </ActionButton>
                        <ActionButton onClick={() => openModal('reschedule')} disabled={!canChange}>
                            Reschedule booking
                        </ActionButton>
                        <ActionButton onClick={() => openModal('cancel')} disabled={!canChange}>
                            Cancel booking
                        </ActionButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HistoryCard({ reservation, order }: { reservation: ReservationEntry; order: number }) {
    const status = reservationStatus(reservation);
    const clinicPhone = reservation.clinic?.phone_number;
    const canOpenMedicalRecord = reservation.status === 'completed' || reservation.medical_record !== null;

    return (
        <article className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-dashed border-[#40311D]/18 py-7">
            <div className="pt-1 text-4xl font-medium leading-none tracking-[-0.03em] text-[#40311D]">#{order}</div>
            <div>
                <p className="text-base font-semibold">Reservasi {compactDateLabel(reservation.reservation_date)}</p>
                <p className="mt-1 text-sm">Kode reservasi</p>
                <p className="break-all text-2xl font-semibold leading-tight tracking-[-0.03em]">{reservation.reservation_number}</p>
                <p className="mt-1 text-lg font-semibold">SLOT NO.{slotLabel(reservation.window_slot_number)}</p>

                {clinicPhone ? (
                    <a href={`tel:${clinicPhone}`} className="mt-4 inline-flex rounded-full border border-[#40311D]/25 px-3 py-1.5 text-[11px] font-semibold transition hover:bg-[#40311D]/5">
                        Kontak klinik
                    </a>
                ) : null}

                <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                    <DetailItem label="Nama Klinik" value={reservation.clinic?.name ?? '-'} />
                    <DetailItem label="Nama Dokter" value={reservation.doctor?.name ?? '-'} />
                    <DetailItem label="Nomor klinik" value={reservation.clinic?.phone_number ?? '-'} />
                    <DetailItem label="Lokasi klinik" value={clinicAddress(reservation)} />
                    <DetailItem label="Nama Pasien" value={patientName(reservation)} />
                    <DetailItem label="Waktu reservasi" value={timeRange(reservation)} />
                    <DetailItem label="Tanggal Reservasi" value={dateLabel(reservation.reservation_date)} />
                    <DetailItem label="Email Klinik" value={reservation.clinic?.email ?? '-'} />
                </div>

                <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="mb-1 text-[10px] text-[#40311D]/40">Status reservasi saat ini</p>
                        <p className="text-lg font-semibold" style={{ color: status.color }}>
                            {status.label}
                        </p>
                    </div>
                    <Link
                        href={canOpenMedicalRecord ? '/rekam-medis' : '/reservasi'}
                        className={`inline-flex items-center gap-1 rounded-lg border border-[#40311D]/30 px-3 py-2 text-xs font-semibold transition ${
                            canOpenMedicalRecord ? 'hover:bg-[#40311D]/5' : 'cursor-not-allowed opacity-40'
                        }`}
                        onClick={(event) => {
                            if (!canOpenMedicalRecord) {
                                event.preventDefault();
                            }
                        }}
                    >
                        Cek Rekap medis
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </Link>
                </div>
            </div>
        </article>
    );
}

export default function PatientReservationsPage({ reservations }: PatientReservationsProps) {
    const page = usePage<SharedData>();
    const flashMessage = page.props.flash?.status ?? null;
    const [modal, setModal] = useState<ModalKind>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const currentReservation = useMemo(() => currentReservationFrom(reservations), [reservations]);
    const history = useMemo(() => reservations.filter((reservation) => reservation.id !== currentReservation?.id), [reservations, currentReservation]);
    const totalPages = Math.max(1, Math.ceil(history.length / CARDS_PER_PAGE));
    const paginatedHistory = history.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
    }, [history.length]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div className="min-h-screen bg-[#DED0B6] font-sans text-[#40311D]">
            <Head title="Reservasi" />
            <PublicNavbar />

            <main className="mx-auto min-h-[70vh] w-full max-w-[1400px] px-5 py-10 sm:px-8 lg:py-14">
                {flashMessage ? <div className="mb-6 rounded-xl border border-[#00917B]/25 bg-[#00917B]/10 px-4 py-3 text-sm font-medium text-[#006d5c]">{flashMessage}</div> : null}

                <CurrentReservationPanel reservation={currentReservation} openModal={setModal} />

                <section>
                    <div className="rounded-t-xl bg-[#40311D] px-6 py-3 text-center text-[#DED0B6]">
                        <p className="text-base font-semibold">Reservasi mu Sebelumnya</p>
                    </div>

                    {history.length === 0 ? (
                        <div className="rounded-b-xl border border-t-0 border-[#40311D]/10 px-6 py-10 text-center text-sm text-[#40311D]/50">Belum ada riwayat reservasi.</div>
                    ) : (
                        <>
                            <div className="grid gap-x-12 lg:grid-cols-2">
                                {paginatedHistory.map((reservation, index) => (
                                    <HistoryCard key={reservation.id} reservation={reservation} order={(currentPage - 1) * CARDS_PER_PAGE + index + 1} />
                                ))}
                            </div>

                            {totalPages > 1 ? (
                                <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#40311D]/10 pt-5">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                                        disabled={currentPage === 1}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#40311D]/20 text-[#40311D] transition hover:bg-[#40311D]/5 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label="Halaman sebelumnya"
                                    >
                                        &lt;
                                    </button>
                                    {Array.from({ length: totalPages }).map((_, index) => {
                                        const pageNumber = index + 1;
                                        const active = pageNumber === currentPage;

                                        return (
                                            <button
                                                key={pageNumber}
                                                type="button"
                                                onClick={() => setCurrentPage(pageNumber)}
                                                className={`h-8 w-8 rounded-lg border text-xs font-semibold transition ${
                                                    active ? 'border-[#40311D] bg-[#40311D] text-[#DED0B6]' : 'border-[#40311D]/20 text-[#40311D] hover:bg-[#40311D]/5'
                                                }`}
                                            >
                                                {pageNumber}
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
                                        disabled={currentPage === totalPages}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#40311D]/20 text-[#40311D] transition hover:bg-[#40311D]/5 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label="Halaman berikutnya"
                                    >
                                        &gt;
                                    </button>
                                </div>
                            ) : null}
                        </>
                    )}
                </section>
            </main>

            <PublicFooter />

            {modal === 'cancel' && currentReservation ? <CancelModal reservation={currentReservation} onClose={() => setModal(null)} /> : null}
            {modal === 'reschedule' && currentReservation ? <RescheduleModal reservation={currentReservation} onClose={() => setModal(null)} /> : null}
        </div>
    );
}
