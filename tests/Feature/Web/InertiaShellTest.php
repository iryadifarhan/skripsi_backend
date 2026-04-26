<?php

namespace Tests\Feature\Web;

use App\Models\Clinic;
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


