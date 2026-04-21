<?php

namespace Tests\Feature\Clinic;

use App\Models\Clinic;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
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
            'speciality' => ['Cardiology', 'Orthology'],
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertTrue($doctor->fresh()->clinics()->whereKey($clinic->id)->exists());
        $this->assertDatabaseHas('clinic_user', [
            'clinic_id' => $clinic->id,
            'user_id' => $doctor->id,
            'speciality' => json_encode(['Cardiology', 'Orthology']),
        ]);

        $this->deleteJson("/api/admin/clinic/doctor/{$clinic->id}", [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
        ], $this->spaHeaders())
            ->assertOk();

        $this->assertFalse($doctor->fresh()->clinics()->whereKey($clinic->id)->exists());
    }

    public function test_authenticated_user_can_get_clinic_specialities_and_doctor_speciality(): void
    {
        $clinic = $this->makeClinic('clinic-specialities');
        $doctorA = $this->makeUser(User::ROLE_DOCTOR, 'doctor-speciality-a@example.com');
        $doctorB = $this->makeUser(User::ROLE_DOCTOR, 'doctor-speciality-b@example.com');
        $patient = $this->makeUser(User::ROLE_PATIENT, 'patient-speciality@example.com');

        $doctorA->clinics()->attach($clinic->id, ['speciality' => json_encode(['Cardiology', 'Orthology'])]);
        $doctorB->clinics()->attach($clinic->id, ['speciality' => json_encode(['Neurology'])]);

        $this->login($patient, 'Password123!');

        $this->getJson('/api/clinics', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('clinics.0.id', $clinic->id)
            ->assertJsonPath('clinics.0.specialities.0', 'Cardiology')
            ->assertJsonPath('clinics.0.specialities.1', 'Orthology')
            ->assertJsonPath('clinics.0.specialities.2', 'Neurology');

        $this->getJson("/api/clinic/{$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('specialities.0', 'Cardiology')
            ->assertJsonPath('specialities.1', 'Orthology')
            ->assertJsonPath('specialities.2', 'Neurology')
            ->assertJsonPath('doctors.0.specialities.0', 'Cardiology')
            ->assertJsonPath('doctors.0.specialities.1', 'Orthology')
            ->assertJsonPath('doctors.1.specialities.0', 'Neurology');
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

    public function test_admin_can_upload_clinic_image_and_it_is_exposed_in_clinic_payloads(): void
    {
        Storage::fake('public');

        $clinic = $this->makeClinic('clinic-image-admin');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-clinic-image@example.com', $clinic->id);

        $this->login($admin, 'Password123!');

        $this->post("/api/admin/clinic/{$clinic->id}/image", [
            'clinic_id' => $clinic->id,
            'image' => UploadedFile::fake()->image('clinic-logo.png', 400, 400),
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('message', 'Clinic image uploaded successfully.');

        $clinic = $clinic->fresh();

        $this->assertNotNull($clinic->image_path);
        Storage::disk('public')->assertExists($clinic->image_path);

        $this->getJson('/api/clinics', $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('clinics.0.image_path', $clinic->image_path)
            ->assertJsonPath('clinics.0.image_url', Storage::disk('public')->url($clinic->image_path));

        $this->getJson("/api/clinic/{$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('image_path', $clinic->image_path)
            ->assertJsonPath('image_url', Storage::disk('public')->url($clinic->image_path));
    }

    public function test_admin_can_upload_doctor_image_for_doctor_in_own_clinic(): void
    {
        Storage::fake('public');

        $clinic = $this->makeClinic('clinic-doctor-image-admin');
        $admin = $this->makeUser(User::ROLE_ADMIN, 'admin-doctor-image@example.com', $clinic->id);
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-image@example.com');
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['Cardiology'])]);

        $this->login($admin, 'Password123!');

        $this->post("/api/admin/clinic/{$clinic->id}/doctor-image", [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'image' => UploadedFile::fake()->image('doctor-photo.webp', 500, 500),
        ], $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('message', 'Doctor image uploaded successfully.')
            ->assertJsonPath('doctor.id', $doctor->id)
            ->assertJsonPath('doctor.specialities.0', 'Cardiology');

        $doctor = $doctor->fresh();

        $this->assertNotNull($doctor->image_path);
        Storage::disk('public')->assertExists($doctor->image_path);

        $this->getJson("/api/clinic/{$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('doctors.0.id', $doctor->id)
            ->assertJsonPath('doctors.0.image_path', $doctor->image_path)
            ->assertJsonPath('doctors.0.image_url', Storage::disk('public')->url($doctor->image_path));

        $this->getJson("/api/admin/user/{$doctor->username}?clinic_id={$clinic->id}", $this->spaHeaders())
            ->assertOk()
            ->assertJsonPath('user.image_path', $doctor->image_path)
            ->assertJsonPath('user.image_url', Storage::disk('public')->url($doctor->image_path));
    }

    public function test_superadmin_can_upload_clinic_and_doctor_images(): void
    {
        Storage::fake('public');

        $superadmin = $this->makeUser(User::ROLE_SUPERADMIN, 'superadmin-media@example.com');
        $clinic = $this->makeClinic('clinic-media-superadmin');
        $doctor = $this->makeUser(User::ROLE_DOCTOR, 'doctor-media-superadmin@example.com');
        $doctor->clinics()->attach($clinic->id, ['speciality' => json_encode(['Neurology'])]);

        $this->login($superadmin, 'Password123!');

        $this->post("/api/superadmin/clinic/{$clinic->id}/image", [
            'image' => UploadedFile::fake()->image('superadmin-clinic.png', 320, 320),
        ], $this->spaHeaders())
            ->assertOk();

        $this->post("/api/superadmin/clinic/{$clinic->id}/doctor-image", [
            'doctor_id' => $doctor->id,
            'image' => UploadedFile::fake()->image('superadmin-doctor.png', 320, 320),
        ], $this->spaHeaders())
            ->assertOk();

        Storage::disk('public')->assertExists($clinic->fresh()->image_path);
        Storage::disk('public')->assertExists($doctor->fresh()->image_path);
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
