<?php

namespace App\Jobs;

use App\Services\FonnteService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendWhatsAppNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function __construct(
        public readonly string $phoneNumber,
        public readonly string $message,
        public readonly ?int $reservationId = null,
    ) {
        $this->afterCommit();
    }

    public function handle(FonnteService $fonnteService): void
    {
        $fonnteService->sendMessage($this->phoneNumber, $this->message);
    }

    public function failed(Throwable $exception): void
    {
        Log::warning('Queued WhatsApp notification failed.', [
            'reservation_id' => $this->reservationId,
            'phone_number' => $this->phoneNumber,
            'message' => $exception->getMessage(),
        ]);
    }
}
