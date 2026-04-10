<?php

namespace Tests\Feature\Clinic;

use App\Models\Clinic;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ClinicApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('session.driver', 'database');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_superadmin_can_create_update_and_delete_clinic(): void
    {
        $superadmin = $this->makeUser(User::ROLE_SUPERADMIN, 'superadmin-clinic@example.com');
        $this->login($superadmin, 'Password123!');

        $this->postJson('/api/superadmin/clinic/create', [
            'name' => 'Klinik Superadmin',
            'address' => 'Address Klinik Superadmin',
            'phone_number' => '081111111111',
            'email' => 'superadmin-clinic@example.test',
            'operating_hours' => [
                [
                    'day_of_week' => 1,
                    'open_time' => '08:00:00',
                    'close_time' => '16:00:00',
                    'is_closed' => false,
                ],
                [
                    'day_of_week' => 2,
                    'open_time' => '09:00:00',
                    'close_time' => '15:00:00',
                    'is_closed' => false,
                ],
            ],
        ], $this->spaHeaders())
            ->assertCreated();

        $clinic = Clinic::where('email', 'superadmin-clinic@example.test')->firstOrFail();

        $this->assertDatabaseHas('clinic_operating_hours', [
            'clinic_id' => $clinic->id,
            'day_of_week' => 1,
            'open_time' => '08:00:00',
            'close_time' => '16:00:00',
            'is_closed' => false,
        ]);

        $this->patchJson("/api/superadmin/clinic/update/{$clinic->id}", [
            'name' => 'Klinik Superadmin Updated',
            'email' => 'superadmin-clinic-updated@example.test',
            'operating_hours' => [
                [
                    'day_of_week' => 1,
                    'open_time' => '10:00:00',
                    'close_time' => '17:00:00',
                    'is_closed' => false,
                ],
            ],
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertDatabaseHas('clinics', [
            'id' => $clinic->id,
            'name' => 'Klinik Superadmin Updated',
            'email' => 'superadmin-clinic-updated@example.test',
        ]);

        $this->assertDatabaseHas('clinic_operating_hours', [
            'clinic_id' => $clinic->id,
            'day_of_week' => 1,
            'open_time' => '10:00:00',
            'close_time' => '17:00:00',
        ]);

        $this->deleteJson("/api/superadmin/clinic/delete/{$clinic->id}", [], $this->spaHeaders())
            ->assertOk();

        $this->assertDatabaseMissing('clinics', [
            'id' => $clinic->id,
        ]);
    }

    public function test_admin_can_assign_and_remove_doctor_from_own_clinic(): void
    {
        $clinic = $this->makeClinic('clinic-admin-doctor');
        $this->seedOperatingHour($clinic, 1, '08:00:00', '17:00:00');

        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-assign@example.com', $clinic->id);
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-assign@example.com');

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/clinic/doctor/{$clinic->id}", [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertTrue($doctor->fresh()->clinics()->whereKey($clinic->id)->exists());

        $this->deleteJson("/api/admin/clinic/doctor/{$clinic->id}", [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertFalse($doctor->fresh()->clinics()->whereKey($clinic->id)->exists());
    }

    public function test_admin_can_update_and_delete_own_clinic_via_admin_routes(): void
    {
        $clinic = $this->makeClinic('clinic-admin-route');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-clinic-route@example.com', $clinic->id);

        $this->login($admin, 'Password123!');

        $this->patchJson("/api/admin/clinic/update/{$clinic->id}", [
            'clinic_id' => $clinic->id,
            'name' => 'clinic-admin-route-updated',
            'address' => 'Updated clinic address',
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertDatabaseHas('clinics', [
            'id' => $clinic->id,
            'name' => 'clinic-admin-route-updated',
            'address' => 'Updated clinic address',
        ]);

        $this->deleteJson("/api/admin/clinic/delete/{$clinic->id}", [
            'clinic_id' => $clinic->id,
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertDatabaseMissing('clinics', [
            'id' => $clinic->id,
        ]);
    }

    public function test_admin_can_create_and_update_doctor_clinic_schedule(): void
    {
        $clinic = $this->makeClinic('clinic-schedule-admin');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-schedule@example.com', $clinic->id);
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-schedule@example.com');
        $doctor->clinics()->attach($clinic->id);

        $reservationDate = now()->addDay()->toDateString();
        $dayOfWeek = Carbon::parse($reservationDate)->dayOfWeek;
        $this->seedOperatingHour($clinic, $dayOfWeek, '08:00:00', '17:00:00');

        $this->login($admin, 'Password123!');

        $this->postJson('/api/clinic/schedules', [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => $dayOfWeek,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => 60,
            'max_patients_per_window' => 4,
        ], $this->spaHeaders())
            ->assertCreated();

        $schedule = DoctorClinicSchedule::query()
            ->where('clinic_id', $clinic->id)
            ->where('doctor_id', $doctor->id)
            ->where('day_of_week', $dayOfWeek)
            ->firstOrFail();

        $this->patchJson("/api/clinic/schedules/{$schedule->id}", [
            'clinic_id' => $clinic->id,
            'start_time' => '10:00:00',
            'end_time' => '13:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 3,
            'is_active' => true,
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertDatabaseHas('doctor_clinic_schedules', [
            'id' => $schedule->id,
            'start_time' => '10:00:00',
            'end_time' => '13:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 3,
            'is_active' => true,
        ]);
    }

    public function test_admin_can_create_bulk_doctor_clinic_schedules(): void
    {
        $clinic = $this->makeClinic('clinic-schedule-admin-bulk');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-schedule-bulk@example.com', $clinic->id);
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-schedule-bulk@example.com');
        $doctor->clinics()->attach($clinic->id);

        $this->seedOperatingHour($clinic, 1, '08:00:00', '17:00:00');
        $this->seedOperatingHour($clinic, 2, '08:00:00', '17:00:00');

        $this->login($admin, 'Password123!');

        $this->postJson('/api/clinic/schedules', [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => [1, 2],
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 4,
        ], $this->spaHeaders())
            ->assertCreated()
            ->assertJsonPath('message', 'Doctor clinic schedules created successfully.')
            ->assertJsonCount(2, 'schedules');

        $this->assertDatabaseHas('doctor_clinic_schedules', [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => 1,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
        ]);

        $this->assertDatabaseHas('doctor_clinic_schedules', [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => 2,
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
        ]);
    }

    public function test_doctor_can_create_and_update_clinic_schedule_for_owned_clinic(): void
    {
        $clinic = $this->makeClinic('clinic-schedule-doctor');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-owned-schedule@example.com');
        $doctor->clinics()->attach($clinic->id);

        $reservationDate = now()->addDay()->toDateString();
        $dayOfWeek = Carbon::parse($reservationDate)->dayOfWeek;
        $this->seedOperatingHour($clinic, $dayOfWeek, '08:00:00', '17:00:00');

        $this->login($doctor, 'Password123!');

        $this->postJson('/api/clinic/schedules', [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'day_of_week' => $dayOfWeek,
            'start_time' => '08:30:00',
            'end_time' => '10:30:00',
            'window_minutes' => 30,
            'max_patients_per_window' => 2,
        ], $this->spaHeaders())
            ->assertCreated();

        $schedule = DoctorClinicSchedule::query()
            ->where('clinic_id', $clinic->id)
            ->where('doctor_id', $doctor->id)
            ->where('day_of_week', $dayOfWeek)
            ->firstOrFail();

        $this->patchJson("/api/clinic/schedules/{$schedule->id}", [
            'clinic_id' => $clinic->id,
            'start_time' => '09:00:00',
            'end_time' => '11:00:00',
            'window_minutes' => 60,
            'max_patients_per_window' => 4,
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertDatabaseHas('doctor_clinic_schedules', [
            'id' => $schedule->id,
            'start_time' => '09:00:00',
            'end_time' => '11:00:00',
            'window_minutes' => 60,
            'max_patients_per_window' => 4,
        ]);
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

    private function seedOperatingHour(Clinic $clinic, int $dayOfWeek, string $openTime, string $closeTime): void
    {
        ClinicOperatingHour::updateOrCreate(
            [
                'clinic_id' => $clinic->id,
                'day_of_week' => $dayOfWeek,
            ],
            [
                'open_time' => $openTime,
                'close_time' => $closeTime,
                'is_closed' => false,
            ]
        );
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
