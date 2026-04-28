import { Head, router, usePage } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { AvatarSelector } from '@/components/avatar-selector';
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

export default function ProfilePage({ user, profilePictureOptions, canManageAvatar }: ProfilePageProps) {
    const page = usePage<PageProps>();
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [profileForm, setProfileForm] = useState<ProfileForm>({
        name: user.name,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number ?? '',
        date_of_birth: user.date_of_birth ?? '',
        gender: user.gender ?? '',
    });
    const [passwordForm, setPasswordForm] = useState<PasswordForm>({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updateProfile = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSavingProfile(true);

        router.patch('/profile', {
            ...profileForm,
            phone_number: profileForm.phone_number || null,
            date_of_birth: profileForm.date_of_birth || null,
            gender: profileForm.gender || null,
        }, {
            preserveScroll: true,
            onFinish: () => setSavingProfile(false),
        });
    };

    const updatePassword = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSavingPassword(true);

        router.patch('/profile/password', passwordForm, {
            preserveScroll: true,
            onSuccess: () => setPasswordForm({ current_password: '', password: '', password_confirmation: '' }),
            onFinish: () => setSavingPassword(false),
        });
    };

    const selectProfilePicture = (profilePicture: string | null) => {
        router.patch('/profile/picture', { profile_picture: profilePicture }, { preserveScroll: true });
    };

    const uploadImage = (file: File) => {
        const payload = new FormData();
        payload.append('image', file);
        setUploadingAvatar(true);

        router.post('/profile/image', payload, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => setUploadingAvatar(false),
        });
    };

    const deleteImage = () => {
        router.delete('/profile/image', { preserveScroll: true });
    };

    return (
        <AppLayout>
            <Head title="Profil Saya" />

            <section className="grid gap-4">
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
