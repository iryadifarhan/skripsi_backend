<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Services\PatientNotificationService;
use App\Services\ReservationQueueService;
use App\Services\TimeWindowScheduler;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReservationController extends Controller
{
    public function __construct(
        private readonly TimeWindowScheduler $scheduler,
        private readonly ReservationQueueService $queueService,
        private readonly PatientNotificationService $patientNotificationService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'status' => ['nullable', 'string', Rule::in(Reservation::STATUSES)],
        ]);

        $query = Reservation::with([
            'clinic:id,name,address,phone_number,email,image_path',
            'doctor:id,name,username,email,phone_number,image_path',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active']);

        if ($request->user()->role === User::ROLE_PATIENT) {
            $query->where('patient_id', $request->user()->id);
        } elseif ($request->user()->role === User::ROLE_ADMIN) {
            $query->where('clinic_id', $request->input('clinic_id'));
        }
        
        $query->orderByDesc('reservation_date')->orderByDesc('window_start_time');

        if (!empty($payload['status'])) {
            $query->where('status', $payload['status']);
        }

        return response()->json([
            'message' => 'Reservation retrieval successful.',
            'reservations' => $this->queueService->serializeReservations($query->get()),
        ]);
    }

    public function bookingSchedules(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'doctor_id' => ['required', 'integer', 'exists:users,id'],
            'reservation_date' => ['required', 'date', 'after_or_equal:today'],
        ]);

        $this->assertDoctorIsAvailableAtClinic((int) $payload['doctor_id'], (int) $payload['clinic_id']);

        $dayOfWeek = Carbon::parse($payload['reservation_date'])->dayOfWeek;

        $schedules = DoctorClinicSchedule::query()
            ->where('clinic_id', $payload['clinic_id'])
            ->where('doctor_id', $payload['doctor_id'])
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->orderBy('start_time')
            ->get([
                'id',
                'clinic_id',
                'doctor_id',
                'day_of_week',
                'start_time',
                'end_time',
                'window_minutes',
                'max_patients_per_window',
                'is_active',
            ]);

        return response()->json([
            'message' => 'Practice schedule retrieval successful.',
            'schedules' => $schedules,
        ]);
    }

    public function availableWindows(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'doctor_clinic_schedule_id' => ['required', 'integer', 'exists:doctor_clinic_schedules,id'],
            'reservation_date' => ['required', 'date', 'after_or_equal:today'],
            'ignore_reservation_id' => ['nullable', 'integer', 'exists:reservations,id'],
        ]);

        $schedule = $this->resolveScheduleForDate(
            (int) $payload['doctor_clinic_schedule_id'],
            $payload['reservation_date'],
        );
        $this->assertActorCanUseSchedule($request->user(), $schedule);

        $ignoreReservationId = null;

        if (!empty($payload['ignore_reservation_id'])) {
            $ignoreReservation = Reservation::findOrFail($payload['ignore_reservation_id']);
            $this->assertCanInspectReservationAvailability($request->user(), $ignoreReservation, $schedule);
            $ignoreReservationId = (int) $ignoreReservation->id;
        }

        $windows = $this->buildWindowsWithAvailability($schedule, $payload['reservation_date'], $ignoreReservationId);

        return response()->json([
            'message' => 'Available windows retrieval successful.',
            'schedule' => [
                'id' => $schedule->id,
                'clinic_id' => $schedule->clinic_id,
                'doctor_id' => $schedule->doctor_id,
                'day_of_week' => $schedule->day_of_week,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'window_minutes' => $schedule->window_minutes,
                'max_patients_per_window' => $schedule->max_patients_per_window,
            ],
            'windows' => $windows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();

        $payload = $request->validate([
            'doctor_clinic_schedule_id' => ['required', 'integer', 'exists:doctor_clinic_schedules,id'],
            'reservation_date' => ['required', 'date', 'after_or_equal:today'],
            'window_start_time' => ['required', 'date_format:H:i'],
            'patient_id' => ['nullable', 'integer', 'exists:users,id'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone_number' => ['nullable', 'string', 'max:30'],
            'complaint' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($actor->role === User::ROLE_PATIENT && !empty($payload['patient_id']) && (int) $payload['patient_id'] !== (int) $actor->id) {
            throw ValidationException::withMessages([
                'patient_id' => ['You cannot create a reservation for another patient.'],
            ]);
        }

        $schedule = $this->resolveScheduleForDate(
            (int) $payload['doctor_clinic_schedule_id'],
            $payload['reservation_date'],
        );
        $this->assertActorCanUseSchedule($actor, $schedule);
        $patient = $this->resolveReservationPatient($actor, $schedule, $payload);

        $selectedWindow = $this->scheduler->findWindowByStart($schedule, $payload['window_start_time']);

        if ($selectedWindow === null) {
            throw ValidationException::withMessages([
                'window_start_time' => ['Selected window is not available in this practice schedule.'],
            ]);
        }

        $reservation = DB::transaction(function () use ($patient, $schedule, $payload, $selectedWindow): Reservation {
            if ($patient !== null) {
                $this->assertPatientHasNoOtherActiveReservationOnDate(
                    $patient->id,
                    $schedule->clinic_id,
                    $payload['reservation_date'],
                );
            }

            $assignedSlot = $this->resolveAvailableSlot(
                $schedule,
                $payload['reservation_date'],
                $selectedWindow,
            );

            $reservation = Reservation::create([
                'reservation_number' => $this->generateReservationNumber(),
                'queue_number' => $this->queueService->nextQueueNumber($schedule->id, $payload['reservation_date']),
                'queue_status' => Reservation::QUEUE_STATUS_WAITING,
                'queue_order_source' => $this->queueService->lineUsesManualOrdering($schedule->id, $payload['reservation_date'])
                    ? Reservation::QUEUE_ORDER_SOURCE_MANUAL
                    : Reservation::QUEUE_ORDER_SOURCE_DERIVED,
                'patient_id' => $patient?->id,
                'guest_name' => $patient === null ? ($payload['guest_name'] ?? null) : null,
                'guest_phone_number' => $patient === null ? ($payload['guest_phone_number'] ?? null) : null,
                'clinic_id' => $schedule->clinic_id,
                'doctor_id' => $schedule->doctor_id,
                'doctor_clinic_schedule_id' => $schedule->id,
                'reservation_date' => $payload['reservation_date'],
                'window_start_time' => $this->normalizeTimeString($selectedWindow['window_start_time']),
                'window_end_time' => $this->normalizeTimeString($selectedWindow['window_end_time']),
                'window_slot_number' => $assignedSlot,
                'status' => Reservation::STATUS_PENDING,
                'complaint' => $payload['complaint'] ?? null,
            ]);

            $this->queueService->syncQueueLine($schedule->id, $payload['reservation_date']);

            return $reservation->fresh();
        });

        return response()->json([
            'message' => 'Reservation creation successful.',
            'reservation' => $this->queueService->serializeReservation($reservation->load([
                'clinic:id,name,address,phone_number,email,image_path',
                'doctor:id,name,username,email,phone_number,image_path',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ])),
        ], 201);
    }

    public function reschedule(Request $request, Reservation $reservation): JsonResponse
    {
        $actor = $request->user();
        $this->assertCanManageReservation($actor, $reservation);

        if (!in_array($reservation->status, Reservation::ACTIVE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['This reservation can no longer be rescheduled.'],
            ]);
        }

        $rules = [
            'doctor_clinic_schedule_id' => ['required', 'integer', 'exists:doctor_clinic_schedules,id'],
            'reservation_date' => ['required', 'date', 'after_or_equal:today'],
            'window_start_time' => ['required', 'date_format:H:i'],
            'guest_name' => ['nullable', 'string', 'max:255'],
            'guest_phone_number' => ['nullable', 'string', 'max:30'],
            'complaint' => ['nullable', 'string', 'max:1000'],
        ];

        if ($actor->role === User::ROLE_PATIENT) {
            $rules['reschedule_reason'] = ['required', 'string', 'max:1000'];
        }

        $payload = $request->validate($rules);

        $schedule = $this->resolveScheduleForDate(
            (int) $payload['doctor_clinic_schedule_id'],
            $payload['reservation_date'],
        );
        $this->assertActorCanUseSchedule($actor, $schedule);

        $selectedWindow = $this->scheduler->findWindowByStart($schedule, $payload['window_start_time']);

        if ($selectedWindow === null) {
            throw ValidationException::withMessages([
                'window_start_time' => ['Selected window is not available in this practice schedule.'],
            ]);
        }

        $reservation = DB::transaction(function () use ($reservation, $actor, $schedule, $payload, $selectedWindow): Reservation {
            $lockedReservation = Reservation::query()
                ->lockForUpdate()
                ->findOrFail($reservation->id);

            $this->assertCanManageReservation($actor, $lockedReservation);

            if (!in_array($lockedReservation->status, Reservation::ACTIVE_STATUSES, true)) {
                throw ValidationException::withMessages([
                    'status' => ['This reservation can no longer be rescheduled.'],
                ]);
            }

            $assignedSlot = $this->resolveAvailableSlot(
                $schedule,
                $payload['reservation_date'],
                $selectedWindow,
                $lockedReservation->id,
            );

            if ($lockedReservation->patient_id !== null) {
                $this->assertPatientHasNoOtherActiveReservationOnDate(
                    (int) $lockedReservation->patient_id,
                    $schedule->clinic_id,
                    $payload['reservation_date'],
                    $lockedReservation->id,
                );
            }

            $oldScheduleId = (int) $lockedReservation->doctor_clinic_schedule_id;
            $oldReservationDate = $this->normalizeDateValue($lockedReservation->reservation_date);
            $oldWindowStartTime = $this->normalizeTimeString((string) $lockedReservation->window_start_time);
            $newReservationDate = $payload['reservation_date'];
            $newWindowStartTime = $this->normalizeTimeString($selectedWindow['window_start_time']);
            $isSameQueueLine = $oldScheduleId === (int) $schedule->id
                && $oldReservationDate === $newReservationDate;
            $isSameWindow = $isSameQueueLine
                && $oldWindowStartTime === $newWindowStartTime;

            $lockedReservation->update([
                'queue_number' => $isSameQueueLine
                    ? ($lockedReservation->queue_number ?? $this->queueService->nextQueueNumber($schedule->id, $newReservationDate))
                    : $this->queueService->nextQueueNumber($schedule->id, $newReservationDate),
                'queue_status' => Reservation::QUEUE_STATUS_WAITING,
                'queue_order_source' => $this->queueService->lineUsesManualOrdering($schedule->id, $newReservationDate)
                    ? Reservation::QUEUE_ORDER_SOURCE_MANUAL
                    : Reservation::QUEUE_ORDER_SOURCE_DERIVED,
                'queue_called_at' => null,
                'queue_started_at' => null,
                'queue_completed_at' => null,
                'queue_skipped_at' => null,
                'clinic_id' => $schedule->clinic_id,
                'doctor_id' => $schedule->doctor_id,
                'doctor_clinic_schedule_id' => $schedule->id,
                'reservation_date' => $newReservationDate,
                'window_start_time' => $newWindowStartTime,
                'window_end_time' => $this->normalizeTimeString($selectedWindow['window_end_time']),
                'window_slot_number' => $assignedSlot,
                'guest_name' => $lockedReservation->patient_id === null
                    ? (array_key_exists('guest_name', $payload)
                        ? $payload['guest_name']
                        : $lockedReservation->guest_name)
                    : null,
                'guest_phone_number' => $lockedReservation->patient_id === null
                    ? (array_key_exists('guest_phone_number', $payload)
                        ? $payload['guest_phone_number']
                        : $lockedReservation->guest_phone_number)
                    : null,
                'status' => Reservation::STATUS_PENDING,
                'complaint' => array_key_exists('complaint', $payload)
                    ? $payload['complaint']
                    : $lockedReservation->complaint,
                'reschedule_reason' => $actor->role === User::ROLE_PATIENT
                    ? $payload['reschedule_reason']
                    : null,
                'admin_notes' => null,
                'handled_by_admin_id' => null,
                'handled_at' => null,
                'cancellation_reason' => null,
                'cancelled_at' => null,
            ]);

            if ($isSameQueueLine) {
                $this->queueService->syncQueueLine($schedule->id, $newReservationDate);
            } else {
                $this->queueService->syncQueueLine($oldScheduleId, $oldReservationDate);
                $this->queueService->syncQueueLine($schedule->id, $newReservationDate);
            }

            if (!$isSameWindow) {
                $this->queueService->syncWindowSlots($oldScheduleId, $oldReservationDate, $oldWindowStartTime);
            }

            $this->queueService->syncWindowSlots((int) $schedule->id, $newReservationDate, $newWindowStartTime);

            return $lockedReservation->fresh();
        });

        $this->patientNotificationService->sendReservationStatusNotification($reservation->loadMissing('patient'), 'rescheduled');

        return response()->json([
            'message' => 'Reservation reschedule successful.',
            'reservation' => $this->queueService->serializeReservation($reservation->fresh()->load([
                'clinic:id,name,address,phone_number,email,image_path',
                'doctor:id,name,username,email,phone_number,image_path',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ])),
        ]);
    }

    public function cancel(Request $request, Reservation $reservation): JsonResponse
    {
        $user = $request->user();
        $this->assertCanManageReservation($user, $reservation);

        if (!in_array($reservation->status, Reservation::ACTIVE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['This reservation can no longer be cancelled.'],
            ]);
        }

        $payload = $request->validate([
            'cancellation_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $reservation = DB::transaction(function () use ($reservation, $payload): Reservation {
            $lockedReservation = Reservation::query()
                ->lockForUpdate()
                ->findOrFail($reservation->id);

            $lockedReservation->update([
                'status' => Reservation::STATUS_CANCELLED,
                'cancellation_reason' => $payload['cancellation_reason'] ?? null,
                'cancelled_at' => now(),
            ]);

            $this->queueService->applyQueueStatus($lockedReservation, Reservation::QUEUE_STATUS_CANCELLED);

            return $lockedReservation->fresh();
        });

        return response()->json([
            'message' => 'Reservation cancellation successful.',
            'reservation' => $this->queueService->serializeReservation($reservation->fresh()->load([
                'clinic:id,name,address,phone_number,email,image_path',
                'doctor:id,name,username,email,phone_number,image_path',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ])),
        ]);
    }

    private function assertDoctorIsAvailableAtClinic(int $doctorId, int $clinicId): void
    {
        $doctor = User::find($doctorId);

        if (!$doctor || $doctor->role !== User::ROLE_DOCTOR) {
            throw ValidationException::withMessages([
                'doctor_id' => ['Selected doctor is invalid.'],
            ]);
        }

        if (!$doctor->clinics()->whereKey($clinicId)->exists()) {
            throw ValidationException::withMessages([
                'doctor_id' => ['Selected doctor is not assigned to the selected clinic.'],
            ]);
        }
    }

    private function generateReservationNumber(): string
    {
        do {
            $candidate = 'RSV-'.now()->format('Ymd').'-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
        } while (Reservation::where('reservation_number', $candidate)->exists());

        return $candidate;
    }

    private function resolveScheduleForDate(int $scheduleId, string $reservationDate): DoctorClinicSchedule
    {
        $schedule = DoctorClinicSchedule::find($scheduleId);

        if (!$schedule || !$schedule->is_active) {
            throw ValidationException::withMessages([
                'doctor_clinic_schedule_id' => ['Selected practice schedule is invalid or inactive.'],
            ]);
        }

        $dayOfWeek = Carbon::parse($reservationDate)->dayOfWeek;

        if ((int) $schedule->day_of_week !== (int) $dayOfWeek) {
            throw ValidationException::withMessages([
                'reservation_date' => ['Selected date does not match the doctor practice schedule day.'],
            ]);
        }

        $this->assertDoctorIsAvailableAtClinic((int) $schedule->doctor_id, (int) $schedule->clinic_id);

        return $schedule;
    }

    /**
     * @return array<int, array{
     *     window_start_time: string,
     *     window_end_time: string,
     *     max_slots: int,
     *     booked_slots: int,
     *     available_slots: int,
     *     slot_numbers_available: array<int, int>,
     *     is_available: bool
     * }>
     */
    private function buildWindowsWithAvailability(
        DoctorClinicSchedule $schedule,
        string $reservationDate,
        ?int $ignoreReservationId = null,
    ): array
    {
        $windows = $this->scheduler->generateWindows($schedule);

        $activeReservations = Reservation::query()
            ->where('doctor_clinic_schedule_id', $schedule->id)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->when($ignoreReservationId !== null, fn ($query) => $query->whereKeyNot($ignoreReservationId))
            ->get(['reservation_date', 'window_start_time', 'window_slot_number']);

        return array_map(function (array $window) use ($activeReservations, $schedule, $reservationDate): array {
            $windowStart = $this->normalizeTimeString($window['window_start_time']);
            $windowStartPrefix = substr($windowStart, 0, 5);

            $usedSlots = $activeReservations
                ->filter(
                    fn (Reservation $reservation): bool =>
                        $this->normalizeDateValue($reservation->reservation_date) === $reservationDate
                        && substr($this->normalizeTimeString((string) $reservation->window_start_time), 0, 5) === $windowStartPrefix
                )
                ->pluck('window_slot_number')
                ->filter(fn ($slot): bool => $slot !== null && $slot !== '')
                ->map(fn ($slot): int => (int) $slot)
                ->filter(fn (int $slot): bool => $slot > 0)
                ->unique()
                ->sort()
                ->values()
                ->all();

            $availableSlotNumbers = [];

            for ($slot = 1; $slot <= $schedule->max_patients_per_window; $slot++) {
                if (!in_array($slot, $usedSlots, true)) {
                    $availableSlotNumbers[] = $slot;
                }
            }

            $bookedSlots = count($usedSlots);
            $availableSlots = count($availableSlotNumbers);

            return [
                'window_start_time' => $windowStart,
                'window_end_time' => $this->normalizeTimeString($window['window_end_time']),
                'max_slots' => (int) $schedule->max_patients_per_window,
                'booked_slots' => $bookedSlots,
                'available_slots' => $availableSlots,
                'slot_numbers_available' => $availableSlotNumbers,
                'is_available' => $availableSlots > 0,
            ];
        }, $windows);
    }

    private function assertPatientHasNoOtherActiveReservationOnDate(
        int $patientId,
        int $clinicId,
        string $reservationDate,
        ?int $ignoreReservationId = null,
    ): void {
        $query = Reservation::query()
            ->where('patient_id', $patientId)
            ->where('clinic_id', $clinicId)
            ->where('reservation_date', $reservationDate)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->lockForUpdate();

        if ($ignoreReservationId !== null) {
            $query->whereKeyNot($ignoreReservationId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'reservation_date' => ['You already have an active reservation at this clinic on the selected date.'],
            ]);
        }
    }

    /**
     * @param  array{window_start_time: string, window_end_time: string}  $selectedWindow
     */
    private function resolveAvailableSlot(
        DoctorClinicSchedule $schedule,
        string $reservationDate,
        array $selectedWindow,
        ?int $ignoreReservationId = null,
    ): int {
        $windowStartPrefix = substr($this->normalizeTimeString($selectedWindow['window_start_time']), 0, 5);

        $activeScheduleReservations = Reservation::query()
            ->where('doctor_clinic_schedule_id', $schedule->id)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->lockForUpdate();

        if ($ignoreReservationId !== null) {
            $activeScheduleReservations->whereKeyNot($ignoreReservationId);
        }

        $usedSlots = $activeScheduleReservations
            ->get(['reservation_date', 'window_start_time', 'window_slot_number'])
            ->filter(
                fn (Reservation $reservation): bool =>
                    $this->normalizeDateValue($reservation->reservation_date) === $reservationDate
                    && substr($this->normalizeTimeString((string) $reservation->window_start_time), 0, 5) === $windowStartPrefix
            )
            ->pluck('window_slot_number')
            ->filter(fn ($slot): bool => $slot !== null && $slot !== '')
            ->map(fn ($slot): int => (int) $slot)
            ->filter(fn (int $slot): bool => $slot > 0)
            ->values()
            ->all();

        for ($slot = 1; $slot <= $schedule->max_patients_per_window; $slot++) {
            if (!in_array($slot, $usedSlots, true)) {
                return $slot;
            }
        }

        throw ValidationException::withMessages([
            'window_start_time' => ['Selected window is full. Please choose another window.'],
        ]);
    }

    private function resolveReservationPatient(User $actor, DoctorClinicSchedule $schedule, array $payload): ?User
    {
        if ($actor->role === User::ROLE_PATIENT) {
            return $actor;
        }

        if ($actor->role === User::ROLE_ADMIN && (int) $actor->clinic_id !== (int) $schedule->clinic_id) {
            abort(403, 'Forbidden, you are not authorized to access this clinic reservation.');
        }

        if (empty($payload['patient_id'])) {
            if (empty($payload['guest_name'])) {
                throw ValidationException::withMessages([
                    'guest_name' => ['guest_name is required when creating a walk-in reservation.'],
                ]);
            }

            return null;
        }

        $patient = User::find($payload['patient_id']);

        if (!$patient || $patient->role !== User::ROLE_PATIENT) {
            throw ValidationException::withMessages([
                'patient_id' => ['Selected patient is invalid.'],
            ]);
        }

        return $patient;
    }

    private function assertCanManageReservation(User $actor, Reservation $reservation): void
    {
        if ($actor->role === User::ROLE_SUPERADMIN) {
            return;
        }

        if ($actor->role === User::ROLE_ADMIN) {
            if ((int) $actor->clinic_id === (int) $reservation->clinic_id) {
                return;
            }

            abort(403, 'Forbidden, you are not authorized to access this clinic reservation.');
        }

        if ((int) $reservation->patient_id === (int) $actor->id) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized.');
    }

    private function assertCanInspectReservationAvailability(
        User $actor,
        Reservation $reservation,
        DoctorClinicSchedule $schedule,
    ): void {
        if ((int) $reservation->clinic_id !== (int) $schedule->clinic_id) {
            throw ValidationException::withMessages([
                'ignore_reservation_id' => ['Selected reservation does not belong to the selected clinic schedule.'],
            ]);
        }

        if ($actor->role === User::ROLE_SUPERADMIN) {
            return;
        }

        if ($actor->role === User::ROLE_ADMIN && (int) $actor->clinic_id === (int) $reservation->clinic_id) {
            return;
        }

        if ($actor->role === User::ROLE_DOCTOR && (int) $actor->id === (int) $reservation->doctor_id) {
            return;
        }

        if ($actor->role === User::ROLE_PATIENT && (int) $actor->id === (int) $reservation->patient_id) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized.');
    }

    private function assertActorCanUseSchedule(User $actor, DoctorClinicSchedule $schedule): void
    {
        if ($actor->role === User::ROLE_SUPERADMIN) {
            return;
        }

        if ($actor->role === User::ROLE_ADMIN && (int) $actor->clinic_id !== (int) $schedule->clinic_id) {
            abort(403, 'Forbidden, you are not authorized to access this clinic reservation.');
        }
    }

    private function normalizeTimeString(string $value): string
    {
        if (strlen($value) === 5) {
            return $value.':00';
        }

        return substr($value, 0, 8);
    }

    private function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return $value->toDateString();
        }

        return substr((string) $value, 0, 10);
    }
}
