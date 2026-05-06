<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ReservationQueueService;
use App\Services\TimeWindowScheduler;
use App\Services\Web\WorkspaceViewService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class PatientHomeController extends Controller
{
    public function __construct(
        private readonly ReservationQueueService $queueService,
        private readonly TimeWindowScheduler $scheduler,
        private readonly WorkspaceViewService $workspace,
    ) {
    }

    public function index(Request $request): RedirectResponse|Response
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== User::ROLE_PATIENT) {
            return to_route('dashboard');
        }

        return Inertia::render('patient/home', [
            'userName' => $user->name,
            'currentReservation' => $this->currentReservation($user),
            'lastReservation' => $this->lastReservation($user),
            'clinics' => $this->clinicCards(),
            'doctors' => $this->doctorCards(),
        ]);
    }

    public function clinicsRedirect(): RedirectResponse
    {
        return redirect('/beranda#klinik');
    }

    public function doctorsRedirect(): RedirectResponse
    {
        return redirect('/beranda#dokter');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function currentReservation(User $user): ?array
    {
        $reservation = Reservation::query()
            ->with($this->reservationRelations())
            ->where('patient_id', $user->id)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereDate('reservation_date', '>=', Carbon::today()->toDateString())
            ->orderBy('reservation_date')
            ->orderBy('window_start_time')
            ->first();

        return $reservation !== null
            ? $this->queueService->serializeReservation($reservation)
            : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lastReservation(User $user): ?array
    {
        $reservation = Reservation::query()
            ->with($this->reservationRelations())
            ->where('patient_id', $user->id)
            ->whereNotIn('status', Reservation::ACTIVE_STATUSES)
            ->orderByDesc('reservation_date')
            ->orderByDesc('window_start_time')
            ->first();

        return $reservation !== null
            ? $this->queueService->serializeReservation($reservation)
            : null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function clinicCards(): array
    {
        return Clinic::query()
            ->with([
                'city:id,name',
                'doctors' => fn ($query) => $query
                    ->select(['users.id', 'users.name', 'users.username', 'users.email', 'users.image_path', 'users.profile_picture'])
                    ->orderBy('users.name'),
                'doctorClinicSchedules' => fn ($query) => $query
                    ->with('doctor:id,name')
                    ->where('is_active', true)
                    ->orderBy('day_of_week')
                    ->orderBy('start_time'),
            ])
            ->select(['id', 'name', 'address', 'city_id', 'phone_number', 'email', 'image_path'])
            ->orderBy('name')
            ->limit(12)
            ->get()
            ->map(function (Clinic $clinic): array {
                /** @var DoctorClinicSchedule|null $previewSchedule */
                $previewSchedule = $clinic->doctorClinicSchedules
                    ->sortBy(fn (DoctorClinicSchedule $schedule): int => $this->dayDistanceFromToday((int) $schedule->day_of_week) * 10000 + (int) str_replace(':', '', (string) $schedule->start_time))
                    ->first();

                return [
                    'id' => $clinic->id,
                    'name' => $clinic->name,
                    'address' => $clinic->address,
                    'city_name' => $clinic->city?->name,
                    'image_url' => $clinic->image_url,
                    'specialities' => $clinic->doctors
                        ->flatMap(fn (User $doctor): array => $this->workspace->pivotSpecialities($doctor->pivot?->speciality))
                        ->unique()
                        ->values()
                        ->all(),
                    'doctors' => $clinic->doctors
                        ->take(3)
                        ->map(fn (User $doctor): array => [
                            'id' => $doctor->id,
                            'name' => $doctor->name,
                            'specialities' => $this->workspace->pivotSpecialities($doctor->pivot?->speciality),
                        ])
                        ->values()
                        ->all(),
                    'slots' => $previewSchedule !== null
                        ? $this->scheduleSlotsPreview($previewSchedule, $this->nextDateForDay((int) $previewSchedule->day_of_week))
                        : [],
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function doctorCards(): array
    {
        return User::query()
            ->where('role', User::ROLE_DOCTOR)
            ->whereHas('clinics')
            ->with(['clinics' => fn ($query) => $query
                ->select(['clinics.id', 'clinics.name', 'clinics.city_id'])
                ->with('city:id,name')
                ->orderBy('clinics.name')])
            ->select(['id', 'name', 'username', 'email', 'phone_number', 'profile_picture', 'image_path', 'role'])
            ->orderBy('name')
            ->limit(12)
            ->get()
            ->map(fn (User $doctor): array => [
                'id' => $doctor->id,
                'name' => $doctor->name,
                'image_url' => $doctor->display_avatar_url,
                'clinics' => $doctor->clinics
                    ->take(4)
                    ->map(fn (Clinic $clinic): array => [
                        'id' => $clinic->id,
                        'name' => $clinic->name,
                        'city_name' => $clinic->city?->name,
                        'specialities' => $this->workspace->pivotSpecialities($clinic->pivot?->speciality),
                    ])
                    ->values()
                    ->all(),
                'specialities' => $doctor->clinics
                    ->flatMap(fn (Clinic $clinic): array => $this->workspace->pivotSpecialities($clinic->pivot?->speciality))
                    ->unique()
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{time: string, filled: int, capacity: int}>
     */
    private function scheduleSlotsPreview(DoctorClinicSchedule $schedule, string $date): array
    {
        $activeReservations = Reservation::query()
            ->where('doctor_clinic_schedule_id', $schedule->id)
            ->whereDate('reservation_date', $date)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->get(['window_start_time', 'window_slot_number'])
            ->groupBy(fn (Reservation $reservation): string => substr((string) $reservation->window_start_time, 0, 5));

        return collect($this->scheduler->generateWindows($schedule))
            ->take(3)
            ->map(function (array $window) use ($activeReservations, $schedule): array {
                $start = substr($window['window_start_time'], 0, 5);
                $end = substr($window['window_end_time'], 0, 5);
                /** @var Collection<int, Reservation> $filledReservations */
                $filledReservations = $activeReservations->get($start, collect());

                return [
                    'time' => $start.' - '.$end,
                    'filled' => $filledReservations
                        ->pluck('window_slot_number')
                        ->filter()
                        ->unique()
                        ->count(),
                    'capacity' => (int) $schedule->max_patients_per_window,
                ];
            })
            ->values()
            ->all();
    }

    private function nextDateForDay(int $dayOfWeek): string
    {
        $today = Carbon::today();
        $distance = $this->dayDistanceFromToday($dayOfWeek);

        return $today->copy()->addDays($distance)->toDateString();
    }

    private function dayDistanceFromToday(int $dayOfWeek): int
    {
        $todayDay = Carbon::today()->dayOfWeek;

        return ($dayOfWeek - $todayDay + 7) % 7;
    }

    /**
     * @return array<int, string>
     */
    private function reservationRelations(): array
    {
        return [
            'clinic:id,name,address,city_id,phone_number,email,image_path',
            'clinic.city:id,name',
            'doctor:id,name,username,email,phone_number,image_path,profile_picture,role',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
        ];
    }
}
