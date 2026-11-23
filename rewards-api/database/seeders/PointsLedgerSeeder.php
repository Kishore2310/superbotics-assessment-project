<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PointsLedgerSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // Initial earning transactions
        $users = User::all();

        foreach ($users->chunk(500) as $userChunk) {
            $rows = [];

            foreach ($userChunk as $user) {
                $rows[] = [
                    'user_id' => $user->id,
                    'product_id' => null,
                    'type' => 'earn',
                    'points' => 100000,
                    'created_at' => $now->copy()->subMonths(2),
                    'updated_at' => $now,
                ];
            }

            DB::table('points_ledger')->insert($rows);
        }

        // Historical redemption transactions
        $userIds = User::pluck('id')->toArray();
        $products = Product::all();

        $rows = [];

        for ($i = 1; $i <= 10000; $i++) {
            $product = $products->random();

            $date = fake()->dateTimeBetween(
                '-11 months',
                '-1 day'
            );

            $rows[] = [
                'user_id' => $userIds[array_rand($userIds)],
                'product_id' => $product->id,
                'type' => 'spend',
                'points' => $product->points,
                'created_at' => $date,
                'updated_at' => $date,
            ];

            if (count($rows) === 1000) {
                DB::table('points_ledger')->insert($rows);
                $rows = [];
            }
        }

        if (!empty($rows)) {
            DB::table('points_ledger')->insert($rows);
        }
    }
}
