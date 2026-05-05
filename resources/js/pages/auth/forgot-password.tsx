import { Head, router, usePage } from '@inertiajs/react';
import { type FormEvent, useEffect, useState } from 'react';

import {
    AuthFooter,
    AuthLink,
    AuthPageShell,
    BrandHeader,
    normalizeInertiaErrors,
    PrimaryButton,
    TextInput,
} from '@/components/auth/auth-ui';
import type { SharedData, ValidationErrors } from '@/types';

export default function ForgotPassword() {
    const { flash } = usePage<SharedData>().props;
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!sent || countdown <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setCountdown((current) => Math.max(current - 1, 0));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [sent, countdown]);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        sendResetLink();
    };

    const sendResetLink = () => {
        setProcessing(true);
        setErrors({});

        router.post('/forgot-password', { email }, {
            preserveScroll: true,
            onSuccess: () => {
                setSent(true);
                setCountdown(60);
            },
            onError: (validationErrors) => setErrors(normalizeInertiaErrors(validationErrors)),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <>
            <Head title="Lupa Sandi" />
            <AuthPageShell>
                <BrandHeader title="Lupa Sandi" showBack />

                <form className="space-y-5" onSubmit={submit}>
                    <div>
                        <TextInput
                            id="email"
                            label="Email*"
                            type="email"
                            placeholder="CliniQ@gmail.co.id"
                            value={email}
                            required
                            errors={errors.email}
                            onChange={setEmail}
                        />
                        <p className="mt-1.5 text-xs italic leading-relaxed text-[#40311D]/65">
                            *Pastikan email aktif dan dapat mendapatkan link untuk melakukan reset password
                        </p>
                    </div>

                    {flash?.status ? (
                        <p className="rounded-xl bg-[#00917B]/10 px-4 py-3 text-sm font-medium text-[#00917B]">{flash.status}</p>
                    ) : null}

                    <PrimaryButton processing={processing || sent}>{processing ? 'Mengirim...' : 'Kirim'}</PrimaryButton>
                </form>

                <AuthFooter>
                    <span>Tidak terima email? </span>
                    <button
                        type="button"
                        onClick={sendResetLink}
                        disabled={!sent || countdown > 0 || processing}
                        className="font-semibold text-[#40311D] underline transition hover:text-[#00917B] disabled:cursor-not-allowed disabled:opacity-45 disabled:no-underline"
                    >
                        {sent && countdown > 0 ? `Kirim lagi dalam (${countdown} detik)` : 'Kirim ulang'}
                    </button>
                    <p className="mt-2">
                        Kembali ke <AuthLink href="/login">Masuk</AuthLink>
                    </p>
                </AuthFooter>
            </AuthPageShell>
        </>
    );
}
