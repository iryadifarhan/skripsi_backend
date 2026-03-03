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
    private function authorizeAdmin(Request $request): void
    {
        if ($request->user()->role !== User::ROLE_ADMIN) {
            abort(403, 'Unauthorized');
        }
    }

    public function getUser(Request $request, $usernameOrEmail): JsonResponse
    {
        $this->authorizeAdmin($request);

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
        $this->authorizeAdmin($request);

        $payload = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
            'role'     => ['required', 'string', 'in:' . implode(',', User::ROLES)],
        ]);

        $user = User::create([
            'name'     => $payload['name'],
            'username' => $payload['username'],
            'email'    => $payload['email'],
            'role'     => $payload['role'],
            'password' => $payload['password'],
        ]);

        return response()->json([
            'message' => 'User creation successful.',
            'user'    => $user,
        ], 201);
    }

    public function updateUser(Request $request, $usernameOrEmail): JsonResponse
    {
        $this->authorizeAdmin($request);

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
            'role'     => ['required', 'string', 'in:' . implode(',', User::ROLES)],
        ]);

        $user->update($payload);

        return response()->json([
            'message' => "User update successful.",
            'user'    => $user,
        ]);
    }
}
