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

        $clinicName = $this->reservation->clinic?->name ?? 'klinik Anda';
        $doctorName = $this->reservation->doctor?->name ?? 'dokter yang ditugaskan';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;
        $windowEnd = (string) $this->reservation->window_end_time;
        $reservationUrl = $this->reservationPageUrl();

        $mail = (new MailMessage())
            ->subject($this->subject())
            ->greeting('Halo '.$notifiable->name.',')
            ->line($this->introLine($clinicName))
            ->line("Dokter: {$doctorName}")
            ->line("Tanggal reservasi: {$reservationDate}")
            ->line("Waktu reservasi: {$windowStart} - {$windowEnd}");

        if (!empty($this->reservation->admin_notes)) {
            $mail->line('Catatan admin: '.$this->reservation->admin_notes);
        }

        if (in_array($this->eventType, ['cancelled', 'rejected'], true) && !empty($this->reservation->cancellation_reason)) {
            $mail->line($this->cancellationReasonLabel().': '.$this->reservation->cancellation_reason);
        }

        if ($this->eventType === 'rescheduled' && !empty($this->reservation->reschedule_reason)) {
            $mail->line('Alasan penjadwalan ulang: '.$this->reservation->reschedule_reason);
        }

        return $mail
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
        $lines = [
            trim('Halo '.($recipientName ?? 'Pasien').','),
            $this->introLine($clinicName),
            "",
            "*Dokter*: {$doctorName}",
            "*Tanggal reservasi*: {$reservationDate}",
            "*Waktu reservasi*: {$windowStart} - {$windowEnd}",
            "",
        ];

        if (!empty($this->reservation->admin_notes)) {
           $lines[] = '*Catatan admin*: '.$this->reservation->admin_notes;
        }

        if (in_array($this->eventType, ['cancelled', 'rejected'], true) && !empty($this->reservation->cancellation_reason)) {
            $lines[] = '*'.$this->cancellationReasonLabel().'*: '.$this->reservation->cancellation_reason;
        }

        if ($this->eventType === 'rescheduled' && !empty($this->reservation->reschedule_reason)) {
            $lines[] = '*Alasan penjadwalan ulang*: '.$this->reservation->reschedule_reason;
        }

        $lines[] = "\n".'Silakan klik tautan di bawah untuk melihat detail reservasi Anda:';
        $lines[] = $this->reservationPageUrl();

        return implode("\n", $lines);
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

    private function subject(): string
    {
        return match ($this->eventType) {
            'approved' => 'Reservasi Anda telah disetujui',
            'cancelled' => 'Reservasi Anda telah dibatalkan',
            'rejected' => 'Reservasi Anda ditolak',
            'rescheduled' => 'Reservasi Anda telah dijadwalkan ulang',
            default => 'Pembaruan reservasi',
        };
    }

    private function introLine(string $clinicName): string
    {
        return match ($this->eventType) {
            'approved' => "Reservasi Anda di {$clinicName} telah disetujui.",
            'cancelled' => "Reservasi Anda di {$clinicName} telah dibatalkan.",
            'rejected' => "Reservasi Anda di {$clinicName} telah ditolak.",
            'rescheduled' => "Reservasi Anda di {$clinicName} telah dijadwalkan ulang.",
            default => "Terdapat pembaruan pada reservasi Anda di {$clinicName}.",
        };
    }

    private function cancellationReasonLabel(): string
    {
        return $this->eventType === 'rejected'
            ? 'Alasan penolakan'
            : 'Alasan pembatalan';
    }
}
