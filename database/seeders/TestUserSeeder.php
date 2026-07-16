<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class TestUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            $this->seedPatients();
        });
 
        $this->command?->info('Load test data seeded: 100 patients');
    }
 
    private function seedPatients(): void
    {
        for ($i = 1; $i <= 50; $i++) {
            User::query()->firstOrCreate([
                'email' => "patient_{$i}@testing.com",
                'username' => "patient_{$i}",
                'name' => "Test Patient {$i}",
                'password' => Hash::make('Testing12345!'),
                'role' => User::ROLE_PATIENT,
                'gender' => rand(0, 1) ? User::GENDER_LAKI : User::GENDER_PEREMPUAN,
                'phone_number' => "0890{$i}",
                'email_verified_at' => now(),
            ]);
        }
    }
}
