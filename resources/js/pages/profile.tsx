import { Head, router, usePage } from '@inertiajs/react';
import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useState } from 'react';

import { AvatarSelector } from '@/components/avatar-selector';
import { ClinicSelector } from '@/components/clinic-selector';
import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import AppLayout from '@/layouts/app-layout';
import type { AuthUser, SharedData } from '@/types';

type ProfilePageProps = {
    user: AuthUser & {
        clinic_specialities?: {
            clinic_id: number;
            clinic_name: string;
            specialities: string[];
        }[];
    };
    profilePictureOptions: string[];
    canManageAvatar: boolean;
};

type PageProps = SharedData & { errors?: Record<string, string> };

type ProfileForm = {
    name: string;
    username: string;
    email: string;
    phone_number: string;
    date_of_birth: string;
    gender: string;
};

type PasswordForm = {
    current_password: string;
    password: string;
    password_confirmation: string;
};

type ClinicSpecialityForm = {
    clinic_id: string;
    specialities: string[];
};

const emptyPasswordForm: PasswordForm = {
    current_password: '',
    password: '',
    password_confirmation: '',
};

export default function ProfilePage({ user, profilePictureOptions, canManageAvatar }: ProfilePageProps) {
    const page = usePage<PageProps>();
    const initialClinicSpecialities = user.clinic_specialities ?? [];
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [editingPatientProfile, setEditingPatientProfile] = useState(false);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);
    const [savingSpecialities, setSavingSpecialities] = useState(false);
    const [specialityDraft, setSpecialityDraft] = useState('');
    const [clinicSpecialityForm, setClinicSpecialityForm] = useState<ClinicSpecialityForm>({
        clinic_id: initialClinicSpecialities[0]?.clinic_id ? String(initialClinicSpecialities[0].clinic_id) : '',
        specialities: initialClinicSpecialities[0]?.specialities ?? [],
    });
    const [profileForm, setProfileForm] = useState<ProfileForm>(profileFormFromUser(user));
    const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
    const profileBasePath = user.role === 'patient' ? '/profil' : '/profile';

    const updateProfile = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSavingProfile(true);

        router.patch(profileBasePath, normalizedProfilePayload(profileForm), {
            preserveScroll: true,
            onSuccess: () => setEditingPatientProfile(false),
            onFinish: () => setSavingProfile(false),
        });
    };

    const updatePassword = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSavingPassword(true);

        router.patch(`${profileBasePath}/password`, passwordForm, {
            preserveScroll: true,
            onSuccess: () => setPasswordForm(emptyPasswordForm),
            onFinish: () => setSavingPassword(false),
        });
    };

    const selectProfilePicture = (profilePicture: string | null) => {
        router.patch(`${profileBasePath}/picture`, { profile_picture: profilePicture }, {
            preserveScroll: true,
            onSuccess: () => setAvatarModalOpen(false),
        });
    };

    const uploadImage = (file: File) => {
        const payload = new FormData();
        payload.append('image', file);
        setUploadingAvatar(true);

        router.post(`${profileBasePath}/image`, payload, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setAvatarModalOpen(false),
            onFinish: () => setUploadingAvatar(false),
        });
    };

    const deleteImage = () => {
        router.delete(`${profileBasePath}/image`, {
            preserveScroll: true,
            onSuccess: () => setAvatarModalOpen(false),
        });
    };

    const startPatientEdit = () => {
        setProfileForm(profileFormFromUser(user));
        setEditingPatientProfile(true);
    };

    const cancelPatientEdit = () => {
        setProfileForm(profileFormFromUser(user));
        setEditingPatientProfile(false);
        setAvatarModalOpen(false);
    };

    const selectClinicSpeciality = (clinicId: string) => {
        const selectedClinic = initialClinicSpecialities.find((clinic) => String(clinic.clinic_id) === clinicId);

        setClinicSpecialityForm({
            clinic_id: clinicId,
            specialities: selectedClinic?.specialities ?? [],
        });
        setSpecialityDraft('');
    };

    const addSpeciality = () => {
        const nextSpeciality = specialityDraft.trim();

        if (nextSpeciality === '') {
            return;
        }

        setClinicSpecialityForm((current) => {
            const alreadyExists = current.specialities.some((speciality) => speciality.toLowerCase() === nextSpeciality.toLowerCase());

            return alreadyExists
                ? current
                : { ...current, specialities: [...current.specialities, nextSpeciality] };
        });
        setSpecialityDraft('');
    };

    const removeSpeciality = (target: string) => {
        setClinicSpecialityForm((current) => ({
            ...current,
            specialities: current.specialities.filter((speciality) => speciality !== target),
        }));
    };

    const updateClinicSpecialities = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (user.role !== 'doctor' || clinicSpecialityForm.clinic_id === '') {
            return;
        }

        setSavingSpecialities(true);

        router.patch('/profile/clinic-specialities', {
            clinic_id: Number(clinicSpecialityForm.clinic_id),
            specialities: clinicSpecialityForm.specialities,
        }, {
            preserveScroll: true,
            onFinish: () => setSavingSpecialities(false),
        });
    };

    if (user.role === 'patient') {
        return (
            <PatientProfilePage
                user={user}
                page={page}
                profileForm={profileForm}
                passwordForm={passwordForm}
                editing={editingPatientProfile}
                savingProfile={savingProfile}
                savingPassword={savingPassword}
                avatarModalOpen={avatarModalOpen}
                uploadingAvatar={uploadingAvatar}
                profilePictureOptions={profilePictureOptions}
                canManageAvatar={canManageAvatar}
                setProfileForm={setProfileForm}
                setPasswordForm={setPasswordForm}
                startEdit={startPatientEdit}
                cancelEdit={cancelPatientEdit}
                updateProfile={updateProfile}
                updatePassword={updatePassword}
                openAvatarModal={() => setAvatarModalOpen(true)}
                closeAvatarModal={() => setAvatarModalOpen(false)}
                selectProfilePicture={selectProfilePicture}
                uploadImage={uploadImage}
                deleteImage={deleteImage}
            />
        );
    }

    return (
        <WorkspaceProfilePage
            user={user}
            page={page}
            profileForm={profileForm}
            passwordForm={passwordForm}
            initialClinicSpecialities={initialClinicSpecialities}
            clinicSpecialityForm={clinicSpecialityForm}
            specialityDraft={specialityDraft}
            profilePictureOptions={profilePictureOptions}
            canManageAvatar={canManageAvatar}
            savingProfile={savingProfile}
            savingPassword={savingPassword}
            uploadingAvatar={uploadingAvatar}
            savingSpecialities={savingSpecialities}
            setProfileForm={setProfileForm}
            setPasswordForm={setPasswordForm}
            setSpecialityDraft={setSpecialityDraft}
            selectProfilePicture={selectProfilePicture}
            uploadImage={uploadImage}
            deleteImage={deleteImage}
            updateProfile={updateProfile}
            updatePassword={updatePassword}
            selectClinicSpeciality={selectClinicSpeciality}
            addSpeciality={addSpeciality}
            removeSpeciality={removeSpeciality}
            updateClinicSpecialities={updateClinicSpecialities}
        />
    );
}

function PatientProfilePage({
    user,
    page,
    profileForm,
    passwordForm,
    editing,
    savingProfile,
    savingPassword,
    avatarModalOpen,
    uploadingAvatar,
    profilePictureOptions,
    canManageAvatar,
    setProfileForm,
    setPasswordForm,
    startEdit,
    cancelEdit,
    updateProfile,
    updatePassword,
    openAvatarModal,
    closeAvatarModal,
    selectProfilePicture,
    uploadImage,
    deleteImage,
}: {
    user: AuthUser;
    page: ReturnType<typeof usePage<PageProps>>;
    profileForm: ProfileForm;
    passwordForm: PasswordForm;
    editing: boolean;
    savingProfile: boolean;
    savingPassword: boolean;
    avatarModalOpen: boolean;
    uploadingAvatar: boolean;
    profilePictureOptions: string[];
    canManageAvatar: boolean;
    setProfileForm: Dispatch<SetStateAction<ProfileForm>>;
    setPasswordForm: Dispatch<SetStateAction<PasswordForm>>;
    startEdit: () => void;
    cancelEdit: () => void;
    updateProfile: (event: FormEvent<HTMLFormElement>) => void;
    updatePassword: (event: FormEvent<HTMLFormElement>) => void;
    openAvatarModal: () => void;
    closeAvatarModal: () => void;
    selectProfilePicture: (profilePicture: string | null) => void;
    uploadImage: (file: File) => void;
    deleteImage: () => void;
}) {
    return (
        <div className="min-h-screen bg-[#DED0B6] font-sans text-[#40311D]">
            <Head title="Profil Saya" />
            <PublicNavbar />

            <main className="mx-auto w-full max-w-[1400px] px-5 py-10 md:px-8 lg:py-14">
                <FlashAndErrors page={page} />

                <section className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative h-32 w-32 shrink-0 overflow-visible rounded-full">
                        <PatientAvatar name={user.name} avatarUrl={user.display_avatar_url ?? user.image_url ?? user.profile_picture_url} />
                        {editing && canManageAvatar ? (
                            <button
                                type="button"
                                onClick={openAvatarModal}
                                className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#DED0B6] bg-[#40311D] text-[#DED0B6] shadow-md transition hover:bg-[#00917B]"
                                aria-label="Edit avatar"
                            >
                                <EditIcon />
                            </button>
                        ) : null}
                    </div>

                    <div className="min-w-0">
                        <h1 className="text-4xl font-bold leading-tight tracking-[-0.03em] text-[#40311D] md:text-5xl">{user.name}</h1>
                        <p className="mt-1 text-xl font-medium text-[#40311D]/55">Pasien</p>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-[#40311D]/10 bg-[#40311D]/5">
                    <div className="flex flex-col gap-3 border-b border-[#40311D]/10 bg-[#40311D]/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[15px] font-bold text-[#40311D]">Informasi Pribadi</p>
                            <p className="mt-1 text-xs text-[#40311D]/45">Data identitas akun pasien.</p>
                        </div>

                        {editing ? (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="rounded-lg border border-[#40311D]/30 px-4 py-2 text-sm font-semibold text-[#40311D] transition hover:bg-[#40311D]/5"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    form="patient-profile-form"
                                    disabled={savingProfile}
                                    className="rounded-lg bg-[#40311D] px-4 py-2 text-sm font-semibold text-[#DED0B6] transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {savingProfile ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={startEdit}
                                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#40311D] transition hover:bg-[#40311D]/5"
                            >
                                <EditIcon />
                                Update
                            </button>
                        )}
                    </div>

                    <form id="patient-profile-form" onSubmit={updateProfile} className="grid gap-x-10 gap-y-1 p-5 md:grid-cols-2">
                        <div className="grid gap-y-1 md:border-r md:border-[#40311D]/10 md:pr-10">
                            <PatientField label="Name" value={user.name} editing={editing}>
                                <PatientInput value={profileForm.name} error={page.props.errors?.name} onChange={(value) => setProfileForm((current) => ({ ...current, name: value }))} />
                            </PatientField>
                            <PatientField label="Username" value={user.username} editing={editing}>
                                <PatientInput value={profileForm.username} error={page.props.errors?.username} onChange={(value) => setProfileForm((current) => ({ ...current, username: value }))} />
                            </PatientField>
                            <PatientField label="Gender" value={user.gender ?? '-'} editing={editing}>
                                <label className="grid gap-1">
                                    <select
                                        value={profileForm.gender}
                                        onChange={(event) => setProfileForm((current) => ({ ...current, gender: event.target.value }))}
                                        className="w-full rounded-lg border border-[#40311D]/20 bg-[#40311D]/5 px-3 py-2 text-sm font-medium text-[#40311D] outline-none transition focus:border-[#00917B]"
                                    >
                                        <option value="">Tidak diisi</option>
                                        <option value="Laki">Laki</option>
                                        <option value="Perempuan">Perempuan</option>
                                    </select>
                                    {page.props.errors?.gender ? <span className="text-xs font-medium text-red-600">{page.props.errors.gender}</span> : null}
                                </label>
                            </PatientField>
                        </div>

                        <div className="grid content-start gap-y-1 md:pl-2">
                            <PatientField label="DOB" value={dateLabel(user.date_of_birth)} editing={editing}>
                                <PatientInput type="date" value={profileForm.date_of_birth} error={page.props.errors?.date_of_birth} onChange={(value) => setProfileForm((current) => ({ ...current, date_of_birth: value }))} />
                            </PatientField>
                            <PatientField label="Email" value={user.email} editing={editing}>
                                <PatientInput type="email" value={profileForm.email} error={page.props.errors?.email} onChange={(value) => setProfileForm((current) => ({ ...current, email: value }))} />
                            </PatientField>
                            <PatientField label="Phone Number" value={user.phone_number ?? '-'} editing={editing}>
                                <PatientInput value={profileForm.phone_number} error={page.props.errors?.phone_number} onChange={(value) => setProfileForm((current) => ({ ...current, phone_number: value }))} />
                            </PatientField>
                        </div>
                    </form>
                </section>

                <section className="mt-5 overflow-hidden rounded-2xl border border-[#40311D]/10 bg-[#40311D]/5">
                    <div className="border-b border-[#40311D]/10 bg-[#40311D]/10 px-5 py-4">
                        <p className="text-[15px] font-bold text-[#40311D]">Ubah Password</p>
                        <p className="mt-1 text-xs text-[#40311D]/45">Gunakan password kuat untuk keamanan akun.</p>
                    </div>
                    <form onSubmit={updatePassword} className="grid gap-4 p-5 md:grid-cols-3">
                        <PatientPasswordInput label="Password Saat Ini" value={passwordForm.current_password} error={page.props.errors?.current_password} onChange={(value) => setPasswordForm((current) => ({ ...current, current_password: value }))} />
                        <PatientPasswordInput label="Password Baru" value={passwordForm.password} error={page.props.errors?.password} onChange={(value) => setPasswordForm((current) => ({ ...current, password: value }))} />
                        <PatientPasswordInput label="Konfirmasi Password" value={passwordForm.password_confirmation} error={page.props.errors?.password_confirmation} onChange={(value) => setPasswordForm((current) => ({ ...current, password_confirmation: value }))} />
                        <div className="flex justify-end md:col-span-3">
                            <button
                                type="submit"
                                disabled={savingPassword}
                                className="rounded-lg bg-[#40311D] px-4 py-2.5 text-sm font-semibold text-[#DED0B6] transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingPassword ? 'Menyimpan...' : 'Simpan Password'}
                            </button>
                        </div>
                    </form>
                </section>
            </main>

            <PublicFooter />

            {avatarModalOpen ? (
                <AvatarModal onClose={closeAvatarModal}>
                    <AvatarSelector
                        role="patient"
                        name={user.name}
                        imageUrl={user.image_url}
                        displayAvatarUrl={user.display_avatar_url}
                        selectedProfilePicture={user.profile_picture}
                        profilePictureOptions={profilePictureOptions}
                        canEdit={canManageAvatar}
                        uploading={uploadingAvatar}
                        onSelectProfilePicture={selectProfilePicture}
                        onUploadImage={uploadImage}
                        onDeleteImage={deleteImage}
                    />
                </AvatarModal>
            ) : null}
        </div>
    );
}

function WorkspaceProfilePage({
    user,
    page,
    profileForm,
    passwordForm,
    initialClinicSpecialities,
    clinicSpecialityForm,
    specialityDraft,
    profilePictureOptions,
    canManageAvatar,
    savingProfile,
    savingPassword,
    uploadingAvatar,
    savingSpecialities,
    setProfileForm,
    setPasswordForm,
    setSpecialityDraft,
    selectProfilePicture,
    uploadImage,
    deleteImage,
    updateProfile,
    updatePassword,
    selectClinicSpeciality,
    addSpeciality,
    removeSpeciality,
    updateClinicSpecialities,
}: {
    user: ProfilePageProps['user'];
    page: ReturnType<typeof usePage<PageProps>>;
    profileForm: ProfileForm;
    passwordForm: PasswordForm;
    initialClinicSpecialities: NonNullable<ProfilePageProps['user']['clinic_specialities']>;
    clinicSpecialityForm: ClinicSpecialityForm;
    specialityDraft: string;
    profilePictureOptions: string[];
    canManageAvatar: boolean;
    savingProfile: boolean;
    savingPassword: boolean;
    uploadingAvatar: boolean;
    savingSpecialities: boolean;
    setProfileForm: Dispatch<SetStateAction<ProfileForm>>;
    setPasswordForm: Dispatch<SetStateAction<PasswordForm>>;
    setSpecialityDraft: Dispatch<SetStateAction<string>>;
    selectProfilePicture: (profilePicture: string | null) => void;
    uploadImage: (file: File) => void;
    deleteImage: () => void;
    updateProfile: (event: FormEvent<HTMLFormElement>) => void;
    updatePassword: (event: FormEvent<HTMLFormElement>) => void;
    selectClinicSpeciality: (clinicId: string) => void;
    addSpeciality: () => void;
    removeSpeciality: (target: string) => void;
    updateClinicSpecialities: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <AppLayout>
            <Head title="Profil Saya" />

            <section className="h-full space-y-4 overflow-y-auto bg-[#DFE0DF] p-5">
                <FlashAndErrors page={page} />

                <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                    <Panel title="Profil Saya" subtitle="Data akun dan avatar aktif">
                        <div className="grid gap-4">
                            {canManageAvatar ? (
                                <AvatarSelector
                                    role={user.role === 'doctor' ? 'doctor' : 'patient'}
                                    name={user.name}
                                    imageUrl={user.image_url}
                                    displayAvatarUrl={user.display_avatar_url}
                                    selectedProfilePicture={user.profile_picture}
                                    profilePictureOptions={profilePictureOptions}
                                    canEdit
                                    uploading={uploadingAvatar}
                                    onSelectProfilePicture={selectProfilePicture}
                                    onUploadImage={uploadImage}
                                    onDeleteImage={deleteImage}
                                />
                            ) : (
                                <div className="grid gap-3">
                                    <div>
                                        <p className="text-[16px] font-semibold text-night-900">{user.name}</p>
                                        <p className="text-[12px] text-ink-700">{user.email}</p>
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-clinic-700">{user.role}</p>
                                    </div>
                                    <p className="rounded-xl border border-[#e4ddd4] bg-[#faf9f7] px-4 py-3 text-[12px] text-gray-500">
                                        Avatar hanya tersedia untuk pasien dan dokter.
                                    </p>
                                </div>
                            )}
                        </div>
                    </Panel>

                    <Panel title="Edit Data Profil" subtitle="Perbarui identitas dasar akun">
                        <form onSubmit={updateProfile} className="grid gap-3 md:grid-cols-2">
                            <TextField label="Nama" value={profileForm.name} error={page.props.errors?.name} onChange={(value) => setProfileForm((current) => ({ ...current, name: value }))} />
                            <TextField label="Username" value={profileForm.username} error={page.props.errors?.username} onChange={(value) => setProfileForm((current) => ({ ...current, username: value }))} />
                            <TextField label="Email" type="email" value={profileForm.email} error={page.props.errors?.email} onChange={(value) => setProfileForm((current) => ({ ...current, email: value }))} />
                            <TextField label="Nomor Telepon" value={profileForm.phone_number} error={page.props.errors?.phone_number} onChange={(value) => setProfileForm((current) => ({ ...current, phone_number: value }))} />
                            <TextField label="Tanggal Lahir" type="date" value={profileForm.date_of_birth} error={page.props.errors?.date_of_birth} onChange={(value) => setProfileForm((current) => ({ ...current, date_of_birth: value }))} />
                            <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
                                Gender
                                <select
                                    value={profileForm.gender}
                                    onChange={(event) => setProfileForm((current) => ({ ...current, gender: event.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2.5 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                >
                                    <option value="">Tidak diisi</option>
                                    <option value="Laki">Laki</option>
                                    <option value="Perempuan">Perempuan</option>
                                </select>
                                {page.props.errors?.gender ? <span className="text-[11px] font-medium text-red-600">{page.props.errors.gender}</span> : null}
                            </label>
                            <div className="flex justify-end md:col-span-2">
                                <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                                </button>
                            </div>
                        </form>
                    </Panel>
                </div>

                <Panel title="Ubah Password" subtitle="Gunakan password kuat untuk keamanan akun">
                    <form onSubmit={updatePassword} className="grid gap-3 md:grid-cols-3">
                        <TextField label="Password Saat Ini" type="password" value={passwordForm.current_password} error={page.props.errors?.current_password} onChange={(value) => setPasswordForm((current) => ({ ...current, current_password: value }))} />
                        <TextField label="Password Baru" type="password" value={passwordForm.password} error={page.props.errors?.password} onChange={(value) => setPasswordForm((current) => ({ ...current, password: value }))} />
                        <TextField label="Konfirmasi Password" type="password" value={passwordForm.password_confirmation} error={page.props.errors?.password_confirmation} onChange={(value) => setPasswordForm((current) => ({ ...current, password_confirmation: value }))} />
                        <div className="flex justify-end md:col-span-3">
                            <button
                                type="submit"
                                disabled={savingPassword}
                                className="rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingPassword ? 'Menyimpan...' : 'Simpan Password'}
                            </button>
                        </div>
                    </form>
                </Panel>

                {user.role === 'doctor' ? (
                    <Panel title="Spesialisasi Klinik" subtitle="Kelola spesialisasi dokter per klinik">
                        {initialClinicSpecialities.length === 0 ? (
                            <p className="text-[12px] italic text-gray-400">Belum ada klinik yang terhubung ke akun dokter ini.</p>
                        ) : (
                            <form onSubmit={updateClinicSpecialities} className="grid gap-4">
                                <ClinicSelector
                                    clinics={initialClinicSpecialities.map((clinic) => ({ id: clinic.clinic_id, name: clinic.clinic_name }))}
                                    value={clinicSpecialityForm.clinic_id}
                                    onChange={selectClinicSpeciality}
                                />

                                <div className="rounded-xl border border-[#e4ddd4] bg-[#faf9f7] p-4">
                                    <p className="mb-3 text-[12px] font-medium text-[#40311D]">Daftar spesialisasi</p>
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {clinicSpecialityForm.specialities.length === 0 ? (
                                            <span className="text-[12px] italic text-gray-400">Belum ada spesialisasi untuk klinik ini.</span>
                                        ) : (
                                            clinicSpecialityForm.specialities.map((speciality) => (
                                                <span key={speciality} className="inline-flex items-center gap-2 rounded-full bg-[#40311D] px-3 py-1 text-[12px] font-medium text-white">
                                                    {speciality}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSpeciality(speciality)}
                                                        className="text-white/70 transition hover:text-white"
                                                        aria-label={`Hapus ${speciality}`}
                                                    >
                                                        x
                                                    </button>
                                                </span>
                                            ))
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <input
                                            type="text"
                                            value={specialityDraft}
                                            onChange={(event) => setSpecialityDraft(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    addSpeciality();
                                                }
                                            }}
                                            placeholder="Contoh: Cardiology"
                                            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
                                        />
                                        <button
                                            type="button"
                                            onClick={addSpeciality}
                                            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF]"
                                        >
                                            Tambah
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={savingSpecialities}
                                        className="rounded-lg bg-[#40311D] px-4 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#2c2115] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {savingSpecialities ? 'Menyimpan...' : 'Simpan Spesialisasi'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </Panel>
                ) : null}
            </section>
        </AppLayout>
    );
}

function PatientAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
    if (avatarUrl) {
        return <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />;
    }

    return (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#DFE0DF] text-3xl font-bold text-[#40311D]">
            {initials(name)}
        </div>
    );
}

function PatientField({ label, value, editing, children }: { label: string; value: ReactNode; editing: boolean; children?: ReactNode }) {
    return (
        <div className="grid gap-2 border-b border-[#40311D]/10 py-3 sm:grid-cols-[150px_1fr] sm:items-center">
            <p className="text-sm font-medium text-[#40311D]/55">{label}</p>
            {editing && children ? children : <p className="min-w-0 break-words text-sm font-semibold text-[#40311D]">{value}</p>}
        </div>
    );
}

function PatientInput({ label, value, onChange, error, type = 'text' }: { label?: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) {
    return (
        <label className="grid gap-1">
            {label ? <span className="text-xs font-medium text-[#40311D]/55">{label}</span> : null}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-lg border border-[#40311D]/20 bg-[#40311D]/5 px-3 py-2 text-sm font-medium text-[#40311D] outline-none transition focus:border-[#00917B]"
            />
            {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
        </label>
    );
}

function PatientPasswordInput({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
    return (
        <PatientInput label={label} type="password" value={value} error={error} onChange={onChange} />
    );
}

function AvatarModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2c2115]/45 px-4 py-8">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#e4ddd4] bg-[#faf9f7] px-5 py-4">
                    <div>
                        <p className="text-[15px] font-bold text-[#40311D]">Edit Avatar</p>
                        <p className="mt-1 text-xs text-gray-400">Pilih avatar bawaan atau upload foto profil.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-[#40311D] transition hover:bg-[#DFE0DF]"
                        aria-label="Tutup modal avatar"
                    >
                        x
                    </button>
                </div>
                <div className="max-h-[72vh] overflow-y-auto p-5">{children}</div>
            </div>
        </div>
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

function TextField({ label, value, onChange, error, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-[#40311D]">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D]"
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
                <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[12px] font-medium text-teal-700">
                    {page.props.flash.status}
                </div>
            ) : null}
            {Object.keys(errors).length > 0 ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-6 text-red-700">
                    {Object.values(errors).flat().join(' ')}
                </div>
            ) : null}
        </>
    );
}

function EditIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
        </svg>
    );
}

function profileFormFromUser(user: AuthUser): ProfileForm {
    return {
        name: user.name,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number ?? '',
        date_of_birth: user.date_of_birth ?? '',
        gender: user.gender ?? '',
    };
}

function normalizedProfilePayload(profileForm: ProfileForm) {
    return {
        ...profileForm,
        phone_number: profileForm.phone_number || null,
        date_of_birth: profileForm.date_of_birth || null,
        gender: profileForm.gender || null,
    };
}

function dateLabel(value?: string | null): string {
    if (!value) {
        return '-';
    }

    const [year, month, day] = value.slice(0, 10).split('-').map(Number);

    if (!year || !month || !day) {
        return value;
    }

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(year, month - 1, day));
}

function initials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('') || 'US';
}
