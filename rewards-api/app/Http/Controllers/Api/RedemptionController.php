<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRedemptionRequest;
use App\Services\RedemptionService;
use Illuminate\Http\JsonResponse;

class RedemptionController extends Controller
{
    public function __construct(
        private RedemptionService $redemptionService
    ) {}

    public function store(StoreRedemptionRequest $request): JsonResponse
    {
        $result = $this->redemptionService->redeem(
            $request->integer('user_id'),
            $request->integer('product_id')
        );

        return response()->json($result, 201);
    }
}
