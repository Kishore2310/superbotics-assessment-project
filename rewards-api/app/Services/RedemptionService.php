<?php

namespace App\Services;

use App\Models\User;
use App\Models\Product;
use App\Models\PointsLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RedemptionService
{
    public function redeem(int $userId, int $productId): array
    {
        return DB::transaction(function () use ($userId, $productId) {

            // Lock user row to prevent concurrent redemptions
            $user = User::whereKey($userId)
                ->lockForUpdate()
                ->firstOrFail();

            // Check restricted profile
            $user->load('profile');

            if ($user->profile->name === 'restricted') {
                throw ValidationException::withMessages([
                    'user' => ['Restricted users cannot redeem products.']
                ]);
            }

            // Find active product
            $product = Product::whereKey($productId)
                ->where('is_active', true)
                ->first();

            if (!$product) {
                throw ValidationException::withMessages([
                    'product_id' => ['Product not found or inactive.']
                ]);
            }

            // Check category monthly limit
            $monthlyLimit = $product->category
                ->categoryLimit
                ->monthly_limit;

            $redemptionCount = PointsLedger::where('user_id', $userId)
                ->where('type', 'spend')
                ->whereHas('product', function ($query) use ($product) {
                    $query->where('category_id', $product->category_id);
                })
                ->whereYear('created_at', now()->year)
                ->whereMonth('created_at', now()->month)
                ->count();

            if ($redemptionCount >= $monthlyLimit) {
                throw ValidationException::withMessages([
                    'category' => [
                        'Monthly redemption limit reached for this category.'
                    ]
                ]);
            }

            // Calculate balance using SQL aggregation
            $balance = PointsLedger::where('user_id', $userId)
                ->selectRaw("
                    COALESCE(SUM(
                        CASE
                            WHEN type = 'earn' THEN points
                            WHEN type = 'spend' THEN -points
                            ELSE 0
                        END
                    ), 0) as balance
                ")
                ->value('balance');

            // Check sufficient points
            if ($balance < $product->points) {
                throw ValidationException::withMessages([
                    'points' => ['Insufficient reward points.']
                ]);
            }

            // Deduct points by creating spend ledger entry
            PointsLedger::create([
                'user_id' => $userId,
                'product_id' => $product->id,
                'type' => 'spend',
                'points' => $product->points,
            ]);

            return [
                'message' => 'Product redeemed successfully.',
                'product' => $product->name,
                'points_spent' => $product->points,
                'remaining_balance' => $balance - $product->points,
            ];
        });
    }
}
