<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            ProfileSeeder::class,
            CategorySeeder::class,
            ProductSeeder::class,
            CategoryLimitSeeder::class,
            UserSeeder::class,
            PointsLedgerSeeder::class,
        ]);

        $this->command->info('All seeders executed successfully!');
    }
}
