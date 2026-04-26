<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ReservationQueueService;
use App\Services\Web\WorkspaceViewService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        private readonly WorkspaceViewService $workspace,
        private readonly ReservationQueueService $queueService,
    ) {}

    public function home(Request $request): RedirectResponse|Response
    {
        if ($request->user()) {
            return to_route('dashboard');
        }

        return Inertia::render('welcome');
    }

    public function dashboard(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $context = $this->workspace->context($request);
        $selectedClinic = $this->workspace->selectedClinic($request, $context);
        $dashboardData = null;

        if (in_array($user->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true) && $selectedClinic !== null) {
            $today = Carbon::today()->toDateString();
            $reservations = Reservation::query()
                ->with($this->workspace->reservationRelations())
                ->where('clinic_id', $selectedClinic->id)
                ->orderByDesc('reservation_date')
                ->orderByDesc('window_start_time')
                ->limit(20)
                ->get();
            $queueReservations = Reservation::query()
                ->with($this->workspace->reservationRelations())
                ->where('clinic_id', $selectedClinic->id)
                ->whereDate('reservation_date', $today)
                ->orderBy('queue_number')
                ->orderBy('window_start_time')
                ->get()
                ->filter(fn (Reservation $reservation): bool => $this->queueService->isActiveQueueReservation($reservation))
                ->values();
            $dayOfWeek = Carbon::parse($today)->dayOfWeek;
            $schedules = DoctorClinicSchedule::query()
                ->with('doctor:id,name')
                ->where('clinic_id', $selectedClinic->id)
                ->where('day_of_week', $dayOfWeek)
                ->orderBy('start_time')
                ->get()
                ->map(fn (DoctorClinicSchedule $schedule): array => [
                    'id' => $schedule->id,
                    'doctor_id' => $schedule->doctor_id,
                    'doctor_name' => $schedule->doctor?->name ?? '-',
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'window_minutes' => $schedule->window_minutes,
                    'max_patients_per_window' => $schedule->max_patients_per_window,
                    'is_active' => (bool) $schedule->is_active,
                ])
                ->values()
                ->all();

            $dashboardData = [
                'selectedClinicId' => $selectedClinic->id,
                'clinic' => $this->workspace->serializeClinicDetail($selectedClinic),
                'reservations' => $this->queueService->serializeReservations($reservations),
                'queues' => $this->queueService->serializeQueueEntries($queueReservations, true),
                'schedules' => $schedules,
                'today' => $today,
            ];
        }

        return Inertia::render('dashboard', [
            'context' => $context,
            'dashboardData' => $dashboardData,
            'modules' => $this->dashboardModules($user->role),
        ]);
    }

    public function logout(Request $request): JsonResponse|RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Logout successful.',
            ]);
        }

        return to_route('login');
    }

    /**
     * @return array<int, array{title: string, description: string}>
     */
    private function dashboardModules(string $role): array
    {
        return match ($role) {
            User::ROLE_SUPERADMIN => [
                ['title' => 'Clinic Management', 'description' => 'Create clinics, update clinic data, and manage doctor assignments.'],
                ['title' => 'System Oversight', 'description' => 'Monitor multi-clinic growth while preserving clinic-scoped access control.'],
            ],
            User::ROLE_ADMIN => [
                ['title' => 'Reservations', 'description' => 'Approve, reject, reschedule, and handle walk-in bookings.'],
                ['title' => 'Queue Management', 'description' => 'Call, reorder, skip, and monitor active clinic queues.'],
                ['title' => 'Reports', 'description' => 'Export reservation and medical-record recaps in PDF or Excel format.'],
            ],
            User::ROLE_DOCTOR => [
                ['title' => 'Doctor Queue', 'description' => 'Follow the current queue line and monitor pending patients.'],
                ['title' => 'Medical Records', 'description' => 'Complete consultations by issuing a medical record.'],
            ],
            default => [
                ['title' => 'My Reservations', 'description' => 'Review reservation history, statuses, and reschedule outcomes.'],
                ['title' => 'My Queue', 'description' => 'Track queue position and current clinic progress in real time.'],
                ['title' => 'Medical Records', 'description' => 'Access completed consultation results securely by clinic scope.'],
            ],
        };
    }
}
