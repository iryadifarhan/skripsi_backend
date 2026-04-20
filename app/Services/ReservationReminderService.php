<?php

namespace App\Services;

use App\Models\Reservation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ReservationReminderService
{
    public function __construct(
        private readonly PatientNotificationService $patientNotificationService,
    ) {
    }

    public function sendUpcomingApprovedReminders(?CarbonImmutable $currentTime = null): int
    {
        $now = $currentTime ?? CarbonImmutable::now(config('app.timezone'));
        $deadline = $now->addHours(2);

        $candidateIds = Reservation::query()
            ->where('status', Reservation::STATUS_APPROVED)
            ->whereNull('reminder_sent_at')
            ->whereDate('reservation_date', '>=', $now->toDateString())
            ->whereDate('reservation_date', '<=', $deadline->toDateString())
            ->orderBy('reservation_date')
            ->orderBy('window_start_time')
            ->pluck('id');

        $sentCount = 0;

        foreach ($candidateIds as $reservationId) {
            $sent = DB::transaction(function () use ($reservationId, $now, $deadline): bool {
                $reservation = Reservation::query()
                    ->with([
                        'patient:id,name,email,phone_number',
                        'clinic:id,name,address,phone_number,email',
                        'doctor:id,name,username,email,phone_number',
                    ])
                    ->lockForUpdate()
                    ->find($reservationId);

                if ($reservation === null) {
                    return false;
                }

                if (
                    $reservation->status !== Reservation::STATUS_APPROVED
                    || $reservation->reminder_sent_at !== null
                    || !$this->isWithinReminderWindow($reservation, $now, $deadline)
                ) {
                    return false;
                }

                $sent = $this->patientNotificationService->sendReservationReminderNotification($reservation);

                if (!$sent) {
                    return false;
                }

                $reservation->update([
                    'reminder_sent_at' => $now,
                ]);

                return true;
            });

            if ($sent) {
                $sentCount++;
            }
        }

        return $sentCount;
    }

    private function isWithinReminderWindow(
        Reservation $reservation,
        CarbonImmutable $now,
        CarbonImmutable $deadline,
    ): bool {
        $reservationStart = CarbonImmutable::parse(
            $reservation->reservation_date->toDateString().' '.(string) $reservation->window_start_time,
            config('app.timezone')
        );

        return $reservationStart->greaterThan($now) && $reservationStart->lessThan($deadline);
    }
}
