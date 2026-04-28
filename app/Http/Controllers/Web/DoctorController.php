<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DoctorClinicSchedule;
use App\Models\MedicalRecord;
use App\Models\User;
use App\Services\Web\WorkspaceViewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Inertia\Inertia;
use Inertia\Response;

class DoctorController extends Controller
{
    public function __construct(
        private readonly WorkspaceViewService $workspace,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorizeAdminWorkspace($request);

        $context = $this->workspace->context($request);
        $clinic = $this->workspace->selectedClinic($request, $context);

        return Inertia::render('doctors/index', [
            'context' => $context,
            'selectedClinicId' => $clinic?->id,
            'clinic' => $clinic !== null ? $this->workspace->serializeClinicDetail($clinic) : null,
            'unassignedDoctors' => $clinic !== null ? $this->unassignedDoctors($clinic) : [],
            'schedules' => $clinic !== null ? $this->clinicSchedules($clinic) : [],
        ]);
    }

    public function edit(Request $request, int $doctor): Response
    {
        $this->authorizeAdminWorkspace($request);

        $context = $this->workspace->context($request);
        $clinic = $this->workspace->selectedClinic($request, $context);
        abort_if($clinic === null, 404);

        $doctorModel = $this->findEditableDoctor($request, $clinic, $doctor);
        $isClinicDoctor = $this->isClinicDoctor($clinic, $doctorModel);
        $canViewMedicalRecords = $request->user()->role === User::ROLE_ADMIN && $isClinicDoctor;

        return Inertia::render('doctors/edit', [
            'context' => $context,
            'doctorId' => $doctorModel->id,
            'clinicId' => $clinic->id,
            'clinic' => $this->workspace->serializeClinicDetail($clinic),
            'doctor' => $this->workspace->serializeDoctor($doctorModel),
            'isClinicDoctor' => $isClinicDoctor,
            'schedules' => $isClinicDoctor ? $this->doctorSchedules($clinic, $doctorModel) : [],
            'medicalRecords' => $canViewMedicalRecords ? $this->doctorMedicalRecords($clinic, $doctorModel) : [],
            'canViewMedicalRecords' => $canViewMedicalRecords,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeSuperadmin($request);

        $payload = $request->validate([
            'clinic_id' => ['nullable', 'integer', 'exists:clinics,id'],
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:30', 'unique:users,phone_number'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $doctor = User::create([
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role' => User::ROLE_DOCTOR,
            'profile_picture' => User::defaultProfilePictureForRole(User::ROLE_DOCTOR),
            'password' => $payload['password'],
        ]);

        return to_route('doctors.edit', array_filter([
            'doctor' => $doctor->id,
            'clinic_id' => $payload['clinic_id'] ?? null,
        ], fn ($value): bool => $value !== null))->with('status', 'Data dokter berhasil dibuat.');
    }

    public function update(Request $request, int $doctor): RedirectResponse
    {
        $this->authorizeAdminWorkspace($request);

        $context = $this->workspace->context($request);
        $clinic = $this->workspace->selectedClinic($request, $context);
        abort_if($clinic === null, 404);

        $rules = [
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($doctor)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($doctor)],
            'phone_number' => ['nullable', 'string', 'max:30', Rule::unique('users', 'phone_number')->ignore($doctor)],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
        ];

        if ($request->user()->role === User::ROLE_ADMIN) {
            $rules['specialities'] = ['sometimes', 'nullable', 'array'];
            $rules['specialities.*'] = ['required', 'string', 'max:255', 'distinct'];
        }

        $payload = $request->validate($rules);

        if ($request->user()->role === User::ROLE_ADMIN) {
            abort_unless((int) $payload['clinic_id'] === $clinic->id, 403);
        }

        $doctorModel = $this->findEditableDoctor($request, $clinic, $doctor);
        $doctorModel->update([
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role' => User::ROLE_DOCTOR,
        ]);

        if ($request->user()->role === User::ROLE_ADMIN) {
            $specialities = collect($payload['specialities'] ?? [])
                ->filter(fn ($speciality): bool => filled($speciality))
                ->map(fn ($speciality): string => (string) $speciality)
                ->values()
                ->all();

            $clinic->doctors()->syncWithoutDetaching([
                $doctorModel->id => [
                    'speciality' => $specialities === [] ? null : $specialities,
                ],
            ]);
        }

        return to_route('doctors.edit', [
            'doctor' => $doctorModel->id,
            'clinic_id' => $clinic->id,
        ])->with('status', 'Data dokter berhasil diperbarui.');
    }

    public function uploadImage(Request $request, int $doctor): RedirectResponse
    {
        $this->authorizeAdminWorkspace($request);

        $context = $this->workspace->context($request);
        $clinic = $this->workspace->selectedClinic($request, $context);
        abort_if($clinic === null, 404);

        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        if ($request->user()->role === User::ROLE_ADMIN) {
            abort_unless((int) $payload['clinic_id'] === $clinic->id, 403);
        }

        $doctorModel = $this->findEditableDoctor($request, $clinic, $doctor);
        $disk = (string) config('filesystems.media_disk', 'public');
        $previousImagePath = $doctorModel->image_path;
        $newImagePath = $request->file('image')->storePublicly('doctors/'.$doctorModel->id, $disk);

        $doctorModel->update([
            'image_path' => $newImagePath,
        ]);

        if (filled($previousImagePath) && $previousImagePath !== $newImagePath) {
            Storage::disk($disk)->delete($previousImagePath);
        }

        return to_route('doctors.edit', [
            'doctor' => $doctorModel->id,
            'clinic_id' => $clinic->id,
        ])->with('status', 'Foto dokter berhasil diunggah.');
    }

    public function destroy(Request $request, int $doctor): RedirectResponse
    {
        $this->authorizeSuperadmin($request);

        $payload = $request->validate([
            'clinic_id' => ['nullable', 'integer', 'exists:clinics,id'],
        ]);

        $doctorModel = User::query()
            ->whereKey($doctor)
            ->where('role', User::ROLE_DOCTOR)
            ->firstOrFail();

        if ($doctorModel->assignedReservations()->exists() || $doctorModel->issuedMedicalRecords()->exists()) {
            throw ValidationException::withMessages([
                'doctor' => ['Dokter tidak dapat dihapus karena sudah memiliki riwayat reservasi atau rekam medis.'],
            ]);
        }

        if (filled($doctorModel->image_path)) {
            Storage::disk((string) config('filesystems.media_disk', 'public'))->delete($doctorModel->image_path);
        }

        $doctorModel->delete();

        return to_route('doctors.index', array_filter([
            'clinic_id' => $payload['clinic_id'] ?? null,
        ], fn ($value): bool => $value !== null))->with('status', 'Data dokter berhasil dihapus.');
    }

    private function authorizeAdminWorkspace(Request $request): void
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true), 403);
    }

    private function authorizeSuperadmin(Request $request): void
    {
        abort_unless($request->user()->role === User::ROLE_SUPERADMIN, 403);
    }

    private function findEditableDoctor(Request $request, Clinic $clinic, int $doctor): User
    {
        if ($request->user()->role === User::ROLE_SUPERADMIN) {
            $doctorModel = User::query()
                ->whereKey($doctor)
                ->where('role', User::ROLE_DOCTOR)
                ->first(['id', 'name', 'username', 'email', 'phone_number', 'date_of_birth', 'gender', 'image_path', 'role']);

            abort_if($doctorModel === null, 404);

            return $doctorModel;
        }

        return $this->findClinicDoctor($clinic, $doctor);
    }

    private function findClinicDoctor(Clinic $clinic, int $doctor): User
    {
        $doctorModel = $clinic->doctors()
            ->where('users.id', $doctor)
            ->first(['users.id', 'users.name', 'users.username', 'users.email', 'users.phone_number', 'users.date_of_birth', 'users.gender', 'users.image_path', 'users.role']);

        abort_if($doctorModel === null, 404);

        return $doctorModel;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function unassignedDoctors(Clinic $clinic): array
    {
        return User::query()
            ->where('role', User::ROLE_DOCTOR)
            ->whereDoesntHave('clinics', fn ($query) => $query->whereKey($clinic->id))
            ->orderBy('name')
            ->get(['id', 'name', 'username', 'email', 'phone_number', 'date_of_birth', 'gender', 'image_path', 'role'])
            ->map(fn (User $doctor): array => $this->workspace->serializeDoctor($doctor))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function clinicSchedules(Clinic $clinic): array
    {
        return DoctorClinicSchedule::query()
            ->with('doctor:id,name,email,phone_number')
            ->where('clinic_id', $clinic->id)
            ->orderBy('doctor_id')
            ->orderByRaw('CASE WHEN day_of_week = 0 THEN 7 ELSE day_of_week END')
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
                'doctor' => $schedule->doctor !== null ? [
                    'id' => $schedule->doctor->id,
                    'name' => $schedule->doctor->name,
                    'email' => $schedule->doctor->email,
                    'phone_number' => $schedule->doctor->phone_number,
                ] : null,
            ])
            ->values()
            ->all();
    }

    private function isClinicDoctor(Clinic $clinic, User $doctor): bool
    {
        return $clinic->doctors()
            ->where('users.id', $doctor->id)
            ->exists();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function doctorSchedules(Clinic $clinic, User $doctor): array
    {
        return collect($this->clinicSchedules($clinic))
            ->where('doctor_id', $doctor->id)
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function doctorMedicalRecords(Clinic $clinic, User $doctor): array
    {
        return MedicalRecord::query()
            ->with([
                'patient:id,name',
                'reservation:id,reservation_number,reservation_date,complaint,status',
            ])
            ->where('clinic_id', $clinic->id)
            ->where('doctor_id', $doctor->id)
            ->latest('issued_at')
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(fn (MedicalRecord $medicalRecord): array => [
                'id' => $medicalRecord->id,
                'reservation_id' => $medicalRecord->reservation_id,
                'patient_id' => $medicalRecord->patient_id,
                'guest_name' => $medicalRecord->guest_name,
                'diagnosis' => $medicalRecord->diagnosis,
                'treatment' => $medicalRecord->treatment,
                'prescription_notes' => $medicalRecord->prescription_notes,
                'doctor_notes' => $medicalRecord->doctor_notes,
                'issued_at' => $medicalRecord->issued_at?->toDateTimeString() ?? '',
                'patient' => $medicalRecord->patient !== null ? [
                    'id' => $medicalRecord->patient->id,
                    'name' => $medicalRecord->patient->name,
                ] : null,
                'reservation' => $medicalRecord->reservation !== null ? [
                    'id' => $medicalRecord->reservation->id,
                    'reservation_number' => $medicalRecord->reservation->reservation_number,
                    'reservation_date' => $medicalRecord->reservation->reservation_date?->toDateString(),
                    'status' => $medicalRecord->reservation->status,
                    'complaint' => $medicalRecord->reservation->complaint,
                ] : null,
            ])
            ->values()
            ->all();
    }
}


