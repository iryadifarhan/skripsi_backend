<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use App\Services\PatientNotificationService;
use App\Services\ReservationQueueService;
use App\Services\Web\WorkspaceViewService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class MedicalRecordController extends Controller
{
    public function __construct(
        private readonly ReservationQueueService $queueService,
        private readonly PatientNotificationService $patientNotificationService,
        private readonly WorkspaceViewService $workspace,
    ) {
    }

    public function page(Request $request): JsonResponse|Response
    {
        /** @var User $user */
        $user = $request->user();
        $context = $this->workspace->context($request);
        $payload = $request->validate([
            'clinic_id' => ['nullable', 'integer', 'exists:clinics,id'],
            'reservation_date' => ['nullable', 'date'],
        ]);
        $selectedClinicId = $this->selectedFilterClinicId($request, $context, $payload);
        $query = MedicalRecord::query()
            ->with($this->medicalRecordRelations())
            ->orderByDesc('issued_at')
            ->orderByDesc('id');

        if ($user->role === User::ROLE_PATIENT) {
            $query->where('patient_id', $user->id);

            if ($selectedClinicId !== null) {
                $query->where('clinic_id', $selectedClinicId);
            }
        } elseif (in_array($user->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true) && $selectedClinicId !== null) {
            $query->where('clinic_id', $selectedClinicId);
        } elseif ($user->role === User::ROLE_DOCTOR && $selectedClinicId !== null) {
            $query->where('doctor_id', $user->id)
                ->where('clinic_id', $selectedClinicId);
        } else {
            $query->whereRaw('1 = 0');
        }

        if (!empty($payload['reservation_date'])) {
            $query->whereHas('reservation', fn ($reservationQuery) => $reservationQuery->whereDate('reservation_date', $payload['reservation_date']));
        }

        $medicalRecords = $this->serializeMedicalRecords($query->get());

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Medical record retrieval successful.',
                'medical_records' => $medicalRecords,
            ]);
        }

        return Inertia::render('medical-records/index', [
            'context' => $context,
            'medicalRecords' => $medicalRecords,
            'filters' => [
                'clinicId' => $selectedClinicId,
                'reservationDate' => $payload['reservation_date'] ?? '',
            ],
        ]);
    }

    public function redirectLegacy(Request $request): RedirectResponse
    {
        return redirect()->route('medical-records.page', $request->query());
    }

    private function selectedFilterClinicId(Request $request, array $context, array $payload): ?int
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role === User::ROLE_ADMIN) {
            return $user->clinic_id;
        }

        if (in_array($user->role, [User::ROLE_DOCTOR, User::ROLE_PATIENT], true)) {
            return isset($payload['clinic_id'])
                ? (int) $payload['clinic_id']
                : ($context['clinics'][0]['id'] ?? null);
        }

        if ($user->role === User::ROLE_SUPERADMIN) {
            return isset($payload['clinic_id'])
                ? (int) $payload['clinic_id']
                : ($context['clinics'][0]['id'] ?? null);
        }

        return isset($payload['clinic_id']) ? (int) $payload['clinic_id'] : null;
    }

    public function patientIndex(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['nullable', 'integer', 'exists:clinics,id'],
            'reservation_date' => ['nullable', 'date'],
        ]);

        $query = MedicalRecord::query()
            ->with($this->medicalRecordRelations())
            ->where('patient_id', $request->user()->id)
            ->orderByDesc('issued_at')
            ->orderByDesc('id');

        if (!empty($payload['clinic_id'])) {
            $query->where('clinic_id', $payload['clinic_id']);
        }

        if (!empty($payload['reservation_date'])) {
            $query->whereHas('reservation', fn ($reservationQuery) => $reservationQuery->whereDate('reservation_date', $payload['reservation_date']));
        }

        return response()->json([
            'message' => 'Medical record retrieval successful.',
            'medical_records' => $this->serializeMedicalRecords($query->get()),
        ]);
    }

    public function patientShow(Request $request, MedicalRecord $medicalRecord): JsonResponse
    {
        $this->assertPatientOwnsMedicalRecord($request->user(), $medicalRecord);

        return response()->json([
            'message' => 'Medical record retrieval successful.',
            'medical_record' => $this->serializeMedicalRecord($medicalRecord->load($this->medicalRecordRelations())),
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'reservation_date' => ['nullable', 'date'],
            'patient_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $query = MedicalRecord::query()
            ->with($this->medicalRecordRelations())
            ->where('clinic_id', $payload['clinic_id'])
            ->orderByDesc('issued_at')
            ->orderByDesc('id');

        if (!empty($payload['patient_id'])) {
            $query->where('patient_id', $payload['patient_id']);
        }

        if (!empty($payload['reservation_date'])) {
            $query->whereHas('reservation', fn ($reservationQuery) => $reservationQuery->whereDate('reservation_date', $payload['reservation_date']));
        }

        return response()->json([
            'message' => 'Medical record retrieval successful.',
            'medical_records' => $this->serializeMedicalRecords($query->get()),
        ]);
    }

    public function adminShow(Request $request, MedicalRecord $medicalRecord): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
        ]);

        $this->assertMedicalRecordBelongsToClinic((int) $payload['clinic_id'], $medicalRecord);

        return response()->json([
            'message' => 'Medical record retrieval successful.',
            'medical_record' => $this->serializeMedicalRecord($medicalRecord->load($this->medicalRecordRelations())),
        ]);
    }

    public function doctorIndex(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'reservation_date' => ['nullable', 'date'],
            'patient_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $query = MedicalRecord::query()
            ->with($this->medicalRecordRelations())
            ->where('doctor_id', $request->user()->id)
            ->where('clinic_id', $payload['clinic_id'])
            ->orderByDesc('issued_at')
            ->orderByDesc('id');

        if (!empty($payload['patient_id'])) {
            $query->where('patient_id', $payload['patient_id']);
        }

        if (!empty($payload['reservation_date'])) {
            $query->whereHas('reservation', fn ($reservationQuery) => $reservationQuery->whereDate('reservation_date', $payload['reservation_date']));
        }

        return response()->json([
            'message' => 'Medical record retrieval successful.',
            'medical_records' => $this->serializeMedicalRecords($query->get()),
        ]);
    }

    public function doctorShow(Request $request, MedicalRecord $medicalRecord): JsonResponse
    {
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
        ]);

        $this->assertMedicalRecordBelongsToDoctor($request->user(), (int) $payload['clinic_id'], $medicalRecord);

        return response()->json([
            'message' => 'Medical record retrieval successful.',
            'medical_record' => $this->serializeMedicalRecord($medicalRecord->load($this->medicalRecordRelations())),
        ]);
    }

    public function store(Request $request, Reservation $reservation): JsonResponse
    {
        $doctor = $request->user();
        $payload = $request->validate([
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'diagnosis' => ['nullable', 'string', 'max:5000'],
            'treatment' => ['nullable', 'string', 'max:5000'],
            'prescription_notes' => ['nullable', 'string', 'max:5000'],
            'doctor_notes' => ['required', 'string', 'max:5000'],
        ]);

        $this->assertDoctorCanIssueMedicalRecord($doctor, $reservation, (int) $payload['clinic_id']);

        $medicalRecord = DB::transaction(function () use ($doctor, $reservation, $payload): MedicalRecord {
            $lockedReservation = Reservation::query()
                ->with('medicalRecord')
                ->lockForUpdate()
                ->findOrFail($reservation->id);

            $this->assertDoctorCanIssueMedicalRecord($doctor, $lockedReservation, (int) $payload['clinic_id']);

            if ($lockedReservation->medicalRecord !== null) {
                abort(422, 'A medical record already exists for this reservation.');
            }

            if (!in_array($lockedReservation->status, Reservation::ACTIVE_STATUSES, true)) {
                abort(422, 'Only active reservations can be completed with a medical record.');
            }

            $medicalRecord = MedicalRecord::create([
                'reservation_id' => $lockedReservation->id,
                'patient_id' => $lockedReservation->patient_id,
                'guest_name' => $lockedReservation->guest_name,
                'guest_phone_number' => $lockedReservation->guest_phone_number,
                'clinic_id' => $lockedReservation->clinic_id,
                'doctor_id' => $doctor->id,
                'diagnosis' => $payload['diagnosis'] ?? null,
                'treatment' => $payload['treatment'] ?? null,
                'prescription_notes' => $payload['prescription_notes'] ?? null,
                'doctor_notes' => $payload['doctor_notes'],
                'issued_at' => now(),
            ]);

            $lockedReservation->update([
                'status' => Reservation::STATUS_COMPLETED,
            ]);

            $this->queueService->applyQueueStatus($lockedReservation, Reservation::QUEUE_STATUS_COMPLETED);

            return $medicalRecord->fresh();
        });

        $medicalRecord = $medicalRecord->load($this->medicalRecordRelations());
        $reservation = $reservation->fresh()->load($this->reservationRelations());
        $this->patientNotificationService->sendMedicalRecordReadyNotification($reservation->loadMissing('patient'), $medicalRecord);

        return response()->json([
            'message' => 'Medical record creation successful.',
            'medical_record' => $this->serializeMedicalRecord($medicalRecord),
            'reservation' => $this->queueService->serializeReservation($reservation),
        ], 201);
    }

    /**
     * @param  iterable<int, MedicalRecord>  $medicalRecords
     * @return array<int, array<string, mixed>>
     */
    private function serializeMedicalRecords(iterable $medicalRecords): array
    {
        return collect($medicalRecords)->map(
            fn (MedicalRecord $medicalRecord): array => $this->serializeMedicalRecord($medicalRecord)
        )->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeMedicalRecord(MedicalRecord $medicalRecord): array
    {
        $payload = [
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
            'created_at' => $medicalRecord->created_at,
            'updated_at' => $medicalRecord->updated_at,
        ];

        if ($medicalRecord->relationLoaded('patient')) {
            $payload['patient'] = $medicalRecord->patient;
        }

        if ($medicalRecord->relationLoaded('clinic')) {
            $payload['clinic'] = $medicalRecord->clinic;
        }

        if ($medicalRecord->relationLoaded('doctor')) {
            $payload['doctor'] = $medicalRecord->doctor;
        }

        if ($medicalRecord->relationLoaded('reservation')) {
            $payload['reservation'] = [
                'id' => $medicalRecord->reservation->id,
                'reservation_number' => $medicalRecord->reservation->reservation_number,
                'reservation_date' => $this->normalizeDateValue($medicalRecord->reservation->reservation_date),
                'window_start_time' => $medicalRecord->reservation->window_start_time,
                'window_end_time' => $medicalRecord->reservation->window_end_time,
                'status' => $medicalRecord->reservation->status,
                'reschedule_reason' => $medicalRecord->reservation->reschedule_reason,
            ];
        }

        return $payload;
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
            'reservation:id,reservation_number,reservation_date,window_start_time,window_end_time,status,reschedule_reason',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function reservationRelations(): array
    {
        return [
            'clinic:id,name,address,phone_number,email,image_path',
            'doctor:id,name,username,email,phone_number,image_path',
            'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
        ];
    }

    private function assertPatientOwnsMedicalRecord(User $patient, MedicalRecord $medicalRecord): void
    {
        if ((int) $medicalRecord->patient_id === (int) $patient->id) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized.');
    }

    private function assertMedicalRecordBelongsToClinic(int $clinicId, MedicalRecord $medicalRecord): void
    {
        if ((int) $medicalRecord->clinic_id === $clinicId) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized to access this clinic medical record.');
    }

    private function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return $value->toDateString();
        }

        return substr((string) $value, 0, 10);
    }

    private function assertMedicalRecordBelongsToDoctor(User $doctor, int $clinicId, MedicalRecord $medicalRecord): void
    {
        if ((int) $medicalRecord->clinic_id !== $clinicId) {
            abort(403, 'Forbidden, you are not authorized to access this clinic medical record.');
        }

        if ((int) $medicalRecord->doctor_id === (int) $doctor->id) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized.');
    }

    private function assertDoctorCanIssueMedicalRecord(User $doctor, Reservation $reservation, int $clinicId): void
    {
        if ((int) $reservation->clinic_id !== $clinicId) {
            abort(403, 'Forbidden, you are not authorized to access this clinic reservation.');
        }

        if ((int) $reservation->doctor_id === (int) $doctor->id) {
            return;
        }

        abort(403, 'Forbidden, you are not authorized.');
    }
}

