<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class FonnteService
{
    public function isEnabled(): bool
    {
        return (bool) config('services.fonnte.enabled')
            && !empty(config('services.fonnte.token'))
            && !empty(config('services.fonnte.base_url'));
    }

    public function sendMessage(string $phoneNumber, string $message): bool
    {
        if (!$this->isEnabled()) {
            return false;
        }

        $target = $this->normalizeTarget($phoneNumber);

        if ($target === null) {
            return false;
        }

        try {
            $response = Http::asForm()
                ->withHeaders([
                    'Authorization' => (string) config('services.fonnte.token'),
                ])
                ->post(rtrim((string) config('services.fonnte.base_url'), '/').'/send', [
                    'target' => $target['target'],
                    'countryCode' => $target['country_code'],
                    'message' => $message,
                ]);

            if ($response->failed()) {
                Log::warning('Fonnte request failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            $data = $response->json();

            if (is_array($data) && array_key_exists('status', $data) && $data['status'] === false) {
                Log::warning('Fonnte reported an unsuccessful response.', [
                    'response' => $data,
                ]);

                return false;
            }

            return true;
        } catch (Throwable $exception) {
            Log::warning('Fonnte message sending failed.', [
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * @return array{target: string, country_code: string}|null
     */
    private function normalizeTarget(string $phoneNumber): ?array
    {
        $digits = preg_replace('/\D+/', '', $phoneNumber);

        if ($digits === null || $digits === '') {
            return null;
        }

        if (str_starts_with($digits, '0')) {
            return [
                'target' => $digits,
                'country_code' => (string) config('services.fonnte.country_code', '62'),
            ];
        }

        return [
            'target' => $digits,
            'country_code' => '0',
        ];
    }
}
