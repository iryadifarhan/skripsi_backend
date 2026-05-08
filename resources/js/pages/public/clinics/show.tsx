import { Head, Link, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import {
    ClinicImage,
    DoctorImage,
    type PublicClinic,
    type PublicCurrentReservation,
    type PublicSchedule,
    type PublicTodayQueue,
    type PublicWindowUsage,
} from '@/pages/public/directory-components';
import type { SharedData } from '@/types';

type ClinicDetailProps = {
    clinic: PublicClinic;
};

type ClinicDoctor = PublicClinic['doctors'][number] & {
    schedules?: PublicSchedule[];
    operational_label?: string;
    hours_label?: string;
    is_available_today?: boolean;
    status_label?: string;
    today_queue?: PublicTodayQueue;
};

type WindowSlot = {
    id: string;
    label: string;
    start: string;
    end: string;
    filled: number;
    total: number;
};

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STEPS = ['Pilih Dokter', 'Pilih Tanggal', 'Pilih slot waktu', 'Isi data diri', 'Ajukan reservasi mu'];

export default function ClinicDetail({ clinic }: ClinicDetailProps) {
    const { auth } = usePage<SharedData>().props;
    const user = auth?.user ?? null;
    const isPatient = user?.role === 'patient';
    const doctors = (clinic.doctors ?? []) as ClinicDoctor[];
    const activeDoctorCount = doctors.filter((doctor) => doctor.today_queue !== null).length;
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState<ClinicDoctor | null>(null);
    const [calYear, setCalYear] = useState(() => new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<WindowSlot | null>(null);
    const [complaint, setComplaint] = useState('');

    const patientHref = (path: string) => (isPatient ? path : `/masuk?next=${encodeURIComponent(path)}`);
    const reservationTarget = selectedDoctor
        ? patientHref(`/reservasi?booking_clinic_id=${clinic.id}&booking_doctor_id=${selectedDoctor.id}`)
        : patientHref(`/reservasi?booking_clinic_id=${clinic.id}`);

    const activeStep = selectedDoctor ? (selectedDay ? (selectedSlot ? (complaint.trim() ? 4 : 3) : 2) : 1) : 0;
    const selectedDate = selectedDay ? new Date(calYear, calMonth, selectedDay) : null;

    const windowSlots = useMemo(() => {
        if (!selectedDoctor || !selectedDate) {
            return [];
        }

        const schedules = selectedDoctor.schedules ?? clinic.schedules.filter((schedule) => schedule.doctor_id === selectedDoctor.id);
        const schedule = schedules.find((item) => item.is_active && matchesScheduleDay(item.day_of_week, selectedDate.getDay()));

        if (!schedule) {
            return [];
        }

        return generateWindows(schedule, selectedDate, clinic.window_usage ?? []);
    }, [clinic.schedules, clinic.window_usage, selectedDate, selectedDoctor]);

    const slotGroups = useMemo(() => groupSlots(windowSlots), [windowSlots]);
    const canBook = Boolean(selectedDoctor && selectedDay && selectedSlot && complaint.trim());

    function selectDoctor(doctor: ClinicDoctor) {
        setSelectedDoctor((current) => (current?.id === doctor.id ? null : doctor));
        setSelectedSlot(null);
    }

    function selectDay(day: number) {
        setSelectedDay(day);
        setSelectedSlot(null);
    }

    return (
        <>
            <Head title={clinic.name} />
            <div className="min-h-screen bg-[#DED0B6] text-[#40311D]">
                <PublicNavbar />

                <main className="mx-auto w-full max-w-[1400px] px-5 py-10 md:px-8">
                    <section className="grid items-start gap-8 lg:grid-cols-[324px_minmax(0,1fr)_370px]">
                        <div className="h-[209px] overflow-hidden rounded-xl border border-[#40311D]/10 bg-[#40311D]/10">
                            <ClinicImage imageUrl={clinic.image_url} name={clinic.name} />
                        </div>

                        <div className="max-w-fit">
                            <h1 className="text-3xl font-bold leading-tight tracking-[-0.03em] md:text-[2rem]">{clinic.name}</h1>
                            <div className="mt-3 flex items-start gap-2 text-base text-[#40311D]/65 md:text-lg">
                                <LocationIcon />
                                <span>{clinic.location || [clinic.address, clinic.city_name].filter(Boolean).join(', ') || 'Alamat belum tersedia'}</span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {(clinic.specialities.length > 0 ? clinic.specialities : ['Klinik umum']).slice(0, 6).map((speciality) => (
                                    <span key={speciality} className="rounded-full border border-[#40311D]/35 px-3 py-1 text-sm font-medium text-[#40311D]/70">
                                        {speciality}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-6 grid max-w-[520px] gap-5 sm:grid-cols-2">
                                <ContactBlock label="Nomor telepon" value={clinic.phone_number || '-'} icon={<PhoneIcon />} />
                                <ContactBlock label="Alamat email" value={clinic.email || '-'} icon={<MailIcon />} />
                            </div>

                            <div className="relative mt-5">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#40311D]/45">Jam operasional</p>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-[#40311D]/65">
                                    <span
                                        className={[
                                            'rounded-full px-2 py-0.5 text-xs font-bold',
                                            clinic.is_open_now ? 'bg-[#00917B]/15 text-[#00917B]' : 'bg-red-500/10 text-red-600',
                                        ].join(' ')}
                                    >
                                        {clinic.is_open_now ? 'Buka' : 'Tutup'}
                                    </span>
                                    <span>{clinic.operational_label}</span>
                                    <span className="text-xs text-[#40311D]/45">{clinic.hours_label}</span>
                                    <button
                                        type="button"
                                        onClick={() => setScheduleOpen((open) => !open)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#40311D] transition hover:bg-[#40311D]/10"
                                        aria-label="Lihat jadwal operasional"
                                    >
                                        <ChevronIcon className={scheduleOpen ? 'rotate-90' : ''} />
                                    </button>
                                </div>
                                {scheduleOpen ? <OperatingHoursPopover clinic={clinic} onClose={() => setScheduleOpen(false)} /> : null}
                            </div>
                        </div>

                        <ReservationStatusCard reservation={clinic.current_reservation ?? null} href={patientHref('/reservasi')} />
                    </section>

                    <section className="mt-12">
                        <h2 className="text-3xl font-semibold tracking-[-0.03em]">Dokter</h2>
                        <p className="mt-1 text-sm text-[#40311D]/55">
                            Dokter aktif hari ini (<strong>{activeDoctorCount}</strong>)
                        </p>

                        {doctors.length === 0 ? (
                            <div className="mt-6 rounded-2xl border border-[#40311D]/15 bg-[#40311D]/5 p-6 text-sm text-[#40311D]/55">
                                Belum ada dokter yang terhubung pada klinik ini.
                            </div>
                        ) : (
                            <div className="mt-6 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <div className="flex w-max items-start gap-4">
                                    {doctors.map((doctor) => (
                                        <DoctorCard
                                            key={doctor.id}
                                            doctor={doctor}
                                            selected={selectedDoctor?.id === doctor.id}
                                            schedule={getTodaySchedule(doctor, clinic.schedules)}
                                            todayQueue={doctor.today_queue ?? null}
                                            onSelect={() => selectDoctor(doctor)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="mt-12">
                        <h2 className="text-3xl font-semibold tracking-[-0.03em]">Reservasi</h2>
                        <div className="mt-5">
                            <StepIndicator current={activeStep} />
                        </div>

                        <div className="mt-5 rounded-2xl border border-[#40311D]/15 bg-[#40311D]/5 p-5">
                            <div className="grid items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                                <div className={selectedDoctor ? '' : 'pointer-events-none opacity-40'}>
                                    <SectionLabel>Pilih tanggal</SectionLabel>
                                    <MiniCalendar
                                        year={calYear}
                                        month={calMonth}
                                        selected={selectedDay}
                                        onSelect={selectDay}
                                        onPrev={() => {
                                            setCalMonth((month) => {
                                                if (month === 0) {
                                                    setCalYear((year) => year - 1);
                                                    return 11;
                                                }

                                                return month - 1;
                                            });
                                            setSelectedSlot(null);
                                        }}
                                        onNext={() => {
                                            setCalMonth((month) => {
                                                if (month === 11) {
                                                    setCalYear((year) => year + 1);
                                                    return 0;
                                                }

                                                return month + 1;
                                            });
                                            setSelectedSlot(null);
                                        }}
                                    />
                                </div>

                                <div className={selectedDoctor ? '' : 'pointer-events-none opacity-40'}>
                                    <SectionLabel>Pilih slot waktu</SectionLabel>
                                    {selectedDoctor && selectedDay && windowSlots.length === 0 ? (
                                        <div className="rounded-xl border border-[#40311D]/10 bg-[#DED0B6]/70 p-4 text-sm text-[#40311D]/50">
                                            Dokter tidak memiliki jadwal aktif pada tanggal ini.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {slotGroups.map((group) => (
                                                <TimeSlotGroup
                                                    key={group.label}
                                                    label={group.label}
                                                    slots={group.slots}
                                                    selectedSlot={selectedSlot}
                                                    onSelectSlot={setSelectedSlot}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className={selectedDoctor ? '' : 'pointer-events-none opacity-40'}>
                                    <SectionLabel>Isi data pasien</SectionLabel>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <PatientField label="Nama pasien" value={user?.name ?? 'Masuk untuk memakai data akun'} />
                                        <PatientField label="Nomor telepon pasien" value={user?.phone_number ?? '-'} />
                                        <PatientField label="Tanggal lahir" value={user?.date_of_birth ?? '-'} />
                                        <PatientField label="Jenis kelamin" value={user?.gender ?? '-'} />
                                    </div>

                                    <div className="mt-4">
                                        <SectionLabel>Keluhan pasien</SectionLabel>
                                        <textarea
                                            value={complaint}
                                            onChange={(event) => setComplaint(event.target.value)}
                                            placeholder="Tulis kepada kami alasan di balik penggunaan kunjungan"
                                            rows={4}
                                            className="w-full resize-y rounded-xl border border-[#40311D]/15 bg-[#40311D]/5 px-4 py-3 text-sm text-[#40311D] outline-none transition placeholder:text-[#40311D]/25 focus:border-[#00917B]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {canBook ? (
                                <Link
                                    href={reservationTarget}
                                    className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#40311D] px-4 py-3 text-sm font-bold text-[#DED0B6] transition hover:bg-[#2c2115]"
                                >
                                    Pesan
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    className="mt-5 w-full cursor-not-allowed rounded-xl bg-[#40311D]/20 px-4 py-3 text-sm font-bold text-[#40311D]/35"
                                >
                                    Pesan
                                </button>
                            )}
                        </div>
                    </section>
                </main>

                <PublicFooter />
            </div>
        </>
    );
}

function DoctorCard({
    doctor,
    schedule,
    todayQueue,
    selected,
    onSelect,
}: {
    doctor: ClinicDoctor;
    schedule?: PublicSchedule;
    todayQueue: PublicTodayQueue;
    selected: boolean;
    onSelect: () => void;
}) {
    const bookedSlots = todayQueue?.booked_slots ?? 0;
    const capacity = todayQueue?.max_slots ?? schedule?.max_patients_per_window ?? 0;
    const queueLabel = todayQueue ? `${todayQueue.window_start_time} - ${todayQueue.window_end_time}` : '-';

    return (
        <article
            className={[
                'w-[210px] shrink-0 rounded-xl border p-4 transition',
                selected ? 'border-[#00917B] bg-[#00917B]/5 shadow-sm' : 'border-[#40311D]/15 bg-[#40311D]/5',
            ].join(' ')}
        >
            <div className="h-[118px] overflow-hidden rounded-lg bg-[#40311D]/10">
                <DoctorImage imageUrl={doctor.image_url} name={doctor.name} />
            </div>
            <div className="mt-4">
                <h3 className="text-lg font-bold leading-tight text-[#40311D]">{doctor.name}</h3>
                <p className="mt-1 text-sm text-[#40311D]/55">{doctor.primary_speciality || 'Dokter umum'}</p>
            </div>

            <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#40311D]/35">Jam praktik</p>
                <p className="mt-1 text-xs text-[#40311D]/60">
                    Hari ini <strong className="text-[#40311D]">{schedule ? `${shortTime(schedule.start_time)} - ${shortTime(schedule.end_time)}` : 'Tidak praktik'}</strong>
                </p>
            </div>

            <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#40311D]/35">Antrean saat ini</p>
                <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-bold text-[#40311D]">{capacity > 0 ? `${bookedSlots}/${capacity}` : '-'}</span>
                    <QueueDots total={capacity} filled={bookedSlots} />
                </div>
                <p className="mt-1 text-xs text-[#40311D]/45">Antrean untuk jam {queueLabel}</p>
            </div>

            <button
                type="button"
                onClick={onSelect}
                className={`mt-4 w-full rounded-lg ${selected ? 'bg-[#00917B]' : 'bg-[#40311D]'} px-4 py-2.5 text-sm font-bold text-[#DED0B6] transition hover:bg-[#2c2115] `}
            >
                {selected ? 'Dokter dipilih' : 'Pilih dokter'}
            </button>
        </article>
    );
}

function ReservationStatusCard({ reservation, href }: { reservation: PublicCurrentReservation; href: string }) {
    if (reservation === null) {
        return (
            <aside className="rounded-xl border border-[#40311D]/15 bg-[#40311D]/5 p-5">
                <p className="text-sm text-[#40311D]/55">Reservasi mu saat ini</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#40311D]">Belum ada reservasi aktif</p>
                <p className="mt-3 text-sm text-[#40311D]/55">Cek halaman reservasi untuk melihat antrean dan booking aktif.</p>
                <Link href={href} className="mt-4 inline-flex rounded-lg bg-[#40311D] px-4 py-2 text-xs font-bold text-[#DED0B6] transition hover:bg-[#2c2115]">
                    Lihat reservasi
                </Link>
                <p className="mt-3 text-[11px] text-[#40311D]/40">*harap datang 20 menit sebelum waktu janji dimulai</p>
            </aside>
        );
    }

    return (
        <aside className="rounded-xl border border-[#40311D]/15 bg-[#40311D]/5 p-5">
            <p className="text-sm text-[#40311D]/55">Reservasi mu saat ini</p>
            <p className="mt-2 break-all text-3xl font-semibold tracking-[-0.03em] text-[#40311D]">{reservation.reservation_number}</p>
            <p className="mt-1 text-lg font-medium text-[#40311D]">SLOT NO.{reservation.window_slot_number ?? '-'}</p>
            <p className="mt-2 text-sm font-semibold text-[#40311D]/75">{reservation.doctor_name ?? 'Dokter belum tersedia'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-md bg-[#40311D] px-2 py-1 text-xs font-bold text-[#DED0B6]">{reservation.reservation_date}</span>
                <span className="rounded-md bg-[#40311D] px-2 py-1 text-xs font-bold text-[#DED0B6]">
                    {reservation.window_start_time ?? '-'} - {reservation.window_end_time ?? '-'}
                </span>
                <Link href={href}>
                    <FontAwesomeIcon icon={faChevronRight}/>
                </Link>
            </div>
            <p className="mt-3 text-[11px] text-[#40311D]/40">*harap datang 20 menit sebelum waktu janji dimulai</p>
        </aside>
    );
}

function OperatingHoursPopover({ clinic, onClose }: { clinic: PublicClinic; onClose: () => void }) {
    return (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 min-w-[240px] rounded-xl border border-[#40311D]/20 bg-[#DED0B6] p-4 shadow-xl shadow-[#40311D]/10">
            <button type="button" onClick={onClose} className="absolute right-3 top-2 text-lg text-[#40311D]/40 transition hover:text-[#40311D]">
                x
            </button>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#40311D]/40">Jadwal Operasional</p>
            {clinic.operating_hours.length === 0 ? (
                <p className="text-sm text-[#40311D]/55">Belum ada jam operasional.</p>
            ) : (
                <table className="w-full text-sm">
                    <tbody>
                        {clinic.operating_hours.map((hour) => (
                            <tr key={hour.id} className={matchesScheduleDay(hour.day_of_week, new Date().getDay()) ? 'font-bold text-[#00917B]' : 'text-[#40311D]/65'}>
                                <td className="py-1 pr-5">{hour.day_name}</td>
                                <td className="py-1">{hour.is_closed ? 'Tutup' : `${shortTime(hour.open_time)} - ${shortTime(hour.close_time)}`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {STEPS.map((step, index) => {
                const active = index === current;
                const completed = index < current;
                return (
                    <span key={step} className="inline-flex items-center gap-2">
                        <span
                            className={[
                                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold transition',
                                active ? 'border-[#00917B] bg-[#00917B] text-white' : 'border-[#40311D]/20 text-[#40311D]/35',
                                completed && !active ? 'border-[#40311D] bg-[#40311D] text-[#ded0b6]' : '',
                            ].join(' ')}
                        >
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px]">{index + 1}</span>
                            {step}
                        </span>
                        {index < STEPS.length - 1 ? <ChevronIcon className="h-3 w-3 text-[#40311D]/25" /> : null}
                    </span>
                );
            })}
        </div>
    );
}

function MiniCalendar({
    year,
    month,
    selected,
    onSelect,
    onPrev,
    onNext,
}: {
    year: number;
    month: number;
    selected: number | null;
    onSelect: (day: number) => void;
    onPrev: () => void;
    onNext: () => void;
}) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = (() => {
        const day = new Date(year, month, 1).getDay() - 1;

        return day < 0 ? 6 : day;
    })();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const blanks = Array.from({ length: firstDay });
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);

    return (
        <div className="min-w-[220px] select-none rounded-xl border border-[#40311D]/15 bg-[#DED0B6] p-3">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-[#40311D]">
                <button type="button" onClick={onPrev} className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-[#40311D]/10">
                    <ChevronIcon className="rotate-180" />
                </button>
                <span>
                    {MONTH_NAMES[month]} {year}
                </span>
                <button type="button" onClick={onNext} className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-[#40311D]/10">
                    <ChevronIcon />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
                {DAY_LABELS.map((label) => (
                    <div key={label} className="py-1 text-[10px] font-bold uppercase text-[#40311D]/40">
                        {label}
                    </div>
                ))}
                {blanks.map((_, index) => (
                    <div key={`blank-${index}`} />
                ))}
                {days.map((day) => {
                    const isToday = isCurrentMonth && day === today.getDate();
                    const isSelected = selected === day;
                    const isPast = isCurrentMonth && day < today.getDate();

                    return (
                        <button
                            key={day}
                            type="button"
                            disabled={isPast}
                            onClick={() => onSelect(day)}
                            className={[
                                'mx-auto flex aspect-square w-full items-center justify-center rounded-lg text-xs font-medium transition',
                                isSelected ? 'scale-110 bg-[#40311D] font-bold text-[#DED0B6] shadow-md shadow-[#40311D]/20' : '',
                                !isSelected && isToday ? 'border-2 border-[#00917B] font-bold text-[#00917B]' : '',
                                !isSelected && !isToday && !isPast ? 'text-[#40311D] hover:bg-[#40311D]/10' : '',
                                isPast ? 'cursor-not-allowed text-[#40311D]/20' : 'cursor-pointer',
                            ].join(' ')}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
            <div
                className={[
                    'mt-3 min-h-11 rounded-[10px] border p-3 transition',
                    selected ? 'border-[#40311D]/15 bg-[#40311D]/5' : 'border-transparent bg-transparent',
                ].join(' ')}
            >
                {selected ? (
                    <>
                        <p className="text-lg font-bold leading-tight text-[#40311D]">
                            {selected} {MONTH_NAMES[month]} {year}
                        </p>
                        <p className="mt-1 text-xs text-[#40311D]/50">Tanggal dipilih</p>
                    </>
                ) : (
                    <p className="text-xs text-[#40311D]/35">Pilih tanggal kunjungan</p>
                )}
            </div>
        </div>
    );
}

function TimeSlotGroup({
    label,
    slots,
    selectedSlot,
    onSelectSlot,
}: {
    label: string;
    slots: WindowSlot[];
    selectedSlot: WindowSlot | null;
    onSelectSlot: (slot: WindowSlot) => void;
}) {
    return (
        <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#40311D]/35">{label}</p>
            <div className="space-y-2">
                {slots.map((slot) => {
                    const remaining = Math.max(slot.filled, 0);
                    const selected = selectedSlot?.id === slot.id;
                    return (
                        <button
                            key={slot.id}
                            type="button"
                            onClick={() => onSelectSlot(slot)}
                            className={[
                                'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition',
                                selected ? 'border-[#00917B] bg-[#00917B]/10 text-[#40311D]' : 'border-[#40311D]/10 bg-[#DED0B6]/50 text-[#40311D]/60 hover:border-[#00917B]/40',
                            ].join(' ')}
                        >
                            <span>{slot.label}</span>
                            <span className="rounded-full bg-[#40311D]/10 px-2 py-0.5 text-xs font-bold text-[#40311D]/55">
                                {remaining}/{slot.total}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function PatientField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#40311D]/35">{label} /</p>
            <input
                value={value}
                readOnly
                className="w-full border-0 border-b border-[#40311D]/15 bg-transparent px-0 py-1 text-sm text-[#40311D]/65 outline-none"
            />
        </div>
    );
}

function ContactBlock({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
    return (
        <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#40311D]/45">{label}</p>
            <div className="flex items-center gap-2 text-base text-[#40311D]">
                {icon}
                <span>{value}</span>
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: ReactNode }) {
    return <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#40311D]/35">{children}</p>;
}

function QueueDots({ total, filled }: { total: number; filled: number }) {
    const safeTotal = Math.min(Math.max(total, 0), 6);

    return (
        <span className="flex gap-1">
            {Array.from({ length: safeTotal }, (_, index) => (
                <span key={index} className={['h-3 w-3 rounded-full border border-[#40311D]/25', index < filled ? 'bg-[#40311D]' : 'bg-transparent'].join(' ')} />
            ))}
        </span>
    );
}

function dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodaySchedule(doctor: ClinicDoctor, fallbackSchedules: PublicSchedule[]) {
    const schedules = doctor.schedules ?? fallbackSchedules.filter((schedule) => schedule.doctor_id === doctor.id);
    const today = new Date().getDay();

    return schedules.find((schedule) => schedule.is_active && matchesScheduleDay(schedule.day_of_week, today));
}

function generateWindows(schedule: PublicSchedule, selectedDate: Date, windowUsage: PublicWindowUsage[]): WindowSlot[] {
    const start = timeToMinutes(schedule.start_time);
    const end = timeToMinutes(schedule.end_time);
    const duration = Math.max(schedule.window_minutes || 30, 1);
    const windows: WindowSlot[] = [];
    const selectedDateKey = dateKey(selectedDate);

    for (let cursor = start, index = 1; cursor + duration <= end; cursor += duration, index += 1) {
        const slotStart = minutesToTime(cursor);
        const slotEnd = minutesToTime(cursor + duration);
        const usage = windowUsage.find((item) => item.schedule_id === schedule.id && item.reservation_date === selectedDateKey && item.window_start_time === slotStart);

        windows.push({
            id: `${schedule.id}-${index}`,
            label: `${slotStart} - ${slotEnd}`,
            start: slotStart,
            end: slotEnd,
            filled: usage?.booked_slots ?? 0,
            total: schedule.max_patients_per_window,
        });
    }

    return windows;
}

function groupSlots(slots: WindowSlot[]) {
    const morning = slots.filter((slot) => timeToMinutes(slot.start) < 12 * 60);
    const afternoon = slots.filter((slot) => timeToMinutes(slot.start) >= 12 * 60);
    const groups: { label: string; slots: WindowSlot[] }[] = [];

    if (morning.length > 0) {
        groups.push({ label: 'Pagi - Siang', slots: morning });
    }

    if (afternoon.length > 0) {
        groups.push({ label: 'Siang - Sore', slots: afternoon });
    }

    return groups;
}

function matchesScheduleDay(scheduleDay: number, jsDay: number) {
    return scheduleDay === jsDay || (jsDay === 0 && scheduleDay === 7);
}

function timeToMinutes(time: string) {
    const [hour = '0', minute = '0'] = shortTime(time).split(':');

    return Number(hour) * 60 + Number(minute);
}

function minutesToTime(totalMinutes: number) {
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function shortTime(time?: string | null) {
    return time ? time.slice(0, 5) : '-';
}

function ChevronIcon({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={['h-4 w-4 transition-transform', className].join(' ')}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

function LocationIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-1 h-4 w-4 shrink-0 opacity-45">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

function PhoneIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 opacity-45">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.07 9.6 19.79 19.79 0 0 1 .4 1.07 2 2 0 0 1 2.38.73h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L6.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
        </svg>
    );
}

function MailIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 opacity-45">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    );
}
