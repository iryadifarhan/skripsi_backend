<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

class ReservationStatusNotification extends Notification implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Reservation $reservation,
        public readonly string $eventType,
    ) {
        $this->afterCommit();
    }

    /*
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $this->loadContext();

        $clinicName = $this->reservation->clinic?->name ?? 'your clinic';
        $doctorName = $this->reservation->doctor?->name ?? 'the assigned doctor';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;
        $windowEnd = (string) $this->reservation->window_end_time;
        $reservationUrl = $this->reservationPageUrl();

        $mail = (new MailMessage())
            ->subject($this->subject())
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->introLine($clinicName))
            ->line("Doctor: {$doctorName}")
            ->line("Reservation date: {$reservationDate}")
            ->line("Reservation window: {$windowStart} - {$windowEnd}");

        if (!empty($this->reservation->admin_notes)) {
            $mail->line('Admin note: '.$this->reservation->admin_notes);
        }

        if ($this->eventType === 'rejected' && !empty($this->reservation->admin_notes)) {
            $mail->line('Rejection note: '.$this->reservation->admin_notes);
        }

        if ($this->eventType === 'cancelled' && !empty($this->reservation->cancellation_reason)) {
            $mail->line('Cancellation reason: '.$this->reservation->cancellation_reason);
        }

        if ($this->eventType === 'rescheduled' && !empty($this->reservation->reschedule_reason)) {
            $mail->line('Reschedule reason: '.$this->reservation->reschedule_reason);
        }

        return $mail
            ->line('Please click the button below to check your reservation details.')
            ->action('Check Reservation', $reservationUrl)
            ->line('If the button does not work, copy and open this link:')
            ->line($reservationUrl);
    }

    public function toWhatsAppText(?string $recipientName = null): string
    {
        $this->loadContext();

        $clinicName = $this->reservation->clinic?->name ?? 'your clinic';
        $doctorName = $this->reservation->doctor?->name ?? 'the assigned doctor';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;
        $windowEnd = (string) $this->reservation->window_end_time;
        $lines = [
            trim('Hello '.($recipientName ?? 'Patient').','),
            $this->introLine($clinicName),
            "",
            "*Doctor*: {$doctorName}",
            "*Reservation date*: {$reservationDate}",
            "*Reservation window*: {$windowStart} - {$windowEnd}",
            "",
        ];

        if (!empty($this->reservation->admin_notes)) {
           $lines[] = '*Admin note*: '.$this->reservation->admin_notes;
        }

        if ($this->eventType === 'rejected' && !empty($this->reservation->admin_notes)) {
            $lines[] = '*Rejection note*: '.$this->reservation->admin_notes;
        }

        if ($this->eventType === 'cancelled' && !empty($this->reservation->cancellation_reason)) {
            $lines[] = '*Cancellation reason*: '.$this->reservation->cancellation_reason;
        }

        if ($this->eventType === 'rescheduled' && !empty($this->reservation->reschedule_reason)) {
            $lines[] = '*Reschedule reason*: '.$this->reservation->reschedule_reason;
        }

        $lines[] = "\n".'Please click the link below to check your reservation details:';
        $lines[] = $this->reservationPageUrl();

        return implode("\n", $lines);
    }

    private function reservationPageUrl(): string
    {
        return route('reservations.page');
    }

    private function loadContext(): void
    {
        $this->reservation->loadMissing([
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
        ]);
    }

    private function subject(): string
    {
        return match ($this->eventType) {
            'approved' => 'Your reservation has been approved',
            'cancelled' => 'Your reservation has been cancelled',
            'rejected' => 'Your reservation has been rejected',
            'rescheduled' => 'Your reservation has been rescheduled',
            default => 'Reservation update',
        };
    }

    private function introLine(string $clinicName): string
    {
        return match ($this->eventType) {
            'approved' => "Your reservation at {$clinicName} has been approved.",
            'cancelled' => "Your reservation at {$clinicName} has been cancelled.",
            'rejected' => "Your reservation at {$clinicName} has been rejected.",
            'rescheduled' => "Your reservation at {$clinicName} has been rescheduled.",
            default => "There is an update for your reservation at {$clinicName}.",
        };
    }
}
