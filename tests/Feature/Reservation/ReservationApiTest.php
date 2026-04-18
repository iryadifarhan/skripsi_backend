<?php

namespace Tests\Feature\Reservation;

use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Notifications\ReservationStatusNotification;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
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
            ->assertJsonPath('reservation.queue_summary.number', 1)
            ->assertJsonPath('reservation.queue_summary.status', Reservation::QUEUE_STATUS_WAITING)
            ->assertJsonPath('reservation.window_start_time', '09:00:00')
            ->assertJsonPath('reservation.window_slot_number', 1)
            ->assertJsonPath('reservation.status', Reservation::STATUS_PENDING);
    }

    public function test_clinic_admin_can_create_reservation_for_existing_patient(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-assisted-booking');
        $doctor = $this->makeUser('doctor', 'doctor-admin-assisted-booking@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $admin = $this->makeUser('admin', 'admin-assisted-booking@example.com', $clinic->id);
        $patient = $this->makeUser('patient', 'patient-assisted-booking@example.com');

        $this->login($admin, 'Password123!');

        $this->postJson('/api/reservations', [
            'clinic_id' => $clinic->id,
            'patient_id' => $patient->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
            'complaint' => 'Walk-in booking handled by admin',
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('reservation.patient_id', $patient->id)
            ->assertJsonPath('reservation.queue_summary.number', 1)
            ->assertJsonPath('reservation.window_start_time', '09:00:00');
    }

    public function test_clinic_admin_can_create_walk_in_reservation_without_patient_account(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-walk-in-booking');
        $doctor = $this->makeUser('doctor', 'doctor-admin-walk-in-booking@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $admin = $this->makeUser('admin', 'admin-walk-in-booking@example.com', $clinic->id);

        $this->login($admin, 'Password123!');

        $this->postJson('/api/reservations', [
            'clinic_id' => $clinic->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
            'guest_name' => 'Walk In One',
            'guest_phone_number' => '+628123450001',
            'complaint' => 'Walk-in handled by clinic admin',
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('reservation.patient_id', null)
            ->assertJsonPath('reservation.guest_name', 'Walk In One')
            ->assertJsonPath('reservation.guest_phone_number', '+628123450001')
            ->assertJsonPath('reservation.queue_summary.number', 1);
    }

    public function test_walk_in_reservation_requires_guest_name_when_patient_id_is_missing(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-walk-in-validation');
        $doctor = $this->makeUser('doctor', 'doctor-admin-walk-in-validation@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $admin = $this->makeUser('admin', 'admin-walk-in-validation@example.com', $clinic->id);

        $this->login($admin, 'Password123!');

        $this->postJson('/api/reservations', [
            'clinic_id' => $clinic->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['guest_name']);
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
        $otherPatient = $this->makeUser('patient', 'patient-cancel-other@example.com');

        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $otherReservation = $this->createReservation($otherPatient, $schedule, $reservationDate, '10:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patient, 'Password123!');

        $this->patchJson("/api/reservations/{$reservation->id}/cancel", [
            'cancellation_reason' => 'Recovered at home',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.status', Reservation::STATUS_CANCELLED)
            ->assertJsonPath('reservation.queue_summary.number', null)
            ->assertJsonPath('reservation.cancellation_reason', 'Recovered at home');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'queue_number' => null,
            'queue_status' => Reservation::QUEUE_STATUS_CANCELLED,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $otherReservation->id,
            'queue_number' => 1,
        ]);
    }

    public function test_admin_cannot_cancel_other_clinic_reservation_through_general_cancel_route(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinicA = $this->makeClinic('clinic-cancel-scope-a');
        $clinicB = $this->makeClinic('clinic-cancel-scope-b');

        $doctorB = $this->makeUser('doctor', 'doctor-cancel-scope-b@example.com');
        $doctorB->clinics()->attach($clinicB->id);
        $scheduleB = $this->makeScheduleForDate($clinicB, $doctorB, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-cancel-scope@example.com', $clinicA->id);
        $patient = $this->makeUser('patient', 'patient-cancel-scope@example.com');
        $reservation = $this->createReservation($patient, $scheduleB, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/reservations/{$reservation->id}/cancel", [
            'clinic_id' => $clinicA->id,
            'cancellation_reason' => 'Invalid scope attempt',
        ], $this->spaHeaders())
            ->assertForbidden();
    }

    public function test_patient_can_reschedule_own_active_reservation_and_queue_lines_are_updated(): void
    {
        Notification::fake();
        Http::fake();
        $this->enableFonnte();

        $currentDate = now()->addDay();
        $reservationDate = $currentDate->toDateString();
        $nextReservationDate = $currentDate->copy()->addWeek()->toDateString();

        $clinic = $this->makeClinic('clinic-reschedule');
        $doctor = $this->makeUser('doctor', 'doctor-reschedule@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 60, 4);

        $patientA = $this->makeUser('patient', 'patient-reschedule-a@example.com');
        $patientB = $this->makeUser('patient', 'patient-reschedule-b@example.com', null, '+628123450001');
        $patientC = $this->makeUser('patient', 'patient-reschedule-c@example.com');
        $patientD = $this->makeUser('patient', 'patient-reschedule-d@example.com');

        $reservationA = $this->createReservation($patientA, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $reservationToMove = $this->createReservation($patientB, $schedule, $reservationDate, '10:00:00', 1, Reservation::STATUS_APPROVED);
        $reservationC = $this->createReservation($patientC, $schedule, $reservationDate, '11:00:00', 1, Reservation::STATUS_PENDING);
        $existingTargetReservation = $this->createReservation($patientD, $schedule, $nextReservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patientB, 'Password123!');

        $this->patchJson("/api/reservations/{$reservationToMove->id}/reschedule", [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $nextReservationDate,
            'window_start_time' => '10:00',
            'reschedule_reason' => 'Ada keperluan mendadak di jadwal sebelumnya.',
            'complaint' => 'Updated complaint after reschedule',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.id', $reservationToMove->id)
            ->assertJsonPath('reservation.reservation_date', Carbon::parse($nextReservationDate)->toJSON())
            ->assertJsonPath('reservation.window_start_time', '10:00:00')
            ->assertJsonPath('reservation.window_slot_number', 1)
            ->assertJsonPath('reservation.status', Reservation::STATUS_PENDING)
            ->assertJsonPath('reservation.complaint', 'Updated complaint after reschedule')
            ->assertJsonPath('reservation.reschedule_reason', 'Ada keperluan mendadak di jadwal sebelumnya.')
            ->assertJsonPath('reservation.queue_summary.number', 2)
            ->assertJsonPath('reservation.queue_summary.status', Reservation::QUEUE_STATUS_WAITING);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationToMove->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $nextReservationDate.' 00:00:00',
            'window_start_time' => '10:00:00',
            'window_slot_number' => 1,
            'queue_number' => 2,
            'queue_status' => Reservation::QUEUE_STATUS_WAITING,
            'status' => Reservation::STATUS_PENDING,
            'reschedule_reason' => 'Ada keperluan mendadak di jadwal sebelumnya.',
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationA->id,
            'queue_number' => 1,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationC->id,
            'queue_number' => 2,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $existingTargetReservation->id,
            'queue_number' => 1,
        ]);

        Notification::assertSentTo(
            $patientB,
            ReservationStatusNotification::class,
            fn (ReservationStatusNotification $notification): bool => $notification->eventType === 'rescheduled'
        );

        Http::assertSent(fn ($request): bool =>
            $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '628123450001'
            && $request['countryCode'] === '0'
            && str_contains((string) $request['message'], 'rescheduled')
            && str_contains((string) $request['message'], 'Ada keperluan mendadak di jadwal sebelumnya.')
        );
    }

    public function test_patient_reschedule_within_same_queue_line_resequences_queue_by_window_order(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-reschedule-same-line');
        $doctor = $this->makeUser('doctor', 'doctor-reschedule-same-line@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 60, 4);

        $patientA = $this->makeUser('patient', 'patient-reschedule-same-line-a@example.com');
        $patientB = $this->makeUser('patient', 'patient-reschedule-same-line-b@example.com');
        $patientC = $this->makeUser('patient', 'patient-reschedule-same-line-c@example.com');

        $this->createReservation($patientA, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $reservation = $this->createReservation($patientB, $schedule, $reservationDate, '10:00:00', 1, Reservation::STATUS_PENDING);
        $reservationC = $this->createReservation($patientC, $schedule, $reservationDate, '11:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patientB, 'Password123!');

        $this->patchJson("/api/reservations/{$reservation->id}/reschedule", [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '11:00',
            'reschedule_reason' => 'Ingin pindah ke slot paling akhir.',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.queue_summary.number', 3)
            ->assertJsonPath('reservation.window_start_time', '11:00:00')
            ->assertJsonPath('reservation.window_slot_number', 2)
            ->assertJsonPath('reservation.reschedule_reason', 'Ingin pindah ke slot paling akhir.');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationC->id,
            'queue_number' => 2,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'queue_number' => 3,
        ]);
    }

    public function test_reschedule_compacts_old_window_slot_numbers_after_moving_reservation(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-reschedule-window-slots');
        $doctor = $this->makeUser('doctor', 'doctor-reschedule-window-slots@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 30, 4);

        $patientA = $this->makeUser('patient', 'patient-window-slot-a@example.com');
        $patientB = $this->makeUser('patient', 'patient-window-slot-b@example.com');
        $patientC = $this->makeUser('patient', 'patient-window-slot-c@example.com');
        $patientD = $this->makeUser('patient', 'patient-window-slot-d@example.com');

        $reservationA = $this->createReservation($patientA, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $reservationToMove = $this->createReservation($patientB, $schedule, $reservationDate, '09:00:00', 2, Reservation::STATUS_PENDING);
        $reservationC = $this->createReservation($patientC, $schedule, $reservationDate, '09:00:00', 3, Reservation::STATUS_PENDING);
        $reservationD = $this->createReservation($patientD, $schedule, $reservationDate, '09:00:00', 4, Reservation::STATUS_PENDING);

        $this->login($patientB, 'Password123!');

        $this->patchJson("/api/reservations/{$reservationToMove->id}/reschedule", [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '10:00',
            'reschedule_reason' => 'Slot awal bentrok dengan agenda lain.',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.window_start_time', '10:00:00')
            ->assertJsonPath('reservation.window_slot_number', 1)
            ->assertJsonPath('reservation.reschedule_reason', 'Slot awal bentrok dengan agenda lain.');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationA->id,
            'window_start_time' => '09:00:00',
            'window_slot_number' => 1,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationC->id,
            'window_start_time' => '09:00:00',
            'window_slot_number' => 2,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservationD->id,
            'window_start_time' => '09:00:00',
            'window_slot_number' => 3,
        ]);
    }

    public function test_available_windows_can_ignore_current_reservation_during_reschedule(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-reschedule-windows');
        $doctor = $this->makeUser('doctor', 'doctor-reschedule-windows@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 60, 2);

        $patient = $this->makeUser('patient', 'patient-reschedule-windows@example.com');
        $otherPatient = $this->makeUser('patient', 'patient-reschedule-windows-other@example.com');

        $ownReservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $this->createReservation($otherPatient, $schedule, $reservationDate, '09:00:00', 2, Reservation::STATUS_PENDING);

        $this->login($patient, 'Password123!');

        $this->getJson(
            "/api/reservations/booking/windows?doctor_clinic_schedule_id={$schedule->id}&reservation_date={$reservationDate}&ignore_reservation_id={$ownReservation->id}",
            $this->spaHeaders()
        )
            ->assertOk()
            ->assertJsonPath('windows.0.available_slots', 1)
            ->assertJsonPath('windows.0.slot_numbers_available.0', 1);
    }

    public function test_patient_cannot_reschedule_other_patients_reservation(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-reschedule-forbidden');
        $doctor = $this->makeUser('doctor', 'doctor-reschedule-forbidden@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $owner = $this->makeUser('patient', 'patient-reschedule-owner@example.com');
        $intruder = $this->makeUser('patient', 'patient-reschedule-intruder@example.com');
        $reservation = $this->createReservation($owner, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($intruder, 'Password123!');

        $this->patchJson("/api/reservations/{$reservation->id}/reschedule", [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '10:00',
            'reschedule_reason' => 'Mencoba mengubah reservasi orang lain.',
        ], $this->spaHeaders())
            ->assertForbidden();
    }

    public function test_patient_reschedule_requires_reason(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-reschedule-reason-required');
        $doctor = $this->makeUser('doctor', 'doctor-reschedule-reason-required@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $patient = $this->makeUser('patient', 'patient-reschedule-reason-required@example.com');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patient, 'Password123!');

        $this->patchJson("/api/reservations/{$reservation->id}/reschedule", [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '10:00',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reschedule_reason']);
    }

    public function test_patient_cannot_reschedule_to_full_window(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-reschedule-full-window');
        $doctor = $this->makeUser('doctor', 'doctor-reschedule-full-window@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate, 60, 2);

        $patientA = $this->makeUser('patient', 'patient-reschedule-full-a@example.com');
        $patientB = $this->makeUser('patient', 'patient-reschedule-full-b@example.com');
        $patientC = $this->makeUser('patient', 'patient-reschedule-full-c@example.com');

        $this->createReservation($patientA, $schedule, $reservationDate, '10:00:00', 1, Reservation::STATUS_PENDING);
        $this->createReservation($patientB, $schedule, $reservationDate, '10:00:00', 2, Reservation::STATUS_PENDING);
        $reservation = $this->createReservation($patientC, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patientC, 'Password123!');

        $this->patchJson("/api/reservations/{$reservation->id}/reschedule", [
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '10:00',
            'reschedule_reason' => 'Ingin pindah, tetapi slot tujuan sudah penuh.',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['window_start_time']);
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
        $ownReservation->update([
            'reschedule_reason' => 'Butuh pindah ke jam lain.',
        ]);
        $this->createReservation($otherPatient, $schedule, $reservationDate, '10:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($patient, 'Password123!');

        $this->getJson('/api/reservations', $this->spaHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'reservations')
            ->assertJsonPath('reservations.0.id', $ownReservation->id)
            ->assertJsonPath('reservations.0.reschedule_reason', 'Butuh pindah ke jam lain.');
    }

    public function test_clinic_admin_can_manage_reservations_in_own_clinic(): void
    {
        Notification::fake();
        Http::fake();
        $this->enableFonnte();

        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-manage');
        $doctor = $this->makeUser('doctor', 'doctor-admin-manage@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-manage@example.com', $clinic->id);
        $patient = $this->makeUser('patient', 'patient-manage@example.com', null, '081234500002');
        $patient->update(['gender' => User::GENDER_LAKI]);
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->getJson('/api/admin/reservations?clinic_id='.$clinic->id, $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservations.0.id', $reservation->id)
            ->assertJsonPath('reservations.0.patient.gender', User::GENDER_LAKI);

        $this->getJson("/api/admin/reservations/{$reservation->id}?clinic_id={$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.id', $reservation->id)
            ->assertJsonPath('reservation.patient.gender', User::GENDER_LAKI);

        $this->patchJson("/api/admin/reservations/{$reservation->id}", [
            'status' => Reservation::STATUS_APPROVED,
            'admin_notes' => 'Approved for first session.',
            'clinic_id' => $clinic->id,
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.status', Reservation::STATUS_APPROVED)
            ->assertJsonPath('reservation.handled_by_admin_id', $admin->id);

        Notification::assertSentTo(
            $patient,
            ReservationStatusNotification::class,
            fn (ReservationStatusNotification $notification): bool => $notification->eventType === Reservation::STATUS_APPROVED
        );

        Http::assertSent(fn ($request): bool =>
            $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '081234500002'
            && $request['countryCode'] === '62'
            && str_contains((string) $request['message'], 'approved')
        );
    }

    public function test_clinic_admin_can_update_reservation_details_and_reschedule_it(): void
    {
        Notification::fake();
        Http::fake();
        $this->enableFonnte();

        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-detail-update');
        $doctorA = $this->makeUser('doctor', 'doctor-admin-detail-update-a@example.com');
        $doctorB = $this->makeUser('doctor', 'doctor-admin-detail-update-b@example.com');
        $doctorA->clinics()->attach($clinic->id);
        $doctorB->clinics()->attach($clinic->id);
        $scheduleA = $this->makeScheduleForDate($clinic, $doctorA, $reservationDate);
        $scheduleB = $this->makeScheduleForDate($clinic, $doctorB, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-detail-update@example.com', $clinic->id);
        $linkedPatient = $this->makeUser('patient', 'patient-detail-update@example.com', null, '081234500007');
        $otherPatientOldLine = $this->makeUser('patient', 'patient-detail-update-old-line@example.com');
        $otherPatientNewLine = $this->makeUser('patient', 'patient-detail-update-new-line@example.com');

        $this->login($admin, 'Password123!');

        $createResponse = $this->postJson('/api/reservations', [
            'clinic_id' => $clinic->id,
            'doctor_clinic_schedule_id' => $scheduleA->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '09:00',
            'guest_name' => 'Walk In One',
            'guest_phone_number' => '081234500008',
            'complaint' => 'Initial walk-in complaint',
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('reservation.patient_id', null);

        $reservationId = (int) $createResponse->json('reservation.id');
        $walkInReservation = Reservation::findOrFail($reservationId);

        $oldLineReservation = $this->createReservation($otherPatientOldLine, $scheduleA, $reservationDate, '09:00:00', 2, Reservation::STATUS_PENDING);
        $existingTargetReservation = $this->createReservation($otherPatientNewLine, $scheduleB, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->patchJson("/api/admin/reservations/{$walkInReservation->id}/details", [
            'clinic_id' => $clinic->id,
            'patient_id' => $linkedPatient->id,
            'doctor_id' => $doctorB->id,
            'doctor_clinic_schedule_id' => $scheduleB->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => '10:00',
            'complaint' => 'Updated complaint by admin',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.patient_id', $linkedPatient->id)
            ->assertJsonPath('reservation.guest_name', null)
            ->assertJsonPath('reservation.guest_phone_number', null)
            ->assertJsonPath('reservation.doctor_id', $doctorB->id)
            ->assertJsonPath('reservation.doctor_clinic_schedule_id', $scheduleB->id)
            ->assertJsonPath('reservation.window_start_time', '10:00:00')
            ->assertJsonPath('reservation.window_slot_number', 1)
            ->assertJsonPath('reservation.queue_summary.number', 2)
            ->assertJsonPath('reservation.reschedule_reason', null)
            ->assertJsonPath('reservation.complaint', 'Updated complaint by admin');

        $this->assertDatabaseHas('reservations', [
            'id' => $walkInReservation->id,
            'patient_id' => $linkedPatient->id,
            'guest_name' => null,
            'guest_phone_number' => null,
            'doctor_id' => $doctorB->id,
            'doctor_clinic_schedule_id' => $scheduleB->id,
            'window_start_time' => '10:00:00',
            'window_slot_number' => 1,
            'queue_number' => 2,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $oldLineReservation->id,
            'queue_number' => 1,
            'window_slot_number' => 1,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $existingTargetReservation->id,
            'queue_number' => 1,
        ]);

        Notification::assertSentTo(
            $linkedPatient,
            ReservationStatusNotification::class,
            fn (ReservationStatusNotification $notification): bool => $notification->eventType === 'rescheduled'
        );

        Http::assertSent(fn ($request): bool =>
            $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '081234500007'
            && $request['countryCode'] === '62'
            && str_contains((string) $request['message'], 'rescheduled')
        );
    }

    public function test_clinic_admin_must_select_matching_schedule_when_changing_doctor(): void
    {
        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-doctor-change-validation');
        $doctorA = $this->makeUser('doctor', 'doctor-admin-doctor-change-a@example.com');
        $doctorB = $this->makeUser('doctor', 'doctor-admin-doctor-change-b@example.com');
        $doctorA->clinics()->attach($clinic->id);
        $doctorB->clinics()->attach($clinic->id);
        $scheduleA = $this->makeScheduleForDate($clinic, $doctorA, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-doctor-change-validation@example.com', $clinic->id);
        $patient = $this->makeUser('patient', 'patient-doctor-change-validation@example.com');
        $reservation = $this->createReservation($patient, $scheduleA, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/reservations/{$reservation->id}/details", [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctorB->id,
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['doctor_clinic_schedule_id']);
    }

    public function test_clinic_admin_cancel_sends_cancellation_notifications(): void
    {
        Notification::fake();
        Http::fake();
        $this->enableFonnte();

        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-admin-cancel-notify');
        $doctor = $this->makeUser('doctor', 'doctor-admin-cancel-notify@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-cancel-notify@example.com', $clinic->id);
        $patient = $this->makeUser('patient', 'patient-cancel-notify@example.com', null, '081234500006');
        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/reservations/{$reservation->id}", [
            'clinic_id' => $clinic->id,
            'status' => Reservation::STATUS_CANCELLED,
            'cancellation_reason' => 'Doctor unavailable.',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.status', Reservation::STATUS_CANCELLED)
            ->assertJsonPath('reservation.queue_summary.number', null)
            ->assertJsonPath('reservation.cancellation_reason', 'Doctor unavailable.');

        Notification::assertSentTo(
            $patient,
            ReservationStatusNotification::class,
            fn (ReservationStatusNotification $notification): bool => $notification->eventType === Reservation::STATUS_CANCELLED
        );

        Http::assertSent(fn ($request): bool =>
            $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '081234500006'
            && $request['countryCode'] === '62'
            && str_contains((string) $request['message'], 'cancelled')
            && str_contains((string) $request['message'], 'Doctor unavailable.')
        );
    }

    public function test_rejected_reservation_is_removed_from_active_queue_views(): void
    {
        Notification::fake();
        Http::fake();
        $this->enableFonnte();

        $reservationDate = now()->addDay()->toDateString();
        $clinic = $this->makeClinic('clinic-rejected-queue');
        $doctor = $this->makeUser('doctor', 'doctor-rejected-queue@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $admin = $this->makeUser('admin', 'admin-rejected-queue@example.com', $clinic->id);
        $patient = $this->makeUser('patient', 'patient-rejected-queue@example.com', null, '+628123450003');
        $otherPatient = $this->makeUser('patient', 'patient-rejected-other@example.com');

        $reservation = $this->createReservation($patient, $schedule, $reservationDate, '09:00:00', 1, Reservation::STATUS_PENDING);
        $otherReservation = $this->createReservation($otherPatient, $schedule, $reservationDate, '10:00:00', 1, Reservation::STATUS_PENDING);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/reservations/{$reservation->id}", [
            'clinic_id' => $clinic->id,
            'status' => Reservation::STATUS_REJECTED,
            'admin_notes' => 'Rejected after validation.',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('reservation.status', Reservation::STATUS_REJECTED)
            ->assertJsonPath('reservation.queue_summary.number', null)
            ->assertJsonPath('reservation.queue_summary.status', Reservation::QUEUE_STATUS_CANCELLED);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => Reservation::STATUS_REJECTED,
            'queue_status' => Reservation::QUEUE_STATUS_CANCELLED,
            'queue_number' => null,
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $otherReservation->id,
            'queue_number' => 1,
        ]);

        Notification::assertSentTo(
            $patient,
            ReservationStatusNotification::class,
            fn (ReservationStatusNotification $notification): bool => $notification->eventType === Reservation::STATUS_REJECTED
        );

        Http::assertSent(fn ($request): bool =>
            $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '628123450003'
            && $request['countryCode'] === '0'
            && str_contains((string) $request['message'], 'rejected')
        );
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

    private function makeUser(string $role, string $email, ?int $clinicId = null, ?string $phoneNumber = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'email' => $email,
            'phone_number' => $phoneNumber ?? ('+628'.random_int(100000000, 999999999)),
            'password' => Hash::make('Password123!'),
            'clinic_id' => $clinicId,
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
        string $status,
    ): Reservation {
        $windowEndTime = Carbon::createFromFormat('H:i:s', $windowStartTime)
            ->addMinutes($schedule->window_minutes)
            ->format('H:i:s');

        return Reservation::create([
            'reservation_number' => 'RSV-'.Str::upper(Str::random(12)),
            'queue_number' => ((int) Reservation::query()
                ->where('doctor_clinic_schedule_id', $schedule->id)
                ->whereDate('reservation_date', $reservationDate)
                ->max('queue_number')) + 1,
            'queue_status' => in_array($status, Reservation::ACTIVE_STATUSES, true)
                ? Reservation::QUEUE_STATUS_WAITING
                : ($status === Reservation::STATUS_COMPLETED
                    ? Reservation::QUEUE_STATUS_COMPLETED
                    : Reservation::QUEUE_STATUS_CANCELLED),
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
