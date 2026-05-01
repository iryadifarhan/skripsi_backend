<?php

namespace App\Models;

use App\Services\MediaImageService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Clinic extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'address',
        'phone_number',
        'email',
        'image_path',
    ];

    /**
     * @var list<string>
     */
    protected $appends = [
        'image_url',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function doctors(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->using(ClinicUser::class)
            ->where('users.role', User::ROLE_DOCTOR)
            ->withPivot('speciality')
            ->withTimestamps();
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function medicalRecords(): HasMany
    {
        return $this->hasMany(MedicalRecord::class);
    }

    public function operatingHours(): HasMany
    {
        return $this->hasMany(ClinicOperatingHour::class)->orderBy('day_of_week');
    }

    public function doctorClinicSchedules(): HasMany
    {
        return $this->hasMany(DoctorClinicSchedule::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        $path = $this->attributes['image_path'] ?? null;

        if (!MediaImageService::hasValidPath($path)) {
            return null;
        }

        return Storage::disk($this->mediaDisk())->url($path);
    }

    private function mediaDisk(): string
    {
        return (string) config('filesystems.media_disk', 'public');
    }
}
