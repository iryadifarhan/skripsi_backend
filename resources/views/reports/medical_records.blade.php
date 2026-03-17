<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Medical Records Report</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111827; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        h2 { font-size: 14px; margin: 18px 0 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
        th { background: #f3f4f6; text-align: left; }
        .meta td:first-child { width: 180px; font-weight: bold; background: #f9fafb; }
        .small { font-size: 11px; }
    </style>
</head>
<body>
    <h1>Medical Records Report</h1>

    <h2>Filters</h2>
    <table class="meta">
        <tr><td>Clinic ID</td><td>{{ $filters['clinic_id'] }}</td></tr>
        <tr><td>Date From</td><td>{{ $filters['date_from'] }}</td></tr>
        <tr><td>Date To</td><td>{{ $filters['date_to'] }}</td></tr>
        <tr><td>Doctor ID</td><td>{{ $filters['doctor_id'] ?? 'all' }}</td></tr>
    </table>

    <h2>Summary</h2>
    <table class="meta">
        @foreach ($summary as $label => $value)
            <tr>
                <td>{{ ucwords(str_replace('_', ' ', $label)) }}</td>
                <td>{{ $value }}</td>
            </tr>
        @endforeach
    </table>

    <h2>Data</h2>
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
                <th>Doctor Notes</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($medicalRecords as $medicalRecord)
                <tr>
                    <td>{{ $medicalRecord['id'] }}</td>
                    <td>{{ optional($medicalRecord['issued_at'])->format('Y-m-d H:i:s') }}</td>
                    <td>{{ $medicalRecord['reservation']['reservation_number'] ?? '-' }}</td>
                    <td>{{ $medicalRecord['patient']['name'] ?? $medicalRecord['guest_name'] ?? '-' }}</td>
                    <td>{{ $medicalRecord['doctor']['name'] ?? '-' }}</td>
                    <td>{{ $medicalRecord['diagnosis'] ?? '-' }}</td>
                    <td>{{ $medicalRecord['treatment'] ?? '-' }}</td>
                    <td>{{ $medicalRecord['doctor_notes'] }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8">No medical records found for the selected filters.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
