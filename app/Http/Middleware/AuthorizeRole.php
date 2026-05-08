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

        abort(403, 'Akses ditolak. Anda tidak memiliki izin sebagai admin untuk klinik ini.');
    }

    private function authorizeClinicDoctor(User $user, Clinic $clinic): void
    {
        if ($user->clinics()->whereKey($clinic->id)->exists()) {
            return;
        }

        abort(403, 'Akses ditolak. Anda tidak memiliki izin sebagai dokter untuk klinik ini.');
    }

    private function resolveClinicFromRequest(Request $request): Clinic
    {
        $clinicId = $request->input('clinic_id');

        if ($clinicId === null || $clinicId === '') {
            abort(422, 'clinic_id wajib diisi untuk akses berbasis klinik.');
        }

        $clinic = Clinic::where('id', $clinicId)->first();

        if (!$clinic) {
            abort(404, 'ID klinik yang diberikan tidak ditemukan atau sudah dihapus.');
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
            return response()->json(['message' => 'Tidak terautentikasi. Silakan masuk terlebih dahulu.'], 401);
        }

        // Superadmin get bypass for all access
        if ($user->role === User::ROLE_SUPERADMIN) {
            return $next($request);
        }

        // Check if user role is in allowed roles (ignoring 'clinic-scoped' flag)
        $allowedRoles = array_values(array_filter($roles, fn (string $role): bool => $role !== 'clinic-scoped'));

        if (!in_array($user->role, $allowedRoles, true)) {
            return response()->json(['message' => 'Akses ditolak. Anda tidak memiliki izin.'], 403);
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

        return response()->json(['message' => 'Akses ditolak. Anda tidak memiliki izin.'], 403);
    }
}
