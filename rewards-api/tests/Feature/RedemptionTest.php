<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CategoryLimit;
use App\Models\PointsLedger;
use App\Models\Product;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RedemptionTest extends TestCase
{
    use RefreshDatabase;

    private Profile $activeProfile;
    private Profile $restrictedProfile;
    private Category $category;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->activeProfile = Profile::create(['name' => 'active']);
        $this->restrictedProfile = Profile::create(['name' => 'restricted']);

        $this->category = Category::create(['name' => 'Test Electronics']);
        CategoryLimit::create([
            'category_id' => $this->category->id,
            'monthly_limit' => 2,
        ]);

        $this->product = Product::create([
            'name' => 'Test Headphones',
            'category_id' => $this->category->id,
            'points' => 100,
            'is_active' => true,
        ]);
    }

    public function test_successful_redemption(): void
    {
        $user = User::factory()->create([
            'profile_id' => $this->activeProfile->id,
        ]);

        PointsLedger::create([
            'user_id' => $user->id,
            'type' => 'earn',
            'points' => 500,
        ]);

        $response = $this->postJson('/api/redemptions', [
            'user_id' => $user->id,
            'product_id' => $this->product->id,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Product redeemed successfully.',
                'product' => $this->product->name,
                'points_spent' => 100,
                'remaining_balance' => 400,
            ]);

        $this->assertDatabaseHas('points_ledger', [
            'user_id' => $user->id,
            'product_id' => $this->product->id,
            'type' => 'spend',
            'points' => 100,
        ]);
    }

    public function test_redemption_fails_when_not_enough_points(): void
    {
        $user = User::factory()->create([
            'profile_id' => $this->activeProfile->id,
        ]);

        PointsLedger::create([
            'user_id' => $user->id,
            'type' => 'earn',
            'points' => 50,
        ]);

        $response = $this->postJson('/api/redemptions', [
            'user_id' => $user->id,
            'product_id' => $this->product->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['points']);
    }

    public function test_redemption_fails_for_restricted_user(): void
    {
        $user = User::factory()->create([
            'profile_id' => $this->restrictedProfile->id,
        ]);

        PointsLedger::create([
            'user_id' => $user->id,
            'type' => 'earn',
            'points' => 1000,
        ]);

        $response = $this->postJson('/api/redemptions', [
            'user_id' => $user->id,
            'product_id' => $this->product->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['user']);
    }

    public function test_redemption_fails_when_category_limit_exceeded(): void
    {
        $user = User::factory()->create([
            'profile_id' => $this->activeProfile->id,
        ]);

        PointsLedger::create([
            'user_id' => $user->id,
            'type' => 'earn',
            'points' => 2000,
        ]);

        // Monthly limit is 2. Create 2 previous spend records this month.
        PointsLedger::create([
            'user_id' => $user->id,
            'product_id' => $this->product->id,
            'type' => 'spend',
            'points' => 100,
            'created_at' => now(),
        ]);

        PointsLedger::create([
            'user_id' => $user->id,
            'product_id' => $this->product->id,
            'type' => 'spend',
            'points' => 100,
            'created_at' => now(),
        ]);

        // 3rd redemption should fail
        $response = $this->postJson('/api/redemptions', [
            'user_id' => $user->id,
            'product_id' => $this->product->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['category']);
    }
}
