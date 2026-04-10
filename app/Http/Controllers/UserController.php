<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

class UserController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('clinics:id,name');

        return response()->json([
            'message' => 'Profile retrieval successful.',
            'user' => $this->serializeProfileUser($user),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $payload = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'username' => ['sometimes', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone_number' => ['sometimes', 'nullable', 'string', 'max:30', Rule::unique('users', 'phone_number')->ignore($user->id)],
            'date_of_birth' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'gender' => ['sometimes', 'nullable', 'string', Rule::in(User::GENDERS)],
        ]);

        if ($payload === []) {
            return response()->json([
                'message' => 'At least one profile field is required.',
            ], 422);
        }

        $user->update($payload);

        return response()->json([
            'message' => 'Profile update successful.',
            'user' => $user->fresh(),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $payload = $request->validate([
            'current_password' => ['required', 'current_password:web'],
            'password' => ['required', 'confirmed', 'different:current_password', PasswordRule::defaults()],
        ]);

        $user->update([
            'password' => $payload['password'],
        ]);

        return response()->json([
            'message' => 'Password update successful.',
        ]);
    }

    public function profilePictureOptions(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'role' => $user->role,
            'profile_pictures' => User::profilePicturesForRole($user->role),
            'selected_profile_picture' => $user->profile_picture,
        ]);
    }

    public function updateProfilePicture(Request $request): JsonResponse
    {
        $user = $request->user();

        $payload = $request->validate([
            'profile_picture' => [
                'required',
                'string',
                Rule::in(User::profilePicturesForRole($user->role)),
            ],
        ]);

        $user->update([
            'profile_picture' => $payload['profile_picture'],
        ]);

        return response()->json([
            'message' => 'Profile picture update successful.',
            'user' => $user->fresh(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeProfileUser(User $user): array
    {
        $payload = $user->toArray();

        if ($user->role !== User::ROLE_DOCTOR) {
            return $payload;
        }

        $payload['clinic_specialities'] = $user->clinics->map(function ($clinic): array {
            return [
                'clinic_id' => $clinic->id,
                'clinic_name' => $clinic->name,
                'specialities' => $this->pivotSpecialities($clinic->pivot?->speciality),
            ];
        })->values()->all();

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
