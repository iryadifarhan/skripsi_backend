<?php

namespace Tests\Feature\Queue;

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

class QueueApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('session.driver', 'database');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_patient_can_check_own_queue_status(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-queue-patient');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-queue-patient@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $patientAhead = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-ahead@example.com');
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-owner@example.com');
        $this->createReservation($patientAhead, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_CALLED);
        $ownReservation = $this->createReservation($patient, $schedule, $reservationDate, '10:00:00', 1, 2, Reservation::QUEUE_STATUS_WAITING);
        $this->createReservation($patient, $schedule, $reservationDate, '11:00:00', 1, 3, Reservation::QUEUE_STATUS_CANCELLED);

        $this->login($patient, 'Password123!');

        $this->getJson('/api/queues/my?reservation_date='.$reservationDate, $this->spaHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'queues')
            ->assertJsonPath('queues.0.reservation_id', $ownReservation->id)
            ->assertJsonPath('queues.0.queue.number', 2)
            ->assertJsonPath('queues.0.queue.current_called_number', 1)
            ->assertJsonPath('queues.0.queue.waiting_ahead', 1);
    }

    public function test_admin_can_view_and_reorder_clinic_queue(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-queue-admin');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-queue-admin@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-queue@example.com', $clinic->id);
        $patientOne = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-one@example.com');
        $patientTwo = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-two@example.com');

        $firstReservation = $this->createReservation($patientOne, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_WAITING);
        $secondReservation = $this->createReservation($patientTwo, $schedule, $reservationDate, '10:00:00', 1, 2, Reservation::QUEUE_STATUS_WAITING);

        $this->login($admin, 'Password123!');

        $this->getJson('/api/admin/queues?clinic_id='.$clinic->id.'&reservation_date='.$reservationDate, $this->spaHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'queues');

        $this->patchJson("/api/admin/queues/{$secondReservation->id}", [
            'clinic_id' => $clinic->id,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_CALLED,
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('queue.reservation_id', $secondReservation->id)
            ->assertJsonPath('queue.queue.number', 1)
            ->assertJsonPath('queue.queue.status', Reservation::QUEUE_STATUS_CALLED)
            ->assertJsonPath('queue.queue.current_called_number', 1);

        $this->assertDatabaseHas('reservations', [
            'id' => $secondReservation->id,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_CALLED,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $firstReservation->id,
            'queue_number' => 2,
        ]);
    }

    public function test_manual_queue_override_persists_when_new_reservation_is_created(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-queue-manual-persist');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-queue-manual-persist@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 60, 2);

        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-queue-manual-persist@example.com', $clinic->id);
        $patientA = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-manual-a@example.com');
        $patientB = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-manual-b@example.com');
        $patientC = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-manual-c@example.com');
        $patientD = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-manual-d@example.com');

        $reservationA = $this->createReservation($patientA, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_WAITING);
        $reservationB = $this->createReservation($patientB, $schedule, $reservationDate, '10:00:00', 1, 2, Reservation::QUEUE_STATUS_WAITING);
        $reservationC = $this->createReservation($patientC, $schedule, $reservationDate, '11:00:00', 1, 3, Reservation::QUEUE_STATUS_WAITING);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/queues/{$reservationC->id}", [
            'clinic_id' => $clinic->id,
            'queue_number' => 1,
        ], $this->spaHeaders())
            ->assertOk();

        $this->postJson('/api/reservations', [
            'clinic_id' => $clinic->id,
            'patient_id' => $patientD->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('reservation.queue_summary.number', 4);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationC->id,
            'queue_number' => 1,
            'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_MANUAL,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationA->id,
            'queue_number' => 2,
            'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_MANUAL,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationB->id,
            'queue_number' => 3,
            'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_MANUAL,
        ]);
    }

    public function test_admin_can_complete_queue_entry_and_reservation_is_completed(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-queue-complete');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-queue-complete@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-queue-complete@example.com', $clinic->id);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-complete@example.com');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_IN_PROGRESS);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/queues/{$reservation->id}", [
            'clinic_id' => $clinic->id,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('queue.queue.status', Reservation::QUEUE_STATUS_COMPLETED)
            ->assertJsonPath('queue.queue.number', null);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => Reservation::STATUS_COMPLETED,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'queue_number' => null,
        ]);
    }

    public function test_doctor_can_check_current_queue_for_owned_schedule(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-queue-doctor');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-queue-view@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $patientCurrent = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-current@example.com');
        $patientNext = $this->makeUser(User::ROLE_PATIENT, 'patient-queue-next@example.com');

        $currentReservation = $this->createReservation($patientCurrent, $schedule, $reservationDate, '09:00:00', 1, 1, Reservation::QUEUE_STATUS_IN_PROGRESS);
        $this->createReservation($patientNext, $schedule, $reservationDate, '10:00:00', 1, 2, Reservation::QUEUE_STATUS_WAITING);

        $this->login($doctor, 'Password123!');

        $this->getJson(
            '/api/doctor/queues?clinic_id='.$clinic->id
            .'&reservation_date='.$reservationDate
            .'&doctor_clinic_schedule_id='.$schedule->id,
            $this->spaHeaders()
        )
            ->assertOk()
            ->assertJsonCount(2, 'queues')
            ->assertJsonPath('queues.0.reservation_id', $currentReservation->id)
            ->assertJsonPath('queues.0.queue.status', Reservation::QUEUE_STATUS_IN_PROGRESS)
            ->assertJsonPath('queues.0.queue.is_current', true);
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
        int $queueNumber,
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
