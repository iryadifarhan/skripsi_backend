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
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

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

function dateKeyFromParts(year: number, month: number, day: number): string {
    return [year, String(month + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function mondayFirstOffset(year: number, month: number): number {
    const day = new Date(year, month, 1).getDay() - 1;

    return day < 0 ? 6 : day;
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

function ModalShell({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4"
            onMouseDown={(event) => {
                if (onClose && event.target === event.currentTarget) {
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
        <div className={`max-h-[90vh] w-full overflow-y-auto rounded-[18px] bg-[#1c1c1c] p-7 text-white shadow-2xl ${wide ? 'max-w-[420px]' : 'max-w-[340px]'}`}>
            {children}
        </div>
    );
}

function ModalActionButton({
    children,
    disabled = false,
    outline = false,
    onClick,
}: {
    children: ReactNode;
    disabled?: boolean;
    outline?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                outline
                    ? 'border border-white/25 bg-transparent text-white/70 hover:bg-white/10'
                    : 'bg-white text-[#1c1c1c] hover:bg-[#DED0B6]'
            } disabled:cursor-not-allowed disabled:opacity-40`}
        >
            {children}
        </button>
    );
}

function RescheduleCalendar({
    year,
    month,
    selectedDate,
    onSelect,
    onPrev,
    onNext,
}: {
    year: number;
    month: number;
    selectedDate: string;
    onSelect: (date: string) => void;
    onPrev: () => void;
    onNext: () => void;
}) {
    const today = todayKey();
    const days = daysInMonth(year, month);
    const offset = mondayFirstOffset(year, month);
    const cells: Array<number | null> = [];

    for (let index = 0; index < offset; index += 1) {
        cells.push(null);
    }

    for (let day = 1; day <= days; day += 1) {
        cells.push(day);
    }

    return (
        <div className="select-none rounded-[10px] bg-white/[0.06] p-3">
            <div className="mb-3 flex items-center justify-between">
                <button type="button" onClick={onPrev} className="rounded-full p-1 text-white/80 transition hover:bg-white/10" aria-label="Bulan sebelumnya">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="text-xs font-semibold text-white">{MONTH_NAMES[month]} {year}</span>
                <button type="button" onClick={onNext} className="rounded-full p-1 text-white/80 transition hover:bg-white/10" aria-label="Bulan berikutnya">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            <div className="mb-1 grid grid-cols-7">
                {DAY_LABELS.map((day) => (
                    <div key={day} className="py-1 text-center text-[9px] font-bold uppercase tracking-wide text-white/35">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {cells.map((day, index) => {
                    if (day === null) {
                        return <div key={`blank-${index}`} />;
                    }

                    const key = dateKeyFromParts(year, month, day);
                    const selected = selectedDate === key;
                    const isToday = today === key;
                    const disabled = key < today;

                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect(key)}
                            className={`aspect-square rounded-md text-[11px] font-medium transition ${
                                selected
                                    ? 'bg-[#40311D] text-[#DED0B6] ring-1 ring-white/20'
                                    : isToday
                                      ? 'border border-[#00917B] text-[#00917B] hover:bg-white/10'
                                      : disabled ? 'cursor-not-allowed border-0 text-gray-700'
                                                 : 'text-white/85 hover:bg-white/10' 
                            }`}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function CancelModal({ reservation, onClose }: { reservation: ReservationEntry; onClose: () => void }) {
    const [step, setStep] = useState<'confirm' | 'reason' | 'success'>('confirm');
    const [reason, setReason] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!reason.trim() || !agreed) {
            return;
        }

        setLoading(true);
        setError(null);

        const result = await patchJson(`/reservations/${reservation.id}/cancel`, {
            cancellation_reason: reason.trim(),
        });

        setLoading(false);

        if (!result.ok) {
            setError(result.message ?? 'Pembatalan reservasi gagal diproses.');
            return;
        }

        setStep('success');
        setTimeout(() => {
            onClose();
            router.reload({ only: ['reservations'], preserveScroll: true });
        }, 2500);
    };

    return (
        <ModalShell onClose={step !== 'success' && !loading ? onClose : undefined}>
            <ModalCard>
                {step === 'confirm' ? (
                    <>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 text-white">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <h3 className="text-center text-base font-medium">Apakah anda ingin melakukan pembatalan reservasi?</h3>
                        <div className="mt-6 flex gap-2">
                            <ModalActionButton outline onClick={onClose}>
                                Kembali
                            </ModalActionButton>
                            <ModalActionButton onClick={() => setStep('reason')}>
                                Ya
                            </ModalActionButton>
                        </div>
                    </>
                ) : null}

                {step === 'reason' ? (
                    <>
                        <h3 className="mb-3 text-[15px] font-medium">Apa alasan anda mengajukan pembatalan reservasi?</h3>
                        <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value.slice(0, 90))}
                            rows={4}
                            className="w-full resize-none rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-[#00917B]"
                            placeholder="Ketik alasan anda disini"
                        />
                        <p className="mt-1 text-right text-[10px] text-white/35">{reason.length}/90</p>
                        <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-5 text-white/60">
                            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1 accent-[#00917B]" />
                            Dengan ini saya setuju untuk membatalkan reservasi
                        </label>

                        {error ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-100">{error}</p> : null}

                        <div className="mt-5 flex gap-2">
                            <ModalActionButton outline disabled={loading} onClick={() => setStep('confirm')}>
                                Kembali
                            </ModalActionButton>
                            <ModalActionButton disabled={!reason.trim() || !agreed || loading} onClick={submit}>
                                {loading ? 'Mengajukan...' : 'Lanjut'}
                            </ModalActionButton>
                        </div>
                    </>
                ) : null}

                {step === 'success' ? (
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00917B]/20 text-[#00917B]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h3 className="text-base font-medium">Pembatalan reservasi anda berhasil diajukan.</h3>
                        <p className="mt-2 text-xs text-white/50">Status pada website akan segera mengikuti pembatalan yang diajukan.</p>
                    </div>
                ) : null}
            </ModalCard>
        </ModalShell>
    );
}

function RescheduleModal({ reservation, onClose }: { reservation: ReservationEntry; onClose: () => void }) {
    const initialDate = dateKey(reservation.reservation_date) >= todayKey() ? dateKey(reservation.reservation_date) : todayKey();
    const initialCalendarDate = localDate(initialDate) ?? new Date();
    const [step, setStep] = useState<'confirm' | 'form' | 'success'>('confirm');
    const [calYear, setCalYear] = useState(initialCalendarDate.getFullYear());
    const [calMonth, setCalMonth] = useState(initialCalendarDate.getMonth());
    const [reservationDate, setReservationDate] = useState();
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

    useEffect(() => {
        if (step !== 'form') {
            return;
        }

        const clinicId = reservation.clinic_id ?? reservation.clinic?.id;
        const doctorId = reservation.doctor_id ?? reservation.doctor?.id;

        if (!clinicId || !doctorId || !reservationDate) {
            setSchedules([]);
            setScheduleId('');
            setWindows([]);
            setWindowStart('');
            return;
        }

        const controller = new AbortController();
        let active = true;

        setSchedules([]);
        setScheduleId('');
        setWindows([]);
        setWindowStart('');
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
                if (!active) {
                    return;
                }

                const options = data.schedules ?? [];
                setSchedules(options);
                setScheduleId(options[0]?.id ? String(options[0].id) : '');
            })
            .catch((fetchError: Error) => {
                if (active && fetchError.name !== 'AbortError') {
                    setSchedules([]);
                    setScheduleId('');
                    setWindows([]);
                    setWindowStart('');
                    setError(fetchError.message);
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingSchedules(false);
                }
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [reservation, reservationDate, step]);

    useEffect(() => {
        const scheduleMatchesSelectedDate = schedules.some((schedule) => String(schedule.id) === scheduleId);

        if (step !== 'form' || loadingSchedules || !scheduleId || !scheduleMatchesSelectedDate || !reservationDate) {
            setWindows([]);
            setWindowStart('');
            return;
        }

        const controller = new AbortController();
        let active = true;

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
                if (!active) {
                    return;
                }

                const options = data.windows ?? [];
                setWindows(options);
                setWindowStart((current) => {
                    const currentAvailable = options.some((slot) => slot.is_available && shortTime(slot.window_start_time) === current);
                    const fallback = options.find((slot) => slot.is_available);

                    return currentAvailable ? current : (fallback ? shortTime(fallback.window_start_time) : '');
                });
            })
            .catch((fetchError: Error) => {
                if (active && fetchError.name !== 'AbortError') {
                    setWindows([]);
                    setWindowStart('');
                    setError(fetchError.message);
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingWindows(false);
                }
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [loadingSchedules, reservation.id, reservationDate, scheduleId, schedules, step]);

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

        setStep('success');
        setTimeout(() => {
            onClose();
            router.reload({ only: ['reservations'], preserveScroll: true });
        }, 2500);
    };

    return (
        <ModalShell onClose={step !== 'success' && !submitting ? onClose : undefined}>
            <ModalCard wide>
                {step === 'confirm' ? (
                    <>
                        <h3 className="text-center text-base font-medium">Apakah anda ingin melakukan reschedule reservasi?</h3>
                        <div className="mt-6 flex gap-2">
                            <ModalActionButton outline onClick={onClose}>
                                Kembali
                            </ModalActionButton>
                            <ModalActionButton onClick={() => setStep('form')}>
                                Ya
                            </ModalActionButton>
                        </div>
                    </>
                ) : null}

                {step === 'form' ? (
                    <>
                        <p className="mb-1 text-sm font-semibold">Detail reservasi mu</p>
                        <p className="text-xs text-white/60">
                            {reservation.clinic?.name ?? '-'}, {reservation.doctor?.name ?? '-'}, Slot {slotLabel(reservation.window_slot_number)}
                        </p>
                        <p className="mb-4 text-xs text-white/60">
                            {dateLabel(reservation.reservation_date)}, {timeRange(reservation)}
                        </p>

                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">Slot waktu tersedia</p>
                        <RescheduleCalendar
                            year={calYear}
                            month={calMonth}
                            selectedDate={reservationDate}
                            onSelect={(date) => {
                                setReservationDate(date);
                                setSchedules([]);
                                setScheduleId('');
                                setWindows([]);
                                setWindowStart('');
                                setError(null);
                            }}
                            onPrev={() => {
                                if (calMonth === 0) {
                                    setCalMonth(11);
                                    setCalYear((yearValue) => yearValue - 1);
                                } else {
                                    setCalMonth((monthValue) => monthValue - 1);
                                }
                            }}
                            onNext={() => {
                                if (calMonth === 11) {
                                    setCalMonth(0);
                                    setCalYear((yearValue) => yearValue + 1);
                                } else {
                                    setCalMonth((monthValue) => monthValue + 1);
                                }
                            }}
                        />

                        <div className="mt-3 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                            {loadingSchedules || loadingWindows ? (
                                <p className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/50">Memuat slot waktu...</p>
                            ) : schedules.length === 0 ? (
                                <p className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/50">Dokter tidak memiliki jadwal praktik pada tanggal ini.</p>
                            ) : windows.length === 0 ? (
                                <p className="w-full rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/50">Tidak ada slot untuk tanggal ini.</p>
                            ) : (
                                windows.map((slot) => {
                                    const selected = shortTime(slot.window_start_time) === windowStart;
                                    const disabled = !slot.is_available;
                                    const filled = Math.max(0, slot.max_slots - slot.available_slots);

                                    return (
                                        <button
                                            key={`${slot.window_start_time}-${slot.window_end_time}`}
                                            type="button"
                                            onClick={() => setWindowStart(shortTime(slot.window_start_time))}
                                            disabled={disabled}
                                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                                                selected
                                                    ? 'border-[#00917B] bg-[#00917B]/20 text-[#00917B]'
                                                    : 'border-white/20 bg-transparent text-white hover:border-white/35'
                                            } ${disabled ? 'cursor-not-allowed text-white/25 hover:border-white/20' : ''}`}
                                        >
                                            {shortTime(slot.window_start_time)} - {shortTime(slot.window_end_time)}
                                            <span className="text-[10px] opacity-60">{filled}/{slot.max_slots}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <p className="mt-4 mb-2 text-[13px] font-medium">Apa alasan anda mengajukan perubahan jadwal?</p>
                        <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value.slice(0, 90))}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-[#00917B]"
                            placeholder="Ketik alasan anda disini"
                        />
                        <p className="mt-1 text-right text-[10px] text-white/35">{reason.length}/90</p>

                        <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-5 text-white/60">
                            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1 accent-[#00917B]" />
                            Dengan ini saya setuju untuk merubah waktu reservasi
                        </label>

                        {error ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-100">{error}</p> : null}

                        <div className="mt-5 flex gap-2">
                            <ModalActionButton outline disabled={submitting} onClick={() => setStep('confirm')}>
                                Kembali
                            </ModalActionButton>
                            <ModalActionButton disabled={!reason.trim() || !agreed || submitting || loadingSchedules || loadingWindows} onClick={submit}>
                                {submitting ? 'Mengajukan...' : 'Lanjut'}
                            </ModalActionButton>
                        </div>
                    </>
                ) : null}

                {step === 'success' ? (
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00917B]/20 text-[#00917B]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h3 className="text-base font-medium">Perubahan waktu reservasi mu berhasil diajukan.</h3>
                        <p className="mt-2 text-xs text-white/50">Status pada website akan segera mengikuti perubahan yang diajukan.</p>
                    </div>
                ) : null}
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
                        href={canOpenMedicalRecord ? `/rekam-medis?search=${encodeURIComponent(reservation.reservation_number)}` : '/reservasi'}
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
