<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('session.driver', 'database');

        // CSRF is tested by Laravel; these tests focus on auth behavior.
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_patient_can_register_and_is_authenticated(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Patient One',
            'username' => 'patient_one',
            'email' => 'patient@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ], $this->spaHeaders());

        $response->assertCreated()
            ->assertJsonPath('user.username', 'patient_one')
            ->assertJsonPath('user.role', 'patient');

        $this->assertDatabaseHas('users', [
            'username' => 'patient_one',
            'role' => 'patient',
        ]);

        $this->getJson('/api/user', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.username', 'patient_one');
    }

    public function test_doctor_can_login_with_email_and_logout(): void
    {
        $user = User::factory()->create([
            'username' => 'doctor_one',
            'email' => 'doctor@example.com',
            'role' => 'doctor',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'doctor@example.com',
            'password' => 'Password123!',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'doctor');

        $this->getJson('/api/user', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.username', 'doctor_one');

        $this->postJson('/api/logout', [], $this->spaHeaders())
            ->assertOk();

        $this->getJson('/api/user', $this->spaHeaders())
            ->assertUnauthorized();
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->create([
            'username' => 'admin_one',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['message']);
    }

    public function test_register_handles_explicit_role(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Test Register User Explicit',
            'username' => 'explicit_role_user',
            'email' => 'explicit-role@example.com',
            'role' => 'admin',  // attempt to set role during registration
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ], $this->spaHeaders())
            ->assertCreated() 
            ->assertJsonPath('user.role', 'patient'); // should default to patient
    }

    public function test_forgot_password_sends_reset_notification(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'email' => 'reset@example.com',
        ]);

        $this->postJson('/api/forgot-password', [
            'email' => $user->email,
        ], ['Accept' => 'application/json'])
            ->assertOk();

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_user_can_reset_password_and_login_with_new_password(): void
    {
        $user = User::factory()->create([
            'username' => 'patient_reset',
            'email' => 'patient-reset@example.com',
            'password' => Hash::make('OldPassword123!'),
        ]);

        $token = Password::broker()->createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));

        $this->postJson('/api/login', [
            'email' => 'patient-reset@example.com',
            'password' => 'NewPassword123!',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
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
