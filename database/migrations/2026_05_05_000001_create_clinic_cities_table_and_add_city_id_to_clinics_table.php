<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('clinic_cities', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        $now = now();
        $defaultCityId = DB::table('clinic_cities')->insertGetId([
            'name' => 'Kota Bekasi',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        Schema::table('clinics', function (Blueprint $table) use ($defaultCityId): void {
            $table->foreignId('city_id')
                ->after('address')
                ->default($defaultCityId)
                ->constrained('clinic_cities')
                ->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clinics', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('city_id');
        });

        Schema::dropIfExists('clinic_cities');
    }
};
