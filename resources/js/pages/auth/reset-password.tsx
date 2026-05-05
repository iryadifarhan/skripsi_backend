import { Head, router } from '@inertiajs/react';
import { type FormEvent, useState } from 'react';

import {
    AuthPageShell,
    BrandHeader,
    normalizeInertiaErrors,
    PasswordInput,
    PrimaryButton,
    TextInput,
} from '@/components/auth/auth-ui';
import type { ValidationErrors } from '@/types';

type ResetPasswordProps = {
    token: string;
    email: string;
};

export default function ResetPassword({ token, email: initialEmail }: ResetPasswordProps) {
    const [form, setForm] = useState({
        token,
        email: initialEmail,
        password: '',
        password_confirmation: '',
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [processing, setProcessing] = useState(false);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post('/reset-password', form, {
            onError: (validationErrors) => setErrors(normalizeInertiaErrors(validationErrors)),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <>
            <Head title="Reset Kata Sandi" />
            <AuthPageShell>
                <BrandHeader title="Reset Kata Sandi" />

                <form className="space-y-5" onSubmit={submit}>
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

                    <PrimaryButton processing={processing}>{processing ? 'Menyimpan...' : 'Lanjut'}</PrimaryButton>
                </form>
            </AuthPageShell>
        </>
    );
}
