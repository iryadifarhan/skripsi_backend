<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reservation extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
        self::STATUS_CANCELLED,
        self::STATUS_COMPLETED,
    ];

    public const ACTIVE_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
    ];

    protected $fillable = [
        'reservation_number',
        'patient_id',
        'clinic_id',
        'doctor_id',
        'doctor_clinic_schedule_id',
        'reservation_date',
        'reservation_time',
        'window_start_time',
        'window_end_time',
        'window_slot_number',
        'status',
        'complaint',
        'admin_notes',
        'cancellation_reason',
        'cancelled_at',
        'handled_by_admin_id',
        'handled_at',
    ];

    protected function casts(): array
    {
        return [
            'reservation_date' => 'date',
            'reservation_time' => 'string',
            'window_start_time' => 'string',
            'window_end_time' => 'string',
            'window_slot_number' => 'integer',
            'cancelled_at' => 'datetime',
            'handled_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function doctorClinicSchedule(): BelongsTo
    {
        return $this->belongsTo(DoctorClinicSchedule::class);
    }

    public function handledByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by_admin_id');
    }
}
