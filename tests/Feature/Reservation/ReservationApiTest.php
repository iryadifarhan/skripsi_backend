<?php

namespace Tests\Feature\Reservation;

use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReservationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('session.driver', 'database');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_patient_can_follow_booking_flow_and_create_reservation(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-flow');
        $doctor = $this->makeUser('doctor', 'doctor-flow@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser('patient', 'patient-flow@example.com');

        $this->login($patient, 'Password123!');

        $this->getJson('/api/clinics', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('clinics.0.id', $clinic->id);

        $this->getJson("/api/clinic/{$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('doctors.0.id', $doctor->id);

        $this->getJson("/api/reservations/schedules?clinic_id={$clinic->id}&doctor_id={$doctor->id}&reservation_date={$reservationDate}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('schedules.0.id', $schedule->id);

        $this->getJson("/api/reservations/booking/windows?doctor_clinic_schedule_id={$schedule->id}&reservation_date={$reservationDate}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('windows.0.window_start_time', '09:00:00')
            ->assertJsonPath('windows.0.available_slots', 4);

        $this->postJson('/api/reservations', [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
            'complaint' => 'Flu symptoms',
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('reservation.patient_id', $patient->id)
            ->assertJsonPath('reservation.clinic_id', $clinic->id)
            ->assertJsonPath('reservation.doctor_id', $doctor->id)
            ->assertJsonPath('reservation.window_start_time', '09:00:00')
            ->assertJsonPath('reservation.window_slot_number', 1)
            ->assertJsonPath('reservation.status', Reservation::STATUS_PENDING);
    }

    public function test_reservation_uses_first_empty_slot_in_time_window(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-slot');
        $doctor = $this->makeUser('doctor', 'doctor-slot@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 60, 4);

        $patientA = $this->makeUser('patient', 'patient-a@example.com');
        $patientB = $this->makeUser('patient', 'patient-b@example.com');
        $patientC = $this->makeUser('patient', 'patient-c@example.com');

        $this->createReservation($patientA, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $this->createReservation($patientB, $schedule, $reservationDate, '09:00:00', 3, Reservation::STATUS_APPROVED);

        $this->login($patientC, 'Password123!');

        $this->postJson('/api/reservations', [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('reservation.window_slot_number', 2);
    }

    public function test_patient_cannot_reserve_full_window(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-full-window');
        $doctor = $this->makeUser('doctor', 'doctor-full-window@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 60, 2);

        $patientA = $this->makeUser('patient', 'patient-full-a@example.com');
        $patientB = $this->makeUser('patient', 'patient-full-b@example.com');
        $patientC = $this->makeUser('patient', 'patient-full-c@example.com');

        $this->createReservation($patientA, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $this->createReservation($patientB, $schedule, $reservationDate, '09:00:00', 2, Reservation::STATUS_APPROVED);

        $this->login($patientC, 'Password123!');

        $this->postJson('/api/reservations', [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['window_start_time']);
    }

    public function test_patient_can_cancel_own_active_reservation(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-cancel');
        $doctor = $this->makeUser('doctor', 'doctor-cancel@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser('patient', 'patient-cancel@example.com');

        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patient, 'Password123!');

        $this->patchJson("/api/reservations/{$reservation->id}/cancel", [
            'cancellation_reason' => 'Recovered at home',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.status', Reservation::STATUS_CANCELLED)
            ->assertJsonPath('reservation.cancellation_reason', 'Recovered at home');
    }

    public function test_patient_can_list_own_reservations(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-patient-index');
        $doctor = $this->makeUser('doctor', 'doctor-patient-index@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $patient = $this->makeUser('patient', 'patient-index@example.com');
        $otherPatient = $this->makeUser('patient', 'other-patient-index@example.com');

        $ownReservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $this->createReservation($otherPatient, $schedule, $reservationDate, '10:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patient, 'Password123!');

        $this->getJson('/api/reservations', $this->spaHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'reservations')
            ->assertJsonPath('reservations.0.id', $ownReservation->id);
    }

    public function test_clinic_admin_can_manage_reservations_in_own_clinic(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-manage');
        $doctor = $this->makeUser('doctor', 'doctor-admin-manage@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-manage@example.com', $clinic->id);
        $patient = $this->makeUser('patient', 'patient-manage@example.com');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->getJson('/api/admin/reservations?clinic_id='.$clinic->id, $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservations.0.id', $reservation->id);

        $this->getJson("/api/admin/reservations/{$reservation->id}?clinic_id={$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.id', $reservation->id);

        $this->patchJson("/api/admin/reservations/{$reservation->id}", [
            'status' => Reservation::STATUS_APPROVED,
            'admin_notes' => 'Approved for first session.',
            'clinic_id' => $clinic->id,
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.status', Reservation::STATUS_APPROVED)
            ->assertJsonPath('reservation.handled_by_admin_id', $admin->id);
    }

    public function test_clinic_admin_can_list_clinic_reservations_from_general_reservations_endpoint(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-general-index');
        $doctor = $this->makeUser('doctor', 'doctor-admin-general-index@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-general-index@example.com', $clinic->id);
        $patient = $this->makeUser('patient', 'patient-general-index@example.com');

        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->getJson('/api/reservations?clinic_id='.$clinic->id, $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservations.0.id', $reservation->id);
    }

    public function test_clinic_admin_cannot_manage_other_clinic_reservation(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinicA = $this->makeClinic('clinic-a-scope');
        $clinicB = $this->makeClinic('clinic-b-scope');

        $doctorB = $this->makeUser('doctor', 'doctor-b-scope@example.com');
        $doctorB->clinics()->attach($clinicB->id);
        $scheduleB = $this->makeScheduleForDate($clinicB, $doctorB, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-scope@example.com', $clinicA->id);
        $patient = $this->makeUser('patient', 'patient-scope@example.com');
        $reservation = $this->createReservation($patient, $scheduleB, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->getJson("/api/admin/reservations/{$reservation->id}?clinic_id={$clinicA->id}", $this->spaHeaders())
            ->assertForbidden();

        $this->patchJson("/api/admin/reservations/{$reservation->id}", [
            'status' => Reservation::STATUS_APPROVED,
            'clinic_id' => $clinicA->id,
        ], $this->spaHeaders())
            ->assertForbidden();
    }

    public function test_patient_cannot_get_schedule_for_doctor_outside_selected_clinic(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinicA = $this->makeClinic('clinic-a-doctor-mismatch');
        $clinicB = $this->makeClinic('clinic-b-doctor-mismatch');

        $doctor = $this->makeUser('doctor', 'doctor-mismatch@example.com');
        $doctor->clinics()->attach($clinicB->id);
        $patient = $this->makeUser('patient', 'patient-mismatch@example.com');

        $this->login($patient, 'Password123!');

        $this->getJson("/api/reservations/schedules?clinic_id={$clinicA->id}&doctor_id={$doctor->id}&reservation_date={$reservationDate}", $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['doctor_id']);
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

    private function makeUser(string $role, string $email, ?int $clinicId = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'email' => $email,
            'password' => Hash::make('Password123!'),
            'clinic_id' => $clinicId,
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
            'patient_id' => $patient->id,
            'clinic_id' => $schedule->clinic_id,
            'doctor_id' => $schedule->doctor_id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'reservation_time' => $windowStartTime,
            'window_start_time' => $windowStartTime,
            'window_end_time' => $windowEndTime,
            'window_slot_number' => $slot,
            'status' => $status,
        ]);
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
