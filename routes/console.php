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

    $this->info("Reservation reminders dispatched: {$sent}");
})->purpose('Send reminders for approved reservations starting within the next 2 hours.');

Schedule::command('reservations:send-reminders')
    ->everyMinute()
    ->withoutOverlapping();
