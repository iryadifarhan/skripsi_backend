import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import type { ClinicDetail, DoctorEntry, WorkspaceContext } from '@/types';

type DoctorsPageProps = {
    context: WorkspaceContext;
    selectedClinicId: number | null;
    clinic: ClinicDetail | null;
};

export default function DoctorsPage({ context, selectedClinicId, clinic }: DoctorsPageProps) {
    const [search, setSearch] = useState('');

    const canManage = context.role === 'admin' || context.role === 'superadmin';
    const doctors = clinic?.doctors ?? [];

    const filteredDoctors = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (keyword === '') {
            return doctors;
        }

        return doctors.filter((doctor) =>
            [doctor.name, doctor.username, doctor.email, doctor.phone_number, ...(doctor.specialities ?? [])]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword)),
        );
    }, [doctors, search]);

    return (
        <AppLayout>
            <Head title="Data Dokter" />

            <section className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                    <article className="rounded-lg border border-[#ccd2da] bg-white px-4 py-4">
                        <div className="text-sm font-bold text-[#929292]">Total Dokter</div>
                        <div className="mt-2 text-4xl font-extrabold text-[#6f7584]">{doctors.length}</div>
                    </article>
                    <article className="rounded-lg border border-[#ccd2da] bg-white px-4 py-4">
                        <div className="text-sm font-bold text-[#929292]">Spesialisasi</div>
                        <div className="mt-2 text-4xl font-extrabold text-[#6f7584]">{clinic?.specialities.length ?? 0}</div>
                    </article>
                    <article className="rounded-lg border border-[#ccd2da] bg-white px-4 py-4 md:col-span-2">
                        <div className="text-sm font-bold text-[#929292]">Klinik</div>
                        <div className="mt-2 truncate text-2xl font-extrabold text-[#6f7584]">{clinic?.name ?? '-'}</div>
                    </article>
                </div>

                <section className="rounded-lg border border-[#ccd2da] bg-white p-4">
                    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                        {context.role === 'superadmin' ? (
                            <label className="flex flex-col gap-2 text-sm font-semibold text-[#555]">
                                Klinik
                                <select
                                    value={selectedClinicId ?? ''}
                                    onChange={(event) => router.get('/doctors', { clinic_id: event.target.value }, { preserveScroll: true })}
                                    className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888]"
                                >
                                    {context.clinics.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}

                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#555]">
                            Cari Dokter
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="rounded-md border border-[#cfd4dc] bg-white px-4 py-3 text-sm outline-none focus:border-[#888]"
                                placeholder="Nama, username, email, atau spesialisasi"
                            />
                        </label>
                    </div>
                </section>

                {!canManage || clinic === null ? (
                    <div className="rounded-lg border border-red-200 bg-white p-4 text-sm font-semibold text-red-600">Tidak ada klinik yang tersedia untuk akun ini.</div>
                ) : null}

                <section className="overflow-hidden rounded-lg border border-[#ccd2da] bg-white">
                    <div className="px-4 py-4">
                        <h2 className="text-sm font-extrabold text-[#929292]">Daftar Dokter</h2>
                        <p className="mt-2 text-xs font-semibold text-[#7d8491]">Data dokter yang terhubung dengan klinik terpilih</p>
                    </div>

                    <div className="overflow-x-auto border-t border-[#d6dbe3]">
                        <table className="w-full min-w-[920px] text-left text-sm text-[#616875]">
                            <thead>
                                <tr className="border-b border-[#e2e5ea] text-xs text-[#8b8f98]">
                                    <th className="px-4 py-3 font-extrabold">Dokter</th>
                                    <th className="px-4 py-3 font-extrabold">Kontak</th>
                                    <th className="px-4 py-3 font-extrabold">Spesialisasi</th>
                                    <th className="px-4 py-3 font-extrabold">Username</th>
                                    <th className="px-4 py-3 text-right font-extrabold">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDoctors.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 font-semibold text-[#8b8f98]">Tidak ada data dokter.</td>
                                    </tr>
                                ) : filteredDoctors.map((doctor) => (
                                    <tr key={doctor.id} className="border-b border-[#edf0f3]">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <DoctorAvatar doctor={doctor} />
                                                <div>
                                                    <div className="font-extrabold text-[#303236]">{doctor.name}</div>
                                                    <div className="text-xs font-semibold text-[#8b8f98]">{doctor.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 font-semibold">{doctor.phone_number ?? '-'}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {(doctor.specialities ?? []).length > 0 ? doctor.specialities?.map((speciality) => (
                                                    <span key={speciality} className="rounded-full bg-[#eef1f4] px-3 py-1 text-xs font-extrabold text-[#6f7584]">
                                                        {speciality}
                                                    </span>
                                                )) : <span className="font-semibold text-[#8b8f98]">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 font-semibold">{doctor.username}</td>
                                        <td className="px-4 py-4 text-right">
                                            <Link
                                                href={`/doctors/${doctor.id}/edit?clinic_id=${selectedClinicId ?? ''}`}
                                                className="inline-flex rounded-md bg-[#343434] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#222]"
                                            >
                                                Edit
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </section>
        </AppLayout>
    );
}

function DoctorAvatar({ doctor }: { doctor: DoctorEntry }) {
    if (doctor.image_url) {
        return <img src={doctor.image_url} alt={doctor.name} className="h-12 w-12 rounded-md object-cover" />;
    }

    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#7d7f82] text-sm font-extrabold text-white">
            {doctor.name.slice(0, 2).toUpperCase()}
        </div>
    );
}
