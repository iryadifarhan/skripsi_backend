<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Reservations Report</title>
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
    <h1>Reservations Report</h1>

    <h2>Filters</h2>
    <table class="meta">
        <tr><td>Clinic ID</td><td>{{ $filters['clinic_id'] }}</td></tr>
        <tr><td>Date From</td><td>{{ $filters['date_from'] }}</td></tr>
        <tr><td>Date To</td><td>{{ $filters['date_to'] }}</td></tr>
        <tr><td>Doctor ID</td><td>{{ $filters['doctor_id'] ?? 'all' }}</td></tr>
        <tr><td>Status</td><td>{{ $filters['status'] ?? 'all' }}</td></tr>
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
                <th>Reservation #</th>
                <th>Date</th>
                <th>Window</th>
                <th>Queue</th>
                <th>Status</th>
                <th>Patient</th>
                <th>Patient Phone</th>
                <th>Doctor</th>
                <th>Complaint</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($reservations as $reservation)
                <tr>
                    <td>{{ $reservation['reservation_number'] }}</td>
                    <td>{{ \Illuminate\Support\Carbon::parse($reservation['reservation_date'])->toDateString() }}</td>
                    <td>{{ $reservation['window_start_time'] }} - {{ $reservation['window_end_time'] }}</td>
                    <td>
                        {{ $reservation['queue_summary']['number'] ?? '-' }}
                        / {{ $reservation['queue_summary']['status'] ?? '-' }}
                    </td>
                    <td>{{ $reservation['status'] }}</td>
                    <td>{{ $reservation['patient']['name'] ?? $reservation['guest_name'] ?? '-' }}</td>
                    <td>{{ $reservation['patient']['phone_number'] ?? $reservation['guest_phone_number'] ?? '-' }}</td>
                    <td>{{ $reservation['doctor']['name'] ?? '-' }}</td>
                    <td>{{ $reservation['complaint'] ?? '-' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="9">No reservations found for the selected filters.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
