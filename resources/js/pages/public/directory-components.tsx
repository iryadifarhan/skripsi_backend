import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faEnvelope, faFilter, faHospital, faLocationDot, faMagnifyingGlass, faPhone, faUser, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Link, usePage } from '@inertiajs/react';
import type { IconDefinition, SizeProp } from '@fortawesome/fontawesome-svg-core';
import type { ReactNode } from 'react';

import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import type { SharedData } from '@/types';

export type TimeRange = {
    day_of_week: number;
    day_name: string;
    start_time: string | null;
    end_time: string | null;
    start_minutes: number;
    end_minutes: number;
};

export type PublicSchedule = {
    id: number;
    clinic_id: number;
    doctor_id: number;
    day_of_week: number;
    day_name: string;
    start_time: string;
    end_time: string;
    window_minutes: number;
    max_patients_per_window: number;
    total_windows: number;
    estimated_capacity: number;
    is_active: boolean;
    clinic?: {
        id: number;
        slug: string;
        name: string;
    } | null;
    doctor?: {
        id: number;
        slug: string;
        name: string;
        image_url?: string | null;
    } | null;
};

export type PublicDoctorSummary = {
    id: number;
    slug: string;
    name: string;
    email?: string | null;
    phone_number?: string | null;
    image_url?: string | null;
    specialities: string[];
    primary_speciality: string;
};

export type PublicWindowUsage = {
    schedule_id: number;
    doctor_id: number;
    clinic_id: number;
    reservation_date: string;
    window_start_time: string;
    booked_slots: number;
    slot_numbers_used: number[];
};

export type PublicTodayQueue = {
    schedule_id: number;
    date: string;
    window_start_time: string;
    window_end_time: string;
    booked_slots: number;
    available_slots: number;
    max_slots: number;
    slot_numbers_used: number[];
} | null;

export type PublicCurrentReservation = {
    id: number;
    reservation_number: string;
    doctor_name?: string | null;
    reservation_date: string;
    window_start_time?: string | null;
    window_end_time?: string | null;
    window_slot_number?: number | null;
    queue_number?: number | null;
    status: string;
    queue_status?: string | null;
} | null;

export type PublicClinic = {
    id: number;
    slug: string;
    name: string;
    address?: string | null;
    city_name?: string | null;
    location?: string | null;
    phone_number?: string | null;
    email?: string | null;
    image_url?: string | null;
    specialities: string[];
    doctor_count: number;
    status_label: string;
    is_open_now: boolean;
    operational_label: string;
    hours_label: string;
    time_ranges: TimeRange[];
    operating_hours: {
        id: number;
        day_of_week: number;
        day_name: string;
        open_time: string | null;
        close_time: string | null;
        is_closed: boolean;
    }[];
    schedules: PublicSchedule[];
    window_usage: PublicWindowUsage[];
    current_reservation: PublicCurrentReservation;
    doctors: PublicDoctorSummary[];
};

export type PublicDoctor = PublicDoctorSummary & {
    username: string;
    status_label: string;
    is_available_today: boolean;
    today_queue: PublicTodayQueue;
    window_usage: PublicWindowUsage[];
    current_reservation: PublicCurrentReservation;
    operational_label: string;
    hours_label: string;
    time_ranges: TimeRange[];
    clinics: {
        id: number;
        slug: string;
        name: string;
        address?: string | null;
        city_name?: string | null;
        location?: string | null;
        phone_number?: string | null;
        email?: string | null;
        image_url?: string | null;
        specialities: string[];
    }[];
    schedules: PublicSchedule[];
};

export type DirectoryFilters = {
    cities: string[];
    specialities: string[];
};

export const timeFilters = [
    { value: 'all', label: 'Semua Waktu' },
    { value: 'morning', label: 'Pagi', from: 6 * 60, to: 12 * 60 },
    { value: 'afternoon', label: 'Siang', from: 12 * 60, to: 17 * 60 },
    { value: 'evening', label: 'Sore', from: 17 * 60, to: 21 * 60 },
    { value: 'night', label: 'Malam', from: 21 * 60, to: 24 * 60 },
    { value: '24h', label: '24 Jam' },
    { value: 'everyday', label: 'Setiap Hari' },
    { value: 'holiday', label: 'Hari Libur' },
] as const;

export type TimeFilterValue = (typeof timeFilters)[number]['value'];

export const loginNext = (path: string) => `/masuk?next=${encodeURIComponent(path)}`;

export function useReservationHref(path: string, reservationPath: string) {
    const { auth } = usePage<SharedData>().props;
    const isPatient = auth?.user?.role === 'patient';

    return isPatient ? reservationPath : loginNext(path);
}

export function DirectoryLayout({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#DED0B6] text-[#40311D]">
            <PublicNavbar />
            <main>
                <section className="border-b border-[#40311D]/10 bg-[#DED0B6] px-5 py-12 sm:px-8 lg:px-12">
                    <div className="mx-auto max-w-[1400px]">
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#00917B]">CliniQueue Directory</p>
                        <h1 className="text-4xl font-black tracking-[-0.04em] text-[#40311D] md:text-6xl">{title}</h1>
                    </div>
                </section>
                {children}
            </main>
            <PublicFooter />
        </div>
    );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-[#40311D]/15 bg-white/80 px-4 py-3 shadow-sm">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4 text-[#40311D]/35" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-[#40311D] outline-none placeholder:text-[#40311D]/35"
                type="search"
            />
        </div>
    );
}

export function FilterButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#40311D]/15 bg-white px-4 py-3 text-sm font-bold text-[#40311D] shadow-sm lg:hidden"
        >
            <FontAwesomeIcon icon={faFilter} />
            Filter
        </button>
    );
}

export function FilterPanel({
    cities,
    specialities,
    city,
    speciality,
    time,
    onCityChange,
    onSpecialityChange,
    onTimeChange,
    onReset,
}: {
    cities: string[];
    specialities: string[];
    city: string;
    speciality: string;
    time: TimeFilterValue;
    onCityChange: (value: string) => void;
    onSpecialityChange: (value: string) => void;
    onTimeChange: (value: TimeFilterValue) => void;
    onReset: () => void;
}) {
    return (
        <aside className="rounded-3xl border border-[#40311D]/10 bg-white/85 p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <p className="text-base font-extrabold text-[#40311D]">Filter</p>
                    <p className="text-xs text-[#40311D]/45">Kota, spesialis, dan waktu</p>
                </div>
                <button type="button" onClick={onReset} className="text-xs font-bold text-[#00917B]">
                    Reset
                </button>
            </div>

            <div className="space-y-5">
                <SelectFilter label="Kota" value={city} options={cities} emptyLabel="Semua Kota" onChange={onCityChange} />
                <SelectFilter label="Spesialis" value={speciality} options={specialities} emptyLabel="Semua Spesialis" onChange={onSpecialityChange} />

                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#40311D]/45">Waktu</p>
                    <div className="flex flex-wrap gap-2">
                        {timeFilters.map((filter) => (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => onTimeChange(filter.value)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    time === filter.value
                                        ? 'border-[#40311D] bg-[#40311D] text-[#DED0B6]'
                                        : 'border-[#40311D]/15 bg-white text-[#40311D]/65 hover:border-[#40311D]/30 hover:text-[#40311D]'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
}

function SelectFilter({
    label,
    value,
    options,
    emptyLabel,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    emptyLabel: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#40311D]/45">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-2xl border border-[#40311D]/15 bg-white px-4 py-3 text-sm text-[#40311D] outline-none transition focus:border-[#00917B]"
            >
                <option value="">{emptyLabel}</option>
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function FilterModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-[#2c2115]/40 p-4 lg:hidden" onClick={onClose}>
            <div className="ml-auto h-full max-w-sm overflow-y-auto rounded-3xl bg-[#DFE0DF] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="mb-4 flex justify-end">
                    <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#40311D]">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function ClinicImage({ imageUrl, name, className = '', iconSize = "2x"}: { imageUrl?: string | null; name: string; className?: string; iconSize?: SizeProp }) {
    if (imageUrl) {
        return <img src={imageUrl} alt={name} className={`h-full w-full object-cover ${className}`} />;
    }

    return (
        <div className={`flex h-full w-full items-center justify-center bg-[#40311d1a] text-[#40311D]/30 ${className}`}>
            <FontAwesomeIcon icon={faHospital} size={iconSize} />
        </div>
    );
}

export function DoctorImage({ imageUrl, name, className = '' }: { imageUrl?: string | null; name: string; className?: string }) {
    if (imageUrl) {
        return <img src={imageUrl} alt={name} className={`h-full w-full object-cover ${className}`} />;
    }

    return (
        <div className={`flex h-full w-full items-center justify-center bg-[#DFE0DF] text-[#40311D]/30 ${className}`}>
            <FontAwesomeIcon icon={faUser} className="h-12 w-12" />
        </div>
    );
}

export function InfoLine({ icon, children }: { icon: IconDefinition; children: ReactNode }) {
    return (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-[#40311D]/62">
            <FontAwesomeIcon icon={icon} className="mt-1 h-3.5 w-3.5 shrink-0 text-[#00917B]" />
            <span>{children}</span>
        </p>
    );
}

export function ContactLines({ location, phone, email }: { location?: string | null; phone?: string | null; email?: string | null }) {
    return (
        <div className="space-y-2">
            {location ? <InfoLine icon={faLocationDot}>{location}</InfoLine> : null}
            {phone ? <InfoLine icon={faPhone}>{phone}</InfoLine> : null}
            {email ? <InfoLine icon={faEnvelope}>{email}</InfoLine> : null}
        </div>
    );
}

export function StatusBadge({ active, children }: { active?: boolean; children: ReactNode }) {
    return (
        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-[#e8fff8] text-[#00836f]' : 'bg-[#40311D]/8 text-[#40311D]/55'}`}>
            {children}
        </span>
    );
}

export function Tags({ items, limit = 4 }: { items: string[]; limit?: number }) {
    const visible = items.slice(0, limit);
    const remaining = items.length - visible.length;

    if (items.length === 0) {
        return <span className="text-xs text-[#40311D]/35">Belum ada spesialisasi</span>;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {visible.map((item) => (
                <span key={item} className="rounded-full bg-[#40311D]/7 px-3 py-1 text-xs font-semibold text-[#40311D]/70">
                    {item}
                </span>
            ))}
            {remaining > 0 ? <span className="rounded-full bg-[#00917B]/10 px-3 py-1 text-xs font-bold text-[#00917B]">+{remaining}</span> : null}
        </div>
    );
}

export function EmptyDirectory({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-3xl border border-dashed border-[#40311D]/15 p-10 text-center text-sm text-[#40311D]/50">
            {children}
        </div>
    );
}

export function ScheduleTable({ schedules }: { schedules: PublicSchedule[] }) {
    if (schedules.length === 0) {
        return <EmptyDirectory>Jadwal belum tersedia.</EmptyDirectory>;
    }

    return (
        <div className="overflow-x-auto rounded-3xl border border-[#40311D]/10 bg-white/85">
            <table className="w-full min-w-[780px] border-collapse text-sm">
                <thead>
                    <tr className="border-b border-[#40311D]/10 bg-[#faf9f7] text-left text-xs uppercase tracking-widest text-[#40311D]/40">
                        <th className="px-5 py-4">Hari</th>
                        <th className="px-5 py-4">Jam</th>
                        <th className="px-5 py-4">Window</th>
                        <th className="px-5 py-4">Kapasitas</th>
                        <th className="px-5 py-4">Klinik/Dokter</th>
                    </tr>
                </thead>
                <tbody>
                    {schedules.map((schedule) => (
                        <tr key={schedule.id} className="border-b border-[#40311D]/8 last:border-0">
                            <td className="px-5 py-4 font-bold text-[#40311D]">{schedule.day_name}</td>
                            <td className="px-5 py-4 text-[#40311D]/70">{schedule.start_time} - {schedule.end_time}</td>
                            <td className="px-5 py-4 text-[#40311D]/70">{schedule.window_minutes} menit</td>
                            <td className="px-5 py-4 text-[#40311D]/70">{schedule.estimated_capacity} pasien</td>
                            <td className="px-5 py-4 text-[#40311D]/70">{schedule.clinic?.name ?? schedule.doctor?.name ?? '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function matchesText(search: string, values: Array<string | null | undefined>) {
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch === '') {
        return true;
    }

    return values.some((value) => (value ?? '').toLowerCase().includes(normalizedSearch));
}

export function matchesCity(city: string, values: Array<string | null | undefined>) {
    if (city === '') {
        return true;
    }

    return values.some((value) => (value ?? '').toLowerCase() === city.toLowerCase());
}

export function matchesSpeciality(speciality: string, specialities: string[]) {
    if (speciality === '') {
        return true;
    }

    return specialities.some((value) => value.toLowerCase() === speciality.toLowerCase());
}

export function matchesTime(time: TimeFilterValue, ranges: TimeRange[]) {
    if (time === 'all') {
        return true;
    }

    if (ranges.length === 0) {
        return false;
    }

    if (time === '24h') {
        return ranges.some((range) => range.end_minutes - range.start_minutes >= 23 * 60 || (range.start_minutes === 0 && range.end_minutes >= 23 * 60 + 59));
    }

    if (time === 'everyday') {
        return new Set(ranges.map((range) => range.day_of_week)).size === 7;
    }

    if (time === 'holiday') {
        return ranges.some((range) => range.day_of_week === 0);
    }

    const preset = timeFilters.find((filter) => filter.value === time);

    if (!preset || !('from' in preset) || !('to' in preset)) {
        return true;
    }

    return ranges.some((range) => range.start_minutes < preset.to && range.end_minutes > preset.from);
}

export function ContactIconRow({ icon, label }: { icon: IconDefinition; label: ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-sm text-[#40311D]/60">
            <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5 text-[#00917B]" />
            <span>{label}</span>
        </div>
    );
}
