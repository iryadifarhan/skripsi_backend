<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
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
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'status' => ['nullable', 'string', Rule::in(Reservation::STATUSES)],
        ]);

        $query = Reservation::with([
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active']);

        if ($request->user()->role === User::ROLE_PATIENT) {
            $query->where('patient_id', $request->user()->id);
        } 
        
        $query->orderByDesc('reservation_date')->orderByDesc('window_start_time');

        if (!empty($payload['status'])) {
            $query->where('status', $payload['status']);
        }

        return response()->json([
            'message' => 'Reservation retrieval successful.',
            'reservations' => $query->get(),
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
        ]);

        $schedule = $this->resolveScheduleForDate(
            (int) $payload['doctor_clinic_schedule_id'],
            $payload['reservation_date'],
        );

        $windows = $this->buildWindowsWithAvailability($schedule, $payload['reservation_date']);

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
        $patient = $request->user();

        $payload = $request->validate([
            'doctor_clinic_schedule_id' => ['required', 'integer', 'exists:doctor_clinic_schedules,id'],
            'reservation_date' => ['required', 'date', 'after_or_equal:today'],
            'window_start_time' => ['required', 'date_format:H:i'],
            'complaint' => ['nullable', 'string', 'max:1000'],
        ]);

        $schedule = $this->resolveScheduleForDate(
            (int) $payload['doctor_clinic_schedule_id'],
            $payload['reservation_date'],
        );

        $selectedWindow = $this->scheduler->findWindowByStart($schedule, $payload['window_start_time']);

        if ($selectedWindow === null) {
            throw ValidationException::withMessages([
                'window_start_time' => ['Selected window is not available in this practice schedule.'],
            ]);
        }

        $reservation = DB::transaction(function () use ($patient, $schedule, $payload, $selectedWindow): Reservation {
            $windowStartPrefix = substr($this->normalizeTimeString($selectedWindow['window_start_time']), 0, 5);

            $hasActiveReservationOnDate = Reservation::query()
                ->where('patient_id', $patient->id)
                ->where('clinic_id', $schedule->clinic_id)
                ->where('reservation_date', $payload['reservation_date'])
                ->whereIn('status', Reservation::ACTIVE_STATUSES)
                ->lockForUpdate()
                ->exists();

            if ($hasActiveReservationOnDate) {
                throw ValidationException::withMessages([
                    'reservation_date' => ['You already have an active reservation at this clinic on the selected date.'],
                ]);
            }

            $activeScheduleReservations = Reservation::query()
                ->where('doctor_clinic_schedule_id', $schedule->id)
                ->whereIn('status', Reservation::ACTIVE_STATUSES)
                ->lockForUpdate()
                ->get(['reservation_date', 'window_start_time', 'window_slot_number']);

            $usedSlots = $activeScheduleReservations
                ->filter(
                    fn (Reservation $reservation): bool =>
                        $this->normalizeDateValue($reservation->reservation_date) === $payload['reservation_date']
                        && substr($this->normalizeTimeString((string) $reservation->window_start_time), 0, 5) === $windowStartPrefix
                )
                ->pluck('window_slot_number')
                ->filter(fn ($slot): bool => $slot !== null && $slot !== '')
                ->map(fn ($slot): int => (int) $slot)
                ->filter(fn (int $slot): bool => $slot > 0)
                ->values()
                ->all();

            $assignedSlot = null;

            for ($slot = 1; $slot <= $schedule->max_patients_per_window; $slot++) {
                if (!in_array($slot, $usedSlots, true)) {
                    $assignedSlot = $slot;
                    break;
                }
            }

            if ($assignedSlot === null) {
                throw ValidationException::withMessages([
                    'window_start_time' => ['Selected window is full. Please choose another window.'],
                ]);
            }

            return Reservation::create([
                'reservation_number' => $this->generateReservationNumber(),
                'patient_id' => $patient->id,
                'clinic_id' => $schedule->clinic_id,
                'doctor_id' => $schedule->doctor_id,
                'doctor_clinic_schedule_id' => $schedule->id,
                'reservation_date' => $payload['reservation_date'],
                'reservation_time' => $this->normalizeTimeString($selectedWindow['window_start_time']),
                'window_start_time' => $this->normalizeTimeString($selectedWindow['window_start_time']),
                'window_end_time' => $this->normalizeTimeString($selectedWindow['window_end_time']),
                'window_slot_number' => $assignedSlot,
                'status' => Reservation::STATUS_PENDING,
                'complaint' => $payload['complaint'] ?? null,
            ]);
        });

        return response()->json([
            'message' => 'Reservation creation successful.',
            'reservation' => $reservation->load([
                'clinic:id,name,address,phone_number,email',
                'doctor:id,name,username,email,phone_number',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ]),
        ], 201);
    }

    public function cancel(Request $request, Reservation $reservation): JsonResponse
    {
        $user = $request->user();
        $isAdmin = in_array($request->user()->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN]);

        if ((int) $reservation->patient_id !== (int) $user->id && !$isAdmin) {
            return response()->json([
                'message' => 'Forbidden, you are not authorized.',
            ], 403);
        }

        if (!in_array($reservation->status, Reservation::ACTIVE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['This reservation can no longer be cancelled.'],
            ]);
        }

        $payload = $request->validate([
            'cancellation_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $reservation->update([
            'status' => Reservation::STATUS_CANCELLED,
            'cancellation_reason' => $payload['cancellation_reason'] ?? null,
            'cancelled_at' => now(),
        ]);

        return response()->json([
            'message' => 'Reservation cancellation successful.',
            'reservation' => $reservation->fresh()->load([
                'clinic:id,name,address,phone_number,email',
                'doctor:id,name,username,email,phone_number',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ]),
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
    private function buildWindowsWithAvailability(DoctorClinicSchedule $schedule, string $reservationDate): array
    {
        $windows = $this->scheduler->generateWindows($schedule);

        $activeReservations = Reservation::query()
            ->where('doctor_clinic_schedule_id', $schedule->id)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
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
