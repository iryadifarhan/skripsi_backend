<?php

namespace Database\Seeders;

use App\Models\ClinicCity;
use Illuminate\Database\Seeder;

class ClinicCitySeeder extends Seeder
{
    /**
     * Seed the application's clinic city master data.
     */
    public function run(): void
    {
        $cities = [
            'Jakarta Pusat',
            'Jakarta Timur',
            'Jakarta Selatan',
            'Jakarta Utara',
            'Jakarta Barat',
            'Kota Bekasi',
            'Bekasi Utara',
            'Bekasi Barat',
            'Bekasi Selatan',
            'Bekasi Timur',
            'Kota Bogor',
            'Kabupaten Bogor',
            'Depok',
            'Tangerang',
            'Tangerang Selatan',
            'Karawang',
            'Cikarang',
            'Cibitung',
            'Tambun',
        ];

        foreach ($cities as $city) {
            ClinicCity::query()->firstOrCreate([
                'name' => $city,
            ]);
        }
    }
}
