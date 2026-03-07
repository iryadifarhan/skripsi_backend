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
        return response()->json([
            'message' => 'Profile retrieval successful.',
            'user' => $request->user(),
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
}
