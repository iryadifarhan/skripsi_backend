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
        $queueUrl = $this->queuePageUrl();

        return (new MailMessage())
            ->subject($this->subject())
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->introLine($clinicName))
            ->line("Doctor: {$doctorName}")
            ->line("Reservation date: {$reservationDate}")
            ->line("Reservation window: {$windowStart}")
            ->line('Queue number: '.($this->reservation->queue_number ?? '-'))
            ->line('Please click the button below to check your queue status.')
            ->action('Check Queue', $queueUrl)
            ->line('If the button does not work, copy and open this link:')
            ->line($queueUrl);
    }

    public function toWhatsAppText(?string $recipientName = null): string
    {
        $clinicName = $this->reservation->clinic?->name ?? 'your clinic';
        $doctorName = $this->reservation->doctor?->name ?? 'the assigned doctor';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;

        return implode("\n", [
            trim('Hello '.($recipientName ?? 'Patient').','),
            $this->introLine($clinicName),
            "",
            "*Doctor*: {$doctorName}",
            "*Reservation date*: {$reservationDate}",
            "*Reservation window*: {$windowStart}",
            '*Queue number*: '.($this->reservation->queue_number ?? '-'),
            "",
            'Please click the link below to check your queue status:',
            $this->queuePageUrl(),
        ]);
    }

    private function queuePageUrl(): string
    {
        $baseUrl = rtrim((string) config('app.frontend_url'), '/');
        $path = config('app.frontend_queue_path', '/queue');

        return $baseUrl.'/'.$this->normalizePath((string) $path);
    }

    private function normalizePath(string $path): string
    {
        return ltrim($path, '/');
    }

    private function subject(): string
    {
        return match ($this->queueStatus) {
            Reservation::QUEUE_STATUS_CALLED => 'Your queue is being called',
            Reservation::QUEUE_STATUS_COMPLETED => 'Your queue has been completed',
            default => 'Queue update',
        };
    }

    private function introLine(string $clinicName): string
    {
        return match ($this->queueStatus) {
            Reservation::QUEUE_STATUS_CALLED => "Your queue at {$clinicName} is now being called.",
            Reservation::QUEUE_STATUS_COMPLETED => "Your reservation at {$clinicName} has been completed.",
            default => "There is an update for your queue at {$clinicName}.",
        };
    }
}
