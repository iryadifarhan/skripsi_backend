<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            return route('password.reset', [
                'token' => $token,
                'email' => $user->email,
            ]);
        });

        ResetPassword::toMailUsing(function (User $user, string $token): MailMessage {
            $resetUrl = route('password.reset', [
                'token' => $token,
                'email' => $user->email,
            ]);

            $expireMinutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');
            $name = $user->name ?: 'Pengguna';

            return (new MailMessage())
                ->subject('Atur ulang kata sandi Cliniqueue')
                ->greeting('Halo '.$name.',')
                ->line('Kami menerima permintaan untuk mengatur ulang kata sandi akun Cliniqueue Anda.')
                ->line('Silakan klik tombol di bawah untuk membuat kata sandi baru.')
                ->action('Atur Ulang Kata Sandi', $resetUrl)
                ->line("Tautan ini akan kedaluwarsa dalam {$expireMinutes} menit.")
                ->line('Jika Anda tidak meminta atur ulang kata sandi, abaikan email ini dan tidak ada tindakan lanjutan yang diperlukan.')
                ->salutation('Salam, '.config('app.name'));
        });
    }
}
