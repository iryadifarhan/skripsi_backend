<?php

namespace App\Services;

use App\Models\DoctorClinicSchedule;
use Carbon\CarbonImmutable;

class TimeWindowScheduler
{
    /**
     * @return array<int, array{window_start_time: string, window_end_time: string}>
     */
    public function generateWindows(DoctorClinicSchedule $schedule): array
    {
        $start = CarbonImmutable::createFromFormat('H:i:s', $schedule->start_time);
        $end = CarbonImmutable::createFromFormat('H:i:s', $schedule->end_time);

        if ($start->greaterThanOrEqualTo($end) || $schedule->window_minutes <= 0) {
            return [];
        }

        $windows = [];
        $cursor = $start;

        while ($cursor->lt($end)) {
            $windowEnd = $cursor->addMinutes($schedule->window_minutes);

            if ($windowEnd->gt($end)) {
                break;
            }

            $windows[] = [
                'window_start_time' => $cursor->format('H:i:s'),
                'window_end_time' => $windowEnd->format('H:i:s'),
            ];

            $cursor = $windowEnd;
        }

        return $windows;
    }

    /**
     * @return array{window_start_time: string, window_end_time: string}|null
     */
    public function findWindowByStart(DoctorClinicSchedule $schedule, string $windowStartTime): ?array
    {
        $normalized = strlen($windowStartTime) === 5 ? $windowStartTime.':00' : $windowStartTime;

        foreach ($this->generateWindows($schedule) as $window) {
            if ($window['window_start_time'] === $normalized) {
                return $window;
            }
        }

        return null;
    }
}
