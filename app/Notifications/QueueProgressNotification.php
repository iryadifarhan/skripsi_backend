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

        $clinicName = $this->reservation->clinic?->name ?? 'klinik Anda';
        $doctorName = $this->reservation->doctor?->name ?? 'dokter yang ditugaskan';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;
        $queueUrl = $this->queuePageUrl();

        return (new MailMessage())
            ->subject($this->subject())
            ->greeting('Halo '.$notifiable->name.',')
            ->line($this->introLine($clinicName))
            ->line("Dokter: {$doctorName}")
            ->line("Tanggal reservasi: {$reservationDate}")
            ->line("Waktu reservasi: {$windowStart}")
            ->line('Nomor antrean: '.($this->reservation->queue_number ?? '-'))
            ->line('Silakan klik tombol di bawah untuk melihat status antrean Anda.')
            ->action('Cek Antrean', $queueUrl)
            ->line('Jika tombol tidak berfungsi, salin dan buka tautan ini:')
            ->line($queueUrl);
    }

    public function toWhatsAppText(?string $recipientName = null): string
    {
        $this->loadContext();

        $clinicName = $this->reservation->clinic?->name ?? 'klinik Anda';
        $doctorName = $this->reservation->doctor?->name ?? 'dokter yang ditugaskan';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;

        return implode("\n", [
            trim('Halo '.($recipientName ?? 'Pasien').','),
            $this->introLine($clinicName),
            "",
            "*Dokter*: {$doctorName}",
            "*Tanggal reservasi*: {$reservationDate}",
            "*Waktu reservasi*: {$windowStart}",
            '*Nomor antrean*: '.($this->reservation->queue_number ?? '-'),
            "",
            'Silakan klik tautan di bawah untuk melihat status antrean Anda:',
            $this->queuePageUrl(),
        ]);
    }

    private function queuePageUrl(): string
    {
        return route('patient.reservations');
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
            Reservation::QUEUE_STATUS_CALLED => 'Antrean Anda sedang dipanggil',
            Reservation::QUEUE_STATUS_COMPLETED => 'Antrean Anda telah selesai',
            default => 'Pembaruan antrean',
        };
    }

    private function introLine(string $clinicName): string
    {
        return match ($this->queueStatus) {
            Reservation::QUEUE_STATUS_CALLED => "Antrean Anda di {$clinicName} sedang dipanggil.",
            Reservation::QUEUE_STATUS_COMPLETED => "Reservasi Anda di {$clinicName} telah selesai.",
            default => "Terdapat pembaruan pada antrean Anda di {$clinicName}.",
        };
    }
}
