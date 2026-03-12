<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            $table->foreignId('doctor_clinic_schedule_id')
                ->nullable()
                ->after('doctor_id')
                ->constrained('doctor_clinic_schedules')
                ->nullOnDelete();
            $table->time('window_start_time')->nullable()->after('reservation_time');
            $table->time('window_end_time')->nullable()->after('window_start_time');
            $table->unsignedSmallInteger('window_slot_number')->nullable()->after('window_end_time');

            $table->index(['doctor_clinic_schedule_id', 'reservation_date', 'window_start_time'], 'reservations_schedule_window_idx');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            $table->dropIndex('reservations_schedule_window_idx');
            $table->dropConstrainedForeignId('doctor_clinic_schedule_id');
            $table->dropColumn([
                'window_start_time',
                'window_end_time',
                'window_slot_number',
            ]);
        });
    }
};
