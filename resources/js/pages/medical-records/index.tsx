import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import { ClinicSelector } from '@/components/clinic-selector';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { MedicalRecordEntry, WorkspaceContext } from '@/types';

type DoctorOption = {
    id: number;
    name: string;
};

type MedicalRecordsPageProps = {
    context: WorkspaceContext;
    medicalRecords: MedicalRecordEntry[];
    doctorOptions: DoctorOption[];
    canViewMedicalRecords: boolean;
    filters: {
        clinicId: number | null;
        reservationDate: string;
    };
};

export default function MedicalRecordsPage({ context, medicalRecords, doctorOptions, canViewMedicalRecords, filters }: MedicalRecordsPageProps) {
    const canView = canViewMedicalRecords;
    const canFilterByDoctor = canView && context.role === 'admin';
    const canChooseClinic = canView && context.role === 'doctor' && context.clinics.length > 1;
    const [search, setSearch] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');

    const updateFilters = (updates: Partial<MedicalRecordsPageProps['filters']>) => {
        const nextFilters = { ...filters, ...updates };

        router.get('/medical-records', cleanQuery({
            clinic_id: nextFilters.clinicId,
            reservation_date: nextFilters.reservationDate,
        }), {
            preserveScroll: true,
        });
    };

    const filteredMedicalRecords = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return medicalRecords.filter((record) => {
            const matchesDoctor = doctorFilter === '' || String(record.doctor?.id ?? '') === doctorFilter;
            const searchableValues = [
                record.patient?.name,
                record.guest_name,
                record.doctor?.name,
                record.clinic?.name,
                record.reservation?.reservation_number,
                record.reservation?.complaint,
                record.diagnosis,
                record.treatment,
                record.prescription_notes,
                record.doctor_notes,
            ];
            const matchesSearch = keyword === '' || searchableValues
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));

            return matchesDoctor && matchesSearch;
        });
    }, [doctorFilter, medicalRecords, search]);
    const recordPagination = useClientPagination(filteredMedicalRecords);

    return (
        <AppLayout>
            <Head title="Data Rekam Medis" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    
                    {canChooseClinic ? (
                        <ClinicSelector
                                clinics={context.clinics}
                                value={filters.clinicId}
                                onChange={(clinicId) => updateFilters({ clinicId: clinicId === '' ? null : Number(clinicId) })}
                                className="md:w-full"
                            />
                    ) : null}

                    {canView ? (
                        <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <p className="mb-2 text-[12px] font-medium text-[#40311D]">Filter Rekam Medis</p>
                            <div className="flex flex-wrap items-center gap-2">

                                <div className="flex min-w-64 items-center gap-2 rounded-full border border-gray-300 px-3 py-1 transition focus-within:border-[#40311D]">
                                    <span className="text-[12px] text-gray-400">Search</span>
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Pasien, kode, diagnosis..."
                                        type="text"
                                        className="min-w-0 flex-1 bg-transparent text-[12px] italic outline-none placeholder:text-gray-400"
                                    />
                                </div>

                                {canFilterByDoctor ? (
                                    <label className="flex min-w-52 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-[12px] text-gray-600 transition focus-within:border-[#40311D]">
                                        <span className="whitespace-nowrap text-gray-400">Dokter</span>
                                        <select
                                            value={doctorFilter}
                                            onChange={(event) => setDoctorFilter(event.target.value)}
                                            className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-700 outline-none"
                                        >
                                            <option value="">Semua Dokter</option>
                                            {doctorOptions.map((doctor) => (
                                                <option key={doctor.id} value={doctor.id}>
                                                    {doctor.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ) : null}

                                <label className="flex min-w-48 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-[12px] text-gray-600 transition focus-within:border-[#40311D]">
                                    <span className="whitespace-nowrap text-gray-400">Tanggal</span>
                                    <input
                                        type="date"
                                        value={filters.reservationDate}
                                        onChange={(event) => updateFilters({ reservationDate: event.target.value })}
                                        className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-700 outline-none"
                                    />
                                </label>
                            </div>
                        </section>
                    ) : null}

                    {!canView ? (
                        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
                            Rekam medis bersifat clinic-scoped dan tidak ditampilkan untuk superadmin. Data ini hanya tersedia untuk admin klinik, dokter terkait, dan pasien pemilik.
                        </section>
                    ) : (
                        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
                                <p className="text-[13px] font-medium text-[#40311D]">Daftar Rekam Medis</p>
                                <p className="mt-0.5 text-[11px] text-gray-400">
                                    Rekam medis clinic-scoped dari klinik terpilih
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1180px] border-collapse text-[12px] whitespace-nowrap">
                                    <thead>
                                        <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                            {['No', 'Tanggal', 'Pasien/Walk-In', 'Dokter', 'Reservation Number', 'Keluhan', 'Diagnosis', 'Treatment', 'Prescription Note', 'Doctor Notes'].map((header) => (
                                                <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMedicalRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                                                    Tidak ada rekam medis yang sesuai filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            recordPagination.paginatedItems.map((record, index) => (
                                                <tr key={record.id} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                                                    <td className="px-4 py-2.5 text-gray-700">{String(recordPagination.startItem + index).padStart(3, '0')}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{dateTimeLabel(record.issued_at)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{patientName(record)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{record.doctor?.name ?? '-'}</td>
                                                    <td className="px-4 py-2.5 font-medium text-[#40311D]">{record.reservation?.reservation_number ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.reservation?.complaint ?? '-'}>
                                                        {record.reservation?.complaint ?? '-'}
                                                    </td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.diagnosis ?? '-'}>
                                                        {record.diagnosis ?? '-'}
                                                    </td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.treatment ?? '-'}>
                                                        {record.treatment ?? '-'}
                                                    </td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.prescription_notes ?? '-'}>
                                                        {record.prescription_notes ?? '-'}
                                                    </td>
                                                    <td className="max-w-[260px] truncate px-4 py-2.5 text-gray-700" title={record.doctor_notes}>
                                                        {record.doctor_notes}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationControls
                                page={recordPagination.page}
                                perPage={recordPagination.perPage}
                                total={recordPagination.total}
                                pageCount={recordPagination.pageCount}
                                startItem={recordPagination.startItem}
                                endItem={recordPagination.endItem}
                                perPageOptions={recordPagination.perPageOptions}
                                onPageChange={recordPagination.setPage}
                                onPerPageChange={recordPagination.setPerPage}
                            />
                        </section>
                    )}
                </div>
            </section>
        </AppLayout>
    );
}

function patientName(record: MedicalRecordEntry): string {
    return record.patient?.name ?? record.guest_name ?? 'Walk-in Patient';
}

function dateTimeLabel(value: string): string {
    if (!value) {
        return '-';
    }

    return value.replace('T', ' ').slice(0, 16);
}

function cleanQuery(query: Record<string, string | number | boolean | null | undefined>) {
    return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}


