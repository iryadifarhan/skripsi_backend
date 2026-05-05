import { Head, Link, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { AvatarSelector } from '@/components/avatar-selector';
import {
    ScheduleWindowCompactSummary,
    ScheduleWindowPresetControl,
    ScheduleWindowPreviewPanel,
    ScheduleWindowSettingsModal,
} from '@/components/schedule-window';
import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import { buildScheduleWindowPreview, type ScheduleWindowForm } from '@/lib/schedule-window';
import type { ClinicDetail, DoctorClinicScheduleEntry, DoctorEntry, MedicalRecordEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type DoctorEditPageProps = {
    context: WorkspaceContext;
    doctorId: number;
    clinicId: number;
    clinic: ClinicDetail;
    doctor: DoctorEntry;
    isClinicDoctor: boolean;
    schedules: DoctorClinicScheduleEntry[];
    medicalRecords: MedicalRecordEntry[];
    canViewMedicalRecords: boolean;
    profilePictureOptions?: string[];
};

type DoctorForm = {
    name: string;
    username: string;
    email: string;
    phone_number: string;
    date_of_birth: string;
    gender: string;
    specialities: string[];
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

type JsonResult = {
    ok: boolean;
    message?: string;
    errors?: ValidationErrors;
};

const dayOptions = [
    { value: '1', label: 'Senin' },
    { value: '2', label: 'Selasa' },
    { value: '3', label: 'Rabu' },
    { value: '4', label: 'Kamis' },
    { value: '5', label: 'Jumat' },
    { value: '6', label: 'Sabtu' },
    { value: '0', label: 'Minggu' },
];

const dayLabels = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function DoctorEditPage({ context, clinicId, clinic, doctor: initialDoctor, isClinicDoctor, schedules, medicalRecords, canViewMedicalRecords, profilePictureOptions = [] }: DoctorEditPageProps) {
    const { flash } = usePage<SharedData>().props;
    const doctor = initialDoctor;
    const isSuperadmin = context.role === 'superadmin';
    const scheduledDayValues = new Set(schedules.map((schedule) => String(schedule.day_of_week)));
    const [form, setForm] = useState<DoctorForm>({
        name: initialDoctor.name,
        username: initialDoctor.username,
        email: initialDoctor.email,
        phone_number: initialDoctor.phone_number ?? '',
        date_of_birth: initialDoctor.date_of_birth ?? '',
        gender: initialDoctor.gender ?? '',
        specialities: initialDoctor.specialities ?? [],
    });
    const [specialityDraft, setSpecialityDraft] = useState('');
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
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [scheduleSaving, setScheduleSaving] = useState(false);
    const [deletingDoctor, setDeletingDoctor] = useState(false);
    const medicalRecordPagination = useClientPagination(medicalRecords);
    const createWindowPreview = useMemo(
        () => buildScheduleWindowPreview(scheduleForm.start_time, scheduleForm.end_time, scheduleForm.window_minutes, scheduleForm.max_patients_per_window),
        [scheduleForm.start_time, scheduleForm.end_time, scheduleForm.window_minutes, scheduleForm.max_patients_per_window],
    );
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

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        setError(null);

        router.patch(
            `/doctors/${doctor.id}`,
            {
                clinic_id: clinicId,
                name: form.name,
                username: form.username,
                email: form.email,
                phone_number: form.phone_number || null,
                date_of_birth: form.date_of_birth || null,
                gender: form.gender || null,
                ...(isSuperadmin ? {} : { specialities: form.specialities }),
            },
            {
                preserveScroll: true,
                onError: (validationErrors) => {
                    setErrors(normalizeInertiaErrors(validationErrors));
                    setError('Gagal memperbarui data dokter.');
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const addSpeciality = () => {
        const nextSpeciality = specialityDraft.trim();

        if (nextSpeciality === '') {
            return;
        }

        setForm((current) => {
            const alreadyExists = current.specialities.some((speciality) => speciality.toLowerCase() === nextSpeciality.toLowerCase());

            if (alreadyExists) {
                return current;
            }

            return {
                ...current,
                specialities: [...current.specialities, nextSpeciality],
            };
        });
        setSpecialityDraft('');
    };

    const removeSpeciality = (target: string) => {
        setForm((current) => ({
            ...current,
            specialities: current.specialities.filter((speciality) => speciality !== target),
        }));
    };

    const selectProfilePicture = (profilePicture: string | null) => {
        setError(null);
        setErrors({});

        router.patch(`/doctors/${doctor.id}/picture`, {
            clinic_id: clinicId,
            profile_picture: profilePicture,
        }, {
            preserveScroll: true,
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError('Gagal memperbarui avatar dokter.');
            },
        });
    };

    const uploadImage = (file: File) => {
        setUploadingAvatar(true);
        setError(null);
        setErrors({});

        const payload = new FormData();
        payload.append('clinic_id', String(clinicId));
        payload.append('image', file);

        router.post(`/doctors/${doctor.id}/image`, payload, {
            forceFormData: true,
            preserveScroll: true,
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError('Gagal mengunggah foto dokter.');
            },
            onFinish: () => setUploadingAvatar(false),
        });
    };

    const deleteImage = () => {
        setError(null);
        setErrors({});

        router.delete(`/doctors/${doctor.id}/image`, {
            data: {
                clinic_id: clinicId,
            },
            preserveScroll: true,
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError('Gagal menghapus foto upload dokter.');
            },
        });
    };

    const deleteDoctor = () => {
        if (!isSuperadmin) {
            return;
        }

        if (!window.confirm(`Hapus data dokter ${doctor.name}? Dokter dengan riwayat reservasi atau rekam medis tidak dapat dihapus.`)) {
            return;
        }

        setDeletingDoctor(true);
        setErrors({});
        setError(null);

        router.delete(`/doctors/${doctor.id}`, {
            data: {
                clinic_id: clinicId,
            },
            preserveScroll: true,
            onError: (validationErrors) => {
                const normalizedErrors = normalizeInertiaErrors(validationErrors);
                setErrors(normalizedErrors);
                setError(normalizedErrors.doctor?.[0] ?? 'Gagal menghapus data dokter.');
            },
            onFinish: () => setDeletingDoctor(false),
        });
    };

    const createSchedule = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isClinicDoctor) {
            return;
        }

        if (!createWindowPreview.isValid) {
            setErrors({ window_minutes: [createWindowPreview.message ?? 'Window jadwal tidak valid.'] });
            setError('Window jadwal tidak valid.');
            return;
        }

        setScheduleSaving(true);
        setErrors({});
        setError(null);

        const result = await requestJson('/clinic-settings/schedules', 'POST', {
            clinic_id: clinicId,
            doctor_id: doctor.id,
            day_of_week: scheduleForm.day_of_week,
            start_time: withSeconds(scheduleForm.start_time),
            end_time: withSeconds(scheduleForm.end_time),
            window_minutes: scheduleForm.window_minutes,
            max_patients_per_window: scheduleForm.max_patients_per_window,
        });

        setScheduleSaving(false);

        if (!result.ok) {
            setError(result.message ?? 'Gagal membuat jadwal praktik dokter.');
            setErrors(result.errors ?? {});
            return;
        }

        setScheduleForm((current) => ({ ...current, day_of_week: [] }));
        router.reload({ preserveScroll: true });
    };

    const updateSchedule = async (schedule: DoctorClinicScheduleEntry) => {
        const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);
        const preview = buildScheduleWindowPreview(edit.start_time, edit.end_time, edit.window_minutes, edit.max_patients_per_window);

        if (!preview.isValid) {
            setErrors({ window_minutes: [preview.message ?? 'Window jadwal tidak valid.'] });
            setError('Window jadwal tidak valid.');
            return;
        }

        setScheduleSaving(true);
        setErrors({});
        setError(null);

        const result = await requestJson(`/clinic-settings/schedules/${schedule.id}`, 'PATCH', {
            clinic_id: clinicId,
            start_time: withSeconds(edit.start_time),
            end_time: withSeconds(edit.end_time),
            window_minutes: edit.window_minutes,
            max_patients_per_window: edit.max_patients_per_window,
            is_active: edit.is_active,
        });

        setScheduleSaving(false);

        if (!result.ok) {
            setError(result.message ?? 'Gagal memperbarui jadwal praktik.');
            setErrors(result.errors ?? {});
            return;
        }

        router.reload({ preserveScroll: true });
    };

    const deleteSchedule = async (schedule: DoctorClinicScheduleEntry) => {
        if (!window.confirm('Hapus jadwal praktik ini?')) {
            return;
        }

        setScheduleSaving(true);
        setErrors({});
        setError(null);

        const result = await requestJson(`/clinic-settings/schedules/${schedule.id}`, 'DELETE', {
            clinic_id: clinicId,
        });

        setScheduleSaving(false);

        if (!result.ok) {
            setError(result.message ?? 'Gagal menghapus jadwal praktik.');
            setErrors(result.errors ?? {});
            return;
        }

        router.reload({ preserveScroll: true });
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
            <Head title="Detail Dokter" />

            <section className="flex h-full flex-col overflow-hidden bg-[#DFE0DF]">
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col gap-4 p-5">
                        <div className="flex flex-col gap-3 md:flex-row-reverse md:items-center md:justify-between">
                            <Link
                                href={`/doctors?clinic_id=${clinicId}`}
                                className="inline-flex rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition-colors hover:bg-[#faf9f7]"
                            >
                                Kembali
                            </Link>
                        </div>

                        {flash?.status ? <Alert tone="success">{flash.status}</Alert> : null}
                        {error ? <Alert tone="danger">{error}</Alert> : null}

                        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                            <Panel title="Profil Dokter" subtitle="Foto identitas">
                                <div className="flex flex-col gap-4">
                                    <AvatarSelector
                                        role="doctor"
                                        name={doctor.name}
                                        imageUrl={doctor.image_url}
                                        displayAvatarUrl={doctor.display_avatar_url}
                                        selectedProfilePicture={doctor.profile_picture}
                                        profilePictureOptions={profilePictureOptions}
                                        canEdit
                                        uploading={uploadingAvatar}
                                        onSelectProfilePicture={selectProfilePicture}
                                        onUploadImage={uploadImage}
                                        onDeleteImage={deleteImage}
                                    />
                                </div>
                            </Panel>

                            <Panel title="Ubah Data Dokter" subtitle={isSuperadmin ? 'Data global dokter' : 'Data dokter dan spesialisasi klinik'}>
                                <form onSubmit={submit} className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <TextField disabled={!isSuperadmin} label="Nama" value={form.name} error={errors.name?.[0]} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
                                        <TextField disabled={!isSuperadmin} label="Username" value={form.username} error={errors.username?.[0]} onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
                                        <TextField disabled={!isSuperadmin} label="Email" type="email" value={form.email} error={errors.email?.[0]} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                                        <TextField disabled={!isSuperadmin} label="Nomor Telepon" value={form.phone_number} error={errors.phone_number?.[0]} onChange={(value) => setForm((current) => ({ ...current, phone_number: value }))} />
                                        <TextField disabled={!isSuperadmin} label="Tanggal Lahir" type="date" value={form.date_of_birth} error={errors.date_of_birth?.[0]} onChange={(value) => setForm((current) => ({ ...current, date_of_birth: value }))} />
                                        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                                            Gender
                                            <select
                                                value={form.gender}
                                                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                                                className={`rounded-lg border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-[#40311D] ${!isSuperadmin ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                                                disabled={!isSuperadmin}
                                            >
                                                <option value="">Tidak diisi</option>
                                                <option value="Laki">Laki</option>
                                                <option value="Perempuan">Perempuan</option>
                                            </select>
                                            {errors.gender?.[0] ? <span className="text-[11px] font-medium text-red-600">{errors.gender[0]}</span> : null}
                                        </label>
                                        {isSuperadmin ? (
                                            <div className="rounded-lg border border-[#e4ddd4] bg-[#faf9f7] px-4 py-3 text-[12px] text-gray-600 md:col-span-2">
                                                Superadmin tidak mengubah spesialisasi. Spesialisasi disimpan per klinik dan diatur oleh admin klinik.
                                            </div>
                                        ) : (
                                            <div className="md:col-span-2">
                                                <SpecialityEditor
                                                    specialities={form.specialities}
                                                    draft={specialityDraft}
                                                    error={errors.specialities?.[0] ?? errors['specialities.0']?.[0]}
                                                    onDraftChange={setSpecialityDraft}
                                                    onAdd={addSpeciality}
                                                    onRemove={removeSpeciality}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end">
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {isSuperadmin ? (
                                                <button
                                                    type="button"
                                                    onClick={deleteDoctor}
                                                    disabled={deletingDoctor}
                                                    className="rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {deletingDoctor ? 'Menghapus...' : 'Hapus Dokter'}
                                                </button>
                                            ) : null}
                                            <button
                                                type="submit"
                                                disabled={processing}
                                                className="rounded-lg bg-[#40311D] px-5 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </Panel>
                        </div>

                        <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
                            <Panel title="Buat Jadwal Baru" subtitle="Assign jadwal praktik dokter pada klinik ini">
                                {!isClinicDoctor ? (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
                                        Dokter ini belum terdaftar di klinik terpilih. Assign dokter ke klinik terlebih dahulu dari halaman Data Dokter sebelum membuat jadwal praktik.
                                    </p>
                                ) : (
                                    <form onSubmit={createSchedule} className="space-y-3 text-[12px]">
                                        <div className="grid grid-cols-2 gap-2">
                                            {dayOptions.map((day) => {
                                                const isScheduled = scheduledDayValues.has(day.value);

                                                return (
                                                    <label
                                                        key={day.value}
                                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                                                            isScheduled
                                                                ? 'cursor-not-allowed border-[#e4ddd4] bg-[#f3f0ea] text-gray-400'
                                                                : 'cursor-pointer border-gray-200 bg-white text-gray-600 hover:bg-[#faf9f7]'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            disabled={isScheduled}
                                                            checked={scheduleForm.day_of_week.includes(day.value)}
                                                            onChange={() => {
                                                                if (!isScheduled) {
                                                                    toggleScheduleDay(day.value, setScheduleForm);
                                                                }
                                                            }}
                                                        />
                                                        <span>{day.label}</span>
                                                        {isScheduled ? <span className="ml-auto text-[10px] text-gray-400">Terisi</span> : null}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <FieldError errors={errors} field="day_of_week" />

                                        <div className="grid grid-cols-2 gap-2">
                                            <TextField compact label="Mulai" type="time" value={scheduleForm.start_time} onChange={(value) => setScheduleForm((current) => ({ ...current, start_time: value }))} />
                                            <TextField compact label="Selesai" type="time" value={scheduleForm.end_time} onChange={(value) => setScheduleForm((current) => ({ ...current, end_time: value }))} />
                                            <ScheduleWindowPresetControl value={scheduleForm.window_minutes} onChange={(value) => setScheduleForm((current) => ({ ...current, window_minutes: value }))} />
                                            <TextField compact label="Kapasitas/Window" type="number" value={scheduleForm.max_patients_per_window} onChange={(value) => setScheduleForm((current) => ({ ...current, max_patients_per_window: value }))} />
                                        </div>
                                        <FieldError errors={errors} field="window_minutes" />

                                        <ScheduleWindowPreviewPanel preview={createWindowPreview} />

                                        <button
                                            type="submit"
                                            disabled={scheduleSaving || scheduleForm.day_of_week.length === 0 || !createWindowPreview.isValid}
                                            className="w-full rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {scheduleSaving ? 'Menyimpan...' : 'Buat Jadwal'}
                                        </button>
                                    </form>
                                )}
                            </Panel>

                            <Panel title="Preview Jadwal" subtitle="Kelola jadwal praktik dokter pada klinik ini">
                                {!isClinicDoctor ? (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
                                        Preview jadwal tersedia setelah dokter terdaftar pada klinik ini.
                                    </p>
                                ) : schedules.length === 0 ? (
                                    <p className="rounded-lg border border-[#e4ddd4] bg-[#faf9f7] px-4 py-5 text-[12px] italic text-gray-400">
                                        Dokter ini belum memiliki jadwal praktik pada klinik ini.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[980px] border-collapse text-[12px] whitespace-nowrap">
                                            <thead>
                                                <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Hari</th>
                                                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-400">Mulai</th>
                                                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-400">Selesai</th>
                                                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-400">Window</th>
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Status</th>
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {schedules.map((schedule) => {
                                                    const edit = scheduleEdits[schedule.id] ?? scheduleToEditForm(schedule);
                                                    const rowPreview = buildScheduleWindowPreview(edit.start_time, edit.end_time, edit.window_minutes, edit.max_patients_per_window);

                                                    return (
                                                        <tr key={schedule.id} className={`border-b border-[#ede8e2] last:border-0 ${rowPreview.isValid ? '' : 'bg-red-50/40'}`}>
                                                            <td className="px-4 py-3 text-gray-700">
                                                                <div className="flex items-center gap-2">
                                                                    {dayLabels[schedule.day_of_week] ?? schedule.day_of_week}
                                                                    {!rowPreview.isValid ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Perlu cek</span> : null}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3"><SmallInput width="28" type="time" value={edit.start_time} onChange={(value) => updateScheduleEdit(schedule.id, { start_time: value }, setScheduleEdits)} /></td>
                                                            <td className="px-4 py-3"><SmallInput width="28" type="time" value={edit.end_time} onChange={(value) => updateScheduleEdit(schedule.id, { end_time: value }, setScheduleEdits)} /></td>
                                                            <td className="px-2 py-3">
                                                                <ScheduleWindowCompactSummary
                                                                    windowMinutes={edit.window_minutes}
                                                                    capacity={edit.max_patients_per_window}
                                                                    preview={rowPreview}
                                                                    displayTotal={false}
                                                                    onOpen={() => openWindowModal(schedule)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <label className="inline-flex items-start gap-2 text-gray-600">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={edit.is_active}
                                                                        onChange={(event) => updateScheduleEdit(schedule.id, { is_active: event.target.checked }, setScheduleEdits)}
                                                                    />
                                                                    {edit.is_active ? 'Aktif' : 'Nonaktif'}
                                                                </label>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-nowrap justify-start gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSchedule(schedule)}
                                                                        disabled={scheduleSaving || !rowPreview.isValid}
                                                                        className="rounded-lg bg-[#40311D] px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        Simpan
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteSchedule(schedule)}
                                                                        disabled={scheduleSaving}
                                                                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        Hapus
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Panel>
                        </section>

                        {canViewMedicalRecords ? (
                            <Panel title="Riwayat Penanganan Medis" subtitle="Latest 20 rekam medis dokter ini pada klinik terpilih">
                                {!isClinicDoctor ? (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
                                        Riwayat penanganan medis tersedia setelah dokter terdaftar pada klinik ini.
                                    </p>
                                ) : medicalRecords.length === 0 ? (
                                    <p className="rounded-lg border border-[#e4ddd4] bg-[#faf9f7] px-4 py-5 text-[12px] italic text-gray-400">
                                        Belum ada riwayat penanganan medis untuk dokter ini pada klinik terpilih.
                                    </p>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1120px] border-collapse text-[12px] whitespace-nowrap">
                                                <thead>
                                                    <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Tanggal</th>
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Pasien/Walk-In</th>
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Keluhan</th>
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Diagnosis</th>
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Treatment</th>
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Prescription Note</th>
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Doctor Notes</th>
                                                        <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Reservation Number</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {medicalRecordPagination.paginatedItems.map((record) => (
                                                        <tr key={record.id} className="border-b border-[#ede8e2] last:border-0">
                                                            <td className="px-4 py-3 text-gray-700">{dateTimeLabel(record.issued_at)}</td>
                                                            <td className="px-4 py-3 text-gray-700">{record.patient?.name ?? record.guest_name ?? '-'}</td>
                                                            <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.reservation?.complaint ?? '-'}>
                                                                {record.reservation?.complaint ?? '-'}
                                                            </td>
                                                            <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.diagnosis ?? '-'}>
                                                                {record.diagnosis ?? '-'}
                                                            </td>
                                                            <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.treatment ?? '-'}>
                                                                {record.treatment ?? '-'}
                                                            </td>
                                                            <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.prescription_notes ?? '-'}>
                                                                {record.prescription_notes ?? '-'}
                                                            </td>
                                                            <td className="max-w-[240px] truncate px-4 py-3 text-gray-700" title={record.doctor_notes}>
                                                                {record.doctor_notes}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-[#40311D]">{record.reservation?.reservation_number ?? '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <PaginationControls
                                            page={medicalRecordPagination.page}
                                            perPage={medicalRecordPagination.perPage}
                                            total={medicalRecordPagination.total}
                                            pageCount={medicalRecordPagination.pageCount}
                                            startItem={medicalRecordPagination.startItem}
                                            endItem={medicalRecordPagination.endItem}
                                            perPageOptions={medicalRecordPagination.perPageOptions}
                                            onPageChange={medicalRecordPagination.setPage}
                                            onPerPageChange={medicalRecordPagination.setPerPage}
                                        />
                                    </>
                                )}
                            </Panel>
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

function TextField({
    label,
    value,
    onChange,
    error,
    type = 'text',
    placeholder,
    compact = false,
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    placeholder?: string;
    compact?: boolean;
    disabled?: boolean;
}) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            {label}
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                className={`${compact ? 'px-3 py-2' : 'px-3 py-2.5'} rounded-lg border border-gray-300 text-[12px] text-gray-700 outline-none focus:border-[#40311D] ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </label>
    );
}

function SpecialityEditor({
    specialities,
    draft,
    error,
    onDraftChange,
    onAdd,
    onRemove,
}: {
    specialities: string[];
    draft: string;
    error?: string;
    onDraftChange: (value: string) => void;
    onAdd: () => void;
    onRemove: (speciality: string) => void;
}) {
    return (
        <div className="flex flex-col gap-2 text-[11px] text-[#40311D]">
            <span>Spesialisasi klinik</span>
            <div className="rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-3">
                <div className="flex flex-wrap gap-2">
                    {specialities.length === 0 ? (
                        <span className="rounded-full border border-dashed border-gray-300 bg-white px-3 py-1.5 text-[12px] italic text-gray-400">
                            Belum ada spesialisasi
                        </span>
                    ) : (
                        specialities.map((speciality) => (
                            <span
                                key={speciality}
                                className="inline-flex items-center gap-2 rounded-full border border-[#d9cbb7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#40311D]"
                            >
                                {speciality}
                                <button
                                    type="button"
                                    onClick={() => onRemove(speciality)}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[#40311D] text-[11px] leading-none text-white transition hover:bg-[#2c2115]"
                                    aria-label={`Hapus ${speciality}`}
                                >
                                    x
                                </button>
                            </span>
                        ))
                    )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        value={draft}
                        onChange={(event) => onDraftChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                onAdd();
                            }
                        }}
                        placeholder="Ketik spesialisasi, misal: Cardiology"
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none placeholder:italic placeholder:text-gray-400 focus:border-[#40311D]"
                    />
                    <button
                        type="button"
                        onClick={onAdd}
                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#2c2115]"
                    >
                        + Tambah
                    </button>
                </div>
            </div>
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
            <span className="text-[11px] text-gray-400">
                Setiap item akan disimpan sebagai spesialisasi dokter khusus untuk klinik ini.
            </span>
        </div>
    );
}

function SmallInput({ value, onChange, type = 'text', width = '24' }: { value: string; onChange: (value: string) => void; type?: string; width?: string }) {
    return (
        <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={`w-${width} shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] text-gray-700 outline-none focus:border-[#40311D]`}
        />
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

function specialitiesLabel(doctor: DoctorEntry): string {
    const specialities = doctor.specialities ?? doctor.speciality ?? [];

    return specialities.length > 0 ? specialities.join(', ') : '-';
}

function toggleScheduleDay(value: string, setScheduleForm: (updater: (current: ScheduleForm) => ScheduleForm) => void) {
    setScheduleForm((current) => ({
        ...current,
        day_of_week: current.day_of_week.includes(value)
            ? current.day_of_week.filter((day) => day !== value)
            : [...current.day_of_week, value],
    }));
}

function withSeconds(value: string): string {
    return value.length === 5 ? `${value}:00` : value;
}

function timeLabel(value: string): string {
    return value.slice(0, 5);
}

function dateTimeLabel(value: string): string {
    if (!value) {
        return '-';
    }

    return value.replace('T', ' ').slice(0, 16);
}

function scheduleToEditForm(schedule: DoctorClinicScheduleEntry): ScheduleEditForm {
    return {
        start_time: timeLabel(schedule.start_time),
        end_time: timeLabel(schedule.end_time),
        window_minutes: String(schedule.window_minutes),
        max_patients_per_window: String(schedule.max_patients_per_window),
        is_active: schedule.is_active,
    };
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

async function requestJson(url: string, method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>): Promise<JsonResult> {
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
            message: body?.message ?? Object.values(body?.errors ?? {}).flat().join(' ') ?? 'Request failed.',
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

function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}
