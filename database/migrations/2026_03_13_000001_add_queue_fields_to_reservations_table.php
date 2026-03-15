<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            $table->unsignedInteger('queue_number')->nullable()->after('reservation_number');
            $table->string('queue_status')->default('waiting')->after('queue_number');
            $table->timestamp('queue_called_at')->nullable()->after('queue_status');
            $table->timestamp('queue_started_at')->nullable()->after('queue_called_at');
            $table->timestamp('queue_completed_at')->nullable()->after('queue_started_at');
            $table->timestamp('queue_skipped_at')->nullable()->after('queue_completed_at');

            $table->unique(
                ['doctor_clinic_schedule_id', 'reservation_date', 'queue_number'],
                'reservations_schedule_date_queue_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            $table->dropUnique('reservations_schedule_date_queue_unique');
            $table->dropColumn([
                'queue_number',
                'queue_status',
                'queue_called_at',
                'queue_started_at',
                'queue_completed_at',
                'queue_skipped_at',
            ]);
        });
    }
};
