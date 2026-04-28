<?php

namespace App\Exports;

use App\Exports\Support\DataSheetExport;
use App\Exports\Support\SummarySheetExport;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class CombinedReportExport implements WithMultipleSheets
{
    /**
     * @param  array<string, mixed>  $filters
     * @param  array<string, int>  $reservationSummary
     * @param  array<string, int>  $medicalRecordSummary
     * @param  array<int, array<string, mixed>>  $doctorRecap
     * @param  array<int, array<int, mixed>>  $reservationRows
     * @param  array<int, array<int, mixed>>  $medicalRecordRows
     */
    public function __construct(
        private readonly array $filters,
        private readonly array $reservationSummary,
        private readonly array $medicalRecordSummary,
        private readonly array $doctorRecap,
        private readonly array $reservationRows,
        private readonly array $medicalRecordRows,
        private readonly bool $includeMedicalRecords,
    ) {
    }

    /**
     * @return array<int, object>
     */
    public function sheets(): array
    {
        $sheets = [
            new SummarySheetExport('Summary', $this->summaryRows()),
            new DataSheetExport('Doctor Recap', $this->doctorRecapHeadings(), $this->doctorRecapRows()),
            new DataSheetExport('Reservations', $this->reservationHeadings(), $this->reservationRows),
        ];

        if ($this->includeMedicalRecords) {
            $sheets[] = new DataSheetExport('Medical Records', $this->medicalRecordHeadings(), $this->medicalRecordRows);
        }

        return $sheets;
    }

    /**
     * @return array<int, array<int, string|int>>
     */
    private function summaryRows(): array
    {
        $rows = [
            ['Clinic ID', (int) $this->filters['clinic_id']],
            ['Date From', (string) $this->filters['date_from']],
            ['Date To', (string) $this->filters['date_to']],
            ['Doctor ID', (string) ($this->filters['doctor_id'] ?? 'all')],
            ['Status Filter', (string) ($this->filters['status'] ?? 'all')],
            ['Search', (string) ($this->filters['search'] ?? '-')],
            ['Report Type', 'combined'],
            ['Total Reservations', $this->reservationSummary['total_reservations']],
            ['Registered Reservations', $this->reservationSummary['registered_reservations']],
            ['Walk In Reservations', $this->reservationSummary['walk_in_reservations']],
            ['Pending Reservations', $this->reservationSummary['pending_reservations']],
            ['Approved Reservations', $this->reservationSummary['approved_reservations']],
            ['Rejected Reservations', $this->reservationSummary['rejected_reservations']],
            ['Cancelled Reservations', $this->reservationSummary['cancelled_reservations']],
            ['Completed Reservations', $this->reservationSummary['completed_reservations']],
        ];

        if ($this->includeMedicalRecords) {
            $rows = array_merge($rows, [
                ['Total Medical Records', $this->medicalRecordSummary['total_medical_records']],
                ['Registered Medical Records', $this->medicalRecordSummary['registered_records']],
                ['Walk In Medical Records', $this->medicalRecordSummary['walk_in_records']],
                ['Unique Registered Patients', $this->medicalRecordSummary['unique_registered_patients']],
                ['Unique Medical Record Doctors', $this->medicalRecordSummary['unique_doctors']],
            ]);
        }

        return $rows;
    }

    /**
     * @return array<int, string>
     */
    private function doctorRecapHeadings(): array
    {
        return [
            'Doctor ID',
            'Doctor Name',
            'Reservations',
            'Pending',
            'Approved',
            'Rejected',
            'Cancelled',
            'Completed',
            'Medical Records',
        ];
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    private function doctorRecapRows(): array
    {
        return collect($this->doctorRecap)
            ->map(fn (array $row): array => [
                $row['doctor_id'],
                $row['doctor_name'],
                $row['reservation_count'],
                $row['pending_count'],
                $row['approved_count'],
                $row['rejected_count'],
                $row['cancelled_count'],
                $row['completed_count'],
                $this->includeMedicalRecords ? $row['medical_record_count'] : '-',
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function reservationHeadings(): array
    {
        return [
            'Reservation Number',
            'Reservation Date',
            'Window Start',
            'Window End',
            'Queue Number',
            'Queue Status',
            'Reservation Status',
            'Patient Type',
            'Patient Name',
            'Patient Email',
            'Patient Phone',
            'Guest Name',
            'Guest Phone',
            'Clinic Name',
            'Doctor Name',
            'Complaint',
            'Admin Notes',
            'Cancellation Reason',
            'Reschedule Reason',
            'Created At',
            'Updated At',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function medicalRecordHeadings(): array
    {
        return [
            'Medical Record ID',
            'Issued At',
            'Reservation Number',
            'Reservation Date',
            'Window Start',
            'Window End',
            'Patient Type',
            'Patient Name',
            'Patient Email',
            'Patient Phone',
            'Guest Name',
            'Guest Phone',
            'Clinic Name',
            'Doctor Name',
            'Diagnosis',
            'Treatment',
            'Prescription Notes',
            'Doctor Notes',
        ];
    }
}
