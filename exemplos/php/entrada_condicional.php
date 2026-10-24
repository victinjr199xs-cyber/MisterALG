<?php
// A PHP page has no keyboard input: the grade comes from the URL (?grade=7).
// Without it, the example uses 7.
$entrada = $_GET['grade'] ?? '7';
echo "Grade (0-10): $entrada\n";

if (!is_numeric($entrada)) {
    echo "Invalid input\n";
    exit(1);
}

$grade = (float) $entrada;

if ($grade >= 6) {
    echo "Approved\n";
} else {
    echo "Failed\n";
}
