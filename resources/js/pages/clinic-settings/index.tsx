import { Head, router, usePage } from '@inertiajs/react';
import { FormEvent, useMemo, useRef, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import type { ClinicDetail, DoctorClinicScheduleEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type ClinicSettingsPageProps = {
    context: WorkspaceContext;
    selectedClinicId: number | null;
    clinic: ClinicDetail | null;
    schedules: DoctorClinicScheduleEntry[];
};

type ClinicForm = {
    name: string;
    address: string;
    phone_number: string;
    email: string;
};

type OperatingHourForm = {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
};

type ScheduleForm = {
    doctor_id: string;
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

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function ClinicSettingsPage({ context, selectedClinicId, clinic, schedules }: ClinicSettingsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const fileInput = useRef<HTMLInputElement | null>(null);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [savingClinic, setSavingClinic] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [creatingSchedule, setCreatingSchedule] = useState(false);
    const [updatingScheduleId, setUpdatingScheduleId] = useState<number | null>(null);

    const [clinicForm, setClinicForm] = useState<ClinicForm>({
        name: clinic?.name ?? '',
        address: clinic?.address ?? '',
        phone_number: clinic?.phone_number ?? '',
        email: clinic?.email ?? '',
    });

    const [operatingHours, setOperatingHours] = useState<OperatingHourForm[]>(() => buildOperatingHours(clinic));
    const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
        doctor_id: clinic?.doctors?.[0]?.id ? String(clinic.doctors[0].id) : '',
        day_of_week: [],
        start_time: '09:00:00',
        end_time: '12:00:00',
        window_minutes: '30',
        max_patients_per_window: '4',
    });
    const [scheduleEdits, setScheduleEdits] = useState<Record<number, ScheduleEditForm>>(() =>
        Object.fromEntries(schedules.map((schedule) => [schedule.id, scheduleToEditForm(schedule)])),
    );

    const scheduleByDoctor = useMemo(() => {
        const groups = new Map<string, DoctorClinicScheduleEntry[]>();

        schedules.forEach((schedule) => {
            const key = schedule.doctor?.name ?? 'Dokter tidak ditemukan';
            groups.set(key, [...(groups.get(key) ?? []), schedule]);
        });

        return Array.from(groups.entries());
    }, [schedules]);

    const submitClinic = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (clinic === null) {
            return;
        }

        setSavingClinic(true);
        setErrors({});
        setError(null);

        router.patch(
            `/clinic-settings/${clinic.id}`,
            {
                clinic_id: clinic.id,
                ...clinicForm,
                operating_hours: operatingHours.map((hour) => ({
                    day_of_week: hour.day_of_week,
                    open_time: hour.is_closed ? null : hour.open_time,
                    close_time: hour.is_closed ? null : hour.close_time,
                    is_closed: hour.is_closed,
                })),
            },
            {
                preserveScroll: true,
                onError: (validationErrors) => {
                    setErrors(normalizeInertiaErrors(validationErrors));
                    setError('Gagal memperbarui data klinik.');
                },
                onFinish: () => setSavingClinic(false),
            },
        );
    };

    const uploadImage = () => {
        if (clinic === null) {
            return;
        }

        const file = fileInput.current?.files?.[0];

        if (!file) {
            return;
        }

        const payload = new FormData();
        payload.append('clinic_id', String(clinic.id));
        payload.append('image', file);

        setUploading(true);
        setErrors({});
        setError(null);

        router.post(`/clinic-settings/${clinic.id}/image`, payload, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                if (fileInput.current) {
                    fileInput.current.value = '';
                }
            },
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError('Gagal mengunggah foto klinik.');
            },
            onFinish: () => setUploading(false),
        });
    };

    const createSchedule = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (clinic === null) {
            return;
        }

        setCreatingSchedule(true);
        setErrors({});
        setError(null);

        router.post(
            '/clinic-settings/schedules',
            {
                clinic_id: clinic.id,
                doctor_id: scheduleForm.doctor_id,
                day_of_week: scheduleForm.day_of_week,
                start_time: scheduleForm.start_time,
                end_time: scheduleForm.end_time,
                window_minutes: scheduleForm.window_minutes,
                max_patients_per_window: scheduleForm.max_patients_per_window,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setScheduleForm((current) => ({ ...current, day_of_week: [] }));
                },
                onError: (validationErrors) => {
                    setErrors(normalizeInertiaErrors(validationErrors));
                    setError('Gagal membuat jadwal dokter.');
                },
                onFinish: () => setCreatingSchedule(false),
            },
        );
    };

    const updateSchedule = (schedule: DoctorClinicScheduleEntry) => {
        if (clinic === null) {
            return;
        }

        const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);

        setUpdatingScheduleId(schedule.id);
        setErrors({});
        setError(null);

        router.patch(
            `/clinic-settings/schedules/${schedule.id}`,
            {
                clinic_id: clinic.id,
                start_time: edit.start_time,
                end_time: edit.end_time,
                window_minutes: edit.window_minutes,
                max_patients_per_window: edit.max_patients_per_window,
                is_active: edit.is_active,
            },
            {
                preserveScroll: true,
                onError: (validationErrors) => {
                    setErrors(normalizeInertiaErrors(validationErrors));
                    setError('Gagal memperbarui jadwal dokter.');
                },
                onFinish: () => setUpdatingScheduleId(null),
            },
        );
    };

    return (
        <AppLayout>
            <Head title="Pengaturan Klinik" />

            <section className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-[#555]">Pengaturan Klinik</h2>
                        <p className="mt-1 text-sm font-semibold text-[#8b8f98]">Ubah profil klinik, foto klinik, jam operasional, dan jadwal praktik dokter.</p>
                    </div>

                    {context.role === 'superadmin' ? (
                        <label className="flex min-w-[280px] flex-col gap-2 text-sm font-semibold text-[#555]">
                            Pilih Klinik
                            <select
                                value={selectedClinicId ?? ''}
                                onChange={(event) => router.get('/clinic-settings', { clinic_id: event.target.value }, { preserveScroll: true })}
                                className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888]"
                            >
                                {context.clinics.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                </div>

                {flash?.status ? <div className="rounded-lg border border-green-200 bg-white p-4 text-sm font-semibold text-green-700">{flash.status}</div> : null}
                {error ? <div className="rounded-lg border border-red-200 bg-white p-4 text-sm font-semibold text-red-600">{error}</div> : null}

                {clinic === null ? (
                    <div className="rounded-lg border border-red-200 bg-white p-4 text-sm font-semibold text-red-600">Tidak ada klinik yang tersedia untuk akun ini.</div>
                ) : (
                    <>
                        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
                            <section className="rounded-lg border border-[#ccd2da] bg-white p-5">
                                <h3 className="text-sm font-extrabold text-[#929292]">Foto Klinik</h3>
                                <div className="mt-5 flex flex-col items-center gap-4">
                                    {clinic.image_url ? (
                                        <img src={clinic.image_url} alt={clinic.name} className="h-52 w-52 rounded-lg object-cover" />
                                    ) : (
                                        <div className="flex h-52 w-52 items-center justify-center rounded-lg bg-[#7d7f82] text-4xl font-extrabold text-white">
                                            {clinic.name.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    <input
                                        ref={fileInput}
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp"
                                        className="w-full rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm"
                                    />
                                    {errors.image?.[0] ? <span className="w-full text-xs font-bold text-red-600">{errors.image[0]}</span> : null}
                                    <button
                                        type="button"
                                        onClick={uploadImage}
                                        disabled={uploading}
                                        className="w-full rounded-md bg-[#343434] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {uploading ? 'Mengunggah...' : 'Upload Foto Klinik'}
                                    </button>
                                </div>
                            </section>

                            <form onSubmit={submitClinic} className="rounded-lg border border-[#ccd2da] bg-white p-5">
                                <h3 className="text-sm font-extrabold text-[#929292]">Data Klinik</h3>
                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <TextField label="Nama Klinik" value={clinicForm.name} error={errors.name?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, name: value }))} />
                                    <TextField label="Email" type="email" value={clinicForm.email} error={errors.email?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, email: value }))} />
                                    <TextField label="Nomor Telepon" value={clinicForm.phone_number} error={errors.phone_number?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, phone_number: value }))} />
                                    <TextField label="Alamat" value={clinicForm.address} error={errors.address?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, address: value }))} />
                                </div>

                                <div className="mt-7">
                                    <h4 className="text-sm font-extrabold text-[#929292]">Jam Operasional</h4>
                                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                        {operatingHours.map((hour, index) => (
                                            <div key={hour.day_of_week} className="rounded-lg border border-[#e0e4ea] p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm font-extrabold text-[#555]">{dayNames[hour.day_of_week]}</div>
                                                    <label className="flex items-center gap-2 text-xs font-bold text-[#777]">
                                                        <input
                                                            type="checkbox"
                                                            checked={hour.is_closed}
                                                            onChange={(event) => updateOperatingHour(index, { is_closed: event.target.checked }, setOperatingHours)}
                                                        />
                                                        Tutup
                                                    </label>
                                                </div>
                                                <div className="mt-3 grid grid-cols-2 gap-3">
                                                    <TextField compact label="Buka" value={hour.open_time} disabled={hour.is_closed} error={errors[`operating_hours.${index}.open_time`]?.[0]} onChange={(value) => updateOperatingHour(index, { open_time: value }, setOperatingHours)} />
                                                    <TextField compact label="Tutup" value={hour.close_time} disabled={hour.is_closed} error={errors[`operating_hours.${index}.close_time`]?.[0]} onChange={(value) => updateOperatingHour(index, { close_time: value }, setOperatingHours)} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={savingClinic}
                                        className="rounded-md bg-[#343434] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {savingClinic ? 'Menyimpan...' : 'Simpan Data Klinik'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <section className="rounded-lg border border-[#ccd2da] bg-white p-5">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-sm font-extrabold text-[#929292]">Buat Jadwal Dokter</h3>
                                <p className="text-xs font-semibold text-[#7d8491]">Mendukung bulk create dengan memilih lebih dari satu hari praktik.</p>
                            </div>

                            <form onSubmit={createSchedule} className="mt-5 grid gap-4 lg:grid-cols-6">
                                <label className="flex flex-col gap-2 text-sm font-semibold text-[#555] lg:col-span-2">
                                    Dokter
                                    <select
                                        value={scheduleForm.doctor_id}
                                        onChange={(event) => setScheduleForm((current) => ({ ...current, doctor_id: event.target.value }))}
                                        className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888]"
                                    >
                                        <option value="">Pilih dokter</option>
                                        {clinic.doctors.map((doctor) => (
                                            <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                                        ))}
                                    </select>
                                    {errors.doctor_id?.[0] ? <span className="text-xs font-bold text-red-600">{errors.doctor_id[0]}</span> : null}
                                </label>
                                <TextField label="Mulai" value={scheduleForm.start_time} error={errors.start_time?.[0]} onChange={(value) => setScheduleForm((current) => ({ ...current, start_time: value }))} />
                                <TextField label="Selesai" value={scheduleForm.end_time} error={errors.end_time?.[0]} onChange={(value) => setScheduleForm((current) => ({ ...current, end_time: value }))} />
                                <TextField label="Window Menit" value={scheduleForm.window_minutes} error={errors.window_minutes?.[0]} onChange={(value) => setScheduleForm((current) => ({ ...current, window_minutes: value }))} />
                                <TextField label="Kapasitas Window" value={scheduleForm.max_patients_per_window} error={errors.max_patients_per_window?.[0]} onChange={(value) => setScheduleForm((current) => ({ ...current, max_patients_per_window: value }))} />

                                <div className="lg:col-span-5">
                                    <div className="text-sm font-semibold text-[#555]">Hari Praktik</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {dayNames.map((day, index) => {
                                            const value = String(index);
                                            const selected = scheduleForm.day_of_week.includes(value);

                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => toggleScheduleDay(value, setScheduleForm)}
                                                    className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${selected ? 'bg-[#343434] text-white' : 'bg-[#eef1f4] text-[#6f7584] hover:bg-[#dfe4ea]'}`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.day_of_week?.[0] ? <span className="mt-2 block text-xs font-bold text-red-600">{errors.day_of_week[0]}</span> : null}
                                </div>

                                <div className="flex items-end lg:col-span-1">
                                    <button
                                        type="submit"
                                        disabled={creatingSchedule || clinic.doctors.length === 0}
                                        className="w-full rounded-md bg-[#343434] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {creatingSchedule ? 'Membuat...' : 'Tambah Jadwal'}
                                    </button>
                                </div>
                            </form>
                        </section>

                        <section className="overflow-hidden rounded-lg border border-[#ccd2da] bg-white">
                            <div className="px-5 py-4">
                                <h3 className="text-sm font-extrabold text-[#929292]">Jadwal Dokter Klinik</h3>
                                <p className="mt-2 text-xs font-semibold text-[#7d8491]">Edit jam praktik, durasi window, kapasitas per window, dan status aktif jadwal.</p>
                            </div>

                            {schedules.length === 0 ? (
                                <div className="border-t border-[#d6dbe3] px-5 py-8 text-sm font-semibold text-[#8b8f98]">Belum ada jadwal dokter untuk klinik ini.</div>
                            ) : (
                                <div className="space-y-5 border-t border-[#d6dbe3] p-5">
                                    {scheduleByDoctor.map(([doctorName, doctorSchedules]) => (
                                        <div key={doctorName}>
                                            <h4 className="text-sm font-extrabold text-[#555]">{doctorName}</h4>
                                            <div className="mt-3 overflow-x-auto rounded-lg border border-[#e0e4ea]">
                                                <table className="w-full min-w-[980px] text-left text-sm text-[#616875]">
                                                    <thead>
                                                        <tr className="border-b border-[#e2e5ea] text-xs text-[#8b8f98]">
                                                            <th className="px-4 py-3 font-extrabold">Hari</th>
                                                            <th className="px-4 py-3 font-extrabold">Mulai</th>
                                                            <th className="px-4 py-3 font-extrabold">Selesai</th>
                                                            <th className="px-4 py-3 font-extrabold">Window</th>
                                                            <th className="px-4 py-3 font-extrabold">Kapasitas</th>
                                                            <th className="px-4 py-3 font-extrabold">Aktif</th>
                                                            <th className="px-4 py-3 text-right font-extrabold">Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {doctorSchedules.map((schedule) => {
                                                            const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);

                                                            return (
                                                                <tr key={schedule.id} className="border-b border-[#edf0f3] last:border-0">
                                                                    <td className="px-4 py-4 font-extrabold text-[#303236]">{dayNames[schedule.day_of_week]}</td>
                                                                    <td className="px-4 py-4"><SmallInput value={edit.start_time} onChange={(value) => updateScheduleEdit(schedule.id, { start_time: value }, setScheduleEdits)} /></td>
                                                                    <td className="px-4 py-4"><SmallInput value={edit.end_time} onChange={(value) => updateScheduleEdit(schedule.id, { end_time: value }, setScheduleEdits)} /></td>
                                                                    <td className="px-4 py-4"><SmallInput value={edit.window_minutes} onChange={(value) => updateScheduleEdit(schedule.id, { window_minutes: value }, setScheduleEdits)} /></td>
                                                                    <td className="px-4 py-4"><SmallInput value={edit.max_patients_per_window} onChange={(value) => updateScheduleEdit(schedule.id, { max_patients_per_window: value }, setScheduleEdits)} /></td>
                                                                    <td className="px-4 py-4">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={edit.is_active}
                                                                            onChange={(event) => updateScheduleEdit(schedule.id, { is_active: event.target.checked }, setScheduleEdits)}
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-4 text-right">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateSchedule(schedule)}
                                                                            disabled={updatingScheduleId === schedule.id}
                                                                            className="rounded-md bg-[#343434] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
                                                                        >
                                                                            {updatingScheduleId === schedule.id ? 'Menyimpan...' : 'Simpan'}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </section>
        </AppLayout>
    );
}

function TextField({
    label,
    value,
    onChange,
    error,
    type = 'text',
    disabled = false,
    compact = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    disabled?: boolean;
    compact?: boolean;
}) {
    return (
        <label className={`flex flex-col gap-2 text-sm font-semibold text-[#555] ${compact ? 'text-xs' : ''}`}>
            {label}
            <input
                type={type}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888] disabled:bg-[#f2f3f5] disabled:text-[#9aa1ad]"
            />
            {error ? <span className="text-xs font-bold text-red-600">{error}</span> : null}
        </label>
    );
}

function SmallInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-28 rounded-md border border-[#cfd4dc] bg-white px-3 py-2 text-sm outline-none focus:border-[#888]"
        />
    );
}

function buildOperatingHours(clinic: ClinicDetail | null): OperatingHourForm[] {
    const existing = new Map((clinic?.operating_hours ?? []).map((hour) => [hour.day_of_week, hour]));

    return dayNames.map((_, day) => {
        const hour = existing.get(day);

        return {
            day_of_week: day,
            open_time: hour?.open_time ?? '08:00:00',
            close_time: hour?.close_time ?? '17:00:00',
            is_closed: Boolean(hour?.is_closed ?? false),
        };
    });
}

function scheduleToEditForm(schedule: DoctorClinicScheduleEntry): ScheduleEditForm {
    return {
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        window_minutes: String(schedule.window_minutes),
        max_patients_per_window: String(schedule.max_patients_per_window),
        is_active: schedule.is_active,
    };
}

function updateOperatingHour(index: number, patch: Partial<OperatingHourForm>, setOperatingHours: (updater: (current: OperatingHourForm[]) => OperatingHourForm[]) => void) {
    setOperatingHours((current) => current.map((hour, currentIndex) => (currentIndex === index ? { ...hour, ...patch } : hour)));
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

function toggleScheduleDay(value: string, setScheduleForm: (updater: (current: ScheduleForm) => ScheduleForm) => void) {
    setScheduleForm((current) => ({
        ...current,
        day_of_week: current.day_of_week.includes(value)
            ? current.day_of_week.filter((day) => day !== value)
            : [...current.day_of_week, value],
    }));
}

function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}
