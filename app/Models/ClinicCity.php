<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClinicCity extends Model
{
    protected $fillable = [
        'name',
    ];

    public function clinics(): HasMany
    {
        return $this->hasMany(Clinic::class, 'city_id');
    }
}
