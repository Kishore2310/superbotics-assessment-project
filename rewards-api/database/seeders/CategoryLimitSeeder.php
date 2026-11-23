<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategoryLimitSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Category::all() as $category) {
            DB::table('category_limits')->insert([
                'category_id' => $category->id,
                'monthly_limit' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
