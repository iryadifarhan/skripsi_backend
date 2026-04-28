<?php

namespace App\Services\Web;

use App\Models\Clinic;
use App\Models\User;
use Illuminate\Http\Request;

class WorkspaceViewService
{
    /**
     * @return array{role: string, clinicId: int|null, clinics: array<int, array{id: int, name: string}>}
     */
    public function context(Request $request): array
    {
        /** @var User $user */
        $user = $request->user()->loadMissing([
            'clinic:id,name',
            'clinics:id,name',
        ]);

        $clinics = match ($user->role) {
            User::ROLE_SUPERADMIN => Clinic::query()
                ->select(['id', 'name'])
                ->orderBy('name')
                ->get()
                ->map(fn (Clinic $clinic): array => ['id' => $clinic->id, 'name' => $clinic->name])
                ->values()
                ->all(),
            User::ROLE_ADMIN => $user->clinic !== null
                ? [['id' => $user->clinic->id, 'name' => $user->clinic->name]]
                : [],
            User::ROLE_DOCTOR => $user->clinics
                ->map(fn ($clinic): array => ['id' => $clinic->id, 'name' => $clinic->name])
                ->values()
                ->all(),
            default => [],
        };

        return [
            'role' => $user->role,
            'clinicId' => $user->role === User::ROLE_ADMIN ? $user->clinic_id : null,
            'clinics' => $clinics,
        ];
    }

    public function selectedClinic(Request $request, array $context): ?Clinic
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role === User::ROLE_ADMIN) {
            return $user->clinic_id !== null ? Clinic::find($user->clinic_id) : null;
        }

        if ($user->role === User::ROLE_SUPERADMIN) {
            $requestedClinicId = $request->integer('clinic_id') ?: ($context['clinics'][0]['id'] ?? null);

            return $requestedClinicId !== null ? Clinic::find($requestedClinicId) : null;
        }

        return null;
    }

    /**
     * @return array<string>
     */
    public function pivotSpecialities(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return collect($value)
                ->filter(fn ($speciality): bool => filled($speciality))
                ->map(fn ($speciality): string => (string) $speciality)
                ->values()
                ->all();
        }

        $decoded = json_decode((string) $value, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return collect($decoded)
                ->filter(fn ($speciality): bool => filled($speciality))
                ->map(fn ($speciality): string => (string) $speciality)
                ->values()
                ->all();
        }

        return [(string) $value];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeDoctor(User $doctor): array
    {
        return [
            'id' => $doctor->id,
            'name' => $doctor->name,
            'username' => $doctor->username,
            'email' => $doctor->email,
            'phone_number' => $doctor->phone_number,
            'date_of_birth' => $doctor->date_of_birth?->toDateString(),
            'gender' => $doctor->gender,
            'image_path' => $doctor->image_path,
            'image_url' => $doctor->image_url,
            'role' => $doctor->role,
            'specialities' => $this->pivotSpecialities($doctor->pivot?->speciality),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeClinicDetail(Clinic $clinic): array
    {
        $clinic->loadMissing([
            'doctors:id,name,username,email,phone_number,date_of_birth,gender,image_path',
            'users:id,clinic_id,name,username,email,phone_number,date_of_birth,gender,role,email_verified_at,created_at',
            'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
        ]);

        return [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'address' => $clinic->address,
            'phone_number' => $clinic->phone_number,
            'email' => $clinic->email,
            'image_path' => $clinic->image_path,
            'image_url' => $clinic->image_url,
            'operating_hours' => $clinic->operatingHours,
            'specialities' => $clinic->doctors
                ->flatMap(fn (User $doctor): array => $this->pivotSpecialities($doctor->pivot?->speciality))
                ->unique()
                ->values()
                ->all(),
            'doctors' => $clinic->doctors
                ->map(fn (User $doctor): array => $this->serializeDoctor($doctor))
                ->values()
                ->all(),
            'admins' => $clinic->users
                ->where('role', User::ROLE_ADMIN)
                ->sortBy('name')
                ->values()
                ->map(fn (User $admin): array => $this->serializeClinicAdmin($admin))
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeClinicAdmin(User $admin): array
    {
        return [
            'id' => $admin->id,
            'name' => $admin->name,
            'username' => $admin->username,
            'email' => $admin->email,
            'phone_number' => $admin->phone_number,
            'date_of_birth' => $admin->date_of_birth?->toDateString(),
            'gender' => $admin->gender,
            'email_verified_at' => $admin->email_verified_at?->toISOString(),
            'created_at' => $admin->created_at?->toISOString(),
        ];
    }

    /**
     * @return array<string>
     */
    public function reservationRelations(): array
    {
        return [
            'patient:id,name,username,email,phone_number,gender',
            'doctor:id,name,username,email,phone_number,image_path',
            'clinic:id,name,address,phone_number,email,image_path',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
        ];
    }
}
