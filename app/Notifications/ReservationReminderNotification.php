<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

class ReservationReminderNotification extends Notification implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Reservation $reservation,
    ) {
        $this->afterCommit();
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
        $this->loadContext();

        $clinicName = $this->reservation->clinic?->name ?? 'your clinic';
        $doctorName = $this->reservation->doctor?->name ?? 'the assigned doctor';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;
        $windowEnd = (string) $this->reservation->window_end_time;
        $reservationUrl = $this->reservationPageUrl();

        return (new MailMessage())
            ->subject('Reservation reminder: your schedule is approaching')
            ->greeting('Hello '.$notifiable->name.',')
            ->line("This is a reminder that your reservation at {$clinicName} will start in less than 2 hours.")
            ->line("Doctor: {$doctorName}")
            ->line("Reservation date: {$reservationDate}")
            ->line("Reservation window: {$windowStart} - {$windowEnd}")
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

        return implode("\n", [
            trim('Hello '.($recipientName ?? 'Patient').','),
            "This is a reminder that your reservation at {$clinicName} will start in less than 2 hours.",
            '',
            "*Doctor*: {$doctorName}",
            "*Reservation date*: {$reservationDate}",
            "*Reservation window*: {$windowStart} - {$windowEnd}",
            '',
            'Please click the link below to check your reservation details:',
            $this->reservationPageUrl(),
        ]);
    }

    private function reservationPageUrl(): string
    {
        $baseUrl = rtrim((string) config('app.frontend_url'), '/');
        $path = config('app.frontend_reservations_path', '/reservation');

        return $baseUrl.'/'.$this->normalizePath((string) $path);
    }

    private function loadContext(): void
    {
        $this->reservation->loadMissing([
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
        ]);
    }

    private function normalizePath(string $path): string
    {
        return ltrim($path, '/');
    }
}
