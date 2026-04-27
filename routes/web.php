<?php

use App\Http\Controllers\Web\AuthPageController;
use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\AdminReservationController;
use App\Http\Controllers\Web\ClinicController;
use App\Http\Controllers\Web\DashboardController;
use App\Http\Controllers\Web\DoctorController;
use App\Http\Controllers\Web\MedicalRecordController;
use App\Http\Controllers\Web\ProfileController;
use App\Http\Controllers\Web\QueueController;
use App\Http\Controllers\Web\ReportController;
use App\Http\Controllers\Web\ReservationController;
use Illuminate\Support\Facades\Route;

Route::get('/', [DashboardController::class, 'home'])->name('home');

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthPageController::class, 'login'])->name('login');
    Route::post('/login', [AuthPageController::class, 'authenticate'])->name('login.store');
    Route::get('/register', [AuthPageController::class, 'register'])->name('register');
    Route::post('/register', [AuthPageController::class, 'storeRegister'])->name('register.store');
    Route::get('/forgot-password', [AuthPageController::class, 'forgotPassword'])->name('password.request');
    Route::post('/forgot-password', [AuthPageController::class, 'sendResetLink'])->name('password.email');
    Route::get('/reset-password', [AuthPageController::class, 'redirectResetPassword']);
    Route::post('/reset-password', [AuthPageController::class, 'updatePassword'])->name('password.update');
    Route::get('/reset-password/{token}', [AuthPageController::class, 'resetPassword'])->name('password.reset');
});

Route::middleware('auth')->group(function (): void {
    Route::get('/dashboard', [DashboardController::class, 'dashboard'])->name('dashboard');
    Route::post('/logout', [DashboardController::class, 'logout'])->name('logout');

    Route::get('/reservations', [ReservationController::class, 'index'])->name('reservations.page');
    Route::post('/reservations', [ReservationController::class, 'store'])->name('reservations.store');
    Route::patch('/reservations/{reservation}/process', [AdminReservationController::class, 'processReservation'])->name('reservations.process');
    Route::get('/reservation', [ReservationController::class, 'redirectLegacy'])->name('reservations.legacy');

    Route::get('/queue', [QueueController::class, 'page'])->name('queue.page');
    Route::patch('/queue/{reservation}', [QueueController::class, 'adminUpdate'])->name('queue.update');

    Route::get('/medical-records', [MedicalRecordController::class, 'page'])->name('medical-records.page');
    Route::get('/medical_record', [MedicalRecordController::class, 'redirectLegacy'])->name('medical-records.legacy');

    Route::get('/doctors', [DoctorController::class, 'index'])->name('doctors.index');
    Route::get('/doctors/{doctor}/edit', [DoctorController::class, 'edit'])->name('doctors.edit');
    Route::patch('/doctors/{doctor}', [DoctorController::class, 'update'])->name('doctors.update');
    Route::post('/doctors/{doctor}/image', [DoctorController::class, 'uploadImage'])->name('doctors.image');

    Route::middleware('authorize:admin,superadmin')->group(function (): void {
        Route::get('/clinic-settings', [ClinicController::class, 'settings'])->name('clinic-settings.index');
        Route::patch('/clinic-settings/{clinicId}', [ClinicController::class, 'update'])->name('clinic-settings.update');
        Route::post('/clinic-settings/{clinicId}/image', [ClinicController::class, 'uploadClinicImage'])->name('clinic-settings.image');
        Route::post('/clinic-settings/schedules', [ClinicController::class, 'createDoctorClinicSchedule'])->name('clinic-settings.schedules.store');
        Route::patch('/clinic-settings/schedules/{schedule}', [ClinicController::class, 'updateDoctorClinicSchedule'])->name('clinic-settings.schedules.update');
    });

    Route::middleware('authorize:superadmin')->group(function (): void {
        Route::post('/superadmin/clinic/create', [ClinicController::class, 'create']);
        Route::patch('/superadmin/clinic/update/{clinicId}', [ClinicController::class, 'update']);
        Route::delete('/superadmin/clinic/delete/{clinicId}', [ClinicController::class, 'delete']);
        Route::post('/superadmin/clinic/{clinicId}/image', [ClinicController::class, 'uploadClinicImage']);
        Route::post('/superadmin/clinic/{clinicId}/doctor-image', [ClinicController::class, 'uploadDoctorImage']);
    });

    Route::middleware('authorize:admin,clinic-scoped')->group(function (): void {
        Route::post('/admin/user/create', [AdminController::class, 'createUser']);
        Route::get('/admin/user/{usernameOrEmail}', [AdminController::class, 'getUser']);
        Route::patch('/admin/user/{usernameOrEmail}', [AdminController::class, 'updateUser']);
        Route::delete('/admin/user/{usernameOrEmail}', [AdminController::class, 'deleteUser']);

        Route::patch('/admin/clinic/update/{clinicId}', [ClinicController::class, 'update']);
        Route::delete('/admin/clinic/delete/{clinicId}', [ClinicController::class, 'delete']);
        Route::post('/admin/clinic/{clinicId}/image', [ClinicController::class, 'uploadClinicImage']);
        Route::post('/admin/clinic/{clinicId}/doctor-image', [ClinicController::class, 'uploadDoctorImage']);
        Route::patch('/admin/clinic/doctor/{clinicId}', [ClinicController::class, 'assignDoctor']);
        Route::delete('/admin/clinic/doctor/{clinicId}', [ClinicController::class, 'removeDoctor']);

        Route::get('/admin/reservations', [AdminReservationController::class, 'index']);
        Route::get('/admin/reservations/{reservation}', [AdminReservationController::class, 'show']);
        Route::patch('/admin/reservations/{reservation}', [AdminReservationController::class, 'processReservation']);
        Route::patch('/admin/reservations/{reservation}/details', [AdminReservationController::class, 'update']);

        Route::get('/admin/medical-records', [MedicalRecordController::class, 'adminIndex']);
        Route::get('/admin/medical-records/{medicalRecord}', [MedicalRecordController::class, 'adminShow']);

        Route::get('/admin/queues', [QueueController::class, 'adminIndex']);
        Route::patch('/admin/queues/{reservation}', [QueueController::class, 'adminUpdate']);
    });

    Route::middleware('authorize:admin,doctor,clinic-scoped')->group(function (): void {
        Route::post('/clinic/schedules', [ClinicController::class, 'createDoctorClinicSchedule']);
        Route::patch('/clinic/schedules/{schedule}', [ClinicController::class, 'updateDoctorClinicSchedule']);

        Route::get('/reports/reservations', [ReportController::class, 'reservations']);
        Route::get('/reports/reservations/export', [ReportController::class, 'exportReservations']);
        Route::get('/reports/medical-records', [ReportController::class, 'medicalRecords']);
        Route::get('/reports/medical-records/export', [ReportController::class, 'exportMedicalRecords']);
    });

    Route::middleware('authorize:doctor,clinic-scoped')->group(function (): void {
        Route::get('/doctor/queues', [QueueController::class, 'doctorIndex']);
        Route::get('/doctor/medical-records', [MedicalRecordController::class, 'doctorIndex']);
        Route::get('/doctor/medical-records/{medicalRecord}', [MedicalRecordController::class, 'doctorShow']);
        Route::post('/doctor/reservations/{reservation}/medical-records', [MedicalRecordController::class, 'store']);
    });

    Route::middleware('authorize:admin,patient,clinic-scoped')->group(function (): void {
        Route::patch('/reservations/{reservation}/reschedule', [ReservationController::class, 'reschedule']);
        Route::patch('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
    });

    Route::middleware('authorize:patient')->group(function (): void {
        Route::get('/queues/my', [QueueController::class, 'patientIndex']);
        Route::get('/medical-records/{medicalRecord}', [MedicalRecordController::class, 'patientShow']);
    });

    Route::get('/user', [\App\Http\Controllers\Web\AuthController::class, 'me']);
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::patch('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::get('/profile/picture-options', [ProfileController::class, 'profilePictureOptions']);
    Route::patch('/profile/picture', [ProfileController::class, 'updateProfilePicture']);

    Route::get('/clinics', [ClinicController::class, 'index']);
    Route::get('/reservations/schedules', [ReservationController::class, 'bookingSchedules']);
    Route::get('/reservations/booking/windows', [ReservationController::class, 'availableWindows']);
    Route::get('/clinic/{clinicId}', [ClinicController::class, 'show']);
});
