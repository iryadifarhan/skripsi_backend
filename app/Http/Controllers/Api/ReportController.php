<?php

namespace App\Http\Controllers\Api;

use App\Exports\MedicalRecordsReportExport;
use App\Exports\ReservationsReportExport;
use App\Http\Controllers\Controller;
use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Services\ReportService;
use App\Services\ReservationQueueService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reportService,
        private readonly ReservationQueueService $queueService,
    ) {
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
        ];
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
                    'reservation_date' => $medicalRecord->reservation->reservation_date,
                    'window_start_time' => $medicalRecord->reservation->window_start_time,
                    'window_end_time' => $medicalRecord->reservation->window_end_time,
                    'status' => $medicalRecord->reservation->status,
                ],
            ];
        })->all();
    }

    private function buildFilename(string $prefix, string $format): string
    {
        return $prefix.'-'.now()->format('Ymd-His').'.'.$format;
    }
}
