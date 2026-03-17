<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class QueueProgressNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Reservation $reservation,
        public readonly string $queueStatus,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $clinicName = $this->reservation->clinic?->name ?? 'your clinic';
        $doctorName = $this->reservation->doctor?->name ?? 'the assigned doctor';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;

        return (new MailMessage())
            ->subject($this->subject())
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->introLine($clinicName))
            ->line("Doctor: {$doctorName}")
            ->line("Reservation date: {$reservationDate}")
            ->line("Reservation window: {$windowStart}")
            ->line('Queue number: '.($this->reservation->queue_number ?? '-'))
            ->line('Please check your queue status in the system for the latest update.');
    }

    private function subject(): string
    {
        return match ($this->queueStatus) {
            Reservation::QUEUE_STATUS_CALLED => 'Your queue is being called',
            Reservation::QUEUE_STATUS_IN_PROGRESS => 'Your consultation is now in progress',
            Reservation::QUEUE_STATUS_SKIPPED => 'Your queue was marked as skipped',
            Reservation::QUEUE_STATUS_COMPLETED => 'Your queue has been completed',
            default => 'Queue update',
        };
    }

    private function introLine(string $clinicName): string
    {
        return match ($this->queueStatus) {
            Reservation::QUEUE_STATUS_CALLED => "Your queue at {$clinicName} is now being called.",
            Reservation::QUEUE_STATUS_IN_PROGRESS => "Your reservation at {$clinicName} is now in progress.",
            Reservation::QUEUE_STATUS_SKIPPED => "Your queue at {$clinicName} was marked as skipped.",
            Reservation::QUEUE_STATUS_COMPLETED => "Your reservation at {$clinicName} has been completed.",
            default => "There is an update for your queue at {$clinicName}.",
        };
    }
}
