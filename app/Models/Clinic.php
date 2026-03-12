<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Clinic extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'address',
        'phone_number',
        'email',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function doctors(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->where('users.role', User::ROLE_DOCTOR)
            ->withTimestamps();
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function operatingHours(): HasMany
    {
        return $this->hasMany(ClinicOperatingHour::class)->orderBy('day_of_week');
    }

    public function doctorClinicSchedules(): HasMany
    {
        return $this->hasMany(DoctorClinicSchedule::class);
    }
}
