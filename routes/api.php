<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminReservationController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\MedicalRecordController;
use App\Http\Controllers\Api\QueueController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\ClinicController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('web')->group(function (): void {
    // Authenthication flow routes
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    // Superadmin routes
    Route::middleware(['auth:sanctum', 'authorize:superadmin'])->group(function (): void {
        Route::post('/superadmin/clinic/create', [ClinicController::class, 'create']);
        Route::patch('/superadmin/clinic/update/{clinicId}', [ClinicController::class, 'update']);
        Route::delete('/superadmin/clinic/delete/{clinicId}', [ClinicController::class, 'delete']);
    });

    // Admin (Clinic Scoped) routes
    Route::middleware(['auth:sanctum', 'authorize:admin,clinic-scoped'])->group(function (): void {
        Route::post('/admin/user/create', [AdminController::class, 'createUser']);
        Route::get('/admin/user/{usernameOrEmail}', [AdminController::class, 'getUser']);
        Route::patch('/admin/user/{usernameOrEmail}', [AdminController::class, 'updateUser']);
        Route::delete('/admin/user/{usernameOrEmail}', [AdminController::class, 'deleteUser']);

        Route::patch('/admin/clinic/update/{clinicId}', [ClinicController::class, 'update']);
        Route::delete('/admin/clinic/delete/{clinicId}', [ClinicController::class, 'delete']);

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

    // Doctor and Admin (Clinic Scoped) routes
    Route::middleware(['auth:sanctum', 'authorize:admin,doctor,clinic-scoped'])->group(function (): void {
        Route::post('/clinic/schedules', [ClinicController::class, 'createDoctorClinicSchedule']);
        Route::patch('/clinic/schedules/{schedule}', [ClinicController::class, 'updateDoctorClinicSchedule']);
    });

    Route::middleware(['auth:sanctum', 'authorize:doctor,clinic-scoped'])->group(function (): void {
        Route::get('/doctor/queues', [QueueController::class, 'doctorIndex']);
        Route::get('/doctor/medical-records', [MedicalRecordController::class, 'doctorIndex']);
        Route::get('/doctor/medical-records/{medicalRecord}', [MedicalRecordController::class, 'doctorShow']);
        Route::post('/doctor/reservations/{reservation}/medical-records', [MedicalRecordController::class, 'store']);
    });

    // Patient reservation routes
    Route::middleware(['auth:sanctum', 'authorize:admin,patient,clinic-scoped'])->group(function (): void {
        Route::get('/reservations', [ReservationController::class, 'index']);
        Route::post('/reservations', [ReservationController::class, 'store']);
        Route::patch('/reservations/{reservation}/reschedule', [ReservationController::class, 'reschedule']);
        Route::patch('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
    });

    Route::middleware(['auth:sanctum', 'authorize:patient'])->group(function (): void {
        Route::get('/queues/my', [QueueController::class, 'patientIndex']);
        Route::get('/medical-records', [MedicalRecordController::class, 'patientIndex']);
        Route::get('/medical-records/{medicalRecord}', [MedicalRecordController::class, 'patientShow']);
    });

    // Authenticated user routes
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/user', [AuthController::class, 'me']);
        Route::get('/profile', [UserController::class, 'show']);
        Route::patch('/profile', [UserController::class, 'update']);
        Route::patch('/profile/password', [UserController::class, 'updatePassword']);
        Route::get('/profile/picture-options', [UserController::class, 'profilePictureOptions']);
        Route::patch('/profile/picture', [UserController::class, 'updateProfilePicture']);
        Route::post('/logout', [AuthController::class, 'logout']);

        Route::get('/clinics', [ClinicController::class, 'index']);
        Route::get('/clinic/{clinicId}', [ClinicController::class, 'show']);
        Route::get('/reservations/schedules', [ReservationController::class, 'bookingSchedules']);
        Route::get('/reservations/booking/windows', [ReservationController::class, 'availableWindows']);
    });
});
