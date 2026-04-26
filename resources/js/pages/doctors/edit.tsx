import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import type { ClinicDetail, DoctorEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type DoctorEditPageProps = {
    context: WorkspaceContext;
    doctorId: number;
    clinicId: number;
    clinic: ClinicDetail;
    doctor: DoctorEntry;
};

type DoctorForm = {
    name: string;
    username: string;
    email: string;
    phone_number: string;
    date_of_birth: string;
    gender: string;
    specialities: string;
};

export default function DoctorEditPage({ clinicId, clinic, doctor: initialDoctor }: DoctorEditPageProps) {
    const { flash } = usePage<SharedData>().props;
    const doctor = initialDoctor;
    const [form, setForm] = useState<DoctorForm>({
        name: initialDoctor.name,
        username: initialDoctor.username,
        email: initialDoctor.email,
        phone_number: initialDoctor.phone_number ?? '',
        date_of_birth: initialDoctor.date_of_birth ?? '',
        gender: initialDoctor.gender ?? '',
        specialities: (initialDoctor.specialities ?? []).join(', '),
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInput = useRef<HTMLInputElement | null>(null);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
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
                specialities: parseSpecialities(form.specialities),
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

    const uploadImage = async () => {
        const file = fileInput.current?.files?.[0];

        if (!file) {
            return;
        }

        setUploading(true);
        setError(null);

        const payload = new FormData();
        payload.append('clinic_id', String(clinicId));
        payload.append('image', file);

        router.post(`/doctors/${doctor.id}/image`, payload, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                if (fileInput.current) {
                    fileInput.current.value = '';
                }
            },
            onError: (validationErrors) => {
                setErrors(normalizeInertiaErrors(validationErrors));
                setError('Gagal mengunggah foto dokter.');
            },
            onFinish: () => setUploading(false),
        });
    };

    return (
        <AppLayout>
            <Head title="Edit Data Dokter" />

            <section className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-[#555]">{doctor?.name ?? 'Edit Dokter'}</h2>
                        <p className="mt-1 text-sm font-semibold text-[#8b8f98]">{clinic?.name ?? '-'}</p>
                    </div>
                    <Link
                        href={`/doctors?clinic_id=${clinicId}`}
                        className="inline-flex rounded-md bg-[#dedede] px-4 py-3 text-sm font-extrabold text-[#777] transition hover:bg-[#d2d2d2]"
                    >
                        Kembali
                    </Link>
                </div>

                {flash?.status ? <div className="rounded-lg border border-green-200 bg-white p-4 text-sm font-semibold text-green-700">{flash.status}</div> : null}
                {error ? <div className="rounded-lg border border-red-200 bg-white p-4 text-sm font-semibold text-red-600">{error}</div> : null}

                <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
                    <section className="rounded-lg border border-[#ccd2da] bg-white p-5">
                        <h3 className="text-sm font-extrabold text-[#929292]">Foto Dokter</h3>
                        <div className="mt-5 flex flex-col items-center gap-4">
                            {doctor.image_url ? (
                                <img src={doctor.image_url} alt={doctor.name} className="h-52 w-52 rounded-lg object-cover" />
                            ) : (
                                <div className="flex h-52 w-52 items-center justify-center rounded-lg bg-[#7d7f82] text-4xl font-extrabold text-white">
                                    {doctor.name.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <input
                                ref={fileInput}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="w-full rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm"
                            />
                            <button
                                type="button"
                                onClick={uploadImage}
                                disabled={uploading}
                                className="w-full rounded-md bg-[#343434] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {uploading ? 'Mengunggah...' : 'Upload Foto'}
                            </button>
                        </div>
                    </section>

                    <form onSubmit={submit} className="rounded-lg border border-[#ccd2da] bg-white p-5">
                        <h3 className="text-sm font-extrabold text-[#929292]">Ubah Data Dokter</h3>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <TextField label="Nama" value={form.name} error={errors.name?.[0]} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
                            <TextField label="Username" value={form.username} error={errors.username?.[0]} onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
                            <TextField label="Email" type="email" value={form.email} error={errors.email?.[0]} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                            <TextField label="Nomor Telepon" value={form.phone_number} error={errors.phone_number?.[0]} onChange={(value) => setForm((current) => ({ ...current, phone_number: value }))} />
                            <TextField label="Tanggal Lahir" type="date" value={form.date_of_birth} error={errors.date_of_birth?.[0]} onChange={(value) => setForm((current) => ({ ...current, date_of_birth: value }))} />
                            <label className="flex flex-col gap-2 text-sm font-semibold text-[#555]">
                                Gender
                                <select
                                    value={form.gender}
                                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                                    className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888]"
                                >
                                    <option value="">Tidak diisi</option>
                                    <option value="Laki">Laki</option>
                                    <option value="Perempuan">Perempuan</option>
                                </select>
                                {errors.gender?.[0] ? <span className="text-xs font-bold text-red-600">{errors.gender[0]}</span> : null}
                            </label>
                            <div className="md:col-span-2">
                                <TextField
                                    label="Spesialisasi"
                                    value={form.specialities}
                                    error={errors.specialities?.[0] ?? errors['specialities.0']?.[0]}
                                    placeholder="Contoh: Cardiology, Orthology"
                                    onChange={(value) => setForm((current) => ({ ...current, specialities: value }))}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="submit"
                                disabled={processing}
                                className="rounded-md bg-[#343434] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </form>
                </div>
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
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    placeholder?: string;
}) {
    return (
        <label className="flex flex-col gap-2 text-sm font-semibold text-[#555]">
            {label}
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888]"
            />
            {error ? <span className="text-xs font-bold text-red-600">{error}</span> : null}
        </label>
    );
}

function parseSpecialities(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item, index, items) => item !== '' && items.indexOf(item) === index);
}

function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}
