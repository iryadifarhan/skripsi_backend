<?php

namespace Tests\Feature\Web;

use App\Models\Clinic;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InertiaShellTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_register_page_renders_with_app_shared_props(): void
    {
        $this->get('/daftar')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('auth/register')
                ->has('app.name')
                ->where('app.name', config('app.name', 'CliniQueue'))
            );
    }

    public function test_web_login_and_register_use_session_redirects(): void
    {
        $user = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'email' => 'web-login@example.test',
            'password' => bcrypt('Password123!'),
        ]);

        $this->post('/masuk', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertRedirect('/beranda');

        $this->assertAuthenticatedAs($user);

        $this->post('/logout')->assertRedirect('/masuk');

        $this->post('/daftar', [
            'name' => 'Web Register Patient',
            'username' => 'web_register_patient',
            'email' => 'web-register@example.test',
            'phone_number' => '+628123000111',
            'date_of_birth' => '1998-01-01',
            'gender' => User::GENDER_PEREMPUAN,
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertRedirect('/beranda');

        $this->assertAuthenticated();
    }

    public function test_patient_login_respects_next_redirect_and_beranda_is_patient_only(): void
    {
        $patient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'email' => 'patient-next@example.test',
            'password' => bcrypt('Password123!'),
        ]);
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'email' => 'admin-next@example.test',
            'password' => bcrypt('Password123!'),
        ]);

        $this->get('/beranda')->assertRedirect('/masuk?next=%2Fberanda');

        $this->post('/masuk', [
            'email' => $patient->email,
            'password' => 'Password123!',
            'next' => '/reservasi',
        ])->assertRedirect('/reservasi');

        $this->assertAuthenticatedAs($patient);
        $this->post('/logout');

        $this->actingAs($admin)
            ->get('/beranda')
            ->assertRedirect('/dashboard');
    }

    public function test_legacy_query_reset_password_url_redirects_to_inertia_route(): void
    {
        $token = 'legacy-reset-token';

        $this->get('/reset-password?token='.$token.'&email=test%40example.com')
            ->assertRedirect('/reset-password/'.$token.'?email=test%40example.com');
    }

    public function test_patient_workspace_pages_render_inertia_components(): void
    {
        $user = User::factory()->create([
            'role' => User::ROLE_PATIENT,
        ]);

        $this->actingAs($user)
            ->get('/beranda')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('patient/home')
                ->where('userName', $user->name)
                ->has('clinics')
                ->has('doctors')
            );

        $this->actingAs($user)
            ->get('/reservations')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('reservations/index')
                ->where('context.role', User::ROLE_PATIENT)
            );

        $this->actingAs($user)
            ->get('/queue')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('queue/index')
                ->where('context.role', User::ROLE_PATIENT)
            );

        $this->actingAs($user)
            ->get('/medical-records')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('medical-records/index')
                ->where('context.role', User::ROLE_PATIENT)
            );
    }

    public function test_doctor_schedule_page_is_scoped_to_assigned_clinic_and_own_schedules(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Doctor Schedule Page',
            'address' => 'Jl. Doctor Schedule Page',
            'phone_number' => '+6200011123',
            'email' => 'doctor-schedule-page@example.test',
        ]);
        $otherClinic = Clinic::create([
            'name' => 'Clinic Doctor Schedule Forbidden',
            'address' => 'Jl. Doctor Schedule Forbidden',
            'phone_number' => '+6200011124',
            'email' => 'doctor-schedule-forbidden@example.test',
        ]);
        ClinicOperatingHour::create([
            'clinic_id' => $clinic->id,
            'day_of_week' => 1,
            'open_time' => '08:00:00',
            'close_time' => '17:00:00',
            'is_closed' => false,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
        $otherDoctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['General'])]);
        $otherDoctor->clinics()->attach($clinic->id, ['speciality' => null]);

        $ownSchedule = DoctorClinicSchedule::create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => 1,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 4,
            'is_active' => true,
        ]);
        DoctorClinicSchedule::create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $otherDoctor->id,
            'day_of_week' => 1,
            'start_time' => '13:00:00',
            'end_time' => '16:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 4,
            'is_active' => true,
        ]);

        $this->actingAs($doctor)
            ->get("/doctor-schedules?clinic_id={$clinic->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('doctor-schedules/index')
                ->where('context.role', User::ROLE_DOCTOR)
                ->where('doctorId', $doctor->id)
                ->where('selectedClinicId', $clinic->id)
                ->where('clinic.id', $clinic->id)
                ->has('schedules', 1)
                ->where('schedules.0.id', $ownSchedule->id)
                ->where('schedules.0.doctor_id', $doctor->id)
            );

        $this->actingAs($doctor)
            ->get("/doctor-schedules?clinic_id={$otherClinic->id}")
            ->assertForbidden();
    }

    public function test_admin_workspace_pages_include_clinic_context(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Web Context',
            'address' => 'Jl. Web Context',
            'phone_number' => '+6200011111',
            'email' => 'web-context@example.test',
        ]);

        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
        ]);

        $this->actingAs($admin)
            ->get('/queue')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('queue/index')
                ->where('context.role', User::ROLE_ADMIN)
                ->where('context.clinicId', $clinic->id)
                ->has('context.clinics', 1)
            );

        $this->actingAs($admin)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->where('context.role', User::ROLE_ADMIN)
                ->where('auth.user.clinic.id', $clinic->id)
            );
    }

    public function test_admin_dashboard_can_filter_doctor_schedules_by_day(): void
    {
        Carbon::setTestNow('2026-04-29 08:00:00');

        try {
            $clinic = Clinic::create([
                'name' => 'Clinic Dashboard Schedule Filter',
                'address' => 'Jl. Dashboard Schedule',
                'phone_number' => '+6200011199',
                'email' => 'dashboard-schedule@example.test',
            ]);
            $admin = User::factory()->create([
                'role' => User::ROLE_ADMIN,
                'clinic_id' => $clinic->id,
            ]);
            $tuesdayDoctor = User::factory()->create([
                'role' => User::ROLE_DOCTOR,
                'name' => 'Doctor Tuesday',
            ]);
            $wednesdayDoctor = User::factory()->create([
                'role' => User::ROLE_DOCTOR,
                'name' => 'Doctor Wednesday',
            ]);

            $tuesdayDoctor->clinics()->attach($clinic->id, ['speciality' => null]);
            $wednesdayDoctor->clinics()->attach($clinic->id, ['speciality' => null]);

            $tuesdaySchedule = DoctorClinicSchedule::create([
                'clinic_id' => $clinic->id,
                'doctor_id' => $tuesdayDoctor->id,
                'day_of_week' => 2,
                'start_time' => '09:00:00',
                'end_time' => '12:00:00',
                'window_minutes' => 30,
                'max_patients_per_window' => 4,
                'is_active' => true,
            ]);
            Reservation::create([
                'reservation_number' => 'RSV-DASHBOARD-SLOT-001',
                'queue_number' => 1,
                'queue_status' => Reservation::QUEUE_STATUS_WAITING,
                'patient_id' => null,
                'guest_name' => 'Dashboard Slot Patient',
                'guest_phone_number' => '+628111111111',
                'clinic_id' => $clinic->id,
                'doctor_id' => $tuesdayDoctor->id,
                'doctor_clinic_schedule_id' => $tuesdaySchedule->id,
                'reservation_date' => '2026-04-07',
                'window_start_time' => '09:00:00',
                'window_end_time' => '09:30:00',
                'window_slot_number' => 1,
                'status' => Reservation::STATUS_APPROVED,
                'complaint' => 'Dashboard slot test',
            ]);
            DoctorClinicSchedule::create([
                'clinic_id' => $clinic->id,
                'doctor_id' => $wednesdayDoctor->id,
                'day_of_week' => 3,
                'start_time' => '13:00:00',
                'end_time' => '16:00:00',
                'window_minutes' => 30,
                'max_patients_per_window' => 4,
                'is_active' => true,
            ]);

            $this->actingAs($admin)
                ->get('/dashboard?schedule_day=2')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('dashboard')
                    ->where('dashboardData.selectedScheduleDay', 2)
                    ->where('dashboardData.selectedScheduleDayLabel', 'Selasa')
                    ->where('dashboardData.selectedScheduleMonth', '2026-04')
                    ->where('dashboardData.selectedScheduleWeek', 1)
                    ->where('dashboardData.selectedScheduleDate', '2026-04-07')
                    ->has('dashboardData.schedules', 1)
                    ->where('dashboardData.schedules.0.doctor_id', $tuesdayDoctor->id)
                    ->where('dashboardData.schedules.0.slot_summary.total_windows', 6)
                    ->where('dashboardData.schedules.0.slot_summary.total_capacity', 24)
                    ->where('dashboardData.schedules.0.slot_summary.booked_slots', 1)
                    ->where('dashboardData.schedules.0.slot_summary.available_slots', 23)
                    ->where('dashboardData.schedules.0.windows.0.booked_slots', 1)
                    ->where('dashboardData.schedules.0.windows.0.available_slots', 3)
                );

            $this->actingAs($admin)
                ->get('/dashboard?schedule_day=99')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('dashboard')
                    ->where('dashboardData.selectedScheduleDay', 3)
                    ->where('dashboardData.selectedScheduleDayLabel', 'Rabu')
                    ->where('dashboardData.selectedScheduleWeek', 5)
                    ->where('dashboardData.selectedScheduleDate', '2026-04-29')
                    ->has('dashboardData.schedules', 1)
                    ->where('dashboardData.schedules.0.doctor_id', $wednesdayDoctor->id)
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_admin_doctor_pages_render_with_clinic_context(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Doctor Page',
            'address' => 'Jl. Doctor Page',
            'phone_number' => '+6200022222',
            'email' => 'doctor-page@example.test',
        ]);

        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
        $unassignedDoctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['Pediatrics'])]);
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
        DoctorClinicSchedule::create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => 0,
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 2,
            'is_active' => false,
        ]);
        $otherClinic = Clinic::create([
            'name' => 'Clinic Other Doctor Records',
            'address' => 'Jl. Other Doctor Records',
            'phone_number' => '+6200022233',
            'email' => 'other-doctor-records@example.test',
        ]);
        $otherSchedule = DoctorClinicSchedule::create([
            'clinic_id' => $otherClinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => 2,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 4,
            'is_active' => true,
        ]);
        $patient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
        ]);
        $reservation = Reservation::create([
            'reservation_number' => 'RSV-WEB-DOCTOR-RECORD',
            'patient_id' => $patient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => '2026-04-27',
            'window_start_time' => '09:00:00',
            'window_end_time' => '09:30:00',
            'window_slot_number' => 1,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'status' => Reservation::STATUS_COMPLETED,
            'complaint' => 'Scoped clinic complaint',
        ]);
        MedicalRecord::create([
            'reservation_id' => $reservation->id,
            'patient_id' => $patient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Scoped diagnosis',
            'treatment' => 'Scoped treatment',
            'prescription_notes' => 'Scoped prescription',
            'doctor_notes' => 'Scoped doctor notes',
            'issued_at' => '2026-04-27 10:00:00',
        ]);
        $otherReservation = Reservation::create([
            'reservation_number' => 'RSV-WEB-OTHER-RECORD',
            'patient_id' => $patient->id,
            'clinic_id' => $otherClinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $otherSchedule->id,
            'reservation_date' => '2026-04-28',
            'window_start_time' => '09:00:00',
            'window_end_time' => '09:30:00',
            'window_slot_number' => 1,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'status' => Reservation::STATUS_COMPLETED,
            'complaint' => 'Other clinic complaint',
        ]);
        MedicalRecord::create([
            'reservation_id' => $otherReservation->id,
            'patient_id' => $patient->id,
            'clinic_id' => $otherClinic->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Other diagnosis',
            'treatment' => 'Other treatment',
            'prescription_notes' => 'Other prescription',
            'doctor_notes' => 'Other doctor notes',
            'issued_at' => '2026-04-28 10:00:00',
        ]);

        $this->actingAs($admin)
            ->get('/doctors')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('doctors/index')
                ->where('context.role', User::ROLE_ADMIN)
                ->where('context.clinicId', $clinic->id)
                ->where('clinic.doctors.0.id', $doctor->id)
                ->where('unassignedDoctors.0.id', $unassignedDoctor->id)
                ->where('schedules.0.doctor_id', $doctor->id)
                ->where('schedules.0.day_of_week', 1)
                ->where('schedules.1.day_of_week', 0)
            );

        $this->actingAs($admin)
            ->get("/doctors/{$doctor->id}/edit?clinic_id={$clinic->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('doctors/edit')
                ->where('doctorId', $doctor->id)
                ->where('clinicId', $clinic->id)
                ->where('isClinicDoctor', true)
                ->where('schedules.0.doctor_id', $doctor->id)
                ->where('schedules.0.day_of_week', 1)
                ->where('schedules.1.day_of_week', 0)
                ->has('medicalRecords', 1)
                ->where('medicalRecords.0.reservation.reservation_number', 'RSV-WEB-DOCTOR-RECORD')
                ->where('medicalRecords.0.reservation.complaint', 'Scoped clinic complaint')
                ->where('medicalRecords.0.doctor_notes', 'Scoped doctor notes')
            );
    }

    public function test_admin_can_update_doctor_data_and_image_from_full_stack_routes(): void
    {
        Storage::fake('public');
        config(['filesystems.media_disk' => 'public']);

        $clinic = Clinic::create([
            'name' => 'Clinic Doctor Web Update',
            'address' => 'Jl. Doctor Web Update',
            'phone_number' => '+6200066666',
            'email' => 'doctor-web-update@example.test',
        ]);
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
            'username' => 'doctor-web-update',
            'email' => 'doctor-web-update-user@example.test',
        ]);
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['General'])]);

        $this->actingAs($admin)
            ->patch("/doctors/{$doctor->id}", [
                'clinic_id' => $clinic->id,
                'name' => 'Updated Doctor',
                'username' => 'updated-doctor',
                'email' => 'updated-doctor@example.test',
                'phone_number' => '+62811119999',
                'date_of_birth' => '1990-01-01',
                'gender' => User::GENDER_LAKI,
                'specialities' => ['Cardiology', 'Orthology'],
            ])
            ->assertRedirect(route('doctors.edit', [
                'doctor' => $doctor->id,
                'clinic_id' => $clinic->id,
            ]))
            ->assertSessionHas('status', 'Data dokter berhasil diperbarui.');

        $doctor->refresh();
        $this->assertSame('Updated Doctor', $doctor->name);
        $this->assertSame('updated-doctor', $doctor->username);
        $this->assertSame('updated-doctor@example.test', $doctor->email);
        $this->assertSame(['Cardiology', 'Orthology'], $doctor->clinics()->whereKey($clinic->id)->first()->pivot->speciality);

        $this->actingAs($admin)
            ->post("/doctors/{$doctor->id}/image", [
                'clinic_id' => $clinic->id,
                'image' => UploadedFile::fake()->image('doctor.jpg', 400, 400),
            ])
            ->assertRedirect(route('doctors.edit', [
                'doctor' => $doctor->id,
                'clinic_id' => $clinic->id,
            ]))
            ->assertSessionHas('status', 'Foto dokter berhasil diunggah.');

        $uploadedPath = $doctor->fresh()->image_path;

        $this->assertNotNull($uploadedPath);
        $this->assertNull($doctor->fresh()->profile_picture);
        Storage::disk('public')->assertExists($uploadedPath);

        $this->actingAs($admin)
            ->patch("/doctors/{$doctor->id}/picture", [
                'clinic_id' => $clinic->id,
                'profile_picture' => 'doctor_2',
            ])
            ->assertRedirect(route('doctors.edit', [
                'doctor' => $doctor->id,
                'clinic_id' => $clinic->id,
            ]))
            ->assertSessionHas('status', 'Avatar dokter berhasil diperbarui.');

        $doctor->refresh();
        $this->assertSame('doctor_2', $doctor->profile_picture);
        $this->assertSame($uploadedPath, $doctor->image_path);
        Storage::disk('public')->assertExists($uploadedPath);

        $this->actingAs($admin)
            ->patch("/doctors/{$doctor->id}/picture", [
                'clinic_id' => $clinic->id,
                'profile_picture' => null,
            ])
            ->assertRedirect(route('doctors.edit', [
                'doctor' => $doctor->id,
                'clinic_id' => $clinic->id,
            ]))
            ->assertSessionHas('status', 'Avatar dokter berhasil diperbarui.');

        $doctor->refresh();
        $this->assertNull($doctor->profile_picture);
        $this->assertSame($uploadedPath, $doctor->image_path);
        Storage::disk('public')->assertExists($uploadedPath);

        $this->actingAs($admin)
            ->post("/doctors/{$doctor->id}/image", [
                'clinic_id' => $clinic->id,
                'image' => UploadedFile::fake()->image('doctor-second.jpg', 400, 400),
            ])
            ->assertRedirect(route('doctors.edit', [
                'doctor' => $doctor->id,
                'clinic_id' => $clinic->id,
            ]));

        $secondUploadedPath = $doctor->fresh()->image_path;
        $this->assertNotNull($secondUploadedPath);
        Storage::disk('public')->assertExists($secondUploadedPath);
        Storage::disk('public')->assertMissing($uploadedPath);

        $this->actingAs($admin)
            ->delete("/doctors/{$doctor->id}/image", [
                'clinic_id' => $clinic->id,
            ])
            ->assertRedirect(route('doctors.edit', [
                'doctor' => $doctor->id,
                'clinic_id' => $clinic->id,
            ]))
            ->assertSessionHas('status', 'Foto upload dokter berhasil dihapus.');

        $this->assertNull($doctor->fresh()->image_path);
        Storage::disk('public')->assertMissing($secondUploadedPath);
    }

    public function test_full_stack_session_can_access_web_json_routes_without_separate_frontend_headers(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Same Origin Web',
            'address' => 'Jl. Same Origin Web',
            'phone_number' => '+6200044444',
            'email' => 'same-origin-web@example.test',
        ]);
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
        ]);

        $this->actingAs($admin)
            ->getJson("/clinic/{$clinic->id}")
            ->assertOk()
            ->assertJsonPath('id', $clinic->id);
    }

    public function test_login_session_can_access_superadmin_clinic_web_json_route_from_full_stack_page(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Superadmin Same Origin Web',
            'address' => 'Jl. Superadmin Same Origin Web',
            'phone_number' => '+6200055555',
            'email' => 'superadmin-same-origin-web@example.test',
        ]);
        $superadmin = User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
            'email' => 'superadmin-fullstack-web@example.test',
            'password' => bcrypt('Password123!'),
        ]);

        $this->postJson('/masuk', [
            'email' => $superadmin->email,
            'password' => 'Password123!',
        ])->assertOk();

        $this->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->where('auth.user.role', User::ROLE_SUPERADMIN)
            );

        $this->getJson("/clinic/{$clinic->id}")
            ->assertOk()
            ->assertJsonPath('id', $clinic->id);

        $this->getJson("/admin/reservations?clinic_id={$clinic->id}")
            ->assertOk()
            ->assertJsonPath('reservations', []);
    }

    public function test_superadmin_doctor_pages_receive_all_clinics(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Superadmin Doctor Page',
            'address' => 'Jl. Superadmin Doctor Page',
            'phone_number' => '+6200033333',
            'email' => 'superadmin-doctor-page@example.test',
        ]);
        $superadmin = User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
        ]);

        $this->actingAs($superadmin)
            ->get('/doctors')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('doctors/index')
                ->where('context.role', User::ROLE_SUPERADMIN)
                ->has('context.clinics', 1)
                ->where('context.clinics.0.id', $clinic->id)
            );
    }

    public function test_superadmin_cannot_view_medical_record_pages_or_doctor_medical_history(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Superadmin Medical Hidden',
            'address' => 'Jl. Superadmin Medical Hidden',
            'phone_number' => '+6200033399',
            'email' => 'superadmin-medical-hidden@example.test',
        ]);
        $superadmin = User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
        $doctor->clinics()->attach($clinic->id, ['speciality' => null]);
        $patient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
        ]);
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
        $reservation = Reservation::create([
            'reservation_number' => 'RSV-SUPERADMIN-HIDDEN-MEDICAL',
            'patient_id' => $patient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => '2026-04-27',
            'window_start_time' => '09:00:00',
            'window_end_time' => '09:30:00',
            'window_slot_number' => 1,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'status' => Reservation::STATUS_COMPLETED,
            'complaint' => 'Hidden medical complaint',
        ]);
        MedicalRecord::create([
            'reservation_id' => $reservation->id,
            'patient_id' => $patient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Hidden diagnosis',
            'treatment' => 'Hidden treatment',
            'doctor_notes' => 'Hidden doctor notes',
            'issued_at' => '2026-04-27 10:00:00',
        ]);

        $this->actingAs($superadmin)
            ->get("/medical-records?clinic_id={$clinic->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('medical-records/index')
                ->where('canViewMedicalRecords', false)
                ->has('medicalRecords', 0)
                ->has('doctorOptions', 0)
            );

        $this->actingAs($superadmin)
            ->getJson("/medical-records?clinic_id={$clinic->id}")
            ->assertForbidden();

        $this->actingAs($superadmin)
            ->getJson("/admin/medical-records?clinic_id={$clinic->id}")
            ->assertForbidden();

        $this->actingAs($superadmin)
            ->getJson("/reports/medical-records?clinic_id={$clinic->id}&date_from=2026-04-27&date_to=2026-04-27")
            ->assertForbidden();

        $this->actingAs($superadmin)
            ->get("/doctors/{$doctor->id}/edit?clinic_id={$clinic->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('doctors/edit')
                ->where('doctorId', $doctor->id)
                ->where('canViewMedicalRecords', false)
                ->has('medicalRecords', 0)
            );
    }

    public function test_superadmin_can_crud_global_doctor_without_managing_speciality(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Superadmin Doctor CRUD',
            'address' => 'Jl. Superadmin Doctor CRUD',
            'phone_number' => '+6200033344',
            'email' => 'superadmin-doctor-crud@example.test',
        ]);
        $superadmin = User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
        ]);

        $this->actingAs($superadmin)
            ->post('/doctors', [
                'clinic_id' => $clinic->id,
                'name' => 'Doctor Global CRUD',
                'username' => 'doctor-global-crud',
                'email' => 'doctor-global-crud@example.test',
                'phone_number' => '+62811112222',
                'date_of_birth' => '1988-01-01',
                'gender' => User::GENDER_PEREMPUAN,
                'password' => 'Password123!',
                'password_confirmation' => 'Password123!',
            ])
            ->assertRedirect();

        $doctor = User::query()
            ->where('email', 'doctor-global-crud@example.test')
            ->firstOrFail();

        $this->assertSame(User::ROLE_DOCTOR, $doctor->role);

        $this->actingAs($superadmin)
            ->patch("/admin/clinic/doctor/{$clinic->id}", [
                'doctor_id' => $doctor->id,
                'speciality' => ['Should Not Be Stored'],
            ])
            ->assertOk();

        $this->assertDatabaseHas('clinic_user', [
            'clinic_id' => $clinic->id,
            'user_id' => $doctor->id,
            'speciality' => null,
        ]);

        $this->actingAs($superadmin)
            ->patch("/doctors/{$doctor->id}", [
                'clinic_id' => $clinic->id,
                'name' => 'Doctor Global CRUD Updated',
                'username' => 'doctor-global-crud-updated',
                'email' => 'doctor-global-crud-updated@example.test',
                'phone_number' => '+62811113333',
                'date_of_birth' => '1988-02-02',
                'gender' => User::GENDER_LAKI,
                'specialities' => ['Still Ignored'],
            ])
            ->assertRedirect(route('doctors.edit', [
                'doctor' => $doctor->id,
                'clinic_id' => $clinic->id,
            ]))
            ->assertSessionHas('status', 'Data dokter berhasil diperbarui.');

        $doctor->refresh();
        $this->assertSame('Doctor Global CRUD Updated', $doctor->name);
        $this->assertDatabaseHas('clinic_user', [
            'clinic_id' => $clinic->id,
            'user_id' => $doctor->id,
            'speciality' => null,
        ]);

        $this->actingAs($superadmin)
            ->delete("/doctors/{$doctor->id}", [
                'clinic_id' => $clinic->id,
            ])
            ->assertRedirect(route('doctors.index', [
                'clinic_id' => $clinic->id,
            ]))
            ->assertSessionHas('status', 'Data dokter berhasil dihapus.');

        $this->assertDatabaseMissing('users', [
            'id' => $doctor->id,
        ]);
    }

    public function test_admin_patient_pages_are_clinic_scoped_and_walk_ins_are_grouped(): void
    {
        $clinic = Clinic::create([
            'name' => 'Clinic Patient Scope',
            'address' => 'Jl. Patient Scope',
            'phone_number' => '+6200012121',
            'email' => 'patient-scope@example.test',
        ]);
        $otherClinic = Clinic::create([
            'name' => 'Clinic Patient Other',
            'address' => 'Jl. Patient Other',
            'phone_number' => '+6200012122',
            'email' => 'patient-other@example.test',
        ]);
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
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
        $otherSchedule = DoctorClinicSchedule::create([
            'clinic_id' => $otherClinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => 1,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 4,
            'is_active' => true,
        ]);
        $clinicPatient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'name' => 'Clinic Scoped Patient',
            'email' => 'clinic-scoped-patient@example.test',
        ]);
        $otherPatient = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'name' => 'Other Clinic Patient',
            'email' => 'other-clinic-patient@example.test',
        ]);

        $reservation = Reservation::create([
            'reservation_number' => 'RSV-PATIENT-SCOPE',
            'patient_id' => $clinicPatient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => '2026-04-27',
            'window_start_time' => '09:00:00',
            'window_end_time' => '09:30:00',
            'window_slot_number' => 1,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'status' => Reservation::STATUS_COMPLETED,
            'complaint' => 'Scoped patient complaint',
        ]);
        MedicalRecord::create([
            'reservation_id' => $reservation->id,
            'patient_id' => $clinicPatient->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Scoped patient diagnosis',
            'treatment' => 'Scoped patient treatment',
            'doctor_notes' => 'Scoped patient notes',
            'issued_at' => '2026-04-27 10:00:00',
        ]);

        Reservation::create([
            'reservation_number' => 'RSV-PATIENT-OTHER',
            'patient_id' => $otherPatient->id,
            'clinic_id' => $otherClinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $otherSchedule->id,
            'reservation_date' => '2026-04-28',
            'window_start_time' => '09:00:00',
            'window_end_time' => '09:30:00',
            'window_slot_number' => 1,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_WAITING,
            'status' => Reservation::STATUS_APPROVED,
            'complaint' => 'Other clinic patient complaint',
        ]);

        $walkInReservation = Reservation::create([
            'reservation_number' => 'RSV-WALKIN-A',
            'patient_id' => null,
            'guest_name' => 'Walk In Same',
            'guest_phone_number' => '+628123456789',
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => '2026-04-27',
            'window_start_time' => '10:00:00',
            'window_end_time' => '10:30:00',
            'window_slot_number' => 1,
            'queue_number' => 2,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'status' => Reservation::STATUS_COMPLETED,
            'complaint' => 'Walk-in scoped complaint',
        ]);
        MedicalRecord::create([
            'reservation_id' => $walkInReservation->id,
            'patient_id' => null,
            'guest_name' => 'walk in same',
            'guest_phone_number' => '08123456789',
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Walk-in grouped diagnosis',
            'treatment' => 'Walk-in grouped treatment',
            'doctor_notes' => 'Walk-in grouped notes',
            'issued_at' => '2026-04-27 11:00:00',
        ]);

        $this->actingAs($admin)
            ->get('/patients')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('patients/index')
                ->where('context.role', User::ROLE_ADMIN)
                ->where('selectedClinicId', $clinic->id)
                ->has('patients', 1)
                ->where('patients.0.id', $clinicPatient->id)
                ->has('walkIns', 1)
                ->where('walkIns.0.reservation_count', 1)
                ->where('walkIns.0.medical_record_count', 1)
            );

        $this->actingAs($admin)
            ->get("/patients/{$clinicPatient->id}/edit")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('patients/edit')
                ->where('patientType', 'registered')
                ->where('patient.id', $clinicPatient->id)
                ->has('reservations', 1)
                ->where('reservations.0.reservation_number', 'RSV-PATIENT-SCOPE')
                ->has('medicalRecords', 1)
                ->where('medicalRecords.0.doctor_notes', 'Scoped patient notes')
                ->where('canEdit', false)
            );

        $this->actingAs($admin)
            ->get("/patients/{$otherPatient->id}/edit")
            ->assertNotFound();
    }

    public function test_superadmin_patient_pages_show_all_registered_patients_and_hide_medical_records(): void
    {
        Storage::fake('public');
        config(['filesystems.media_disk' => 'public']);

        $clinic = Clinic::create([
            'name' => 'Clinic Super Patient',
            'address' => 'Jl. Super Patient',
            'phone_number' => '+6200013131',
            'email' => 'super-patient@example.test',
        ]);
        $superadmin = User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
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
        $patientWithRecord = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'name' => 'Super Patient Record',
            'email' => 'super-patient-record@example.test',
        ]);
        $patientWithoutRecord = User::factory()->create([
            'role' => User::ROLE_PATIENT,
            'name' => 'Super Patient No Record',
            'email' => 'super-patient-no-record@example.test',
        ]);

        $reservation = Reservation::create([
            'reservation_number' => 'RSV-SUPER-PATIENT',
            'patient_id' => $patientWithRecord->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'doctor_clinic_schedule_id' => $schedule->id,
            'reservation_date' => '2026-04-27',
            'window_start_time' => '09:00:00',
            'window_end_time' => '09:30:00',
            'window_slot_number' => 1,
            'queue_number' => 1,
            'queue_status' => Reservation::QUEUE_STATUS_COMPLETED,
            'status' => Reservation::STATUS_COMPLETED,
            'complaint' => 'Super patient complaint',
        ]);
        MedicalRecord::create([
            'reservation_id' => $reservation->id,
            'patient_id' => $patientWithRecord->id,
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Hidden superadmin diagnosis',
            'treatment' => 'Hidden superadmin treatment',
            'doctor_notes' => 'Hidden superadmin notes',
            'issued_at' => '2026-04-27 10:00:00',
        ]);

        $this->actingAs($superadmin)
            ->get('/patients')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('patients/index')
                ->where('context.role', User::ROLE_SUPERADMIN)
                ->has('patients', 2)
                ->where('canCreate', true)
            );

        $this->actingAs($superadmin)
            ->get("/patients/{$patientWithRecord->id}/edit")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('patients/edit')
                ->where('patientType', 'registered')
                ->where('patient.id', $patientWithRecord->id)
                ->has('reservations', 1)
                ->has('medicalRecords', 0)
                ->where('canViewMedicalRecords', false)
                ->where('canEdit', true)
            );

        $this->actingAs($superadmin)
            ->patch("/patients/{$patientWithoutRecord->id}", [
                'name' => 'Super Patient Updated',
                'username' => 'super-patient-updated',
                'email' => 'super-patient-updated@example.test',
                'phone_number' => '+62811117777',
                'date_of_birth' => '1999-01-01',
                'gender' => User::GENDER_PEREMPUAN,
            ])
            ->assertRedirect(route('patients.edit', $patientWithoutRecord));

        $this->assertDatabaseHas('users', [
            'id' => $patientWithoutRecord->id,
            'name' => 'Super Patient Updated',
            'role' => User::ROLE_PATIENT,
        ]);

        $this->actingAs($superadmin)
            ->patch("/patients/{$patientWithoutRecord->id}/picture", [
                'profile_picture' => 'patient_2',
            ])
            ->assertRedirect(route('patients.edit', $patientWithoutRecord))
            ->assertSessionHas('status', 'Avatar pasien berhasil diperbarui.');

        $this->assertSame('patient_2', $patientWithoutRecord->fresh()->profile_picture);

        $this->actingAs($superadmin)
            ->post("/patients/{$patientWithoutRecord->id}/image", [
                'image' => UploadedFile::fake()->image('patient-superadmin.jpg', 400, 400),
            ])
            ->assertRedirect(route('patients.edit', $patientWithoutRecord))
            ->assertSessionHas('status', 'Foto pasien berhasil diunggah.');

        $uploadedPath = $patientWithoutRecord->fresh()->image_path;
        $this->assertNotNull($uploadedPath);
        $this->assertNull($patientWithoutRecord->fresh()->profile_picture);
        Storage::disk('public')->assertExists($uploadedPath);

        $this->actingAs($superadmin)
            ->delete("/patients/{$patientWithoutRecord->id}/image")
            ->assertRedirect(route('patients.edit', $patientWithoutRecord))
            ->assertSessionHas('status', 'Foto upload pasien berhasil dihapus.');

        $this->assertNull($patientWithoutRecord->fresh()->image_path);
        Storage::disk('public')->assertMissing($uploadedPath);
    }

    public function test_admin_can_manage_own_clinic_settings_and_doctor_schedule_from_full_stack_page(): void
    {
        Storage::fake('public');
        config(['filesystems.media_disk' => 'public']);

        $clinic = Clinic::create([
            'name' => 'Clinic Settings Admin',
            'address' => 'Jl. Clinic Settings',
            'phone_number' => '+6200077777',
            'email' => 'clinic-settings-admin@example.test',
        ]);
        ClinicOperatingHour::create([
            'clinic_id' => $clinic->id,
            'day_of_week' => 1,
            'open_time' => '08:00:00',
            'close_time' => '17:00:00',
            'is_closed' => false,
        ]);
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
        ]);
        $doctor = User::factory()->create([
            'role' => User::ROLE_DOCTOR,
        ]);
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['General'])]);

        $this->actingAs($admin)
            ->get('/clinic-settings')
            ->assertRedirect(route('clinic-settings.show', ['clinicId' => $clinic->id]));

        $this->actingAs($admin)
            ->get("/clinic-settings/{$clinic->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('clinic-settings/index')
                ->where('context.role', User::ROLE_ADMIN)
                ->where('selectedClinicId', $clinic->id)
                ->where('clinic.id', $clinic->id)
                ->where('summary.doctor_count', 1)
                ->where('summary.operating_day_count', 1)
                ->has('clinic.doctors', 1)
            );

        $this->actingAs($admin)
            ->patch("/clinic-settings/{$clinic->id}", [
                'clinic_id' => $clinic->id,
                'name' => 'Clinic Settings Admin Updated',
                'address' => 'Jl. Clinic Settings Updated',
                'phone_number' => '+6200077788',
                'email' => 'clinic-settings-admin-updated@example.test',
                'operating_hours' => [
                    [
                        'day_of_week' => 1,
                        'open_time' => '09:00:00',
                        'close_time' => '16:00:00',
                        'is_closed' => false,
                    ],
                ],
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Data klinik berhasil diperbarui.');

        $this->assertDatabaseHas('clinics', [
            'id' => $clinic->id,
            'name' => 'Clinic Settings Admin Updated',
            'email' => 'clinic-settings-admin-updated@example.test',
        ]);
        $this->assertDatabaseHas('clinic_operating_hours', [
            'clinic_id' => $clinic->id,
            'day_of_week' => 1,
            'open_time' => '09:00:00',
            'close_time' => '16:00:00',
        ]);

        $this->actingAs($admin)
            ->post("/clinic-settings/{$clinic->id}/image", [
                'clinic_id' => $clinic->id,
                'image' => UploadedFile::fake()->image('clinic-settings.png', 400, 400),
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Foto klinik berhasil diunggah.');

        Storage::disk('public')->assertExists($clinic->fresh()->image_path);

        $this->actingAs($admin)
            ->post('/clinic-settings/schedules', [
                'clinic_id' => $clinic->id,
                'doctor_id' => $doctor->id,
                'day_of_week' => [1],
                'start_time' => '10:00:00',
                'end_time' => '12:00:00',
                'window_minutes' => 30,
                'max_patients_per_window' => 4,
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Jadwal dokter berhasil dibuat.');

        $schedule = DoctorClinicSchedule::query()
            ->where('clinic_id', $clinic->id)
            ->where('doctor_id', $doctor->id)
            ->where('day_of_week', 1)
            ->firstOrFail();

        $this->actingAs($admin)
            ->patch("/clinic-settings/schedules/{$schedule->id}", [
                'clinic_id' => $clinic->id,
                'start_time' => '10:30:00',
                'end_time' => '12:30:00',
                'window_minutes' => 60,
                'max_patients_per_window' => 3,
                'is_active' => false,
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Jadwal dokter berhasil diperbarui.');

        $this->assertDatabaseHas('doctor_clinic_schedules', [
            'id' => $schedule->id,
            'start_time' => '10:30:00',
            'end_time' => '12:30:00',
            'window_minutes' => 60,
            'max_patients_per_window' => 3,
            'is_active' => false,
        ]);
    }

    public function test_superadmin_can_select_and_update_any_clinic_settings(): void
    {
        $clinicA = Clinic::create([
            'name' => 'Clinic Settings Super A',
            'address' => 'Jl. Super A',
            'phone_number' => '+6200088811',
            'email' => 'clinic-settings-super-a@example.test',
        ]);
        $clinicB = Clinic::create([
            'name' => 'Clinic Settings Super B',
            'address' => 'Jl. Super B',
            'phone_number' => '+6200088822',
            'email' => 'clinic-settings-super-b@example.test',
        ]);
        $superadmin = User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
        ]);

        $this->actingAs($superadmin)
            ->get('/clinic-settings')
            ->assertRedirect(route('clinics.index'));

        $this->actingAs($superadmin)
            ->get('/clinics')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('clinics/index')
                ->where('context.role', User::ROLE_SUPERADMIN)
                ->has('clinics', 2)
                ->where('clinics.1.id', $clinicB->id)
            );

        $this->actingAs($superadmin)
            ->get("/clinic-settings?clinic_id={$clinicB->id}")
            ->assertRedirect(route('clinic-settings.show', ['clinicId' => $clinicB->id]));

        $this->actingAs($superadmin)
            ->get("/clinic-settings/{$clinicB->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('clinic-settings/index')
                ->where('context.role', User::ROLE_SUPERADMIN)
                ->has('context.clinics', 2)
                ->where('selectedClinicId', $clinicB->id)
                ->where('clinic.id', $clinicB->id)
                ->where('summary.medical_records_this_month', null)
            );

        $this->actingAs($superadmin)
            ->patch("/clinic-settings/{$clinicA->id}", [
                'name' => 'Clinic Settings Super A Updated',
                'address' => 'Jl. Super A Updated',
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Data klinik berhasil diperbarui.');

        $this->assertDatabaseHas('clinics', [
            'id' => $clinicA->id,
            'name' => 'Clinic Settings Super A Updated',
            'address' => 'Jl. Super A Updated',
        ]);
    }

    public function test_admin_cannot_manage_other_clinic_settings(): void
    {
        $ownClinic = Clinic::create([
            'name' => 'Clinic Settings Own',
            'address' => 'Jl. Own',
            'phone_number' => '+6200099911',
            'email' => 'clinic-settings-own@example.test',
        ]);
        $otherClinic = Clinic::create([
            'name' => 'Clinic Settings Other',
            'address' => 'Jl. Other',
            'phone_number' => '+6200099922',
            'email' => 'clinic-settings-other@example.test',
        ]);
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $ownClinic->id,
        ]);

        $this->actingAs($admin)
            ->patch("/clinic-settings/{$otherClinic->id}", [
                'name' => 'Forbidden Update',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('clinics', [
            'id' => $otherClinic->id,
            'name' => 'Forbidden Update',
        ]);
    }

    public function test_legacy_workspace_aliases_redirect_to_full_stack_pages(): void
    {
        $user = User::factory()->create([
            'role' => User::ROLE_PATIENT,
        ]);

        $this->actingAs($user)
            ->get('/reservation')
            ->assertRedirect('/reservations');

        $this->actingAs($user)
            ->get('/medical_record')
            ->assertRedirect('/medical-records');
    }

    public function test_authenticated_dashboard_renders_with_auth_shared_props(): void
    {
        $user = User::factory()->create([
            'role' => User::ROLE_PATIENT,
        ]);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->where('auth.user.id', $user->id)
                ->has('modules')
            );
    }
}


