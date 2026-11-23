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

## 5. Part C – Offline Scenario (Handling Store Redemptions During Internet Outage)

If a partner store loses internet for two hours while customers are standing at the counter trying to redeem items, we have to make a conscious trade-off between customer convenience and fraud prevention. Here is how I would design the offline storage and synchronization:

### 1. Local Storage on the POS Terminal
- The store counter's POS app (or tablet) should log every offline redemption to a local storage queue on the device.
- For each transaction, the terminal generates a client-side UUID (acting as an idempotency key) along with: `pos_device_id`, `user_id` (phone number or scanned member QR/barcode), `product_id`, `points_debited`, `offline_timestamp`, and an incrementing local receipt sequence number.
- To prevent abuse during the outage, the POS should enforce a sensible offline safety limit: for example, allowing only 1 offline redemption per customer or capping offline redemptions to products below a certain point value (e.g., maximum 500 points).

### 2. Synchronization Once Back Online
- As soon as the network reconnects, the POS app triggers a background sync worker that sends the queued transactions in batches to a dedicated endpoint: `POST /api/sync/offline-redemptions`.
- The server processes the queue in strict chronological order based on the recorded timestamps.
- Each redemption is executed inside a `DB::transaction()` with `User::lockForUpdate()`.
- The server checks the `idempotency_key`. If the request was retried or duplicated due to a flaky connection during sync, the server simply returns the already-processed result without deducting points twice.

### 3. What Could Go Wrong?
- **Concurrent Online Double-Spending (The Overdraft Problem)**:
  This is the biggest real-world risk. A customer could redeem an item at the offline counter, walk out, and immediately open the mobile app on their phone (which has internet) to redeem another item using the same points. By the time the store syncs 2 hours later, the user's online balance is already gone.
  *How to handle*: Since the customer already walked away with physical goods from the store counter, we cannot roll back reality. The server should still record the spend in `points_ledger`, allowing the user's balance to go negative (overdraft). Any points the user earns in the future will automatically go towards clearing this negative balance before they can redeem again.
- **Clock Drift or Tampering on the Store PC**:
  If the store's computer clock is wrong or deliberately set back, monthly category limits could be bypassed. We can mitigate this by checking the local sequence number and cross-referencing server-side sync time, flagging suspicious timestamp gaps for manual review.
- **Blocked or Restricted Users**:
  A user who was banned or restricted right after the internet dropped might successfully redeem at the counter. The terminal should keep a small local cache of known restricted accounts, though taking a small risk on low-value items is usually acceptable compared to blocking all honest customers during an outage.

---

## 6. Part D – Product Thinking (3 Practical Changes)

If I were the product owner for this rewards platform, here are three things I would change based on how users actually interact with loyalty points:

1. **Split Payments (Points + Cash Co-Pay)**:
   Right now, redemption is strictly binary: either you have enough points or you can't redeem at all. In reality, customers frequently abandon loyalty programs when they are just 50 or 100 points short of a reward they want. Allowing them to cover the difference with cash (e.g., "Redeem for 800 pts + ₹200") solves this frustration, moves inventory faster for partner stores, and reduces outstanding point liabilities on the company's balance sheet.

2. **WhatsApp / SMS Instant Alerts & Expiry Reminders**:
   Points feel abstract to most users until they get an instant notification on their phone saying *"You just spent 400 pts on Wireless Earbuds! Remaining balance: 1,200 pts"*. This gives immediate confirmation and also acts as a security heads-up if someone else used their phone number at a counter. In addition, sending an automated WhatsApp nudge 14 days before points expire with 2 or 3 items they can currently afford would significantly boost engagement and re-activate dormant users.

3. **Dynamic Point Multipliers on Slow-Moving Categories**:
   Instead of static points across every product, partner stores should have the flexibility to offer 2x or 3x points on slower categories (like accessories or home goods) or during off-peak weekday hours. This turns the rewards program from a passive expense into an active marketing tool that store owners can use to drive foot traffic when business is slow.

---

## 7. AI Log

### Prompts Used:
1. *"Show me how to structure a FIFO point deduction and expiry calculation in plain PHP 8.2 using DateTime objects."*
2. *"What is the best way in Laravel 11 to prevent double spending when two requests hit the redemption endpoint at the exact same millisecond?"*
3. *"Write a clean Tailwind CSS layout for a rewards redemption dashboard with user selection, balance card, product grid, and error alerts."*

### What AI Got Wrong & How I Fixed It:
- **Missing Test Database Migrations**: The initial test snippet generated by AI didn't include the `RefreshDatabase` trait, causing the test runner to fail because tables like `profiles` had not been migrated before the tests executed. I added `use RefreshDatabase;` to ensure migrations run automatically before each test and seeded the required profiles in the `setUp()` method.
- **Date Range Query Bug**: The first suggestion for checking the monthly category limit only filtered by `whereMonth()`. That would incorrectly match transactions from the same month of previous years. I updated it to check both `whereYear()` and `whereMonth()` against the current date.

---

## 8. Learning Log

- **What I Learned Today**:
  - PHP 8.2's deprecation of dynamic properties (`$r->total` without class definition) and how strict typing helps catch silent runtime bugs early.
  - The practical differences between optimistic locking (version columns) and pessimistic locking (`lockForUpdate` within transactions) in financial and points ledgers.
  - Setting up a quick React + Vite single-page frontend directly inside a Laravel 11 project without needing full Inertia scaffolding.
- **What Was Hardest**:
  - Building the FIFO expiration algorithm in Part A2. It took a few tries to get the logic right where spent points are deducted from the earliest earned batches first before checking which remaining earned points passed the 12-month cutoff.
  - Making sure the database transaction lock in Part B specifically targets the individual user row so other users can still redeem at the exact same time without unnecessary queuing or deadlocks.
