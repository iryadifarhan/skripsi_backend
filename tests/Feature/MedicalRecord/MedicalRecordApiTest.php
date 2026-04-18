<?php

namespace Tests\Feature\MedicalRecord;

use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use App\Notifications\MedicalRecordReadyNotification;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class MedicalRecordApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('session.driver', 'database');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_doctor_can_create_medical_record_and_complete_reservation(): void
    {
        Notification::fake();
        Http::fake();
        $this->enableFonnte();

        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record@example.com', null, '081234500006');
        $reservation = $this->createReservation(
            patient: $patient,
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '09:00:00',
            slot: 1,
            queueNumber: 1,
            queueStatus: Reservation::QUEUE_STATUS_IN_PROGRESS,
        );

        $this->login($doctor, 'Password123!');

        $this->postJson("/api/doctor/reservations/{$reservation->id}/medical-records", [
            'clinic_id' => $clinic->id,
            'diagnosis' => 'Common cold',
            'doctor_notes' => 'Patient should rest for three days.',
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('medical_record.reservation_id', $reservation->id)
            ->assertJsonPath('medical_record.patient_id', $patient->id)
            ->assertJsonPath('medical_record.diagnosis', 'Common cold')
            ->assertJsonPath('medical_record.treatment', null)
            ->assertJsonPath('medical_record.prescription_notes', null)
            ->assertJsonPath('medical_record.doctor_notes', 'Patient should rest for three days.')
            ->assertJsonPath('reservation.status', Reservation::STATUS_COMPLETED)
            ->assertJsonPath('reservation.queue_summary.status', Reservation::QUEUE_STATUS_COMPLETED)
            ->assertJsonPath('reservation.queue_summary.number', null);

        $this->assertDatabaseHas('medical_records', [
            'reservation_id' => $reservation->id,
            'patient_id' => $patient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Common cold',
            'treatment' => null,
            'prescription_notes' => null,
            'doctor_notes' => 'Patient should rest for three days.',
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => Reservation::STATUS_COMPLETED,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'queue_number' => null,
        ]);

        Notification::assertSentTo(
            $patient,
            MedicalRecordReadyNotification::class,
            fn (MedicalRecordReadyNotification $notification): bool =>
                $notification->medicalRecord->doctor_notes === 'Patient should rest for three days.'
                && $notification->medicalRecord->diagnosis === 'Common cold'
        );

        Http::assertSent(fn ($request): bool =>
            $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '081234500006'
            && $request['countryCode'] === '62'
            && str_contains((string) $request['message'], 'completed')
            && str_contains((string) $request['message'], 'Patient should rest for three days.')
            && str_contains((string) $request['message'], '/medical_record')
        );
    }

    public function test_completion_does_not_notify_next_active_queue_entry_when_queue_advances(): void
    {
        Notification::fake();
        Http::fake();
        $this->enableFonnte();

        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record-queue-advance');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-queue-advance@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $currentPatient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-queue-current@example.com', null, '081234500010');
        $nextPatient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-queue-next@example.com', null, '081234500011');

        $currentReservation = $this->createReservation($currentPatient, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_IN_PROGRESS);
        $nextReservation = $this->createReservation($nextPatient, $schedule, $reservationDate, '10:00:00', 1, 2, Reservation::QUEUE_STATUS_WAITING);

        $this->login($doctor, 'Password123!');

        $this->postJson("/api/doctor/reservations/{$currentReservation->id}/medical-records", [
            'clinic_id' => $clinic->id,
            'doctor_notes' => 'Current patient completed consultation.',
        ], $this->spaHeaders())->assertCreated();

        $this->assertDatabaseHas('reservations', [
            'id' => $nextReservation->id,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_WAITING,
        ]);

        Notification::assertNotSentTo($nextPatient, MedicalRecordReadyNotification::class);

        Http::assertNotSent(fn ($request): bool =>
            $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '081234500011'
        );
    }

    public function test_doctor_notes_is_required_when_creating_medical_record(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record-validation');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-validation@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-validation@example.com');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_WAITING);

        $this->login($doctor, 'Password123!');

        $this->postJson("/api/doctor/reservations/{$reservation->id}/medical-records", [
            'clinic_id' => $clinic->id,
            'diagnosis' => 'Common cold',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['doctor_notes']);
    }

    public function test_doctor_cannot_create_medical_record_for_other_doctors_reservation(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record-forbidden');
        $doctorA = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-owner@example.com');
        $doctorB = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-intruder@example.com');
        $doctorA->clinics()->attach($clinic->id);
        $doctorB->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctorA, $reservationDate);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-forbidden@example.com');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_WAITING);

        $this->login($doctorB, 'Password123!');

        $this->postJson("/api/doctor/reservations/{$reservation->id}/medical-records", [
            'clinic_id' => $clinic->id,
            'doctor_notes' => 'Unauthorized attempt',
        ], $this->spaHeaders())
            ->assertForbidden();
    }

    public function test_patient_can_list_and_view_own_medical_records(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record-patient');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-patient@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-patient@example.com');
        $patient->update(['gender' => User::GENDER_PEREMPUAN]);
        $otherPatient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-other@example.com');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, null, Reservation::QUEUE_STATUS_COMPLETED);
        $reservation->update([
            'reschedule_reason' => 'Riwayat reschedule tetap perlu terlihat.',
        ]);
        $otherReservation = $this->createReservation($otherPatient, $schedule, $reservationDate, '10:00:00', 1, null, Reservation::QUEUE_STATUS_COMPLETED);

        $medicalRecord = $this->createMedicalRecord($reservation, $doctor, [
            'doctor_notes' => 'Own patient follow-up.',
        ]);
        $this->createMedicalRecord($otherReservation, $doctor, [
            'doctor_notes' => 'Other patient follow-up.',
        ]);

        $this->login($patient, 'Password123!');

        $this->getJson('/api/medical-records', $this->spaHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'medical_records')
            ->assertJsonPath('medical_records.0.id', $medicalRecord->id)
            ->assertJsonPath('medical_records.0.patient.gender', User::GENDER_PEREMPUAN)
            ->assertJsonPath('medical_records.0.clinic.id', $clinic->id);

        $this->getJson("/api/medical-records/{$medicalRecord->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('medical_record.id', $medicalRecord->id)
            ->assertJsonPath('medical_record.patient.gender', User::GENDER_PEREMPUAN)
            ->assertJsonPath('medical_record.doctor.id', $doctor->id)
            ->assertJsonPath('medical_record.reservation.reschedule_reason', 'Riwayat reschedule tetap perlu terlihat.')
            ->assertJsonPath('medical_record.reservation.id', $reservation->id);
    }

    public function test_patient_cannot_view_other_patients_medical_record(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record-patient-scope');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-patient-scope@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $owner = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-owner@example.com');
        $intruder = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-intruder@example.com');
        $reservation = $this->createReservation($owner, $schedule, $reservationDate, '09:00:00', 1, null, Reservation::QUEUE_STATUS_COMPLETED);
        $medicalRecord = $this->createMedicalRecord($reservation, $doctor, [
            'doctor_notes' => 'Scoped note.',
        ]);

        $this->login($intruder, 'Password123!');

        $this->getJson("/api/medical-records/{$medicalRecord->id}", $this->spaHeaders())
            ->assertForbidden();
    }

    public function test_admin_cannot_mark_reservation_as_completed_directly(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record-admin-block');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-admin-block@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-medical-record-admin-block@example.com', $clinic->id);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-admin-block@example.com');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_IN_PROGRESS);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/reservations/{$reservation->id}", [
            'clinic_id' => $clinic->id,
            'status' => Reservation::STATUS_COMPLETED,
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_admin_can_link_completed_walk_in_reservation_and_medical_record_to_patient(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-medical-record-link-patient');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-medical-record-link-patient@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-medical-record-link-patient@example.com', $clinic->id);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-medical-record-link-patient@example.com');

        $reservation = Reservation::create([
            'reservation_number' => 'RSV-'.Str::upper(Str::random(12)),
            'queue_number' => null,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'queue_completed_at' => now(),
            'patient_id' => null,
            'guest_name' => 'Walk In Linked Later',
            'guest_phone_number' => '081234500009',
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00:00',
            'window_end_time' => '10:00:00',
            'window_slot_number' => 1,
            'status' => Reservation::STATUS_COMPLETED,
        ]);

        $medicalRecord = $this->createMedicalRecord($reservation, $doctor, [
            'patient_id' => null,
            'guest_name' => 'Walk In Linked Later',
            'guest_phone_number' => '081234500009',
            'doctor_notes' => 'Walk-in completed before account registration.',
        ]);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/reservations/{$reservation->id}/details", [
            'clinic_id' => $clinic->id,
            'patient_id' => $patient->id,
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.patient_id', $patient->id)
            ->assertJsonPath('reservation.guest_name', null)
            ->assertJsonPath('reservation.guest_phone_number', null);

        $this->assertDatabaseHas('medical_records', [
            'id' => $medicalRecord->id,
            'patient_id' => $patient->id,
            'guest_name' => null,
            'guest_phone_number' => null,
        ]);

        $this->postJson('/api/logout', [], $this->spaHeaders())->assertOk();
        $this->login($patient, 'Password123!');

        $this->getJson("/api/medical-records/{$medicalRecord->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('medical_record.id', $medicalRecord->id)
            ->assertJsonPath('medical_record.patient_id', $patient->id);
    }

    private function login(User $user, string $password): void
    {
        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => $password,
        ], $this->spaHeaders())->assertOk();
    }

    private function makeClinic(string $slug): Clinic
    {
        return Clinic::create([
            'name' => $slug,
            'address' => 'Address '.$slug,
            'phone_number' => '08'.random_int(1000000000, 9999999999),
            'email' => $slug.'-'.Str::lower(Str::random(6)).'@example.test',
        ]);
    }

    private function makeUser(string $role, string $email, ?int $clinicId = null, ?string $phoneNumber = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'email' => $email,
            'phone_number' => $phoneNumber ?? ('+628'.random_int(100000000, 999999999)),
            'password' => Hash::make('Password123!'),
            'clinic_id' => $clinicId,
            'profile_picture' => User::defaultProfilePictureForRole($role),
        ]);
    }

    private function enableFonnte(): void
    {
        config()->set('services.fonnte.enabled', true);
        config()->set('services.fonnte.token', 'test-fonnte-token');
        config()->set('services.fonnte.base_url', 'https://api.fonnte.com');
        config()->set('services.fonnte.country_code', '62');
    }

    private function makeScheduleForDate(
        Clinic $clinic,
        User $doctor,
        string $reservationDate,
        int $windowMinutes = 60,
        int $maxPatients = 4,
    ): DoctorClinicSchedule {
        $dayOfWeek = Carbon::parse($reservationDate)->dayOfWeek;

        return DoctorClinicSchedule::create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => $dayOfWeek,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => $windowMinutes,
            'max_patients_per_window' => $maxPatients,
            'is_active' => true,
        ]);
    }

    private function createReservation(
        User $patient,
        DoctorClinicSchedule $schedule,
        string $reservationDate,
        string $windowStartTime,
        int $slot,
        ?int $queueNumber,
        string $queueStatus,
    ): Reservation {
        $windowEndTime = Carbon::createFromFormat('H:i:s', $windowStartTime)
            ->addMinutes($schedule->window_minutes)
            ->format('H:i:s');

        $reservationStatus = match ($queueStatus) {
            Reservation::QUEUE_STATUS_COMPLETED => Reservation::STATUS_COMPLETED,
            Reservation::QUEUE_STATUS_CANCELLED => Reservation::STATUS_CANCELLED,
            default => Reservation::STATUS_PENDING,
        };

        return Reservation::create([
            'reservation_number' => 'RSV-'.Str::upper(Str::random(12)),
            'queue_number' => $queueNumber,
            'queue_status' => $queueStatus,
            'queue_called_at' => in_array($queueStatus, [Reservation::QUEUE_STATUS_CALLED, Reservation::QUEUE_STATUS_IN_PROGRESS], true) ? now() : null,
            'queue_started_at' => $queueStatus === Reservation::QUEUE_STATUS_IN_PROGRESS ? now() : null,
            'queue_completed_at' => $queueStatus === Reservation::QUEUE_STATUS_COMPLETED ? now() : null,
            'patient_id' => $patient->id,
            'clinic_id' => $schedule->clinic_id,
            'doctor_id' => $schedule->doctor_id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => $windowStartTime,
            'window_end_time' => $windowEndTime,
            'window_slot_number' => $slot,
            'status' => $reservationStatus,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createMedicalRecord(Reservation $reservation, User $doctor, array $overrides = []): MedicalRecord
    {
        return MedicalRecord::create(array_merge([
            'reservation_id' => $reservation->id,
            'patient_id' => $reservation->patient_id,
            'guest_name' => $reservation->guest_name,
            'guest_phone_number' => $reservation->guest_phone_number,
            'clinic_id' => $reservation->clinic_id,
            'doctor_id' => $doctor->id,
            'diagnosis' => null,
            'treatment' => null,
            'prescription_notes' => null,
            'doctor_notes' => 'Default doctor note.',
            'issued_at' => now(),
        ], $overrides));
    }

    /**
     * @return array<string, string>
     */
    private function spaHeaders(): array
    {
        return [
            'Accept' => 'application/json',
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/login',
        ];
    }
}
