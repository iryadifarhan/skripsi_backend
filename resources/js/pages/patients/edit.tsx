import { Head, Link, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { MedicalRecordEntry, PatientDetailEntry, ReservationEntry, SharedData, WorkspaceContext } from '@/types';

type PatientDetailPageProps = {
    context: WorkspaceContext;
    patientType: 'registered' | 'walk_in';
    selectedClinicId: number | null;
    patient: PatientDetailEntry;
    reservations: ReservationEntry[];
    medicalRecords: MedicalRecordEntry[];
    canEdit: boolean;
    canDelete: boolean;
    canViewMedicalRecords: boolean;
};

type PageProps = SharedData & { errors?: Record<string, string> };

type PatientForm = {
    name: string;
    username: string;
    email: string;
    phone_number: string;
    date_of_birth: string;
    gender: string;
};

export default function PatientDetailPage({ context, patientType, selectedClinicId, patient, reservations, medicalRecords, canEdit, canDelete, canViewMedicalRecords }: PatientDetailPageProps) {
    const page = usePage<PageProps>();
    const isRegistered = patientType === 'registered';
    const [form, setForm] = useState<PatientForm>({
        name: patient.name ?? '',
        username: patient.username ?? '',
        email: patient.email ?? '',
        phone_number: patient.phone_number ?? '',
        date_of_birth: patient.date_of_birth ?? '',
        gender: patient.gender ?? '',
    });
    const [saving, setSaving] = useState(false);
    const reservationPagination = useClientPagination(reservations);
    const medicalRecordPagination = useClientPagination(medicalRecords);

    const updatePatient = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canEdit || !patient.id) {
            return;
        }

        setSaving(true);

        router.patch(`/patients/${patient.id}`, {
            ...form,
            phone_number: form.phone_number || null,
            date_of_birth: form.date_of_birth || null,
            gender: form.gender || null,
        }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
        });
    };

    const deletePatient = () => {
        if (!canDelete || !patient.id) {
            return;
        }

        if (!window.confirm(`Hapus pasien ${patient.name}? Pasien dengan riwayat reservasi atau rekam medis tidak dapat dihapus.`)) {
            return;
        }

        router.delete(`/patients/${patient.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout>
            <Head title="Detail Pasien" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    <FlashAndErrors page={page} />

                    <div className="flex items-center justify-end gap-4">
                        <Link
                            href="/patients"
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#faf9f7]"
                        >
                            Kembali
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
                        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <CardHeader title="Profil Pasien" subtitle={canEdit ? 'Data pasien dapat diedit oleh superadmin' : 'Data pasien read-only'} />
                            <div className="p-4">
                                <div className="mb-5 flex items-center gap-3">
                                    <PatientAvatar name={patient.name} imageUrl={patient.image_url} />
                                    <div>
                                        <p className="text-[15px] font-medium text-[#2c2115]">{patient.name}</p>
                                        <p className="text-[11px] text-gray-400">{isRegistered ? 'Pasien Terdaftar' : 'Walk-In'}</p>
                                    </div>
                                </div>

                                {isRegistered ? (
                                    <form onSubmit={updatePatient} className="grid gap-3">
                                        <TextField label="Nama" value={form.name} error={page.props.errors?.name} disabled={!canEdit} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
                                        <TextField label="Username" value={form.username} error={page.props.errors?.username} disabled={!canEdit} onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
                                        <TextField label="Email" type="email" value={form.email} error={page.props.errors?.email} disabled={!canEdit} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                                        <TextField label="Nomor Telepon" value={form.phone_number} error={page.props.errors?.phone_number} disabled={!canEdit} onChange={(value) => setForm((current) => ({ ...current, phone_number: value }))} />
                                        <TextField label="Tanggal Lahir" type="date" value={form.date_of_birth} error={page.props.errors?.date_of_birth} disabled={!canEdit} onChange={(value) => setForm((current) => ({ ...current, date_of_birth: value }))} />
                                        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                                            Gender
                                            <select
                                                value={form.gender}
                                                disabled={!canEdit}
                                                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                                                className="rounded-lg border border-gray-300 px-3 py-2.5 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-500"
                                            >
                                                <option value="">Tidak diisi</option>
                                                <option value="Laki">Laki</option>
                                                <option value="Perempuan">Perempuan</option>
                                            </select>
                                            {page.props.errors?.gender ? <span className="text-[11px] font-medium text-red-600">{page.props.errors.gender}</span> : null}
                                        </label>

                                        {canEdit ? (
                                            <div className="mt-2 grid gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={saving}
                                                    className="rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    Simpan Perubahan
                                                </button>
                                                {canDelete ? (
                                                    <button
                                                        type="button"
                                                        onClick={deletePatient}
                                                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] font-medium text-red-600 transition hover:bg-red-100"
                                                    >
                                                        Hapus Pasien
                                                    </button>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </form>
                                ) : (
                                    <div className="grid gap-3 text-[12px] text-gray-600">
                                        <InfoLine label="Nama" value={patient.name} />
                                        <InfoLine label="Telepon" value={patient.phone_number ?? '-'} />
                                        <InfoLine label="Reservasi" value={String(patient.reservation_count ?? reservations.length)} />
                                        <InfoLine label="Rekam medis" value={String(patient.medical_record_count ?? medicalRecords.length)} />
                                        <InfoLine label="Aktivitas terakhir" value={dateTimeLabel(patient.latest_activity_at)} />
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="min-w-0">
                            <Panel title="Riwayat Reservasi" subtitle={reservationSubtitle(context.role)}>
                                {reservations.length === 0 ? (
                                    <EmptyState>Belum ada riwayat reservasi.</EmptyState>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[920px] border-collapse text-[12px] whitespace-nowrap">
                                                <thead>
                                                    <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                        {['No', 'Kode', 'Klinik', 'Dokter', 'Tanggal', 'Window', 'Status', 'Keluhan'].map((header) => (
                                                            <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">{header}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reservationPagination.paginatedItems.map((reservation, index) => (
                                                        <tr key={reservation.id} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                                                            <td className="px-4 py-3 text-gray-700">{String(reservationPagination.startItem + index).padStart(3, '0')}</td>
                                                            <td className="px-4 py-3 font-medium text-[#40311D]">{reservation.reservation_number}</td>
                                                            <td className="px-4 py-3 text-gray-700">{reservation.clinic?.name ?? '-'}</td>
                                                            <td className="px-4 py-3 text-gray-700">{reservation.doctor?.name ?? '-'}</td>
                                                            <td className="px-4 py-3 text-gray-700">{formatDateLabel(reservation.reservation_date)}</td>
                                                            <td className="px-4 py-3 text-gray-700">{reservation.window_start_time} - {reservation.window_end_time}</td>
                                                            <td className="px-4 py-3 text-gray-700"><StatusBadge status={reservation.status} /></td>
                                                            <td className="max-w-[260px] truncate px-4 py-3 text-gray-700" title={reservation.complaint ?? '-'}>{reservation.complaint ?? '-'}</td>
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
                                    </>
                                )}
                            </Panel>
                        </div>
                    </div>

                    <Panel title="Riwayat Rekam Medis" subtitle={canViewMedicalRecords ? 'Clinic-scoped sesuai akses admin klinik' : 'Data rekam medis tidak ditampilkan untuk superadmin'}>
                        {!canViewMedicalRecords ? (
                            <EmptyState>Rekam medis tidak ditampilkan pada akses superadmin sesuai aturan privasi sistem.</EmptyState>
                        ) : medicalRecords.length === 0 ? (
                            <EmptyState>Belum ada riwayat rekam medis pada klinik ini.</EmptyState>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1120px] border-collapse text-[12px] whitespace-nowrap">
                                        <thead>
                                            <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                {['No', 'Tanggal', 'Dokter', 'Klinik', 'Reservation Number', 'Keluhan', 'Diagnosis', 'Treatment', 'Prescription Note', 'Doctor Notes'].map((header) => (
                                                    <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {medicalRecordPagination.paginatedItems.map((record, index) => (
                                                <tr key={record.id} className="border-b border-[#ede8e2] last:border-0 hover:bg-[#faf9f7]">
                                                    <td className="px-4 py-3 text-gray-700">{String(medicalRecordPagination.startItem + index).padStart(3, '0')}</td>
                                                    <td className="px-4 py-3 text-gray-700">{dateTimeLabel(record.issued_at)}</td>
                                                    <td className="px-4 py-3 text-gray-700">{record.doctor?.name ?? '-'}</td>
                                                    <td className="px-4 py-3 text-gray-700">{record.clinic?.name ?? '-'}</td>
                                                    <td className="px-4 py-3 font-medium text-[#40311D]">{record.reservation?.reservation_number ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.reservation?.complaint ?? '-'}>{record.reservation?.complaint ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.diagnosis ?? '-'}>{record.diagnosis ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.treatment ?? '-'}>{record.treatment ?? '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-3 text-gray-700" title={record.prescription_notes ?? '-'}>{record.prescription_notes ?? '-'}</td>
                                                    <td className="max-w-[260px] truncate px-4 py-3 text-gray-700" title={record.doctor_notes}>{record.doctor_notes}</td>
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
            <CardHeader title={title} subtitle={subtitle} />
            <div>{children}</div>
        </section>
    );
}

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
            <p className="text-[13px] font-medium text-[#40311D]">{title}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
        </div>
    );
}

function EmptyState({ children }: { children: ReactNode }) {
    return <p className="p-4 text-[12px] italic text-gray-400">{children}</p>;
}

function PatientAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
    if (imageUrl) {
        return <img src={imageUrl} alt={name} className="h-14 w-14 rounded-xl object-cover" />;
    }

    return (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#40311D] text-[12px] font-bold uppercase text-white">
            {initials(name)}
        </div>
    );
}

function TextField({ label, value, onChange, error, disabled, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; error?: string; disabled?: boolean; type?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            {label}
            <input
                type={type}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:bg-gray-100 disabled:text-gray-500"
            />
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </label>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0">
            <span className="text-gray-400">{label}</span>
            <span className="text-right font-medium text-gray-700">{value}</span>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: 'bg-amber-50 text-amber-700',
        approved: 'bg-teal-50 text-teal-700',
        completed: 'bg-teal-50 text-teal-700',
        cancelled: 'bg-red-50 text-red-600',
        rejected: 'bg-red-50 text-red-600',
    };

    return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>{formatStatus(status)}</span>;
}

function FlashAndErrors({ page }: { page: ReturnType<typeof usePage<PageProps>> }) {
    const errors = page.props.errors ?? {};

    return (
        <>
            {page.props.flash?.status ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[12px] font-medium text-teal-700">
                    {page.props.flash.status}
                </div>
            ) : null}
            {Object.keys(errors).length > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                    {Object.values(errors).flat().join(' ')}
                </div>
            ) : null}
        </>
    );
}

function initials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('') || 'PA';
}

function dateTimeLabel(value?: string | null): string {
    if (!value) {
        return '-';
    }

    return value.replace('T', ' ').slice(0, 16);
}

function formatDateLabel(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthIndex = Number(month) - 1;

    if (!year || !month || !day || monthIndex < 0 || monthIndex > 11) {
        return value;
    }

    return `${day} ${monthNames[monthIndex]} ${year}`;
}

function formatStatus(status: string): string {
    const labels: Record<string, string> = {
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
        completed: 'Completed',
    };

    return labels[status] ?? status;
}

function reservationSubtitle(role: WorkspaceContext['role']): string {
    return role === 'superadmin' ? 'Seluruh riwayat reservasi pasien' : 'Riwayat reservasi pasien pada klinik admin';
}
