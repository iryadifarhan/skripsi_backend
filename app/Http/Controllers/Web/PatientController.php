<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use App\Services\Web\WorkspaceViewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Inertia\Inertia;
use Inertia\Response;

class PatientController extends Controller
{
    public function __construct(
        private readonly WorkspaceViewService $workspace,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorizePatientWorkspace($request);

        $context = $this->workspace->context($request);
        $clinicId = $this->clinicScope($request, $context);

        return Inertia::render('patients/index', [
            'context' => $context,
            'selectedClinicId' => $clinicId,
            'patients' => $this->registeredPatients($request, $clinicId),
            'walkIns' => $this->walkInPatients($request, $clinicId),
            'canCreate' => $request->user()->role === User::ROLE_SUPERADMIN,
        ]);
    }

    public function edit(Request $request, int $patient): Response
    {
        $this->authorizePatientWorkspace($request);

        $context = $this->workspace->context($request);
        $clinicId = $this->clinicScope($request, $context);
        $patientModel = $this->findAccessiblePatient($request, $clinicId, $patient);
        $isSuperadmin = $request->user()->role === User::ROLE_SUPERADMIN;

        return Inertia::render('patients/edit', [
            'context' => $context,
            'patientType' => 'registered',
            'selectedClinicId' => $clinicId,
            'patient' => $this->serializePatient($patientModel),
            'reservations' => $this->serializeReservations($this->patientReservations($patientModel, $clinicId, $isSuperadmin)->get()),
            'medicalRecords' => $isSuperadmin ? [] : $this->serializeMedicalRecords($this->patientMedicalRecords($patientModel, $clinicId)->get()),
            'canEdit' => $isSuperadmin,
            'canDelete' => $isSuperadmin,
            'canViewMedicalRecords' => !$isSuperadmin,
        ]);
    }

    public function walkIn(Request $request, string $walkInKey): Response
    {
        $this->authorizePatientWorkspace($request);

        $context = $this->workspace->context($request);
        $clinicId = $this->clinicScope($request, $context);
        $groups = $this->walkInGroups($request, $clinicId);
        $group = $groups->firstWhere('key', $walkInKey);

        abort_if($group === null, 404);

        $reservationIds = collect($group['entries'])
            ->where('source', 'reservation')
            ->pluck('id')
            ->all();
        $medicalRecordIds = collect($group['entries'])
            ->where('source', 'medical_record')
            ->pluck('id')
            ->all();
        $isSuperadmin = $request->user()->role === User::ROLE_SUPERADMIN;

        return Inertia::render('patients/edit', [
            'context' => $context,
            'patientType' => 'walk_in',
            'selectedClinicId' => $clinicId,
            'patient' => [
                'walk_in_key' => $group['key'],
                'name' => $group['name'],
                'phone_number' => $group['phone_number'],
                'reservation_count' => $group['reservation_count'],
                'medical_record_count' => $group['medical_record_count'],
                'latest_activity_at' => $group['latest_activity_at'],
            ],
            'reservations' => $this->serializeReservations(
                Reservation::query()
                    ->with($this->reservationRelations())
                    ->whereIn('id', $reservationIds)
                    ->orderByDesc('reservation_date')
                    ->orderByDesc('id')
                    ->get()
            ),
            'medicalRecords' => $isSuperadmin ? [] : $this->serializeMedicalRecords(
                MedicalRecord::query()
                    ->with($this->medicalRecordRelations())
                    ->whereIn('id', $medicalRecordIds)
                    ->orderByDesc('issued_at')
                    ->orderByDesc('id')
                    ->get()
            ),
            'canEdit' => false,
            'canDelete' => false,
            'canViewMedicalRecords' => !$isSuperadmin,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeSuperadmin($request);

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:30', 'unique:users,phone_number'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $patient = User::create([
            'name' => $payload['name'],
            'username' => $payload['username'],
            'email' => $payload['email'],
            'phone_number' => $payload['phone_number'] ?? null,
            'date_of_birth' => $payload['date_of_birth'] ?? null,
            'gender' => $payload['gender'] ?? null,
            'role' => User::ROLE_PATIENT,
            'profile_picture' => User::defaultProfilePictureForRole(User::ROLE_PATIENT),
            'password' => $payload['password'],
        ]);

        return to_route('patients.edit', $patient)->with('status', 'Data pasien berhasil dibuat.');
    }

    public function update(Request $request, int $patient): RedirectResponse
    {
        $this->authorizeSuperadmin($request);

        $patientModel = User::query()
            ->whereKey($patient)
            ->where('role', User::ROLE_PATIENT)
            ->firstOrFail();

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($patientModel->id)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($patientModel->id)],
            'phone_number' => ['nullable', 'string', 'max:30', Rule::unique('users', 'phone_number')->ignore($patientModel->id)],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', Rule::in(User::GENDERS)],
        ]);

        $patientModel->update($payload);

        return to_route('patients.edit', $patientModel)->with('status', 'Data pasien berhasil diperbarui.');
    }

    public function destroy(Request $request, int $patient): RedirectResponse
    {
        $this->authorizeSuperadmin($request);

        $patientModel = User::query()
            ->whereKey($patient)
            ->where('role', User::ROLE_PATIENT)
            ->firstOrFail();

        if ($patientModel->reservations()->exists() || $patientModel->patientMedicalRecords()->exists()) {
            throw ValidationException::withMessages([
                'patient' => ['Pasien tidak dapat dihapus karena sudah memiliki riwayat reservasi atau rekam medis.'],
            ]);
        }

        $patientModel->delete();

        return to_route('patients.index')->with('status', 'Data pasien berhasil dihapus.');
    }

    private function authorizePatientWorkspace(Request $request): void
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true), 403);
    }

    private function authorizeSuperadmin(Request $request): void
    {
        abort_unless($request->user()->role === User::ROLE_SUPERADMIN, 403);
    }

    private function clinicScope(Request $request, array $context): ?int
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role === User::ROLE_ADMIN) {
            return $user->clinic_id;
        }

        return $request->integer('clinic_id') ?: null;
    }

    private function findAccessiblePatient(Request $request, ?int $clinicId, int $patient): User
    {
        $patientModel = User::query()
            ->whereKey($patient)
            ->where('role', User::ROLE_PATIENT)
            ->firstOrFail();

        if ($request->user()->role === User::ROLE_SUPERADMIN) {
            return $patientModel;
        }

        abort_unless($clinicId !== null && $this->patientBelongsToClinic($patientModel, $clinicId), 404);

        return $patientModel;
    }

    private function patientBelongsToClinic(User $patient, int $clinicId): bool
    {
        return $patient->reservations()->where('clinic_id', $clinicId)->exists()
            || $patient->patientMedicalRecords()->where('clinic_id', $clinicId)->exists();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function registeredPatients(Request $request, ?int $clinicId): array
    {
        $user = $request->user();
        $reservationScope = fn ($query) => $clinicId !== null ? $query->where('clinic_id', $clinicId) : $query;
        $medicalScope = fn ($query) => $clinicId !== null ? $query->where('clinic_id', $clinicId) : $query;

        $query = User::query()
            ->where('role', User::ROLE_PATIENT)
            ->withCount([
                'reservations as reservation_count' => $reservationScope,
                'patientMedicalRecords as medical_record_count' => $medicalScope,
            ])
            ->withMax(['reservations as latest_reservation_at' => $reservationScope], 'created_at')
            ->withMax(['patientMedicalRecords as latest_medical_record_at' => $medicalScope], 'issued_at')
            ->orderBy('name');

        if ($user->role === User::ROLE_ADMIN) {
            abort_if($clinicId === null, 403);

            $query->where(function ($query) use ($clinicId): void {
                $query->whereHas('reservations', fn ($reservationQuery) => $reservationQuery->where('clinic_id', $clinicId))
                    ->orWhereHas('patientMedicalRecords', fn ($medicalRecordQuery) => $medicalRecordQuery->where('clinic_id', $clinicId));
            });
        }

        return $query->get(['id', 'name', 'username', 'email', 'phone_number', 'date_of_birth', 'gender', 'image_path', 'role'])
            ->map(fn (User $patient): array => $this->serializePatientSummary($patient, 'registered'))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function walkInPatients(Request $request, ?int $clinicId): array
    {
        return $this->walkInGroups($request, $clinicId)
            ->map(fn (array $group): array => collect($group)->except('entries')->all())
            ->values()
            ->all();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function walkInGroups(Request $request, ?int $clinicId): Collection
    {
        $reservationEntries = Reservation::query()
            ->with('clinic:id,name')
            ->whereNull('patient_id')
            ->when($request->user()->role === User::ROLE_ADMIN, fn ($query) => $query->where('clinic_id', $clinicId))
            ->get(['id', 'clinic_id', 'guest_name', 'guest_phone_number', 'created_at'])
            ->map(fn (Reservation $reservation): array => [
                'source' => 'reservation',
                'id' => $reservation->id,
                'clinic_id' => $reservation->clinic_id,
                'clinic_name' => $reservation->clinic?->name,
                'name' => $reservation->guest_name,
                'phone_number' => $reservation->guest_phone_number,
                'activity_at' => $reservation->created_at?->toDateTimeString(),
            ]);

        $medicalRecordEntries = MedicalRecord::query()
            ->with('clinic:id,name')
            ->whereNull('patient_id')
            ->when($request->user()->role === User::ROLE_ADMIN, fn ($query) => $query->where('clinic_id', $clinicId))
            ->get(['id', 'clinic_id', 'guest_name', 'guest_phone_number', 'issued_at', 'created_at'])
            ->map(fn (MedicalRecord $medicalRecord): array => [
                'source' => 'medical_record',
                'id' => $medicalRecord->id,
                'clinic_id' => $medicalRecord->clinic_id,
                'clinic_name' => $medicalRecord->clinic?->name,
                'name' => $medicalRecord->guest_name,
                'phone_number' => $medicalRecord->guest_phone_number,
                'activity_at' => $medicalRecord->issued_at?->toDateTimeString() ?? $medicalRecord->created_at?->toDateTimeString(),
            ]);

        $groups = [];
        $nameIndex = [];
        $phoneIndex = [];

        $reservationEntries
            ->concat($medicalRecordEntries)
            ->sortByDesc('activity_at')
            ->each(function (array $entry) use (&$groups, &$nameIndex, &$phoneIndex): void {
                $nameKey = $this->normalizeName($entry['name'] ?? null);
                $phoneKey = $this->normalizePhone($entry['phone_number'] ?? null);
                $groupKey = ($phoneKey !== '' && isset($phoneIndex[$phoneKey]))
                    ? $phoneIndex[$phoneKey]
                    : (($nameKey !== '' && isset($nameIndex[$nameKey])) ? $nameIndex[$nameKey] : null);

                if ($groupKey === null) {
                    $groupKey = $phoneKey !== ''
                        ? 'phone-'.sha1($phoneKey)
                        : ($nameKey !== '' ? 'name-'.sha1($nameKey) : 'walkin-'.$entry['source'].'-'.$entry['id']);
                }

                $groups[$groupKey] ??= [
                    'type' => 'walk_in',
                    'walk_in_key' => $groupKey,
                    'key' => $groupKey,
                    'name' => $entry['name'] ?: 'Walk-in Patient',
                    'phone_number' => $entry['phone_number'],
                    'reservation_count' => 0,
                    'medical_record_count' => 0,
                    'latest_activity_at' => $entry['activity_at'],
                    'clinics' => [],
                    'entries' => [],
                ];

                if ($groups[$groupKey]['phone_number'] === null && filled($entry['phone_number'] ?? null)) {
                    $groups[$groupKey]['phone_number'] = $entry['phone_number'];
                }

                if ($groups[$groupKey]['name'] === 'Walk-in Patient' && filled($entry['name'] ?? null)) {
                    $groups[$groupKey]['name'] = $entry['name'];
                }

                $groups[$groupKey]['entries'][] = $entry;
                $groups[$groupKey][$entry['source'] === 'reservation' ? 'reservation_count' : 'medical_record_count']++;

                if (filled($entry['clinic_name'] ?? null)) {
                    $groups[$groupKey]['clinics'][$entry['clinic_id']] = $entry['clinic_name'];
                }

                if ($phoneKey !== '') {
                    $phoneIndex[$phoneKey] = $groupKey;
                }

                if ($nameKey !== '') {
                    $nameIndex[$nameKey] = $groupKey;
                }
            });

        return collect($groups)
            ->map(function (array $group): array {
                $group['clinics'] = array_values($group['clinics']);

                return $group;
            })
            ->sortByDesc('latest_activity_at')
            ->values();
    }

    private function patientReservations(User $patient, ?int $clinicId, bool $allClinics): \Illuminate\Database\Eloquent\Builder
    {
        return Reservation::query()
            ->with($this->reservationRelations())
            ->where('patient_id', $patient->id)
            ->when(!$allClinics && $clinicId !== null, fn ($query) => $query->where('clinic_id', $clinicId))
            ->orderByDesc('reservation_date')
            ->orderByDesc('id');
    }

    private function patientMedicalRecords(User $patient, ?int $clinicId): \Illuminate\Database\Eloquent\Builder
    {
        return MedicalRecord::query()
            ->with($this->medicalRecordRelations())
            ->where('patient_id', $patient->id)
            ->when($clinicId !== null, fn ($query) => $query->where('clinic_id', $clinicId))
            ->orderByDesc('issued_at')
            ->orderByDesc('id');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePatientSummary(User $patient, string $type): array
    {
        return [
            'type' => $type,
            'id' => $patient->id,
            'name' => $patient->name,
            'username' => $patient->username,
            'email' => $patient->email,
            'phone_number' => $patient->phone_number,
            'date_of_birth' => $patient->date_of_birth?->toDateString(),
            'gender' => $patient->gender,
            'image_url' => $patient->image_url,
            'reservation_count' => (int) ($patient->reservation_count ?? 0),
            'medical_record_count' => (int) ($patient->medical_record_count ?? 0),
            'latest_activity_at' => collect([$patient->latest_reservation_at ?? null, $patient->latest_medical_record_at ?? null])
                ->filter()
                ->max(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePatient(User $patient): array
    {
        return [
            'type' => 'registered',
            'id' => $patient->id,
            'name' => $patient->name,
            'username' => $patient->username,
            'email' => $patient->email,
            'phone_number' => $patient->phone_number,
            'date_of_birth' => $patient->date_of_birth?->toDateString(),
            'gender' => $patient->gender,
            'image_url' => $patient->image_url,
        ];
    }

    /**
     * @param  iterable<int, Reservation>  $reservations
     * @return array<int, array<string, mixed>>
     */
    private function serializeReservations(iterable $reservations): array
    {
        return collect($reservations)->map(fn (Reservation $reservation): array => [
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'patient_id' => $reservation->patient_id,
            'guest_name' => $reservation->guest_name,
            'guest_phone_number' => $reservation->guest_phone_number,
            'clinic_id' => $reservation->clinic_id,
            'doctor_id' => $reservation->doctor_id,
            'doctor_clinic_schedule_id' => $reservation->doctor_clinic_schedule_id,
            'reservation_date' => $this->normalizeDateValue($reservation->reservation_date),
            'window_start_time' => $reservation->window_start_time,
            'window_end_time' => $reservation->window_end_time,
            'window_slot_number' => $reservation->window_slot_number,
            'status' => $reservation->status,
            'complaint' => $reservation->complaint,
            'clinic' => $reservation->clinic !== null ? [
                'id' => $reservation->clinic->id,
                'name' => $reservation->clinic->name,
            ] : null,
            'doctor' => $reservation->doctor !== null ? [
                'id' => $reservation->doctor->id,
                'name' => $reservation->doctor->name,
            ] : null,
        ])->values()->all();
    }

    /**
     * @param  iterable<int, MedicalRecord>  $medicalRecords
     * @return array<int, array<string, mixed>>
     */
    private function serializeMedicalRecords(iterable $medicalRecords): array
    {
        return collect($medicalRecords)->map(fn (MedicalRecord $medicalRecord): array => [
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
            'doctor' => $medicalRecord->doctor !== null ? [
                'id' => $medicalRecord->doctor->id,
                'name' => $medicalRecord->doctor->name,
            ] : null,
            'clinic' => $medicalRecord->clinic !== null ? [
                'id' => $medicalRecord->clinic->id,
                'name' => $medicalRecord->clinic->name,
            ] : null,
            'reservation' => $medicalRecord->reservation !== null ? [
                'id' => $medicalRecord->reservation->id,
                'reservation_number' => $medicalRecord->reservation->reservation_number,
                'reservation_date' => $this->normalizeDateValue($medicalRecord->reservation->reservation_date),
                'status' => $medicalRecord->reservation->status,
                'complaint' => $medicalRecord->reservation->complaint,
            ] : null,
        ])->values()->all();
    }

    /**
     * @return array<int, string>
     */
    private function reservationRelations(): array
    {
        return [
            'clinic:id,name,address,phone_number,email,image_path',
            'doctor:id,name,username,email,phone_number,image_path',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function medicalRecordRelations(): array
    {
        return [
            'patient:id,name,username,email,phone_number,gender',
            'doctor:id,name,username,email,phone_number,image_path',
            'clinic:id,name,address,phone_number,email,image_path',
            'reservation:id,reservation_number,reservation_date,status,complaint',
        ];
    }

    private function normalizeName(?string $value): string
    {
        return preg_replace('/\s+/', ' ', mb_strtolower(trim((string) $value))) ?? '';
    }

    private function normalizePhone(?string $value): string
    {
        return preg_replace('/\D+/', '', (string) $value) ?? '';
    }

    private function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return $value->toDateString();
        }

        return substr((string) $value, 0, 10);
    }
}
