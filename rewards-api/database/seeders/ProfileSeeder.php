<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Profile;

class ProfileSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Profile::insert([
            ['name' => 'normal', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'restricted', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
