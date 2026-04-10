<?php

namespace Tests\Feature\Admin;

use App\Models\Clinic;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminManagementApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('session.driver', 'database');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_admin_can_create_get_update_and_delete_user(): void
    {
        $clinic = $this->makeClinic('clinic-admin-users');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-users@example.com', $clinic->id);

        $this->login($admin, 'Password123!');

        $this->postJson('/api/admin/user/create', [
            'clinic_id' => $clinic->id,
            'name' => 'Managed User',
            'username' => 'managed_user',
            'email' => 'managed-user@example.com',
            'phone_number' => '+628222222222',
            'date_of_birth' => '1995-09-14',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => User::ROLE_DOCTOR,
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('user.username', 'managed_user')
            ->assertJsonPath('user.date_of_birth', '1995-09-14T00:00:00.000000Z')
            ->assertJsonPath('user.role', User::ROLE_DOCTOR);

        $this->getJson("/api/admin/user/managed_user?clinic_id={$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.email', 'managed-user@example.com')
            ->assertJsonPath('user.date_of_birth', '1995-09-14T00:00:00.000000Z');

        $this->patchJson('/api/admin/user/managed_user', [
            'clinic_id' => $clinic->id,
            'name' => 'Managed User Updated',
            'username' => 'managed_user',
            'email' => 'managed-user-updated@example.com',
            'phone_number' => '+628333333333',
            'date_of_birth' => '1995-10-15',
            'role' => User::ROLE_PATIENT,
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.name', 'Managed User Updated')
            ->assertJsonPath('user.date_of_birth', '1995-10-15T00:00:00.000000Z')
            ->assertJsonPath('user.role', User::ROLE_PATIENT);

        $this->assertDatabaseHas('users', [
            'username' => 'managed_user',
            'date_of_birth' => '1995-10-15 00:00:00',
            'role' => User::ROLE_PATIENT,
        ]);

        $this->deleteJson('/api/admin/user/managed_user', [
            'clinic_id' => $clinic->id,
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertDatabaseMissing('users', [
            'username' => 'managed_user',
        ]);
    }

    public function test_admin_cannot_delete_own_account(): void
    {
        $clinic = $this->makeClinic('clinic-admin-self-delete');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-self-delete@example.com', $clinic->id);

        $this->login($admin, 'Password123!');

        $this->deleteJson("/api/admin/user/{$admin->email}", [
            'clinic_id' => $clinic->id,
        ], $this->spaHeaders())
            ->assertStatus(400)
            ->assertJsonPath('message', 'You cannot delete your own account.');
    }

    public function test_admin_can_get_doctor_user_with_scoped_speciality(): void
    {
        $clinic = $this->makeClinic('clinic-admin-user-speciality');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-user-speciality@example.com', $clinic->id);
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-user-speciality@example.com');
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['Dermatology', 'Aesthetics'])]);

        $this->login($admin, 'Password123!');

        $this->getJson("/api/admin/user/{$doctor->username}?clinic_id={$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.role', User::ROLE_DOCTOR)
            ->assertJsonPath('user.specialities.0', 'Dermatology')
            ->assertJsonPath('user.specialities.1', 'Aesthetics')
            ->assertJsonPath('user.clinic_specialities.0.clinic_id', $clinic->id)
            ->assertJsonPath('user.clinic_specialities.0.specialities.0', 'Dermatology')
            ->assertJsonPath('user.clinic_specialities.0.specialities.1', 'Aesthetics');
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
