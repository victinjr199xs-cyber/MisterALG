<?php
// Recursive factorial: n! = n * (n-1)!
function factorial(int $n): int {
    if ($n <= 1) {
        return 1;
    }
    return $n * factorial($n - 1);
}

$n = 5;
echo "$n! = " . factorial($n) . "\n";
