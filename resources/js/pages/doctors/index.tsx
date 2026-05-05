import { Head, Link, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { UserAvatar } from '@/components/avatar-selector';
import { ClinicSelector } from '@/components/clinic-selector';
import AppLayout from '@/layouts/app-layout';
import { PaginationControls, useClientPagination } from '@/lib/client-pagination';
import type { ClinicDetail, DoctorClinicScheduleEntry, DoctorEntry, SharedData, ValidationErrors, WorkspaceContext } from '@/types';

type DoctorsPageProps = {
    context: WorkspaceContext;
    selectedClinicId: number | null;
    clinic: ClinicDetail | null;
    unassignedDoctors: DoctorEntry[];
    schedules: DoctorClinicScheduleEntry[];
};

type DoctorTab = 'registered' | 'unregistered';

type DoctorCreateForm = {
    name: string;
    username: string;
    email: string;
    phone_number: string;
    date_of_birth: string;
    gender: string;
    password: string;
    password_confirmation: string;
};

type JsonResult = {
    ok: boolean;
    message?: string;
    errors?: ValidationErrors;
};

export default function DoctorsPage({ context, selectedClinicId, clinic, unassignedDoctors, schedules }: DoctorsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const isSuperadmin = context.role === 'superadmin';
    const [activeTab, setActiveTab] = useState<DoctorTab>('registered');
    const [search, setSearch] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(clinic?.doctors?.[0]?.id ?? unassignedDoctors[0]?.id ?? null);
    const [assignSpecialities, setAssignSpecialities] = useState('');
    const [showCreateDoctor, setShowCreateDoctor] = useState(false);
    const [createDoctorForm, setCreateDoctorForm] = useState<DoctorCreateForm>({
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
    const [message, setMessage] = useState<string | null>(null);
    const [errors, setErrors] = useState<ValidationErrors>({});

    const registeredDoctors = clinic?.doctors ?? [];
    const currentDoctors = activeTab === 'registered' ? registeredDoctors : unassignedDoctors;
    const filteredDoctors = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (keyword === '') {
            return currentDoctors;
        }

        return currentDoctors.filter((doctor) =>
            [doctor.name, doctor.username, doctor.email, doctor.phone_number, ...(doctor.specialities ?? [])]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword)),
        );
    }, [currentDoctors, search]);
    const doctorPagination = useClientPagination(filteredDoctors);
    const selectedDoctor = [...registeredDoctors, ...unassignedDoctors].find((doctor) => doctor.id === selectedDoctorId) ?? null;
    const selectedIsRegistered = selectedDoctor !== null && registeredDoctors.some((doctor) => doctor.id === selectedDoctor.id);
    const canRemoveDoctorFromClinic = clinic !== null && selectedDoctor !== null && selectedIsRegistered;

    useEffect(() => {
        if (doctorPagination.paginatedItems.some((doctor) => doctor.id === selectedDoctorId)) {
            return;
        }

        setSelectedDoctorId(doctorPagination.paginatedItems[0]?.id ?? null);
    }, [doctorPagination.paginatedItems, selectedDoctorId]);

    const createDoctor = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isSuperadmin) {
            return;
        }

        setSaving(true);
        setMessage(null);
        setErrors({});

        router.post(
            '/doctors',
            {
                clinic_id: clinic?.id ?? selectedClinicId,
                ...createDoctorForm,
                phone_number: createDoctorForm.phone_number || null,
                date_of_birth: createDoctorForm.date_of_birth || null,
                gender: createDoctorForm.gender || null,
            },
            {
                preserveScroll: true,
                onError: (validationErrors) => {
                    setErrors(normalizeInertiaErrors(validationErrors));
                    setMessage('Gagal membuat data dokter.');
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const assignDoctorToClinic = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (clinic === null || selectedDoctor === null || selectedIsRegistered) {
            return;
        }

        setSaving(true);
        setMessage(null);
        setErrors({});

        const result = await requestJson(`/admin/clinic/doctor/${clinic.id}`, 'PATCH', {
            clinic_id: clinic.id,
            doctor_id: selectedDoctor.id,
            ...(isSuperadmin ? {} : { speciality: parseSpecialities(assignSpecialities) }),
        });

        setSaving(false);

        if (!result.ok) {
            setMessage(result.message ?? 'Gagal mengassign dokter ke klinik.');
            setErrors(result.errors ?? {});
            return;
        }

        setActiveTab('registered');
        setAssignSpecialities('');
        router.reload({ preserveScroll: true });
    };

    const removeDoctorFromClinic = async () => {
        if (!canRemoveDoctorFromClinic) {
            return;
        }

        if (!window.confirm(`Remove ${selectedDoctor.name} dari ${clinic.name}? Data dokter tidak akan dihapus.`)) {
            return;
        }

        setSaving(true);
        setMessage(null);
        setErrors({});

        const result = await requestJson(`/admin/clinic/doctor/${clinic.id}`, 'DELETE', {
            clinic_id: clinic.id,
            doctor_id: selectedDoctor.id,
        });

        setSaving(false);

        if (!result.ok) {
            setMessage(result.message ?? 'Gagal remove dokter dari klinik.');
            setErrors(result.errors ?? {});
            return;
        }

        setActiveTab('unregistered');
        router.reload({ preserveScroll: true });
    };

    return (
        <AppLayout>
            <Head title="Data Dokter" />

            <section className="flex h-full flex-col overflow-hidden bg-[#DFE0DF]">
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col gap-4 p-5">
                        {flash?.status ? <Alert tone="success">{flash.status}</Alert> : null}
                        {message ? <Alert tone="danger">{message}</Alert> : null}

                        {context.role === 'superadmin' ? (
                        <ClinicSelector
                                    clinics={context.clinics}
                                    value={selectedClinicId}
                                    onChange={(clinicId) => router.get('/doctors', { clinic_id: clinicId }, { preserveScroll: true })}
                                />
                        ) : null}

                        <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="flex min-w-[260px] flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                                    Cari dokter
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        className="rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none placeholder:italic placeholder:text-gray-400 focus:border-[#40311D]"
                                        placeholder="Nama, email, username, spesialisasi..."
                                    />
                                </label>

                                <div className="flex gap-2">
                                    <TabButton active={activeTab === 'registered'} onClick={() => setActiveTab('registered')}>
                                        Terdaftar ({registeredDoctors.length})
                                    </TabButton>
                                    <TabButton active={activeTab === 'unregistered'} onClick={() => setActiveTab('unregistered')}>
                                        Belum Terdaftar ({unassignedDoctors.length})
                                    </TabButton>
                                </div>

                                {isSuperadmin ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateDoctor(true)}
                                        className="rounded-full bg-[#00917B] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#006d5c]"
                                    >
                                        Tambah Dokter
                                    </button>
                                ) : null}
                            </div>
                        </section>

                        {clinic === null ? (
                            <Alert tone="danger">Tidak ada klinik yang tersedia untuk akun ini.</Alert>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
                                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                    <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-4 py-3">
                                        <p className="text-[13px] font-medium text-[#40311D]">Daftar Dokter</p>
                                        <p className="mt-0.5 text-[11px] text-gray-400">
                                            {activeTab === 'registered'
                                                ? 'Dokter yang sudah terdaftar pada klinik terpilih'
                                                : 'Dokter sistem yang belum terdaftar pada klinik terpilih'}
                                        </p>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[780px] border-collapse text-[12px]">
                                            <thead>
                                                <tr className="border-b border-[#e4ddd4] bg-[#faf9f7]">
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">No</th>
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Nama</th>
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Email</th>
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Phone</th>
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Spesialisasi</th>
                                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">Jadwal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredDoctors.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-8 text-gray-400">
                                                            Tidak ada dokter untuk ditampilkan.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    doctorPagination.paginatedItems.map((doctor, index) => (
                                                        <tr
                                                            key={doctor.id}
                                                            onClick={() => setSelectedDoctorId(doctor.id)}
                                                            className={`cursor-pointer border-b border-[#ede8e2] transition-colors last:border-0 hover:bg-[#faf9f7] ${
                                                                selectedDoctorId === doctor.id ? 'bg-[#faf9f7]' : ''
                                                            }`}
                                                        >
                                                            <td className="px-4 py-3 text-gray-700">{String(doctorPagination.startItem + index).padStart(2, '0')}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-3">
                                                                    <UserAvatar name={doctor.name} avatarUrl={doctor.display_avatar_url ?? doctor.image_url} size="md" />
                                                                    <div>
                                                                        <p className="font-medium text-[#2c2115]">{doctor.name}</p>
                                                                        <p className="text-[11px] text-gray-400">{doctor.username}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-700">{doctor.email}</td>
                                                            <td className="px-4 py-3 text-gray-700">{doctor.phone_number ?? '-'}</td>
                                                            <td className="px-4 py-3 text-gray-700">{specialitiesLabel(doctor)}</td>
                                                            <td className="px-4 py-3 text-gray-700">{scheduleSummaryLabel(schedules, doctor.id)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <PaginationControls
                                        page={doctorPagination.page}
                                        perPage={doctorPagination.perPage}
                                        total={doctorPagination.total}
                                        pageCount={doctorPagination.pageCount}
                                        startItem={doctorPagination.startItem}
                                        endItem={doctorPagination.endItem}
                                        perPageOptions={doctorPagination.perPageOptions}
                                        onPageChange={doctorPagination.setPage}
                                        onPerPageChange={doctorPagination.setPerPage}
                                    />
                                </section>

                                <aside className="flex flex-col gap-4">
                                    <Panel title="Ringkasan Dokter" subtitle="Detail dokter terpilih">
                                        {selectedDoctor === null ? (
                                            <p className="text-[12px] italic text-gray-400">Pilih dokter untuk melihat detail.</p>
                                        ) : (
                                            <div className="space-y-3 text-[12px] text-gray-600">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar name={selectedDoctor.name} avatarUrl={selectedDoctor.display_avatar_url ?? selectedDoctor.image_url} size="lg" />
                                                    <div>
                                                        <p className="text-[14px] font-medium text-[#2c2115]">{selectedDoctor.name}</p>
                                                        <p className="text-gray-400">{selectedDoctor.email}</p>
                                                    </div>
                                                </div>
                                                <InfoLine label="Telepon" value={selectedDoctor.phone_number ?? '-'} />
                                                <InfoLine label="Gender" value={selectedDoctor.gender ?? '-'} />
                                                <InfoLine label="Tanggal lahir" value={selectedDoctor.date_of_birth ?? '-'} />
                                                <InfoLine label="Spesialisasi" value={specialitiesLabel(selectedDoctor)} />
                                                <InfoLine label="Status klinik" value={selectedIsRegistered ? 'Terdaftar' : 'Belum terdaftar'} />

                                                {selectedIsRegistered || isSuperadmin ? (
                                                    <Link
                                                        href={`/doctors/${selectedDoctor.id}/edit?clinic_id=${clinic.id}`}
                                                        className="block w-full rounded-lg bg-[#40311D] px-4 py-2.5 text-center text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115]"
                                                    >
                                                        Detail dokter
                                                    </Link>
                                                ) : null}
                                                {canRemoveDoctorFromClinic ? (
                                                    <button
                                                        type="button"
                                                        onClick={removeDoctorFromClinic}
                                                        disabled={saving}
                                                        className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-[12px] font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {saving ? 'Memproses...' : 'Remove dari Klinik'}
                                                    </button>
                                                ) : null}
                                            </div>
                                        )}
                                    </Panel>

                                    {activeTab === 'unregistered' ? (
                                        <Panel title="Assign Dokter ke Klinik" subtitle="Tambahkan dokter belum terdaftar">
                                            {selectedDoctor === null || selectedIsRegistered ? (
                                                <p className="text-[12px] italic text-gray-400">Pilih dokter dari tab Belum Terdaftar untuk mengassign ke klinik ini.</p>
                                            ) : (
                                                <form onSubmit={assignDoctorToClinic} className="space-y-3 text-[12px]">
                                                    <p className="text-gray-600">
                                                        Assign <span className="font-medium text-[#40311D]">{selectedDoctor.name}</span> ke {clinic.name}.
                                                    </p>
                                                    {isSuperadmin ? (
                                                        <p className="rounded-lg bg-[#faf9f7] px-3 py-2 text-gray-500">
                                                            Superadmin hanya mengassign dokter ke klinik. Spesialisasi diisi oleh admin klinik.
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <label className="flex flex-col gap-2 text-[#40311D]">
                                                                Spesialisasi klinik
                                                                <input
                                                                    value={assignSpecialities}
                                                                    onChange={(event) => setAssignSpecialities(event.target.value)}
                                                                    className="rounded-lg border border-gray-300 px-3 py-2 text-[12px] outline-none focus:border-[#40311D]"
                                                                    placeholder="Contoh: Cardiology, Orthology"
                                                                />
                                                            </label>
                                                            <FieldError errors={errors} field="speciality" />
                                                        </>
                                                    )}
                                                    <button
                                                        type="submit"
                                                        disabled={saving}
                                                        className="w-full rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {saving ? 'Menyimpan...' : 'Assign Dokter'}
                                                    </button>
                                                </form>
                                            )}
                                        </Panel>
                                    ) : null}
                                </aside>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {showCreateDoctor ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                    <form onSubmit={createDoctor} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                            <p className="text-[16px] font-medium text-[#40311D]">Tambah Data Dokter</p>
                            <p className="mt-1 text-[12px] text-gray-400">Data dokter global dibuat oleh superadmin. Spesialisasi tetap diatur oleh admin klinik.</p>
                        </div>

                        <div className="grid gap-3 p-5 md:grid-cols-2">
                            <TextInput label="Nama" value={createDoctorForm.name} onChange={(value) => setCreateDoctorForm((current) => ({ ...current, name: value }))} />
                            <TextInput label="Username" value={createDoctorForm.username} onChange={(value) => setCreateDoctorForm((current) => ({ ...current, username: value }))} />
                            <TextInput label="Email" type="email" value={createDoctorForm.email} onChange={(value) => setCreateDoctorForm((current) => ({ ...current, email: value }))} />
                            <TextInput label="Nomor telepon" value={createDoctorForm.phone_number} onChange={(value) => setCreateDoctorForm((current) => ({ ...current, phone_number: value }))} />
                            <TextInput label="Tanggal lahir" type="date" value={createDoctorForm.date_of_birth} onChange={(value) => setCreateDoctorForm((current) => ({ ...current, date_of_birth: value }))} />
                            <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                                Gender
                                <select
                                    value={createDoctorForm.gender}
                                    onChange={(event) => setCreateDoctorForm((current) => ({ ...current, gender: event.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
                                >
                                    <option value="">Tidak diisi</option>
                                    <option value="Laki">Laki</option>
                                    <option value="Perempuan">Perempuan</option>
                                </select>
                            </label>
                            <TextInput label="Password" type="password" value={createDoctorForm.password} onChange={(value) => setCreateDoctorForm((current) => ({ ...current, password: value }))} />
                            <TextInput label="Konfirmasi password" type="password" value={createDoctorForm.password_confirmation} onChange={(value) => setCreateDoctorForm((current) => ({ ...current, password_confirmation: value }))} />
                        </div>

                        {Object.keys(errors).length > 0 ? (
                            <div className="mx-5 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-600">
                                {Object.values(errors).flat()[0]}
                            </div>
                        ) : null}

                        <div className="flex justify-end gap-2 border-t border-[#e4ddd4] px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setShowCreateDoctor(false)}
                                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] text-[#40311D] transition-colors hover:bg-[#DFE0DF]"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg bg-[#40311D] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? 'Menyimpan...' : 'Simpan Dokter'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
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
            <div className="p-4">{children}</div>
        </section>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-2 text-[12px] transition-colors ${
                active ? 'border-[#40311D] bg-[#40311D] text-white' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
        >
            {children}
        </button>
    );
}

function TextInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
            />
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

function Alert({ tone, children }: { tone: 'success' | 'danger'; children: ReactNode }) {
    const classes = tone === 'success'
        ? 'border-teal-200 bg-teal-50 text-teal-700'
        : 'border-red-200 bg-red-50 text-red-600';

    return <div className={`rounded-xl border px-4 py-3 text-[12px] ${classes}`}>{children}</div>;
}

function FieldError({ errors, field }: { errors: ValidationErrors; field: string }) {
    const message = errors[field]?.[0];

    return message ? <p className="text-[11px] font-medium text-red-600">{message}</p> : null;
}

function specialitiesLabel(doctor: DoctorEntry): string {
    const specialities = doctor.specialities ?? doctor.speciality ?? [];

    return specialities.length > 0 ? specialities.join(', ') : '-';
}

function scheduleSummaryLabel(schedules: DoctorClinicScheduleEntry[], doctorId: number): string {
    const doctorSchedules = schedules.filter((schedule) => schedule.doctor_id === doctorId);

    if (doctorSchedules.length === 0) {
        return '-';
    }

    const activeCount = doctorSchedules.filter((schedule) => schedule.is_active).length;

    return `${activeCount}/${doctorSchedules.length} aktif`;
}

function parseSpecialities(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

async function requestJson(url: string, method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>): Promise<JsonResult> {
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
        return {
            ok: false,
            message: body?.message ?? Object.values(body?.errors ?? {}).flat().join(' ') ?? 'Request failed.',
            errors: normalizeJsonErrors(body?.errors ?? {}),
        };
    }

    return { ok: true, message: body?.message };
}

function normalizeJsonErrors(errors: Record<string, unknown>): ValidationErrors {
    return Object.fromEntries(
        Object.entries(errors).map(([field, messages]) => [
            field,
            Array.isArray(messages) ? messages.map((message) => String(message)) : [String(messages)],
        ]),
    );
}

function normalizeInertiaErrors(errors: Record<string, string>): ValidationErrors {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]]));
}


