<?php

namespace Tests\Feature\Web;

use App\Models\Clinic;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\User;
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
        $this->get('/register')
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
            'email' => 'web-login@example.test',
            'password' => bcrypt('Password123!'),
        ]);

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs($user);

        $this->post('/logout')->assertRedirect('/login');

        $this->post('/register', [
            'name' => 'Web Register Patient',
            'username' => 'web_register_patient',
            'email' => 'web-register@example.test',
            'phone_number' => '+628123000111',
            'date_of_birth' => '1998-01-01',
            'gender' => User::GENDER_PEREMPUAN,
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertRedirect('/dashboard');

        $this->assertAuthenticated();
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
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['Pediatrics'])]);

        $this->actingAs($admin)
            ->get('/doctors')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('doctors/index')
                ->where('context.role', User::ROLE_ADMIN)
                ->where('context.clinicId', $clinic->id)
            );

        $this->actingAs($admin)
            ->get("/doctors/{$doctor->id}/edit?clinic_id={$clinic->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('doctors/edit')
                ->where('doctorId', $doctor->id)
                ->where('clinicId', $clinic->id)
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

        Storage::disk('public')->assertExists($doctor->fresh()->image_path);
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

        $this->postJson('/login', [
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
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('clinic-settings/index')
                ->where('context.role', User::ROLE_ADMIN)
                ->where('selectedClinicId', $clinic->id)
                ->where('clinic.id', $clinic->id)
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
                'window_minutes' => 45,
                'max_patients_per_window' => 3,
                'is_active' => false,
            ])
            ->assertRedirect()
            ->assertSessionHas('status', 'Jadwal dokter berhasil diperbarui.');

        $this->assertDatabaseHas('doctor_clinic_schedules', [
            'id' => $schedule->id,
            'start_time' => '10:30:00',
            'end_time' => '12:30:00',
            'window_minutes' => 45,
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
            ->get("/clinic-settings?clinic_id={$clinicB->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('clinic-settings/index')
                ->where('context.role', User::ROLE_SUPERADMIN)
                ->has('context.clinics', 2)
                ->where('selectedClinicId', $clinicB->id)
                ->where('clinic.id', $clinicB->id)
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


