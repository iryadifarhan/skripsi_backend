<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $name = env('SUPERADMIN_NAME', 'Super Admin');
        $username = env('SUPERADMIN_USERNAME', 'superadmin');
        $email = env('SUPERADMIN_EMAIL', 'superadmin@example.com');
        $password = env('SUPERADMIN_PASSWORD', 'superadmin123');

        $user = User::query()
            ->where('role', User::ROLE_SUPERADMIN)
            ->first();

        if (!$user) {
            $user = User::query()
                ->where('email', $email)
                ->orWhere('username', $username)
                ->first() ?? new User();
        }

        $user->name = $name;
        $user->username = $username;
        $user->email = $email;
        $user->role = User::ROLE_SUPERADMIN;
        $user->profile_picture = User::defaultProfilePictureForRole(User::ROLE_SUPERADMIN);
        $user->password = $password; // hashed via model cast
        $user->email_verified_at = now();
        $user->save();
    }
}
