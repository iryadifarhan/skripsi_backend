import { Head, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import {
    ScheduleWindowCompactSummary,
    ScheduleWindowPresetControl,
    ScheduleWindowPreviewPanel,
    ScheduleWindowSettingsModal,
} from '@/components/schedule-window';
import { ClinicSelector } from '@/components/clinic-selector';
import AppLayout from '@/layouts/app-layout';
import { buildScheduleWindowPreview, estimateScheduleCapacity, type ScheduleWindowForm } from '@/lib/schedule-window';
import type { ClinicDetail, DoctorClinicScheduleEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type DoctorSchedulesPageProps = {
    context: WorkspaceContext;
    doctorId: number;
    selectedClinicId: number | null;
    clinic: ClinicDetail | null;
    schedules: DoctorClinicScheduleEntry[];
};

type ScheduleForm = {
    day_of_week: string[];
    start_time: string;
    end_time: string;
    window_minutes: string;
    max_patients_per_window: string;
};

type ScheduleEditForm = {
    start_time: string;
    end_time: string;
    window_minutes: string;
    max_patients_per_window: string;
    is_active: boolean;
};

type OperatingHourEntry = NonNullable<ClinicDetail['operating_hours']>[number];

const dayOptions = [
    { value: '1', label: 'Senin', short: 'Sen' },
    { value: '2', label: 'Selasa', short: 'Sel' },
    { value: '3', label: 'Rabu', short: 'Rab' },
    { value: '4', label: 'Kamis', short: 'Kam' },
    { value: '5', label: 'Jumat', short: 'Jum' },
    { value: '6', label: 'Sabtu', short: 'Sab' },
    { value: '0', label: 'Minggu', short: 'Min' },
];

const dayLabels = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

type PageProps = SharedData & {
    errors?: Record<string, string>;
};

export default function DoctorSchedulesPage({ context, doctorId, selectedClinicId, clinic, schedules }: DoctorSchedulesPageProps) {
    const page = usePage<PageProps>();
    const { flash } = page.props;
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [localStatus, setLocalStatus] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
        day_of_week: [],
        start_time: '09:00',
        end_time: '12:00',
        window_minutes: '30',
        max_patients_per_window: '4',
    });
    const [scheduleEdits, setScheduleEdits] = useState<Record<number, ScheduleEditForm>>(() =>
        Object.fromEntries(schedules.map((schedule) => [schedule.id, scheduleToEditForm(schedule)])),
    );
    const [windowModalScheduleId, setWindowModalScheduleId] = useState<number | null>(null);
    const [windowModalForm, setWindowModalForm] = useState<ScheduleWindowForm>({
        window_minutes: '30',
        max_patients_per_window: '4',
    });

    const scheduledDays = useMemo(() => new Set(schedules.map((schedule) => String(schedule.day_of_week))), [schedules]);
    const operatingHoursByDay = useMemo(() => new Map((clinic?.operating_hours ?? []).map((hour) => [String(hour.day_of_week), hour])), [clinic?.operating_hours]);
    const activeSchedules = schedules.filter((schedule) => schedule.is_active);
    const inactiveSchedules = schedules.filter((schedule) => !schedule.is_active);
    const estimatedTotalCapacity = activeSchedules.reduce((total, schedule) => total + estimatedCapacity(schedule), 0);
    const createWindowPreview = useMemo(
        () => buildScheduleWindowPreview(scheduleForm.start_time, scheduleForm.end_time, scheduleForm.window_minutes, scheduleForm.max_patients_per_window),
        [scheduleForm.start_time, scheduleForm.end_time, scheduleForm.window_minutes, scheduleForm.max_patients_per_window],
    );
    const changedSchedules = useMemo(
        () => schedules.filter((schedule) => !sameScheduleEdit(scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule), scheduleToEditForm(schedule))),
        [scheduleEdits, schedules],
    );
    const changedScheduleWarnings = useMemo<Record<number, string>>(() => {
        const warnings: Record<number, string> = {};

        for (const schedule of changedSchedules) {
            const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);
            const preview = buildScheduleWindowPreview(edit.start_time, edit.end_time, edit.window_minutes, edit.max_patients_per_window);

            if (!preview.isValid) {
                warnings[schedule.id] = preview.message ?? 'Window jadwal tidak valid.';
            }
        }

        return warnings;
    }, [changedSchedules, scheduleEdits]);
    const firstChangedScheduleWarning = Object.values(changedScheduleWarnings)[0] ?? null;
    const windowModalSchedule = schedules.find((schedule) => schedule.id === windowModalScheduleId) ?? null;
    const windowModalEdit = windowModalSchedule === null ? null : (scheduleEdits[windowModalSchedule.id] ?? scheduleToEditForm(windowModalSchedule));
    const windowModalPreview = windowModalEdit === null
        ? null
        : buildScheduleWindowPreview(windowModalEdit.start_time, windowModalEdit.end_time, windowModalForm.window_minutes, windowModalForm.max_patients_per_window);

    useEffect(() => {
        const usedDays = new Set(schedules.map((schedule) => String(schedule.day_of_week)));

        setScheduleEdits(Object.fromEntries(schedules.map((schedule) => [schedule.id, scheduleToEditForm(schedule)])));
        setWindowModalScheduleId((current) => (current !== null && schedules.some((schedule) => schedule.id === current) ? current : null));
        setScheduleForm((current) => {
            const availableDays = current.day_of_week.filter((day) => !usedDays.has(day));

            return availableDays.length === current.day_of_week.length ? current : { ...current, day_of_week: availableDays };
        });
    }, [schedules]);

    const createSchedule = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (selectedClinicId === null || scheduleForm.day_of_week.length === 0) {
            return;
        }

        if (!createWindowPreview.isValid) {
            setErrors({ window_minutes: [createWindowPreview.message ?? 'Window jadwal tidak valid.'] });
            return;
        }

        setProcessing(true);
        setErrors({});
        setLocalStatus(null);

        router.post(
            '/clinic/schedules',
            {
                clinic_id: selectedClinicId,
                doctor_id: doctorId,
                day_of_week: scheduleForm.day_of_week,
                start_time: withSeconds(scheduleForm.start_time),
                end_time: withSeconds(scheduleForm.end_time),
                window_minutes: scheduleForm.window_minutes,
                max_patients_per_window: scheduleForm.max_patients_per_window,
            },
            {
                preserveScroll: true,
                onError: (validationErrors) => setErrors(normalizeInertiaErrors(validationErrors)),
                onSuccess: () => setScheduleForm((current) => ({ ...current, day_of_week: [] })),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const saveScheduleChanges = async () => {
        if (selectedClinicId === null || changedSchedules.length === 0) {
            return;
        }

        if (firstChangedScheduleWarning !== null) {
            setErrors({ schedule: [firstChangedScheduleWarning] });
            return;
        }

        setProcessing(true);
        setErrors({});
        setLocalStatus(null);

        for (const schedule of changedSchedules) {
            const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);
            const result = await requestJson(`/clinic/schedules/${schedule.id}`, 'PATCH', {
                clinic_id: selectedClinicId,
                start_time: withSeconds(edit.start_time),
                end_time: withSeconds(edit.end_time),
                window_minutes: edit.window_minutes,
                max_patients_per_window: edit.max_patients_per_window,
                is_active: edit.is_active,
            });

            if (!result.ok) {
                setErrors(result.errors ?? { schedule: [result.message ?? 'Gagal memperbarui jadwal praktik.'] });
                setProcessing(false);
                return;
            }
        }

        setLocalStatus(`${changedSchedules.length} perubahan jadwal berhasil disimpan.`);
        setProcessing(false);
        router.reload({ preserveScroll: true });
    };

    const selectClinic = (clinicId: string) => {
        router.get('/doctor-schedules', { clinic_id: clinicId }, { preserveScroll: true, preserveState: false });
    };

    const openWindowModal = (schedule: DoctorClinicScheduleEntry) => {
        const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);

        setWindowModalScheduleId(schedule.id);
        setWindowModalForm({
            window_minutes: edit.window_minutes,
            max_patients_per_window: edit.max_patients_per_window,
        });
    };

    const closeWindowModal = () => {
        setWindowModalScheduleId(null);
    };

    const applyWindowSettings = () => {
        if (windowModalScheduleId === null || windowModalPreview === null || !windowModalPreview.isValid) {
            return;
        }

        updateScheduleEdit(windowModalScheduleId, {
            window_minutes: windowModalForm.window_minutes,
            max_patients_per_window: windowModalForm.max_patients_per_window,
        }, setScheduleEdits);
        setWindowModalScheduleId(null);
    };

    return (
        <AppLayout>
            <Head title="Jadwal Praktik" />

            <section className="flex h-full flex-col overflow-hidden bg-[#DFE0DF]">
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col gap-4 p-5">
                        <FlashAndErrors page={page} localStatus={localStatus} localErrors={errors} />

                        {context.clinics.length > 1 ? (
                            <ClinicSelector
                                clinics={context.clinics}
                                value={selectedClinicId}
                                onChange={selectClinic}
                            />
                        ) : null}

                        {clinic !== null ? (
                            <>
                                <div className="grid gap-3 md:grid-cols-4">
                                    <SummaryCard label="Jadwal Total" value={String(schedules.length)} description="Semua status" />
                                    <SummaryCard label="Jadwal Aktif" value={String(activeSchedules.length)} description="Dapat dipakai reservasi" />
                                    <SummaryCard label="Jadwal Nonaktif" value={String(inactiveSchedules.length)} description="Tidak tampil untuk booking" />
                                    <SummaryCard label="Estimasi Kapasitas" value={String(estimatedTotalCapacity)} description="Total slot praktik" />
                                </div>

                                <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
                                    <Panel title="Buat Jadwal Baru" subtitle={`Klinik: ${clinic.name}`}>
                                        <form onSubmit={createSchedule} className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                {dayOptions.map((day) => {
                                                    const operatingHour = operatingHoursByDay.get(day.value);
                                                    const isScheduled = scheduledDays.has(day.value);
                                                    const isClosed = operatingHour === undefined || operatingHour.is_closed;
                                                    const disabled = isScheduled || isClosed;

                                                    return (
                                                        <label
                                                            key={day.value}
                                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] transition-colors ${
                                                                disabled
                                                                    ? 'cursor-not-allowed border-[#e4ddd4] bg-[#f3f0ea] text-gray-400'
                                                                    : 'cursor-pointer border-gray-200 bg-white text-gray-600 hover:bg-[#faf9f7]'
                                                            }`}
                                                            title={isScheduled ? 'Hari ini sudah memiliki jadwal.' : isClosed ? 'Klinik tutup atau belum memiliki jam operasional.' : undefined}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                disabled={disabled}
                                                                checked={scheduleForm.day_of_week.includes(day.value)}
                                                                onChange={() => {
                                                                    if (!disabled) {
                                                                        toggleScheduleDay(day.value, setScheduleForm);
                                                                    }
                                                                }}
                                                            />
                                                            <span>{day.label}</span>
                                                            {isScheduled ? <span className="ml-auto text-[10px]">Terisi</span> : null}
                                                            {!isScheduled && isClosed ? <span className="ml-auto text-[10px]">Tutup</span> : null}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <FieldError errors={errors} field="day_of_week" />

                                            <div className="grid grid-cols-2 gap-2">
                                                <TextField label="Mulai" type="time" value={scheduleForm.start_time} onChange={(value) => setScheduleForm((current) => ({ ...current, start_time: value }))} />
                                                <TextField label="Selesai" type="time" value={scheduleForm.end_time} onChange={(value) => setScheduleForm((current) => ({ ...current, end_time: value }))} />
                                                <ScheduleWindowPresetControl value={scheduleForm.window_minutes} onChange={(value) => setScheduleForm((current) => ({ ...current, window_minutes: value }))} />
                                                <TextField label="Kapasitas/window" type="number" value={scheduleForm.max_patients_per_window} onChange={(value) => setScheduleForm((current) => ({ ...current, max_patients_per_window: value }))} />
                                            </div>
                                            <FieldError errors={errors} field="window_minutes" />

                                            <ScheduleWindowPreviewPanel preview={createWindowPreview} />

                                            <button
                                                type="submit"
                                                disabled={processing || scheduleForm.day_of_week.length === 0 || !createWindowPreview.isValid}
                                                className="w-full rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {processing ? 'Menyimpan...' : 'Buat Jadwal'}
                                            </button>
                                        </form>
                                    </Panel>

                                    <Panel title="Preview Jadwal" subtitle="Kelola jadwal praktik dokter pada klinik terpilih">
                                        {schedules.length === 0 ? (
                                            <EmptyState>Belum ada jadwal praktik pada klinik ini.</EmptyState>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex flex-col gap-2 rounded-lg border border-[#e4ddd4] bg-[#faf9f7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <p className="text-[12px] text-gray-500">
                                                        {firstChangedScheduleWarning !== null
                                                            ? firstChangedScheduleWarning
                                                            : changedSchedules.length > 0
                                                            ? `${changedSchedules.length} jadwal memiliki perubahan yang belum disimpan.`
                                                            : 'Belum ada perubahan pada jadwal.'}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={saveScheduleChanges}
                                                        disabled={processing || changedSchedules.length === 0 || firstChangedScheduleWarning !== null}
                                                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                                    >
                                                        {processing ? 'Menyimpan...' : 'Simpan Perubahan Jadwal'}
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full min-w-[760px] border-collapse text-[12px] whitespace-nowrap">
                                                        <thead>
                                                            <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                                {['Hari', 'Jam Operasional Klinik', 'Mulai', 'Selesai', 'Window', 'Status'].map((header) => (
                                                                    <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                                        {header}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {schedules.map((schedule) => {
                                                                const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);
                                                                const operatingHour = operatingHoursByDay.get(String(schedule.day_of_week));
                                                                const changed = !sameScheduleEdit(edit, scheduleToEditForm(schedule));
                                                                const rowPreview = buildScheduleWindowPreview(edit.start_time, edit.end_time, edit.window_minutes, edit.max_patients_per_window);

                                                                return (
                                                                    <tr key={schedule.id} className={`border-b border-[#ede8e2] last:border-0 ${!rowPreview.isValid ? 'bg-red-50/40' : changed ? 'bg-amber-50/45' : ''}`}>
                                                                        <td className="px-4 py-3 text-gray-700">
                                                                            <div className="flex items-center gap-2">
                                                                                {dayLabels[schedule.day_of_week] ?? schedule.day_of_week}
                                                                                {changed ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Diubah</span> : null}
                                                                                {!rowPreview.isValid ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Perlu cek</span> : null}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-gray-500">
                                                                            {operatingHourLabel(operatingHour)}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <SmallInput type="time" value={edit.start_time} onChange={(value) => updateScheduleEdit(schedule.id, { start_time: value }, setScheduleEdits)} />
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <SmallInput type="time" value={edit.end_time} onChange={(value) => updateScheduleEdit(schedule.id, { end_time: value }, setScheduleEdits)} />
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <ScheduleWindowCompactSummary
                                                                                windowMinutes={edit.window_minutes}
                                                                                capacity={edit.max_patients_per_window}
                                                                                preview={rowPreview}
                                                                                onOpen={() => openWindowModal(schedule)}
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <label className="inline-flex items-center gap-2 text-gray-600">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={edit.is_active}
                                                                                    onChange={(event) => updateScheduleEdit(schedule.id, { is_active: event.target.checked }, setScheduleEdits)}
                                                                                />
                                                                                {edit.is_active ? 'Aktif' : 'Nonaktif'}
                                                                            </label>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </Panel>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </section>

            {windowModalSchedule !== null && windowModalEdit !== null && windowModalPreview !== null ? (
                <ScheduleWindowSettingsModal
                    subtitle={`${dayLabels[windowModalSchedule.day_of_week] ?? windowModalSchedule.day_of_week}, ${windowModalEdit.start_time} - ${windowModalEdit.end_time}`}
                    form={windowModalForm}
                    preview={windowModalPreview}
                    onChange={setWindowModalForm}
                    onClose={closeWindowModal}
                    onApply={applyWindowSettings}
                />
            ) : null}
        </AppLayout>
    );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
                <p className="text-[13px] font-medium text-[#40311D]">{title}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function SummaryCard({ label, value, description }: { label: string; value: string; description: string }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="mb-1 text-[11px] text-gray-400">{label}</p>
            <p className="text-[26px] font-medium text-[#40311D]">{value}</p>
            <p className="mt-1 text-[11px] text-gray-400">{description}</p>
        </div>
    );
}

function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-lg border border-[#e4ddd4] bg-[#faf9f7] px-4 py-5 text-[12px] italic text-gray-400">
            {children}
        </div>
    );
}

function TextField({
    label,
    value,
    onChange,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
}) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
            />
        </label>
    );
}

function SmallInput({ value, onChange, type = 'text' }: { value: string; onChange: (value: string) => void; type?: string }) {
    return (
        <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
        />
    );
}

function FlashAndErrors({ page, localStatus, localErrors }: { page: ReturnType<typeof usePage<PageProps>>; localStatus: string | null; localErrors: ValidationErrors }) {
    const firstLocalError = Object.values(localErrors)[0]?.[0];

    return (
        <>
            {localStatus ? <Alert tone="success">{localStatus}</Alert> : null}
            {page.props.flash?.status ? <Alert tone="success">{page.props.flash.status}</Alert> : null}
            {firstLocalError ? <Alert tone="danger">{firstLocalError}</Alert> : null}
        </>
    );
}

function Alert({ tone, children }: { tone: 'success' | 'danger'; children: ReactNode }) {
    const classes = tone === 'success'
        ? 'border-teal-200 bg-teal-50 text-teal-700'
        : 'border-red-200 bg-red-50 text-red-600';

    return <div className={`rounded-xl border px-4 py-3 text-[12px] ${classes}`}>{children}</div>;
}

function FieldError({ errors, field }: { errors: ValidationErrors; field: string }) {
    const message = errors[field]?.[0];

    return message ? <p className="text-[11px] font-medium text-red-600">{message}</p> : null;
}

function toggleScheduleDay(value: string, setScheduleForm: (updater: (current: ScheduleForm) => ScheduleForm) => void) {
    setScheduleForm((current) => ({
        ...current,
        day_of_week: current.day_of_week.includes(value)
            ? current.day_of_week.filter((day) => day !== value)
            : [...current.day_of_week, value],
    }));
}

function scheduleToEditForm(schedule: DoctorClinicScheduleEntry): ScheduleEditForm {
    return {
        start_time: timeValue(schedule.start_time),
        end_time: timeValue(schedule.end_time),
        window_minutes: String(schedule.window_minutes),
        max_patients_per_window: String(schedule.max_patients_per_window),
        is_active: schedule.is_active,
    };
}

function sameScheduleEdit(left: ScheduleEditForm, right: ScheduleEditForm): boolean {
    return left.start_time === right.start_time
        && left.end_time === right.end_time
        && String(left.window_minutes) === String(right.window_minutes)
        && String(left.max_patients_per_window) === String(right.max_patients_per_window)
        && left.is_active === right.is_active;
}

function updateScheduleEdit(
    scheduleId: number,
    patch: Partial<ScheduleEditForm>,
    setScheduleEdits: (updater: (current: Record<number, ScheduleEditForm>) => Record<number, ScheduleEditForm>) => void,
) {
    setScheduleEdits((current) => ({
        ...current,
        [scheduleId]: {
            ...current[scheduleId],
            ...patch,
        },
    }));
}

function timeValue(value: string): string {
    return value.slice(0, 5);
}

function withSeconds(value: string): string {
    return value.length === 5 ? `${value}:00` : value;
}

function estimatedCapacity(schedule: DoctorClinicScheduleEntry): number {
    return estimateScheduleCapacity(schedule.start_time, schedule.end_time, String(schedule.window_minutes), String(schedule.max_patients_per_window));
}

function operatingHourLabel(hour: OperatingHourEntry | undefined): string {
    if (hour === undefined) {
        return 'Belum diatur';
    }

    if (hour.is_closed) {
        return 'Tutup';
    }

    return `${timeValue(hour.open_time ?? '')} - ${timeValue(hour.close_time ?? '')}`;
}

function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}

type JsonResult = {
    ok: boolean;
    message?: string;
    errors?: ValidationErrors;
};

async function requestJson(url: string, method: 'PATCH', payload: Record<string, unknown>): Promise<JsonResult> {
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
        return {
            ok: false,
            message: body?.message ?? 'Request failed.',
            errors: normalizeJsonErrors(body?.errors ?? {}),
        };
    }

    return { ok: true, message: body?.message };
}

function normalizeJsonErrors(errors: Record<string, unknown>): ValidationErrors {
    return Object.fromEntries(
        Object.entries(errors).map(([field, messages]) => [
            field,
            Array.isArray(messages) ? messages.map((message) => String(message)) : [String(messages)],
        ]),
    );
}


