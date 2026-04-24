import axios, { AxiosError } from 'axios';
import { Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

import GuestLayout from '@/layouts/guest-layout';
import type { ValidationErrors } from '@/types';

export default function Login() {
    const [form, setForm] = useState({
        email: '',
        password: '',
        remember: false,
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [processing, setProcessing] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            await axios.post('/api/login', form);
            router.visit('/dashboard');
        } catch (error) {
            const response = (error as AxiosError<{ errors?: ValidationErrors; message?: string }>).response;
            setErrors(response?.data?.errors ?? { email: [response?.data?.message ?? 'Login failed.'] });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <GuestLayout
            title="Access the operational workspace"
            subtitle="Sign in using the existing Laravel session-based authentication flow while the new React workspace is phased in."
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
                        placeholder="user@example.com"
                        required
                    />
                    {errors.email?.map((error) => (
                        <p key={error} className="mt-2 text-sm text-alert-500">
                            {error}
                        </p>
                    ))}
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <label className="block text-sm font-semibold text-night-900" htmlFor="password">
                            Password
                        </label>
                        <Link href="/forgot-password" className="text-sm font-medium text-clinic-700 transition hover:text-clinic-500">
                            Forgot password?
                        </Link>
                    </div>
                    <input
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                        className="w-full rounded-2xl border border-night-900/10 bg-white px-4 py-3 text-sm text-night-900 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                        placeholder="Enter your password"
                        required
                    />
                    {errors.password?.map((error) => (
                        <p key={error} className="mt-2 text-sm text-alert-500">
                            {error}
                        </p>
                    ))}
                </div>

                <label className="flex items-center gap-3 text-sm text-ink-700">
                    <input
                        type="checkbox"
                        checked={form.remember}
                        onChange={(event) => setForm((current) => ({ ...current, remember: event.target.checked }))}
                        className="h-4 w-4 rounded border-night-900/20 text-clinic-500 focus:ring-clinic-500"
                    />
                    Remember this session
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full rounded-2xl bg-night-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {processing ? 'Signing in...' : 'Login'}
                </button>
            </form>

            <p className="mt-6 text-sm text-ink-700">
                Need a patient account?{' '}
                <Link href="/register" className="font-semibold text-clinic-700 transition hover:text-clinic-500">
                    Create one here
                </Link>
                .
            </p>
        </GuestLayout>
    );
}
