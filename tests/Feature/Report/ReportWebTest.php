<?php

namespace Tests\Feature\Report;

use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportWebTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('session.driver', 'database');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_admin_can_view_reservations_report_and_export_excel(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-report-admin-reservations');
        $doctorA = $this->makeUser(User::ROLE_DOCTOR, 'doctor-report-admin-reservations-a@example.com');
        $doctorB = $this->makeUser(User::ROLE_DOCTOR, 'doctor-report-admin-reservations-b@example.com');
        $doctorA->clinics()->attach($clinic->id);
        $doctorB->clinics()->attach($clinic->id);
        $scheduleA = $this->makeScheduleForDate($clinic, $doctorA, $reservationDate);
        $scheduleB = $this->makeScheduleForDate($clinic, $doctorB, $reservationDate);
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-report-admin-reservations@example.com', $clinic->id);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-report-admin-reservations@example.com');

        $registeredReservation = $this->createReservation($patient, $scheduleA, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $registeredReservation->update([
            'reschedule_reason' => 'Pasien meminta pindah karena bentrok jadwal kerja.',
        ]);
        $this->createWalkInReservation($scheduleB, $reservationDate, '10:00:00', 1, Reservation::STATUS_APPROVED);

        $this->login($admin, 'Password123!');

        $this->getJson(
            '/reports/reservations?clinic_id='.$clinic->id.'&date_from='.$reservationDate.'&date_to='.$reservationDate,
            $this->spaHeaders()
        )
            ->assertOk()
            ->assertJsonPath('summary.total_reservations', 2)
            ->assertJsonPath('summary.registered_reservations', 1)
            ->assertJsonPath('summary.walk_in_reservations', 1)
            ->assertJsonPath('reservations.0.reschedule_reason', 'Pasien meminta pindah karena bentrok jadwal kerja.')
            ->assertJsonPath('reservations.0.clinic.id', $clinic->id);

        $response = $this->get(
            '/reports/reservations/export?clinic_id='.$clinic->id.'&date_from='.$reservationDate.'&date_to='.$reservationDate.'&format=xlsx',
            $this->spaHeaders()
        );

        $response->assertOk();
        $this->assertStringContainsString('.xlsx', (string) $response->headers->get('content-disposition'));
    }

    public function test_doctor_reservations_report_is_scoped_to_owned_data(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-report-doctor-reservations');
        $doctorA = $this->makeUser(User::ROLE_DOCTOR, 'doctor-report-doctor-reservations-a@example.com');
        $doctorB = $this->makeUser(User::ROLE_DOCTOR, 'doctor-report-doctor-reservations-b@example.com');
        $doctorA->clinics()->attach($clinic->id);
        $doctorB->clinics()->attach($clinic->id);
        $scheduleA = $this->makeScheduleForDate($clinic, $doctorA, $reservationDate);
        $scheduleB = $this->makeScheduleForDate($clinic, $doctorB, $reservationDate);
        $patientA = $this->makeUser(User::ROLE_PATIENT, 'patient-report-doctor-reservations-a@example.com');
        $patientB = $this->makeUser(User::ROLE_PATIENT, 'patient-report-doctor-reservations-b@example.com');

        $ownReservation = $this->createReservation($patientA, $scheduleA, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $this->createReservation($patientB, $scheduleB, $reservationDate, '10:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($doctorA, 'Password123!');

        $this->getJson(
            '/reports/reservations?clinic_id='.$clinic->id.'&date_from='.$reservationDate.'&date_to='.$reservationDate,
            $this->spaHeaders()
        )
            ->assertOk()
            ->assertJsonCount(1, 'reservations')
            ->assertJsonPath('summary.total_reservations', 1)
            ->assertJsonPath('reservations.0.id', $ownReservation->id);

        $this->getJson(
            '/reports/reservations?clinic_id='.$clinic->id.'&date_from='.$reservationDate.'&date_to='.$reservationDate.'&doctor_id='.$doctorB->id,
            $this->spaHeaders()
        )->assertForbidden();

        $response = $this->get(
            '/reports/reservations/export?clinic_id='.$clinic->id.'&date_from='.$reservationDate.'&date_to='.$reservationDate.'&format=pdf',
            $this->spaHeaders()
        );

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    public function test_admin_can_view_medical_records_report_and_export_pdf(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $issuedDate = now()->toDateString();
        $clinic = $this->makeClinic('clinic-report-medical-records');
        $doctorA = $this->makeUser(User::ROLE_DOCTOR, 'doctor-report-medical-records-a@example.com');
        $doctorB = $this->makeUser(User::ROLE_DOCTOR, 'doctor-report-medical-records-b@example.com');
        $doctorA->clinics()->attach($clinic->id);
        $doctorB->clinics()->attach($clinic->id);
        $scheduleA = $this->makeScheduleForDate($clinic, $doctorA, $reservationDate);
        $scheduleB = $this->makeScheduleForDate($clinic, $doctorB, $reservationDate);
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-report-medical-records@example.com', $clinic->id);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-report-medical-records@example.com');

        $reservationA = $this->createReservation($patient, $scheduleA, $reservationDate, '09:00:00', 1, Reservation::STATUS_COMPLETED);
        $reservationB = $this->createWalkInReservation($scheduleB, $reservationDate, '10:00:00', 1, Reservation::STATUS_COMPLETED);

        $this->createMedicalRecord($reservationA, $doctorA, 'Doctor A notes.');
        $this->createMedicalRecord($reservationB, $doctorB, 'Doctor B notes.');

        $this->login($admin, 'Password123!');

        $this->getJson(
            '/reports/medical-records?clinic_id='.$clinic->id.'&date_from='.$issuedDate.'&date_to='.$issuedDate.'&doctor_id='.$doctorA->id,
            $this->spaHeaders()
        )
            ->assertOk()
            ->assertJsonPath('summary.total_medical_records', 1)
            ->assertJsonPath('summary.unique_doctors', 1)
            ->assertJsonPath('medical_records.0.reservation.reservation_date', $reservationDate)
            ->assertJsonPath('medical_records.0.doctor.id', $doctorA->id);

        $response = $this->get(
            '/reports/medical-records/export?clinic_id='.$clinic->id.'&date_from='.$issuedDate.'&date_to='.$issuedDate.'&format=pdf',
            $this->spaHeaders()
        );

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    private function login(User $user, string $password): void
    {
        $this->postJson('/login', [
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

    private function makeUser(string $role, string $email, ?int $clinicId = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'email' => $email,
            'phone_number' => '+628'.random_int(100000000, 999999999),
            'password' => Hash::make('Password123!'),
            'clinic_id' => $clinicId,
            'profile_picture' => User::defaultProfilePictureForRole($role),
        ]);
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
        string $status,
    ): Reservation {
        $windowEndTime = Carbon::createFromFormat('H:i:s', $windowStartTime)
            ->addMinutes($schedule->window_minutes)
            ->format('H:i:s');

        return Reservation::create([
            'reservation_number' => 'RSV-'.Str::upper(Str::random(12)),
            'queue_number' => in_array($status, Reservation::ACTIVE_STATUSES, true)
                ? ((int) Reservation::query()
                    ->where('doctor_clinic_schedule_id', $schedule->id)
                    ->whereDate('reservation_date', $reservationDate)
                    ->max('queue_number')) + 1
                : null,
            'queue_status' => match ($status) {
                Reservation::STATUS_COMPLETED => Reservation::QUEUE_STATUS_COMPLETED,
                Reservation::STATUS_CANCELLED, Reservation::STATUS_REJECTED => Reservation::QUEUE_STATUS_CANCELLED,
                default => Reservation::QUEUE_STATUS_WAITING,
            },
            'patient_id' => $patient->id,
            'clinic_id' => $schedule->clinic_id,
            'doctor_id' => $schedule->doctor_id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => $windowStartTime,
            'window_end_time' => $windowEndTime,
            'window_slot_number' => $slot,
            'status' => $status,
        ]);
    }

    private function createWalkInReservation(
        DoctorClinicSchedule $schedule,
        string $reservationDate,
        string $windowStartTime,
        int $slot,
        string $status,
    ): Reservation {
        $windowEndTime = Carbon::createFromFormat('H:i:s', $windowStartTime)
            ->addMinutes($schedule->window_minutes)
            ->format('H:i:s');

        return Reservation::create([
            'reservation_number' => 'RSV-'.Str::upper(Str::random(12)),
            'queue_number' => in_array($status, Reservation::ACTIVE_STATUSES, true)
                ? ((int) Reservation::query()
                    ->where('doctor_clinic_schedule_id', $schedule->id)
                    ->whereDate('reservation_date', $reservationDate)
                    ->max('queue_number')) + 1
                : null,
            'queue_status' => match ($status) {
                Reservation::STATUS_COMPLETED => Reservation::QUEUE_STATUS_COMPLETED,
                Reservation::STATUS_CANCELLED, Reservation::STATUS_REJECTED => Reservation::QUEUE_STATUS_CANCELLED,
                default => Reservation::QUEUE_STATUS_WAITING,
            },
            'guest_name' => 'Walk In Report',
            'guest_phone_number' => '081234500010',
            'clinic_id' => $schedule->clinic_id,
            'doctor_id' => $schedule->doctor_id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => $windowStartTime,
            'window_end_time' => $windowEndTime,
            'window_slot_number' => $slot,
            'status' => $status,
        ]);
    }

    private function createMedicalRecord(Reservation $reservation, User $doctor, string $doctorNotes): MedicalRecord
    {
        return MedicalRecord::create([
            'reservation_id' => $reservation->id,
            'patient_id' => $reservation->patient_id,
            'guest_name' => $reservation->guest_name,
            'guest_phone_number' => $reservation->guest_phone_number,
            'clinic_id' => $reservation->clinic_id,
            'doctor_id' => $doctor->id,
            'doctor_notes' => $doctorNotes,
            'issued_at' => now(),
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function spaHeaders(): array
    {
        return [
            'Accept' => 'application/json',
            'Origin' => 'http://localhost:8000',
            'Referer' => 'http://localhost:8000/login',
        ];
    }
}



