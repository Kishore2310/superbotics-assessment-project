<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\PointsLedger;
use Illuminate\Http\JsonResponse;

class BalanceController extends Controller
{
    public function show(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $balance = PointsLedger::where('user_id', $id)
            ->selectRaw("
                COALESCE(SUM(
                    CASE
                        WHEN type = 'earn' THEN points
                        WHEN type = 'spend' THEN -points
                        ELSE 0
                    END
                ), 0) AS balance
            ")
            ->value('balance');

        return response()->json([
            'user_id' => $user->id,
            'name' => $user->name,
            'balance' => (int) $balance,
        ]);
    }
}
