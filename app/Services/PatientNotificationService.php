<?php

namespace App\Services;

use App\Models\Reservation;
use App\Notifications\QueueProgressNotification;
use App\Notifications\ReservationStatusNotification;

class PatientNotificationService
{
    public function sendReservationStatusNotification(Reservation $reservation, string $eventType): void
    {
        $patient = $reservation->patient;

        if ($patient === null || empty($patient->email)) {
            return;
        }

        $reservation->loadMissing([
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
        ]);

        $patient->notify(new ReservationStatusNotification($reservation, $eventType));
    }

    public function sendQueueProgressNotification(Reservation $reservation, string $queueStatus): void
    {
        $patient = $reservation->patient;

        if ($patient === null || empty($patient->email)) {
            return;
        }

        $reservation->loadMissing([
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
        ]);

        $patient->notify(new QueueProgressNotification($reservation, $queueStatus));
    }
}
