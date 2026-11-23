<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRedemptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'user_id.required' => 'User ID is required.',
            'user_id.exists' => 'User does not exist.',
            'product_id.required' => 'Product ID is required.',
            'product_id.exists' => 'Product does not exist.',
        ];
    }
}
