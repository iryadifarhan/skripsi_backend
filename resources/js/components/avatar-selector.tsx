import { type ChangeEvent, type ReactNode } from 'react';

type AvatarRole = 'patient' | 'doctor';

type AvatarSelectorProps = {
    role: AvatarRole;
    name: string;
    imageUrl?: string | null;
    displayAvatarUrl?: string | null;
    selectedProfilePicture?: string | null;
    profilePictureOptions: string[];
    canEdit: boolean;
    uploading?: boolean;
    onSelectProfilePicture: (profilePicture: string | null) => void;
    onUploadImage: (file: File) => void;
    onDeleteImage?: () => void;
};

const roleLabels: Record<AvatarRole, string> = {
    patient: 'Pasien',
    doctor: 'Dokter',
};

export function UserAvatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
    const sizeClass = {
        sm: 'h-10 w-10 rounded-lg text-[11px]',
        md: 'h-12 w-12 rounded-lg text-[11px]',
        lg: 'h-14 w-14 rounded-xl text-[12px]',
        xl: 'h-24 w-24 rounded-xl text-2xl',
    }[size];

    if (avatarUrl) {
        return <img src={avatarUrl} alt={name} className={`${sizeClass} shrink-0 object-cover`} />;
    }

    return (
        <div className={`flex ${sizeClass} shrink-0 items-center justify-center bg-[#40311D] font-bold uppercase text-white`}>
            {initials(name)}
        </div>
    );
}

export function AvatarSelector({
    role,
    name,
    imageUrl,
    displayAvatarUrl,
    selectedProfilePicture,
    profilePictureOptions,
    canEdit,
    uploading = false,
    onSelectProfilePicture,
    onUploadImage,
    onDeleteImage,
}: AvatarSelectorProps) {
    const roleLabel = roleLabels[role];
    const uploadActive = Boolean(imageUrl) && selectedProfilePicture === null;

    const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        onUploadImage(file);
    };

    return (
        <div className="grid gap-4">
            <div className="flex items-center gap-4">
                <UserAvatar name={name} avatarUrl={displayAvatarUrl ?? imageUrl} size="xl" />
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[#2c2115]">{name}</p>
                    <p className="text-[11px] text-gray-400">Pilih avatar {roleLabel.toLowerCase()} atau upload foto sendiri.</p>
                </div>
            </div>

            {canEdit ? (
                <div className="grid grid-cols-2 gap-3">
                    {profilePictureOptions.map((profilePicture, index) => {
                        const active = selectedProfilePicture === profilePicture;

                        return (
                            <AvatarCard
                                key={profilePicture}
                                active={active}
                                disabled={!canEdit || uploading}
                                title={`Avatar ${roleLabel} ${index + 1}`}
                                onClick={() => onSelectProfilePicture(profilePicture)}
                            >
                                <img src={profilePictureUrl(profilePicture)} alt={`Avatar ${roleLabel} ${index + 1}`} className="h-16 w-16 rounded-xl object-cover" />
                            </AvatarCard>
                        );
                    })}

                    <AvatarCard
                        active={uploadActive}
                        disabled={!canEdit || uploading || !imageUrl}
                        title={`Avatar Upload ${roleLabel}`}
                        onClick={imageUrl ? () => onSelectProfilePicture(null) : undefined}
                    >
                        {imageUrl ? (
                            <img src={imageUrl} alt={`Avatar Upload ${roleLabel}`} className="h-16 w-16 rounded-xl object-cover" />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-[10px] font-medium text-gray-400">
                                Upload
                            </div>
                        )}
                    </AvatarCard>
                </div>
            ) : null}

            {canEdit ? (
                <div className="grid gap-2">
                    <label className="flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-[12px] font-medium text-[#40311D] transition hover:bg-[#faf9f7]">
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} className="hidden" />
                        {uploading ? 'Mengunggah...' : `Upload Foto ${roleLabel}`}
                    </label>

                    {imageUrl && onDeleteImage ? (
                        <button
                            type="button"
                            onClick={onDeleteImage}
                            disabled={uploading}
                            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Hapus Foto Upload
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function AvatarCard({ active, disabled, title, onClick, children }: { active: boolean; disabled: boolean; title: string; onClick?: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            disabled={disabled || !onClick}
            onClick={onClick}
            className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center text-[11px] font-medium transition ${
                active
                    ? 'border-[#40311D] bg-[#40311D] text-white shadow-sm'
                    : 'border-[#e4ddd4] bg-[#faf9f7] text-[#40311D] hover:border-[#40311D] hover:bg-white'
            } ${disabled || !onClick ? 'cursor-default' : 'cursor-pointer'}`}
        >
            {children}
            <span>{title}</span>
        </button>
    );
}

function profilePictureUrl(profilePicture: string): string {
    return `/avatars/${profilePicture}.svg`;
}

function initials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('') || 'US';
}
