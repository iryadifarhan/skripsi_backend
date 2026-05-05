import { Head, router } from '@inertiajs/react';
import { type FormEvent, useState } from 'react';

import {
    AuthFooter,
    AuthLink,
    AuthPageShell,
    BrandHeader,
    ConfirmModal,
    FieldErrors,
    normalizeInertiaErrors,
    PasswordInput,
    PrimaryButton,
    TextInput,
} from '@/components/auth/auth-ui';
import type { ValidationErrors } from '@/types';

export default function Register() {
    const [form, setForm] = useState({
        name: '',
        username: '',
        phone_number: '',
        email: '',
        date_of_birth: '',
        gender: 'Laki',
        password: '',
        password_confirmation: '',
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [processing, setProcessing] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setShowConfirmModal(true);
    };

    const confirmSubmit = () => {
        setProcessing(true);
        setErrors({});

        router.post(
            '/register',
            {
                ...form,
                phone_number: form.phone_number || null,
                date_of_birth: form.date_of_birth || null,
                gender: form.gender || null,
            },
            {
                onError: (validationErrors) => {
                    setErrors(normalizeInertiaErrors(validationErrors));
                    setShowConfirmModal(false);
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <>
            <Head title="Daftar" />
            <AuthPageShell>
                <BrandHeader title="Daftar" showBack />

                <form className="space-y-4 sm:space-y-5" onSubmit={submit}>
                    <TextInput
                        id="name"
                        label="Nama*"
                        placeholder="Pasien Satu"
                        value={form.name}
                        required
                        errors={errors.name}
                        onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                    />

                    <TextInput
                        id="username"
                        label="Nama User*"
                        placeholder="Pasien_Satu"
                        value={form.username}
                        required
                        errors={errors.username}
                        onChange={(value) => setForm((current) => ({ ...current, username: value }))}
                    />

                    <TextInput
                        id="phone_number"
                        label="Nomor Telepon"
                        type="tel"
                        placeholder="+628111111111"
                        value={form.phone_number}
                        errors={errors.phone_number}
                        onChange={(value) => setForm((current) => ({ ...current, phone_number: value }))}
                    />

                    <TextInput
                        id="email"
                        label="Email*"
                        type="email"
                        placeholder="CliniQ@gmail.co.id"
                        value={form.email}
                        required
                        errors={errors.email}
                        onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                    />

                    <div className="grid gap-4 sm:gap-5 md:grid-cols-2 md:items-end">
                        <TextInput
                            id="date_of_birth"
                            label="Tanggal Lahir"
                            type="date"
                            value={form.date_of_birth}
                            errors={errors.date_of_birth}
                            onChange={(value) => setForm((current) => ({ ...current, date_of_birth: value }))}
                        />

                        <div>
                            <p className="mb-1.5 text-[clamp(0.9rem,2.5vw,1.25rem)] font-medium text-[#40311D]">Gender</p>
                            <div className="grid gap-2 min-[420px]:grid-cols-2">
                                {[
                                    { value: 'Laki', label: 'Laki-laki' },
                                    { value: 'Perempuan', label: 'Perempuan' },
                                ].map((option) => (
                                    <label
                                        key={option.value}
                                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#40311D] px-3 py-2.5 text-xs font-medium transition sm:py-3 ${
                                            form.gender === option.value ? 'bg-[#40311D] text-[#DED0B6]' : 'text-[#40311D]'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="gender"
                                            value={option.value}
                                            checked={form.gender === option.value}
                                            onChange={() => setForm((current) => ({ ...current, gender: option.value }))}
                                            className="accent-[#40311D]"
                                        />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                            <FieldErrors errors={errors.gender} />
                        </div>
                    </div>

                    <PasswordInput
                        id="password"
                        label="Kata Sandi*"
                        placeholder="Clin123!!"
                        value={form.password}
                        required
                        errors={errors.password}
                        onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                    />

                    <PasswordInput
                        id="password_confirmation"
                        label="Konfirmasi Kata Sandi*"
                        placeholder="Clin123!!"
                        value={form.password_confirmation}
                        required
                        onChange={(value) => setForm((current) => ({ ...current, password_confirmation: value }))}
                    />

                    <PrimaryButton processing={processing}>{processing ? 'Menyimpan...' : 'Daftar'}</PrimaryButton>
                </form>

                <AuthFooter>
                    Sudah punya akun? <AuthLink href="/login">Masuk</AuthLink>
                </AuthFooter>
            </AuthPageShell>

            {showConfirmModal ? (
                <ConfirmModal
                    title="Pastikan data diri yang anda isi sesuai!"
                    confirmLabel={processing ? 'Memproses...' : 'Lanjut'}
                    processing={processing}
                    onCancel={() => setShowConfirmModal(false)}
                    onConfirm={confirmSubmit}
                />
            ) : null}
        </>
    );
}
