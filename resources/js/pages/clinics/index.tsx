import { Head, Link, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type ClinicsPageProps = {
    context: WorkspaceContext;
    clinics: ClinicIndexEntry[];
    clinicCities: ClinicCityOption[];
};

type ClinicCityOption = {
    id: number;
    name: string;
};

type ClinicIndexEntry = {
    id: number;
    name: string;
    address: string;
    city_id: number;
    city?: ClinicCityOption | null;
    city_name?: string | null;
    phone_number: string;
    email: string;
    image_url?: string | null;
    specialities: string[];
    doctor_count: number;
    admin_count: number;
    schedule_count: number;
    reservation_count: number;
    medical_record_count: number;
    operating_day_count: number;
};

type ClinicForm = {
    name: string;
    address: string;
    city_id: string;
    phone_number: string;
    email: string;
};

type PageProps = SharedData & {
    errors?: Record<string, string>;
};

const emptyClinicForm: ClinicForm = {
    name: '',
    address: '',
    city_id: '',
    phone_number: '',
    email: '',
};

export default function ClinicsPage({ context, clinics, clinicCities }: ClinicsPageProps) {
    const page = usePage<PageProps>();
    const [search, setSearch] = useState('');
    const [selectedClinicId, setSelectedClinicId] = useState<number | null>(clinics[0]?.id ?? null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [form, setForm] = useState<ClinicForm>(() => createEmptyClinicForm(clinicCities));
    const [cityName, setCityName] = useState('');
    const [pendingCityName, setPendingCityName] = useState<string | null>(null);
    const [savingCity, setSavingCity] = useState(false);
    const [saving, setSaving] = useState(false);

    const filteredClinics = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (keyword === '') {
            return clinics;
        }

        return clinics.filter((clinic) =>
            [clinic.name, clinic.email, clinic.phone_number, clinic.address, clinic.city_name, clinic.city?.name, ...clinic.specialities]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword)),
        );
    }, [clinics, search]);
    const clinicPagination = useClientPagination(filteredClinics);
    const selectedClinic = clinics.find((clinic) => clinic.id === selectedClinicId) ?? null;
    const errors = normalizePageErrors(page.props.errors ?? {});

    useEffect(() => {
        if (clinicPagination.paginatedItems.some((clinic) => clinic.id === selectedClinicId)) {
            return;
        }

        setSelectedClinicId(clinicPagination.paginatedItems[0]?.id ?? null);
    }, [clinicPagination.paginatedItems, selectedClinicId]);

    useEffect(() => {
        if (pendingCityName === null) {
            return;
        }

        const newCity = clinicCities.find((city) => city.name.toLowerCase() === pendingCityName.toLowerCase());

        if (!newCity) {
            return;
        }

        setForm((current) => ({ ...current, city_id: String(newCity.id) }));
        setPendingCityName(null);
    }, [clinicCities, pendingCityName]);

    const openCreateModal = () => {
        setForm(createEmptyClinicForm(clinicCities));
        setShowCreateModal(true);
    };

    const submitClinic = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setShowCreateModal(false);
                setForm(emptyClinicForm);
            },
            onFinish: () => setSaving(false),
        };

        router.post('/superadmin/clinic/create', form, options);
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
                onError: () => setPendingCityName(null),
                onFinish: () => setSavingCity(false),
            },
        );
    };

    return (
        <AppLayout>
            <Head title="Data Klinik" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    <FlashAndErrors page={page} />

                    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="flex min-w-[280px] flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Cari klinik
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Nama, email, telepon, kota, alamat, spesialisasi..."
                                    className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none placeholder:italic placeholder:text-gray-400 focus:border-[#40311D]"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="rounded-full bg-[#00917B] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#006d5c]"
                            >
                                Tambah Klinik
                            </button>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
                        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <CardHeader title="Daftar Klinik" subtitle="Data klinik yang dikelola superadmin" />
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] border-collapse text-[12px]">
                                    <thead>
                                        <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                            {['No', 'Klinik', 'Email', 'Telepon', 'Dokter', 'Admin', 'Jadwal', 'Operasional'].map((header) => (
                                                <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredClinics.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                                                    Tidak ada klinik yang sesuai filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            clinicPagination.paginatedItems.map((clinic, index) => (
                                                <tr
                                                    key={clinic.id}
                                                    onClick={() => setSelectedClinicId(clinic.id)}
                                                    className={`cursor-pointer border-b border-[#ede8e2] transition-colors last:border-0 hover:bg-[#faf9f7] ${
                                                        selectedClinicId === clinic.id ? 'bg-[#faf9f7]' : ''
                                                    }`}
                                                >
                                                    <td className="px-4 py-3 text-gray-700">{String(clinicPagination.startItem + index).padStart(2, '0')}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <ClinicAvatar clinic={clinic} />
                                                            <div className="min-w-0">
                                                                <p className="truncate font-medium text-[#2c2115]">{clinic.name}</p>
                                                                <p className="truncate text-[11px] text-gray-400">{clinic.city_name ?? clinic.city?.name ?? '-'}</p>
                                                                <p className="truncate text-[11px] text-gray-400">{clinic.address}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-700">{clinic.email}</td>
                                                    <td className="px-4 py-3 text-gray-700">{clinic.phone_number}</td>
                                                    <td className="px-4 py-3 text-gray-700">{clinic.doctor_count}</td>
                                                    <td className="px-4 py-3 text-gray-700">{clinic.admin_count}</td>
                                                    <td className="px-4 py-3 text-gray-700">{clinic.schedule_count}</td>
                                                    <td className="px-4 py-3 text-gray-700">
                                                        <StatusBadge active={clinic.operating_day_count > 0}>
                                                            {clinic.operating_day_count > 0 ? `${clinic.operating_day_count}/7 hari` : 'Belum aktif'}
                                                        </StatusBadge>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls
                                page={clinicPagination.page}
                                perPage={clinicPagination.perPage}
                                total={clinicPagination.total}
                                pageCount={clinicPagination.pageCount}
                                startItem={clinicPagination.startItem}
                                endItem={clinicPagination.endItem}
                                perPageOptions={clinicPagination.perPageOptions}
                                onPageChange={clinicPagination.setPage}
                                onPerPageChange={clinicPagination.setPerPage}
                            />
                        </section>

                        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <CardHeader title="Ringkasan Klinik" subtitle="Detail klinik terpilih" />
                            <div className="min-h-[300px] p-4 text-[12px] text-gray-600">
                                {selectedClinic === null ? (
                                    <p className="italic text-gray-400">Pilih klinik untuk melihat detail.</p>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <ClinicAvatar clinic={selectedClinic} large />
                                            <div className="min-w-0">
                                                <p className="truncate text-[14px] font-medium text-[#2c2115]">{selectedClinic.name}</p>
                                                <p className="truncate text-gray-400">{selectedClinic.email}</p>
                                            </div>
                                        </div>
                                        <InfoLine label="Telepon" value={selectedClinic.phone_number} />
                                        <InfoLine label="Kota" value={selectedClinic.city_name ?? selectedClinic.city?.name ?? '-'} />
                                        <InfoLine label="Alamat" value={selectedClinic.address} />
                                        <InfoLine label="Dokter" value={String(selectedClinic.doctor_count)} />
                                        <InfoLine label="Admin" value={String(selectedClinic.admin_count)} />
                                        <InfoLine label="Jadwal" value={String(selectedClinic.schedule_count)} />
                                        <InfoLine label="Reservasi" value={String(selectedClinic.reservation_count)} />
                                        <InfoLine label="Spesialisasi" value={selectedClinic.specialities.length > 0 ? selectedClinic.specialities.join(', ') : '-'} />

                                        <Link
                                            href={`/clinic-settings/${selectedClinic.id}`}
                                            className="block w-full rounded-lg bg-[#40311D] px-4 py-2.5 text-center text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115]"
                                        >
                                            Detail Klinik
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </aside>
                    </div>
                </div>
            </section>

            {showCreateModal ? (
                <ClinicFormModal
                    title="Tambah Data Klinik"
                    subtitle="Buat klinik baru dengan data utama lengkap."
                    form={form}
                    clinicCities={clinicCities}
                    errors={errors}
                    cityName={cityName}
                    savingCity={savingCity}
                    saving={saving}
                    submitLabel="Simpan Klinik"
                    onChange={setForm}
                    onCityNameChange={setCityName}
                    onCitySubmit={submitCity}
                    onClose={() => {
                        setShowCreateModal(false);
                        setForm(createEmptyClinicForm(clinicCities));
                        setCityName('');
                    }}
                    onSubmit={submitClinic}
                />
            ) : null}

        </AppLayout>
    );
}

function ClinicFormModal({
    title,
    subtitle,
    form,
    clinicCities,
    errors,
    cityName,
    savingCity,
    saving,
    submitLabel,
    onChange,
    onCityNameChange,
    onCitySubmit,
    onClose,
    onSubmit,
}: {
    title: string;
    subtitle: string;
    form: ClinicForm;
    clinicCities: ClinicCityOption[];
    errors: ValidationErrors;
    cityName: string;
    savingCity: boolean;
    saving: boolean;
    submitLabel: string;
    onChange: (form: ClinicForm) => void;
    onCityNameChange: (value: string) => void;
    onCitySubmit: () => void;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form onSubmit={onSubmit} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <p className="text-[16px] font-medium text-[#40311D]">{title}</p>
                    <p className="mt-1 text-[12px] text-gray-400">{subtitle}</p>
                </div>

                <div className="grid gap-3 p-5 md:grid-cols-2">
                    <TextInput label="Nama Klinik" value={form.name} error={errors.name?.[0]} onChange={(value) => onChange({ ...form, name: value })} />
                    <TextInput label="Email" type="email" value={form.email} error={errors.email?.[0]} onChange={(value) => onChange({ ...form, email: value })} />
                    <TextInput label="Nomor Telepon" value={form.phone_number} error={errors.phone_number?.[0]} onChange={(value) => onChange({ ...form, phone_number: value })} />
                    <CitySelect
                        value={form.city_id}
                        cities={clinicCities}
                        error={errors.city_id?.[0]}
                        onChange={(value) => onChange({ ...form, city_id: value })}
                    />
                    <TextInput label="Alamat" value={form.address} error={errors.address?.[0]} onChange={(value) => onChange({ ...form, address: value })} />
                </div>

                <div className="mx-5 mb-4 rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4">
                    <p className="text-[12px] font-medium text-[#40311D]">Tambah pilihan kota</p>
                    <p className="mt-1 text-[11px] text-gray-400">Gunakan ini jika kota belum tersedia di dropdown.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                            type="text"
                            value={cityName}
                            onChange={(event) => onCityNameChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    onCitySubmit();
                                }
                            }}
                            placeholder="Contoh: Kota Depok"
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none placeholder:italic placeholder:text-gray-400 focus:border-[#40311D]"
                        />
                        <button
                            type="button"
                            onClick={onCitySubmit}
                            disabled={savingCity || cityName.trim() === ''}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition-colors hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {savingCity ? 'Menambah...' : 'Tambah Kota'}
                        </button>
                    </div>
                    {errors.city_name?.[0] ? <span className="mt-2 block text-[11px] font-medium text-red-600">{errors.city_name[0]}</span> : null}
                    {errors.name?.[0] && cityName.trim() !== '' ? <span className="mt-2 block text-[11px] font-medium text-red-600">{errors.name[0]}</span> : null}
                </div>

                {errors.clinic?.[0] ? (
                    <div className="mx-5 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-600">
                        {errors.clinic[0]}
                    </div>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-[#e4ddd4] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition-colors hover:bg-[#DFE0DF]"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Menyimpan...' : submitLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}

function CitySelect({ value, cities, onChange, error }: { value: string; cities: ClinicCityOption[]; onChange: (value: string) => void; error?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            Kota
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
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

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
            <p className="text-[13px] font-medium text-[#40311D]">{title}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
        </div>
    );
}

function ClinicAvatar({ clinic, large = false }: { clinic: ClinicIndexEntry; large?: boolean }) {
    const size = large ? 'h-14 w-14' : 'h-10 w-10';

    if (clinic.image_url) {
        return <img src={clinic.image_url} alt={clinic.name} className={`${size} rounded-lg object-cover`} />;
    }

    return (
        <div className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-[#40311D] text-[11px] font-medium text-white`}>
            {clinic.name.slice(0, 2).toUpperCase()}
        </div>
    );
}

function StatusBadge({ active, children }: { active: boolean; children: ReactNode }) {
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${active ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
            {children}
        </span>
    );
}

function TextInput({ label, value, onChange, error, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
            />
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </label>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0">
            <span className="text-gray-400">{label}</span>
            <span className="text-right font-medium text-gray-700">{value}</span>
        </div>
    );
}

function FlashAndErrors({ page }: { page: { props: PageProps } }) {
    const firstError = Object.values(page.props.errors ?? {})[0];

    return (
        <>
            {page.props.flash?.status ? <Alert tone="success">{page.props.flash.status}</Alert> : null}
            {firstError ? <Alert tone="danger">{firstError}</Alert> : null}
        </>
    );
}

function Alert({ tone, children }: { tone: 'success' | 'danger'; children: ReactNode }) {
    const classes = tone === 'success'
        ? 'border-teal-200 bg-teal-50 text-teal-700'
        : 'border-red-200 bg-red-50 text-red-600';

    return <div className={`rounded-xl border px-4 py-3 text-[12px] ${classes}`}>{children}</div>;
}

function normalizePageErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}

function createEmptyClinicForm(cities: ClinicCityOption[]): ClinicForm {
    return {
        ...emptyClinicForm,
        city_id: cities[0] ? String(cities[0].id) : '',
    };
}
