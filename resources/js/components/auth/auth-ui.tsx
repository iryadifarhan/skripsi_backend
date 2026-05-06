import { Link } from '@inertiajs/react';
import { type ReactNode, useState } from 'react';

import type { ValidationErrors } from '@/types';

export function AuthPageShell({ children }: { children: ReactNode }) {
    return (
        <main
            className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#DED0B6] px-3 py-6 sm:px-4 sm:py-8"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
            <section className="w-full max-w-[550px] rounded-2xl bg-white px-5 py-7 outline outline-2 outline-dotted outline-[#40311D] sm:px-8 sm:py-10">
                {children}
            </section>
        </main>
    );
}

export function BrandHeader({ title, showBack = false }: { title: string; showBack?: boolean }) {
    return (
        <header className="mb-6 text-center sm:mb-8">
            {showBack ? (
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="shrink-0 text-[28px] leading-none text-[#40311D] transition hover:opacity-60 sm:text-[32px]"
                        aria-label="Kembali"
                    >
                        &larr;
                    </button>
                    <h1 className="flex-1 text-center text-[clamp(1.75rem,5vw,2.625rem)] font-black leading-tight text-[#40311D]">
                        {title}
                    </h1>
                    <span className="w-7 shrink-0 sm:w-8" aria-hidden="true" />
                </div>
            ) : (
                <h1 className="text-[clamp(1.75rem,5vw,2.625rem)] font-black leading-tight text-[#40311D]">{title}</h1>
            )}

            <p className="mt-1 text-[clamp(1rem,3vw,1.5rem)] font-extrabold tracking-wide text-[#40311D]">
                CLINI<span className="text-[#00917B]">&gt;</span>QUEUE<span className="text-[#00917B]">&gt;</span>
            </p>
        </header>
    );
}

export function TextInput({
    id,
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    required = false,
    errors,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    errors?: string[];
}) {
    return (
        <div>
            <label className="mb-1.5 block text-[clamp(0.9rem,2.5vw,1.25rem)] font-medium text-[#40311D]" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                required={required}
                className="w-full rounded-lg border-[1.5px] border-[#40311D] bg-transparent px-3 py-2.5 text-sm text-[#40311D] outline-none transition placeholder:text-[#40311D]/45 placeholder:italic focus:border-[#00917B] focus:ring-4 focus:ring-[#00917B]/15 sm:px-4 sm:py-3"
            />
            <FieldErrors errors={errors} />
        </div>
    );
}

export function PasswordInput({
    id,
    label,
    value,
    onChange,
    placeholder,
    required = false,
    errors,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    errors?: string[];
}) {
    const [show, setShow] = useState(false);

    return (
        <div>
            <label className="mb-1.5 block text-[clamp(0.9rem,2.5vw,1.25rem)] font-medium text-[#40311D]" htmlFor={id}>
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="w-full rounded-lg border-[1.5px] border-[#40311D] bg-transparent px-3 py-2.5 pr-20 text-sm text-[#40311D] outline-none transition placeholder:text-[#40311D]/45 placeholder:italic focus:border-[#00917B] focus:ring-4 focus:ring-[#00917B]/15 sm:px-4 sm:py-3"
                />
                <button
                    type="button"
                    onClick={() => setShow((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#40311D]/60 opacity-50 transition-opacity duration-200 hover:text-[#40311D]"
                >
                    {show ? '👁' : '⌣'}
                </button>
            </div>
            <FieldErrors errors={errors} />
        </div>
    );
}

export function PrimaryButton({ children, processing = false }: { children: ReactNode; processing?: boolean }) {
    return (
        <button
            type="submit"
            disabled={processing}
            className="w-full rounded-full bg-[#40311D] px-4 py-2.5 text-sm font-semibold text-[#DED0B6] transition hover:bg-[#00917B] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base"
        >
            {children}
        </button>
    );
}

export function AuthFooter({ children }: { children: ReactNode }) {
    return <div className="mt-5 text-center text-sm text-[#40311D]">{children}</div>;
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="font-semibold text-[#40311D] underline transition hover:text-[#00917B]">
            {children}
        </Link>
    );
}

export function ConfirmModal({
    title,
    confirmLabel,
    onCancel,
    onConfirm,
    processing = false,
}: {
    title: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
    processing?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-[#DFE0DF] p-6 text-center sm:p-8">
                <div className="mb-4 text-3xl font-black text-[#40311D]">!</div>
                <p className="mb-6 text-lg font-bold leading-snug text-[#40311D]">{title}</p>
                <div className="flex flex-col justify-center gap-3 min-[380px]:flex-row">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={processing}
                        className="rounded-full border-[1.5px] border-[#40311D] px-6 py-2 text-sm font-semibold text-[#40311D] transition hover:bg-[#40311D] hover:text-[#DED0B6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Kembali
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={processing}
                        className="rounded-full bg-[#40311D] px-6 py-2 text-sm font-semibold text-[#DED0B6] transition hover:bg-[#00917B] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function FieldErrors({ errors }: { errors?: string[] }) {
    if (!errors?.length) {
        return null;
    }

    return (
        <>
            {errors.map((error) => (
                <p key={error} className="mt-1.5 text-xs text-[#c0392b]">
                    {error}
                </p>
            ))}
        </>
    );
}

export function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}
