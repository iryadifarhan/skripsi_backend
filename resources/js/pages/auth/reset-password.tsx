import { Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

import GuestLayout from '@/layouts/guest-layout';
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

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post('/reset-password', form, {
            onError: (validationErrors) => setErrors(normalizeInertiaErrors(validationErrors)),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <GuestLayout
            title="Set a new password"
            subtitle="Use the reset token from your email. This form still hands off to the existing Laravel password reset backend."
        >
            <form className="space-y-5" onSubmit={submit}>
                <div>
                    <label className="mb-2 block text-sm font-semibold text-night-900" htmlFor="email">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        className="w-full rounded-2xl border border-night-900/10 bg-white px-4 py-3 text-sm text-night-900 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                        required
                    />
                    {errors.email?.map((error) => (
                        <p key={error} className="mt-2 text-sm text-alert-500">
                            {error}
                        </p>
                    ))}
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-night-900" htmlFor="password">
                        New password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                        className="w-full rounded-2xl border border-night-900/10 bg-white px-4 py-3 text-sm text-night-900 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                        required
                    />
                    {errors.password?.map((error) => (
                        <p key={error} className="mt-2 text-sm text-alert-500">
                            {error}
                        </p>
                    ))}
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-night-900" htmlFor="password_confirmation">
                        Confirm password
                    </label>
                    <input
                        id="password_confirmation"
                        type="password"
                        value={form.password_confirmation}
                        onChange={(event) => setForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                        className="w-full rounded-2xl border border-night-900/10 bg-white px-4 py-3 text-sm text-night-900 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full rounded-2xl bg-night-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {processing ? 'Updating password...' : 'Reset password'}
                </button>
            </form>

            <p className="mt-6 text-sm text-ink-700">
                Back to{' '}
                <Link href="/login" className="font-semibold text-clinic-700 transition hover:text-clinic-500">
                    login
                </Link>
                .
            </p>
        </GuestLayout>
    );
}

function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}
