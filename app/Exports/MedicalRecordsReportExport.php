<?php

namespace App\Exports;

use App\Exports\Support\DataSheetExport;
use App\Exports\Support\SummarySheetExport;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class MedicalRecordsReportExport implements WithMultipleSheets
{
    /**
     * @param  array<string, mixed>  $filters
     * @param  array<string, int>  $summary
     * @param  array<int, array<int, mixed>>  $rows
     */
    public function __construct(
        private readonly array $filters,
        private readonly array $summary,
        private readonly array $rows,
    ) {
    }

    /**
     * @return array<int, object>
     */
    public function sheets(): array
    {
        return [
            new SummarySheetExport('Summary', $this->summaryRows()),
            new DataSheetExport('Medical Records', $this->headings(), $this->rows),
        ];
    }

    /**
     * @return array<int, array<int, string|int>>
     */
    private function summaryRows(): array
    {
        return [
            ['Clinic ID', (int) $this->filters['clinic_id']],
            ['Date From', (string) $this->filters['date_from']],
            ['Date To', (string) $this->filters['date_to']],
            ['Doctor ID', (string) ($this->filters['doctor_id'] ?? 'all')],
            ['Search', (string) ($this->filters['search'] ?? '-')],
            ['Report Type', 'medical_records'],
            ['Total Medical Records', $this->summary['total_medical_records']],
            ['Registered Records', $this->summary['registered_records']],
            ['Walk In Records', $this->summary['walk_in_records']],
            ['Unique Registered Patients', $this->summary['unique_registered_patients']],
            ['Unique Doctors', $this->summary['unique_doctors']],
        ];
    }

    /**
     * @return array<int, string>
     */
    private function headings(): array
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
