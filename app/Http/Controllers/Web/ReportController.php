<?php

namespace App\Http\Controllers\Web;

use App\Exports\CombinedReportExport;
use App\Exports\MedicalRecordsReportExport;
use App\Exports\ReservationsReportExport;
use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ReportService;
use App\Services\ReservationQueueService;
use App\Services\Web\WorkspaceViewService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reportService,
        private readonly ReservationQueueService $queueService,
        private readonly WorkspaceViewService $workspace,
    ) {
    }

    public function page(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true), 403);

        $context = $this->workspace->context($request);
        $payload = $request->validate($this->pageReportRules());
        $selectedClinic = $this->selectedReportClinic($request, $context, $payload);
        $filters = $this->normalizedPageFilters($payload, $selectedClinic?->id);

        $reservationReport = $selectedClinic !== null
            ? $this->reportService->reservations($user, $filters)
            : $this->emptyReservationReport($filters);

        $canViewMedicalRecords = $user->role === User::ROLE_ADMIN && $selectedClinic !== null;
        $medicalRecordReport = $canViewMedicalRecords
            ? $this->reportService->medicalRecords($user, $this->medicalRecordFiltersFromPage($filters))
            : $this->emptyMedicalRecordReport($this->medicalRecordFiltersFromPage($filters));

        $reservations = $this->queueService->serializeReservations($reservationReport['records']);
        $medicalRecords = $canViewMedicalRecords ? $this->serializeMedicalRecords($medicalRecordReport['records']) : [];

        return Inertia::render('reports/index', [
            'context' => $context,
            'clinic' => $selectedClinic === null ? null : [
                'id' => $selectedClinic->id,
                'name' => $selectedClinic->name,
            ],
            'filters' => [
                'clinicId' => $filters['clinic_id'],
                'dateFrom' => $filters['date_from'],
                'dateTo' => $filters['date_to'],
                'doctorId' => $filters['doctor_id'],
                'status' => $filters['status'],
                'search' => $filters['search'],
            ],
            'doctorOptions' => $selectedClinic === null ? [] : $this->doctorOptions($selectedClinic),
            'canViewMedicalRecords' => $canViewMedicalRecords,
            'reservationSummary' => $reservationReport['summary'],
            'medicalRecordSummary' => $medicalRecordReport['summary'],
            'doctorRecap' => $this->doctorRecap($reservationReport['records'], $canViewMedicalRecords ? $medicalRecordReport['records'] : collect(), $canViewMedicalRecords),
            'reservations' => $reservations,
            'medicalRecords' => $medicalRecords,
        ]);
    }

    public function export(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, [User::ROLE_ADMIN, User::ROLE_SUPERADMIN], true), 403);

        $context = $this->workspace->context($request);
        $payload = $request->validate(array_merge($this->pageReportRules(), [
            'format' => ['required', 'string', 'in:xlsx,pdf'],
        ]));
        $selectedClinic = $this->selectedReportClinic($request, $context, $payload);
        abort_if($selectedClinic === null, 422, 'Clinic is required for report export.');

        $filters = $this->normalizedPageFilters($payload, $selectedClinic->id);
        $reservationReport = $this->reportService->reservations($user, $filters);
        $canViewMedicalRecords = $user->role === User::ROLE_ADMIN;
        $medicalRecordReport = $canViewMedicalRecords
            ? $this->reportService->medicalRecords($user, $this->medicalRecordFiltersFromPage($filters))
            : $this->emptyMedicalRecordReport($this->medicalRecordFiltersFromPage($filters));
        $doctorRecap = $this->doctorRecap(
            $reservationReport['records'],
            $canViewMedicalRecords ? $medicalRecordReport['records'] : collect(),
            $canViewMedicalRecords
        );
        $filename = $this->buildFilename('clinic-report', (string) $payload['format']);

        if ($payload['format'] === 'pdf') {
            $pdf = Pdf::loadView('reports.combined', [
                'clinic' => $selectedClinic,
                'filters' => $filters,
                'canViewMedicalRecords' => $canViewMedicalRecords,
                'reservationSummary' => $reservationReport['summary'],
                'medicalRecordSummary' => $medicalRecordReport['summary'],
                'doctorRecap' => $doctorRecap,
                'reservations' => $this->queueService->serializeReservations($reservationReport['records']),
                'medicalRecords' => $canViewMedicalRecords ? $this->serializeMedicalRecords($medicalRecordReport['records']) : [],
            ])->setPaper('a4', 'landscape');

            return $pdf->download($filename);
        }

        return Excel::download(
            new CombinedReportExport(
                $filters,
                $reservationReport['summary'],
                $medicalRecordReport['summary'],
                $doctorRecap,
                $reservationReport['export_rows'],
                $canViewMedicalRecords ? $medicalRecordReport['export_rows'] : [],
                $canViewMedicalRecords
            ),
            $filename
        );
    }

    public function reservations(Request $request): JsonResponse
    {
        $filters = $request->validate($this->reservationReportRules());
        $report = $this->reportService->reservations($request->user(), $filters);

        return response()->json([
            'message' => 'Reservation report retrieval successful.',
            'filters' => $report['filters'],
            'summary' => $report['summary'],
            'reservations' => $this->queueService->serializeReservations($report['records']),
        ]);
    }

    public function exportReservations(Request $request)
    {
        $filters = $request->validate(array_merge($this->reservationReportRules(), [
            'format' => ['required', 'string', 'in:xlsx,pdf'],
        ]));
        $report = $this->reportService->reservations($request->user(), $filters);
        $filename = $this->buildFilename('reservations-report', (string) $filters['format']);

        if ($filters['format'] === 'pdf') {
            $pdf = Pdf::loadView('reports.reservations', [
                'filters' => $report['filters'],
                'summary' => $report['summary'],
                'reservations' => $this->queueService->serializeReservations($report['records']),
            ])->setPaper('a4', 'landscape');

            return $pdf->download($filename);
        }

        return Excel::download(
            new ReservationsReportExport($report['filters'], $report['summary'], $report['export_rows']),
            $filename
        );
    }

    public function medicalRecords(Request $request): JsonResponse
    {
        $this->denySuperadminMedicalRecordAccess($request);

        $filters = $request->validate($this->medicalRecordReportRules());
        $report = $this->reportService->medicalRecords($request->user(), $filters);

        return response()->json([
            'message' => 'Medical record report retrieval successful.',
            'filters' => $report['filters'],
            'summary' => $report['summary'],
            'medical_records' => $this->serializeMedicalRecords($report['records']),
        ]);
    }

    public function exportMedicalRecords(Request $request)
    {
        $this->denySuperadminMedicalRecordAccess($request);

        $filters = $request->validate(array_merge($this->medicalRecordReportRules(), [
            'format' => ['required', 'string', 'in:xlsx,pdf'],
        ]));
        $report = $this->reportService->medicalRecords($request->user(), $filters);
        $filename = $this->buildFilename('medical-records-report', (string) $filters['format']);

        if ($filters['format'] === 'pdf') {
            $pdf = Pdf::loadView('reports.medical_records', [
                'filters' => $report['filters'],
                'summary' => $report['summary'],
                'medicalRecords' => $this->serializeMedicalRecords($report['records']),
            ])->setPaper('a4', 'landscape');

            return $pdf->download($filename);
        }

        return Excel::download(
            new MedicalRecordsReportExport($report['filters'], $report['summary'], $report['export_rows']),
            $filename
        );
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function reservationReportRules(): array
    {
        return [
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'doctor_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'string', 'in:pending,approved,rejected,cancelled,completed'],
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function medicalRecordReportRules(): array
    {
        return [
            'clinic_id' => ['required', 'integer', 'exists:clinics,id'],
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'doctor_id' => ['nullable', 'integer', 'exists:users,id'],
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function pageReportRules(): array
    {
        return [
            'clinic_id' => ['nullable', 'integer', 'exists:clinics,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'doctor_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'string', 'in:pending,approved,rejected,cancelled,completed'],
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }

    private function selectedReportClinic(Request $request, array $context, array $payload): ?Clinic
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role === User::ROLE_ADMIN) {
            return $user->clinic_id !== null ? Clinic::find($user->clinic_id) : null;
        }

        if ($user->role === User::ROLE_SUPERADMIN) {
            $clinicId = isset($payload['clinic_id'])
                ? (int) $payload['clinic_id']
                : ($context['clinics'][0]['id'] ?? null);

            return $clinicId !== null ? Clinic::find($clinicId) : null;
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{clinic_id: int|null, date_from: string, date_to: string, doctor_id: int|null, status: string|null, search: string|null}
     */
    private function normalizedPageFilters(array $payload, ?int $clinicId): array
    {
        $today = Carbon::today();
        $dateFrom = (string) ($payload['date_from'] ?? $today->copy()->startOfMonth()->toDateString());
        $dateTo = (string) ($payload['date_to'] ?? ($payload['date_from'] ?? $today->toDateString()));
        $search = isset($payload['search']) ? trim((string) $payload['search']) : '';

        return [
            'clinic_id' => $clinicId,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'doctor_id' => isset($payload['doctor_id']) && $payload['doctor_id'] !== '' ? (int) $payload['doctor_id'] : null,
            'status' => isset($payload['status']) && $payload['status'] !== '' ? (string) $payload['status'] : null,
            'search' => $search === '' ? null : $search,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function medicalRecordFiltersFromPage(array $filters): array
    {
        return [
            'clinic_id' => $filters['clinic_id'],
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'doctor_id' => $filters['doctor_id'] ?? null,
            'search' => $filters['search'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function emptyReservationReport(array $filters): array
    {
        return [
            'filters' => $filters,
            'records' => new \Illuminate\Database\Eloquent\Collection(),
            'export_rows' => [],
            'summary' => [
                'total_reservations' => 0,
                'registered_reservations' => 0,
                'walk_in_reservations' => 0,
                'pending_reservations' => 0,
                'approved_reservations' => 0,
                'rejected_reservations' => 0,
                'cancelled_reservations' => 0,
                'completed_reservations' => 0,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function emptyMedicalRecordReport(array $filters): array
    {
        return [
            'filters' => $filters,
            'records' => new \Illuminate\Database\Eloquent\Collection(),
            'export_rows' => [],
            'summary' => [
                'total_medical_records' => 0,
                'registered_records' => 0,
                'walk_in_records' => 0,
                'unique_registered_patients' => 0,
                'unique_doctors' => 0,
            ],
        ];
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    private function doctorOptions(Clinic $clinic): array
    {
        return $clinic->doctors()
            ->select(['users.id', 'users.name'])
            ->orderBy('users.name')
            ->get()
            ->map(fn (User $doctor): array => [
                'id' => $doctor->id,
                'name' => $doctor->name,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  iterable<int, Reservation>  $reservations
     * @param  iterable<int, MedicalRecord>  $medicalRecords
     * @return array<int, array<string, mixed>>
     */
    private function doctorRecap(iterable $reservations, iterable $medicalRecords, bool $includeMedicalRecords): array
    {
        $rows = [];

        foreach ($reservations as $reservation) {
            $doctorId = (int) $reservation->doctor_id;
            $rows[$doctorId] ??= $this->emptyDoctorRecapRow($doctorId, $reservation->doctor?->name ?? '-');
            $rows[$doctorId]['reservation_count']++;
            $rows[$doctorId][$reservation->status.'_count'] = ($rows[$doctorId][$reservation->status.'_count'] ?? 0) + 1;
        }

        if ($includeMedicalRecords) {
            foreach ($medicalRecords as $medicalRecord) {
                $doctorId = (int) $medicalRecord->doctor_id;
                $rows[$doctorId] ??= $this->emptyDoctorRecapRow($doctorId, $medicalRecord->doctor?->name ?? '-');
                $rows[$doctorId]['medical_record_count']++;
            }
        }

        return collect($rows)
            ->sortBy('doctor_name')
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyDoctorRecapRow(int $doctorId, string $doctorName): array
    {
        return [
            'doctor_id' => $doctorId,
            'doctor_name' => $doctorName,
            'reservation_count' => 0,
            'pending_count' => 0,
            'approved_count' => 0,
            'rejected_count' => 0,
            'cancelled_count' => 0,
            'completed_count' => 0,
            'medical_record_count' => 0,
        ];
    }

    private function denySuperadminMedicalRecordAccess(Request $request): void
    {
        abort_if($request->user()->role === User::ROLE_SUPERADMIN, 403, 'Superadmin cannot access medical record data.');
    }

    /**
     * @param  iterable<int, MedicalRecord>  $medicalRecords
     * @return array<int, array<string, mixed>>
     */
    private function serializeMedicalRecords(iterable $medicalRecords): array
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
                'created_at' => $medicalRecord->created_at,
                'updated_at' => $medicalRecord->updated_at,
                'patient' => $medicalRecord->patient,
                'clinic' => $medicalRecord->clinic,
                'doctor' => $medicalRecord->doctor,
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
        })->all();
    }

    private function buildFilename(string $prefix, string $format): string
    {
        return $prefix.'-'.now()->format('Ymd-His').'.'.$format;
    }

    private function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return $value->toDateString();
        }

        return substr((string) $value, 0, 10);
    }
}

