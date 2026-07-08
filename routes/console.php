<?php

use App\Services\ReservationReminderService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('reservations:send-reminders', function (ReservationReminderService $reminderService): void {
    $sent = $reminderService->sendUpcomingApprovedReminders();

    $this->info("Pengingat reservasi dikirim: {$sent}");
})->purpose('Mengirim pengingat untuk reservasi approved yang dimulai kurang dari 2 jam lagi.');

Schedule::command('reservations:send-reminders')
    ->hourly()
    ->onOneServer()
    ->withoutOverlapping();
