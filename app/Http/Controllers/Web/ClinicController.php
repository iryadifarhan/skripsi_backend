<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\Reservation;
use App\Models\User;
use App\Services\Web\WorkspaceViewService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Inertia\Inertia;
use Inertia\Response;

class ClinicController extends Controller
{
    public function __construct(
        private readonly WorkspaceViewService $workspace,
    ) {}

    public function settings(Request $request, ?int $clinicId = null): RedirectResponse|Response
    {
        $this->authorizeAdminWorkspace($request);

        $context = $this->workspace->context($request);
        $user = $request->user();
        $requestedClinicId = $clinicId ?? ($request->query('clinic_id') !== null ? (int) $request->query('clinic_id') : null);

        if ($requestedClinicId === null) {
            if ($user->role === User::ROLE_SUPERADMIN) {
                return to_route('clinics.index');
            }

            if ($user->role === User::ROLE_ADMIN && $user->clinic_id !== null) {
                return to_route('clinic-settings.show', ['clinicId' => $user->clinic_id]);
            }
        }

        if ($requestedClinicId !== null && $clinicId === null) {
            return to_route('clinic-settings.show', ['clinicId' => $requestedClinicId]);
        }

        if ($user->role === User::ROLE_ADMIN && $requestedClinicId !== null) {
            abort_unless((int) $user->clinic_id === $requestedClinicId, 403);
        }

        $clinic = $requestedClinicId !== null
            ? Clinic::query()->whereKey($requestedClinicId)->first()
            : null;

        if ($clinic !== null) {
            $clinic->load([
                'doctors:id,name,username,email,phone_number,date_of_birth,gender,image_path',
                'users:id,clinic_id,name,username,email,phone_number,date_of_birth,gender,role,email_verified_at,created_at',
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
            ]);
        }

        return Inertia::render('clinic-settings/index', [
            'context' => $context,
            'selectedClinicId' => $clinic?->id,
            'clinic' => $clinic !== null ? $this->workspace->serializeClinicDetail($clinic) : null,
            'summary' => $clinic !== null ? $this->settingsSummary($clinic, $request->user()) : $this->emptySettingsSummary($request->user()),
        ]);
    }

    public function index(Request $request): JsonResponse|RedirectResponse|Response
    {
        if (!$request->expectsJson() && $request->user()?->role === User::ROLE_ADMIN) {
            if ($request->user()->clinic_id === null) {
                return to_route('clinic-settings.index');
            }

            return to_route('clinic-settings.show', ['clinicId' => $request->user()->clinic_id]);
        }

        $clinics = Clinic::query()
            ->select(['id', 'name', 'address', 'phone_number', 'email', 'image_path'])
            ->with([
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
                'doctors:id,name,username,email,phone_number,image_path',
            ])
            ->withCount([
                'doctors as doctor_count',
                'users as admin_count' => fn ($query) => $query->where('role', User::ROLE_ADMIN),
                'doctorClinicSchedules as schedule_count',
                'reservations as reservation_count',
                'medicalRecords as medical_record_count',
                'operatingHours as operating_day_count' => fn ($query) => $query->where('is_closed', false),
            ])
            ->orderBy('name')
            ->get();

        if (!$request->expectsJson()) {
            abort_unless($request->user()?->role === User::ROLE_SUPERADMIN, 403);

            return Inertia::render('clinics/index', [
                'context' => $this->workspace->context($request),
                'clinics' => $clinics->map(fn (Clinic $clinic): array => $this->serializeClinicIndexEntry($clinic))->values()->all(),
            ]);
        }

        return response()->json([
            'message' => 'Clinic retrieval successful.',
            'clinics' => $clinics->map(fn (Clinic $clinic): array => $this->serializeClinicSummary($clinic))->all(),
        ]);
    }

    public function show($clinicId)
    {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        return response()->json(
            $this->serializeClinicDetail($clinic->load([
                'doctors:id,name,username,email,phone_number,image_path',
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
            ]))
        );
    }

    public function uploadClinicImage(Request $request, $clinicId)
    {
        $payload = $request->validate([
            'clinic_id' => 'sometimes|nullable|integer|exists:clinics,id',
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $this->assertClinicRequestMatchesRoute($payload['clinic_id'] ?? null, (int) $clinicId);
        $this->assertCanManageClinic($request, (int) $clinicId);

        $previousImagePath = $clinic->image_path;
        $newImagePath = $this->storeImage($request->file('image'), 'clinics/'.$clinic->id);

        $clinic->update([
            'image_path' => $newImagePath,
        ]);

        $this->deleteStoredImage($previousImagePath, $newImagePath);

        return $this->jsonOrRedirect($request, [
            'message' => 'Clinic image uploaded successfully.',
            'clinic' => $this->serializeClinicDetail($clinic->fresh()->load([
                'doctors:id,name,username,email,phone_number,image_path',
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
            ])),
        ], flashMessage: 'Foto klinik berhasil diunggah.');
    }

    public function uploadDoctorImage(Request $request, $clinicId)
    {
        $payload = $request->validate([
            'clinic_id' => 'sometimes|nullable|integer|exists:clinics,id',
            'doctor_id' => 'required|integer|exists:users,id',
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $this->assertClinicRequestMatchesRoute($payload['clinic_id'] ?? null, (int) $clinicId);
        $this->assertCanManageClinic($request, (int) $clinicId);

        $doctor = User::find($payload['doctor_id']);

        if ($doctor === null || $doctor->role !== User::ROLE_DOCTOR) {
            return response()->json([
                'message' => 'The selected user is not a doctor.',
            ], 400);
        }

        if (!$doctor->clinics()->whereKey($clinic->id)->exists()) {
            return response()->json([
                'message' => 'The doctor is not assigned to the specified clinic.',
            ], 400);
        }

        $previousImagePath = $doctor->image_path;
        $newImagePath = $this->storeImage($request->file('image'), 'doctors/'.$doctor->id);

        $doctor->update([
            'image_path' => $newImagePath,
        ]);

        $this->deleteStoredImage($previousImagePath, $newImagePath);

        $doctor = $clinic->doctors()
            ->whereKey($doctor->id)
            ->first(['users.id', 'users.name', 'users.username', 'users.email', 'users.phone_number', 'users.image_path']);

        return response()->json([
            'message' => 'Doctor image uploaded successfully.',
            'doctor' => [
                'id' => $doctor->id,
                'name' => $doctor->name,
                'username' => $doctor->username,
                'email' => $doctor->email,
                'phone_number' => $doctor->phone_number,
                'image_path' => $doctor->image_path,
                'image_url' => $doctor->image_url,
                'specialities' => $this->pivotSpecialities($doctor->pivot?->speciality),
            ],
        ]);
    }

    public function create(Request $request): JsonResponse|RedirectResponse {
        $payload = $request->validate([
            'name' => 'required|string|max:255|unique:clinics,name',
            'address' => 'required|string|max:255',
            'phone_number' => 'required|string|max:20|unique:clinics,phone_number',
            'email' => 'required|email|max:255|unique:clinics,email',
            'operating_hours' => 'nullable|array',
            'operating_hours.*.day_of_week' => 'required|integer|min:0|max:6',
            'operating_hours.*.open_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.close_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.is_closed' => 'nullable|boolean',
        ]);

        $clinic = Clinic::create([
            'name' => $payload['name'],
            'address' => $payload['address'],
            'phone_number' => $payload['phone_number'],
            'email' => $payload['email'],
        ]);

        $this->syncOperatingHours($clinic, $payload['operating_hours'] ?? null, true);

        return $this->jsonOrRedirect($request, [
            'message' => 'Clinic created successfully.',
            'clinic' => $this->serializeClinicDetail($clinic->fresh()->load([
                'doctors:id,name,username,email,phone_number,image_path',
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
            ])),
        ], 201, 'Data klinik berhasil dibuat.');
    }

    public function update(Request $request, $clinicId) {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $this->assertCanManageClinic($request, (int) $clinicId);

        $request->validate([
            'name' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'phone_number' => ['nullable', 'string', 'max:20', Rule::unique('clinics', 'phone_number')->ignore($clinicId)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('clinics', 'email')->ignore($clinicId)],
            'operating_hours' => 'nullable|array',
            'operating_hours.*.day_of_week' => 'required|integer|min:0|max:6',
            'operating_hours.*.open_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.close_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.is_closed' => 'nullable|boolean',
        ]);

        $clinic->update($request->only(['name', 'address', 'phone_number', 'email']));
        $this->syncOperatingHours($clinic, $request->input('operating_hours'), false);

        return $this->jsonOrRedirect($request, [
            'message' => 'Clinic updated successfully.',
        ], flashMessage: 'Data klinik berhasil diperbarui.');
    }

    public function createClinicAdmin(Request $request, $clinicId): JsonResponse|RedirectResponse
    {
        abort_unless($request->user()?->role === User::ROLE_SUPERADMIN, 403);

        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:30', 'unique:users,phone_number'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $admin = User::create([
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
            'profile_picture' => User::defaultProfilePictureForRole(User::ROLE_ADMIN),
            'password' => $payload['password'],
        ]);

        $admin->forceFill([
            'email_verified_at' => now(),
        ])->save();

        return $this->jsonOrRedirect($request, [
            'message' => 'Clinic admin created successfully.',
            'admin' => $this->serializeClinicAdmin($admin),
        ], 201, 'Admin klinik berhasil dibuat.');
    }

    public function updateClinicAdmin(Request $request, $clinicId, $adminId): JsonResponse|RedirectResponse
    {
        abort_unless($request->user()?->role === User::ROLE_SUPERADMIN, 403);

        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $admin = $this->findClinicAdmin($clinic, $adminId);

        if ($admin === null) {
            return response()->json([
                'message' => 'Clinic admin not found.',
            ], 404);
        }

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($admin->id)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($admin->id)],
            'phone_number' => ['nullable', 'string', 'max:30', Rule::unique('users', 'phone_number')->ignore($admin->id)],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'password' => ['nullable', 'confirmed', PasswordRule::defaults()],
        ]);

        $updates = [
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role' => User::ROLE_ADMIN,
            'clinic_id' => $clinic->id,
        ];

        if (filled($payload['password'] ?? null)) {
            $updates['password'] = $payload['password'];
        }

        $admin->forceFill($updates);

        if ($admin->email_verified_at === null) {
            $admin->email_verified_at = now();
        }

        $admin->save();

        return $this->jsonOrRedirect($request, [
            'message' => 'Clinic admin updated successfully.',
            'admin' => $this->serializeClinicAdmin($admin),
        ], flashMessage: 'Admin klinik berhasil diperbarui.');
    }

    public function deleteClinicAdmin(Request $request, $clinicId, $adminId): JsonResponse|RedirectResponse
    {
        abort_unless($request->user()?->role === User::ROLE_SUPERADMIN, 403);

        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $admin = $this->findClinicAdmin($clinic, $adminId);

        if ($admin === null) {
            return response()->json([
                'message' => 'Clinic admin not found.',
            ], 404);
        }

        if ((int) $request->user()->id === (int) $admin->id) {
            throw ValidationException::withMessages([
                'admin' => 'Akun yang sedang digunakan tidak dapat dihapus dari halaman ini.',
            ]);
        }

        $deletedAdminId = $admin->id;
        $admin->delete();

        return $this->jsonOrRedirect($request, [
            'message' => 'Clinic admin deleted successfully.',
            'admin_id' => $deletedAdminId,
        ], flashMessage: 'Admin klinik berhasil dihapus.');
    }

    public function delete(Request $request, $clinicId): JsonResponse|RedirectResponse {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $this->assertCanManageClinic($request, (int) $clinicId);
        $this->assertClinicCanBeDeleted($clinic);

        if (filled($clinic->image_path)) {
            Storage::disk($this->mediaDisk())->delete($clinic->image_path);
        }

        $clinic->delete();

        return $this->jsonOrRedirect($request, [
            'message' => 'Clinic deleted successfully.',
        ], flashMessage: 'Data klinik berhasil dihapus.');
    }

    public function assignDoctor(Request $request, $clinicId) {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $this->assertCanManageClinic($request, (int) $clinicId);

        $user = $request->user();
        $specialityInput = $user->role === User::ROLE_SUPERADMIN ? null : $request->input('speciality');

        if ($specialityInput !== null && !is_array($specialityInput)) {
            $request->merge([
                'speciality' => [$specialityInput],
            ]);
        }

        $rules = [
            'doctor_id' => 'required|integer|exists:users,id',
        ];

        if ($user->role !== User::ROLE_SUPERADMIN) {
            $rules['speciality'] = 'sometimes|nullable|array';
            $rules['speciality.*'] = 'required|string|max:255|distinct';
        }

        $request->validate($rules);

        if (User::where('id', $request->doctor_id)->where('role', User::ROLE_DOCTOR)->doesntExist()) {
            return response()->json([
                'message' => 'The selected user is not a doctor.',
            ], 400);
        }

        $pivotAttributes = [];

        if ($user->role !== User::ROLE_SUPERADMIN && $request->has('speciality')) {
            $specialities = collect($request->input('speciality', []))
                ->filter(fn ($speciality): bool => filled($speciality))
                ->map(fn ($speciality): string => (string) $speciality)
                ->values()
                ->all();

            $pivotAttributes['speciality'] = $specialities === []
                ? null
                : $specialities;
        }

        $clinic->doctors()->syncWithoutDetaching([
            $request->doctor_id => $pivotAttributes,
        ]);

        return response()->json([
            'message' => 'Doctor assigned to clinic successfully.',
        ]);
    }

    public function removeDoctor(Request $request, $clinicId) {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $this->assertCanManageClinic($request, (int) $clinicId);
        
        $request->validate([
            'doctor_id' => 'required|integer|exists:users,id',
        ]);

        if (User::where('id', $request->doctor_id)->where('role', User::ROLE_DOCTOR)->doesntExist()) {
            return response()->json([
                'message' => 'The selected user is not a doctor.',
            ], 400);
        }

        $clinic->doctors()->detach($request->doctor_id);

        return response()->json([
            'message' => 'Doctor removed from clinic successfully.',
        ]);
    }

    /**
     * For both admin and doctors
     */
    public function createDoctorClinicSchedule(Request $request) {
        $dayOfWeekInput = $request->input('day_of_week');

        if ($dayOfWeekInput !== null && !is_array($dayOfWeekInput)) {
            $request->merge([
                'day_of_week' => [$dayOfWeekInput],
            ]);
        }

        $request->validate([
            'doctor_id' => 'required|integer|exists:users,id',
            'clinic_id' => 'required|integer|exists:clinics,id',
            'day_of_week' => 'required|array|min:1',
            'day_of_week.*' => 'required|integer|min:0|max:6|distinct',
            'start_time' => 'required|date_format:H:i:s',
            'end_time' => 'required|date_format:H:i:s|after:start_time',
            'window_minutes' => 'required|integer|min:1',
            'max_patients_per_window' => 'required|integer|min:1',
        ]);

        $this->assertCanManageScheduleRequest($request, (int) $request->clinic_id, (int) $request->doctor_id);

        $user = User::find($request->doctor_id);
        $clinic = Clinic::find($request->clinic_id);
        $dayOfWeeks = collect($request->input('day_of_week'))
            ->map(fn ($day): int => (int) $day)
            ->values();

        if ($user->role !== User::ROLE_DOCTOR) {
            return response()->json([
                'message' => 'The selected user is not a doctor.',
            ], 400);
        }

        if ($user->clinics()->where('clinic_id', $request->clinic_id)->doesntExist()) {
            return response()->json([
                'message' => 'The doctor is not assigned to the specified clinic.',
            ], 400);
        }

        $existingScheduleDays = DoctorClinicSchedule::query()
            ->where('doctor_id', $request->doctor_id)
            ->where('clinic_id', $request->clinic_id)
            ->whereIn('day_of_week', $dayOfWeeks->all())
            ->pluck('day_of_week')
            ->map(fn ($day): int => (int) $day)
            ->all();

        if ($existingScheduleDays !== []) {
            throw ValidationException::withMessages([
                'day_of_week' => [
                    'A schedule for this doctor, clinic, and day of week already exists for: '.implode(', ', $existingScheduleDays).'.',
                ],
            ]);
        }

        $operatingHours = $clinic->operatingHours()
            ->whereIn('day_of_week', $dayOfWeeks->all())
            ->get()
            ->keyBy(fn (ClinicOperatingHour $operatingHour): int => (int) $operatingHour->day_of_week);

        foreach ($dayOfWeeks as $dayOfWeek) {
            $clinicSchedule = $operatingHours->get($dayOfWeek);

            if ($clinicSchedule === null || (bool) $clinicSchedule->is_closed) {
                throw ValidationException::withMessages([
                    'day_of_week' => [
                        "The clinic does not have an available operating hour on day_of_week {$dayOfWeek}.",
                    ],
                ]);
            }

            if ($request->start_time < $clinicSchedule->open_time || $request->end_time > $clinicSchedule->close_time) {
                throw ValidationException::withMessages([
                    'day_of_week' => [
                        "The schedule is outside the clinic's operating hours for day_of_week {$dayOfWeek}.",
                    ],
                ]);
            }
        }

        $createdSchedules = DB::transaction(function () use ($request, $dayOfWeeks) {
            return $dayOfWeeks->map(function (int $dayOfWeek) use ($request) {
                return DoctorClinicSchedule::create([
                    'clinic_id' => $request->clinic_id,
                    'doctor_id' => $request->doctor_id,
                    'day_of_week' => $dayOfWeek,
                    'start_time' => $request->start_time,
                    'end_time' => $request->end_time,
                    'window_minutes' => $request->window_minutes,
                    'max_patients_per_window' => $request->max_patients_per_window,
                    'is_active' => true,
                ]);
            });
        });

        return $this->jsonOrRedirect($request, [
            'message' => $createdSchedules->count() === 1
                ? 'Doctor clinic schedule created successfully.'
                : 'Doctor clinic schedules created successfully.',
            'schedules' => $createdSchedules->values(),
        ], 201, 'Jadwal dokter berhasil dibuat.');
    }

    /**
     * For both admin and doctors
     */
    public function updateDoctorClinicSchedule(Request $request, DoctorClinicSchedule $schedule) {
        $request->validate([
            'clinic_id' => 'sometimes|nullable|integer|exists:clinics,id',
            'start_time' => 'nullable|date_format:H:i:s',
            'end_time' => 'nullable|date_format:H:i:s|after:start_time',
            'window_minutes' => 'nullable|integer|min:1',
            'max_patients_per_window' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        $this->assertClinicRequestMatchesRoute($request->input('clinic_id'), (int) $schedule->clinic_id);
        $this->assertCanManageSchedule($request, $schedule);

        $clinicSchedule = $schedule->clinic->operatingHours()->where('day_of_week', $schedule->day_of_week)->first();
        $startTime = $request->input('start_time', $schedule->start_time);
        $endTime = $request->input('end_time', $schedule->end_time);

        if ($clinicSchedule === null || (bool) $clinicSchedule->is_closed || $startTime < $clinicSchedule->open_time || $endTime > $clinicSchedule->close_time) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'The schedule is outside the clinic\'s operating hours.',
                ], 400);
            }

            throw ValidationException::withMessages([
                'start_time' => [
                    'The schedule is outside the clinic\'s operating hours.',
                ],
            ]);
        }

        $schedule->update($request->only([
            'start_time',
            'end_time',
            'window_minutes',
            'max_patients_per_window',
            'is_active',
        ]));

        return $this->jsonOrRedirect($request, [
            'message' => 'Doctor clinic schedule updated successfully.',
        ], flashMessage: 'Jadwal dokter berhasil diperbarui.');
    }

    public function deleteDoctorClinicSchedule(Request $request, DoctorClinicSchedule $schedule): JsonResponse|RedirectResponse
    {
        $request->validate([
            'clinic_id' => 'sometimes|nullable|integer|exists:clinics,id',
        ]);

        $this->assertClinicRequestMatchesRoute($request->input('clinic_id'), (int) $schedule->clinic_id);
        $this->assertCanManageSchedule($request, $schedule);

        if (Reservation::query()->where('doctor_clinic_schedule_id', $schedule->id)->exists()) {
            throw ValidationException::withMessages([
                'schedule' => [
                    'Jadwal dokter tidak dapat dihapus karena sudah digunakan pada reservasi.',
                ],
            ]);
        }

        $schedule->delete();

        return $this->jsonOrRedirect($request, [
            'message' => 'Doctor clinic schedule deleted successfully.',
        ], flashMessage: 'Jadwal dokter berhasil dihapus.');
    }

    private function syncOperatingHours(Clinic $clinic, ?array $operatingHours, bool $seedDefaultsOnCreate): void
    {
        if ($operatingHours === null) {
            if ($seedDefaultsOnCreate) {
                $this->seedDefaultOperatingHours($clinic);
            }
            return;
        }

        $this->validateOperatingHours($operatingHours);

        $now = now();
        $records = array_map(function (array $hour) use ($clinic, $now): array {
            $isClosed = (bool) ($hour['is_closed'] ?? false);

            return [
                'clinic_id' => $clinic->id,
                'day_of_week' => (int) $hour['day_of_week'],
                'open_time' => $isClosed ? null : ($hour['open_time'] ?? null),
                'close_time' => $isClosed ? null : ($hour['close_time'] ?? null),
                'is_closed' => $isClosed,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $operatingHours);

        ClinicOperatingHour::upsert(
            $records,
            ['clinic_id', 'day_of_week'],
            ['open_time', 'close_time', 'is_closed', 'updated_at']
        );
    }

    private function seedDefaultOperatingHours(Clinic $clinic): void
    {
        $now = now();
        $records = [];

        for ($day = 0; $day <= 6; $day++) {
            $records[] = [
                'clinic_id' => $clinic->id,
                'day_of_week' => $day,
                'open_time' => '08:00:00',
                'close_time' => '17:00:00',
                'is_closed' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        ClinicOperatingHour::insert($records);
    }

    private function validateOperatingHours(array $operatingHours): void
    {
        $errors = [];
        $days = [];

        foreach ($operatingHours as $index => $hour) {
            $day = $hour['day_of_week'] ?? null;
            $days[] = (int) $day;

            $isClosed = (bool) ($hour['is_closed'] ?? false);
            if ($isClosed) {
                continue;
            }

            $openTime = $hour['open_time'] ?? null;
            $closeTime = $hour['close_time'] ?? null;

            if (!$openTime || !$closeTime) {
                $errors["operating_hours.$index.open_time"][] = 'Open time is required when clinic is not closed.';
                $errors["operating_hours.$index.close_time"][] = 'Close time is required when clinic is not closed.';
                continue;
            }

            if (strtotime($openTime) >= strtotime($closeTime)) {
                $errors["operating_hours.$index.close_time"][] = 'Close time must be after open time.';
            }
        }

        if (count($days) !== count(array_unique($days))) {
            $errors['operating_hours'][] = 'Each day_of_week must be unique.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeClinicSummary(Clinic $clinic): array
    {
        return [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'address' => $clinic->address,
            'phone_number' => $clinic->phone_number,
            'email' => $clinic->email,
            'image_path' => $clinic->image_path,
            'image_url' => $clinic->image_url,
            'operating_hours' => $clinic->operatingHours,
            'specialities' => $this->collectClinicSpecialities($clinic),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeClinicIndexEntry(Clinic $clinic): array
    {
        return [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'address' => $clinic->address,
            'phone_number' => $clinic->phone_number,
            'email' => $clinic->email,
            'image_path' => $clinic->image_path,
            'image_url' => $clinic->image_url,
            'specialities' => $this->collectClinicSpecialities($clinic),
            'doctor_count' => (int) ($clinic->doctor_count ?? 0),
            'admin_count' => (int) ($clinic->admin_count ?? 0),
            'schedule_count' => (int) ($clinic->schedule_count ?? 0),
            'reservation_count' => (int) ($clinic->reservation_count ?? 0),
            'medical_record_count' => (int) ($clinic->medical_record_count ?? 0),
            'operating_day_count' => (int) ($clinic->operating_day_count ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeClinicDetail(Clinic $clinic): array
    {
        return [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'address' => $clinic->address,
            'phone_number' => $clinic->phone_number,
            'email' => $clinic->email,
            'image_path' => $clinic->image_path,
            'image_url' => $clinic->image_url,
            'operating_hours' => $clinic->operatingHours,
            'specialities' => $this->collectClinicSpecialities($clinic),
            'doctors' => $clinic->doctors->map(function (User $doctor): array {
                return [
                    'id' => $doctor->id,
                    'name' => $doctor->name,
                    'username' => $doctor->username,
                    'email' => $doctor->email,
                    'phone_number' => $doctor->phone_number,
                    'image_path' => $doctor->image_path,
                    'image_url' => $doctor->image_url,
                    'specialities' => $this->pivotSpecialities($doctor->pivot?->speciality),
                ];
            })->all(),
            'admins' => $clinic->users
                ->where('role', User::ROLE_ADMIN)
                ->sortBy('name')
                ->values()
                ->map(fn (User $admin): array => $this->serializeClinicAdmin($admin))
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeClinicAdmin(User $admin): array
    {
        return [
            'id' => $admin->id,
            'name' => $admin->name,
            'username' => $admin->username,
            'email' => $admin->email,
            'phone_number' => $admin->phone_number,
            'date_of_birth' => $admin->date_of_birth?->toDateString(),
            'gender' => $admin->gender,
            'email_verified_at' => $admin->email_verified_at?->toISOString(),
            'created_at' => $admin->created_at?->toISOString(),
        ];
    }

    private function findClinicAdmin(Clinic $clinic, int|string $adminId): ?User
    {
        return $clinic->users()
            ->whereKey($adminId)
            ->where('role', User::ROLE_ADMIN)
            ->first();
    }

    /**
     * @return array<int, string>
     */
    private function collectClinicSpecialities(Clinic $clinic): array
    {
        return $clinic->doctors
            ->flatMap(fn (User $doctor): array => $this->pivotSpecialities($doctor->pivot?->speciality))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function pivotSpecialities(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return collect($value)
                ->filter(fn ($speciality): bool => filled($speciality))
                ->map(fn ($speciality): string => (string) $speciality)
                ->values()
                ->all();
        }

        $decoded = json_decode((string) $value, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return collect($decoded)
                ->filter(fn ($speciality): bool => filled($speciality))
                ->map(fn ($speciality): string => (string) $speciality)
                ->values()
                ->all();
        }

        return [(string) $value];
    }

    private function assertClinicRequestMatchesRoute(mixed $requestClinicId, int $routeClinicId): void
    {
        if ($requestClinicId === null || $requestClinicId === '') {
            return;
        }

        if ((int) $requestClinicId === $routeClinicId) {
            return;
        }

        throw ValidationException::withMessages([
            'clinic_id' => ['The provided clinic_id does not match the route clinic id.'],
        ]);
    }

    private function authorizeAdminWorkspace(Request $request): void
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true), 403);
    }

    /**
     * @return array<string, int|null>
     */
    private function settingsSummary(Clinic $clinic, User $actor): array
    {
        $today = Carbon::today();

        return [
            'doctor_count' => $clinic->doctors()->count(),
            'active_schedule_count' => $clinic->doctorClinicSchedules()->where('is_active', true)->count(),
            'today_reservation_count' => $clinic->reservations()->whereDate('reservation_date', $today->toDateString())->count(),
            'active_queue_count' => $clinic->reservations()
                ->whereDate('reservation_date', $today->toDateString())
                ->where('status', Reservation::STATUS_APPROVED)
                ->whereIn('queue_status', Reservation::ACTIVE_QUEUE_STATUSES)
                ->count(),
            'operating_day_count' => $clinic->operatingHours()->where('is_closed', false)->count(),
            'medical_records_this_month' => $actor->role === User::ROLE_SUPERADMIN
                ? null
                : $clinic->medicalRecords()
                    ->whereBetween('issued_at', [
                        $today->copy()->startOfMonth()->startOfDay(),
                        $today->copy()->endOfMonth()->endOfDay(),
                    ])
                    ->count(),
        ];
    }

    /**
     * @return array<string, int|null>
     */
    private function emptySettingsSummary(User $actor): array
    {
        return [
            'doctor_count' => 0,
            'active_schedule_count' => 0,
            'today_reservation_count' => 0,
            'active_queue_count' => 0,
            'operating_day_count' => 0,
            'medical_records_this_month' => $actor->role === User::ROLE_SUPERADMIN ? null : 0,
        ];
    }

    private function assertCanManageClinic(Request $request, int $clinicId): void
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role === User::ROLE_SUPERADMIN) {
            return;
        }

        if ($user->role === User::ROLE_ADMIN && (int) $user->clinic_id === $clinicId) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to manage this clinic.');
    }

    private function assertClinicCanBeDeleted(Clinic $clinic): void
    {
        $blockingReasons = [];

        if ($clinic->users()->exists()) {
            $blockingReasons[] = 'admin/user klinik';
        }

        if ($clinic->doctors()->exists()) {
            $blockingReasons[] = 'dokter terassign';
        }

        if ($clinic->doctorClinicSchedules()->exists()) {
            $blockingReasons[] = 'jadwal dokter';
        }

        if ($clinic->reservations()->exists()) {
            $blockingReasons[] = 'reservasi';
        }

        if ($clinic->medicalRecords()->exists()) {
            $blockingReasons[] = 'rekam medis';
        }

        if ($blockingReasons === []) {
            return;
        }

        throw ValidationException::withMessages([
            'clinic' => [
                'Klinik tidak dapat dihapus karena masih memiliki '.implode(', ', $blockingReasons).'.',
            ],
        ]);
    }

    private function assertCanManageScheduleRequest(Request $request, int $clinicId, int $doctorId): void
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role === User::ROLE_SUPERADMIN) {
            return;
        }

        if ($user->role === User::ROLE_ADMIN && (int) $user->clinic_id === $clinicId) {
            return;
        }

        if ($user->role === User::ROLE_DOCTOR && (int) $user->id === $doctorId && $user->clinics()->whereKey($clinicId)->exists()) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to manage this schedule.');
    }

    private function assertCanManageSchedule(Request $request, DoctorClinicSchedule $schedule): void
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role === User::ROLE_SUPERADMIN) {
            return;
        }

        if ($user->role === User::ROLE_ADMIN && (int) $user->clinic_id === (int) $schedule->clinic_id) {
            return;
        }

        if ($user->role === User::ROLE_DOCTOR && (int) $user->id === (int) $schedule->doctor_id && $user->clinics()->whereKey($schedule->clinic_id)->exists()) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to manage this schedule.');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDoctorClinicSchedule(DoctorClinicSchedule $schedule): array
    {
        return [
            'id' => $schedule->id,
            'clinic_id' => $schedule->clinic_id,
            'doctor_id' => $schedule->doctor_id,
            'day_of_week' => $schedule->day_of_week,
            'start_time' => $schedule->start_time,
            'end_time' => $schedule->end_time,
            'window_minutes' => $schedule->window_minutes,
            'max_patients_per_window' => $schedule->max_patients_per_window,
            'is_active' => (bool) $schedule->is_active,
            'doctor' => $schedule->doctor !== null ? [
                'id' => $schedule->doctor->id,
                'name' => $schedule->doctor->name,
                'email' => $schedule->doctor->email,
                'phone_number' => $schedule->doctor->phone_number,
            ] : null,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function jsonOrRedirect(Request $request, array $payload, int $status = 200, ?string $flashMessage = null): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json($payload, $status);
        }

        return back()->with('status', $flashMessage ?? ($payload['message'] ?? 'Operation completed successfully.'));
    }

    private function storeImage(UploadedFile $image, string $directory): string
    {
        return $image->storePublicly($directory, $this->mediaDisk());
    }

    private function deleteStoredImage(?string $previousImagePath, string $newImagePath): void
    {
        if (!filled($previousImagePath) || $previousImagePath === $newImagePath) {
            return;
        }

        Storage::disk($this->mediaDisk())->delete($previousImagePath);
    }

    private function mediaDisk(): string
    {
        return (string) config('filesystems.media_disk', 'public');
    }
}


