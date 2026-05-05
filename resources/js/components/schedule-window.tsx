import type { ReactNode } from 'react';

import {
    scheduleWindowMinutePresets,
    type ScheduleWindowForm,
    type ScheduleWindowPreview,
} from '@/lib/schedule-window';

export function ScheduleWindowPresetControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <div className="col-span-2 flex flex-col gap-1 text-[11px] text-[#40311D]">
            Durasi/window
            <div className="grid grid-cols-4 gap-2">
                {scheduleWindowMinutePresets.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => onChange(preset)}
                        className={`rounded-lg border px-3 py-2 text-[12px] transition-colors ${
                            value === preset
                                ? 'border-[#40311D] bg-[#40311D] font-medium text-white'
                                : 'border-gray-300 bg-white text-gray-600 hover:bg-[#faf9f7]'
                        }`}
                    >
                        {preset} menit
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ScheduleWindowPreviewPanel({ preview }: { preview: ScheduleWindowPreview }) {
    return (
        <div className="rounded-xl border border-[#e4ddd4] bg-[#faf9f7]">
            <div className="flex flex-col gap-2 border-b border-[#e4ddd4] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[12px] font-medium text-[#40311D]">Preview window reservasi</p>
                    <p className="text-[11px] text-gray-400">
                        {preview.windows.length} window, estimasi {preview.totalCapacity} pasien
                    </p>
                </div>
                {preview.isValid ? (
                    <span className="w-fit rounded-full bg-teal-50 px-3 py-1 text-[11px] font-medium text-teal-700">Valid</span>
                ) : (
                    <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-[11px] font-medium text-red-600">Perlu cek</span>
                )}
            </div>
            {preview.message ? (
                <p className="border-b border-[#e4ddd4] bg-red-50 px-3 py-2 text-[11px] text-red-600">
                    {preview.message}
                </p>
            ) : null}
            {preview.windows.length === 0 ? (
                <p className="px-3 py-4 text-[12px] italic text-gray-400">Window belum bisa ditampilkan.</p>
            ) : (
                <div className="max-h-48 overflow-y-auto">
                    <table className="w-full border-collapse text-[12px]">
                        <thead>
                            <tr className="border-b border-[#e4ddd4] bg-white/60">
                                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400">No</th>
                                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400">Window</th>
                                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400">Kapasitas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.windows.map((window) => (
                                <tr key={window.number} className="border-b border-[#ede8e2] last:border-0">
                                    <td className="px-3 py-2 text-gray-700">{String(window.number).padStart(2, '0')}</td>
                                    <td className="px-3 py-2 text-gray-700">{window.start_time} - {window.end_time}</td>
                                    <td className="px-3 py-2 text-gray-700">{window.capacity} pasien</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export function ScheduleWindowCompactSummary({
    windowMinutes,
    capacity,
    preview,
    onOpen,
    actionLabel = 'Atur Window',
    displayTotal = true,
}: {
    windowMinutes: string | number;
    capacity: string | number;
    preview: ScheduleWindowPreview;
    onOpen?: () => void;
    actionLabel?: string;
    displayTotal?: boolean;
}) {
    return (
        <div className="flex min-w-44 flex-col gap-1 text-[11px]">
            <p className="text-gray-600"><strong>Durasi:</strong> {windowMinutes} menit/window</p>
            <p className="text-gray-600"><strong>Kapasitas:</strong> {capacity} pasien/window</p>
            {displayTotal ? <p className={preview.isValid ? 'text-teal-700' : 'text-red-600'}>
                Total: {preview.windows.length} window, {preview.totalCapacity} pasien
            </p> : null}
            {preview.message ? <p className="max-w-56 text-[10px] text-red-600">{preview.message}</p> : null}
            {onOpen ? (
                <button
                    type="button"
                    onClick={onOpen}
                    className="mt-1 w-fit rounded-lg border border-[#e4ddd4] bg-white px-3 py-1.5 text-[11px] font-medium text-[#40311D] transition-colors hover:bg-[#faf9f7]"
                >
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}

export function ScheduleWindowSettingsModal({
    title = 'Atur Window Jadwal',
    subtitle,
    form,
    preview,
    onChange,
    onClose,
    onApply,
}: {
    title?: string;
    subtitle?: ReactNode;
    form: ScheduleWindowForm;
    preview: ScheduleWindowPreview;
    onChange: (form: ScheduleWindowForm) => void;
    onClose: () => void;
    onApply: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[15px] font-medium text-[#40311D]">{title}</p>
                            {subtitle ? <p className="mt-1 text-[12px] text-gray-400">{subtitle}</p> : null}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-500 transition-colors hover:bg-[#DFE0DF]"
                        >
                            x
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    <ScheduleWindowPresetControl
                        value={form.window_minutes}
                        onChange={(value) => onChange({ ...form, window_minutes: value })}
                    />

                    <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                        Kapasitas/window
                        <input
                            type="number"
                            value={form.max_patients_per_window}
                            onChange={(event) => onChange({ ...form, max_patients_per_window: event.target.value })}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
                        />
                    </label>

                    <ScheduleWindowPreviewPanel preview={preview} />
                </div>

                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition-colors hover:bg-[#DFE0DF]"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={!preview.isValid}
                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                    >
                        Terapkan
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ScheduleWindowReadonlyModal({
    title = 'Preview Window Jadwal',
    subtitle,
    windowMinutes,
    capacity,
    preview,
    onClose,
}: {
    title?: string;
    subtitle?: ReactNode;
    windowMinutes: string | number;
    capacity: string | number;
    preview: ScheduleWindowPreview;
    onClose: () => void;
}) {
    const selectedWindowMinutes = String(windowMinutes);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[15px] font-medium text-[#40311D]">{title}</p>
                            {subtitle ? <p className="mt-1 text-[12px] text-gray-400">{subtitle}</p> : null}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-500 transition-colors hover:bg-[#DFE0DF]"
                        >
                            x
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    <div className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                        Durasi/window
                        <div className="grid grid-cols-4 gap-2">
                            {scheduleWindowMinutePresets.map((preset) => (
                                <div
                                    key={preset}
                                    className={`rounded-lg border px-3 py-2 text-center text-[12px] ${
                                        selectedWindowMinutes === preset
                                            ? 'border-[#40311D] bg-[#40311D] font-medium text-white'
                                            : 'border-gray-300 bg-white text-gray-500'
                                    }`}
                                >
                                    {preset} menit
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                        Kapasitas/window
                        <input
                            type="text"
                            value={capacity}
                            readOnly
                            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-[12px] text-gray-700 outline-none"
                        />
                    </label>

                    <ScheduleWindowPreviewPanel preview={preview} />
                </div>

                <div className="flex justify-end border-t border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115]"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
