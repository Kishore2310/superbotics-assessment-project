
<?php

class Report
{
    public float $total = 0;
}

$r = new Report();

$conn = new mysqli("localhost", "root", "", "shop");

if ($conn->connect_error) {
    die("Database connection failed");
}

$cat = filter_input(INPUT_GET, 'cat', FILTER_SANITIZE_SPECIAL_CHARS);

if ($cat === null || $cat === false || $cat === '') {
    die("Category is required");
}

$stmt = $conn->prepare(
    "SELECT amount, note FROM orders WHERE category = ?"
);

$stmt->bind_param("s", $cat);
$stmt->execute();

$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $r->total += (float) $row['amount'];
    
    echo strlen($row['note'] ?? '') . "<br>";
}

echo "Total: " . $r->total;

$sorted = function ($a, $b) {
    return $a <=> $b;
};

$stmt->close();
$conn->close();
