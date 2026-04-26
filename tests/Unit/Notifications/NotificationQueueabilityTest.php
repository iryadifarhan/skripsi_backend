<?php

namespace Tests\Unit\Notifications;

use App\Notifications\MedicalRecordReadyNotification;
use App\Notifications\QueueProgressNotification;
use App\Notifications\ReservationReminderNotification;
use App\Notifications\ReservationStatusNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Tests\TestCase;

class NotificationQueueabilityTest extends TestCase
{
    public function test_custom_patient_notifications_are_queueable(): void
    {
        $this->assertContains(ShouldQueue::class, class_implements(ReservationStatusNotification::class));
        $this->assertContains(ShouldQueue::class, class_implements(QueueProgressNotification::class));
        $this->assertContains(ShouldQueue::class, class_implements(MedicalRecordReadyNotification::class));
        $this->assertContains(ShouldQueue::class, class_implements(ReservationReminderNotification::class));
    }
}

