<?php

namespace App\Notifications;

use App\Models\MedicalRecord;
use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class MedicalRecordReadyNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Reservation $reservation,
        public readonly MedicalRecord $medicalRecord,
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
        $medicalRecordUrl = $this->medicalRecordPageUrl();

        $mail = (new MailMessage())
            ->subject('Your medical record is ready')
            ->greeting('Hello '.$notifiable->name.',')
            ->line("Your reservation at {$clinicName} has been completed.")
            ->line("Doctor: {$doctorName}")
            ->line("Reservation date: {$reservationDate}")
            ->line("Reservation window: {$windowStart}");

        $this->appendMedicalRecordLines($mail);

        return $mail
            ->line('Please click the button below to check your medical record.')
            ->action('Check Medical Record', $medicalRecordUrl)
            ->line('If the button does not work, copy and open this link:')
            ->line($medicalRecordUrl);
    }

    public function toWhatsAppText(?string $recipientName = null): string
    {
        $clinicName = $this->reservation->clinic?->name ?? 'your clinic';
        $doctorName = $this->reservation->doctor?->name ?? 'the assigned doctor';
        $reservationDate = $this->reservation->reservation_date?->format('Y-m-d') ?? '-';
        $windowStart = (string) $this->reservation->window_start_time;

        $lines = [
            trim('Hello '.($recipientName ?? 'Patient').','),
            "Your reservation at {$clinicName} has been completed.",
            '',
            "*Doctor*: {$doctorName}",
            "*Reservation date*: {$reservationDate}",
            "*Reservation window*: {$windowStart}",
            '',
            '*Doctor note*: '.$this->medicalRecord->doctor_notes,
        ];

        if (!empty($this->medicalRecord->diagnosis)) {
            $lines[] = '*Diagnosis*: '.$this->medicalRecord->diagnosis;
        }

        if (!empty($this->medicalRecord->treatment)) {
            $lines[] = '*Treatment*: '.$this->medicalRecord->treatment;
        }

        if (!empty($this->medicalRecord->prescription_notes)) {
            $lines[] = '*Prescription note*: '.$this->medicalRecord->prescription_notes;
        }

        $lines[] = '';
        $lines[] = 'Please click the link below to check your medical record:';
        $lines[] = $this->medicalRecordPageUrl();

        return implode("\n", $lines);
    }

    private function appendMedicalRecordLines(MailMessage $mail): void
    {
        $mail->line('Doctor note: '.$this->medicalRecord->doctor_notes);

        if (!empty($this->medicalRecord->diagnosis)) {
            $mail->line('Diagnosis: '.$this->medicalRecord->diagnosis);
        }

        if (!empty($this->medicalRecord->treatment)) {
            $mail->line('Treatment: '.$this->medicalRecord->treatment);
        }

        if (!empty($this->medicalRecord->prescription_notes)) {
            $mail->line('Prescription note: '.$this->medicalRecord->prescription_notes);
        }
    }

    private function medicalRecordPageUrl(): string
    {
        $baseUrl = rtrim((string) config('app.frontend_url'), '/');
        $path = config('app.frontend_medical_records_path', '/medical_record');

        return $baseUrl.'/'.$this->normalizePath((string) $path);
    }

    private function normalizePath(string $path): string
    {
        return ltrim($path, '/');
    }
}
