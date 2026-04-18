<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

class AdminReservationController extends Controller
{
    private const ADMIN_MUTABLE_STATUSES = [
        Reservation::STATUS_PENDING,
        Reservation::STATUS_APPROVED,
        Reservation::STATUS_REJECTED,
        Reservation::STATUS_CANCELLED,
    ];

    public function __construct(
        private readonly ReservationQueueService $queueService,
        private readonly PatientNotificationService $patientNotificationService,
        private readonly TimeWindowScheduler $scheduler,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $clinicId = $request->input('clinic_id');

        $payload = $request->validate([
            'status' => ['nullable', 'string', Rule::in(Reservation::STATUSES)],
            'reservation_date' => ['nullable', 'date'],
        ]);

        $query = Reservation::with($this->reservationRelations())
            ->where('clinic_id', $clinicId)
            ->orderBy('reservation_date')
            ->orderBy('window_start_time');

        if (!empty($payload['status'])) {
            $query->where('status', $payload['status']);
        }

        if (!empty($payload['reservation_date'])) {
            $query->whereDate('reservation_date', $payload['reservation_date']);
        }

        return response()->json([
            'message' => 'Reservation retrieval successful.',
            'reservations' => $this->queueService->serializeReservations($query->get()),
        ]);
    }

    public function show(Request $request, Reservation $reservation): JsonResponse
    {
        $this->assertReservationBelongsToRequestedClinic($request, $reservation);

        return response()->json([
            'message' => 'Reservation retrieval successful.',
            'reservation' => $this->queueService->serializeReservation(
                $reservation->load($this->reservationRelations())
            ),
        ]);
    }

    public function update(Request $request, Reservation $reservation): JsonResponse
    {
        $this->assertReservationBelongsToRequestedClinic($request, $reservation);

        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'patient_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'guest_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'guest_phone_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'doctor_id' => ['sometimes', 'integer', 'exists:users,id'],
            'doctor_clinic_schedule_id' => ['sometimes', 'integer', 'exists:doctor_clinic_schedules,id'],
            'reservation_date' => ['sometimes', 'date', 'after_or_equal:today'],
            'window_start_time' => ['sometimes', 'date_format:H:i'],
            'complaint' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        if (count(array_diff(array_keys($payload), ['clinic_id'])) === 0) {
            throw ValidationException::withMessages([
                'message' => ['At least one field is required to update reservation details.'],
            ]);
        }

        $sendRescheduledNotification = false;

        $reservation = DB::transaction(function () use ($payload, $request, $reservation, &$sendRescheduledNotification): Reservation {
            $lockedReservation = Reservation::query()
                ->with('medicalRecord')
                ->lockForUpdate()
                ->findOrFail($reservation->id);

            $this->assertReservationBelongsToRequestedClinic($request, $lockedReservation);

            $clinicId = (int) $payload['clinic_id'];
            $originalScheduleId = (int) $lockedReservation->doctor_clinic_schedule_id;
            $originalReservationDate = $this->normalizeDateValue($lockedReservation->reservation_date);
            $originalWindowStartTime = $this->normalizeTimeString((string) $lockedReservation->window_start_time);

            $targetReservationDate = array_key_exists('reservation_date', $payload)
                ? $payload['reservation_date']
                : $originalReservationDate;

            $patientRequested = array_key_exists('patient_id', $payload);
            $guestRequested = array_key_exists('guest_name', $payload) || array_key_exists('guest_phone_number', $payload);
            $doctorRequested = array_key_exists('doctor_id', $payload);
            $scheduleRequested = array_key_exists('doctor_clinic_schedule_id', $payload);
            $reservationDateRequested = array_key_exists('reservation_date', $payload);
            $windowRequested = array_key_exists('window_start_time', $payload);

            if (
                $doctorRequested
                && (int) $payload['doctor_id'] !== (int) $lockedReservation->doctor_id
                && !$scheduleRequested
            ) {
                throw ValidationException::withMessages([
                    'doctor_clinic_schedule_id' => ['doctor_clinic_schedule_id is required when changing doctors.'],
                ]);
            }

            $targetSchedule = null;
            $selectedWindow = null;
            $scheduleMutationRequested = $scheduleRequested || $reservationDateRequested || $windowRequested || ($doctorRequested && (int) $payload['doctor_id'] !== (int) $lockedReservation->doctor_id);

            if ($scheduleMutationRequested) {
                $targetSchedule = $this->resolveScheduleForDate(
                    $scheduleRequested ? (int) $payload['doctor_clinic_schedule_id'] : $originalScheduleId,
                    $targetReservationDate,
                );

                if ((int) $targetSchedule->clinic_id !== $clinicId) {
                    throw ValidationException::withMessages([
                        'doctor_clinic_schedule_id' => ['Selected practice schedule does not belong to the selected clinic.'],
                    ]);
                }

                if ($doctorRequested) {
                    $this->assertDoctorIsAvailableAtClinic((int) $payload['doctor_id'], $clinicId);

                    if ((int) $targetSchedule->doctor_id !== (int) $payload['doctor_id']) {
                        throw ValidationException::withMessages([
                            'doctor_clinic_schedule_id' => ['Selected practice schedule does not match the selected doctor.'],
                        ]);
                    }
                }

                $selectedWindow = $this->scheduler->findWindowByStart(
                    $targetSchedule,
                    $windowRequested ? $payload['window_start_time'] : $originalWindowStartTime,
                );

                if ($selectedWindow === null) {
                    throw ValidationException::withMessages([
                        'window_start_time' => ['Selected window is not available in this practice schedule.'],
                    ]);
                }
            }

            $targetPatient = $this->resolveUpdatedPatient($lockedReservation, $payload);
            $targetGuestName = $targetPatient === null
                ? (array_key_exists('guest_name', $payload) ? $payload['guest_name'] : $lockedReservation->guest_name)
                : null;
            $targetGuestPhoneNumber = $targetPatient === null
                ? (array_key_exists('guest_phone_number', $payload) ? $payload['guest_phone_number'] : $lockedReservation->guest_phone_number)
                : null;

            if ($targetPatient === null && empty($targetGuestName)) {
                throw ValidationException::withMessages([
                    'guest_name' => ['guest_name is required when reservation has no linked patient account.'],
                ]);
            }

            if ($targetPatient !== null && in_array($lockedReservation->status, Reservation::ACTIVE_STATUSES, true)) {
                $this->assertPatientHasNoOtherActiveReservationOnDate(
                    $targetPatient->id,
                    $clinicId,
                    $targetReservationDate,
                    $lockedReservation->id,
                );
            }

            $isScheduleChanged = false;
            $isSameQueueLine = true;
            $isSameWindow = true;
            $newWindowStartTime = $originalWindowStartTime;
            $newWindowEndTime = $this->normalizeTimeString((string) $lockedReservation->window_end_time);
            $newWindowSlotNumber = (int) $lockedReservation->window_slot_number;

            if ($targetSchedule !== null && $selectedWindow !== null) {
                $newWindowStartTime = $this->normalizeTimeString($selectedWindow['window_start_time']);
                $newWindowEndTime = $this->normalizeTimeString($selectedWindow['window_end_time']);

                $isSameQueueLine = $originalScheduleId === (int) $targetSchedule->id
                    && $originalReservationDate === $targetReservationDate;
                $isSameWindow = $isSameQueueLine
                    && $originalWindowStartTime === $newWindowStartTime;
                $isScheduleChanged = !$isSameWindow || !$isSameQueueLine;

                if ($isScheduleChanged && !in_array($lockedReservation->status, Reservation::ACTIVE_STATUSES, true)) {
                    throw ValidationException::withMessages([
                        'reservation_date' => ['Only active reservations can have their schedule changed.'],
                    ]);
                }

                if ($isScheduleChanged) {
                    $newWindowSlotNumber = $this->resolveAvailableSlot(
                        $targetSchedule,
                        $targetReservationDate,
                        $selectedWindow,
                        $lockedReservation->id,
                    );
                }
            }

            $attributes = [];

            if ($patientRequested || $guestRequested) {
                $attributes['patient_id'] = $targetPatient?->id;
                $attributes['guest_name'] = $targetGuestName;
                $attributes['guest_phone_number'] = $targetGuestPhoneNumber;
            }

            if (array_key_exists('complaint', $payload)) {
                $attributes['complaint'] = $payload['complaint'];
            }

            if ($isScheduleChanged && $targetSchedule !== null) {
                $attributes = array_merge($attributes, [
                    'queue_number' => $isSameQueueLine
                        ? ($lockedReservation->queue_number ?? $this->queueService->nextQueueNumber((int) $targetSchedule->id, $targetReservationDate))
                        : $this->queueService->nextQueueNumber((int) $targetSchedule->id, $targetReservationDate),
                    'queue_status' => Reservation::QUEUE_STATUS_WAITING,
                    'queue_order_source' => $this->queueService->lineUsesManualOrdering((int) $targetSchedule->id, $targetReservationDate)
                        ? Reservation::QUEUE_ORDER_SOURCE_MANUAL
                        : Reservation::QUEUE_ORDER_SOURCE_DERIVED,
                    'queue_called_at' => null,
                    'queue_started_at' => null,
                    'queue_completed_at' => null,
                    'queue_skipped_at' => null,
                    'doctor_id' => $targetSchedule->doctor_id,
                    'doctor_clinic_schedule_id' => $targetSchedule->id,
                    'reservation_date' => $targetReservationDate,
                    'window_start_time' => $newWindowStartTime,
                    'window_end_time' => $newWindowEndTime,
                    'window_slot_number' => $newWindowSlotNumber,
                    'reschedule_reason' => null,
                ]);
            }

            if ($attributes !== []) {
                $lockedReservation->update($attributes);
            }

            if ($lockedReservation->medicalRecord !== null && ($patientRequested || $guestRequested)) {
                $lockedReservation->medicalRecord->update([
                    'patient_id' => $targetPatient?->id,
                    'guest_name' => $targetGuestName,
                    'guest_phone_number' => $targetGuestPhoneNumber,
                ]);
            }

            if ($isScheduleChanged && $targetSchedule !== null) {
                if ($isSameQueueLine) {
                    $this->queueService->syncQueueLine((int) $targetSchedule->id, $targetReservationDate);
                } else {
                    $this->queueService->syncQueueLine($originalScheduleId, $originalReservationDate);
                    $this->queueService->syncQueueLine((int) $targetSchedule->id, $targetReservationDate);
                }

                if (!$isSameWindow) {
                    $this->queueService->syncWindowSlots($originalScheduleId, $originalReservationDate, $originalWindowStartTime);
                }

                $this->queueService->syncWindowSlots((int) $targetSchedule->id, $targetReservationDate, $newWindowStartTime);
                $sendRescheduledNotification = true;
            }

            return $lockedReservation->fresh();
        });

        if ($sendRescheduledNotification) {
            $this->patientNotificationService->sendReservationStatusNotification($reservation->loadMissing('patient'), 'rescheduled');
        }

        return response()->json([
            'message' => 'Reservation detail update successful.',
            'reservation' => $this->queueService->serializeReservation(
                $reservation->fresh()->load($this->reservationRelations())
            ),
        ]);
    }

    public function processReservation(Request $request, Reservation $reservation): JsonResponse
    {
        $this->assertReservationBelongsToRequestedClinic($request, $reservation);

        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'status' => ['sometimes', 'string', Rule::in(self::ADMIN_MUTABLE_STATUSES)],
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'cancellation_reason' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        if (count(array_diff(array_keys($payload), ['clinic_id'])) === 0) {
            throw ValidationException::withMessages([
                'message' => ['At least one field is required to process reservation.'],
            ]);
        }

        $reservationNotificationEvent = null;

        $reservation = DB::transaction(function () use ($payload, $request, $reservation, &$reservationNotificationEvent): Reservation {
            $lockedReservation = Reservation::query()
                ->lockForUpdate()
                ->findOrFail($reservation->id);

            $queueStatusToApply = null;

            if (isset($payload['status'])) {
                if (
                    in_array($lockedReservation->status, [Reservation::STATUS_CANCELLED, Reservation::STATUS_COMPLETED, Reservation::STATUS_REJECTED], true)
                    && $payload['status'] !== $lockedReservation->status
                ) {
                    throw ValidationException::withMessages([
                        'status' => ['Terminal reservation status cannot be changed.'],
                    ]);
                }

                if ($payload['status'] === Reservation::STATUS_CANCELLED && empty($payload['cancellation_reason'])) {
                    throw ValidationException::withMessages([
                        'cancellation_reason' => ['Cancellation reason is required when status is cancelled.'],
                    ]);
                }

                if ($payload['status'] !== Reservation::STATUS_CANCELLED && array_key_exists('cancellation_reason', $payload)) {
                    $payload['cancellation_reason'] = null;
                    $payload['cancelled_at'] = null;
                }

                if ($payload['status'] !== Reservation::STATUS_CANCELLED && $lockedReservation->status === Reservation::STATUS_CANCELLED) {
                    $payload['cancellation_reason'] = null;
                    $payload['cancelled_at'] = null;
                }

                if ($payload['status'] !== $lockedReservation->status) {
                    $payload['handled_by_admin_id'] = $request->user()->id;
                    $payload['handled_at'] = now();

                    if (in_array($payload['status'], [Reservation::STATUS_APPROVED, Reservation::STATUS_REJECTED, Reservation::STATUS_CANCELLED], true)) {
                        $reservationNotificationEvent = $payload['status'];
                    }
                }

                if ($payload['status'] === Reservation::STATUS_CANCELLED) {
                    $payload['cancelled_at'] = now();
                    $queueStatusToApply = Reservation::QUEUE_STATUS_CANCELLED;
                }

                if ($payload['status'] === Reservation::STATUS_REJECTED) {
                    $queueStatusToApply = Reservation::QUEUE_STATUS_CANCELLED;
                }
            }

            unset($payload['queue_status']);

            $lockedReservation->update($payload);

            if ($queueStatusToApply !== null) {
                $this->queueService->applyQueueStatus($lockedReservation, $queueStatusToApply);
            }

            return $lockedReservation->fresh();
        });

        if ($reservationNotificationEvent !== null) {
            $this->patientNotificationService->sendReservationStatusNotification($reservation->loadMissing('patient'), $reservationNotificationEvent);
        }

        return response()->json([
            'message' => 'Reservation processing successful.',
            'reservation' => $this->queueService->serializeReservation(
                $reservation->fresh()->load($this->reservationRelations())
            ),
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function reservationRelations(): array
    {
        return [
            'patient:id,name,username,email,phone_number,gender',
            'doctor:id,name,username,email,phone_number',
            'clinic:id,name,address,phone_number,email',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
        ];
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

    private function resolveUpdatedPatient(Reservation $reservation, array $payload): ?User
    {
        if (!array_key_exists('patient_id', $payload)) {
            return $reservation->patient_id !== null ? User::find((int) $reservation->patient_id) : null;
        }

        if ($payload['patient_id'] === null) {
            return null;
        }

        $patient = User::find((int) $payload['patient_id']);

        if (!$patient || $patient->role !== User::ROLE_PATIENT) {
            throw ValidationException::withMessages([
                'patient_id' => ['Selected patient is invalid.'],
            ]);
        }

        return $patient;
    }

    private function assertPatientHasNoOtherActiveReservationOnDate(
        int $patientId,
        int $clinicId,
        string $reservationDate,
        int $ignoreReservationId,
    ): void {
        $query = Reservation::query()
            ->where('patient_id', $patientId)
            ->where('clinic_id', $clinicId)
            ->whereDate('reservation_date', $reservationDate)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereKeyNot($ignoreReservationId)
            ->lockForUpdate();

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
        int $ignoreReservationId,
    ): int {
        $windowStartPrefix = substr($this->normalizeTimeString($selectedWindow['window_start_time']), 0, 5);

        $usedSlots = Reservation::query()
            ->where('doctor_clinic_schedule_id', $schedule->id)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereKeyNot($ignoreReservationId)
            ->lockForUpdate()
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

    private function assertReservationBelongsToRequestedClinic(Request $request, Reservation $reservation): void
    {
        if ((int) $reservation->clinic_id === (int) $request->input('clinic_id')) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to access this clinic reservation.');
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
