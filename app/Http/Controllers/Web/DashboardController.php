<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ReservationQueueService;
use App\Services\TimeWindowScheduler;
use App\Services\Web\WorkspaceViewService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        private readonly WorkspaceViewService $workspace,
        private readonly ReservationQueueService $queueService,
        private readonly TimeWindowScheduler $scheduler,
    ) {}

    public function home(Request $request): RedirectResponse|Response
    {
        if ($request->user()?->role === User::ROLE_PATIENT) {
            return to_route('patient.home');
        }

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
            $today = Carbon::today();
            $todayDate = $today->toDateString();
            $scheduleSelection = $this->scheduleSelection($request, $today);
            $selectedScheduleDay = $scheduleSelection['day'];
            $selectedScheduleDate = $scheduleSelection['date'];
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
                ->whereDate('reservation_date', $todayDate)
                ->orderBy('queue_number')
                ->orderBy('window_start_time')
                ->get()
                ->filter(fn (Reservation $reservation): bool => $this->queueService->isActiveQueueReservation($reservation))
                ->values();
            $scheduleModels = DoctorClinicSchedule::query()
                ->with('doctor:id,name')
                ->where('clinic_id', $selectedClinic->id)
                ->where('day_of_week', $selectedScheduleDay)
                ->orderBy('start_time')
                ->get();
            $reservationsBySchedule = $this->activeReservationsBySchedule($scheduleModels, $selectedScheduleDate);
            $schedules = $scheduleModels
                ->map(fn (DoctorClinicSchedule $schedule): array => [
                    'id' => $schedule->id,
                    'doctor_id' => $schedule->doctor_id,
                    'doctor_name' => $schedule->doctor?->name ?? '-',
                    'day_of_week' => $schedule->day_of_week,
                    'day_label' => $this->dayLabel((int) $schedule->day_of_week),
                    'schedule_date' => $selectedScheduleDate,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'window_minutes' => $schedule->window_minutes,
                    'max_patients_per_window' => $schedule->max_patients_per_window,
                    'is_active' => (bool) $schedule->is_active,
                    ...$this->scheduleSlotPayload(
                        $schedule,
                        $reservationsBySchedule->get($schedule->id, collect()),
                    ),
                ])
                ->values()
                ->all();

            $dashboardData = [
                'selectedClinicId' => $selectedClinic->id,
                'clinic' => $this->workspace->serializeClinicDetail($selectedClinic),
                'reservations' => $this->queueService->serializeReservations($reservations),
                'queues' => $this->queueService->serializeQueueEntries($queueReservations, true),
                'schedules' => $schedules,
                'today' => $todayDate,
                'selectedScheduleDay' => $selectedScheduleDay,
                'selectedScheduleDayLabel' => $this->dayLabel($selectedScheduleDay),
                'selectedScheduleMonth' => $scheduleSelection['month'],
                'selectedScheduleWeek' => $scheduleSelection['week'],
                'selectedScheduleDate' => $selectedScheduleDate,
                'selectedScheduleDateLabel' => $this->formatDateLabel($selectedScheduleDate),
                'scheduleWeekOptions' => $scheduleSelection['week_options'],
                'scheduleDayOptions' => $scheduleSelection['day_options'],
            ];
        }

        $doctorDashboardData = $user->role === User::ROLE_DOCTOR
            ? $this->doctorDashboardData($request, $user, $context)
            : null;

        return Inertia::render('dashboard', [
            'context' => $context,
            'dashboardData' => $dashboardData,
            'doctorDashboardData' => $doctorDashboardData,
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

    /**
     * @return array{
     *     month: string,
     *     week: int,
     *     day: int,
     *     date: string,
     *     week_options: array<int, array{value: int, label: string, start_date: string, end_date: string}>,
     *     day_options: array<int, array{date: string, day_of_week: int, label: string}>
     * }
     */
    private function scheduleSelection(Request $request, Carbon $today): array
    {
        $month = $this->selectedScheduleMonth($request, $today);
        $monthStart = Carbon::createFromFormat('Y-m-d', $month.'-01')->startOfDay();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $weekOptions = $this->scheduleWeekOptions($monthStart, $monthEnd);
        $requestedDay = $this->requestedScheduleDay($request);
        $requestedWeek = $this->requestedScheduleWeek($request, count($weekOptions));
        $isCurrentMonth = $month === $today->format('Y-m');

        if ($requestedWeek === null && $requestedDay !== null) {
            $selectedDate = $this->firstDateForDayInMonth($monthStart, $monthEnd, $requestedDay)
                ?? ($isCurrentMonth ? $today->copy() : $monthStart->copy());
            $selectedWeek = $this->weekOfMonth($selectedDate);
        } elseif ($requestedWeek === null) {
            $selectedDate = $isCurrentMonth ? $today->copy() : $monthStart->copy();
            $selectedWeek = $this->weekOfMonth($selectedDate);
        } else {
            $selectedWeek = $requestedWeek;
            [$weekStart, $weekEnd] = $this->weekRange($monthStart, $monthEnd, $selectedWeek);
            $defaultDay = $today->betweenIncluded($weekStart, $weekEnd)
                ? $today->dayOfWeek
                : $weekStart->dayOfWeek;
            $selectedDay = $requestedDay ?? $defaultDay;
            $selectedDate = $this->firstDateForDayInRange($weekStart, $weekEnd, $selectedDay) ?? $weekStart;
        }

        $selectedWeek = min(max(1, $selectedWeek), max(1, count($weekOptions)));
        [$weekStart, $weekEnd] = $this->weekRange($monthStart, $monthEnd, $selectedWeek);

        if ($selectedDate->lt($weekStart) || $selectedDate->gt($weekEnd)) {
            $selectedDate = $weekStart->copy();
        }

        return [
            'month' => $month,
            'week' => $selectedWeek,
            'day' => $selectedDate->dayOfWeek,
            'date' => $selectedDate->toDateString(),
            'week_options' => $weekOptions,
            'day_options' => $this->scheduleDayOptions($weekStart, $weekEnd),
        ];
    }

    private function selectedScheduleMonth(Request $request, Carbon $today): string
    {
        $rawMonth = $request->query('schedule_month');

        if (is_string($rawMonth) && preg_match('/^\d{4}-\d{2}$/', $rawMonth) === 1) {
            try {
                Carbon::createFromFormat('Y-m-d', $rawMonth.'-01');

                return $rawMonth;
            } catch (\Throwable) {
                // Fall through to today's month.
            }
        }

        return $today->format('Y-m');
    }

    private function requestedScheduleDay(Request $request): ?int
    {
        $rawDay = $request->query('schedule_day');

        if (is_scalar($rawDay) && ctype_digit((string) $rawDay)) {
            $day = (int) $rawDay;

            if ($day >= 0 && $day <= 6) {
                return $day;
            }
        }

        return null;
    }

    private function requestedScheduleWeek(Request $request, int $weekCount): ?int
    {
        $rawWeek = $request->query('schedule_week');

        if (is_scalar($rawWeek) && ctype_digit((string) $rawWeek)) {
            $week = (int) $rawWeek;

            if ($week >= 1 && $week <= max(1, $weekCount)) {
                return $week;
            }
        }

        return null;
    }

    /**
     * @return array<int, array{value: int, label: string, start_date: string, end_date: string}>
     */
    private function scheduleWeekOptions(Carbon $monthStart, Carbon $monthEnd): array
    {
        $weekCount = (int) ceil($monthEnd->day / 7);
        $options = [];

        for ($week = 1; $week <= $weekCount; $week++) {
            [$start, $end] = $this->weekRange($monthStart, $monthEnd, $week);
            $options[] = [
                'value' => $week,
                'label' => 'Minggu ke-'.$week,
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
            ];
        }

        return $options;
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function weekRange(Carbon $monthStart, Carbon $monthEnd, int $week): array
    {
        $start = $monthStart->copy()->addDays(($week - 1) * 7);
        $end = $start->copy()->addDays(6)->min($monthEnd);

        return [$start, $end];
    }

    /**
     * @return array<int, array{date: string, day_of_week: int, label: string}>
     */
    private function scheduleDayOptions(Carbon $weekStart, Carbon $weekEnd): array
    {
        $days = [];
        $cursor = $weekStart->copy();

        while ($cursor->lte($weekEnd)) {
            $days[] = [
                'date' => $cursor->toDateString(),
                'day_of_week' => $cursor->dayOfWeek,
                'label' => $this->dayLabel($cursor->dayOfWeek).' '.$cursor->format('d/m'),
            ];
            $cursor->addDay();
        }

        return $days;
    }

    private function weekOfMonth(Carbon $date): int
    {
        return (int) ceil($date->day / 7);
    }

    private function firstDateForDayInMonth(Carbon $monthStart, Carbon $monthEnd, int $dayOfWeek): ?Carbon
    {
        return $this->firstDateForDayInRange($monthStart, $monthEnd, $dayOfWeek);
    }

    private function firstDateForDayInRange(Carbon $start, Carbon $end, int $dayOfWeek): ?Carbon
    {
        $cursor = $start->copy();

        while ($cursor->lte($end)) {
            if ($cursor->dayOfWeek === $dayOfWeek) {
                return $cursor;
            }

            $cursor->addDay();
        }

        return null;
    }

    /**
     * @param  Collection<int, DoctorClinicSchedule>  $schedules
     * @return Collection<int, Collection<int, Reservation>>
     */
    private function activeReservationsBySchedule(Collection $schedules, string $reservationDate): Collection
    {
        if ($schedules->isEmpty()) {
            return collect();
        }

        return Reservation::query()
            ->whereIn('doctor_clinic_schedule_id', $schedules->pluck('id'))
            ->whereDate('reservation_date', $reservationDate)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->get(['doctor_clinic_schedule_id', 'reservation_date', 'window_start_time', 'window_slot_number'])
            ->groupBy('doctor_clinic_schedule_id');
    }

    /**
     * @param  Collection<int, Reservation>  $activeReservations
     * @return array{
     *     slot_summary: array{total_windows: int, total_capacity: int, booked_slots: int, available_slots: int},
     *     windows: array<int, array{window_start_time: string, window_end_time: string, max_slots: int, booked_slots: int, available_slots: int, slot_numbers_available: array<int, int>, is_available: bool}>
     * }
     */
    private function scheduleSlotPayload(
        DoctorClinicSchedule $schedule,
        Collection $activeReservations,
    ): array {
        $windows = array_map(function (array $window) use ($activeReservations, $schedule): array {
            $windowStart = $this->normalizeTimeString($window['window_start_time']);
            $windowStartPrefix = substr($windowStart, 0, 5);

            $usedSlots = $activeReservations
                ->filter(
                    fn (Reservation $reservation): bool =>
                        substr($this->normalizeTimeString((string) $reservation->window_start_time), 0, 5) === $windowStartPrefix
                )
                ->pluck('window_slot_number')
                ->filter(fn ($slot): bool => $slot !== null && $slot !== '')
                ->map(fn ($slot): int => (int) $slot)
                ->filter(fn (int $slot): bool => $slot > 0)
                ->unique()
                ->sort()
                ->values()
                ->all();

            $availableSlotNumbers = [];

            if ($schedule->is_active) {
                for ($slot = 1; $slot <= $schedule->max_patients_per_window; $slot++) {
                    if (!in_array($slot, $usedSlots, true)) {
                        $availableSlotNumbers[] = $slot;
                    }
                }
            }

            $availableSlots = count($availableSlotNumbers);

            return [
                'window_start_time' => $windowStart,
                'window_end_time' => $this->normalizeTimeString($window['window_end_time']),
                'max_slots' => (int) $schedule->max_patients_per_window,
                'booked_slots' => count($usedSlots),
                'available_slots' => $availableSlots,
                'slot_numbers_available' => $availableSlotNumbers,
                'is_available' => (bool) $schedule->is_active && $availableSlots > 0,
            ];
        }, $this->scheduler->generateWindows($schedule));

        return [
            'slot_summary' => [
                'total_windows' => count($windows),
                'total_capacity' => array_sum(array_column($windows, 'max_slots')),
                'booked_slots' => array_sum(array_column($windows, 'booked_slots')),
                'available_slots' => array_sum(array_column($windows, 'available_slots')),
            ],
            'windows' => $windows,
        ];
    }

    private function formatDateLabel(string $date): string
    {
        return Carbon::parse($date)->format('d M Y');
    }

    private function dayLabel(int $day): string
    {
        return [
            0 => 'Minggu',
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
        ][$day] ?? 'Hari ini';
    }

    /**
     * @param  array{role: string, clinicId: int|null, clinics: array<int, array{id: int, name: string}>}  $context
     * @return array<string, mixed>|null
     */
    private function doctorDashboardData(Request $request, User $doctor, array $context): ?array
    {
        $selectedClinic = $this->selectedDoctorClinic($request, $doctor, $context);

        if ($selectedClinic === null) {
            return null;
        }

        $today = Carbon::today();
        $todayDate = $today->toDateString();

        $todayReservations = Reservation::query()
            ->with($this->workspace->reservationRelations())
            ->where('clinic_id', $selectedClinic->id)
            ->where('doctor_id', $doctor->id)
            ->whereDate('reservation_date', $todayDate)
            ->orderBy('queue_number')
            ->orderBy('window_start_time')
            ->get();

        $queueReservations = $todayReservations
            ->filter(fn (Reservation $reservation): bool => $reservation->status === Reservation::STATUS_APPROVED && $this->queueService->isActiveQueueReservation($reservation))
            ->values();

        $medicalRecordsToday = MedicalRecord::query()
            ->with([
                'patient:id,name,username,email,phone_number',
                'doctor:id,name',
                'clinic:id,name',
                'reservation:id,reservation_number,reservation_date,window_start_time,window_end_time,status,complaint,reschedule_reason',
            ])
            ->where('clinic_id', $selectedClinic->id)
            ->where('doctor_id', $doctor->id)
            ->whereDate('issued_at', $todayDate)
            ->orderByDesc('issued_at')
            ->get();

        $latestMedicalRecords = MedicalRecord::query()
            ->with([
                'patient:id,name,username,email,phone_number',
                'doctor:id,name',
                'clinic:id,name',
                'reservation:id,reservation_number,reservation_date,window_start_time,window_end_time,status,complaint,reschedule_reason',
            ])
            ->where('clinic_id', $selectedClinic->id)
            ->where('doctor_id', $doctor->id)
            ->orderByDesc('issued_at')
            ->limit(10)
            ->get();

        $schedules = DoctorClinicSchedule::query()
            ->where('clinic_id', $selectedClinic->id)
            ->where('doctor_id', $doctor->id)
            ->orderByRaw('CASE WHEN day_of_week = 0 THEN 7 ELSE day_of_week END')
            ->orderBy('start_time')
            ->get()
            ->map(fn (DoctorClinicSchedule $schedule): array => [
                'id' => $schedule->id,
                'doctor_id' => $schedule->doctor_id,
                'doctor_name' => $doctor->name,
                'day_of_week' => $schedule->day_of_week,
                'day_label' => $this->dayLabel((int) $schedule->day_of_week),
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'window_minutes' => $schedule->window_minutes,
                'max_patients_per_window' => $schedule->max_patients_per_window,
                'is_active' => (bool) $schedule->is_active,
            ])
            ->values()
            ->all();

        $activeQueues = $this->queueService->serializeQueueEntries($queueReservations, true);
        $currentPatient = collect($activeQueues)
            ->firstWhere('queue.status', Reservation::QUEUE_STATUS_IN_PROGRESS)
            ?? collect($activeQueues)->firstWhere('queue.status', Reservation::QUEUE_STATUS_CALLED);

        return [
            'selectedClinicId' => $selectedClinic->id,
            'clinic' => $this->workspace->serializeClinicDetail($selectedClinic),
            'today' => $todayDate,
            'stats' => [
                'today_reservations' => $todayReservations->count(),
                'waiting_queues' => $queueReservations->where('queue_status', Reservation::QUEUE_STATUS_WAITING)->count(),
                'called_or_in_progress' => $queueReservations
                    ->whereIn('queue_status', [Reservation::QUEUE_STATUS_CALLED, Reservation::QUEUE_STATUS_IN_PROGRESS])
                    ->count(),
                'completed_today' => $todayReservations->where('status', Reservation::STATUS_COMPLETED)->count(),
                'medical_records_today' => $medicalRecordsToday->count(),
            ],
            'queues' => $activeQueues,
            'currentPatient' => $currentPatient,
            'latestMedicalRecords' => $this->serializeDoctorMedicalRecords($latestMedicalRecords),
            'schedules' => $schedules,
        ];
    }

    /**
     * @param  array{role: string, clinicId: int|null, clinics: array<int, array{id: int, name: string}>}  $context
     */
    private function selectedDoctorClinic(Request $request, User $doctor, array $context): ?Clinic
    {
        $clinicIds = collect($context['clinics'])->pluck('id')->map(fn ($id): int => (int) $id);

        if ($clinicIds->isEmpty()) {
            return null;
        }

        $requestedClinicId = $request->integer('clinic_id') ?: (int) $clinicIds->first();

        if (!$clinicIds->contains($requestedClinicId)) {
            $requestedClinicId = (int) $clinicIds->first();
        }

        return $doctor->clinics()->whereKey($requestedClinicId)->first();
    }

    /**
     * @param  iterable<int, MedicalRecord>  $medicalRecords
     * @return array<int, array<string, mixed>>
     */
    private function serializeDoctorMedicalRecords(iterable $medicalRecords): array
    {
        return collect($medicalRecords)->map(function (MedicalRecord $medicalRecord): array {
            return [
                'id' => $medicalRecord->id,
                'reservation_id' => $medicalRecord->reservation_id,
                'patient_id' => $medicalRecord->patient_id,
                'guest_name' => $medicalRecord->guest_name,
                'guest_phone_number' => $medicalRecord->guest_phone_number,
                'clinic_id' => $medicalRecord->clinic_id,
                'doctor_id' => $medicalRecord->doctor_id,
                'diagnosis' => $medicalRecord->diagnosis,
                'treatment' => $medicalRecord->treatment,
                'prescription_notes' => $medicalRecord->prescription_notes,
                'doctor_notes' => $medicalRecord->doctor_notes,
                'issued_at' => $medicalRecord->issued_at,
                'patient' => $medicalRecord->patient,
                'doctor' => $medicalRecord->doctor,
                'clinic' => $medicalRecord->clinic,
                'reservation' => $medicalRecord->reservation === null ? null : [
                    'id' => $medicalRecord->reservation->id,
                    'reservation_number' => $medicalRecord->reservation->reservation_number,
                    'reservation_date' => $this->normalizeDateValue($medicalRecord->reservation->reservation_date),
                    'window_start_time' => $medicalRecord->reservation->window_start_time,
                    'window_end_time' => $medicalRecord->reservation->window_end_time,
                    'status' => $medicalRecord->reservation->status,
                    'complaint' => $medicalRecord->reservation->complaint,
                    'reschedule_reason' => $medicalRecord->reservation->reschedule_reason,
                ],
            ];
        })->values()->all();
    }

    private function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return $value->toDateString();
        }

        return substr((string) $value, 0, 10);
    }

    private function normalizeTimeString(string $value): string
    {
        if (strlen($value) === 5) {
            return $value.':00';
        }

        return substr($value, 0, 8);
    }
}
