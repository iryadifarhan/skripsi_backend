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

class AuthWebTest extends TestCase
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
        $response = $this->postJson('/register', [
            'name' => 'Patient One',
            'username' => 'patient_one',
            'email' => 'patient@example.com',
            'phone_number' => '+628111111111',
            'date_of_birth' => '2000-05-12',
            'gender' => User::GENDER_LAKI,
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ], $this->spaHeaders());

        $response->assertCreated()
            ->assertJsonPath('user.username', 'patient_one')
            ->assertJsonPath('user.phone_number', '+628111111111')
            ->assertJsonPath('user.date_of_birth', '2000-05-12')
            ->assertJsonPath('user.gender', User::GENDER_LAKI)
            ->assertJsonPath('user.role', 'patient');

        $this->assertDatabaseHas('users', [
            'username' => 'patient_one',
            'phone_number' => '+628111111111',
            'date_of_birth' => '2000-05-12',
            'gender' => User::GENDER_LAKI,
            'role' => 'patient',
        ]);

        $this->getJson('/user', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.username', 'patient_one')
            ->assertJsonPath('user.gender', User::GENDER_LAKI);
    }

    public function test_doctor_can_login_with_email_and_logout(): void
    {
        $user = User::factory()->create([
            'username' => 'doctor_one',
            'email' => 'doctor@example.com',
            'role' => 'doctor',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/login', [
            'email' => 'doctor@example.com',
            'password' => 'Password123!',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'doctor');

        $this->getJson('/user', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.username', 'doctor_one');

        $this->postJson('/logout', [], $this->spaHeaders())
            ->assertOk();

        $this->getJson('/user', $this->spaHeaders())
            ->assertUnauthorized();
    }

    public function test_doctor_me_and_profile_include_clinic_specialities(): void
    {
        $clinic = \App\Models\Clinic::create([
            'name' => 'clinic-auth-doctor-speciality',
            'address' => 'Auth doctor speciality address',
            'phone_number' => '089999999991',
            'email' => 'clinic-auth-doctor-speciality@example.test',
        ]);

        $doctor = User::factory()->create([
            'username' => 'doctor_speciality',
            'email' => 'doctor-speciality@example.com',
            'role' => 'doctor',
            'password' => Hash::make('Password123!'),
        ]);

        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['Pediatrics', 'Immunology'])]);

        $this->postJson('/login', [
            'email' => 'doctor-speciality@example.com',
            'password' => 'Password123!',
        ], $this->spaHeaders())
            ->assertOk();

        $this->getJson('/user', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.clinic_specialities.0.clinic_id', $clinic->id)
            ->assertJsonPath('user.clinic_specialities.0.specialities.0', 'Pediatrics')
            ->assertJsonPath('user.clinic_specialities.0.specialities.1', 'Immunology');

        $this->getJson('/profile', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.gender', $doctor->gender)
            ->assertJsonPath('user.clinic_specialities.0.clinic_id', $clinic->id)
            ->assertJsonPath('user.clinic_specialities.0.specialities.0', 'Pediatrics')
            ->assertJsonPath('user.clinic_specialities.0.specialities.1', 'Immunology');
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->create([
            'username' => 'admin_one',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['message']);
    }

    public function test_register_handles_explicit_role(): void
    {
        $this->postJson('/register', [
            'name' => 'Test Register User Explicit',
            'username' => 'explicit_role_user',
            'email' => 'explicit-role@example.com',
            'role' => 'admin',  // attempt to set role during registration
            'date_of_birth' => '1998-07-21',
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

        $this->postJson('/forgot-password', [
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

        $this->postJson('/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));

        $this->postJson('/login', [
            'email' => 'patient-reset@example.com',
            'password' => 'NewPassword123!',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_authenticated_user_can_update_general_profile_data(): void
    {
        $user = User::factory()->create([
            'name' => 'Patient Before',
            'username' => 'patient_before',
            'email' => 'patient-before@example.com',
            'phone_number' => '+628111111112',
            'date_of_birth' => '1999-01-01',
            'gender' => User::GENDER_LAKI,
            'role' => 'patient',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ], $this->spaHeaders())->assertOk();

        $response = $this->patchJson('/profile', [
            'name' => 'Patient After',
            'username' => 'patient_after',
            'email' => 'patient-after@example.com',
            'phone_number' => '+628111111113',
            'date_of_birth' => '1999-02-02',
            'gender' => User::GENDER_PEREMPUAN,
            'role' => 'admin',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.name', 'Patient After')
            ->assertJsonPath('user.username', 'patient_after')
            ->assertJsonPath('user.email', 'patient-after@example.com')
            ->assertJsonPath('user.phone_number', '+628111111113')
            ->assertJsonPath('user.date_of_birth', '1999-02-02')
            ->assertJsonPath('user.gender', User::GENDER_PEREMPUAN)
            ->assertJsonPath('user.role', 'patient');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Patient After',
            'username' => 'patient_after',
            'email' => 'patient-after@example.com',
            'phone_number' => '+628111111113',
            'date_of_birth' => '1999-02-02',
            'gender' => User::GENDER_PEREMPUAN,
            'role' => 'patient',
        ]);
    }

    public function test_register_and_profile_update_reject_future_date_of_birth_and_invalid_gender(): void
    {
        $futureDate = now()->addDay()->toDateString();

        $this->postJson('/register', [
            'name' => 'Patient Invalid Birthdate',
            'username' => 'patient_invalid_birthdate',
            'email' => 'patient-invalid-birthdate@example.com',
            'date_of_birth' => $futureDate,
            'gender' => 'Invalid',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_of_birth', 'gender']);

        $user = User::factory()->create([
            'email' => 'profile-birthdate-validation@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ], $this->spaHeaders())->assertOk();

        $this->patchJson('/profile', [
            'date_of_birth' => $futureDate,
            'gender' => 'Invalid',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_of_birth', 'gender']);
    }

    public function test_profile_update_validates_unique_username_and_email(): void
    {
        $user = User::factory()->create([
            'email' => 'profile-owner@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        User::factory()->create([
            'username' => 'taken_username',
            'email' => 'taken@example.com',
            'phone_number' => '+628111111114',
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ], $this->spaHeaders())->assertOk();

        $this->patchJson('/profile', [
            'username' => 'taken_username',
            'email' => 'taken@example.com',
            'phone_number' => '+628111111114',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['username', 'email', 'phone_number']);
    }

    public function test_authenticated_user_can_update_password_with_current_password(): void
    {
        $user = User::factory()->create([
            'email' => 'password-owner@example.com',
            'password' => Hash::make('OldPassword123!'),
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'OldPassword123!',
        ], $this->spaHeaders())->assertOk();

        $this->patchJson('/profile/password', [
            'current_password' => 'OldPassword123!',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));

        $this->postJson('/logout', [], $this->spaHeaders())->assertOk();

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'NewPassword123!',
        ], $this->spaHeaders())->assertOk();
    }

    public function test_password_update_fails_with_invalid_current_password(): void
    {
        $user = User::factory()->create([
            'email' => 'wrong-current-pass@example.com',
            'password' => Hash::make('CurrentPassword123!'),
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'CurrentPassword123!',
        ], $this->spaHeaders())->assertOk();

        $this->patchJson('/profile/password', [
            'current_password' => 'InvalidCurrentPassword123!',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password']);

        $this->assertTrue(Hash::check('CurrentPassword123!', $user->fresh()->password));
    }

    public function test_authenticated_user_can_get_profile_picture_options_by_role(): void
    {
        $user = User::factory()->create([
            'role' => 'doctor',
            'profile_picture' => 'doctor_1',
            'email' => 'doctor-pic-options@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ], $this->spaHeaders())->assertOk();

        $this->getJson('/profile/picture-options', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('role', 'doctor')
            ->assertJsonPath('selected_profile_picture', 'doctor_1')
            ->assertJsonPath('profile_pictures.0', 'doctor_1')
            ->assertJsonPath('profile_pictures.1', 'doctor_2');
    }

    public function test_authenticated_user_can_update_profile_picture_from_predefined_list(): void
    {
        $user = User::factory()->create([
            'role' => 'patient',
            'profile_picture' => 'patient_1',
            'email' => 'patient-change-picture@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ], $this->spaHeaders())->assertOk();

        $this->patchJson('/profile/picture', [
            'profile_picture' => 'patient_3',
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.profile_picture', 'patient_3');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'profile_picture' => 'patient_3',
        ]);
    }

    public function test_profile_picture_update_rejects_role_mismatch_or_custom_value(): void
    {
        $user = User::factory()->create([
            'role' => 'doctor',
            'profile_picture' => 'doctor_1',
            'email' => 'doctor-reject-picture@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ], $this->spaHeaders())->assertOk();

        $this->patchJson('/profile/picture', [
            'profile_picture' => 'patient_2',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['profile_picture']);

        $this->patchJson('/profile/picture', [
            'profile_picture' => 'my_custom_photo.png',
        ], $this->spaHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['profile_picture']);
    }

    /**
     * @return array<string, string>
     */
    private function spaHeaders(): array
    {
        return [
            'Accept' => 'application/json',
            'Origin' => 'http://localhost:8000',
            'Referer' => 'http://localhost:8000/login',
        ];
    }
}



