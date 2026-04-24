<?php

namespace Tests\Feature\Web;

use App\Models\Clinic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
