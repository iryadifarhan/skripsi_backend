<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AdminController extends Controller
{
    public function searchPatients(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);
        $search = trim((string) ($payload['search'] ?? ''));

        $patients = User::query()
            ->where('role', User::ROLE_PATIENT)
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(15)
            ->get(['id', 'name', 'username', 'email', 'phone_number', 'gender']);

        return response()->json([
            'message' => 'Patient search successful.',
            'patients' => $patients,
        ]);
    }

    public function getUser(Request $request, $usernameOrEmail): JsonResponse
    {
        $user = User::where('username', $usernameOrEmail)
            ->orWhere('email', $usernameOrEmail)
            ->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        $user->loadMissing([
            'clinics:id,name',
        ]);

        return response()->json([
            'message' => 'User retrieval successful.',
            'user'   => $this->serializeUser($request, $user),
        ]);
    }

    public function createUser(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:30', 'unique:users,phone_number'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
            'role'     => ['required', 'string', 'in:' . implode(',', User::ROLES)],
        ]);

        $user = User::create([
            'name'     => $payload['name'],
            'username' => $payload['username'],
            'email'    => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role'     => $payload['role'],
            'profile_picture' => User::defaultProfilePictureForRole($payload['role']),
            'password' => $payload['password'],
        ]);

        return response()->json([
            'message' => 'User creation successful.',
            'user'    => $user,
        ], 201);
    }

    public function updateUser(Request $request, $usernameOrEmail): JsonResponse
    {
        $user = User::where('username', $usernameOrEmail)
            ->orWhere('email', $usernameOrEmail)
            ->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        $payload = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($user->id)],
            'email'    => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone_number' => ['nullable', 'string', 'max:30', Rule::unique('users', 'phone_number')->ignore($user->id)],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'role'     => ['required', 'string', 'in:' . implode(',', User::ROLES)],
        ]);

        if (!User::isValidProfilePictureForRole($payload['role'], (string) $user->profile_picture)) {
            $payload['profile_picture'] = User::defaultProfilePictureForRole($payload['role']);
        }

        $user->update($payload);

        return response()->json([
            'message' => "User update successful.",
            'user'    => $user,
        ]);
    }

    public function deleteUser(Request $request, $usernameOrEmail): JsonResponse
    {
        $user = User::where('username', $usernameOrEmail)
            ->orWhere('email', $usernameOrEmail)
            ->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        if ($user->id === Auth::id()) {
            return response()->json([
                'message' => 'You cannot delete your own account.',
            ], 400);
        }

        $user->delete();

        return response()->json([
            'message' => 'User deletion successful.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(Request $request, User $user): array
    {
        $payload = $user->toArray();

        if ($user->role !== User::ROLE_DOCTOR) {
            return $payload;
        }

        $clinicSpecialities = $user->clinics->map(function ($clinic): array {
            return [
                'clinic_id' => $clinic->id,
                'clinic_name' => $clinic->name,
                'specialities' => $this->pivotSpecialities($clinic->pivot?->speciality),
            ];
        })->values()->all();

        $scopedClinicId = $request->integer('clinic_id') ?: (int) ($request->user()?->clinic_id ?? 0);
        $scopedSpeciality = null;

        if ($scopedClinicId > 0) {
            $scopedClinicSpeciality = collect($clinicSpecialities)
                ->firstWhere('clinic_id', $scopedClinicId);

            $scopedSpeciality = $scopedClinicSpeciality['specialities'] ?? [];
        }

        $payload['speciality'] = $scopedSpeciality;
        $payload['specialities'] = $scopedSpeciality;
        $payload['clinic_specialities'] = $clinicSpecialities;

        return $payload;
    }

    /**
     * @return array<int, string>
     */
    private function pivotSpecialities(mixed $value): array
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
}

