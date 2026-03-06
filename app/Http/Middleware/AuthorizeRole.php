<?php

namespace App\Http\Middleware;

use App\Models\Clinic;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthorizeRole
{
    private function authorizeClinicAdmin(User $user, Clinic $clinic): void
    {
        if ((int) $user->clinic_id === (int) $clinic->id) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to this clinic.');
    }

    private function authorizeClinicDoctor(User $user, Clinic $clinic): void
    {
        if ($user->clinics()->whereKey($clinic->id)->exists()) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to this clinic.');
    }

    private function resolveClinicFromRequest(Request $request): Clinic
    {
        $clinicName = $request->input('clinic_name');

        if (!is_string($clinicName) || $clinicName === '') {
            abort(422, 'clinic_name is required for clinic-scoped access.');
        }

        $clinic = Clinic::where('name', $clinicName)->first();

        if (!$clinic) {
            abort(404, 'Clinic name provided is not found at database.');
        }

        return $clinic;
    }

    /**
     * Roles example (can be combined): authorize:admin,doctor,clinic-scoped.
     * "clinic-scoped" is a special flag, not a user role.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized, you are not authenticated.'], 401);
        }

        // Superadmin get bypass for all access
        if ($user->role === User::ROLE_SUPERADMIN) {
            return $next($request);
        }

        $requiresClinicScope = in_array('clinic-scoped', $roles, true);
        $allowedRoles = array_values(array_filter($roles, fn (string $role): bool => $role !== 'clinic-scoped'));

        if (!in_array($user->role, $allowedRoles, true)) {
            return response()->json(['message' => 'Forbidden, you are not authorized.'], 403);
        }

        if (!$requiresClinicScope) {
            return $next($request);
        }

        $clinic = $this->resolveClinicFromRequest($request);

        if ($user->role === User::ROLE_ADMIN) {
            $this->authorizeClinicAdmin($user, $clinic);
            return $next($request);
        }

        if ($user->role === User::ROLE_DOCTOR) {
            $this->authorizeClinicDoctor($user, $clinic);
            return $next($request);
        }

        return response()->json(['message' => 'Forbidden, you are not authorized.'], 403);
    }
}
