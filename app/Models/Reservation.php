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

    public const QUEUE_STATUS_WAITING = 'waiting';
    public const QUEUE_STATUS_CALLED = 'called';
    public const QUEUE_STATUS_IN_PROGRESS = 'in_progress';
    public const QUEUE_STATUS_SKIPPED = 'skipped';
    public const QUEUE_STATUS_COMPLETED = 'completed';
    public const QUEUE_STATUS_CANCELLED = 'cancelled';

    public const QUEUE_ORDER_SOURCE_DERIVED = 'derived';
    public const QUEUE_ORDER_SOURCE_MANUAL = 'manual';

    public const QUEUE_STATUSES = [
        self::QUEUE_STATUS_WAITING,
        self::QUEUE_STATUS_CALLED,
        self::QUEUE_STATUS_IN_PROGRESS,
        self::QUEUE_STATUS_SKIPPED,
        self::QUEUE_STATUS_COMPLETED,
        self::QUEUE_STATUS_CANCELLED,
    ];

    public const ACTIVE_QUEUE_STATUSES = [
        self::QUEUE_STATUS_WAITING,
        self::QUEUE_STATUS_CALLED,
        self::QUEUE_STATUS_IN_PROGRESS,
        self::QUEUE_STATUS_SKIPPED,
    ];

    protected $fillable = [
        'reservation_number',
        'queue_number',
        'queue_status',
        'queue_order_source',
        'queue_called_at',
        'queue_started_at',
        'queue_completed_at',
        'queue_skipped_at',
        'patient_id',
        'guest_name',
        'guest_phone_number',
        'clinic_id',
        'doctor_id',
        'doctor_clinic_schedule_id',
        'reservation_date',
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
            'queue_number' => 'integer',
            'reservation_date' => 'date',
            'window_start_time' => 'string',
            'window_end_time' => 'string',
            'window_slot_number' => 'integer',
            'queue_called_at' => 'datetime',
            'queue_started_at' => 'datetime',
            'queue_completed_at' => 'datetime',
            'queue_skipped_at' => 'datetime',
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
