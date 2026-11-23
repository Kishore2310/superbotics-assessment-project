<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('points_ledger', function (Blueprint $table) {
        $table->id();

        $table->foreignId('user_id')
            ->constrained()
            ->cascadeOnDelete();

        $table->foreignId('product_id')
            ->nullable()
            ->constrained()
            ->nullOnDelete();

        $table->enum('type', ['earn', 'spend']);

        $table->unsignedInteger('points');

        $table->timestamps();

        // Balance lookup
        $table->index(['user_id', 'id']);

        // Date-filtered redemption report
        $table->index(['created_at', 'product_id']);
    });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('points_ledgers');
    }
};
