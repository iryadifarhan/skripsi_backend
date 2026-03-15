<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ReservationQueueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QueueController extends Controller
{
    public function __construct(
        private readonly ReservationQueueService $queueService,
    ) {
    }

    public function patientIndex(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'reservation_date' => ['nullable', 'date'],
            'queue_status' => ['nullable', 'string', Rule::in(Reservation::QUEUE_STATUSES)],
            'include_history' => ['nullable', 'boolean'],
        ]);

        $query = Reservation::query()
            ->with($this->reservationRelations())
            ->where('patient_id', $request->user()->id)
            ->orderByDesc('reservation_date')
            ->orderBy('queue_number');

        if (!empty($payload['reservation_date'])) {
            $query->whereDate('reservation_date', $payload['reservation_date']);
        }

        if (!empty($payload['queue_status'])) {
            $query->where('queue_status', $payload['queue_status']);
        }

        $reservations = $query->get();

        if (empty($payload['include_history']) && empty($payload['queue_status'])) {
            $reservations = $reservations
                ->filter(fn (Reservation $reservation): bool => $this->queueService->isActiveQueueReservation($reservation))
                ->values();
        }

        return response()->json([
            'message' => 'Queue retrieval successful.',
            'queues' => $this->queueService->serializeQueueEntries($reservations),
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'reservation_date' => ['required', 'date'],
            'doctor_id' => ['nullable', 'integer', 'exists:users,id'],
            'doctor_clinic_schedule_id' => ['nullable', 'integer', 'exists:doctor_clinic_schedules,id'],
            'queue_status' => ['nullable', 'string', Rule::in(Reservation::QUEUE_STATUSES)],
            'include_history' => ['nullable', 'boolean'],
        ]);

        if (!empty($payload['doctor_clinic_schedule_id'])) {
            $schedule = DoctorClinicSchedule::find($payload['doctor_clinic_schedule_id']);

            if (!$schedule || (int) $schedule->clinic_id !== (int) $payload['clinic_id']) {
                throw ValidationException::withMessages([
                    'doctor_clinic_schedule_id' => ['Selected practice schedule does not belong to the selected clinic.'],
                ]);
            }
        }

        $query = Reservation::query()
            ->with($this->reservationRelations())
            ->where('clinic_id', $payload['clinic_id'])
            ->whereDate('reservation_date', $payload['reservation_date'])
            ->orderBy('queue_number')
            ->orderBy('window_start_time');

        if (!empty($payload['doctor_id'])) {
            $query->where('doctor_id', $payload['doctor_id']);
        }

        if (!empty($payload['doctor_clinic_schedule_id'])) {
            $query->where('doctor_clinic_schedule_id', $payload['doctor_clinic_schedule_id']);
        }

        if (!empty($payload['queue_status'])) {
            $query->where('queue_status', $payload['queue_status']);
        }

        $reservations = $query->get();

        if (empty($payload['include_history']) && empty($payload['queue_status'])) {
            $reservations = $reservations
                ->filter(fn (Reservation $reservation): bool => $this->queueService->isActiveQueueReservation($reservation))
                ->values();
        }

        return response()->json([
            'message' => 'Queue retrieval successful.',
            'queues' => $this->queueService->serializeQueueEntries($reservations, true),
        ]);
    }

    public function doctorIndex(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'reservation_date' => ['required', 'date'],
            'doctor_clinic_schedule_id' => ['nullable', 'integer', 'exists:doctor_clinic_schedules,id'],
            'queue_status' => ['nullable', 'string', Rule::in(Reservation::QUEUE_STATUSES)],
            'include_history' => ['nullable', 'boolean'],
        ]);

        $doctor = $request->user();

        if (!empty($payload['doctor_clinic_schedule_id'])) {
            $schedule = DoctorClinicSchedule::find($payload['doctor_clinic_schedule_id']);

            if (
                !$schedule
                || (int) $schedule->doctor_id !== (int) $doctor->id
                || (int) $schedule->clinic_id !== (int) $payload['clinic_id']
            ) {
                throw ValidationException::withMessages([
                    'doctor_clinic_schedule_id' => ['Selected practice schedule is not accessible by this doctor.'],
                ]);
            }
        }

        $query = Reservation::query()
            ->with($this->reservationRelations())
            ->where('doctor_id', $doctor->id)
            ->where('clinic_id', $payload['clinic_id'])
            ->whereDate('reservation_date', $payload['reservation_date'])
            ->orderBy('queue_number')
            ->orderBy('window_start_time');

        if (!empty($payload['doctor_clinic_schedule_id'])) {
            $query->where('doctor_clinic_schedule_id', $payload['doctor_clinic_schedule_id']);
        }

        if (!empty($payload['queue_status'])) {
            $query->where('queue_status', $payload['queue_status']);
        }

        $reservations = $query->get();

        if (empty($payload['include_history']) && empty($payload['queue_status'])) {
            $reservations = $reservations
                ->filter(fn (Reservation $reservation): bool => $this->queueService->isActiveQueueReservation($reservation))
                ->values();
        }

        return response()->json([
            'message' => 'Queue retrieval successful.',
            'queues' => $this->queueService->serializeQueueEntries($reservations, true),
        ]);
    }

    public function adminUpdate(Request $request, Reservation $reservation): JsonResponse
    {
        $this->assertReservationBelongsToRequestedClinic($request, $reservation);

        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'queue_number' => ['sometimes', 'integer', 'min:1'],
            'queue_status' => ['sometimes', 'string', Rule::in(Reservation::QUEUE_STATUSES)],
        ]);

        if (!isset($payload['queue_number']) && !isset($payload['queue_status'])) {
            throw ValidationException::withMessages([
                'message' => ['At least one queue field is required to update the queue.'],
            ]);
        }

        if ($reservation->doctor_clinic_schedule_id === null || $reservation->queue_number === null) {
            throw ValidationException::withMessages([
                'reservation' => ['Selected reservation does not have queue information yet.'],
            ]);
        }

        DB::transaction(function () use ($payload, $request, $reservation): void {
            $reservation->refresh();

            if (isset($payload['queue_number'])) {
                if (!in_array((string) $reservation->queue_status, Reservation::ACTIVE_QUEUE_STATUSES, true)) {
                    throw ValidationException::withMessages([
                        'queue_number' => ['Only active queue entries can be reordered.'],
                    ]);
                }

                $this->queueService->moveReservationToQueueNumber($reservation, (int) $payload['queue_number']);
                $reservation->refresh();
            }

            if (isset($payload['queue_status'])) {
                $this->applyQueueStateChange($request, $reservation, (string) $payload['queue_status']);
            }
        });

        $reservation = $reservation->fresh()->load($this->reservationRelations());

        return response()->json([
            'message' => 'Queue update successful.',
            'queue' => $this->queueService->serializeQueueEntry($reservation, true),
        ]);
    }

    private function applyQueueStateChange(Request $request, Reservation $reservation, string $queueStatus): void
    {
        if (
            in_array($reservation->status, [Reservation::STATUS_CANCELLED, Reservation::STATUS_COMPLETED], true)
            && !in_array($queueStatus, [Reservation::QUEUE_STATUS_CANCELLED, Reservation::QUEUE_STATUS_COMPLETED], true)
        ) {
            throw ValidationException::withMessages([
                'queue_status' => ['Terminal reservations cannot be moved back into the active queue.'],
            ]);
        }

        $attributes = [];

        if ($queueStatus === Reservation::QUEUE_STATUS_COMPLETED) {
            $attributes['status'] = Reservation::STATUS_COMPLETED;
            $attributes['handled_by_admin_id'] = $request->user()->id;
            $attributes['handled_at'] = now();
        }

        if ($queueStatus === Reservation::QUEUE_STATUS_CANCELLED) {
            $attributes['status'] = Reservation::STATUS_CANCELLED;
            $attributes['cancelled_at'] = now();
            $attributes['handled_by_admin_id'] = $request->user()->id;
            $attributes['handled_at'] = now();
        }

        if ($attributes !== []) {
            $reservation->update($attributes);
            $reservation->refresh();
        }

        $this->queueService->applyQueueStatus($reservation, $queueStatus);
    }

    /**
     * @return array<int, string>
     */
    private function reservationRelations(): array
    {
        return [
            'patient:id,name,username,email,phone_number',
            'doctor:id,name,username,email,phone_number',
            'clinic:id,name,address,phone_number,email',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
        ];
    }

    private function assertReservationBelongsToRequestedClinic(Request $request, Reservation $reservation): void
    {
        if ((int) $reservation->clinic_id === (int) $request->input('clinic_id')) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to access this clinic reservation.');
    }
}
