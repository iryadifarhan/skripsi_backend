<?php

namespace App\Services;

use App\Models\Reservation;
use App\Notifications\QueueProgressNotification;
use App\Notifications\ReservationStatusNotification;
use Illuminate\Support\Facades\Log;
use Throwable;

class PatientNotificationService
{
    public function __construct(
        private readonly FonnteService $fonnteService,
    ) {
    }

    public function sendReservationStatusNotification(Reservation $reservation, string $eventType): void
    {
        $reservation->loadMissing([
            'patient:id,name,email,phone_number',
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
        ]);

        $notification = new ReservationStatusNotification($reservation, $eventType);
        $patient = $reservation->patient;

        if ($patient !== null && !empty($patient->email)) {
            try {
                $patient->notify($notification);
            } catch (Throwable $exception) {
                Log::warning('Patient email notification failed.', [
                    'reservation_id' => $reservation->id,
                    'event_type' => $eventType,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        $this->sendWhatsAppNotification(
            reservation: $reservation,
            message: $notification->toWhatsAppText($patient?->name ?? $reservation->guest_name),
        );
    }

    public function sendQueueProgressNotification(Reservation $reservation, string $queueStatus): void
    {
        $reservation->loadMissing([
            'patient:id,name,email,phone_number',
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
        ]);

        $notification = new QueueProgressNotification($reservation, $queueStatus);
        $patient = $reservation->patient;

        if ($patient !== null && !empty($patient->email)) {
            try {
                $patient->notify($notification);
            } catch (Throwable $exception) {
                Log::warning('Patient queue email notification failed.', [
                    'reservation_id' => $reservation->id,
                    'queue_status' => $queueStatus,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        $this->sendWhatsAppNotification(
            reservation: $reservation,
            message: $notification->toWhatsAppText($patient?->name ?? $reservation->guest_name),
        );
    }

    private function sendWhatsAppNotification(Reservation $reservation, string $message): void
    {
        $phoneNumber = $reservation->patient?->phone_number ?: $reservation->guest_phone_number;

        if (empty($phoneNumber)) {
            return;
        }

        $this->fonnteService->sendMessage((string) $phoneNumber, $message);
    }
}
