<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:30', 'unique:users,phone_number'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $user = User::create([
            'name'     => $payload['name'],
            'username' => $payload['username'],
            'email'    => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role'     => User::ROLE_PATIENT,
            'profile_picture' => User::defaultProfilePictureForRole(User::ROLE_PATIENT),
            'password' => $payload['password'],
        ]);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Registration successful.',
            'user'    => $user,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $authenticated = Auth::guard('web')->attempt([
            'email' => $payload['email'],
            'password' => $payload['password'],
        ], $payload['remember'] ?? false);

        if (! $authenticated) {
            throw ValidationException::withMessages([
                'message' => ['The provided credentials are incorrect.'],
            ]);
        }

        $request->session()->regenerate();

        return response()->json([
            'message' => 'Login successful.',
            'user' => $request->user(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('clinics:id,name');

        return response()->json([
            'user' => $this->serializeAuthenticatedUser($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        Auth::forgetGuards();

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $status = Password::sendResetLink([
            'email' => $payload['email'],
        ]);

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => __($status),
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::reset([
            'email' => $payload['email'],
            'token' => $payload['token'],
            'password' => $payload['password'],
        ], function (User $user, string $password): void {
            $user->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();

            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => __($status),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeAuthenticatedUser(User $user): array
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
