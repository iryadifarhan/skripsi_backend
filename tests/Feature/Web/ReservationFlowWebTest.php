<?php

namespace Tests\Feature\Web;

use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ReservationFlowWebTest extends TestCase
{
    use RefreshDatabase;

    public function test_patient_can_book_reservation_from_full_stack_route(): void
    {
        [$clinic, $doctor, , $patient, $schedule, $reservationDate] = $this->seedClinicFlow();

        $this->actingAs($patient)
            ->get('/reservations')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('reservations/index')
                ->where('booking.selectedClinicId', $clinic->id)
                ->where('booking.selectedDoctorId', $doctor->id)
            );

        $this->actingAs($patient)
            ->post('/reservations', [
                'doctor_clinic_schedule_id' => $schedule->id,
                'reservation_date' => $reservationDate,
                'window_start_time' => '09:00',
                'complaint' => 'Demam ringan',
            ])
            ->assertRedirect('/reservations')
            ->assertSessionHas('status', 'Reservasi berhasil dibuat dan menunggu approval admin klinik.');

        $reservation = Reservation::query()->firstOrFail();

        $this->assertSame($patient->id, $reservation->patient_id);
        $this->assertSame($clinic->id, $reservation->clinic_id);
        $this->assertSame($doctor->id, $reservation->doctor_id);
        $this->assertSame(Reservation::STATUS_PENDING, $reservation->status);
        $this->assertSame(Reservation::QUEUE_STATUS_WAITING, $reservation->queue_status);
        $this->assertSame(1, $reservation->queue_number);
        $this->assertSame(1, $reservation->window_slot_number);
    }

    public function test_clinic_admin_can_approve_reservation_from_full_stack_route(): void
    {
        Notification::fake();
        Bus::fake();

        [$clinic, $doctor, $admin, $patient, $schedule, $reservationDate] = $this->seedClinicFlow();
        $reservation = $this->createReservation($clinic, $doctor, $patient, $schedule, $reservationDate, 1, status: Reservation::STATUS_PENDING);

        $this->actingAs($admin)
            ->patch("/reservations/{$reservation->id}/process", [
                'clinic_id' => $clinic->id,
                'status' => Reservation::STATUS_APPROVED,
                'admin_notes' => 'Approved from test.',
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Status reservasi berhasil diproses.');

        $reservation->refresh();

        $this->assertSame(Reservation::STATUS_APPROVED, $reservation->status);
        $this->assertSame($admin->id, $reservation->handled_by_admin_id);
        $this->assertNotNull($reservation->handled_at);
    }

    public function test_clinic_admin_can_manage_queue_from_full_stack_route(): void
    {
        Notification::fake();
        Bus::fake();

        [$clinic, $doctor, $admin, $patient, $schedule, $reservationDate] = $this->seedClinicFlow();
        $first = $this->createReservation($clinic, $doctor, $patient, $schedule, $reservationDate, 1, '09:00:00', 1);
        $secondPatient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'email' => 'second-patient@example.test',
        ]);
        $second = $this->createReservation($clinic, $doctor, $secondPatient, $schedule, $reservationDate, 2, '09:30:00', 1);

        $this->actingAs($admin)
            ->patch("/queue/{$second->id}", [
                'clinic_id' => $clinic->id,
                'queue_number' => 1,
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Antrean berhasil diperbarui.');

        $this->assertSame(2, $first->fresh()->queue_number);
        $this->assertSame(1, $second->fresh()->queue_number);

        $this->actingAs($admin)
            ->patch("/queue/{$second->id}", [
                'clinic_id' => $clinic->id,
                'queue_status' => Reservation::QUEUE_STATUS_CALLED,
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Antrean berhasil diperbarui.');

        $this->assertSame(Reservation::QUEUE_STATUS_CALLED, $second->fresh()->queue_status);
    }

    /**
     * @return array{Clinic, User, User, User, DoctorClinicSchedule, string}
     */
    private function seedClinicFlow(): array
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Flow Web',
            'address' => 'Jl. Flow Web',
            'phone_number' => '+620009999',
            'email' => 'flow-web@example.test',
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
            'email' => 'flow-doctor@example.test',
        ]);
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['General'])]);
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
            'email' => 'flow-admin@example.test',
        ]);
        $patient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'email' => 'flow-patient@example.test',
        ]);
        $reservationDate = Carbon::today()->next(Carbon::MONDAY)->toDateString();
        $schedule = DoctorClinicSchedule::create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => Carbon::parse($reservationDate)->dayOfWeek,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 2,
            'is_active' => true,
        ]);

        return [$clinic, $doctor, $admin, $patient, $schedule, $reservationDate];
    }

    private function createReservation(
        Clinic $clinic,
        User $doctor,
        User $patient,
        DoctorClinicSchedule $schedule,
        string $reservationDate,
        int $queueNumber,
        string $windowStartTime = '09:00:00',
        int $windowSlotNumber = 1,
        string $status = Reservation::STATUS_APPROVED,
    ): Reservation {
        return Reservation::create([
            'reservation_number' => 'RSV-'.now()->format('Ymd').'-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT),
            'queue_number' => $queueNumber,
            'queue_status' => Reservation::QUEUE_STATUS_WAITING,
            'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_DERIVED,
            'patient_id' => $patient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => $reservationDate,
            'window_start_time' => $windowStartTime,
            'window_end_time' => Carbon::createFromFormat('H:i:s', $windowStartTime)->addMinutes(30)->format('H:i:s'),
            'window_slot_number' => $windowSlotNumber,
            'status' => $status,
            'complaint' => 'Test complaint',
        ]);
    }
}

