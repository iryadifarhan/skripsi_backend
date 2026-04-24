import { Head, Link } from '@inertiajs/react';

export default function Welcome() {
    return (
        <>
            <Head title="Welcome" />
            <div className="relative min-h-screen overflow-hidden px-6 py-10 lg:px-10">
                <div className="pointer-events-none absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-clinic-300/60 blur-3xl" />
                <div className="pointer-events-none absolute bottom-[-6rem] right-[-8rem] h-96 w-96 rounded-full bg-ink-200/70 blur-3xl" />

                <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-between">
                    <header className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-clinic-700">CliniQueue</p>
                            <h1 className="mt-2 text-2xl font-black text-night-900" style={{ fontFamily: 'var(--font-display)' }}>
                                Reservation and queue orchestration for clinics
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link href="/login" className="rounded-full border border-night-900/15 bg-white/80 px-4 py-2 text-sm font-semibold text-night-900 shadow-sm backdrop-blur transition hover:-translate-y-0.5">
                                Login
                            </Link>
                            <Link href="/register" className="rounded-full bg-night-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-night-700">
                                Register
                            </Link>
                        </div>
                    </header>

                    <section className="grid gap-10 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                        <div className="space-y-8">
                            <div className="inline-flex rounded-full border border-clinic-500/20 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700 shadow-sm backdrop-blur">
                                Laravel + React migration shell
                            </div>
                            <div className="space-y-5">
                                <h2 className="max-w-4xl text-5xl font-black leading-tight text-night-900 md:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>
                                    Keep the clinic domain stable while the interface evolves.
                                </h2>
                                <p className="max-w-2xl text-lg leading-8 text-ink-700">
                                    This web shell is designed to migrate CliniQueue into a full-stack Laravel and React application without rewriting the reservation, queue, report, or medical-record core.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                <Link href="/register" className="rounded-full bg-clinic-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-clinic-700">
                                    Start as Patient
                                </Link>
                                <Link href="/login" className="rounded-full border border-night-900/15 px-6 py-3 text-sm font-semibold text-night-900 transition hover:bg-white/80">
                                    Continue to Workspace
                                </Link>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {[
                                ['Reservations', 'Doctor schedules, time windows, rescheduling, and walk-in support remain handled by the current Laravel services.'],
                                ['Queue Control', 'Single ordered line processing, admin queue management, and doctor queue consumption stay intact.'],
                                ['Clinical Closure', 'Medical record issuance remains the event that completes a reservation safely.'],
                            ].map(([title, description]) => (
                                <div key={title} className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_20px_60px_rgba(16,24,39,0.1)] backdrop-blur">
                                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-clinic-700">{title}</p>
                                    <p className="mt-3 text-sm leading-7 text-ink-700">{description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
