import axios, { AxiosError } from 'axios';
import { Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

import GuestLayout from '@/layouts/guest-layout';
import type { ValidationErrors } from '@/types';

export default function Register() {
    const [form, setForm] = useState({
        name: '',
        username: '',
        email: '',
        phone_number: '',
        date_of_birth: '',
        gender: '',
        password: '',
        password_confirmation: '',
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [processing, setProcessing] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            await axios.post('/api/register', {
                ...form,
                phone_number: form.phone_number || null,
                date_of_birth: form.date_of_birth || null,
                gender: form.gender || null,
            });

            router.visit('/dashboard');
        } catch (error) {
            const response = (error as AxiosError<{ errors?: ValidationErrors; message?: string }>).response;
            setErrors(response?.data?.errors ?? { email: [response?.data?.message ?? 'Registration failed.'] });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <GuestLayout
            title="Create a patient account"
            subtitle="This first migration step keeps the existing patient registration contract while shifting the user experience into the React web shell."
        >
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
                {[
                    ['name', 'Full name', 'text'],
                    ['username', 'Username', 'text'],
                    ['email', 'Email', 'email'],
                    ['phone_number', 'Phone number', 'text'],
                    ['date_of_birth', 'Date of birth', 'date'],
                ].map(([field, label, type]) => (
                    <div key={field} className={field === 'name' ? 'md:col-span-2' : ''}>
                        <label className="mb-2 block text-sm font-semibold text-night-900" htmlFor={field}>
                            {label}
                        </label>
                        <input
                            id={field}
                            type={type}
                            value={form[field as keyof typeof form] as string}
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    [field]: event.target.value,
                                }))
                            }
                            className="w-full rounded-2xl border border-night-900/10 bg-white px-4 py-3 text-sm text-night-900 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                        />
                        {errors[field]?.map((error) => (
                            <p key={error} className="mt-2 text-sm text-alert-500">
                                {error}
                            </p>
                        ))}
                    </div>
                ))}

                <div>
                    <label className="mb-2 block text-sm font-semibold text-night-900" htmlFor="gender">
                        Gender
                    </label>
                    <select
                        id="gender"
                        value={form.gender}
                        onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                        className="w-full rounded-2xl border border-night-900/10 bg-white px-4 py-3 text-sm text-night-900 outline-none transition focus:border-clinic-500 focus:ring-4 focus:ring-clinic-100"
                    >
                        <option value="">Select gender</option>
                        <option value="Laki">Laki</option>
                        <option value="Perempuan">Perempuan</option>
                    </select>
                    {errors.gender?.map((error) => (
                        <p key={error} className="mt-2 text-sm text-alert-500">
                            {error}
                        </p>
                    ))}
                </div>

                <div />

                <div>
                    <label className="mb-2 block text-sm font-semibold text-night-900" htmlFor="password">
                        Password
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

                <div className="md:col-span-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full rounded-2xl bg-night-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-night-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {processing ? 'Creating account...' : 'Register'}
                    </button>
                </div>
            </form>

            <p className="mt-6 text-sm text-ink-700">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-clinic-700 transition hover:text-clinic-500">
                    Sign in here
                </Link>
                .
            </p>
        </GuestLayout>
    );
}
