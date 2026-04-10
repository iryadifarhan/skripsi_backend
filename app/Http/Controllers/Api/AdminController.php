<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AdminController extends Controller
{
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

        return response()->json([
            'message' => 'User retrieval successful.',
            'user'   => $user,
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
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
            'role'     => ['required', 'string', 'in:' . implode(',', User::ROLES)],
        ]);

        $user = User::create([
            'name'     => $payload['name'],
            'username' => $payload['username'],
            'email'    => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
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
}
