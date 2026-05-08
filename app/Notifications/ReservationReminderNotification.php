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

        $clinicName = $this->reservation->clinic?->name ?? 'klinik Anda';
        $doctorName = $this->reservation->doctor?->name ?? 'dokter yang ditugaskan';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;
        $windowEnd = (string) $this->reservation->window_end_time;
        $reservationUrl = $this->reservationPageUrl();

        return (new MailMessage())
            ->subject('Pengingat reservasi: jadwal Anda segera dimulai')
            ->greeting('Halo '.$notifiable->name.',')
            ->line("Ini adalah pengingat bahwa reservasi Anda di {$clinicName} akan dimulai kurang dari 2 jam lagi.")
            ->line("Dokter: {$doctorName}")
            ->line("Tanggal reservasi: {$reservationDate}")
            ->line("Waktu reservasi: {$windowStart} - {$windowEnd}")
            ->line('Silakan klik tombol di bawah untuk melihat detail reservasi Anda.')
            ->action('Cek Reservasi', $reservationUrl)
            ->line('Jika tombol tidak berfungsi, salin dan buka tautan ini:')
            ->line($reservationUrl);
    }

    public function toWhatsAppText(?string $recipientName = null): string
    {
        $this->loadContext();

        $clinicName = $this->reservation->clinic?->name ?? 'klinik Anda';
        $doctorName = $this->reservation->doctor?->name ?? 'dokter yang ditugaskan';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;
        $windowEnd = (string) $this->reservation->window_end_time;

        return implode("\n", [
            trim('Halo '.($recipientName ?? 'Pasien').','),
            "Ini adalah pengingat bahwa reservasi Anda di {$clinicName} akan dimulai kurang dari 2 jam lagi.",
            '',
            "*Dokter*: {$doctorName}",
            "*Tanggal reservasi*: {$reservationDate}",
            "*Waktu reservasi*: {$windowStart} - {$windowEnd}",
            '',
            'Silakan klik tautan di bawah untuk melihat detail reservasi Anda:',
            $this->reservationPageUrl(),
        ]);
    }

    private function reservationPageUrl(): string
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

}
