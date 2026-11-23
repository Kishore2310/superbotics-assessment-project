<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CategoryLimit extends Model
{
       protected $fillable = [
        'category_id',
        'monthly_limit',
    ];

    protected function casts(): array
    {
        return [
            'monthly_limit' => 'integer',
        ];
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
