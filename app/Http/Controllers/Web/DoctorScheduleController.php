<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\User;
use App\Services\Web\WorkspaceViewService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DoctorScheduleController extends Controller
{
    public function __construct(
        private readonly WorkspaceViewService $workspace,
    ) {}

    public function page(Request $request): Response
    {
        /** @var User $doctor */
        $doctor = $request->user();
        abort_unless($doctor->role === User::ROLE_DOCTOR, 403);

        $context = $this->workspace->context($request);
        $requestedClinicId = $request->integer('clinic_id') ?: null;
        $assignedClinicIds = collect($context['clinics'])->pluck('id')->map(fn ($id): int => (int) $id);
        $selectedClinicId = $requestedClinicId ?? $assignedClinicIds->first();

        if ($requestedClinicId !== null) {
            abort_unless($assignedClinicIds->contains((int) $requestedClinicId), 403);
        }

        $clinic = $selectedClinicId !== null
            ? Clinic::query()
                ->whereKey($selectedClinicId)
                ->with([
                    'doctors:id,name,username,email,phone_number,date_of_birth,gender,profile_picture,image_path,role',
                    'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
                ])
                ->first()
            : null;

        return Inertia::render('doctor-schedules/index', [
            'context' => $context,
            'doctorId' => $doctor->id,
            'selectedClinicId' => $clinic?->id,
            'clinic' => $clinic !== null ? $this->workspace->serializeClinicDetail($clinic) : null,
            'schedules' => $clinic !== null ? $this->doctorSchedules($doctor, $clinic) : [],
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function doctorSchedules(User $doctor, Clinic $clinic): array
    {
        return DoctorClinicSchedule::query()
            ->where('doctor_id', $doctor->id)
            ->where('clinic_id', $clinic->id)
            ->orderByRaw('CASE day_of_week WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 4 WHEN 5 THEN 5 WHEN 6 THEN 6 WHEN 0 THEN 7 END')
            ->orderBy('start_time')
            ->get()
            ->map(fn (DoctorClinicSchedule $schedule): array => [
                'id' => $schedule->id,
                'clinic_id' => $schedule->clinic_id,
                'doctor_id' => $schedule->doctor_id,
                'day_of_week' => $schedule->day_of_week,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'window_minutes' => $schedule->window_minutes,
                'max_patients_per_window' => $schedule->max_patients_per_window,
                'is_active' => (bool) $schedule->is_active,
            ])
            ->values()
            ->all();
    }
}
