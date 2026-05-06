import { Head, Link } from '@inertiajs/react';

import rekamanMedisImg from '@/assets/rekaman-medis-mock.png';
import reservasiImg from '@/assets/reservasi-mock.png';
import ImageStack from '@/components/landing/image-stack';
import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';

function BtnOutline({ children, href }: { children: string; href: string }) {
    return (
        <Link
            href={href}
            className="rounded-full border border-[#40311D] px-6 py-2 text-sm font-semibold text-[#40311D] transition-colors duration-200 hover:bg-[#40311D] hover:text-[#DED0B6]"
        >
            {children}
        </Link>
    );
}

function BtnFilled({ children, href }: { children: string; href: string }) {
    return (
        <Link
            href={href}
            className="rounded-full border border-[#40311D] bg-[#40311D] px-6 py-2 text-sm font-semibold text-[#DED0B6] transition-colors duration-200 hover:border-[#00917B] hover:bg-[#00917B]"
        >
            {children}
        </Link>
    );
}

function Hero() {
    const title = 'Clini>Queue>.';
    const tealChars = new Set([5, 11]);

    return (
        <section className="flex flex-col bg-[#DED0B6] px-5 pb-24 pt-24 sm:px-10 sm:pb-32 sm:pt-32 lg:pb-48 lg:pt-40">
            <div className="flex flex-wrap gap-4 px-2 sm:gap-8 sm:px-8">
                {['Klinik', 'Dokter', 'Reservasi'].map((tag) => (
                    <span key={tag} className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-widest text-[#40311D] md:text-xl">
                        <span className="block h-[0.6em] w-[0.6em] shrink-0 bg-[#40311D]" />
                        {tag}
                    </span>
                ))}
            </div>

            <h1 className="mb-4 px-1 text-[clamp(2.8rem,10vw,10.5rem)] font-bold leading-[0.92] tracking-tight sm:px-7">
                {title.split('').map((char, index) => (
                    <span
                        key={`${char}-${index}`}
                        className={tealChars.has(index) ? 'text-[#00917B]' : 'text-[#40311D]'}
                        style={{
                            display: 'inline-block',
                            opacity: 0,
                            animation: 'letterIn 0.5s ease forwards',
                            animationDelay: `${index * 0.045}s`,
                        }}
                    >
                        {char}
                    </span>
                ))}
            </h1>

            <p className="max-w-5xl px-2 text-left text-[clamp(0.875rem,2vw,1.5rem)] leading-relaxed text-[#40311D] sm:px-8">
                Reservasi klinik dan dokter favoritmu dengan cepat dan mudah.
            </p>
        </section>
    );
}

function Features() {
    const steps = [
        { num: '01', label: 'Cari Klinik atau Dokter' },
        { num: '02', label: 'Pilih Waktu Reservasi' },
        { num: '03', label: 'Isi Data Reservasi' },
        { num: '04', label: 'Ajukan Reservasi' },
        { num: '05', label: 'Bookinganmu Selesai' },
    ];

    return (
        <section className="bg-[#40311D] px-5 py-20 text-[#DFE0DF] sm:px-10 lg:px-16 lg:py-24">
            <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
                <div>
                    <h2 className="mb-6 text-[clamp(1.75rem,3vw,3.625rem)] font-medium leading-tight text-[#00917B]">Reservasi Dibuat Mudah</h2>
                    <p className="max-w-3xl text-justify text-[clamp(0.875rem,3vw,1.25rem)] leading-relaxed opacity-75">
                        Hanya dengan 5 langkah mudah, kini Anda dapat memesan klinik atau dokter pilihanmu. Selain itu, Anda juga dapat membatalkan atau mengubah jadwal kapan saja sesuai kebutuhan.
                    </p>
                </div>

                <div>
                    <ul className="list-none text-center">
                        {steps.map((step, index) => (
                            <li
                                key={step.num}
                                className="mb-1 font-normal leading-snug tracking-tight"
                                style={{
                                    fontSize: `clamp(0.9rem, ${2.5 - index * 0.3}vw, ${2.7 - index * 0.2}rem)`,
                                    opacity: 1 - index * 0.12,
                                }}
                            >
                                {step.num} {step.label}
                            </li>
                        ))}
                    </ul>

                    <ul className="mt-2 list-none text-center" aria-hidden="true">
                        {[...steps].reverse().map((step, index) => (
                            <li
                                key={step.num}
                                className="mb-1 font-normal leading-snug text-[#DFE0DF]"
                                style={{
                                    fontSize: `clamp(0.9rem, ${1.3 + index * 0.3}vw, ${1.9 + index * 0.2}rem)`,
                                    opacity: 0.16 - index * 0.015,
                                }}
                            >
                                {step.num} {step.label}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}

function MedicalRecords() {
    const cards = [
        { id: 'A', src: reservasiImg, alt: 'Preview reservasi pasien', top: 0, left: 5, zIndex: 3 },
        { id: 'B', src: rekamanMedisImg, alt: 'Preview rekam medis pasien', top: 12, left: 40, zIndex: 2 },
        { id: 'C', src: rekamanMedisImg, alt: 'Preview detail rekam medis', top: 40, left: 20, zIndex: 1 },
    ];

    return (
        <>
            <hr className="border-t-2 border-dashed border-[#40311D]" />
            <section className="bg-[#40311D] py-16 text-[#DED0B6]">
                <div className="grid grid-cols-1 items-center gap-8 px-5 md:grid-cols-2 md:pl-8">
                    <div className="p-4 sm:p-8">
                        <ImageStack cards={cards} />
                    </div>

                    <div className="px-4 py-10 sm:px-10 sm:py-20">
                        <h2 className="mb-5 text-[clamp(1.75rem,3vw,3.625rem)] font-medium leading-tight text-[#00917B]">Rekapan Medis dan Reservasimu Di Satu Tempat.</h2>
                        <p className="max-w-3xl text-justify text-[clamp(0.875rem,3vw,1.25rem)] leading-relaxed opacity-75">
                            Temukan semua reservasi dan rekapan medismu di satu tempat yang terintegrasi setiap saat.
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}

function AdminDashboard() {
    const cards = [
        { id: 'A', src: reservasiImg, alt: 'Preview dashboard administrasi', top: 0, left: 5, zIndex: 3 },
        { id: 'B', src: reservasiImg, alt: 'Preview manajemen reservasi', top: 12, left: 40, zIndex: 2 },
        { id: 'C', src: reservasiImg, alt: 'Preview manajemen antrean', top: 40, left: 20, zIndex: 1 },
    ];

    return (
        <>
            <hr className="border-t-2 border-dashed border-[#40311D]" />
            <section className="bg-[#40311D] py-16 text-[#DED0B6]">
                <div className="grid grid-cols-1 items-center gap-8 px-5 md:grid-cols-2">
                    <div className="px-4 py-10 sm:px-12 sm:py-16">
                        <h2 className="mb-5 text-[clamp(1.75rem,3vw,3.625rem)] font-medium leading-tight text-[#00917B]">Dashboard Administrasi Terintegrasi.</h2>
                        <p className="max-w-3xl text-justify text-[clamp(0.875rem,3vw,1.25rem)] leading-relaxed opacity-75">
                            Dashboard administrasi memudahkan pengelolaan klinik, dokter, pasien, reservasi, antrean, dan laporan dalam satu sistem yang terintegrasi.
                        </p>
                    </div>

                    <div className="p-4 sm:p-8">
                        <ImageStack cards={cards} />
                    </div>
                </div>
            </section>
        </>
    );
}

function CTA() {
    return (
        <section className="bg-[#DED0B6] px-5 py-24 text-center sm:px-8 sm:py-28">
            <h2 className="mb-6 text-[clamp(2rem,5vw,3.625rem)] font-bold tracking-tight text-[#40311D]">Bergabung Sekarang!</h2>
            <p className="mx-auto mb-10 max-w-2xl text-[clamp(0.875rem,3vw,1.25rem)] leading-relaxed text-[#40311D]/70">
                Proses reservasi kini dibuat lebih mudah. Dengan CliniQueue, pasien, dokter, dan klinik dapat terhubung dalam alur yang lebih jelas.
            </p>

            <div className="flex justify-center gap-2.5">
                <BtnOutline href="/masuk">Masuk</BtnOutline>
                <BtnFilled href="/daftar">Daftar</BtnFilled>
            </div>
        </section>
    );
}

export default function Welcome() {
    return (
        <>
            <Head title="CliniQueue">
                <style>{`
                    @keyframes letterIn {
                        from { opacity: 0; transform: translateY(0.25em); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </Head>
            <div className="min-h-screen bg-[#DED0B6]">
                <PublicNavbar />
                <main>
                    <Hero />
                    <Features />
                    <MedicalRecords />
                    <AdminDashboard />
                    <CTA />
                </main>
                <PublicFooter />
            </div>
        </>
    );
}
