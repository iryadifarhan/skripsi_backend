<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('clinic_user')
            ->select(['id', 'speciality'])
            ->orderBy('id')
            ->chunkById(100, function ($rows): void {
                foreach ($rows as $row) {
                    if ($row->speciality === null || $row->speciality === '') {
                        continue;
                    }

                    $decoded = json_decode((string) $row->speciality, true);

                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        continue;
                    }

                    DB::table('clinic_user')
                        ->where('id', $row->id)
                        ->update([
                            'speciality' => json_encode([(string) $row->speciality], JSON_UNESCAPED_UNICODE),
                        ]);
                }
            });
    }

    public function down(): void
    {
        DB::table('clinic_user')
            ->select(['id', 'speciality'])
            ->orderBy('id')
            ->chunkById(100, function ($rows): void {
                foreach ($rows as $row) {
                    if ($row->speciality === null || $row->speciality === '') {
                        continue;
                    }

                    $decoded = json_decode((string) $row->speciality, true);

                    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
                        continue;
                    }

                    DB::table('clinic_user')
                        ->where('id', $row->id)
                        ->update([
                            'speciality' => $decoded[0] ?? null,
                        ]);
                }
            });
    }
};
