<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class ClinicUser extends Pivot
{
    protected $table = 'clinic_user';

    protected $casts = [
        'speciality' => 'array',
    ];
}
