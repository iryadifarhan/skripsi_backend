<?php

namespace App\Services;

use App\Models\MedicalRecord;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ReportService
{
    /**
     * @return array{
     *     filters: array<string, mixed>,
     *     records: EloquentCollection<int, Reservation>,
     *     export_rows: array<int, array<int, mixed>>,
     *     summary: array<string, int>
     * }
     */
    public function reservations(User $actor, array $filters): array
    {
        $doctorId = $this->resolveDoctorFilter($actor, (int) $filters['clinic_id'], $filters['doctor_id'] ?? null);

        $query = Reservation::query()
            ->with([
                'patient:id,name,username,email,phone_number',
                'doctor:id,name,username,email,phone_number',
                'clinic:id,name,address,phone_number,email',
                'doctorClinicSchedule:id,clinic_id,doctor_id,day_of_week,start_time,end_time,window_minutes,max_patients_per_window,is_active',
            ])
            ->where('clinic_id', $filters['clinic_id'])
            ->whereDate('reservation_date', '>=', $filters['date_from'])
            ->whereDate('reservation_date', '<=', $filters['date_to'])
            ->orderBy('reservation_date')
            ->orderBy('window_start_time')
            ->orderBy('window_slot_number');

        if ($doctorId !== null) {
            $query->where('doctor_id', $doctorId);
            $filters['doctor_id'] = $doctorId;
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($query) use ($search): void {
                $query->where('reservation_number', 'like', "%{$search}%")
                    ->orWhere('guest_name', 'like', "%{$search}%")
                    ->orWhere('guest_phone_number', 'like', "%{$search}%")
                    ->orWhere('complaint', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($patientQuery) use ($search): void {
                        $patientQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%");
                    })
                    ->orWhereHas('doctor', function ($doctorQuery) use ($search): void {
                        $doctorQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $records = $query->get();

        return [
            'filters' => $filters,
            'records' => $records,
            'export_rows' => $this->reservationExportRows($records),
            'summary' => [
                'total_reservations' => $records->count(),
                'registered_reservations' => $records->whereNotNull('patient_id')->count(),
                'walk_in_reservations' => $records->whereNull('patient_id')->count(),
                'pending_reservations' => $records->where('status', Reservation::STATUS_PENDING)->count(),
                'approved_reservations' => $records->where('status', Reservation::STATUS_APPROVED)->count(),
                'rejected_reservations' => $records->where('status', Reservation::STATUS_REJECTED)->count(),
                'cancelled_reservations' => $records->where('status', Reservation::STATUS_CANCELLED)->count(),
                'completed_reservations' => $records->where('status', Reservation::STATUS_COMPLETED)->count(),
            ],
        ];
    }

    /**
     * @return array{
     *     filters: array<string, mixed>,
     *     records: EloquentCollection<int, MedicalRecord>,
     *     export_rows: array<int, array<int, mixed>>,
     *     summary: array<string, int>
     * }
     */
    public function medicalRecords(User $actor, array $filters): array
    {
        $doctorId = $this->resolveDoctorFilter($actor, (int) $filters['clinic_id'], $filters['doctor_id'] ?? null);

        $query = MedicalRecord::query()
            ->with([
                'patient:id,name,username,email,phone_number',
                'doctor:id,name,username,email,phone_number',
                'clinic:id,name,address,phone_number,email',
                'reservation:id,reservation_number,reservation_date,window_start_time,window_end_time,status,complaint,reschedule_reason',
            ])
            ->where('clinic_id', $filters['clinic_id'])
            ->whereBetween('issued_at', [$filters['date_from'].' 00:00:00', $filters['date_to'].' 23:59:59'])
            ->orderBy('issued_at')
            ->orderBy('id');

        if ($doctorId !== null) {
            $query->where('doctor_id', $doctorId);
            $filters['doctor_id'] = $doctorId;
        }

        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($query) use ($search): void {
                $query->where('guest_name', 'like', "%{$search}%")
                    ->orWhere('guest_phone_number', 'like', "%{$search}%")
                    ->orWhere('diagnosis', 'like', "%{$search}%")
                    ->orWhere('treatment', 'like', "%{$search}%")
                    ->orWhere('prescription_notes', 'like', "%{$search}%")
                    ->orWhere('doctor_notes', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($patientQuery) use ($search): void {
                        $patientQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%");
                    })
                    ->orWhereHas('doctor', function ($doctorQuery) use ($search): void {
                        $doctorQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('reservation', function ($reservationQuery) use ($search): void {
                        $reservationQuery->where('reservation_number', 'like', "%{$search}%")
                            ->orWhere('complaint', 'like', "%{$search}%");
                    });
            });
        }

        $records = $query->get();

        return [
            'filters' => $filters,
            'records' => $records,
            'export_rows' => $this->medicalRecordExportRows($records),
            'summary' => [
                'total_medical_records' => $records->count(),
                'registered_records' => $records->whereNotNull('patient_id')->count(),
                'walk_in_records' => $records->whereNull('patient_id')->count(),
                'unique_registered_patients' => $records->whereNotNull('patient_id')->pluck('patient_id')->unique()->count(),
                'unique_doctors' => $records->pluck('doctor_id')->filter()->unique()->count(),
            ],
        ];
    }

    /**
     * @param  EloquentCollection<int, Reservation>  $records
     * @return array<int, array<int, mixed>>
     */
    private function reservationExportRows(EloquentCollection $records): array
    {
        return $records->map(function (Reservation $reservation): array {
            return [
                $reservation->reservation_number,
                $this->normalizeDateValue($reservation->reservation_date),
                (string) $reservation->window_start_time,
                (string) $reservation->window_end_time,
                (string) ($reservation->queue_number ?? ''),
                (string) ($reservation->queue_status ?? ''),
                (string) $reservation->status,
                $reservation->patient_id !== null ? 'registered' : 'walk_in',
                $reservation->patient?->name ?? '',
                $reservation->patient?->email ?? '',
                $reservation->patient?->phone_number ?? '',
                (string) ($reservation->guest_name ?? ''),
                (string) ($reservation->guest_phone_number ?? ''),
                $reservation->clinic?->name ?? '',
                $reservation->doctor?->name ?? '',
                (string) ($reservation->complaint ?? ''),
                (string) ($reservation->admin_notes ?? ''),
                (string) ($reservation->cancellation_reason ?? ''),
                (string) ($reservation->reschedule_reason ?? ''),
                optional($reservation->created_at)->toDateTimeString() ?? '',
                optional($reservation->updated_at)->toDateTimeString() ?? '',
            ];
        })->all();
    }

    /**
     * @param  EloquentCollection<int, MedicalRecord>  $records
     * @return array<int, array<int, mixed>>
     */
    private function medicalRecordExportRows(EloquentCollection $records): array
    {
        return $records->map(function (MedicalRecord $medicalRecord): array {
            return [
                (string) $medicalRecord->id,
                optional($medicalRecord->issued_at)->toDateTimeString() ?? '',
                (string) ($medicalRecord->reservation?->reservation_number ?? ''),
                $this->normalizeDateValue($medicalRecord->reservation?->reservation_date),
                (string) ($medicalRecord->reservation?->window_start_time ?? ''),
                (string) ($medicalRecord->reservation?->window_end_time ?? ''),
                $medicalRecord->patient_id !== null ? 'registered' : 'walk_in',
                $medicalRecord->patient?->name ?? '',
                $medicalRecord->patient?->email ?? '',
                $medicalRecord->patient?->phone_number ?? '',
                (string) ($medicalRecord->guest_name ?? ''),
                (string) ($medicalRecord->guest_phone_number ?? ''),
                $medicalRecord->clinic?->name ?? '',
                $medicalRecord->doctor?->name ?? '',
                (string) ($medicalRecord->diagnosis ?? ''),
                (string) ($medicalRecord->treatment ?? ''),
                (string) ($medicalRecord->prescription_notes ?? ''),
                (string) $medicalRecord->doctor_notes,
            ];
        })->all();
    }

    private function resolveDoctorFilter(User $actor, int $clinicId, mixed $doctorId): ?int
    {
        if ($actor->role === User::ROLE_DOCTOR) {
            if ($doctorId !== null && (int) $doctorId !== (int) $actor->id) {
                abort(403, 'Forbidden, you are not authorized to access another doctor report.');
            }

            return (int) $actor->id;
        }

        if ($doctorId === null || $doctorId === '') {
            return null;
        }

        $doctor = User::find((int) $doctorId);

        if (!$doctor || $doctor->role !== User::ROLE_DOCTOR) {
            throw ValidationException::withMessages([
                'doctor_id' => ['Selected doctor is invalid.'],
            ]);
        }

        if (!$doctor->clinics()->whereKey($clinicId)->exists()) {
            throw ValidationException::withMessages([
                'doctor_id' => ['Selected doctor is not assigned to the selected clinic.'],
            ]);
        }

        return (int) $doctorId;
    }

    private function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return $value->toDateString();
        }

        return $value === null ? '' : substr((string) $value, 0, 10);
    }
}
