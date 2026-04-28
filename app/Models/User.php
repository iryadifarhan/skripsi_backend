<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    public const ROLE_PATIENT = 'patient';
    public const ROLE_DOCTOR = 'doctor';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_SUPERADMIN = 'superadmin';
    public const GENDER_LAKI = 'Laki';
    public const GENDER_PEREMPUAN = 'Perempuan';

    public const ROLES = [
        self::ROLE_PATIENT,
        self::ROLE_DOCTOR,
        self::ROLE_ADMIN,
    ];

    public const CLINIC_SCOPED_ROLES = [
        self::ROLE_DOCTOR,
        self::ROLE_ADMIN
    ];

    public const GENDERS = [
        self::GENDER_LAKI,
        self::GENDER_PEREMPUAN,
    ];

    public const PROFILE_PICTURES = [
        self::ROLE_PATIENT => ['patient_1', 'patient_2', 'patient_3'],
        self::ROLE_DOCTOR => ['doctor_1', 'doctor_2', 'doctor_3'],
    ];

    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'phone_number',
        'date_of_birth',
        'gender',
        'role',
        'profile_picture',
        'image_path',
        'password',
        'clinic_id',
    ];

    /**
     * @var list<string>
     */
    protected $appends = [
        'image_url',
        'profile_picture_url',
        'display_avatar_url',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'pivot',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'date_of_birth' => 'date:Y-m-d',
            'password' => 'hashed',
        ];
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function clinics(): BelongsToMany
    {
        return $this->belongsToMany(Clinic::class)
            ->using(ClinicUser::class)
            ->withPivot('speciality')
            ->withTimestamps();
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class, 'patient_id');
    }

    public function assignedReservations(): HasMany
    {
        return $this->hasMany(Reservation::class, 'doctor_id');
    }

    public function handledReservations(): HasMany
    {
        return $this->hasMany(Reservation::class, 'handled_by_admin_id');
    }

    public function patientMedicalRecords(): HasMany
    {
        return $this->hasMany(MedicalRecord::class, 'patient_id');
    }

    public function issuedMedicalRecords(): HasMany
    {
        return $this->hasMany(MedicalRecord::class, 'doctor_id');
    }

    public function doctorClinicSchedules(): HasMany
    {
        return $this->hasMany(DoctorClinicSchedule::class, 'doctor_id');
    }

    protected function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /**
     * @return list<string>
     */
    public static function profilePicturesForRole(string $role): array
    {
        return self::PROFILE_PICTURES[$role] ?? [];
    }

    public static function defaultProfilePictureForRole(string $role): ?string
    {
        return null;
    }

    public static function supportsProfilePicture(string $role): bool
    {
        return in_array($role, [self::ROLE_PATIENT, self::ROLE_DOCTOR], true);
    }

    public static function isValidProfilePictureForRole(string $role, string $profilePicture): bool
    {
        return in_array($profilePicture, self::profilePicturesForRole($role), true);
    }

    public function getProfilePictureUrlAttribute(): ?string
    {
        $profilePicture = $this->attributes['profile_picture'] ?? null;
        $role = $this->attributes['role'] ?? null;

        if (!is_string($role) || !is_string($profilePicture) || !self::isValidProfilePictureForRole($role, $profilePicture)) {
            return null;
        }

        return asset('avatars/'.$profilePicture.'.svg');
    }

    public function getDisplayAvatarUrlAttribute(): ?string
    {
        return $this->profile_picture_url ?? $this->image_url;
    }

    public function getImageUrlAttribute(): ?string
    {
        $path = $this->attributes['image_path'] ?? null;

        if (!filled($path)) {
            return null;
        }

        return Storage::disk($this->mediaDisk())->url($path);
    }

    private function mediaDisk(): string
    {
        return (string) config('filesystems.media_disk', 'public');
    }
}
