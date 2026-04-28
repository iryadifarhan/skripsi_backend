import { Head, Link, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { UserAvatar } from '@/components/avatar-selector';
import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { PatientSummaryEntry, SharedData, ValidationErrors, WalkInPatientSummaryEntry, WorkspaceContext } from '@/types';

type PatientsPageProps = {
    context: WorkspaceContext;
    selectedClinicId: number | null;
    patients: PatientSummaryEntry[];
    walkIns: WalkInPatientSummaryEntry[];
    canCreate: boolean;
};

type PatientTab = 'registered' | 'walk_in';

type PatientCreateForm = {
    name: string;
    username: string;
    email: string;
    phone_number: string;
    date_of_birth: string;
    gender: string;
    password: string;
    password_confirmation: string;
};

type PatientRow = PatientSummaryEntry | WalkInPatientSummaryEntry;

type PageProps = SharedData & { errors?: Record<string, string> };

export default function PatientsPage({ context, selectedClinicId, patients, walkIns, canCreate }: PatientsPageProps) {
    const page = usePage<PageProps>();
    const [activeTab, setActiveTab] = useState<PatientTab>('registered');
    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState('');
    const [selectedKey, setSelectedKey] = useState<string | null>(patients[0] ? registeredKey(patients[0]) : walkIns[0] ? walkInKey(walkIns[0]) : null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<PatientCreateForm>({
        name: '',
        username: '',
        email: '',
        phone_number: '',
        date_of_birth: '',
        gender: '',
        password: '',
        password_confirmation: '',
    });
    const [saving, setSaving] = useState(false);

    const currentRows = activeTab === 'registered' ? patients : walkIns;
    const filteredRows = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return currentRows.filter((row) => {
            const matchesGender = activeTab !== 'registered' || genderFilter === '' || (row as PatientSummaryEntry).gender === genderFilter;
            const searchableValues = activeTab === 'registered'
                ? [row.name, (row as PatientSummaryEntry).username, (row as PatientSummaryEntry).email, row.phone_number]
                : [row.name, row.phone_number, ...((row as WalkInPatientSummaryEntry).clinics ?? [])];
            const matchesSearch = keyword === '' || searchableValues
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));

            return matchesGender && matchesSearch;
        });
    }, [activeTab, currentRows, genderFilter, search]);
    const patientPagination = useClientPagination(filteredRows);
    const selectedEntry = [...patients, ...walkIns].find((row) => rowKey(row) === selectedKey) ?? null;

    useEffect(() => {
        if (patientPagination.paginatedItems.some((row) => rowKey(row) === selectedKey)) {
            return;
        }

        setSelectedKey(patientPagination.paginatedItems[0] ? rowKey(patientPagination.paginatedItems[0]) : null);
    }, [patientPagination.paginatedItems, selectedKey]);

    const createPatient = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canCreate) {
            return;
        }

        setSaving(true);

        router.post('/patients', {
            ...createForm,
            phone_number: createForm.phone_number || null,
            date_of_birth: createForm.date_of_birth || null,
            gender: createForm.gender || null,
        }, {
            preserveScroll: true,
            onSuccess: () => setShowCreateModal(false),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AppLayout>
            <Head title="Data Pasien" />

            <section className="h-full overflow-y-auto bg-[#DFE0DF]">
                <div className="flex flex-col gap-4 p-5">
                    <FlashAndErrors page={page} />

                    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="flex min-w-[260px] flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                Cari pasien
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={activeTab === 'registered' ? 'Nama, email, username, telepon...' : 'Nama, telepon, klinik...'}
                                    className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none placeholder:italic placeholder:text-gray-400 focus:border-[#40311D]"
                                />
                            </label>

                            {activeTab === 'registered' ? (
                                <label className="flex min-w-44 flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                    Gender
                                    <select
                                        value={genderFilter}
                                        onChange={(event) => setGenderFilter(event.target.value)}
                                        className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                    >
                                        <option value="">Semua Gender</option>
                                        <option value="Laki">Laki</option>
                                        <option value="Perempuan">Perempuan</option>
                                    </select>
                                </label>
                            ) : null}

                            <div className="flex gap-2">
                                <TabButton active={activeTab === 'registered'} onClick={() => setActiveTab('registered')}>
                                    Terdaftar ({patients.length})
                                </TabButton>
                                <TabButton active={activeTab === 'walk_in'} onClick={() => setActiveTab('walk_in')}>
                                    Walk-In ({walkIns.length})
                                </TabButton>
                            </div>

                            {canCreate ? (
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(true)}
                                    className="rounded-full bg-[#00917B] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#006d5c]"
                                >
                                    Tambah Pasien
                                </button>
                            ) : null}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
                        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <CardHeader
                                title="Daftar Pasien"
                                subtitle={activeTab === 'registered'
                                    ? patientScopeLabel(context.role)
                                    : 'Pasien walk-in digabung berdasarkan nama atau nomor telepon yang sama'}
                            />

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[880px] border-collapse text-[12px]">
                                    <thead>
                                        <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                            {(activeTab === 'registered'
                                                ? ['No', 'Nama', 'Email', 'Phone', 'Gender', 'Reservasi', 'Rekam Medis', 'Aktivitas Terakhir']
                                                : ['No', 'Nama Walk-In', 'Phone', 'Klinik', 'Reservasi', 'Rekam Medis', 'Aktivitas Terakhir']
                                            ).map((header) => (
                                                <th key={header} className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={activeTab === 'registered' ? 8 : 7} className="px-4 py-8 text-center text-[12px] italic text-gray-400">
                                                    Tidak ada pasien yang sesuai filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            patientPagination.paginatedItems.map((row, index) => (
                                                <tr
                                                    key={rowKey(row)}
                                                    onClick={() => setSelectedKey(rowKey(row))}
                                                    className={`cursor-pointer border-b border-[#ede8e2] transition-colors last:border-0 hover:bg-[#faf9f7] ${selectedKey === rowKey(row) ? 'bg-[#faf9f7]' : ''}`}
                                                >
                                                    <td className="px-4 py-3 text-gray-700">{String(patientPagination.startItem + index).padStart(2, '0')}</td>
                                                    {activeTab === 'registered' ? <RegisteredPatientRow row={row as PatientSummaryEntry} /> : <WalkInPatientRow row={row as WalkInPatientSummaryEntry} />}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationControls
                                page={patientPagination.page}
                                perPage={patientPagination.perPage}
                                total={patientPagination.total}
                                pageCount={patientPagination.pageCount}
                                startItem={patientPagination.startItem}
                                endItem={patientPagination.endItem}
                                perPageOptions={patientPagination.perPageOptions}
                                onPageChange={patientPagination.setPage}
                                onPerPageChange={patientPagination.setPerPage}
                            />
                        </section>

                        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <CardHeader title="Ringkasan Pasien" subtitle="Detail pasien terpilih" />
                            <div className="min-h-[260px] p-4 text-[12px] text-gray-600">
                                {selectedEntry ? (
                                    <PatientSummaryPanel entry={selectedEntry} selectedClinicId={selectedClinicId} />
                                ) : (
                                    <p className="italic text-gray-400">Pilih pasien untuk melihat detail.</p>
                                )}
                            </div>
                        </aside>
                    </div>
                </div>
            </section>

            {showCreateModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e4ddd4] bg-white shadow-xl">
                        <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                            <p className="text-[15px] font-medium text-[#40311D]">Tambah Pasien Terdaftar</p>
                            <p className="mt-1 text-[12px] text-gray-400">Superadmin membuat akun pasien baru. Password hanya dipakai saat create.</p>
                        </div>
                        <form onSubmit={createPatient} className="grid gap-4 p-5 md:grid-cols-2">
                            <TextField label="Nama" value={createForm.name} error={page.props.errors?.name} onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))} />
                            <TextField label="Username" value={createForm.username} error={page.props.errors?.username} onChange={(value) => setCreateForm((current) => ({ ...current, username: value }))} />
                            <TextField label="Email" type="email" value={createForm.email} error={page.props.errors?.email} onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))} />
                            <TextField label="Nomor Telepon" value={createForm.phone_number} error={page.props.errors?.phone_number} onChange={(value) => setCreateForm((current) => ({ ...current, phone_number: value }))} />
                            <TextField label="Tanggal Lahir" type="date" value={createForm.date_of_birth} error={page.props.errors?.date_of_birth} onChange={(value) => setCreateForm((current) => ({ ...current, date_of_birth: value }))} />
                            <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                                Gender
                                <select
                                    value={createForm.gender}
                                    onChange={(event) => setCreateForm((current) => ({ ...current, gender: event.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2.5 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
                                >
                                    <option value="">Tidak diisi</option>
                                    <option value="Laki">Laki</option>
                                    <option value="Perempuan">Perempuan</option>
                                </select>
                                {page.props.errors?.gender ? <span className="text-[11px] font-medium text-red-600">{page.props.errors.gender}</span> : null}
                            </label>
                            <TextField label="Password" type="password" value={createForm.password} error={page.props.errors?.password} onChange={(value) => setCreateForm((current) => ({ ...current, password: value }))} />
                            <TextField label="Konfirmasi Password" type="password" value={createForm.password_confirmation} error={page.props.errors?.password_confirmation} onChange={(value) => setCreateForm((current) => ({ ...current, password_confirmation: value }))} />

                            <div className="flex justify-end gap-2 md:col-span-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition hover:bg-[#DFE0DF]"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Simpan Pasien
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </AppLayout>
    );
}

function RegisteredPatientRow({ row }: { row: PatientSummaryEntry }) {
    return (
        <>
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <UserAvatar name={row.name} avatarUrl={row.display_avatar_url ?? row.image_url} size="md" />
                    <div>
                        <p className="font-medium text-[#2c2115]">{row.name}</p>
                        <p className="text-[11px] text-gray-400">{row.username}</p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3 text-gray-700">{row.email}</td>
            <td className="px-4 py-3 text-gray-700">{row.phone_number ?? '-'}</td>
            <td className="px-4 py-3 text-gray-700">{row.gender ?? '-'}</td>
            <td className="px-4 py-3 text-gray-700">{row.reservation_count}</td>
            <td className="px-4 py-3 text-gray-700">{row.medical_record_count}</td>
            <td className="px-4 py-3 text-gray-700">{dateTimeLabel(row.latest_activity_at)}</td>
        </>
    );
}

function WalkInPatientRow({ row }: { row: WalkInPatientSummaryEntry }) {
    return (
        <>
            <td className="px-4 py-3 font-medium text-[#2c2115]">{row.name}</td>
            <td className="px-4 py-3 text-gray-700">{row.phone_number ?? '-'}</td>
            <td className="px-4 py-3 text-gray-700">{row.clinics?.join(', ') || '-'}</td>
            <td className="px-4 py-3 text-gray-700">{row.reservation_count}</td>
            <td className="px-4 py-3 text-gray-700">{row.medical_record_count}</td>
            <td className="px-4 py-3 text-gray-700">{dateTimeLabel(row.latest_activity_at)}</td>
        </>
    );
}

function PatientSummaryPanel({ entry, selectedClinicId }: { entry: PatientRow; selectedClinicId: number | null }) {
    const isRegistered = entry.type === 'registered';
    const href = isRegistered
        ? `/patients/${(entry as PatientSummaryEntry).id}/edit${selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''}`
        : `/patients/walk-ins/${(entry as WalkInPatientSummaryEntry).walk_in_key}${selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''}`;

    return (
        <div className="grid gap-4">
            <div className="flex items-center gap-3">
                {isRegistered ? (
                    <UserAvatar name={entry.name} avatarUrl={(entry as PatientSummaryEntry).display_avatar_url ?? (entry as PatientSummaryEntry).image_url} size="md" />
                ) : (
                    <UserAvatar name={entry.name} size="md" />
                )}
                <div>
                    <p className="text-[15px] font-medium text-[#2c2115]">{entry.name}</p>
                    <p className="text-[11px] text-gray-400">{isRegistered ? (entry as PatientSummaryEntry).email : 'Pasien walk-in tanpa akun'}</p>
                </div>
            </div>
            <InfoLine label="Tipe" value={isRegistered ? 'Terdaftar' : 'Walk-In'} />
            <InfoLine label="Telepon" value={entry.phone_number ?? '-'} />
            {isRegistered ? <InfoLine label="Gender" value={(entry as PatientSummaryEntry).gender ?? '-'} /> : null}
            {isRegistered ? <InfoLine label="Tanggal lahir" value={(entry as PatientSummaryEntry).date_of_birth ?? '-'} /> : null}
            <InfoLine label="Reservasi" value={String(entry.reservation_count)} />
            <InfoLine label="Rekam medis" value={String(entry.medical_record_count)} />
            <InfoLine label="Aktivitas terakhir" value={dateTimeLabel(entry.latest_activity_at)} />
            {!isRegistered ? <InfoLine label="Klinik" value={(entry as WalkInPatientSummaryEntry).clinics?.join(', ') || '-'} /> : null}
            <Link
                href={href}
                className="mt-2 block rounded-lg bg-[#40311D] px-4 py-2.5 text-center text-[12px] font-medium text-white transition hover:bg-[#2c2115]"
            >
                Detail pasien
            </Link>
        </div>
    );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-4 py-2 text-[12px] transition-colors ${active ? 'border-[#40311D] bg-[#40311D] text-white' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}`}
        >
            {children}
        </button>
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

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0">
            <span className="text-gray-400">{label}</span>
            <span className="text-right font-medium text-gray-700">{value}</span>
        </div>
    );
}

function TextField({ label, value, onChange, error, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
            />
            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </label>
    );
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

function rowKey(row: PatientRow): string {
    return row.type === 'registered' ? registeredKey(row as PatientSummaryEntry) : walkInKey(row as WalkInPatientSummaryEntry);
}

function registeredKey(row: PatientSummaryEntry): string {
    return `registered-${row.id}`;
}

function walkInKey(row: WalkInPatientSummaryEntry): string {
    return `walk-in-${row.walk_in_key}`;
}

function dateTimeLabel(value?: string | null): string {
    if (!value) {
        return '-';
    }

    return value.replace('T', ' ').slice(0, 16);
}

function patientScopeLabel(role: WorkspaceContext['role']): string {
    return role === 'superadmin'
        ? 'Seluruh pasien terdaftar di sistem'
        : 'Pasien yang pernah reservasi atau memiliki rekam medis di klinik ini';
}
