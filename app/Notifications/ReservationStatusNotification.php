<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ReservationStatusNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Reservation $reservation,
        public readonly string $eventType,
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
        $windowEnd = (string) $this->reservation->window_end_time;

        $mail = (new MailMessage())
            ->subject($this->subject())
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->introLine($clinicName))
            ->line("Doctor: {$doctorName}")
            ->line("Reservation date: {$reservationDate}")
            ->line("Reservation window: {$windowStart} - {$windowEnd}");

        if ($this->eventType === 'rejected' && !empty($this->reservation->admin_notes)) {
            $mail->line('Admin note: '.$this->reservation->admin_notes);
        }

        return $mail->line('Please check your reservation page for the latest details.');
    }

    private function subject(): string
    {
        return match ($this->eventType) {
            'approved' => 'Your reservation has been approved',
            'rejected' => 'Your reservation has been rejected',
            'rescheduled' => 'Your reservation has been rescheduled',
            default => 'Reservation update',
        };
    }

    private function introLine(string $clinicName): string
    {
        return match ($this->eventType) {
            'approved' => "Your reservation at {$clinicName} has been approved.",
            'rejected' => "Your reservation at {$clinicName} has been rejected.",
            'rescheduled' => "Your reservation at {$clinicName} has been rescheduled.",
            default => "There is an update for your reservation at {$clinicName}.",
        };
    }
}
