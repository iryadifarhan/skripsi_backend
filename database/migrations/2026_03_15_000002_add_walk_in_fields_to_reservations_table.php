<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            $table->dropForeign(['patient_id']);
        });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->foreignId('patient_id')->nullable()->change();
            $table->string('guest_name')->nullable()->after('patient_id');
            $table->string('guest_phone_number', 30)->nullable()->after('guest_name');
        });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->foreign('patient_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table): void {
            $table->dropForeign(['patient_id']);
        });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->dropColumn(['guest_name', 'guest_phone_number']);
            $table->foreignId('patient_id')->nullable(false)->change();
        });

        Schema::table('reservations', function (Blueprint $table): void {
            $table->foreign('patient_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
