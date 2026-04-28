<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Clinic Report</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111827; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin: 16px 0 8px; }
        p { margin: 0 0 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #d1d5db; padding: 5px; vertical-align: top; }
        th { background: #f3f4f6; text-align: left; }
        .meta td:first-child { width: 180px; font-weight: bold; background: #f9fafb; }
        .small { font-size: 9px; }
        .privacy { padding: 8px; border: 1px solid #f59e0b; background: #fffbeb; color: #92400e; }
    </style>
</head>
<body>
    <h1>Clinic Report</h1>
    <p>{{ $clinic->name ?? 'Selected Clinic' }}</p>

    <h2>Filters</h2>
    <table class="meta">
        <tr><td>Clinic ID</td><td>{{ $filters['clinic_id'] }}</td></tr>
        <tr><td>Date From</td><td>{{ $filters['date_from'] }}</td></tr>
        <tr><td>Date To</td><td>{{ $filters['date_to'] }}</td></tr>
        <tr><td>Doctor ID</td><td>{{ $filters['doctor_id'] ?? 'all' }}</td></tr>
        <tr><td>Status</td><td>{{ $filters['status'] ?? 'all' }}</td></tr>
        <tr><td>Search</td><td>{{ $filters['search'] ?? '-' }}</td></tr>
    </table>

    <h2>Reservation Summary</h2>
    <table class="meta">
        @foreach ($reservationSummary as $label => $value)
            <tr>
                <td>{{ ucwords(str_replace('_', ' ', $label)) }}</td>
                <td>{{ $value }}</td>
            </tr>
        @endforeach
    </table>

    @if ($canViewMedicalRecords)
        <h2>Medical Record Summary</h2>
        <table class="meta">
            @foreach ($medicalRecordSummary as $label => $value)
                <tr>
                    <td>{{ ucwords(str_replace('_', ' ', $label)) }}</td>
                    <td>{{ $value }}</td>
                </tr>
            @endforeach
        </table>
    @else
        <div class="privacy">Medical record data is not displayed for superadmin access.</div>
    @endif

    <h2>Doctor Recap</h2>
    <table>
        <thead>
            <tr>
                <th>Doctor</th>
                <th>Reservations</th>
                <th>Pending</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Cancelled</th>
                <th>Completed</th>
                <th>Medical Records</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($doctorRecap as $row)
                <tr>
                    <td>{{ $row['doctor_name'] }}</td>
                    <td>{{ $row['reservation_count'] }}</td>
                    <td>{{ $row['pending_count'] }}</td>
                    <td>{{ $row['approved_count'] }}</td>
                    <td>{{ $row['rejected_count'] }}</td>
                    <td>{{ $row['cancelled_count'] }}</td>
                    <td>{{ $row['completed_count'] }}</td>
                    <td>{{ $canViewMedicalRecords ? $row['medical_record_count'] : '-' }}</td>
                </tr>
            @empty
                <tr><td colspan="8">No doctor recap data found.</td></tr>
            @endforelse
        </tbody>
    </table>

    <h2>Reservation Data</h2>
    <table class="small">
        <thead>
            <tr>
                <th>Reservation #</th>
                <th>Date</th>
                <th>Window</th>
                <th>Queue</th>
                <th>Status</th>
                <th>Patient</th>
                <th>Phone</th>
                <th>Doctor</th>
                <th>Complaint</th>
                <th>Admin Notes</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($reservations as $reservation)
                <tr>
                    <td>{{ $reservation['reservation_number'] }}</td>
                    <td>{{ $reservation['reservation_date'] }}</td>
                    <td>{{ $reservation['window_start_time'] }} - {{ $reservation['window_end_time'] }}</td>
                    <td>#{{ $reservation['queue_summary']['number'] ?? '-' }} / {{ $reservation['queue_summary']['status'] ?? '-' }}</td>
                    <td>{{ $reservation['status'] }}</td>
                    <td>{{ $reservation['patient']['name'] ?? $reservation['guest_name'] ?? '-' }}</td>
                    <td>{{ $reservation['patient']['phone_number'] ?? $reservation['guest_phone_number'] ?? '-' }}</td>
                    <td>{{ $reservation['doctor']['name'] ?? '-' }}</td>
                    <td>{{ $reservation['complaint'] ?? '-' }}</td>
                    <td>{{ $reservation['admin_notes'] ?? '-' }}</td>
                </tr>
            @empty
                <tr><td colspan="10">No reservation data found.</td></tr>
            @endforelse
        </tbody>
    </table>

    @if ($canViewMedicalRecords)
        <h2>Medical Record Data</h2>
        <table class="small">
            <thead>
                <tr>
                    <th>Record ID</th>
                    <th>Issued At</th>
                    <th>Reservation #</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Diagnosis</th>
                    <th>Treatment</th>
                    <th>Prescription</th>
                    <th>Doctor Notes</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($medicalRecords as $medicalRecord)
                    <tr>
                        <td>{{ $medicalRecord['id'] }}</td>
                        <td>{{ $medicalRecord['issued_at'] }}</td>
                        <td>{{ $medicalRecord['reservation']['reservation_number'] ?? '-' }}</td>
                        <td>{{ $medicalRecord['patient']['name'] ?? $medicalRecord['guest_name'] ?? '-' }}</td>
                        <td>{{ $medicalRecord['doctor']['name'] ?? '-' }}</td>
                        <td>{{ $medicalRecord['diagnosis'] ?? '-' }}</td>
                        <td>{{ $medicalRecord['treatment'] ?? '-' }}</td>
                        <td>{{ $medicalRecord['prescription_notes'] ?? '-' }}</td>
                        <td>{{ $medicalRecord['doctor_notes'] }}</td>
                    </tr>
                @empty
                    <tr><td colspan="9">No medical record data found.</td></tr>
                @endforelse
            </tbody>
        </table>
    @endif
</body>
</html>
