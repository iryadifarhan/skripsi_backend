export type ScheduleWindowForm = {
    window_minutes: string;
    max_patients_per_window: string;
};

export type ScheduleWindowPreviewEntry = {
    number: number;
    start_time: string;
    end_time: string;
    capacity: number;
};

export type ScheduleWindowPreview = {
    windows: ScheduleWindowPreviewEntry[];
    totalCapacity: number;
    remainderMinutes: number;
    isValid: boolean;
    message: string | null;
};

export const scheduleWindowMinutePresets = ['15', '30', '45', '60'];

export function buildScheduleWindowPreview(
    startTime: string,
    endTime: string,
    windowMinutesValue: string,
    capacityValue: string,
): ScheduleWindowPreview {
    const startMinutes = minutesFromTime(startTime);
    const endMinutes = minutesFromTime(endTime);
    const windowMinutes = Number(windowMinutesValue);
    const capacity = Number(capacityValue);

    if (!Number.isInteger(windowMinutes) || !scheduleWindowMinutePresets.includes(String(windowMinutes))) {
        return {
            windows: [],
            totalCapacity: 0,
            remainderMinutes: 0,
            isValid: false,
            message: 'Durasi window harus menggunakan preset 15, 30, 45, atau 60 menit.',
        };
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
        return {
            windows: [],
            totalCapacity: 0,
            remainderMinutes: 0,
            isValid: false,
            message: 'Kapasitas per window harus minimal 1 pasien.',
        };
    }

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return {
            windows: [],
            totalCapacity: 0,
            remainderMinutes: 0,
            isValid: false,
            message: 'Jam selesai harus lebih besar dari jam mulai.',
        };
    }

    const windows: ScheduleWindowPreviewEntry[] = [];
    let cursor = startMinutes;
    let number = 1;

    while (cursor + windowMinutes <= endMinutes) {
        windows.push({
            number,
            start_time: timeFromMinutes(cursor),
            end_time: timeFromMinutes(cursor + windowMinutes),
            capacity,
        });
        cursor += windowMinutes;
        number += 1;
    }

    const remainderMinutes = endMinutes - cursor;
    const isValid = windows.length > 0 && remainderMinutes === 0;

    return {
        windows,
        totalCapacity: windows.length * capacity,
        remainderMinutes,
        isValid,
        message: isValid
            ? null
            : remainderMinutes > 0
                ? `Sisa ${remainderMinutes} menit tidak membentuk window penuh. Sesuaikan jam praktik atau durasi window.`
                : 'Durasi praktik tidak cukup untuk membentuk window.',
    };
}

export function estimateScheduleCapacity(
    startTime: string,
    endTime: string,
    windowMinutesValue: string,
    capacityValue: string,
): number {
    return buildScheduleWindowPreview(startTime, endTime, windowMinutesValue, capacityValue).totalCapacity;
}

function timeFromMinutes(totalMinutes: number): string {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function minutesFromTime(value: string): number | null {
    const [hour, minute] = value.split(':').map((part) => Number(part));

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        return null;
    }

    return hour * 60 + minute;
}
