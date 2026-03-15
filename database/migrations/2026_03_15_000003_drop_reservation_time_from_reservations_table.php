<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            if (Schema::hasColumn('reservations', 'reservation_time')) {
                $table->dropColumn('reservation_time');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            if (!Schema::hasColumn('reservations', 'reservation_time')) {
                $table->time('reservation_time')->nullable()->after('reservation_date');
            }
        });
    }
};
