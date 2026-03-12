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

        abort(403, 'Forbidden, you are not authorized as an admin to this clinic.');
    }

    private function authorizeClinicDoctor(User $user, Clinic $clinic): void
    {
        if ($user->clinics()->whereKey($clinic->id)->exists()) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized as a doctor to this clinic.');
    }

    private function resolveClinicFromRequest(Request $request): Clinic
    {
        $clinicId = $request->input('clinic_id');

        if ($clinicId === null || $clinicId === '') {
            abort(422, 'clinic_id is required for clinic-scoped access.');
        }

        $clinic = Clinic::where('id', $clinicId)->first();

        if (!$clinic) {
            abort(404, 'Clinic id provided is not found or deleted.');
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

        // Check if user role is in allowed roles (ignoring 'clinic-scoped' flag)
        $allowedRoles = array_values(array_filter($roles, fn (string $role): bool => $role !== 'clinic-scoped'));

        if (!in_array($user->role, $allowedRoles, true)) {
            return response()->json(['message' => 'Forbidden, you are not authorized.'], 403);
        }

        // Decide if clinic scope check is needed based on presence of 'clinic-scoped' flag
        $requiresClinicScope = in_array('clinic-scoped', $roles, true) && in_array($user->role, User::CLINIC_SCOPED_ROLES, true);

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
