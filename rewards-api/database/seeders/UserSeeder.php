<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Profile;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $normal = Profile::where('name', 'normal')->firstOrFail();
        $restricted = Profile::where('name', 'restricted')->firstOrFail();

        $password = Hash::make('password123');

        $users = [];

        for ($i = 1; $i <= 1000; $i++) {
            $users[] = [
                'name' => 'Assessment User ' . $i,
                'email' => 'user' . $i . '@example.com',
                'password' => $password,
                'profile_id' => $i % 10 === 0
                    ? $restricted->id
                    : $normal->id,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        foreach (array_chunk($users, 500) as $chunk) {
            User::insert($chunk);
        }
    }
}
