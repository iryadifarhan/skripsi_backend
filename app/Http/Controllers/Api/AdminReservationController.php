<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Services\PatientNotificationService;
use App\Models\User;
use App\Services\ReservationQueueService;
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
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $clinicId = $request->input('clinic_id');

        $payload = $request->validate([
            'status' => ['nullable', 'string', Rule::in(Reservation::STATUSES)],
            'reservation_date' => ['nullable', 'date'],
        ]);

        $query = Reservation::with([
            'patient:id,name,username,email,phone_number',
            'doctor:id,name,username,email,phone_number',
            'clinic:id,name,address,phone_number,email',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
        ])->where('clinic_id', $clinicId)
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
            'reservation' => $this->queueService->serializeReservation($reservation->load([
                'patient:id,name,username,email,phone_number',
                'doctor:id,name,username,email,phone_number',
                'clinic:id,name,address,phone_number,email',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ])),
        ]);
    }

    public function update(Request $request, Reservation $reservation): JsonResponse
    {
        $this->assertReservationBelongsToRequestedClinic($request, $reservation);

        $payload = $request->validate([
            'status' => ['sometimes', 'string', Rule::in(self::ADMIN_MUTABLE_STATUSES)],
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'cancellation_reason' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        if ($payload === []) {
            throw ValidationException::withMessages([
                'message' => ['At least one field is required to update reservation.'],
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

                    if (in_array($payload['status'], [Reservation::STATUS_APPROVED, Reservation::STATUS_REJECTED], true)) {
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
            'message' => 'Reservation update successful.',
            'reservation' => $this->queueService->serializeReservation($reservation->fresh()->load([
                'patient:id,name,username,email,phone_number',
                'doctor:id,name,username,email,phone_number',
                'clinic:id,name,address,phone_number,email',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ])),
        ]);
    }

    private function assertReservationBelongsToRequestedClinic(Request $request, Reservation $reservation): void
    {
        if ((int) $reservation->clinic_id === (int) $request->input('clinic_id')) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to access this clinic reservation.');
    }
}
