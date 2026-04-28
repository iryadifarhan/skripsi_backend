import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

import type { ClinicDetail, ReservationEntry } from '@/types';

type WalkInReservationModalProps = {
    clinic: ClinicDetail;
    today: string;
    initialDate?: string;
    onClose: () => void;
};

type WalkInScheduleOption = {
    id: number;
    start_time: string;
    end_time: string;
    window_minutes: number;
    max_patients_per_window: number;
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

type PatientOption = {
    id: number;
    name: string;
    username?: string | null;
    email?: string | null;
    phone_number?: string | null;
    gender?: string | null;
};

const activeReservationStatuses = ['pending', 'approved'];

export function WalkInReservationModal({ clinic, today, initialDate, onClose }: WalkInReservationModalProps) {
    const [patientMode, setPatientMode] = useState<'registered' | 'guest'>('registered');
    const [patientSearch, setPatientSearch] = useState('');
    const [patients, setPatients] = useState<PatientOption[]>([]);
    const [patientId, setPatientId] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestPhoneNumber, setGuestPhoneNumber] = useState('');
    const [doctorId, setDoctorId] = useState(clinic.doctors[0]?.id ? String(clinic.doctors[0].id) : '');
    const [reservationDate, setReservationDate] = useState(initialReservationDate(today, initialDate));
    const [schedules, setSchedules] = useState<WalkInScheduleOption[]>([]);
    const [scheduleId, setScheduleId] = useState('');
    const [windows, setWindows] = useState<BookingWindow[]>([]);
    const [windowStart, setWindowStart] = useState('');
    const [complaint, setComplaint] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [patientReservationConflict, setPatientReservationConflict] = useState<ReservationEntry | null>(null);
    const [isLoadingPatients, setIsLoadingPatients] = useState(false);
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
    const [isLoadingWindows, setIsLoadingWindows] = useState(false);
    const [isCheckingPatientReservation, setIsCheckingPatientReservation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (patientMode !== 'registered') {
            return;
        }

        const controller = new AbortController();

        setIsLoadingPatients(true);
        setError(null);

        getJson<{ patients: PatientOption[] }>(
            `/admin/patients/search?${new URLSearchParams({ search: patientSearch }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.patients ?? [];
                const selectedStillExists = options.some((patient) => String(patient.id) === patientId);

                setPatients(options);
                setPatientId(selectedStillExists ? patientId : (options[0]?.id ? String(options[0].id) : ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setPatients([]);
                    setPatientId('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsLoadingPatients(false));

        return () => controller.abort();
    }, [patientId, patientMode, patientSearch]);

    useEffect(() => {
        if (patientMode !== 'registered' || !patientId || !reservationDate) {
            setPatientReservationConflict(null);
            setIsCheckingPatientReservation(false);
            return;
        }

        const controller = new AbortController();

        setIsCheckingPatientReservation(true);
        setPatientReservationConflict(null);

        getJson<{ reservations: ReservationEntry[] }>(
            `/admin/reservations?${new URLSearchParams({
                clinic_id: String(clinic.id),
                reservation_date: reservationDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const conflict = (data.reservations ?? []).find((reservation) =>
                    String(reservation.patient?.id ?? '') === patientId
                    && activeReservationStatuses.includes(reservation.status),
                );

                setPatientReservationConflict(conflict ?? null);
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setPatientReservationConflict(null);
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsCheckingPatientReservation(false));

        return () => controller.abort();
    }, [clinic.id, patientId, patientMode, reservationDate]);

    useEffect(() => {
        if (!doctorId || !reservationDate) {
            setSchedules([]);
            setScheduleId('');
            return;
        }

        const controller = new AbortController();

        setIsLoadingSchedules(true);
        setError(null);

        getJson<{ schedules: WalkInScheduleOption[] }>(
            `/reservations/schedules?${new URLSearchParams({
                clinic_id: String(clinic.id),
                doctor_id: doctorId,
                reservation_date: reservationDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.schedules ?? [];
                const selectedStillExists = options.some((schedule) => String(schedule.id) === scheduleId);

                setSchedules(options);
                setScheduleId(selectedStillExists ? scheduleId : (options[0]?.id ? String(options[0].id) : ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setSchedules([]);
                    setScheduleId('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsLoadingSchedules(false));

        return () => controller.abort();
    }, [clinic.id, doctorId, reservationDate, scheduleId]);

    useEffect(() => {
        if (!scheduleId || !reservationDate) {
            setWindows([]);
            setWindowStart('');
            return;
        }

        const controller = new AbortController();

        setIsLoadingWindows(true);
        setError(null);

        getJson<{ windows: BookingWindow[] }>(
            `/reservations/booking/windows?${new URLSearchParams({
                doctor_clinic_schedule_id: scheduleId,
                reservation_date: reservationDate,
            }).toString()}`,
            controller.signal,
        )
            .then((data) => {
                const options = data.windows ?? [];
                const activeOptions = options.filter((window) => window.is_available);
                const selectedStillExists = activeOptions.some((window) => window.window_start_time.slice(0, 5) === windowStart);

                setWindows(options);
                setWindowStart(selectedStillExists ? windowStart : (activeOptions[0]?.window_start_time.slice(0, 5) ?? ''));
            })
            .catch((fetchError: Error) => {
                if (fetchError.name !== 'AbortError') {
                    setWindows([]);
                    setWindowStart('');
                    setError(fetchError.message);
                }
            })
            .finally(() => setIsLoadingWindows(false));

        return () => controller.abort();
    }, [reservationDate, scheduleId, windowStart]);

    const activeWindows = windows.filter((window) => window.is_available);
    const selectedPatient = patients.find((patient) => String(patient.id) === patientId);
    const isGuestValid = patientMode === 'guest' && guestName.trim() !== '';
    const isRegisteredValid = patientMode === 'registered' && patientId !== '';
    const canSubmit = (isGuestValid || isRegisteredValid)
        && patientReservationConflict === null
        && doctorId !== ''
        && reservationDate !== ''
        && scheduleId !== ''
        && windowStart !== ''
        && activeWindows.length > 0
        && !isSubmitting
        && !isCheckingPatientReservation
        && !isLoadingSchedules
        && !isLoadingWindows;

    const submit = async () => {
        if (!canSubmit) {
            setError('Lengkapi data pasien, jadwal dokter, dan window reservasi terlebih dahulu.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const payload: Record<string, string | number | null> = {
            clinic_id: clinic.id,
            status: 'approved',
            doctor_clinic_schedule_id: Number(scheduleId),
            reservation_date: reservationDate,
            window_start_time: windowStart,
            complaint: complaint.trim() === '' ? null : complaint.trim(),
        };

        if (patientMode === 'registered') {
            payload.patient_id = Number(patientId);
        } else {
            payload.guest_name = guestName.trim();
            payload.guest_phone_number = guestPhoneNumber.trim() === '' ? null : guestPhoneNumber.trim();
        }

        const result = await postJson('/reservations', payload);

        setIsSubmitting(false);

        if (!result.ok) {
            setError(result.message ?? 'Gagal membuat reservasi walk-in.');
            return;
        }

        onClose();
        router.reload({ preserveScroll: true });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2115]/55 px-4 py-6">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#e4ddd4] bg-white shadow-[0_24px_80px_rgba(44,33,21,0.25)]">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <p className="text-[15px] font-medium text-[#40311D]">Buat Reservasi Walk-In</p>
                    <p className="mt-1 text-[12px] text-gray-500">{clinic.name}</p>
                </div>

                <div className="grid gap-4 px-5 py-4">
                    {error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                        <ModeButton active={patientMode === 'registered'} onClick={() => setPatientMode('registered')} title="Pasien Terdaftar" description="Pilih akun pasien yang sudah ada." />
                        <ModeButton active={patientMode === 'guest'} onClick={() => setPatientMode('guest')} title="Pasien Tanpa Akun" description="Isi nama dan nomor telepon walk-in." />
                    </div>

                    {patientMode === 'registered' ? (
                        <div className="grid gap-3 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4">
                            <TextField type="text" label="Cari pasien" value={patientSearch} onChange={setPatientSearch} placeholder="Nama, email, username, atau nomor telepon" />
                            <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Pasien
                                <select
                                    value={patientId}
                                    onChange={(event) => setPatientId(event.target.value)}
                                    disabled={isLoadingPatients || patients.length === 0}
                                    className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                                >
                                    {isLoadingPatients ? <option value="">Memuat pasien...</option> : null}
                                    {!isLoadingPatients && patients.length === 0 ? <option value="">Tidak ada pasien ditemukan</option> : null}
                                    {patients.map((patient) => (
                                        <option key={patient.id} value={patient.id}>
                                            {patient.name} - {patient.email ?? patient.phone_number ?? patient.username}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {selectedPatient ? (
                                <p className="text-[11px] text-gray-500">
                                    Terpilih: {selectedPatient.name}{selectedPatient.phone_number ? `, ${selectedPatient.phone_number}` : ''}
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <div className="grid gap-3 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4 sm:grid-cols-2">
                            <TextField type="text" label="Nama pasien walk-in" value={guestName} onChange={setGuestName} placeholder="Contoh: Budi Santoso" required />
                            <TextField type="tel" label="Nomor telepon" value={guestPhoneNumber} onChange={setGuestPhoneNumber} placeholder="Opsional, untuk notifikasi WhatsApp" />
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Dokter
                            <select
                                value={doctorId}
                                onChange={(event) => setDoctorId(event.target.value)}
                                disabled={clinic.doctors.length === 0}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                            >
                                {clinic.doctors.length === 0 ? <option value="">Tidak ada dokter di klinik ini</option> : null}
                                {clinic.doctors.map((doctor) => (
                                    <option key={doctor.id} value={doctor.id}>
                                        {doctor.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Tanggal reservasi
                            <input
                                type="date"
                                value={reservationDate}
                                min={today}
                                onChange={(event) => setReservationDate(event.target.value)}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                            />
                        </label>

                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Jadwal dokter
                            <select
                                value={scheduleId}
                                onChange={(event) => setScheduleId(event.target.value)}
                                disabled={isLoadingSchedules || schedules.length === 0}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                            >
                                {isLoadingSchedules ? <option value="">Memuat jadwal...</option> : null}
                                {!isLoadingSchedules && schedules.length === 0 ? <option value="">Tidak ada jadwal aktif pada tanggal ini</option> : null}
                                {schedules.map((schedule) => (
                                    <option key={schedule.id} value={schedule.id}>
                                        {schedule.start_time} - {schedule.end_time} ({schedule.window_minutes} menit)
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                            Window tersedia
                            <select
                                value={windowStart}
                                onChange={(event) => setWindowStart(event.target.value)}
                                disabled={isLoadingWindows || activeWindows.length === 0}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100"
                            >
                                {isLoadingWindows ? <option value="">Memuat window...</option> : null}
                                {!isLoadingWindows && activeWindows.length === 0 ? <option value="">Tidak ada window tersedia</option> : null}
                                {activeWindows.map((window) => (
                                    <option key={window.window_start_time} value={window.window_start_time.slice(0, 5)}>
                                        {window.window_start_time} - {window.window_end_time} ({window.available_slots} slot tersisa)
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <RegisteredPatientReservationCue
                        conflict={patientReservationConflict}
                        reservationDate={reservationDate}
                    />

                    <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                        Keluhan
                        <textarea
                            value={complaint}
                            onChange={(event) => setComplaint(event.target.value)}
                            rows={3}
                            placeholder="Keluhan singkat pasien"
                            className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                        />
                    </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="rounded-lg bg-[#00917B] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#006d5c] disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isSubmitting ? 'Menyimpan...' : 'Buat Reservasi'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModeButton({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl border px-4 py-3 text-left transition ${active ? 'border-[#40311D] bg-[#40311D] text-white' : 'border-gray-200 bg-white text-[#40311D] hover:bg-[#DFE0DF]'}`}
        >
            <span className="block text-[12px] font-medium">{title}</span>
            <span className={`mt-1 block text-[11px] ${active ? 'text-white/70' : 'text-gray-400'}`}>{description}</span>
        </button>
    );
}

function RegisteredPatientReservationCue({ conflict, reservationDate }: { conflict: ReservationEntry | null; reservationDate: string }) {
    if (!conflict) {
        return null;
    }

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-6 text-amber-800">
            <p className="font-medium">Pasien ini sudah memiliki reservasi aktif pada tanggal {formatDateLabel(reservationDate)}.</p>
            <p className="mt-1">
                {conflict.reservation_number} - {conflict.doctor?.name ?? 'Dokter'} - {formatTime(conflict.window_start_time)}-{formatTime(conflict.window_end_time)} - status {formatReservationStatus(conflict.status)}
            </p>
            <p className="mt-1 text-amber-700">Pilih tanggal lain atau kelola reservasi yang sudah ada.</p>
        </div>
    );
}

function TextField({ type, label, value, onChange, placeholder, required = false }: { type: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
    return (
        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
            {label}{required ? ' *' : ''}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="rounded-xl border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
            />
        </label>
    );
}

function initialReservationDate(today: string, initialDate?: string): string {
    if (!initialDate || initialDate < today) {
        return today;
    }

    return initialDate;
}

function formatReservationStatus(status: string): string {
    const labels: Record<string, string> = {
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
        completed: 'Completed',
    };

    return labels[status] ?? status;
}

function formatDateLabel(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthIndex = Number(month) - 1;

    if (!year || !month || !day || monthIndex < 0 || monthIndex > 11) {
        return value;
    }

    return `${day} ${monthNames[monthIndex]} ${year}`;
}

function formatTime(value: string): string {
    return value.slice(0, 5);
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        signal,
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const errorText = Object.values(body?.errors ?? {}).flat().join(' ');
        throw new Error(body?.message ?? errorText ?? 'Request failed.');
    }

    return response.json() as Promise<T>;
}

async function postJson(url: string, payload: Record<string, string | number | null>): Promise<{ ok: boolean; message?: string }> {
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const errorText = Object.values(body?.errors ?? {}).flat().join(' ');
        return { ok: false, message: body?.message ?? errorText ?? 'Request failed.' };
    }

    return { ok: true };
}
