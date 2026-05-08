<?php

namespace Tests\Feature\Web;

use App\Models\Clinic;
use App\Models\ClinicCity;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicDirectoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_clinic_and_doctor_directories_render_without_login(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-05-04 09:10:00'));

        $city = ClinicCity::firstOrCreate(['name' => 'Kota Bekasi']);
        $clinic = Clinic::create([
            'name' => 'Clinic Public Directory',
            'address' => 'Jl. Public Directory',
            'city_id' => $city->id,
            'phone_number' => '+62811112222',
            'email' => 'public-directory@example.test',
        ]);
        ClinicOperatingHour::create([
            'clinic_id' => $clinic->id,
            'day_of_week' => 1,
            'open_time' => '09:00:00',
            'close_time' => '17:00:00',
            'is_closed' => false,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
            'name' => 'Doctor Public Directory',
            'email' => 'doctor-public-directory@example.test',
        ]);
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['General'])]);
        $schedule = DoctorClinicSchedule::create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => 1,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 4,
            'is_active' => true,
        ]);
        $patient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'name' => 'Patient Public Directory',
            'email' => 'patient-public-directory@example.test',
        ]);
        $reservation = Reservation::create([
            'reservation_number' => 'RSV-PUBLIC-DIRECTORY',
            'patient_id' => $patient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => '2026-05-04',
            'window_start_time' => '09:00:00',
            'window_end_time' => '09:30:00',
            'window_slot_number' => 1,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_WAITING,
            'status' => Reservation::STATUS_APPROVED,
            'complaint' => 'Public directory integration test',
        ]);

        $clinicSlug = Str::slug($clinic->name);
        $doctorSlug = Str::slug($doctor->name);

        $this->get('/klinik')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/clinics/index')
                ->has('clinics', 1)
                ->where('clinics.0.slug', $clinicSlug)
                ->where('clinics.0.city_name', 'Kota Bekasi')
                ->where('clinics.0.specialities.0', 'General')
                ->where('filters.cities.0', 'Kota Bekasi')
                ->where('filters.specialities.0', 'General')
            );

        $this->get("/klinik/{$clinicSlug}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/clinics/show')
                ->where('clinic.id', $clinic->id)
                ->where('clinic.location', 'Jl. Public Directory, Kota Bekasi')
                ->where('clinic.doctors.0.id', $doctor->id)
                ->where('clinic.doctors.0.today_queue.booked_slots', 1)
                ->where('clinic.doctors.0.today_queue.max_slots', 4)
                ->where('clinic.window_usage.0.booked_slots', 1)
                ->where('clinic.current_reservation', null)
                ->where('clinic.schedules.0.estimated_capacity', 24)
            );

        $this->actingAs($patient)
            ->get("/klinik/{$clinicSlug}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/clinics/show')
                ->where('clinic.current_reservation.id', $reservation->id)
                ->where('clinic.current_reservation.reservation_number', 'RSV-PUBLIC-DIRECTORY')
                ->where('clinic.current_reservation.window_slot_number', 1)
            );

        $this->get('/dokter')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/doctors/index')
                ->has('doctors', 1)
                ->where('doctors.0.slug', $doctorSlug)
                ->where('doctors.0.clinics.0.slug', $clinicSlug)
                ->where('doctors.0.specialities.0', 'General')
            );

        $this->get("/dokter/{$doctorSlug}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/doctors/show')
                ->where('doctor.id', $doctor->id)
                ->where('doctor.clinics.0.id', $clinic->id)
                ->where('doctor.schedules.0.estimated_capacity', 24)
            );

        Carbon::setTestNow();
    }
}
