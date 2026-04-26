<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\User;
use App\Services\Web\WorkspaceViewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
        ]);
    }

    public function edit(Request $request, int $doctor): Response
    {
        $this->authorizeAdminWorkspace($request);

        $context = $this->workspace->context($request);
        $clinic = $this->workspace->selectedClinic($request, $context);
        abort_if($clinic === null, 404);

        $doctorModel = $this->findClinicDoctor($clinic, $doctor);

        return Inertia::render('doctors/edit', [
            'context' => $context,
            'doctorId' => $doctorModel->id,
            'clinicId' => $clinic->id,
            'clinic' => $this->workspace->serializeClinicDetail($clinic),
            'doctor' => $this->workspace->serializeDoctor($doctorModel),
        ]);
    }

    public function update(Request $request, int $doctor): RedirectResponse
    {
        $this->authorizeAdminWorkspace($request);

        $context = $this->workspace->context($request);
        $clinic = $this->workspace->selectedClinic($request, $context);
        abort_if($clinic === null, 404);

        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($doctor)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($doctor)],
            'phone_number' => ['nullable', 'string', 'max:30', Rule::unique('users', 'phone_number')->ignore($doctor)],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'specialities' => ['sometimes', 'nullable', 'array'],
            'specialities.*' => ['required', 'string', 'max:255', 'distinct'],
        ]);

        abort_unless((int) $payload['clinic_id'] === $clinic->id, 403);

        $doctorModel = $this->findClinicDoctor($clinic, $doctor);
        $doctorModel->update([
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role' => User::ROLE_DOCTOR,
        ]);

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

        abort_unless((int) $payload['clinic_id'] === $clinic->id, 403);

        $doctorModel = $this->findClinicDoctor($clinic, $doctor);
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

    private function authorizeAdminWorkspace(Request $request): void
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true), 403);
    }

    private function findClinicDoctor(Clinic $clinic, int $doctor): User
    {
        $doctorModel = $clinic->doctors()
            ->where('users.id', $doctor)
            ->first(['users.id', 'users.name', 'users.username', 'users.email', 'users.phone_number', 'users.date_of_birth', 'users.gender', 'users.image_path', 'users.role']);

        abort_if($doctorModel === null, 404);

        return $doctorModel;
    }
}


