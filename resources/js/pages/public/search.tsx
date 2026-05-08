import { Head, Link, router } from '@inertiajs/react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import { ClinicImage, DoctorImage, EmptyDirectory, Tags, type PublicClinic, type PublicDoctor } from '@/pages/public/directory-components';

type SearchPageProps = {
    query: string;
    clinics: PublicClinic[];
    doctors: PublicDoctor[];
    total: number;
};

export default function PublicSearchPage({ query, clinics, doctors, total }: SearchPageProps) {
    const [search, setSearch] = useState(query);
    const hasQuery = query.trim() !== '';
    const hasResults = total > 0;

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const q = search.trim();

        router.get('/cari', q === '' ? {} : { q }, {
            preserveScroll: false,
            preserveState: false,
        });
    };

    return (
        <>
            <Head title={hasQuery ? `Cari: ${query}` : 'Cari'} />
            <div className="min-h-screen bg-[#DED0B6] text-[#40311D]">
                <PublicNavbar />

                <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-12 md:px-8">
                    <section className="mb-10">
                        <h1 className="mb-5 text-3xl font-black md:text-5xl">
                            {hasQuery ? 'Hasil pencarian' : 'Cari klinik dan dokter'}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-[#40311D]/55">
                            Cari berdasarkan nama klinik, nama dokter, kota, alamat, nomor telepon, email, atau spesialisasi.
                        </p>

                        <form onSubmit={submit} className="mt-6 flex max-w-[560px] items-center gap-3 rounded-full border border-[#40311D]/30 bg-transparent px-5 py-3 transition focus-within:border-[#00917B] focus-within:ring-4 focus-within:ring-[#00917B]/10">
                            <SearchIcon className="h-5 w-5 shrink-0 text-[#40311D]/35" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Nama klinik, dokter, spesialisasi, kota..."
                                className="w-full bg-transparent text-sm font-medium text-[#40311D] outline-none placeholder:text-[#40311D]/35 placeholder:italic"
                            />
                            <button type="submit" className="rounded-full bg-[#40311D] px-4 py-1.5 text-xs font-bold text-[#DED0B6] transition hover:bg-[#2c2115]">
                                Cari
                            </button>
                        </form>

                        <p className="mt-3 text-sm font-medium text-[#40311D]/45">
                            {hasQuery ? (
                                <>
                                    Menampilkan <span className="font-bold text-[#40311D]">{total}</span> hasil untuk <span className="font-bold text-[#40311D]">"{query}"</span>
                                </>
                            ) : (
                                <>
                                    Menampilkan <span className="font-bold text-[#40311D]">{total}</span> rekomendasi awal.
                                </>
                            )}
                        </p>
                    </section>

                    {!hasResults ? (
                        <EmptyDirectory>Tidak ada klinik atau dokter yang sesuai dengan kata kunci tersebut.</EmptyDirectory>
                    ) : (
                        <div className="space-y-12">
                            <SearchSection title="Klinik" count={clinics.length} emptyLabel="Tidak ada klinik yang cocok.">
                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {clinics.map((clinic) => (
                                        <ClinicResultCard key={clinic.id} clinic={clinic} />
                                    ))}
                                </div>
                            </SearchSection>

                            <SearchSection title="Dokter" count={doctors.length} emptyLabel="Tidak ada dokter yang cocok.">
                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {doctors.map((doctor) => (
                                        <DoctorResultCard key={doctor.id} doctor={doctor} />
                                    ))}
                                </div>
                            </SearchSection>
                        </div>
                    )}
                </main>

                <PublicFooter />
            </div>
        </>
    );
}

function SearchSection({ title, count, emptyLabel, children }: { title: string; count: number; emptyLabel: string; children: ReactNode }) {
    return (
        <section>
            <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-[-0.03em]">{title}</h2>
                    <p className="mt-1 text-sm font-medium text-[#40311D]/45">{count} hasil ditemukan</p>
                </div>
            </div>
            {count === 0 ? <EmptyDirectory>{emptyLabel}</EmptyDirectory> : children}
        </section>
    );
}

function ClinicResultCard({ clinic }: { clinic: PublicClinic }) {
    return (
        <Link
            href={`/klinik/${clinic.slug}`}
            className="group grid grid-cols-[64px_minmax(0,1fr)] gap-4 rounded-2xl bg-[#dacdb5] p-5 text-[#40311D] transition hover:-translate-y-0.5 hover:bg-[#d7c8ad]/80 hover:shadow-[0_10px_26px_rgba(64,49,29,0.08)]"
        >
            <div className="h-16 w-16 overflow-hidden rounded-full">
                <ClinicImage imageUrl={clinic.image_url} name={clinic.name} className="rounded-full" />
            </div>
            <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-base font-black leading-tight tracking-[-0.03em] group-hover:text-[#00917B]">{clinic.name}</h3>
                    <StatusPill active={clinic.is_open_now}>{clinic.is_open_now ? 'Buka' : 'Tutup'}</StatusPill>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-[#40311D]/55">{clinic.location || clinic.address || 'Alamat belum tersedia'}</p>
                <p className="mt-3 text-xs font-medium text-[#40311D]/50">
                    Jam Operasional: <span className="font-bold text-[#40311D]/65">{clinic.operational_label}, {clinic.hours_label}</span>
                </p>
                <div className="mt-3">
                    <Tags items={clinic.specialities} limit={3} />
                </div>
            </div>
        </Link>
    );
}

function DoctorResultCard({ doctor }: { doctor: PublicDoctor }) {
    const primaryClinic = doctor.clinics[0] ?? null;
    const cityName = primaryClinic?.city_name ?? doctor.clinics.find((clinic) => clinic.city_name)?.city_name ?? null;
    const tags = [doctor.primary_speciality, cityName].filter(Boolean) as string[];

    return (
        <Link
            href={`/dokter/${doctor.slug}`}
            className="group grid grid-cols-[64px_minmax(0,1fr)] gap-4 rounded-2xl bg-[#dacdb5] p-5 text-[#40311D] transition hover:-translate-y-0.5 hover:bg-[#d7c8ad]/80 hover:shadow-[0_10px_26px_rgba(64,49,29,0.08)]"
        >
            <div className="h-16 w-16 overflow-hidden rounded-full">
                <DoctorImage imageUrl={doctor.image_url} name={doctor.name} className="rounded-full" />
            </div>
            <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="line-clamp-2 text-base font-black leading-tight tracking-[-0.03em] group-hover:text-[#00917B]">{doctor.name}</h3>
                        <p className="mt-0.5 line-clamp-1 text-xs font-extrabold text-[#40311D]/65">{primaryClinic?.name ?? 'Klinik belum tersedia'}</p>
                    </div>
                    <StatusPill active={doctor.is_available_today}>{doctor.is_available_today ? 'Tersedia' : 'Tidak tersedia'}</StatusPill>
                </div>
                <p className="mt-1 line-clamp-1 text-xs font-medium text-[#40311D]/55">{doctor.email ?? doctor.phone_number ?? '-'}</p>
                <p className="mt-3 text-xs font-medium text-[#40311D]/50">
                    Jadwal: <span className="font-bold text-[#40311D]/65">{doctor.operational_label}, {doctor.hours_label}</span>
                </p>
                <div className="mt-3">
                    <Tags items={tags.length > 0 ? tags : doctor.specialities} limit={3} />
                </div>
            </div>
        </Link>
    );
}

function StatusPill({ active, children }: { active: boolean; children: ReactNode }) {
    return (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${active ? 'bg-[#00917B]/15 text-[#00836f]' : 'bg-[#d95d4f]/12 text-[#d95d4f]'}`}>
            {children}
        </span>
    );
}

function SearchIcon({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
            <path
                fill="currentColor"
                d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.15 3.15-1.06 1.06-3.15-3.15A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
            />
        </svg>
    );
}
