import axios, { AxiosError } from 'axios';
import { Link } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

import GuestLayout from '@/layouts/guest-layout';
import type { ValidationErrors } from '@/types';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [status, setStatus] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        setStatus(null);

        try {
            const response = await axios.post<{ message: string }>('/api/forgot-password', { email });
            setStatus(response.data.message);
        } catch (error) {
            const response = (error as AxiosError<{ errors?: ValidationErrors; message?: string }>).response;
            setErrors(response?.data?.errors ?? { email: [response?.data?.message ?? 'Unable to send reset link.'] });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <GuestLayout
            title="Reset password access"
            subtitle="The password reset transport still uses Laravel's existing backend logic. This page only replaces the presentation layer."
        >
            <form className="space-y-5" onSubmit={submit}>
                <div>
                    <label className="mb-2 block text-sm font-semibold text-night-900" htmlFor="email">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-2xl border border-night-900/10 bg-white px-4 py-3 text-sm text-night-900 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                        required
                    />
                    {errors.email?.map((error) => (
                        <p key={error} className="mt-2 text-sm text-alert-500">
                            {error}
                        </p>
                    ))}
                </div>

                {status ? <p className="rounded-2xl bg-clinic-100 px-4 py-3 text-sm text-clinic-700">{status}</p> : null}

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full rounded-2xl bg-night-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {processing ? 'Sending...' : 'Send reset link'}
                </button>
            </form>

            <p className="mt-6 text-sm text-ink-700">
                Return to{' '}
                <Link href="/login" className="font-semibold text-clinic-700 transition hover:text-clinic-500">
                    login
                </Link>
                .
            </p>
        </GuestLayout>
    );
}
