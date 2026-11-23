<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\Category;
class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = Category::all();

        foreach ($categories as $category) {
            for ($i = 1; $i <= 4; $i++) {
                Product::create([
                    'category_id' => $category->id,
                    'name' => $category->name . ' Product ' . $i,
                    'points' => ($i * 500) + ($category->id * 100),
                    'is_active' => true,
                ]);
            }
        }
    }
}
