<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthPageController extends Controller
{
    public function login(): Response
    {
        return Inertia::render('auth/login');
    }

    public function authenticate(Request $request): JsonResponse|RedirectResponse
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

        if (!$authenticated) {
            $errorKey = $request->expectsJson() ? 'message' : 'email';

            throw ValidationException::withMessages([
                $errorKey => ['The provided credentials are incorrect.'],
            ]);
        }

        $request->session()->regenerate();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Login successful.',
                'user' => $request->user(),
                'redirect' => $this->redirectTargetAfterLogin($request),
            ]);
        }

        return redirect($this->redirectTargetAfterLogin($request));
    }

    public function register(): Response
    {
        return Inertia::render('auth/register');
    }

    public function storeRegister(Request $request): JsonResponse|RedirectResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:30', 'unique:users,phone_number'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $user = User::create([
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role' => User::ROLE_PATIENT,
            'profile_picture' => User::defaultProfilePictureForRole(User::ROLE_PATIENT),
            'password' => $payload['password'],
        ]);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Registration successful.',
                'user' => $user,
                'redirect' => '/beranda',
            ], 201);
        }

        return redirect('/beranda');
    }

    public function forgotPassword(): Response
    {
        return Inertia::render('auth/forgot-password');
    }

    public function sendResetLink(Request $request): JsonResponse|RedirectResponse
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

        if ($request->expectsJson()) {
            return response()->json([
                'message' => __($status),
            ]);
        }

        return back()->with('status', __($status));
    }

    public function redirectResetPassword(Request $request): RedirectResponse
    {
        $token = (string) $request->query('token', '');

        abort_if($token === '', 404);

        return to_route('password.reset', [
            'token' => $token,
            'email' => (string) $request->query('email', ''),
        ]);
    }

    public function resetPassword(Request $request, string $token): Response
    {
        return Inertia::render('auth/reset-password', [
            'token' => $token,
            'email' => (string) $request->query('email', ''),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse|RedirectResponse
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

        if ($request->expectsJson()) {
            return response()->json([
                'message' => __($status),
            ]);
        }

        return to_route('login')->with('status', __($status));
    }

    private function redirectTargetAfterLogin(Request $request): string
    {
        $next = $this->safeNextPath($request->input('next') ?? $request->query('next'));

        if ($next !== null) {
            return $next;
        }

        return $request->user()?->role === User::ROLE_PATIENT
            ? '/beranda'
            : '/dashboard';
    }

    private function safeNextPath(mixed $next): ?string
    {
        if (!is_string($next) || $next === '') {
            return null;
        }

        if (!str_starts_with($next, '/') || str_starts_with($next, '//')) {
            return null;
        }

        if (preg_match('/[\r\n]/', $next) === 1) {
            return null;
        }

        return $next;
    }
}

