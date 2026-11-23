# Part A – Core PHP Assessment

This folder contains the solutions for Part A of the Practical Assessment.

---

## A1 – Fix Legacy PHP Code

### Objective
Fix the existing PHP 7.4 code so that it works with PHP 8.2 and addresses its security vulnerabilities.

### Issues Identified and Fixes

1. **Dynamic Property Creation**
   - The original code dynamically created the `$total` property.
   - PHP 8.2 deprecates dynamic property creation.
   - Declared `$total` explicitly inside the `Report` class.

2. **SQL Injection**
   - The original query directly inserted user input into SQL.
   - Replaced it with a prepared statement using `bind_param()`.

3. **Input Validation**
   - Added validation for the `cat` GET parameter.
   - Rejects missing or empty category values.

4. **Database Connection Handling**
   - Added connection error handling to avoid continuing with an invalid connection.

5. **Null Value Handling**
   - Used the null coalescing operator (`??`) to handle nullable notes safely.

6. **Deprecated Function**
   - Replaced deprecated `create_function()` with an anonymous function.

### Database Setup

Create a MySQL database named `shop`.

```sql
CREATE DATABASE shop;

USE shop;

CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    note TEXT NULL
);
```

### Sample Data

```sql
INSERT INTO orders (category, amount, note)
VALUES
('Electronics', 1500, 'Laptop order'),
('Electronics', 2500, 'Mobile order'),
('Clothing', 500, 'Shirt order'),
('Electronics', 1000, 'Keyboard order');
```

### Execution

Run the PHP file using a local PHP server or configure it under your web server document root.

Example URL:

`http://localhost/A1.php?cat=Electronics`

### Expected Output

```text
12
11
13
Total: 5000
```

---

## A2 – PointsCalculator Class

### Objective

Implement a plain PHP 8.2 class that calculates reward points based on ledger entries.

### Requirements

- Accept an array of ledger entries.
- Support `earn` and `spend` transaction types.
- Calculate the current points balance.
- Calculate expired points.
- Apply FIFO (First In, First Out) when consuming earned points.
- Treat earned points as expired after 12 months if they remain unspent.

### Implementation

File: `A2.php`

The `PointsCalculator` class provides two methods:

**1. balance(): int**
- Calculates the current balance.
- Adds earned points.
- Subtracts spent points.

**2. expiredPoints(string $today): int**
- Sorts earned entries by date.
- Applies spending against the oldest earned points first.
- Calculates the remaining points that are older than 12 months.

### Sample Input

```php
$entries = [
    ['type' => 'earn', 'points' => 100, 'date' => '2025-01-10'],
    ['type' => 'earn', 'points' => 200, 'date' => '2025-06-10'],
    ['type' => 'spend', 'points' => 50, 'date' => '2025-07-10'],
    ['type' => 'earn', 'points' => 150, 'date' => '2026-01-10'],
    ['type' => 'spend', 'points' => 100, 'date' => '2026-02-10'],
];
```

### Execution

```bash
php A2.php
```

### Expected Output

```text
Balance: 300
Expired: 150
```

### FIFO Explanation

The oldest earned points are consumed first.

- First earning: 100 points.
- Second earning: 200 points.
- Total spending: 150 points.
- FIFO consumes the first 100 points and another 50 points from the second earning.
- Remaining points from the second earning: 150.
- These 150 points have passed the 12-month expiry period as of November 23, 2026.

Therefore:

- Current balance: 300 points.
- Expired points: 150 points.

---

## Technologies Used

- PHP 8.2
- MySQL
- Object-Oriented PHP
- Prepared Statements
- Anonymous Functions
- PHP DateTime
- FIFO Point Allocation

## Learning Outcomes

- Understood PHP 8.2 compatibility changes.
- Improved SQL query security using prepared statements.
- Practiced PHP OOP and type hints.
- Implemented FIFO point allocation.
- Worked with date-based point expiration logic.

---

**Note:** A1 and A2 are implemented using plain PHP without a framework, as required by the assessment.