
<?php

class PointsCalculator
{
    private array $entries;

    public function __construct(array $entries)
    {
        $this->entries = $entries;
    }

    public function balance(): int
    {
        $balance = 0;

        foreach ($this->entries as $entry) {
            if ($entry['type'] === 'earn') {
                $balance += $entry['points'];
            } elseif ($entry['type'] === 'spend') {
                $balance -= $entry['points'];
            }
        }

        return $balance;
    }

    public function expiredPoints(string $today): int
    {
        $entries = $this->entries;

        usort($entries, fn($a, $b) =>
            strtotime($a['date']) <=> strtotime($b['date'])
        );

        $earned = [];
        $spent = 0;

        foreach ($entries as $entry) {
            if ($entry['type'] === 'earn') {
                $earned[] = [
                    'points' => $entry['points'],
                    'date' => $entry['date']
                ];
            } elseif ($entry['type'] === 'spend') {
                $spent += $entry['points'];
            }
        }

        // Consume oldest earned points first
        foreach ($earned as &$item) {
            $used = min($item['points'], $spent);
            $item['points'] -= $used;
            $spent -= $used;
        }
        unset($item);

        $expired = 0;
        $expiryDate = new DateTime($today);

        foreach ($earned as $item) {
            $earnedDate = new DateTime($item['date']);
            $expiry = (clone $earnedDate)->modify('+12 months');

            if ($expiry <= $expiryDate) {
                $expired += $item['points'];
            }
        }

        return $expired;
    }
}

$entries = [
    ['type' => 'earn', 'points' => 100, 'date' => '2025-01-10'],
    ['type' => 'earn', 'points' => 200, 'date' => '2025-06-10'],
    ['type' => 'spend', 'points' => 50, 'date' => '2025-07-10'],
    ['type' => 'earn', 'points' => 150, 'date' => '2026-01-10'],
    ['type' => 'spend', 'points' => 100, 'date' => '2026-02-10'],
];

$calculator = new PointsCalculator($entries);

echo "Balance: " . $calculator->balance() . PHP_EOL;
echo "Expired: " . $calculator->expiredPoints('2026-11-23') . PHP_EOL;

