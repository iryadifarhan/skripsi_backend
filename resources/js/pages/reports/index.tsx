import { Head, router } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { MedicalRecordEntry, ReservationEntry, WorkspaceContext } from '@/types';

type DoctorOption = {
    id: number;
    name: string;
};

type ReportClinic = {
    id: number;
    name: string;
} | null;

type DoctorRecapRow = {
    doctor_id: number;
    doctor_name: string;
    reservation_count: number;
    pending_count: number;
    approved_count: number;
    rejected_count: number;
    cancelled_count: number;
    completed_count: number;
    medical_record_count: number;
};

type ReportFilters = {
    clinicId: number | null;
    dateFrom: string;
    dateTo: string;
    doctorId: number | null;
    status: string | null;
    search: string | null;
};

type ReportForm = {
    clinicId: string;
    dateFrom: string;
    dateTo: string;
    doctorId: string;
    status: string;
    search: string;
    format?: string;
};

type ReportsPageProps = {
    context: WorkspaceContext;
    clinic: ReportClinic;
    filters: ReportFilters;
    doctorOptions: DoctorOption[];
    canViewMedicalRecords: boolean;
    reservationSummary: Record<string, number>;
    medicalRecordSummary: Record<string, number>;
    doctorRecap: DoctorRecapRow[];
    reservations: ReservationEntry[];
    medicalRecords: MedicalRecordEntry[];
};

const statusOptions = ['pending', 'approved', 'completed', 'cancelled', 'rejected'];

export default function ReportsPage({
    context,
    clinic,
    filters,
    doctorOptions,
    canViewMedicalRecords,
    reservationSummary,
    medicalRecordSummary,
    doctorRecap,
    reservations,
    medicalRecords,
}: ReportsPageProps) {
    const [form, setForm] = useState<ReportForm>({
        clinicId: filters.clinicId ? String(filters.clinicId) : '',
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        doctorId: filters.doctorId ? String(filters.doctorId) : '',
        status: filters.status ?? '',
        search: filters.search ?? '',
    });

    const reservationPagination = useClientPagination(reservations, { initialPerPage: 10 });
    const medicalRecordPagination = useClientPagination(medicalRecords, { initialPerPage: 10 });
    const doctorRecapPagination = useClientPagination(doctorRecap, { initialPerPage: 10 });
    const canChooseClinic = context.role === 'superadmin' || (context.role === 'doctor' && context.clinics.length > 1);
    const canChooseDoctor = context.role !== 'doctor';

    const summaryCards = useMemo(() => [
        { label: 'Total Reservasi', value: reservationSummary.total_reservations ?? 0 },
        { label: 'Pasien Terdaftar', value: reservationSummary.registered_reservations ?? 0 },
        { label: 'Walk-In', value: reservationSummary.walk_in_reservations ?? 0 },
        { label: 'Completed', value: reservationSummary.completed_reservations ?? 0 },
        { label: 'Cancelled', value: reservationSummary.cancelled_reservations ?? 0 },
        { label: 'Rejected', value: reservationSummary.rejected_reservations ?? 0 },
        {
            label: 'Rekam Medis',
            value: canViewMedicalRecords ? medicalRecordSummary.total_medical_records ?? 0 : 'Hidden',
        },
    ], [canViewMedicalRecords, medicalRecordSummary.total_medical_records, reservationSummary]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/reports', buildQuery(form), { preserveScroll: true });
    };

    const exportHref = (format: 'xlsx' | 'pdf') => `/reports/export?${new URLSearchParams(buildQuery({ ...form, format })).toString()}`;

    return (
        <AppLayout>
            <Head title="Laporan" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-[13px] font-medium text-[#40311D]">Filter Laporan</p>
                                <p className="mt-0.5 text-[11px] text-gray-400">
                                    {clinic ? `Data laporan untuk ${clinic.name}` : 'Pilih klinik untuk melihat laporan'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="submit" className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#2c2115]">
                                    Tampilkan
                                </button>
                                <a href={exportHref('xlsx')} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF]">
                                    Export XLSX
                                </a>
                                <a href={exportHref('pdf')} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF]">
                                    Export PDF
                                </a>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                            {canChooseClinic ? (
                                <label className="flex flex-col gap-1 text-[12px] text-[#40311D]">
                                    Klinik
                                    <select
                                        value={form.clinicId}
                                        onChange={(event) => setForm((current) => ({ ...current, clinicId: event.target.value, doctorId: '' }))}
                                        className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                    >
                                        {context.clinics.map((clinicOption) => (
                                            <option key={clinicOption.id} value={clinicOption.id}>
                                                {clinicOption.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}

                            <label className="flex flex-col gap-1 text-[12px] text-[#40311D]">
                                Dari Tanggal
                                <input
                                    type="date"
                                    value={form.dateFrom}
                                    onChange={(event) => setForm((current) => ({ ...current, dateFrom: event.target.value }))}
                                    className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                />
                            </label>

                            <label className="flex flex-col gap-1 text-[12px] text-[#40311D]">
                                Sampai Tanggal
                                <input
                                    type="date"
                                    value={form.dateTo}
                                    onChange={(event) => setForm((current) => ({ ...current, dateTo: event.target.value }))}
                                    className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                />
                            </label>

                            {canChooseDoctor ? (
                                <label className="flex flex-col gap-1 text-[12px] text-[#40311D]">
                                    Dokter
                                    <select
                                        value={form.doctorId}
                                        onChange={(event) => setForm((current) => ({ ...current, doctorId: event.target.value }))}
                                        className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                    >
                                        <option value="">Semua Dokter</option>
                                        {doctorOptions.map((doctor) => (
                                            <option key={doctor.id} value={doctor.id}>
                                                {doctor.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <div className="flex flex-col gap-1 text-[12px] text-[#40311D]">
                                    Dokter
                                    <div className="rounded-full border border-gray-200 bg-[#faf9f7] px-3 py-2 text-[12px] text-gray-500">
                                        {doctorOptions[0]?.name ?? 'Dokter aktif'}
                                    </div>
                                </div>
                            )}

                            <label className="flex flex-col gap-1 text-[12px] text-[#40311D]">
                                Status Reservasi
                                <select
                                    value={form.status}
                                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                                    className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                >
                                    <option value="">Semua Status</option>
                                    {statusOptions.map((status) => (
                                        <option key={status} value={status}>
                                            {statusLabel(status)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-1 text-[12px] text-[#40311D]">
                                Search
                                <input
                                    type="text"
                                    value={form.search}
                                    onChange={(event) => setForm((current) => ({ ...current, search: event.target.value }))}
                                    placeholder="Pasien, kode, diagnosis..."
                                    className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] italic text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#40311D]"
                                />
                            </label>
                        </div>
                    </form>

                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                        {summaryCards.map((card) => (
                            <div key={card.label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                                <p className="mb-1 text-[11px] text-gray-400">{card.label}</p>
                                <p className="text-[24px] font-medium text-[#40311D]">{card.value}</p>
                            </div>
                        ))}
                    </div>

                    <Panel title="Rekap Per Dokter" subtitle="Ringkasan performa reservasi per dokter">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] border-collapse text-[12px] whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                        {['No', 'Dokter', 'Reservasi', 'Pending', 'Approved', 'Rejected', 'Cancelled', 'Completed', 'Rekam Medis'].map((header) => (
                                            <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {doctorRecap.length === 0 ? (
                                        <EmptyRow colSpan={9}>Tidak ada rekap dokter sesuai filter.</EmptyRow>
                                    ) : doctorRecapPagination.paginatedItems.map((row, index) => (
                                        <tr key={row.doctor_id} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                                            <td className="px-4 py-2.5 text-gray-700">{String(doctorRecapPagination.startItem + index).padStart(3, '0')}</td>
                                            <td className="px-4 py-2.5 font-medium text-[#40311D]">{row.doctor_name}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{row.reservation_count}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{row.pending_count}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{row.approved_count}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{row.rejected_count}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{row.cancelled_count}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{row.completed_count}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{canViewMedicalRecords ? row.medical_record_count : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            page={doctorRecapPagination.page}
                            perPage={doctorRecapPagination.perPage}
                            total={doctorRecapPagination.total}
                            pageCount={doctorRecapPagination.pageCount}
                            startItem={doctorRecapPagination.startItem}
                            endItem={doctorRecapPagination.endItem}
                            perPageOptions={doctorRecapPagination.perPageOptions}
                            onPageChange={doctorRecapPagination.setPage}
                            onPerPageChange={doctorRecapPagination.setPerPage}
                        />
                    </Panel>

                    <Panel title="Data Reservasi" subtitle="Preview data reservasi sebelum export">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1180px] border-collapse text-[12px] whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                        {['No', 'Tanggal', 'Pasien/Walk-In', 'Kontak', 'Dokter', 'Window', 'Queue', 'Status', 'Keluhan', 'Catatan'].map((header) => (
                                            <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reservations.length === 0 ? (
                                        <EmptyRow colSpan={10}>Tidak ada data reservasi sesuai filter.</EmptyRow>
                                    ) : reservationPagination.paginatedItems.map((reservation, index) => (
                                        <tr key={reservation.id} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                                            <td className="px-4 py-2.5 text-gray-700">{String(reservationPagination.startItem + index).padStart(3, '0')}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{dateLabel(reservation.reservation_date)}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{patientName(reservation)}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{patientContact(reservation)}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{reservation.doctor?.name ?? '-'}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{timeRange(reservation.window_start_time, reservation.window_end_time)}</td>
                                            <td className="px-4 py-2.5 text-gray-700">{queueLabel(reservation)}</td>
                                            <td className="px-4 py-2.5"><StatusBadge status={reservation.status} /></td>
                                            <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={reservation.complaint ?? '-'}>{reservation.complaint ?? '-'}</td>
                                            <td className="max-w-[240px] truncate px-4 py-2.5 text-gray-700" title={reservation.admin_notes ?? '-'}>{reservation.admin_notes ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            page={reservationPagination.page}
                            perPage={reservationPagination.perPage}
                            total={reservationPagination.total}
                            pageCount={reservationPagination.pageCount}
                            startItem={reservationPagination.startItem}
                            endItem={reservationPagination.endItem}
                            perPageOptions={reservationPagination.perPageOptions}
                            onPageChange={reservationPagination.setPage}
                            onPerPageChange={reservationPagination.setPerPage}
                        />
                    </Panel>

                    <Panel
                        title="Data Rekam Medis"
                        subtitle={canViewMedicalRecords ? 'Preview rekam medis clinic-scoped sebelum export' : 'Data rekam medis tidak ditampilkan untuk superadmin'}
                    >
                        {!canViewMedicalRecords ? (
                            <div className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                                Rekam medis tidak ditampilkan pada akses superadmin sesuai aturan privasi sistem.
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1260px] border-collapse text-[12px] whitespace-nowrap">
                                        <thead>
                                            <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                {['No', 'Issued At', 'Pasien/Walk-In', 'Dokter', 'Reservation Number', 'Keluhan', 'Diagnosis', 'Treatment', 'Prescription Note', 'Doctor Notes'].map((header) => (
                                                    <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {medicalRecords.length === 0 ? (
                                                <EmptyRow colSpan={10}>Tidak ada data rekam medis sesuai filter.</EmptyRow>
                                            ) : medicalRecordPagination.paginatedItems.map((record, index) => (
                                                <tr key={record.id} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                                                    <td className="px-4 py-2.5 text-gray-700">{String(medicalRecordPagination.startItem + index).padStart(3, '0')}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{dateTimeLabel(record.issued_at)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{medicalPatientName(record)}</td>
                                                    <td className="px-4 py-2.5 text-gray-700">{record.doctor?.name ?? '-'}</td>
                                                    <td className="px-4 py-2.5 font-medium text-[#40311D]">{record.reservation?.reservation_number ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.reservation?.complaint ?? '-'}>{record.reservation?.complaint ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.diagnosis ?? '-'}>{record.diagnosis ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.treatment ?? '-'}>{record.treatment ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={record.prescription_notes ?? '-'}>{record.prescription_notes ?? '-'}</td>
                                                    <td className="max-w-[260px] truncate px-4 py-2.5 text-gray-700" title={record.doctor_notes}>{record.doctor_notes}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <PaginationControls
                                    page={medicalRecordPagination.page}
                                    perPage={medicalRecordPagination.perPage}
                                    total={medicalRecordPagination.total}
                                    pageCount={medicalRecordPagination.pageCount}
                                    startItem={medicalRecordPagination.startItem}
                                    endItem={medicalRecordPagination.endItem}
                                    perPageOptions={medicalRecordPagination.perPageOptions}
                                    onPageChange={medicalRecordPagination.setPage}
                                    onPerPageChange={medicalRecordPagination.setPerPage}
                                />
                            </>
                        )}
                    </Panel>
                </div>
            </section>
        </AppLayout>
    );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
                <p className="text-[13px] font-medium text-[#40311D]">{title}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
            </div>
            {children}
        </section>
    );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                {children}
            </td>
        </tr>
    );
}

function StatusBadge({ status }: { status: string }) {
    const className = {
        pending: 'bg-amber-50 text-amber-700',
        approved: 'bg-teal-50 text-teal-700',
        completed: 'bg-sky-50 text-sky-700',
        cancelled: 'bg-red-50 text-red-600',
        rejected: 'bg-red-50 text-red-600',
    }[status] ?? 'bg-gray-100 text-gray-600';

    return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>{statusLabel(status)}</span>;
}

function statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function patientName(reservation: ReservationEntry): string {
    return reservation.patient?.name ?? reservation.guest_name ?? 'Walk-in Patient';
}

function patientContact(reservation: ReservationEntry): string {
    return reservation.patient?.phone_number ?? reservation.patient?.email ?? reservation.guest_phone_number ?? '-';
}

function medicalPatientName(record: MedicalRecordEntry): string {
    return record.patient?.name ?? record.guest_name ?? 'Walk-in Patient';
}

function dateLabel(value: string): string {
    return value ? value.slice(0, 10) : '-';
}

function dateTimeLabel(value: string): string {
    return value ? value.replace('T', ' ').slice(0, 16) : '-';
}

function timeRange(start?: string | null, end?: string | null): string {
    return start && end ? `${start} - ${end}` : '-';
}

function queueLabel(reservation: ReservationEntry): string {
    const number = reservation.queue_summary?.number;
    const status = reservation.queue_summary?.status;

    if (!number && !status) {
        return '-';
    }

    return `#${number ?? '-'} / ${status ?? '-'}`;
}

function buildQuery(form: ReportForm) {
    const entries = Object.entries({
        clinic_id: form.clinicId,
        date_from: form.dateFrom,
        date_to: form.dateTo,
        doctor_id: form.doctorId,
        status: form.status,
        search: form.search.trim(),
        format: form.format,
    }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');

    return Object.fromEntries(entries);
}
