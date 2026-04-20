<?php

namespace Tests\Feature\Reservation;

use App\Jobs\SendWhatsAppNotificationJob;
use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Notifications\ReservationReminderNotification;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReservationReminderCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('app.timezone', 'Asia/Bangkok');
        config()->set('session.driver', 'database');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_reminder_command_sends_email_and_whatsapp_for_registered_patient_within_less_than_two_hours(): void
    {
        Notification::fake();
        Queue::fake();
        $this->enableFonnte();

        $now = CarbonImmutable::create(2026, 4, 20, 8, 0, 0, 'Asia/Bangkok');
        CarbonImmutable::setTestNow($now);
        Carbon::setTestNow($now);

        $reservationDate = $now->toDateString();
        $clinic = $this->makeClinic('clinic-reminder-registered');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-reminder-registered@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-reminder-registered@example.com', '+628123450110');

        $reservation = $this->createReservation(
            patient: $patient,
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '09:30:00',
            slot: 1,
            queueNumber: 1,
            status: Reservation::STATUS_APPROVED,
        );

        $this->artisan('reservations:send-reminders')
            ->expectsOutput('Reservation reminders dispatched: 1')
            ->assertExitCode(0);

        Notification::assertSentToTimes($patient, ReservationReminderNotification::class, 1);
        Queue::assertPushed(SendWhatsAppNotificationJob::class, fn (SendWhatsAppNotificationJob $job): bool =>
            $job->reservationId === $reservation->id
            && $job->phoneNumber === '+628123450110'
            && str_contains($job->message, 'less than 2 hours')
        );

        $this->assertNotNull($reservation->fresh()->reminder_sent_at);

        $this->artisan('reservations:send-reminders')
            ->expectsOutput('Reservation reminders dispatched: 0')
            ->assertExitCode(0);

        Notification::assertSentToTimes($patient, ReservationReminderNotification::class, 1);
        Queue::assertPushedTimes(SendWhatsAppNotificationJob::class, 1);
    }

    public function test_reminder_command_sends_whatsapp_only_for_walk_in_with_guest_phone_number(): void
    {
        Notification::fake();
        Queue::fake();
        $this->enableFonnte();

        $now = CarbonImmutable::create(2026, 4, 20, 8, 0, 0, 'Asia/Bangkok');
        CarbonImmutable::setTestNow($now);
        Carbon::setTestNow($now);

        $reservationDate = $now->toDateString();
        $clinic = $this->makeClinic('clinic-reminder-walk-in');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-reminder-walk-in@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);

        $reservation = $this->createWalkInReservation(
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '09:15:00',
            slot: 1,
            queueNumber: 1,
            guestName: 'Walk In Reminder',
            guestPhoneNumber: '+628123450120',
        );

        $this->artisan('reservations:send-reminders')
            ->expectsOutput('Reservation reminders dispatched: 1')
            ->assertExitCode(0);

        Notification::assertNothingSent();
        Queue::assertPushed(SendWhatsAppNotificationJob::class, fn (SendWhatsAppNotificationJob $job): bool =>
            $job->reservationId === $reservation->id
            && $job->phoneNumber === '+628123450120'
        );

        $this->assertNotNull($reservation->fresh()->reminder_sent_at);
    }

    public function test_reminder_command_falls_back_to_email_only_when_patient_has_no_phone_number(): void
    {
        Notification::fake();
        Queue::fake();
        $this->enableFonnte();

        $now = CarbonImmutable::create(2026, 4, 20, 8, 0, 0, 'Asia/Bangkok');
        CarbonImmutable::setTestNow($now);
        Carbon::setTestNow($now);

        $reservationDate = $now->toDateString();
        $clinic = $this->makeClinic('clinic-reminder-email-only');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-reminder-email-only@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-reminder-email-only@example.com', null);

        $reservation = $this->createReservation(
            patient: $patient,
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '09:00:00',
            slot: 1,
            queueNumber: 1,
            status: Reservation::STATUS_APPROVED,
        );

        $this->artisan('reservations:send-reminders')
            ->expectsOutput('Reservation reminders dispatched: 1')
            ->assertExitCode(0);

        Notification::assertSentToTimes($patient, ReservationReminderNotification::class, 1);
        Queue::assertNothingPushed();
        $this->assertNotNull($reservation->fresh()->reminder_sent_at);
    }

    public function test_reminder_command_skips_non_eligible_or_unreachable_reservations(): void
    {
        Notification::fake();
        Queue::fake();
        $this->enableFonnte();

        $now = CarbonImmutable::create(2026, 4, 20, 8, 0, 0, 'Asia/Bangkok');
        CarbonImmutable::setTestNow($now);
        Carbon::setTestNow($now);

        $reservationDate = $now->toDateString();
        $clinic = $this->makeClinic('clinic-reminder-skips');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-reminder-skips@example.com');
        $doctor->clinics()->attach($clinic->id);
        $schedule = $this->makeScheduleForDate($clinic, $doctor, $reservationDate);
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-reminder-skips@example.com', '+628123450130');

        $pendingReservation = $this->createReservation(
            patient: $patient,
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '09:00:00',
            slot: 1,
            queueNumber: 1,
            status: Reservation::STATUS_PENDING,
        );

        $exactTwoHoursReservation = $this->createReservation(
            patient: $patient,
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '10:00:00',
            slot: 2,
            queueNumber: 2,
            status: Reservation::STATUS_APPROVED,
        );

        $walkInWithoutPhone = $this->createWalkInReservation(
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '09:30:00',
            slot: 3,
            queueNumber: 3,
            guestName: 'Walk In No Phone',
            guestPhoneNumber: null,
        );

        $alreadyReminded = $this->createReservation(
            patient: $patient,
            schedule: $schedule,
            reservationDate: $reservationDate,
            windowStartTime: '09:45:00',
            slot: 4,
            queueNumber: 4,
            status: Reservation::STATUS_APPROVED,
        );
        $alreadyReminded->update([
            'reminder_sent_at' => $now->subMinutes(10),
        ]);

        $this->artisan('reservations:send-reminders')
            ->expectsOutput('Reservation reminders dispatched: 0')
            ->assertExitCode(0);

        Notification::assertNothingSent();
        Queue::assertNothingPushed();

        $this->assertNull($pendingReservation->fresh()->reminder_sent_at);
        $this->assertNull($exactTwoHoursReservation->fresh()->reminder_sent_at);
        $this->assertNull($walkInWithoutPhone->fresh()->reminder_sent_at);
        $this->assertNotNull($alreadyReminded->fresh()->reminder_sent_at);
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

    private function makeUser(string $role, string $email, ?string $phoneNumber = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'email' => $email,
            'phone_number' => $phoneNumber,
            'password' => Hash::make('Password123!'),
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
        int $windowMinutes = 30,
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
        string $status,
    ): Reservation {
        $windowEndTime = Carbon::createFromFormat('H:i:s', $windowStartTime)
            ->addMinutes($schedule->window_minutes)
            ->format('H:i:s');

        return Reservation::create([
            'reservation_number' => 'RSV-'.Str::upper(Str::random(12)),
            'queue_number' => $queueNumber,
            'queue_status' => Reservation::QUEUE_STATUS_WAITING,
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
        int $queueNumber,
        string $guestName,
        ?string $guestPhoneNumber,
    ): Reservation {
        $windowEndTime = Carbon::createFromFormat('H:i:s', $windowStartTime)
            ->addMinutes($schedule->window_minutes)
            ->format('H:i:s');

        return Reservation::create([
            'reservation_number' => 'RSV-'.Str::upper(Str::random(12)),
            'queue_number' => $queueNumber,
            'queue_status' => Reservation::QUEUE_STATUS_WAITING,
            'patient_id' => null,
            'guest_name' => $guestName,
            'guest_phone_number' => $guestPhoneNumber,
            'clinic_id' => $schedule->clinic_id,
            'doctor_id' => $schedule->doctor_id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => $windowStartTime,
            'window_end_time' => $windowEndTime,
            'window_slot_number' => $slot,
            'status' => Reservation::STATUS_APPROVED,
        ]);
    }
}
