import { Link, usePage } from '@inertiajs/react';

import type { SharedData } from '@/types';

const loginNext = (path: string) => `/masuk?next=${encodeURIComponent(path)}`;

export function PublicFooter() {
    const { auth } = usePage<SharedData>().props;
    const isPatient = auth?.user?.role === 'patient';
    const patientHref = (path: string) => (isPatient ? path : loginNext(path));

    return (
        <footer className="border-t border-[#40311D]/10 bg-[#DED0B6] py-10 md:text-start text-center">
            <div className="mx-auto grid max-w-[1400px] gap-8 px-5 md:grid-cols-[auto_1fr_auto] md:px-8">
                <div>
                    <div className="text-3xl font-black tracking-[-0.03em] text-[#40311D]">
                        CLINI<span className="text-[#00917B]">&gt;</span>QUEUE<span className="text-[#00917B]">&gt;</span>
                    </div>
                    <div className="mt-1 text-xs text-[#40311D]/40">2026 @Cliniqueue all rights reserved</div>
                </div>

                <nav className="flex flex-col gap-1">
                    <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#40311D]/40">Navigasi</div>
                    {[
                        ['beranda', isPatient ? '/beranda' : '/'],
                        ['klinik', patientHref('/klinik')],
                        ['dokter', patientHref('/dokter')],
                        ['reservasi', patientHref('/reservasi')],
                        ['rekam medis', patientHref('/rekam-medis')],
                    ].map(([label, href]) => (
                        <Link key={label} href={href} className="text-sm text-[#40311D]/60 transition hover:text-[#40311D]">
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="text-sm leading-8 text-[#40311D]/60">
                    <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#40311D]/40">Informasi</div>
                    clinique@clinmail.co.id
                    <br />
                    Jl Clinic, Jakarta Barat
                </div>

                <div className="border-t border-[#40311D]/10 pt-4 text-xs text-[#40311D]/40">© 2026 @Clinique all rights reserved</div>
            </div>
        </footer>
    );
}
