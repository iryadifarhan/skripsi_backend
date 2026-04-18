<?php

namespace App\Services;

use App\Models\Reservation;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class ReservationQueueService
{
    public function lineUsesManualOrdering(int $scheduleId, string $reservationDate): bool
    {
        return Reservation::query()
            ->where('doctor_clinic_schedule_id', $scheduleId)
            ->whereDate('reservation_date', $reservationDate)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereIn('queue_status', Reservation::ACTIVE_QUEUE_STATUSES)
            ->where('queue_order_source', Reservation::QUEUE_ORDER_SOURCE_MANUAL)
            ->exists();
    }

    public function nextQueueNumber(int $scheduleId, string $reservationDate): int
    {
        return ((int) Reservation::query()
            ->where('doctor_clinic_schedule_id', $scheduleId)
            ->whereDate('reservation_date', $reservationDate)
            ->lockForUpdate()
            ->max('queue_number')) + 1;
    }

    public function syncQueueLine(int $scheduleId, string $reservationDate): void
    {
        if ($this->lineUsesManualOrdering($scheduleId, $reservationDate)) {
            $this->resequenceQueueLineByCurrentOrder($scheduleId, $reservationDate);

            return;
        }

        $this->resequenceQueueLineByWindowOrder($scheduleId, $reservationDate);
    }

    public function resequenceQueueLineByWindowOrder(int $scheduleId, string $reservationDate): void
    {
        Reservation::query()
            ->where('doctor_clinic_schedule_id', $scheduleId)
            ->whereDate('reservation_date', $reservationDate)
            ->whereNotNull('queue_number')
            ->where(function ($query): void {
                $query->whereNotIn('status', Reservation::ACTIVE_STATUSES)
                    ->orWhereNotIn('queue_status', Reservation::ACTIVE_QUEUE_STATUSES)
                    ->orWhereNull('queue_status');
            })
            ->update([
                'queue_number' => null,
            ]);

        $queueLine = Reservation::query()
            ->where('doctor_clinic_schedule_id', $scheduleId)
            ->whereDate('reservation_date', $reservationDate)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereIn('queue_status', Reservation::ACTIVE_QUEUE_STATUSES)
            ->orderBy('window_start_time')
            ->orderBy('window_slot_number')
            ->orderBy('created_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id']);

        foreach ($queueLine->values() as $index => $queueReservation) {
            Reservation::query()->whereKey($queueReservation->id)->update([
                'queue_number' => 100000 + $index + 1,
                'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_DERIVED,
            ]);
        }

        foreach ($queueLine->values() as $index => $queueReservation) {
            Reservation::query()->whereKey($queueReservation->id)->update([
                'queue_number' => $index + 1,
                'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_DERIVED,
            ]);
        }
    }

    /**
     * @param  EloquentCollection<int, Reservation>|Collection<int, Reservation>|iterable<int, Reservation>  $reservations
     * @return array<int, array<string, mixed>>
     */
    public function serializeReservations(iterable $reservations): array
    {
        $collection = $this->toCollection($reservations);
        $groupedQueueLines = $this->loadQueueLinesForReservations($collection);

        return $collection->map(function (Reservation $reservation) use ($groupedQueueLines): array {
            $queueSummary = $this->buildQueueSnapshot(
                $reservation,
                $groupedQueueLines[$this->queueLineKey($reservation)] ?? collect()
            );

            return $this->buildReservationPayload($reservation, $queueSummary);
        })->all();
    }

    public function serializeReservation(Reservation $reservation): array
    {
        return $this->serializeReservations(collect([$reservation]))[0];
    }

    /**
     * @param  EloquentCollection<int, Reservation>|Collection<int, Reservation>|iterable<int, Reservation>  $reservations
     * @return array<int, array<string, mixed>>
     */
    public function serializeQueueEntries(iterable $reservations, bool $includePatient = false): array
    {
        $collection = $this->toCollection($reservations);
        $groupedQueueLines = $this->loadQueueLinesForReservations($collection);

        return $collection->map(function (Reservation $reservation) use ($groupedQueueLines, $includePatient): array {
            $queueSummary = $this->buildQueueSnapshot(
                $reservation,
                $groupedQueueLines[$this->queueLineKey($reservation)] ?? collect()
            );

            return $this->buildQueuePayload($reservation, $queueSummary, $includePatient);
        })->all();
    }

    public function serializeQueueEntry(Reservation $reservation, bool $includePatient = false): array
    {
        return $this->serializeQueueEntries(collect([$reservation]), $includePatient)[0];
    }

    public function moveReservationToQueueNumber(Reservation $reservation, int $targetQueueNumber): void
    {
        $queueLine = $this->editableQueueLine($reservation);
        $orderedIds = $queueLine->pluck('id')->all();
        $currentIndex = array_search($reservation->id, $orderedIds, true);

        if ($currentIndex === false) {
            return;
        }

        array_splice($orderedIds, $currentIndex, 1);
        $targetIndex = max(0, min($targetQueueNumber - 1, count($orderedIds)));
        array_splice($orderedIds, $targetIndex, 0, [$reservation->id]);

        foreach (array_values($orderedIds) as $index => $reservationId) {
            Reservation::query()->whereKey($reservationId)->update([
                'queue_number' => 100000 + $index + 1,
                'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_MANUAL,
            ]);
        }

        foreach (array_values($orderedIds) as $index => $reservationId) {
            Reservation::query()->whereKey($reservationId)->update([
                'queue_number' => $index + 1,
                'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_MANUAL,
            ]);
        }
    }

    public function compactQueueLine(int $scheduleId, string $reservationDate): void
    {
        $this->syncQueueLine($scheduleId, $reservationDate);
    }

    public function syncWindowSlots(int $scheduleId, string $reservationDate, string $windowStartTime): void
    {
        $normalizedWindowStartTime = substr($windowStartTime, 0, 8);

        $windowReservations = Reservation::query()
            ->where('doctor_clinic_schedule_id', $scheduleId)
            ->whereDate('reservation_date', $reservationDate)
            ->where('window_start_time', $normalizedWindowStartTime)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->orderBy('window_slot_number')
            ->orderBy('created_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id']);

        foreach ($windowReservations->values() as $index => $reservation) {
            Reservation::query()->whereKey($reservation->id)->update([
                'window_slot_number' => $index + 1,
            ]);
        }
    }

    public function applyQueueStatus(Reservation $reservation, string $queueStatus): void
    {
        $now = now();
        $queueLineDate = $this->normalizeDateValue($reservation->reservation_date);
        $attributes = [
            'queue_status' => $queueStatus,
        ];

        if (in_array($queueStatus, [Reservation::QUEUE_STATUS_CALLED, Reservation::QUEUE_STATUS_IN_PROGRESS], true)) {
            Reservation::query()
                ->where('doctor_clinic_schedule_id', $reservation->doctor_clinic_schedule_id)
                ->whereDate('reservation_date', $this->normalizeDateValue($reservation->reservation_date))
                ->whereKeyNot($reservation->id)
                ->whereIn('queue_status', [Reservation::QUEUE_STATUS_CALLED, Reservation::QUEUE_STATUS_IN_PROGRESS])
                ->update([
                    'queue_status' => Reservation::QUEUE_STATUS_WAITING,
                    'queue_called_at' => null,
                    'queue_started_at' => null,
                ]);
        }

        if ($queueStatus === Reservation::QUEUE_STATUS_WAITING) {
            $attributes['queue_called_at'] = null;
            $attributes['queue_started_at'] = null;
            $attributes['queue_completed_at'] = null;
            $attributes['queue_skipped_at'] = null;
        }

        if ($queueStatus === Reservation::QUEUE_STATUS_CALLED) {
            $attributes['queue_called_at'] = $reservation->queue_called_at ?? $now;
            $attributes['queue_started_at'] = null;
            $attributes['queue_completed_at'] = null;
            $attributes['queue_skipped_at'] = null;
        }

        if ($queueStatus === Reservation::QUEUE_STATUS_IN_PROGRESS) {
            $attributes['queue_called_at'] = $reservation->queue_called_at ?? $now;
            $attributes['queue_started_at'] = $reservation->queue_started_at ?? $now;
            $attributes['queue_completed_at'] = null;
            $attributes['queue_skipped_at'] = null;
        }

        if ($queueStatus === Reservation::QUEUE_STATUS_SKIPPED) {
            $attributes['queue_skipped_at'] = $now;
            $attributes['queue_completed_at'] = null;
        }

        if ($queueStatus === Reservation::QUEUE_STATUS_COMPLETED) {
            $attributes['queue_number'] = null;
            $attributes['queue_completed_at'] = $now;
        }

        if ($queueStatus === Reservation::QUEUE_STATUS_CANCELLED) {
            $attributes['queue_number'] = null;
            $attributes['queue_called_at'] = null;
            $attributes['queue_started_at'] = null;
            $attributes['queue_completed_at'] = null;
            $attributes['queue_skipped_at'] = null;
        }

        $reservation->update($attributes);

        if (
            in_array($queueStatus, [Reservation::QUEUE_STATUS_COMPLETED, Reservation::QUEUE_STATUS_CANCELLED], true)
            && $reservation->doctor_clinic_schedule_id !== null
        ) {
            $this->syncQueueLine((int) $reservation->doctor_clinic_schedule_id, $queueLineDate);
            if ($reservation->window_start_time !== null) {
                $this->syncWindowSlots(
                    (int) $reservation->doctor_clinic_schedule_id,
                    $queueLineDate,
                    (string) $reservation->window_start_time
                );
            }
        }
    }

    public function isActiveQueueReservation(Reservation $reservation): bool
    {
        return in_array($this->normalizedQueueStatus($reservation), Reservation::ACTIVE_QUEUE_STATUSES, true);
    }

    /**
     * @param  EloquentCollection<int, Reservation>|Collection<int, Reservation>|iterable<int, Reservation>  $reservations
     * @return Collection<int, Reservation>
     */
    private function toCollection(iterable $reservations): Collection
    {
        return $reservations instanceof Collection
            ? $reservations->values()
            : collect($reservations)->values();
    }

    /**
     * @param  Collection<int, Reservation>  $reservations
     * @return array<string, Collection<int, Reservation>>
     */
    private function loadQueueLinesForReservations(Collection $reservations): array
    {
        $keys = $reservations
            ->filter(fn (Reservation $reservation): bool => $reservation->doctor_clinic_schedule_id !== null)
            ->map(fn (Reservation $reservation): array => [
                'doctor_clinic_schedule_id' => (int) $reservation->doctor_clinic_schedule_id,
                'reservation_date' => $this->normalizeDateValue($reservation->reservation_date),
            ])
            ->unique(fn (array $item): string => $item['doctor_clinic_schedule_id'].'|'.$item['reservation_date'])
            ->values();

        $queueLines = [];

        foreach ($keys as $key) {
            $queueLines[$key['doctor_clinic_schedule_id'].'|'.$key['reservation_date']] = Reservation::query()
                ->where('doctor_clinic_schedule_id', $key['doctor_clinic_schedule_id'])
                ->whereDate('reservation_date', $key['reservation_date'])
                ->orderBy('queue_number')
                ->orderBy('id')
                ->get([
                    'id',
                    'doctor_clinic_schedule_id',
                    'reservation_date',
                    'status',
                    'queue_number',
                    'queue_status',
                ]);
        }

        return $queueLines;
    }

    /**
     * @param  Collection<int, Reservation>  $queueLine
     * @return array<string, int|string|bool|null>
     */
    private function buildQueueSnapshot(Reservation $reservation, Collection $queueLine): array
    {
        $normalizedStatus = $this->normalizedQueueStatus($reservation);

        if ($reservation->queue_number === null || $queueLine->isEmpty()) {
            return [
                'number' => null,
                'status' => $normalizedStatus,
                'size' => 0,
                'current_called_number' => null,
                'position' => null,
                'waiting_ahead' => null,
                'is_current' => false,
            ];
        }

        $activeQueue = $queueLine
            ->filter(fn (Reservation $item): bool => in_array($this->normalizedQueueStatus($item), Reservation::ACTIVE_QUEUE_STATUSES, true))
            ->sortBy('queue_number')
            ->values();

        $currentCalled = $activeQueue
            ->first(fn (Reservation $item): bool => $this->normalizedQueueStatus($item) === Reservation::QUEUE_STATUS_IN_PROGRESS)
            ?? $activeQueue->first(fn (Reservation $item): bool => $this->normalizedQueueStatus($item) === Reservation::QUEUE_STATUS_CALLED);

        $position = null;
        $waitingAhead = null;

        if (in_array($normalizedStatus, Reservation::ACTIVE_QUEUE_STATUSES, true)) {
            $positionIndex = $activeQueue->search(fn (Reservation $item): bool => (int) $item->id === (int) $reservation->id);

            if ($positionIndex !== false) {
                $position = $positionIndex + 1;
                $waitingAhead = $positionIndex;
            }
        }

        return [
            'number' => $reservation->queue_number,
            'status' => $normalizedStatus,
            'size' => $activeQueue->count(),
            'current_called_number' => $currentCalled?->queue_number,
            'position' => $position,
            'waiting_ahead' => $waitingAhead,
            'is_current' => $currentCalled !== null && (int) $currentCalled->id === (int) $reservation->id,
        ];
    }

    /**
     * @return Collection<int, Reservation>
     */
    private function editableQueueLine(Reservation $reservation): Collection
    {
        return Reservation::query()
            ->where('doctor_clinic_schedule_id', $reservation->doctor_clinic_schedule_id)
            ->whereDate('reservation_date', $this->normalizeDateValue($reservation->reservation_date))
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereIn('queue_status', Reservation::ACTIVE_QUEUE_STATUSES)
            ->lockForUpdate()
            ->orderBy('queue_number')
            ->orderBy('id')
            ->get([
                'id',
                'doctor_clinic_schedule_id',
                'reservation_date',
                'status',
                'queue_number',
                'queue_status',
                'queue_order_source',
            ]);
    }

    private function resequenceQueueLineByCurrentOrder(int $scheduleId, string $reservationDate): void
    {
        $queueLine = Reservation::query()
            ->where('doctor_clinic_schedule_id', $scheduleId)
            ->whereDate('reservation_date', $reservationDate)
            ->whereNotNull('queue_number')
            ->where(function ($query): void {
                $query->whereNotIn('status', Reservation::ACTIVE_STATUSES)
                    ->orWhereNotIn('queue_status', Reservation::ACTIVE_QUEUE_STATUSES)
                    ->orWhereNull('queue_status');
            })
            ->update([
                'queue_number' => null,
            ]);

        $queueLine = Reservation::query()
            ->where('doctor_clinic_schedule_id', $scheduleId)
            ->whereDate('reservation_date', $reservationDate)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->whereIn('queue_status', Reservation::ACTIVE_QUEUE_STATUSES)
            ->orderBy('queue_number')
            ->orderBy('id')
            ->lockForUpdate()
            ->get(['id']);

        foreach ($queueLine->values() as $index => $queueReservation) {
            Reservation::query()->whereKey($queueReservation->id)->update([
                'queue_number' => 100000 + $index + 1,
                'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_MANUAL,
            ]);
        }

        foreach ($queueLine->values() as $index => $queueReservation) {
            Reservation::query()->whereKey($queueReservation->id)->update([
                'queue_number' => $index + 1,
                'queue_order_source' => Reservation::QUEUE_ORDER_SOURCE_MANUAL,
            ]);
        }
    }

    /**
     * @param  array<string, int|string|bool|null>  $queueSummary
     * @return array<string, mixed>
     */
    private function buildReservationPayload(Reservation $reservation, array $queueSummary): array
    {
        $payload = [
            'id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'patient_id' => $reservation->patient_id,
            'guest_name' => $reservation->guest_name,
            'guest_phone_number' => $reservation->guest_phone_number,
            'clinic_id' => $reservation->clinic_id,
            'doctor_id' => $reservation->doctor_id,
            'doctor_clinic_schedule_id' => $reservation->doctor_clinic_schedule_id,
            'reservation_date' => $reservation->reservation_date,
            'reservation_time' => $reservation->window_start_time,
            'window_start_time' => $reservation->window_start_time,
            'window_end_time' => $reservation->window_end_time,
            'window_slot_number' => $reservation->window_slot_number,
            'status' => $reservation->status,
            'complaint' => $reservation->complaint,
            'admin_notes' => $reservation->admin_notes,
            'cancellation_reason' => $reservation->cancellation_reason,
            'reschedule_reason' => $reservation->reschedule_reason,
            'cancelled_at' => $reservation->cancelled_at,
            'handled_by_admin_id' => $reservation->handled_by_admin_id,
            'handled_at' => $reservation->handled_at,
            'created_at' => $reservation->created_at,
            'updated_at' => $reservation->updated_at,
            'queue_summary' => $queueSummary,
        ];

        if ($reservation->relationLoaded('patient')) {
            $payload['patient'] = $reservation->patient;
        }

        if ($reservation->relationLoaded('clinic')) {
            $payload['clinic'] = $reservation->clinic;
        }

        if ($reservation->relationLoaded('doctor')) {
            $payload['doctor'] = $reservation->doctor;
        }

        if ($reservation->relationLoaded('doctorClinicSchedule')) {
            $payload['doctor_clinic_schedule'] = $reservation->doctorClinicSchedule;
        }

        return $payload;
    }

    /**
     * @param  array<string, int|string|bool|null>  $queueSummary
     * @return array<string, mixed>
     */
    private function buildQueuePayload(Reservation $reservation, array $queueSummary, bool $includePatient): array
    {
        $payload = [
            'reservation_id' => $reservation->id,
            'reservation_number' => $reservation->reservation_number,
            'patient_id' => $reservation->patient_id,
            'guest_name' => $reservation->guest_name,
            'guest_phone_number' => $reservation->guest_phone_number,
            'reservation_date' => $reservation->reservation_date,
            'reservation_status' => $reservation->status,
            'complaint' => $reservation->complaint,
            'reschedule_reason' => $reservation->reschedule_reason,
            'window' => [
                'start_time' => $reservation->window_start_time,
                'end_time' => $reservation->window_end_time,
                'slot_number' => $reservation->window_slot_number,
            ],
            'queue' => $queueSummary,
        ];

        if ($includePatient && $reservation->relationLoaded('patient')) {
            $payload['patient'] = $reservation->patient;
        }

        if ($reservation->relationLoaded('clinic')) {
            $payload['clinic'] = $reservation->clinic;
        }

        if ($reservation->relationLoaded('doctor')) {
            $payload['doctor'] = $reservation->doctor;
        }

        if ($reservation->relationLoaded('doctorClinicSchedule')) {
            $payload['doctor_clinic_schedule'] = $reservation->doctorClinicSchedule;
        }

        return $payload;
    }

    private function normalizedQueueStatus(Reservation $reservation): string
    {
        if ($reservation->status === Reservation::STATUS_CANCELLED) {
            return Reservation::QUEUE_STATUS_CANCELLED;
        }

        if ($reservation->status === Reservation::STATUS_COMPLETED) {
            return Reservation::QUEUE_STATUS_COMPLETED;
        }

        if ($reservation->status === Reservation::STATUS_REJECTED) {
            return Reservation::QUEUE_STATUS_CANCELLED;
        }

        return (string) ($reservation->queue_status ?: Reservation::QUEUE_STATUS_WAITING);
    }

    private function queueLineKey(Reservation $reservation): string
    {
        return (int) $reservation->doctor_clinic_schedule_id.'|'.$this->normalizeDateValue($reservation->reservation_date);
    }

    private function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \Carbon\CarbonInterface) {
            return $value->toDateString();
        }

        return substr((string) $value, 0, 10);
    }
}
