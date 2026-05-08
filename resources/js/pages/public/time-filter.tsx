import { useEffect, useRef, useState } from 'react';

import type { TimeRange } from '@/pages/public/directory-components';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export type PublicTimeFilterState = {
    from: number;
    to: number;
    h24: boolean;
    everyday: boolean;
    holiday: boolean;
};

export const defaultPublicTimeFilter: PublicTimeFilterState = {
    from: 0,
    to: 24,
    h24: false,
    everyday: false,
    holiday: false,
};

const presets = [
    { label: 'Pagi (06-12)', from: 6, to: 12 },
    { label: 'Siang (12-17)', from: 12, to: 17 },
    { label: 'Sore (17-21)', from: 17, to: 21 },
    { label: 'Malam (21-24)', from: 21, to: 24 },
];

export function isDefaultPublicTimeFilter(filter: PublicTimeFilterState) {
    return filter.from === 0 && filter.to === 24 && !filter.h24 && !filter.everyday && !filter.holiday;
}

export function matchesPublicTimeFilter(filter: PublicTimeFilterState, ranges: TimeRange[]) {
    if (isDefaultPublicTimeFilter(filter)) {
        return true;
    }

    if (ranges.length === 0) {
        return false;
    }

    if (filter.h24 && !ranges.some(isTwentyFourHours)) {
        return false;
    }

    if (filter.everyday && new Set(ranges.map((range) => range.day_of_week)).size !== 7) {
        return false;
    }

    if (filter.holiday && !ranges.some((range) => range.day_of_week === 0)) {
        return false;
    }

    if (filter.from === 0 && filter.to === 24) {
        return true;
    }

    const fromMinutes = filter.from * 60;
    const toMinutes = filter.to * 60;

    return ranges.some((range) => range.start_minutes < toMinutes && range.end_minutes > fromMinutes);
}

export function PublicTimePicker({
    value,
    onChange,
    onReset,
}: {
    value: PublicTimeFilterState;
    onChange: (value: PublicTimeFilterState) => void;
    onReset: () => void;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const active = !isDefaultPublicTimeFilter(value);

    useEffect(() => {
        if (!open) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        window.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    const update = (patch: Partial<PublicTimeFilterState>) => onChange({ ...value, ...patch });

    return (
        <div ref={containerRef} className="relative">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    className={`inline-flex items-center gap-1 rounded-full p-2 text-xs font-bold transition ${
                        active ? 'bg-[#40311D] text-[#DED0B6]' : 'border border-[#40311D]/20 bg-transparent'
                    }`}
                >
                    {value.from === 0 && value.to === 24 ? 'Semua waktu' : `${formatHour(value.from)} -> ${formatHour(value.to)}`}
                    <FontAwesomeIcon icon={faChevronUp} className={`mt-0.5 text-[10px] transition ${open ? 'rotate-180' : ''}`} />
                </button>

                {active ? (
                    <button type="button" onClick={onReset} className="text-xs font-semibold text-[#40311D]/35 transition hover:text-[#40311D]">
                        Reset
                    </button>
                ) : null}
            </div>

            {open ? (
                <div className="time-popup absolute left-0 top-[calc(100%+0.45rem)] z-[80] w-[172px] rounded-xl border border-[#40311D]/15 bg-[#DED0B6] p-3 text-[#40311D] shadow-[0_12px_30px_rgba(64,49,29,0.14)]">
                    <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#40311D]/45">Jam buka - tutup</p>

                    <div className="mb-3 flex items-center gap-2">
                        <HourInput value={value.from} min={0} max={23} onChange={(from) => update({ from })} />
                        <span className="text-xs font-bold text-[#40311D]/35">{'->'}</span>
                        <HourInput value={value.to} min={1} max={24} onChange={(to) => update({ to })} />
                    </div>

                    <div className="mb-3 space-y-1.5">
                        {presets.map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => update({ from: preset.from, to: preset.to })}
                                className="block rounded-full border border-[#40311D]/20 px-2.5 py-1 text-[11px] font-bold transition hover:bg-[#40311D]/8"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2 border-t border-[#40311D]/10 pt-3">
                        <TimeCheckbox label="24 Jam" checked={value.h24} onChange={(h24) => update({ h24 })} />
                        <TimeCheckbox label="Setiap Hari" checked={value.everyday} onChange={(everyday) => update({ everyday })} />
                        <TimeCheckbox label="Hari Libur" checked={value.holiday} onChange={(holiday) => update({ holiday })} />
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function HourInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (value: number) => void }) {
    return (
        <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(event) => onChange(Math.min(max, Math.max(min, Number.parseInt(event.target.value, 10) || min)))}
            className="h-8 w-[54px] rounded-full border border-[#40311D]/20 bg-transparent text-center text-xs font-black outline-none transition focus:border-[#00917B] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
    );
}

function TimeCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 rounded border-[#40311D]/25 accent-[#40311D]" />
            {label}
        </label>
    );
}

function formatHour(hour: number) {
    return `${String(hour).padStart(2, '0')}:00`;
}

function isTwentyFourHours(range: TimeRange) {
    return range.end_minutes - range.start_minutes >= 23 * 60 || (range.start_minutes === 0 && range.end_minutes >= 23 * 60 + 59);
}
