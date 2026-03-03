<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use Illuminate\Support\Facades\Route;

Route::middleware('web')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    Route::middleware(['auth:sanctum', 'authorize:admin'])->group(function (): void {
        Route::post('/admin/user/create', [AdminController::class, 'createUser']);
        Route::get('/admin/user/{usernameOrEmail}', [AdminController::class, 'getUser']);
        Route::patch('/admin/user/{usernameOrEmail}', [AdminController::class, 'updateUser']);
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/user', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});
