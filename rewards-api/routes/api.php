<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\RedemptionController;
use App\Http\Controllers\Api\BalanceController;
use App\Http\Controllers\Api\ReportController;
use App\Models\Product;
use App\Models\User;
use App\Models\Category;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Core Assessment Endpoints
Route::post('/redemptions', [RedemptionController::class, 'store']);
Route::get('/users/{id}/balance', [BalanceController::class, 'show']);
Route::get('/reports/redemptions', [ReportController::class, 'index']);

// Helper Endpoints for React UI
Route::get('/products', function () {
    return Product::with('category.categoryLimit')->where('is_active', true)->get();
});

Route::get('/users', function () {
    return User::with('profile')->take(50)->get();
});

Route::get('/categories', function () {
    return Category::with('categoryLimit')->get();
});
