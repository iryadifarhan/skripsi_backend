<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;

use App\Models\User;
use App\Services\MediaImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse|Response
    {
        $user = $request->user()->loadMissing('clinics:id,name');

        if (!$request->expectsJson()) {
            return Inertia::render('profile', [
                'user' => $this->serializeProfileUser($user),
                'profilePictureOptions' => User::profilePicturesForRole($user->role),
                'canManageAvatar' => User::supportsProfilePicture($user->role),
            ]);
        }

        return response()->json([
            'message' => 'Profile retrieval successful.',
            'user' => $this->serializeProfileUser($user),
        ]);
    }

    public function update(Request $request): JsonResponse|RedirectResponse
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

        if (!$request->expectsJson()) {
            return back()->with('status', 'Profil berhasil diperbarui.');
        }

        return response()->json([
            'message' => 'Profile update successful.',
            'user' => $user->fresh(),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        $payload = $request->validate([
            'current_password' => ['required', 'current_password:web'],
            'password' => ['required', 'confirmed', 'different:current_password', PasswordRule::defaults()],
        ]);

        $user->update([
            'password' => $payload['password'],
        ]);

        if (!$request->expectsJson()) {
            return back()->with('status', 'Password berhasil diperbarui.');
        }

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

    public function updateProfilePicture(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        $this->authorizeProfilePictureUser($user);

        $payload = $request->validate([
            'profile_picture' => [
                'present',
                'nullable',
                'string',
                Rule::in(User::profilePicturesForRole($user->role)),
            ],
        ]);

        $profilePicture = $payload['profile_picture'] ?? null;

        if ($profilePicture === null && !filled($user->image_path)) {
            throw ValidationException::withMessages([
                'profile_picture' => ['Tidak ada foto upload yang dapat dipilih.'],
            ]);
        }

        $user->update([
            'profile_picture' => $profilePicture,
        ]);

        if (!$request->expectsJson()) {
            return back()->with('status', $profilePicture === null ? 'Foto upload aktif digunakan.' : 'Avatar bawaan berhasil dipilih.');
        }

        return response()->json([
            'message' => 'Profile picture update successful.',
            'user' => $user->fresh(),
        ]);
    }

    public function uploadImage(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        $this->authorizeProfilePictureUser($user);

        $payload = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $disk = (string) config('filesystems.media_disk', 'public');
        $previousImagePath = $user->image_path;
        $newImagePath = MediaImageService::store($payload['image'], 'users/'.$user->id, $disk);

        $user->update([
            'image_path' => $newImagePath,
            'profile_picture' => null,
        ]);

        if (filled($previousImagePath) && $previousImagePath !== $newImagePath) {
            MediaImageService::delete($previousImagePath, $disk);
        }

        if (!$request->expectsJson()) {
            return back()->with('status', 'Foto profil berhasil diunggah.');
        }

        return response()->json([
            'message' => 'Profile image uploaded successfully.',
            'user' => $user->fresh(),
        ]);
    }

    public function deleteImage(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        $this->authorizeProfilePictureUser($user);

        $this->deleteUploadedProfileImage($user);
        $user->update([
            'image_path' => null,
        ]);

        if (!$request->expectsJson()) {
            return back()->with('status', 'Foto upload berhasil dihapus.');
        }

        return response()->json([
            'message' => 'Profile image deleted successfully.',
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

    private function authorizeProfilePictureUser(User $user): void
    {
        abort_unless(User::supportsProfilePicture($user->role), 403);
    }

    private function deleteUploadedProfileImage(User $user): void
    {
        if (!MediaImageService::hasValidPath($user->image_path)) {
            return;
        }

        MediaImageService::delete($user->image_path);
    }
}
