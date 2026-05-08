<?php

namespace App\Notifications;

use App\Models\MedicalRecord;
use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

class MedicalRecordReadyNotification extends Notification implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Reservation $reservation,
        public readonly MedicalRecord $medicalRecord,
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
        $medicalRecordUrl = $this->medicalRecordPageUrl();

        $mail = (new MailMessage())
            ->subject('Rekam medis Anda sudah tersedia')
            ->greeting('Halo '.$notifiable->name.',')
            ->line("Reservasi Anda di {$clinicName} telah selesai.")
            ->line("Dokter: {$doctorName}")
            ->line("Tanggal reservasi: {$reservationDate}")
            ->line("Waktu reservasi: {$windowStart}");

        $this->appendMedicalRecordLines($mail);

        return $mail
            ->line('Silakan klik tombol di bawah untuk melihat rekam medis Anda.')
            ->action('Cek Rekam Medis', $medicalRecordUrl)
            ->line('Jika tombol tidak berfungsi, salin dan buka tautan ini:')
            ->line($medicalRecordUrl);
    }

    public function toWhatsAppText(?string $recipientName = null): string
    {
        $this->loadContext();

        $clinicName = $this->reservation->clinic?->name ?? 'klinik Anda';
        $doctorName = $this->reservation->doctor?->name ?? 'dokter yang ditugaskan';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;

        $lines = [
            trim('Halo '.($recipientName ?? 'Pasien').','),
            "Reservasi Anda di {$clinicName} telah selesai.",
            '',
            "*Dokter*: {$doctorName}",
            "*Tanggal reservasi*: {$reservationDate}",
            "*Waktu reservasi*: {$windowStart}",
            '',
            '*Catatan dokter*: '.$this->medicalRecord->doctor_notes,
        ];

        if (!empty($this->medicalRecord->diagnosis)) {
            $lines[] = '*Diagnosis*: '.$this->medicalRecord->diagnosis;
        }

        if (!empty($this->medicalRecord->treatment)) {
            $lines[] = '*Tindakan*: '.$this->medicalRecord->treatment;
        }

        if (!empty($this->medicalRecord->prescription_notes)) {
            $lines[] = '*Catatan resep*: '.$this->medicalRecord->prescription_notes;
        }

        $lines[] = '';
        $lines[] = 'Silakan klik tautan di bawah untuk melihat rekam medis Anda:';
        $lines[] = $this->medicalRecordPageUrl();

        return implode("\n", $lines);
    }

    private function appendMedicalRecordLines(MailMessage $mail): void
    {
        $mail->line('Catatan dokter: '.$this->medicalRecord->doctor_notes);

        if (!empty($this->medicalRecord->diagnosis)) {
            $mail->line('Diagnosis: '.$this->medicalRecord->diagnosis);
        }

        if (!empty($this->medicalRecord->treatment)) {
            $mail->line('Tindakan: '.$this->medicalRecord->treatment);
        }

        if (!empty($this->medicalRecord->prescription_notes)) {
            $mail->line('Catatan resep: '.$this->medicalRecord->prescription_notes);
        }
    }

    private function medicalRecordPageUrl(): string
    {
        return route('patient.medical-records');
    }

    private function loadContext(): void
    {
        $this->reservation->loadMissing([
            'clinic:id,name,address,phone_number,email',
            'doctor:id,name,username,email,phone_number',
        ]);

        $this->medicalRecord->loadMissing([
            'doctor:id,name,username,email,phone_number',
            'clinic:id,name,address,phone_number,email',
            'reservation:id,reservation_number,reservation_date,window_start_time,window_end_time,status',
        ]);
    }

}
