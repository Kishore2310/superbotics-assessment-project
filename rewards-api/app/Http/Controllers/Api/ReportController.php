<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PointsLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date', $request->query('from'));
        $endDate = $request->query('end_date', $request->query('to'));
        $categoryId = $request->query('category_id');

        $query = PointsLedger::query()
            ->with(['user:id,name,email', 'product:id,name,category_id', 'product.category:id,name'])
            ->where('type', 'spend');

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        if ($categoryId) {
            $query->whereHas('product', function ($q) use ($categoryId) {
                $q->where('category_id', $categoryId);
            });
        }

        $redemptions = (clone $query)
            ->latest('id')
            ->limit(100)
            ->get();

        // One SQL query with bindings for totals (count and total points)
        $totalsQuery = DB::table('points_ledger')
            ->where('points_ledger.type', 'spend');

        $bindings = [];

        if ($categoryId) {
            $totalsQuery->join('products', 'points_ledger.product_id', '=', 'products.id')
                ->where('products.category_id', '=', $categoryId);
        }

        if ($startDate) {
            $totalsQuery->whereDate('points_ledger.created_at', '>=', $startDate);
        }

        if ($endDate) {
            $totalsQuery->whereDate('points_ledger.created_at', '<=', $endDate);
        }

        $totals = $totalsQuery->selectRaw('COUNT(*) as total_count, COALESCE(SUM(points_ledger.points), 0) as total_points')->first();

        return response()->json([
            'total_count' => (int) ($totals->total_count ?? 0),
            'total_points' => (int) ($totals->total_points ?? 0),
            'data' => $redemptions,
        ]);
    }
}
