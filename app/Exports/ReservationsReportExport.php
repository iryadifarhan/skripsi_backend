<?php

namespace App\Exports;

use App\Exports\Support\DataSheetExport;
use App\Exports\Support\SummarySheetExport;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ReservationsReportExport implements WithMultipleSheets
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
            new DataSheetExport('Reservations', $this->headings(), $this->rows),
        ];
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
            ['Report Type', 'reservations'],
            ['Total Reservations', $this->summary['total_reservations']],
            ['Registered Reservations', $this->summary['registered_reservations']],
            ['Walk In Reservations', $this->summary['walk_in_reservations']],
            ['Pending Reservations', $this->summary['pending_reservations']],
            ['Approved Reservations', $this->summary['approved_reservations']],
            ['Rejected Reservations', $this->summary['rejected_reservations']],
            ['Cancelled Reservations', $this->summary['cancelled_reservations']],
            ['Completed Reservations', $this->summary['completed_reservations']],
        ];

        return $rows;
    }

    /**
     * @return array<int, string>
     */
    private function headings(): array
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
}
