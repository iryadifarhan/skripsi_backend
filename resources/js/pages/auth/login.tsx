import { Head, router, usePage } from '@inertiajs/react';
import { type FormEvent, useState } from 'react';

import {
    AuthFooter,
    AuthLink,
    AuthPageShell,
    BrandHeader,
    normalizeInertiaErrors,
    PasswordInput,
    PrimaryButton,
    TextInput,
} from '@/components/auth/auth-ui';
import type { SharedData, ValidationErrors } from '@/types';

export default function Login() {
    const { flash } = usePage<SharedData>().props;
    const [form, setForm] = useState({
        email: '',
        password: '',
        remember: false,
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [processing, setProcessing] = useState(false);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post('/login', form, {
            onError: (validationErrors) => setErrors(normalizeInertiaErrors(validationErrors)),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <>
            <Head title="Masuk" />
            <AuthPageShell>
                <BrandHeader title="Masuk" showBack />

                <form className="space-y-5" onSubmit={submit}>
                    {flash?.status ? (
                        <p className="rounded-xl bg-[#00917B]/10 px-4 py-3 text-sm font-medium text-[#00917B]">{flash.status}</p>
                    ) : null}

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
                        placeholder="Kata Sandi"
                        value={form.password}
                        required
                        errors={errors.password}
                        onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                    />

                    <label className="flex items-center gap-2 text-sm text-[#40311D]">
                        <input
                            type="checkbox"
                            checked={form.remember}
                            onChange={(event) => setForm((current) => ({ ...current, remember: event.target.checked }))}
                            className="h-4 w-4 rounded border-[#40311D] text-[#40311D] accent-[#40311D]"
                        />
                        Ingat kembali data login?
                    </label>

                    <PrimaryButton processing={processing}>{processing ? 'Memuat...' : 'Masuk'}</PrimaryButton>
                </form>

                <AuthFooter>
                    <p>
                        Lupa <AuthLink href="/forgot-password">Kata Sandi?</AuthLink>
                    </p>
                    <p className="mt-1">
                        Belum punya akun? <AuthLink href="/register">Daftar</AuthLink>
                    </p>
                </AuthFooter>
            </AuthPageShell>
        </>
    );
}
