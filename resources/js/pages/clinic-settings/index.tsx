import { Head, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import type { ClinicDetail, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type ClinicSettingsPageProps = {
    context: WorkspaceContext;
    selectedClinicId: number | null;
    clinic: ClinicDetail | null;
    clinicCities: ClinicCityOption[];
    summary: ClinicSettingsSummary;
};

type ClinicCityOption = {
    id: number;
    name: string;
};

type ClinicSettingsSummary = {
    doctor_count: number;
    active_schedule_count: number;
    today_reservation_count: number;
    active_queue_count: number;
    operating_day_count: number;
    medical_records_this_month: number | null;
};

type ClinicForm = {
    name: string;
    address: string;
    city_id: string;
    phone_number: string;
    email: string;
};

type AdminForm = {
    name: string;
    username: string;
    email: string;
    phone_number: string;
    date_of_birth: string;
    gender: string;
    password: string;
    password_confirmation: string;
};

type ClinicAdmin = NonNullable<ClinicDetail['admins']>[number];

type OperatingHourForm = {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
};

type BulkOperatingMode = 'open' | 'closed' | 'full_day';

const dayOptions = [
    { value: 1, label: 'Senin', short: 'Sen' },
    { value: 2, label: 'Selasa', short: 'Sel' },
    { value: 3, label: 'Rabu', short: 'Rab' },
    { value: 4, label: 'Kamis', short: 'Kam' },
    { value: 5, label: 'Jumat', short: 'Jum' },
    { value: 6, label: 'Sabtu', short: 'Sab' },
    { value: 0, label: 'Minggu', short: 'Min' },
];

const emptyAdminForm: AdminForm = {
    name: '',
    username: '',
    email: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    password: '',
    password_confirmation: '',
};

export default function ClinicSettingsPage({ context, clinic, clinicCities, summary }: ClinicSettingsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const fileInput = useRef<HTMLInputElement | null>(null);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [savingClinic, setSavingClinic] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [clinicForm, setClinicForm] = useState<ClinicForm>(() => clinicToForm(clinic));
    const [cityName, setCityName] = useState('');
    const [pendingCityName, setPendingCityName] = useState<string | null>(null);
    const [savingCity, setSavingCity] = useState(false);
    const [operatingHours, setOperatingHours] = useState<OperatingHourForm[]>(() => buildOperatingHours(clinic));
    const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState<string | null>(null);
    const [bulkDays, setBulkDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [bulkMode, setBulkMode] = useState<BulkOperatingMode>('open');
    const [bulkOpenTime, setBulkOpenTime] = useState('09:00:00');
    const [bulkCloseTime, setBulkCloseTime] = useState('21:00:00');
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminForm, setAdminForm] = useState<AdminForm>(emptyAdminForm);
    const [savingAdmin, setSavingAdmin] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<ClinicAdmin | null>(null);
    const [deletingAdmin, setDeletingAdmin] = useState<ClinicAdmin | null>(null);
    const [deletingClinic, setDeletingClinic] = useState(false);
    const isSuperadmin = context.role === 'superadmin';

    useEffect(() => {
        setClinicForm(clinicToForm(clinic));
        setCityName('');
        setPendingCityName(null);
        setSavingCity(false);
        setOperatingHours(buildOperatingHours(clinic));
        setErrors({});
        setError(null);
        if (fileInput.current) {
            fileInput.current.value = '';
        }
        setLocalImagePreviewUrl((currentUrl) => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }

            return null;
        });
        setShowAdminModal(false);
        setAdminForm(emptyAdminForm);
        setEditingAdmin(null);
        setDeletingAdmin(null);
        setDeletingClinic(false);
    }, [clinic?.id]);

    useEffect(() => {
        if (pendingCityName === null) {
            return;
        }

        const newCity = clinicCities.find((city) => city.name.toLowerCase() === pendingCityName.toLowerCase());

        if (!newCity) {
            return;
        }

        setClinicForm((current) => ({ ...current, city_id: String(newCity.id) }));
        setPendingCityName(null);
    }, [clinicCities, pendingCityName]);

    const summaryCards = [
        {
            label: 'Dokter Terdaftar',
            value: summary.doctor_count,
            helper: 'Dokter yang terhubung ke klinik',
        },
        {
            label: 'Jadwal Aktif',
            value: summary.active_schedule_count,
            helper: 'Jadwal praktik dokter aktif',
        },
        {
            label: 'Reservasi Hari Ini',
            value: summary.today_reservation_count,
            helper: 'Semua status reservasi hari ini',
        },
        {
            label: 'Antrean Aktif',
            value: summary.active_queue_count,
            helper: 'Queue approved yang masih berjalan',
        },
        {
            label: 'Hari Operasional',
            value: `${summary.operating_day_count}/7`,
            helper: 'Hari klinik tidak ditandai tutup',
        },
        {
            label: 'Rekam Medis Bulan Ini',
            value: context.role === 'superadmin' ? 'Hidden' : summary.medical_records_this_month ?? 0,
            helper: 'Hanya untuk admin klinik',
        },
    ];

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
                    open_time: hour.is_closed ? null : withSeconds(hour.open_time),
                    close_time: hour.is_closed ? null : withSeconds(hour.close_time),
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

    const submitCity = () => {
        const normalizedCityName = cityName.trim().replace(/\s+/g, ' ');

        if (normalizedCityName === '') {
            return;
        }

        setSavingCity(true);
        setPendingCityName(normalizedCityName);

        router.post(
            '/clinic-cities',
            { name: normalizedCityName },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setCityName(''),
                onError: (validationErrors) => {
                    setPendingCityName(null);
                    setErrors(normalizeInertiaErrors(validationErrors));
                    setError('Gagal menambahkan kota klinik.');
                },
                onFinish: () => setSavingCity(false),
            },
        );
    };

    const uploadImage = () => {
        if (clinic === null) {
            return;
        }

        const file = fileInput.current?.files?.[0];

        if (!file) {
            setError('Pilih file foto klinik terlebih dahulu.');
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
                setLocalImagePreviewUrl((currentUrl) => {
                    if (currentUrl) {
                        URL.revokeObjectURL(currentUrl);
                    }

                    return null;
                });
            },
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError('Gagal mengunggah foto klinik.');
            },
            onFinish: () => setUploading(false),
        });
    };

    const previewSelectedImage = () => {
        const file = fileInput.current?.files?.[0];

        setLocalImagePreviewUrl((currentUrl) => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }

            return file ? URL.createObjectURL(file) : null;
        });
    };

    const clearSelectedImage = () => {
        if (fileInput.current) {
            fileInput.current.value = '';
        }

        setLocalImagePreviewUrl((currentUrl) => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }

            return null;
        });
    };

    const applyBulkOperatingHours = () => {
        if (bulkDays.length === 0) {
            setError('Pilih minimal satu hari untuk menerapkan jam operasional.');
            return;
        }

        setError(null);
        setOperatingHours((current) => current.map((hour) => {
            if (!bulkDays.includes(hour.day_of_week)) {
                return hour;
            }

            if (bulkMode === 'closed') {
                return {
                    ...hour,
                    is_closed: true,
                };
            }

            if (bulkMode === 'full_day') {
                return {
                    ...hour,
                    open_time: '00:00:00',
                    close_time: '23:59:00',
                    is_closed: false,
                };
            }

            return {
                ...hour,
                open_time: withSeconds(bulkOpenTime),
                close_time: withSeconds(bulkCloseTime),
                is_closed: false,
            };
        }));
    };

    const openAdminModal = () => {
        setAdminForm(emptyAdminForm);
        setEditingAdmin(null);
        setErrors({});
        setError(null);
        setShowAdminModal(true);
    };

    const openEditAdminModal = (admin: ClinicAdmin) => {
        setAdminForm({
            name: admin.name,
            username: admin.username,
            email: admin.email,
            phone_number: admin.phone_number ?? '',
            date_of_birth: admin.date_of_birth ?? '',
            gender: admin.gender ?? '',
            password: '',
            password_confirmation: '',
        });
        setEditingAdmin(admin);
        setErrors({});
        setError(null);
        setShowAdminModal(true);
    };

    const closeAdminModal = () => {
        setShowAdminModal(false);
        setEditingAdmin(null);
        setAdminForm(emptyAdminForm);
        setErrors({});
    };

    const submitAdmin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (clinic === null) {
            return;
        }

        setSavingAdmin(true);
        setErrors({});
        setError(null);

        const payload: Record<string, string | null> = {
            name: adminForm.name,
            username: adminForm.username,
            email: adminForm.email,
            phone_number: adminForm.phone_number || null,
            date_of_birth: adminForm.date_of_birth || null,
            gender: adminForm.gender || null,
        };

        if (editingAdmin === null || adminForm.password !== '' || adminForm.password_confirmation !== '') {
            payload.password = adminForm.password;
            payload.password_confirmation = adminForm.password_confirmation;
        }

        const options = {
            preserveScroll: true,
            onSuccess: () => closeAdminModal(),
            onError: (validationErrors: Record<string, string | string[]>) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError(editingAdmin === null ? 'Gagal membuat admin klinik.' : 'Gagal memperbarui admin klinik.');
            },
            onFinish: () => setSavingAdmin(false),
        };

        if (editingAdmin === null) {
            router.post(`/clinic-settings/${clinic.id}/admins`, payload, options);
            return;
        }

        router.patch(`/clinic-settings/${clinic.id}/admins/${editingAdmin.id}`, payload, options);
    };

    const deleteAdmin = () => {
        if (clinic === null || deletingAdmin === null) {
            return;
        }

        setSavingAdmin(true);
        setErrors({});
        setError(null);

        router.delete(`/clinic-settings/${clinic.id}/admins/${deletingAdmin.id}`, {
            preserveScroll: true,
            onSuccess: () => setDeletingAdmin(null),
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError('Gagal menghapus admin klinik.');
            },
            onFinish: () => setSavingAdmin(false),
        });
    };

    const deleteClinic = () => {
        if (!isSuperadmin || clinic === null) {
            return;
        }

        setSavingClinic(true);
        setErrors({});
        setError(null);

        router.delete(`/superadmin/clinic/delete/${clinic.id}`, {
            preserveScroll: true,
            onSuccess: () => router.visit('/clinics'),
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError(validationErrors.clinic ?? 'Gagal menghapus klinik.');
            },
            onFinish: () => setSavingClinic(false),
        });
    };

    return (
        <AppLayout>
            <Head title="Pengaturan Klinik" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    {flash?.status ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[12px] font-medium text-green-700">{flash.status}</div> : null}
                    {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-600">{error}</div> : null}

                    {clinic === null ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-600">
                            Tidak ada klinik yang tersedia untuk akun ini.
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                                {summaryCards.map((card) => (
                                    <div key={card.label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                                        <p className="mb-1 text-[11px] text-gray-400">{card.label}</p>
                                        <p className="text-[24px] font-medium text-[#40311D]">{card.value}</p>
                                        <p className="mt-1 text-[10px] text-gray-400">{card.helper}</p>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={submitClinic} className="flex flex-col gap-4">
                                <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
                                    <Panel title="Profil Klinik" subtitle="Foto identitas klinik">
                                        <div className="p-4">
                                            <div className="flex items-center gap-4">
                                                {clinic.image_url ? (
                                                    <img src={clinic.image_url} alt={clinic.name} className="h-24 w-24 rounded-xl object-cover" />
                                                ) : (
                                                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-[#40311D] text-xl font-bold text-white">
                                                        {clinic.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="truncate text-[15px] font-medium text-[#40311D]">{clinic.name}</p>
                                                    <p className="truncate text-[12px] text-gray-500">{clinic.email}</p>
                                                </div>
                                            </div>

                                            <div className="mt-5 flex flex-col gap-3">
                                                {localImagePreviewUrl ? (
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={clearSelectedImage}
                                                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#2c2115] text-[14px] leading-none text-white shadow-sm transition-colors hover:bg-red-600"
                                                            aria-label="Hapus foto yang dipilih"
                                                        >
                                                            x
                                                        </button>
                                                        <img
                                                            src={localImagePreviewUrl}
                                                            alt={`Preview foto baru ${clinic.name}`}
                                                            className="h-48 w-full rounded-xl border border-[#e4ddd4] bg-[#faf9f7] object-contain p-2"
                                                        />
                                                    </div>
                                                ) : null}
                                                <input
                                                    ref={fileInput}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                                    onChange={previewSelectedImage}
                                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700"
                                                />
                                                {errors.image?.[0] ? <span className="text-[11px] font-medium text-red-600">{errors.image[0]}</span> : null}
                                                <button
                                                    type="button"
                                                    onClick={uploadImage}
                                                    disabled={uploading}
                                                    className="rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {uploading ? 'Mengunggah...' : 'Upload Foto Klinik'}
                                                </button>
                                            </div>
                                        </div>
                                    </Panel>

                                    <Panel title="Data Klinik" subtitle="Informasi utama klinik">
                                        <div className="grid gap-4 p-4 md:grid-cols-2">
                                            <TextField label="Nama Klinik" value={clinicForm.name} error={errors.name?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, name: value }))} />
                                            <TextField label="Email" type="email" value={clinicForm.email} error={errors.email?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, email: value }))} />
                                            <TextField label="Nomor Telepon" value={clinicForm.phone_number} error={errors.phone_number?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, phone_number: value }))} />
                                            <CitySelect
                                                value={clinicForm.city_id}
                                                cities={clinicCities}
                                                error={errors.city_id?.[0]}
                                                onChange={(value) => setClinicForm((current) => ({ ...current, city_id: value }))}
                                            />
                                            <TextField label="Alamat" value={clinicForm.address} error={errors.address?.[0]} onChange={(value) => setClinicForm((current) => ({ ...current, address: value }))} />
                                            <div className="md:col-span-2 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4">
                                                <p className="text-[12px] font-medium text-[#40311D]">Tambah pilihan kota</p>
                                                <p className="mt-1 text-[11px] text-gray-400">Tambahkan master kota baru jika belum tersedia di dropdown.</p>
                                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                                    <input
                                                        type="text"
                                                        value={cityName}
                                                        onChange={(event) => setCityName(event.target.value)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.preventDefault();
                                                                submitCity();
                                                            }
                                                        }}
                                                        placeholder="Contoh: Jakarta Pusat"
                                                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none placeholder:italic placeholder:text-gray-400 focus:border-[#40311D]"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={submitCity}
                                                        disabled={savingCity || cityName.trim() === ''}
                                                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {savingCity ? 'Menambah...' : 'Tambah Kota'}
                                                    </button>
                                                </div>
                                                {errors.city_name?.[0] ? <span className="mt-2 block text-[11px] font-medium text-red-600">{errors.city_name[0]}</span> : null}
                                            </div>
                                        </div>
                                    </Panel>
                                </div>

                                <Panel title="Jam Operasional Klinik" subtitle="Hari dan jam buka yang menjadi batas validasi jadwal dokter">
                                    <div className="border-b border-[#e4ddd4] bg-[#faf9f7] p-4">
                                        <div className="flex flex-col xl:gap-4 gap-6 xl:flex-row items-center xl:justify-between">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {dayOptions.map((day) => {
                                                        const selected = bulkDays.includes(day.value);

                                                        return (
                                                            <button
                                                                key={day.value}
                                                                type="button"
                                                                onClick={() => setBulkDays((current) => toggleNumber(current, day.value))}
                                                                className={`h-10 min-w-12 rounded-full border px-3 text-[12px] font-medium transition ${
                                                                    selected
                                                                        ? 'border-[#40311D] bg-[#40311D] text-white'
                                                                        : 'border-gray-200 bg-white text-[#40311D] hover:bg-[#DFE0DF]'
                                                                }`}
                                                            >
                                                                {day.short}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex flex-col xl:flex-row gap-3 xl:min-w-[680px] items-end justify-end ">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <ModeButton active={bulkMode === 'open'} onClick={() => setBulkMode('open')}>Buka sesuai jam</ModeButton>
                                                    <ModeButton active={bulkMode === 'full_day'} onClick={() => setBulkMode('full_day')}>Buka 24 jam</ModeButton>
                                                    <ModeButton active={bulkMode === 'closed'} onClick={() => setBulkMode('closed')}>Tutup</ModeButton>
                                                </div>

                                                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                                    <label className="flex flex-col gap-1 text-[11px] font-medium text-[#40311D]">
                                                        Jam Buka
                                                        <input
                                                            type="time"
                                                            value={bulkOpenTime}
                                                            disabled={bulkMode !== 'open'}
                                                            onChange={(event) => setBulkOpenTime(event.target.value)}
                                                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-400"
                                                        />
                                                    </label>
                                                    <label className="flex flex-col gap-1 text-[11px] font-medium text-[#40311D]">
                                                        Jam Tutup
                                                        <input
                                                            type="time"
                                                            value={bulkCloseTime}
                                                            disabled={bulkMode !== 'open'}
                                                            onChange={(event) => setBulkCloseTime(event.target.value)}
                                                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-400"
                                                        />
                                                    </label>
                                                    <div className="flex items-end">
                                                        <button
                                                            type="button"
                                                            onClick={applyBulkOperatingHours}
                                                            className="w-full rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#2c2115] md:w-auto"
                                                        >
                                                            Terapkan
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[860px] border-collapse text-[12px]">
                                            <thead>
                                                <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                    {['Hari', 'Status', 'Jam Buka', 'Jam Tutup'].map((header) => (
                                                        <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                            {header}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {operatingHours.map((hour, index) => (
                                                    <tr key={hour.day_of_week} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                                                        <td className="px-4 py-3 align-top">
                                                            <p className="font-medium text-[#40311D]">{dayLabel(hour.day_of_week)}</p>
                                                            <p className="mt-0.5 text-[11px] text-gray-400">
                                                                {hour.is_closed ? 'Klinik tutup pada hari ini' : `${hour.open_time} - ${hour.close_time}`}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3 align-top">
                                                            <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-600">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={hour.is_closed}
                                                                    onChange={(event) => updateOperatingHour(index, { is_closed: event.target.checked }, setOperatingHours)}
                                                                />
                                                                Tutup
                                                            </label>
                                                        </td>
                                                        <td className="px-4 py-3 align-top">
                                                            <TextField compact type="time" value={hour.open_time} disabled={hour.is_closed} error={errors[`operating_hours.${index}.open_time`]?.[0]} onChange={(value) => updateOperatingHour(index, { open_time: value }, setOperatingHours)} />
                                                        </td>
                                                        <td className="px-4 py-3 align-top">
                                                            <TextField compact type="time" value={hour.close_time} disabled={hour.is_closed} error={errors[`operating_hours.${index}.close_time`]?.[0]} onChange={(value) => updateOperatingHour(index, { close_time: value }, setOperatingHours)} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-end border-t border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
                                        <button
                                            type="submit"
                                            disabled={savingClinic}
                                            className="rounded-lg bg-[#40311D] px-5 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {savingClinic ? 'Menyimpan...' : 'Simpan Pengaturan Klinik'}
                                        </button>
                                    </div>
                                </Panel>
                            </form>

                            {isSuperadmin ? (
                                <>
                                    <Panel
                                        title="Admin Klinik Terdaftar"
                                        subtitle="Akun admin yang terhubung dengan klinik ini"
                                        action={(
                                            <button
                                                type="button"
                                                onClick={openAdminModal}
                                                className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#2c2115]"
                                            >
                                                Tambah Admin Klinik
                                            </button>
                                        )}
                                    >
                                        <ClinicAdminsTable admins={clinic.admins ?? []} onEdit={openEditAdminModal} onDelete={setDeletingAdmin} />
                                    </Panel>

                                    <Panel title="Hapus Klinik" subtitle="Aksi destruktif hanya tersedia di halaman detail klinik">
                                        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                                            <p className="text-[12px] text-gray-500">
                                                Klinik hanya dapat dihapus jika tidak memiliki admin, dokter terassign, jadwal dokter, reservasi, atau rekam medis.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setDeletingClinic(true)}
                                                disabled={savingClinic}
                                                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                Hapus Klinik
                                            </button>
                                        </div>
                                    </Panel>
                                </>
                            ) : null}
                        </>
                    )}
                </div>
            </section>

            {showAdminModal && clinic !== null ? (
                <CreateAdminModal
                    mode={editingAdmin === null ? 'create' : 'edit'}
                    clinicName={clinic.name}
                    form={adminForm}
                    errors={errors}
                    saving={savingAdmin}
                    onChange={setAdminForm}
                    onClose={closeAdminModal}
                    onSubmit={submitAdmin}
                />
            ) : null}

            {deletingAdmin !== null ? (
                <DeleteAdminModal
                    admin={deletingAdmin}
                    saving={savingAdmin}
                    onClose={() => setDeletingAdmin(null)}
                    onConfirm={deleteAdmin}
                />
            ) : null}

            {deletingClinic && clinic !== null ? (
                <DeleteClinicModal
                    clinicName={clinic.name}
                    saving={savingClinic}
                    onClose={() => setDeletingClinic(false)}
                    onConfirm={deleteClinic}
                />
            ) : null}
        </AppLayout>
    );
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
                <div>
                    <p className="text-[13px] font-medium text-[#40311D]">{title}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function ClinicAdminsTable({ admins, onEdit, onDelete }: { admins: ClinicAdmin[]; onEdit: (admin: ClinicAdmin) => void; onDelete: (admin: ClinicAdmin) => void }) {
    if (admins.length === 0) {
        return (
            <div className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                Belum ada admin klinik yang terdaftar.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-[12px]">
                <thead>
                    <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                        {['No', 'Nama', 'Username', 'Email', 'Telepon', 'Gender', 'Tanggal Lahir', 'Verified', 'Aksi'].map((header) => (
                            <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {admins.map((admin, index) => (
                        <tr key={admin.id} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                            <td className="px-4 py-3 text-gray-700">{String(index + 1).padStart(2, '0')}</td>
                            <td className="px-4 py-3 font-medium text-[#40311D]">{admin.name}</td>
                            <td className="px-4 py-3 text-gray-700">{admin.username}</td>
                            <td className="px-4 py-3 text-gray-700">{admin.email}</td>
                            <td className="px-4 py-3 text-gray-700">{admin.phone_number ?? '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{admin.gender ?? '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{admin.date_of_birth ?? '-'}</td>
                            <td className="px-4 py-3 text-gray-700">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${admin.email_verified_at ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {admin.email_verified_at ? 'Verified' : 'Belum'}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onEdit(admin)}
                                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF]"
                                    >
                                        Update
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(admin)}
                                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CreateAdminModal({
    mode,
    clinicName,
    form,
    errors,
    saving,
    onChange,
    onClose,
    onSubmit,
}: {
    mode: 'create' | 'edit';
    clinicName: string;
    form: AdminForm;
    errors: ValidationErrors;
    saving: boolean;
    onChange: (form: AdminForm) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    const isEdit = mode === 'edit';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form onSubmit={onSubmit} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <p className="text-[16px] font-medium text-[#40311D]">{isEdit ? 'Update Admin Klinik' : 'Tambah Admin Klinik'}</p>
                    <p className="mt-1 text-[12px] text-gray-400">
                        {isEdit
                            ? `Perbarui data admin yang terhubung dengan ${clinicName}. Kosongkan password jika tidak ingin mengubahnya.`
                            : `Admin baru akan langsung terhubung dan terverifikasi untuk ${clinicName}.`}
                    </p>
                </div>

                <div className="grid gap-3 p-5 md:grid-cols-2">
                    <TextField label="Nama" value={form.name} error={errors.name?.[0]} onChange={(value) => onChange({ ...form, name: value })} />
                    <TextField label="Username" value={form.username} error={errors.username?.[0]} onChange={(value) => onChange({ ...form, username: value })} />
                    <TextField label="Email" type="email" value={form.email} error={errors.email?.[0]} onChange={(value) => onChange({ ...form, email: value })} />
                    <TextField label="Nomor Telepon" value={form.phone_number} error={errors.phone_number?.[0]} onChange={(value) => onChange({ ...form, phone_number: value })} />
                    <TextField label="Tanggal Lahir" type="date" value={form.date_of_birth} error={errors.date_of_birth?.[0]} onChange={(value) => onChange({ ...form, date_of_birth: value })} />
                    <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                        Gender
                        <select
                            value={form.gender}
                            onChange={(event) => onChange({ ...form, gender: event.target.value })}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                        >
                            <option value="">Tidak diisi</option>
                            <option value="Laki">Laki</option>
                            <option value="Perempuan">Perempuan</option>
                        </select>
                        {errors.gender?.[0] ? <span className="text-[11px] font-medium text-red-600">{errors.gender[0]}</span> : null}
                    </label>
                    <TextField label="Password" type="password" value={form.password} error={errors.password?.[0]} onChange={(value) => onChange({ ...form, password: value })} />
                    <TextField label="Konfirmasi Password" type="password" value={form.password_confirmation} error={errors.password_confirmation?.[0]} onChange={(value) => onChange({ ...form, password_confirmation: value })} />
                </div>

                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition hover:bg-[#DFE0DF]"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Menyimpan...' : isEdit ? 'Update Admin' : 'Simpan Admin'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function DeleteAdminModal({ admin, saving, onClose, onConfirm }: { admin: ClinicAdmin; saving: boolean; onClose: () => void; onConfirm: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <p className="text-[16px] font-medium text-[#40311D]">Hapus Admin Klinik</p>
                    <p className="mt-1 text-[12px] text-gray-400">Akun admin akan dihapus dari sistem.</p>
                </div>
                <div className="p-5 text-[12px] text-gray-600">
                    Hapus akun <span className="font-medium text-[#40311D]">{admin.name}</span> ({admin.email})?
                </div>
                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Menghapus...' : 'Hapus Admin'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeleteClinicModal({ clinicName, saving, onClose, onConfirm }: { clinicName: string; saving: boolean; onClose: () => void; onConfirm: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="border-b border-red-100 bg-red-50 px-5 py-4">
                    <p className="text-[16px] font-medium text-red-700">Hapus Klinik</p>
                    <p className="mt-1 text-[12px] text-red-500">Klinik hanya dapat dihapus jika belum memiliki data terkait.</p>
                </div>
                <div className="space-y-3 p-5 text-[12px] text-gray-600">
                    <p>
                        Anda akan menghapus <span className="font-medium text-[#40311D]">{clinicName}</span>.
                    </p>
                    <p>
                        Sistem akan menolak penghapusan jika klinik masih memiliki admin, dokter terassign, jadwal dokter, reservasi, atau rekam medis.
                    </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="rounded-lg bg-red-600 px-4 py-2 text-[12px] font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Menghapus...' : 'Hapus Klinik'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                active
                    ? 'border-[#40311D] bg-[#40311D] text-white'
                    : 'border-gray-200 bg-white text-[#40311D] hover:bg-[#DFE0DF]'
            }`}
        >
            {children}
        </button>
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
    label?: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    disabled?: boolean;
    compact?: boolean;
}) {
    return (
        <label className={`flex flex-col gap-2 text-[12px] font-medium text-[#40311D] ${compact ? 'text-[11px]' : ''}`}>
            {label}
            <input
                type={type}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-400"
            />
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </label>
    );
}

function CitySelect({ value, cities, onChange, error }: { value: string; cities: ClinicCityOption[]; onChange: (value: string) => void; error?: string }) {
    return (
        <label className="flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
            Kota
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
            >
                <option value="">Pilih kota</option>
                {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                        {city.name}
                    </option>
                ))}
            </select>
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </label>
    );
}

function clinicToForm(clinic: ClinicDetail | null): ClinicForm {
    return {
        name: clinic?.name ?? '',
        address: clinic?.address ?? '',
        city_id: clinic?.city_id ? String(clinic.city_id) : '',
        phone_number: clinic?.phone_number ?? '',
        email: clinic?.email ?? '',
    };
}

function buildOperatingHours(clinic: ClinicDetail | null): OperatingHourForm[] {
    const existing = new Map((clinic?.operating_hours ?? []).map((hour) => [hour.day_of_week, hour]));

    return dayOptions.map((day) => {
        const hour = existing.get(day.value);

        return {
            day_of_week: day.value,
            open_time: hour?.open_time ?? '08:00:00',
            close_time: hour?.close_time ?? '17:00:00',
            is_closed: Boolean(hour?.is_closed ?? false),
        };
    });
}

function dayLabel(value: number): string {
    return dayOptions.find((day) => day.value === value)?.label ?? String(value);
}

function toggleNumber(values: number[], value: number): number[] {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}

function withSeconds(value: string): string {
    if (value.length === 5) {
        return `${value}:00`;
    }

    return value;
}

function updateOperatingHour(index: number, patch: Partial<OperatingHourForm>, setOperatingHours: (updater: (current: OperatingHourForm[]) => OperatingHourForm[]) => void) {
    setOperatingHours((current) => current.map((hour, currentIndex) => (currentIndex === index ? { ...hour, ...patch } : hour)));
}

function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}
