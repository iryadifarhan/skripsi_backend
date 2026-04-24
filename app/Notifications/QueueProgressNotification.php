<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

class QueueProgressNotification extends Notification implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Reservation $reservation,
        public readonly string $queueStatus,
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
        $this->loadContext();

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
        return route('queue.page');
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
