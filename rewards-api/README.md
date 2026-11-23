# Rewards Redemption System & Core Assessment

**SuperBotics MultiTech · Practical Assessment (In Office)**  
*Full Stack Developer*

---

## Table of Contents
1. [Repository Structure](#repository-structure)
2. [How to Run](#how-to-run)
   - [Part A (Core PHP)](#part-a-core-php)
   - [Part B (Laravel API & React Page)](#part-b-laravel-api--react-page)
   - [Running Feature Tests](#running-feature-tests)
3. [Approach to Double-Spending & Concurrency](#approach-to-double-spending--concurrency)
4. [Report SQL Query & Indexing Strategy](#report-sql-query--indexing-strategy)
5. [Part C – Offline Scenario Solution](#part-c--offline-scenario-solution)
6. [Part D – Product Thinking](#part-d--product-thinking)
7. [AI Log](#ai-log)
8. [Learning Log](#learning-log)

---

## 1. Repository Structure

```
├── part-a/
│   ├── A1.php             # PHP 8.2 fix for legacy script (prepared statements, explicit properties)
│   ├── A2.php             # PointsCalculator class with FIFO expiration algorithm
│   └── README.md          # Detailed Part A documentation
├── rewards-api/           # Laravel 11 Rewards Redemption API
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── BalanceController.php      # GET /api/users/{id}/balance
│   │   │   ├── RedemptionController.php   # POST /api/redemptions
│   │   │   └── ReportController.php       # GET /api/reports/redemptions
│   │   ├── Http/Requests/
│   │   │   └── StoreRedemptionRequest.php # Form Request input validation
│   │   ├── Models/
│   │   │   ├── Category.php
│   │   │   ├── CategoryLimit.php
│   │   │   ├── PointsLedger.php
│   │   │   ├── Product.php
│   │   │   ├── Profile.php
│   │   │   └── User.php
│   │   └── Services/
│   │       └── RedemptionService.php      # Business logic & row locking
│   ├── database/
│   │   ├── migrations/                    # Schema with custom indexes
│   │   └── seeders/                       # 5 categories, 20 products, 1,000 users, 10,000 redemptions
│   ├── resources/
│   │   ├── js/
│   │   │   └── app.jsx                    # React page (Balance, Redemption, Error display, Report & CSV)
│   │   └── views/
│   │       └── welcome.blade.php          # SPA mount
│   ├── tests/Feature/
│   │   └── RedemptionTest.php             # 4 required feature tests
│   └── vite.config.js                     # Vite + React plugin configuration
└── README.md
```

---

## 2. How to Run

### Requirements
- **PHP 8.2 or 8.3**
- **Composer 2.x**
- **Node.js (v18+) & npm**
- **MySQL (or PostgreSQL)**

---

### Part A (Core PHP)

Execute standalone PHP scripts in terminal:

```bash
# Run A1 (Legacy PHP fix)
php part-a/A1.php

# Run A2 (PointsCalculator class with FIFO)
php part-a/A2.php
```

---

### Part B (Laravel API & React Page)

1. **Navigate to the Laravel application directory:**
   ```bash
   cd rewards-api
   ```

2. **Install PHP dependencies:**
   ```bash
   composer install
   ```

3. **Configure Environment:**
   Create `.env` (or verify existing `.env`):
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=superbotics_rewards
   DB_USERNAME=root
   DB_PASSWORD=
   ```

4. **Run Migrations & Database Seeders:**
   Creates tables and seeds 5 categories, 20 products, 1,000 users with points, and 10,000+ past redemptions:
   ```bash
   php artisan migrate:fresh --seed
   ```

5. **Install Frontend Dependencies & Build Assets:**
   ```bash
   npm install
   npm run build
   ```
   *(For hot reloading during development, run `npm run dev`)*

6. **Start the Laravel Server:**
   ```bash
   php artisan serve
   ```

7. **Access the Application:**
   Open your browser and visit:  
   👉 **`http://localhost:8000`**

   **React Features on the page:**
   - **User Selection & Balance Display**: Switch between users, view active/restricted profile badges, and see real-time balance fetched via `GET /api/users/{id}/balance`.
   - **Product Redemption**: Select any active product from the catalog and redeem points via `POST /api/redemptions`.
   - **Error Handling**: Distinct banner notifications for rejections (Insufficient points, Restricted user, Monthly category limit reached).
   - **Quick Presets**: 1-click test buttons to instantly demonstrate each scenario to reviewers.
   - **Reports Tab**: Interactive table showing redemptions with date and category filters, total count, total points, and instant **Export to CSV**.

---

### Running Feature Tests

Run the complete automated test suite covering all mandatory requirements:

```bash
cd rewards-api
php artisan test
```

**Feature tests included in `tests/Feature/RedemptionTest.php`:**
1. `test_successful_redemption` – verifies successful debit, ledger row creation, and updated balance.
2. `test_redemption_fails_when_not_enough_points` – verifies 422 rejection when points balance is lower than product cost.
3. `test_redemption_fails_for_restricted_user` – verifies 422 rejection for accounts with `restricted` profile.
4. `test_redemption_fails_when_category_limit_exceeded` – verifies 422 rejection when exceeding the category's monthly redemption quota.

---

## 3. Approach to Double-Spending & Concurrency

### The Problem
If a user with 500 points sends two simultaneous redemption requests for a 400-point item, a naive read-check-write implementation causes a race condition:
1. Thread A checks balance: 500 pts ≥ 400 pts (Passes).
2. Thread B checks balance: 500 pts ≥ 400 pts (Passes).
3. Thread A inserts spend ledger: -400 pts.
4. Thread B inserts spend ledger: -400 pts.
5. User spent 800 points with only 500 in their balance (Overdraft / Double-spending).

### Our Solution
We implement **Pessimistic Row Locking (`lockForUpdate`)** wrapped inside an ACID **Database Transaction**:

```php
// app/Services/RedemptionService.php
return DB::transaction(function () use ($userId, $productId) {
    // 1. Lock user row exclusively to serialize concurrent requests for this user
    $user = User::whereKey($userId)->lockForUpdate()->firstOrFail();

    // 2. Validate profile restriction
    if ($user->profile->name === 'restricted') {
        throw ValidationException::withMessages(['user' => ['Restricted users cannot redeem products.']]);
    }

    // 3. Check category monthly limit
    ...

    // 4. Calculate accurate balance directly inside the locked transaction
    $balance = PointsLedger::where('user_id', $userId)
        ->selectRaw("COALESCE(SUM(CASE WHEN type = 'earn' THEN points WHEN type = 'spend' THEN -points ELSE 0 END), 0) as balance")
        ->value('balance');

    if ($balance < $product->points) {
        throw ValidationException::withMessages(['points' => ['Insufficient reward points.']]);
    }

    // 5. Create spend entry
    PointsLedger::create([
        'user_id' => $userId,
        'product_id' => $product->id,
        'type' => 'spend',
        'points' => $product->points,
    ]);

    return [ ... ];
});
```

### Why This Works
- When Request A enters `DB::transaction`, MySQL places an exclusive row-level lock on `users` (`WHERE id = ? FOR UPDATE`).
- Request B arrives simultaneously for the same user and is blocked at the database engine level until Request A commits or rolls back.
- Request B then executes, recalculates the points balance (which now reflects Request A's deduction), discovers insufficient points (100 < 400), and is rejected with a clean 422 error.
- Row-level locking on the specific user prevents locking the entire table, maintaining high throughput for all other users.

---

## 4. Report SQL Query & Indexing Strategy

### The Single SQL Query with Bindings
To calculate aggregated totals without looping in PHP, `ReportController` executes a single optimized query with parameterized bindings:

```sql
SELECT 
    COUNT(*) AS total_count, 
    COALESCE(SUM(points_ledger.points), 0) AS total_points
FROM points_ledger
JOIN products ON points_ledger.product_id = products.id
WHERE points_ledger.type = 'spend'
  AND products.category_id = ?
  AND points_ledger.created_at >= ?
  AND points_ledger.created_at <= ?;
```

### Database Index Added
In migration `create_points_ledgers_table.php`:
```php
$table->index(['created_at', 'product_id']);
$table->index(['user_id', 'id']);
```

### Explanation of the Index
- **`INDEX (created_at, product_id)`**:
  - The report query predominantly filters by a `created_at` date range. A composite index with `created_at` in the leading position allows the storage engine (InnoDB) to perform an index range scan rather than a full table scan over 10,000+ rows.
  - Having `product_id` as the second column in the index enables the database to execute the `JOIN products ON points_ledger.product_id = products.id` directly using index lookups without reading the base table rows until necessary (Index condition pushdown).
- **`INDEX (user_id, id)`**:
  - Accelerates user-specific balance aggregation and historical ledger lookups (`WHERE user_id = ?`).

---

## 5. Part C – Offline Scenario Solution

### Scenario Overview
A partner store's redemption counter loses internet connectivity for 2 hours while continuing to process redemptions offline.

### Proposed Architecture & Storage
1. **Local Persistent Storage on POS Terminal**:
   - Redemptions are stored in an encrypted local database (SQLite / IndexedDB on the POS client).
   - Each transaction record contains: `idempotency_key` (UUID v4), `user_id` / card identifier, `product_id`, `points_to_debit`, `offline_timestamp`, and a HMAC signature generated with a store device key.
2. **Offline Trust Boundaries & Spending Limits**:
   - Offline transactions can be capped (e.g. maximum 1 redemption or 500 points per customer while disconnected).
   - If the POS has a cached token or offline balance snapshot, it validates against the last known balance.

### Synchronization Protocol
1. **Reconnection & Ordered FIFO Replay**:
   - Once connectivity is restored, the POS terminal queues an asynchronous sync batch: `POST /api/sync/offline-redemptions`.
   - The server processes transactions chronologically by `offline_timestamp` inside database transactions.
2. **Idempotency Guard**:
   - The server stores processed `idempotency_key`s with unique constraints to guarantee that network hiccups during synchronization never duplicate transactions.

### What Could Go Wrong & Mitigation
| Risk | Potential Consequence | Mitigation Strategy |
|---|---|---|
| **Concurrent Online Spending** | The user redeems points at the offline store, and simultaneously redeems points on the mobile web app, causing an overdraft (negative balance). | 1. Implement an **Overdraft Recovery Model**: the account goes negative, and future earned points automatically satisfy the debt.<br>2. Require high-value items to be online-only.<br>3. Offline soft limits (max 1 transaction under \$20). |
| **Clock Manipulation** | POS terminal date is modified backwards to circumvent monthly category quotas. | Timestamp validated against a monotonic counter and server-side receipt sequence validation. |
| **Revoked / Restricted Accounts** | A blocked/fraudulent user visits an offline terminal and redeems rewards. | POS downloads an encrypted revocation blocklist during periodic online heartbeats. Reconciled during sync. |

---

## 6. Part D – Product Thinking

If I owned this rewards product, the 3 key changes I would make are:

1. **Tiered Loyalty & Gamified Progression (Bronze / Silver / Gold)**:
   - *Why*: Flat point values fail to incentivize high-value customers. Introducing tiers with point multipliers (e.g., 1.5x earn for Gold members) and tier-exclusive redemption catalogs increases customer lifetime value (LTV) and long-term brand loyalty.
2. **Hybrid Points + Cash Co-Pay**:
   - *Why*: Many customers abandon rewards programs because they lack just a few points for their desired reward. Allowing users to bridge the gap with cash (e.g., "Pay 800 pts + \$5") unlocks inventory, decreases balance sheet point liabilities, and generates direct revenue.
3. **Automated Expiry Warnings & Push Re-engagement**:
   - *Why*: Expiring points without proactive notice leads to customer frustration. Triggering automated WhatsApp/SMS/Email notifications 30 and 7 days before points expire with personalized product recommendations boosts redemption velocity and drives active customer re-engagement.

---

## 7. AI Log

### 1. Three Prompts Used
1. *"Write a PHP 8.2 compatible PointsCalculator class with type hints that implements FIFO point expiration older than 12 months."*
2. *"How should I implement row-level locking in Laravel 11 with Eloquent to prevent race conditions during points redemption without deadlocking?"*
3. *"Create an optimized React redemption UI with Tailwind CSS that displays real-time user balance, error states from Laravel FormRequests, and a CSV exportable report."*

### 2. One Thing AI Got Wrong
- **The Issue**: When generating the feature tests, AI initially omitted Laravel's `RefreshDatabase` trait, causing SQLite in-memory database tests to fail with `no such table: profiles`. Additionally, an initial query attempt for the monthly limit check used `whereMonth('created_at', now()->month)` without filtering the year, which would conflate transactions from previous years.
- **How I Checked It**:
  1. Ran `php artisan test` via terminal and inspected the stack trace.
  2. Identified missing schema migration execution in testing environments and added `use RefreshDatabase;`.
  3. Corrected the monthly query to `whereYear('created_at', now()->year)->whereMonth('created_at', now()->month)`.

---

## 8. Learning Log

- **What I Learned Today**:
  - Modern PHP 8.2 strict typing deprecations, specifically regarding dynamic property creation and deprecated legacy functions like `create_function()`.
  - How to balance strict transactional isolation (`lockForUpdate`) with high-concurrency performance in Laravel service classes.
  - Structuring clean full-stack Laravel 11 + React workflows using Vite.
- **What Was Hardest**:
  - Formulating the FIFO expiration algorithm in Part A2 to cleanly deduct spend entries from the oldest earn entries in chronological order before calculating expired points.
  - Ensuring zero double-spending under concurrent traffic while keeping API response times snappy and avoiding database deadlocks.
