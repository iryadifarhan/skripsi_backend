<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\ClinicCity;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Services\TimeWindowScheduler;
use App\Services\Web\WorkspaceViewService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PublicDirectoryController extends Controller
{
    /**
     * @var array<int, string>
     */
    private const DAY_NAMES = [
        0 => 'Minggu',
        1 => 'Senin',
        2 => 'Selasa',
        3 => 'Rabu',
        4 => 'Kamis',
        5 => 'Jumat',
        6 => 'Sabtu',
    ];

    /**
     * @var array<int, int>
     */
    private const MONDAY_FIRST_ORDER = [
        1 => 1,
        2 => 2,
        3 => 3,
        4 => 4,
        5 => 5,
        6 => 6,
        0 => 7,
    ];

    public function __construct(
        private readonly TimeWindowScheduler $scheduler,
        private readonly WorkspaceViewService $workspace,
    ) {
    }

    public function clinics(Request $request): Response
    {
        $clinics = Clinic::query()
            ->with([
                'city:id,name',
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
                'doctors' => fn ($query) => $query
                    ->select(['users.id', 'users.name', 'users.username', 'users.email', 'users.phone_number', 'users.profile_picture', 'users.image_path', 'users.role'])
                    ->orderBy('users.name'),
                'doctorClinicSchedules' => fn ($query) => $query
                    ->with('doctor:id,name,username,email,phone_number,profile_picture,image_path,role')
                    ->where('is_active', true)
                    ->orderBy('day_of_week')
                    ->orderBy('start_time'),
            ])
            ->select(['id', 'name', 'address', 'city_id', 'phone_number', 'email', 'image_path'])
            ->orderBy('name')
            ->get()
            ->map(fn (Clinic $clinic): array => $this->serializeClinic($clinic))
            ->values();

        return Inertia::render('public/clinics/index', [
            'clinics' => $clinics,
            'filters' => $this->filtersFromClinicCards($clinics),
        ]);
    }

    public function clinic(string $clinicSlug): Response
    {
        $clinic = $this->findClinicBySlug($clinicSlug);

        return Inertia::render('public/clinics/show', [
            'clinic' => $this->serializeClinic($clinic, includeDoctors: true),
        ]);
    }

    public function doctors(Request $request): Response
    {
        $doctors = User::query()
            ->where('role', User::ROLE_DOCTOR)
            ->whereHas('clinics')
            ->with([
                'clinics' => fn ($query) => $query
                    ->select(['clinics.id', 'clinics.name', 'clinics.address', 'clinics.city_id', 'clinics.phone_number', 'clinics.email', 'clinics.image_path'])
                    ->with('city:id,name')
                    ->orderBy('clinics.name'),
                'doctorClinicSchedules' => fn ($query) => $query
                    ->with('clinic:id,name,address,city_id,phone_number,email,image_path')
                    ->where('is_active', true)
                    ->orderBy('day_of_week')
                    ->orderBy('start_time'),
            ])
            ->select(['id', 'name', 'username', 'email', 'phone_number', 'profile_picture', 'image_path', 'role'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $doctor): array => $this->serializeDoctor($doctor))
            ->values();

        return Inertia::render('public/doctors/index', [
            'doctors' => $doctors,
            'filters' => $this->filtersFromDoctorCards($doctors),
        ]);
    }

    public function doctor(string $doctorSlug): Response
    {
        $doctor = $this->findDoctorBySlug($doctorSlug);

        return Inertia::render('public/doctors/show', [
            'doctor' => $this->serializeDoctor($doctor),
        ]);
    }

    private function findClinicBySlug(string $clinicSlug): Clinic
    {
        $clinic = Clinic::query()
            ->with([
                'city:id,name',
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
                'doctors' => fn ($query) => $query
                    ->select(['users.id', 'users.name', 'users.username', 'users.email', 'users.phone_number', 'users.profile_picture', 'users.image_path', 'users.role'])
                    ->orderBy('users.name'),
                'doctorClinicSchedules' => fn ($query) => $query
                    ->with('doctor:id,name,username,email,phone_number,profile_picture,image_path,role')
                    ->where('is_active', true)
                    ->orderBy('day_of_week')
                    ->orderBy('start_time'),
            ])
            ->select(['id', 'name', 'address', 'city_id', 'phone_number', 'email', 'image_path'])
            ->get()
            ->first(fn (Clinic $clinic): bool => Str::slug($clinic->name) === $clinicSlug);

        abort_if($clinic === null, 404);

        return $clinic;
    }

    private function findDoctorBySlug(string $doctorSlug): User
    {
        $doctor = User::query()
            ->where('role', User::ROLE_DOCTOR)
            ->whereHas('clinics')
            ->with([
                'clinics' => fn ($query) => $query
                    ->select(['clinics.id', 'clinics.name', 'clinics.address', 'clinics.city_id', 'clinics.phone_number', 'clinics.email', 'clinics.image_path'])
                    ->with('city:id,name')
                    ->orderBy('clinics.name'),
                'doctorClinicSchedules' => fn ($query) => $query
                    ->with('clinic:id,name,address,city_id,phone_number,email,image_path')
                    ->where('is_active', true)
                    ->orderBy('day_of_week')
                    ->orderBy('start_time'),
            ])
            ->select(['id', 'name', 'username', 'email', 'phone_number', 'profile_picture', 'image_path', 'role'])
            ->get()
            ->first(fn (User $doctor): bool => Str::slug($doctor->name) === $doctorSlug);

        abort_if($doctor === null, 404);

        return $doctor;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeClinic(Clinic $clinic, bool $includeDoctors = false): array
    {
        $specialities = $clinic->doctors
            ->flatMap(fn (User $doctor): array => $this->workspace->pivotSpecialities($doctor->pivot?->speciality))
            ->unique()
            ->values()
            ->all();
        $operatingHours = $this->serializeOperatingHours($clinic->operatingHours);
        $schedules = $this->serializeSchedules($clinic->doctorClinicSchedules);
        $windowUsage = $includeDoctors ? $this->windowUsageForClinic($clinic) : [];

        return [
            'id' => $clinic->id,
            'slug' => Str::slug($clinic->name),
            'name' => $clinic->name,
            'address' => $clinic->address,
            'city_name' => $clinic->city?->name,
            'location' => collect([$clinic->address, $clinic->city?->name])->filter()->join(', '),
            'phone_number' => $clinic->phone_number,
            'email' => $clinic->email,
            'image_url' => $clinic->image_url,
            'specialities' => $specialities,
            'doctor_count' => $clinic->doctors->count(),
            'status_label' => $this->clinicIsOpenNow($clinic->operatingHours) ? 'Buka sekarang' : 'Lihat jadwal',
            'is_open_now' => $this->clinicIsOpenNow($clinic->operatingHours),
            'operational_label' => $clinic->operatingHours->isNotEmpty()
                ? $this->operationalDaysLabel($clinic->operatingHours)
                : $this->scheduleDaysLabel($clinic->doctorClinicSchedules),
            'hours_label' => $this->hoursLabel($clinic->operatingHours, $clinic->doctorClinicSchedules),
            'time_ranges' => $this->clinicTimeRanges($clinic),
            'operating_hours' => $operatingHours,
            'schedules' => $schedules,
            'window_usage' => $windowUsage,
            'current_reservation' => $includeDoctors ? $this->currentPatientReservation($clinic) : null,
            'doctors' => $includeDoctors
                ? $clinic->doctors
                    ->map(fn (User $doctor): array => $this->serializeDoctor($doctor, clinicScopeId: $clinic->id, windowUsage: $windowUsage))
                    ->values()
                    ->all()
                : $clinic->doctors
                    ->take(4)
                    ->map(fn (User $doctor): array => $this->serializeDoctorSummary($doctor))
                    ->values()
                    ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDoctor(User $doctor, ?int $clinicScopeId = null, array $windowUsage = []): array
    {
        $clinics = $doctor->clinics;
        $doctorSchedules = $clinicScopeId !== null
            ? $doctor->doctorClinicSchedules->where('clinic_id', $clinicScopeId)
            : $doctor->doctorClinicSchedules;
        $schedules = $this->serializeSchedules($doctorSchedules);
        $doctorWindowUsage = $clinicScopeId !== null
            ? $windowUsage
            : $this->windowUsageForDoctor($doctor);
        $specialities = $clinics
            ->flatMap(fn (Clinic $clinic): array => $this->workspace->pivotSpecialities($clinic->pivot?->speciality))
            ->unique()
            ->values()
            ->all();

        return [
            'id' => $doctor->id,
            'slug' => Str::slug($doctor->name),
            'name' => $doctor->name,
            'username' => $doctor->username,
            'email' => $doctor->email,
            'phone_number' => $doctor->phone_number,
            'image_url' => $doctor->display_avatar_url,
            'specialities' => $specialities,
            'primary_speciality' => $specialities[0] ?? 'Dokter Klinik',
            'status_label' => $this->doctorHasScheduleToday($doctor) ? 'Tersedia hari ini' : 'Lihat jadwal',
            'is_available_today' => $this->doctorHasScheduleToday($doctor),
            'operational_label' => $this->scheduleDaysLabel($doctor->doctorClinicSchedules),
            'hours_label' => $this->scheduleHoursLabel($doctor->doctorClinicSchedules),
            'time_ranges' => $this->scheduleTimeRanges($doctor->doctorClinicSchedules),
            'today_queue' => $clinicScopeId !== null ? $this->doctorTodayQueue($doctorSchedules, $windowUsage) : null,
            'window_usage' => $doctorWindowUsage,
            'current_reservation' => $clinicScopeId === null ? $this->currentPatientReservationForDoctor($doctor) : null,
            'clinics' => $clinics
                ->map(fn (Clinic $clinic): array => [
                    'id' => $clinic->id,
                    'slug' => Str::slug($clinic->name),
                    'name' => $clinic->name,
                    'address' => $clinic->address,
                    'city_name' => $clinic->city?->name,
                    'location' => collect([$clinic->address, $clinic->city?->name])->filter()->join(', '),
                    'phone_number' => $clinic->phone_number,
                    'email' => $clinic->email,
                    'image_url' => $clinic->image_url,
                    'specialities' => $this->workspace->pivotSpecialities($clinic->pivot?->speciality),
                ])
                ->values()
                ->all(),
            'schedules' => $schedules,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDoctorSummary(User $doctor): array
    {
        $specialities = $this->workspace->pivotSpecialities($doctor->pivot?->speciality);

        return [
            'id' => $doctor->id,
            'slug' => Str::slug($doctor->name),
            'name' => $doctor->name,
            'email' => $doctor->email,
            'phone_number' => $doctor->phone_number,
            'image_url' => $doctor->display_avatar_url,
            'specialities' => $specialities,
            'primary_speciality' => $specialities[0] ?? 'Dokter Klinik',
        ];
    }

    /**
     * @param EloquentCollection<int, ClinicOperatingHour>|Collection<int, ClinicOperatingHour> $hours
     * @return array<int, array<string, mixed>>
     */
    private function serializeOperatingHours(EloquentCollection|Collection $hours): array
    {
        return $hours
            ->sortBy(fn (ClinicOperatingHour $hour): int => self::MONDAY_FIRST_ORDER[(int) $hour->day_of_week] ?? 99)
            ->map(fn (ClinicOperatingHour $hour): array => [
                'id' => $hour->id,
                'day_of_week' => (int) $hour->day_of_week,
                'day_name' => self::DAY_NAMES[(int) $hour->day_of_week] ?? 'Hari',
                'open_time' => $this->shortTime($hour->open_time),
                'close_time' => $this->shortTime($hour->close_time),
                'is_closed' => (bool) $hour->is_closed,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{
     *     schedule_id: int,
     *     doctor_id: int,
     *     clinic_id: int,
     *     reservation_date: string,
     *     window_start_time: string,
     *     booked_slots: int,
     *     slot_numbers_used: array<int, int>
     * }>
     */
    private function windowUsageForDoctor(User $doctor): array
    {
        $scheduleIds = $doctor->doctorClinicSchedules
            ->pluck('id')
            ->filter()
            ->values();

        if ($scheduleIds->isEmpty()) {
            return [];
        }

        return Reservation::query()
            ->where('doctor_id', $doctor->id)
            ->whereIn('doctor_clinic_schedule_id', $scheduleIds)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereNotNull('window_start_time')
            ->whereNotNull('window_slot_number')
            ->get([
                'clinic_id',
                'doctor_id',
                'doctor_clinic_schedule_id',
                'reservation_date',
                'window_start_time',
                'window_slot_number',
            ])
            ->groupBy(function (Reservation $reservation): string {
                return implode('|', [
                    (int) $reservation->doctor_clinic_schedule_id,
                    $this->dateString($reservation->reservation_date),
                    $this->shortTime($reservation->window_start_time),
                ]);
            })
            ->map(function (Collection $reservations): array {
                /** @var Reservation $first */
                $first = $reservations->first();
                $usedSlots = $reservations
                    ->pluck('window_slot_number')
                    ->filter(fn ($slot): bool => $slot !== null && $slot !== '')
                    ->map(fn ($slot): int => (int) $slot)
                    ->filter(fn (int $slot): bool => $slot > 0)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();

                return [
                    'schedule_id' => (int) $first->doctor_clinic_schedule_id,
                    'doctor_id' => (int) $first->doctor_id,
                    'clinic_id' => (int) $first->clinic_id,
                    'reservation_date' => $this->dateString($first->reservation_date),
                    'window_start_time' => (string) $this->shortTime($first->window_start_time),
                    'booked_slots' => count($usedSlots),
                    'slot_numbers_used' => $usedSlots,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param EloquentCollection<int, DoctorClinicSchedule>|Collection<int, DoctorClinicSchedule> $schedules
     * @return array<int, array<string, mixed>>
     */
    private function serializeSchedules(EloquentCollection|Collection $schedules): array
    {
        return $schedules
            ->sortBy(fn (DoctorClinicSchedule $schedule): int => (self::MONDAY_FIRST_ORDER[(int) $schedule->day_of_week] ?? 99) * 10000 + (int) str_replace(':', '', (string) $schedule->start_time))
            ->map(fn (DoctorClinicSchedule $schedule): array => [
                'id' => $schedule->id,
                'clinic_id' => $schedule->clinic_id,
                'doctor_id' => $schedule->doctor_id,
                'day_of_week' => (int) $schedule->day_of_week,
                'day_name' => self::DAY_NAMES[(int) $schedule->day_of_week] ?? 'Hari',
                'start_time' => $this->shortTime($schedule->start_time),
                'end_time' => $this->shortTime($schedule->end_time),
                'window_minutes' => (int) $schedule->window_minutes,
                'max_patients_per_window' => (int) $schedule->max_patients_per_window,
                'total_windows' => count($this->scheduler->generateWindows($schedule)),
                'estimated_capacity' => count($this->scheduler->generateWindows($schedule)) * (int) $schedule->max_patients_per_window,
                'is_active' => (bool) $schedule->is_active,
                'clinic' => $schedule->clinic !== null ? [
                    'id' => $schedule->clinic->id,
                    'slug' => Str::slug($schedule->clinic->name),
                    'name' => $schedule->clinic->name,
                ] : null,
                'doctor' => $schedule->doctor !== null ? [
                    'id' => $schedule->doctor->id,
                    'slug' => Str::slug($schedule->doctor->name),
                    'name' => $schedule->doctor->name,
                    'image_url' => $schedule->doctor->display_avatar_url,
                ] : null,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{
     *     schedule_id: int,
     *     doctor_id: int,
     *     clinic_id: int,
     *     reservation_date: string,
     *     window_start_time: string,
     *     booked_slots: int,
     *     slot_numbers_used: array<int, int>
     * }>
     */
    private function windowUsageForClinic(Clinic $clinic): array
    {
        $scheduleIds = $clinic->doctorClinicSchedules
            ->pluck('id')
            ->filter()
            ->values();

        if ($scheduleIds->isEmpty()) {
            return [];
        }

        return Reservation::query()
            ->where('clinic_id', $clinic->id)
            ->whereIn('doctor_clinic_schedule_id', $scheduleIds)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereNotNull('window_start_time')
            ->whereNotNull('window_slot_number')
            ->get([
                'clinic_id',
                'doctor_id',
                'doctor_clinic_schedule_id',
                'reservation_date',
                'window_start_time',
                'window_slot_number',
            ])
            ->groupBy(function (Reservation $reservation): string {
                return implode('|', [
                    (int) $reservation->doctor_clinic_schedule_id,
                    $this->dateString($reservation->reservation_date),
                    $this->shortTime($reservation->window_start_time),
                ]);
            })
            ->map(function (Collection $reservations): array {
                /** @var Reservation $first */
                $first = $reservations->first();
                $usedSlots = $reservations
                    ->pluck('window_slot_number')
                    ->filter(fn ($slot): bool => $slot !== null && $slot !== '')
                    ->map(fn ($slot): int => (int) $slot)
                    ->filter(fn (int $slot): bool => $slot > 0)
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();

                return [
                    'schedule_id' => (int) $first->doctor_clinic_schedule_id,
                    'doctor_id' => (int) $first->doctor_id,
                    'clinic_id' => (int) $first->clinic_id,
                    'reservation_date' => $this->dateString($first->reservation_date),
                    'window_start_time' => (string) $this->shortTime($first->window_start_time),
                    'booked_slots' => count($usedSlots),
                    'slot_numbers_used' => $usedSlots,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function currentPatientReservation(Clinic $clinic): ?array
    {
        $user = auth()->user();

        if (! $user instanceof User || $user->role !== User::ROLE_PATIENT) {
            return null;
        }

        $reservation = Reservation::query()
            ->with('doctor:id,name')
            ->where('clinic_id', $clinic->id)
            ->where('patient_id', $user->id)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->orderBy('reservation_date')
            ->orderBy('window_start_time')
            ->first();

        if ($reservation === null) {
            return null;
        }

        return [
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'doctor_name' => $reservation->doctor?->name,
            'reservation_date' => $this->dateString($reservation->reservation_date),
            'window_start_time' => $this->shortTime($reservation->window_start_time),
            'window_end_time' => $this->shortTime($reservation->window_end_time),
            'window_slot_number' => $reservation->window_slot_number,
            'queue_number' => $reservation->queue_number,
            'status' => $reservation->status,
            'queue_status' => $reservation->queue_status,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function currentPatientReservationForDoctor(User $doctor): ?array
    {
        $user = auth()->user();

        if (! $user instanceof User || $user->role !== User::ROLE_PATIENT) {
            return null;
        }

        $reservation = Reservation::query()
            ->with('doctor:id,name')
            ->where('doctor_id', $doctor->id)
            ->where('patient_id', $user->id)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->orderBy('reservation_date')
            ->orderBy('window_start_time')
            ->first();

        if ($reservation === null) {
            return null;
        }

        return [
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'doctor_name' => $reservation->doctor?->name,
            'reservation_date' => $this->dateString($reservation->reservation_date),
            'window_start_time' => $this->shortTime($reservation->window_start_time),
            'window_end_time' => $this->shortTime($reservation->window_end_time),
            'window_slot_number' => $reservation->window_slot_number,
            'queue_number' => $reservation->queue_number,
            'status' => $reservation->status,
            'queue_status' => $reservation->queue_status,
        ];
    }

    /**
     * @param EloquentCollection<int, DoctorClinicSchedule>|Collection<int, DoctorClinicSchedule> $schedules
     * @param array<int, array<string, mixed>> $windowUsage
     * @return array<string, mixed>|null
     */
    private function doctorTodayQueue(EloquentCollection|Collection $schedules, array $windowUsage): ?array
    {
        $now = Carbon::now();
        $today = $now->dayOfWeek;
        $todayDate = $now->toDateString();
        $schedule = $schedules
            ->filter(fn (DoctorClinicSchedule $schedule): bool => (int) $schedule->day_of_week === $today && (bool) $schedule->is_active)
            ->sortBy('start_time')
            ->first();

        if ($schedule === null) {
            return null;
        }

        $windows = $this->scheduler->generateWindows($schedule);

        if ($windows === []) {
            return null;
        }

        $nowMinutes = $now->hour * 60 + $now->minute;
        $selectedWindow = collect($windows)
            ->first(function (array $window) use ($nowMinutes): bool {
                return $nowMinutes >= $this->minutesFromTime((string) $window['window_start_time'])
                    && $nowMinutes < $this->minutesFromTime((string) $window['window_end_time']);
            })
            ?? collect($windows)
                ->first(fn (array $window): bool => $this->minutesFromTime((string) $window['window_start_time']) >= $nowMinutes)
            ?? $windows[array_key_last($windows)];

        $windowStart = (string) $this->shortTime($selectedWindow['window_start_time']);
        $usage = $this->findWindowUsage($windowUsage, (int) $schedule->id, $todayDate, $windowStart);
        $bookedSlots = (int) ($usage['booked_slots'] ?? 0);
        $maxSlots = (int) $schedule->max_patients_per_window;

        return [
            'schedule_id' => (int) $schedule->id,
            'date' => $todayDate,
            'window_start_time' => $windowStart,
            'window_end_time' => (string) $this->shortTime($selectedWindow['window_end_time']),
            'booked_slots' => $bookedSlots,
            'available_slots' => max($maxSlots - $bookedSlots, 0),
            'max_slots' => $maxSlots,
            'slot_numbers_used' => $usage['slot_numbers_used'] ?? [],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $windowUsage
     * @return array<string, mixed>|null
     */
    private function findWindowUsage(array $windowUsage, int $scheduleId, string $date, string $windowStart): ?array
    {
        foreach ($windowUsage as $usage) {
            if (
                (int) ($usage['schedule_id'] ?? 0) === $scheduleId
                && (string) ($usage['reservation_date'] ?? '') === $date
                && (string) ($usage['window_start_time'] ?? '') === $windowStart
            ) {
                return $usage;
            }
        }

        return null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function clinicTimeRanges(Clinic $clinic): array
    {
        $operatingRanges = $clinic->operatingHours
            ->filter(fn (ClinicOperatingHour $hour): bool => ! $hour->is_closed && $hour->open_time !== null && $hour->close_time !== null)
            ->map(fn (ClinicOperatingHour $hour): array => $this->timeRangeArray((int) $hour->day_of_week, (string) $hour->open_time, (string) $hour->close_time))
            ->values();

        if ($operatingRanges->isNotEmpty()) {
            return $operatingRanges->all();
        }

        return $this->scheduleTimeRanges($clinic->doctorClinicSchedules);
    }

    /**
     * @param EloquentCollection<int, DoctorClinicSchedule>|Collection<int, DoctorClinicSchedule> $schedules
     * @return array<int, array<string, mixed>>
     */
    private function scheduleTimeRanges(EloquentCollection|Collection $schedules): array
    {
        return $schedules
            ->map(fn (DoctorClinicSchedule $schedule): array => $this->timeRangeArray((int) $schedule->day_of_week, (string) $schedule->start_time, (string) $schedule->end_time))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function timeRangeArray(int $dayOfWeek, string $startTime, string $endTime): array
    {
        return [
            'day_of_week' => $dayOfWeek,
            'day_name' => self::DAY_NAMES[$dayOfWeek] ?? 'Hari',
            'start_time' => $this->shortTime($startTime),
            'end_time' => $this->shortTime($endTime),
            'start_minutes' => $this->minutesFromTime($startTime),
            'end_minutes' => $this->minutesFromTime($endTime),
        ];
    }

    private function clinicIsOpenNow(EloquentCollection|Collection $hours): bool
    {
        $now = Carbon::now();
        $todayHour = $hours->first(fn (ClinicOperatingHour $hour): bool => (int) $hour->day_of_week === $now->dayOfWeek);

        if ($todayHour === null || $todayHour->is_closed || $todayHour->open_time === null || $todayHour->close_time === null) {
            return false;
        }

        $currentMinutes = $now->hour * 60 + $now->minute;

        return $currentMinutes >= $this->minutesFromTime((string) $todayHour->open_time)
            && $currentMinutes <= $this->minutesFromTime((string) $todayHour->close_time);
    }

    private function doctorHasScheduleToday(User $doctor): bool
    {
        $today = Carbon::now()->dayOfWeek;

        return $doctor->doctorClinicSchedules
            ->contains(fn (DoctorClinicSchedule $schedule): bool => (int) $schedule->day_of_week === $today && (bool) $schedule->is_active);
    }

    private function operationalDaysLabel(EloquentCollection|Collection $hours): string
    {
        $openDays = $hours
            ->filter(fn (ClinicOperatingHour $hour): bool => ! $hour->is_closed)
            ->sortBy(fn (ClinicOperatingHour $hour): int => self::MONDAY_FIRST_ORDER[(int) $hour->day_of_week] ?? 99)
            ->map(fn (ClinicOperatingHour $hour): string => self::DAY_NAMES[(int) $hour->day_of_week] ?? 'Hari')
            ->values();

        if ($openDays->count() === 7) {
            return 'Setiap hari';
        }

        return $openDays->isNotEmpty() ? $openDays->join(', ') : 'Jadwal belum tersedia';
    }

    private function scheduleDaysLabel(EloquentCollection|Collection $schedules): string
    {
        $days = $schedules
            ->sortBy(fn (DoctorClinicSchedule $schedule): int => self::MONDAY_FIRST_ORDER[(int) $schedule->day_of_week] ?? 99)
            ->map(fn (DoctorClinicSchedule $schedule): string => self::DAY_NAMES[(int) $schedule->day_of_week] ?? 'Hari')
            ->unique()
            ->values();

        if ($days->count() === 7) {
            return 'Setiap hari';
        }

        return $days->isNotEmpty() ? $days->join(', ') : 'Jadwal belum tersedia';
    }

    private function hoursLabel(EloquentCollection|Collection $hours, EloquentCollection|Collection $fallbackSchedules): string
    {
        $today = Carbon::now()->dayOfWeek;
        $todayHour = $hours->first(fn (ClinicOperatingHour $hour): bool => (int) $hour->day_of_week === $today && ! $hour->is_closed);

        if ($todayHour !== null && $todayHour->open_time !== null && $todayHour->close_time !== null) {
            return $this->shortTime($todayHour->open_time).' - '.$this->shortTime($todayHour->close_time);
        }

        $firstHour = $hours->first(fn (ClinicOperatingHour $hour): bool => ! $hour->is_closed && $hour->open_time !== null && $hour->close_time !== null);

        if ($firstHour !== null) {
            return $this->shortTime($firstHour->open_time).' - '.$this->shortTime($firstHour->close_time);
        }

        return $this->scheduleHoursLabel($fallbackSchedules);
    }

    private function scheduleHoursLabel(EloquentCollection|Collection $schedules): string
    {
        $today = Carbon::now()->dayOfWeek;
        $schedule = $schedules->first(fn (DoctorClinicSchedule $schedule): bool => (int) $schedule->day_of_week === $today)
            ?? $schedules->first();

        if ($schedule === null) {
            return 'Jadwal belum tersedia';
        }

        return $this->shortTime($schedule->start_time).' - '.$this->shortTime($schedule->end_time);
    }

    private function shortTime(mixed $time): ?string
    {
        if ($time === null || $time === '') {
            return null;
        }

        return substr((string) $time, 0, 5);
    }

    private function dateString(mixed $date): string
    {
        if ($date instanceof Carbon) {
            return $date->toDateString();
        }

        return Carbon::parse((string) $date)->toDateString();
    }

    private function minutesFromTime(string $time): int
    {
        [$hour, $minute] = array_map('intval', explode(':', substr($time, 0, 5)));

        return $hour * 60 + $minute;
    }

    /**
     * @param Collection<int, array<string, mixed>> $clinics
     * @return array<string, array<int, string>>
     */
    private function filtersFromClinicCards(Collection $clinics): array
    {
        return [
            'cities' => ClinicCity::query()
                ->orderBy('name')
                ->pluck('name')
                ->filter()
                ->values()
                ->all(),
            'specialities' => $clinics
                ->flatMap(fn (array $clinic): array => $clinic['specialities'] ?? [])
                ->unique()
                ->sort()
                ->values()
                ->all(),
        ];
    }

    /**
     * @param Collection<int, array<string, mixed>> $doctors
     * @return array<string, array<int, string>>
     */
    private function filtersFromDoctorCards(Collection $doctors): array
    {
        return [
            'cities' => ClinicCity::query()
                ->orderBy('name')
                ->pluck('name')
                ->filter()
                ->values()
                ->all(),
            'specialities' => $doctors
                ->flatMap(fn (array $doctor): array => $doctor['specialities'] ?? [])
                ->unique()
                ->sort()
                ->values()
                ->all(),
        ];
    }
}
