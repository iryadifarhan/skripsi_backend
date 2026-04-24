<?php

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

$workspaceContext = function (Request $request): array {
    /** @var User $user */
    $user = $request->user()->loadMissing([
        'clinic:id,name',
        'clinics:id,name',
    ]);

    $clinics = match ($user->role) {
        User::ROLE_ADMIN => $user->clinic !== null
            ? [['id' => $user->clinic->id, 'name' => $user->clinic->name]]
            : [],
        User::ROLE_DOCTOR => $user->clinics
            ->map(fn ($clinic): array => ['id' => $clinic->id, 'name' => $clinic->name])
            ->values()
            ->all(),
        default => [],
    };

    return [
        'role' => $user->role,
        'clinicId' => $user->role === User::ROLE_ADMIN ? $user->clinic_id : null,
        'clinics' => $clinics,
    ];
};

Route::get('/', function (Request $request) {
    if ($request->user()) {
        return to_route('dashboard');
    }

    return Inertia::render('welcome');
})->name('home');

Route::middleware('guest')->group(function (): void {
    Route::get('/login', fn (): Response => Inertia::render('auth/login'))->name('login');
    Route::get('/register', fn (): Response => Inertia::render('auth/register'))->name('register');
    Route::get('/forgot-password', fn (): Response => Inertia::render('auth/forgot-password'))->name('password.request');
    Route::get('/reset-password', function (Request $request) {
        $token = (string) $request->query('token', '');

        abort_if($token === '', 404);

        return to_route('password.reset', [
            'token' => $token,
            'email' => (string) $request->query('email', ''),
        ]);
    });
    Route::get('/reset-password/{token}', function (Request $request, string $token): Response {
        return Inertia::render('auth/reset-password', [
            'token' => $token,
            'email' => (string) $request->query('email', ''),
        ]);
    })->name('password.reset');
});

Route::middleware('auth')->group(function () use ($workspaceContext): void {
    Route::get('/reservations', function (Request $request) use ($workspaceContext): Response {
        return Inertia::render('reservations/index', [
            'context' => $workspaceContext($request),
        ]);
    })->name('reservations.page');

    Route::get('/reservation', function (Request $request) {
        return redirect()->route('reservations.page', $request->query());
    })->name('reservations.legacy');

    Route::get('/queue', function (Request $request) use ($workspaceContext): Response {
        return Inertia::render('queue/index', [
            'context' => $workspaceContext($request),
        ]);
    })->name('queue.page');

    Route::get('/medical-records', function (Request $request) use ($workspaceContext): Response {
        return Inertia::render('medical-records/index', [
            'context' => $workspaceContext($request),
        ]);
    })->name('medical-records.page');

    Route::get('/medical_record', function (Request $request) {
        return redirect()->route('medical-records.page', $request->query());
    })->name('medical-records.legacy');

    Route::get('/dashboard', function (Request $request): Response {
        $user = $request->user();

        return Inertia::render('dashboard', [
            'modules' => match ($user->role) {
                'superadmin' => [
                    ['title' => 'Clinic Management', 'description' => 'Create clinics, update clinic data, and manage doctor assignments.'],
                    ['title' => 'System Oversight', 'description' => 'Monitor multi-clinic growth while preserving clinic-scoped access control.'],
                ],
                'admin' => [
                    ['title' => 'Reservations', 'description' => 'Approve, reject, reschedule, and handle walk-in bookings.'],
                    ['title' => 'Queue Management', 'description' => 'Call, reorder, skip, and monitor active clinic queues.'],
                    ['title' => 'Reports', 'description' => 'Export reservation and medical-record recaps in PDF or Excel format.'],
                ],
                'doctor' => [
                    ['title' => 'Doctor Queue', 'description' => 'Follow the current queue line and monitor pending patients.'],
                    ['title' => 'Medical Records', 'description' => 'Complete consultations by issuing a medical record.'],
                ],
                default => [
                    ['title' => 'My Reservations', 'description' => 'Review reservation history, statuses, and reschedule outcomes.'],
                    ['title' => 'My Queue', 'description' => 'Track queue position and current clinic progress in real time.'],
                    ['title' => 'Medical Records', 'description' => 'Access completed consultation results securely by clinic scope.'],
                ],
            },
        ]);
    })->name('dashboard');

    Route::post('/logout', function (Request $request) {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('login');
    })->name('logout');
});
