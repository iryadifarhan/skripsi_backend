type QueueEstimateSource = {
    status?: string | null;
    estimated_wait?: number | null;
};

export function queueWaitLabel(queue?: QueueEstimateSource | null): string {
    if (!queue) {
        return '-';
    }

    if (queue.status === 'called') {
        return 'Sedang dipanggil';
    }

    if (queue.status === 'in_progress') {
        return 'Sedang diproses';
    }

    if (queue.status !== 'waiting' || queue.estimated_wait === null || queue.estimated_wait === undefined) {
        return '-';
    }

    return `${queue.estimated_wait} menit`;
}
