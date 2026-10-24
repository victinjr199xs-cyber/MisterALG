<?php
$v = [4, 8, 15, 16, 23];
$soma = 0;

// Sum all elements with a loop
for ($i = 0; $i < count($v); $i++) {
    $soma += $v[$i];
}

echo "Sum: $soma\n";
printf("Average: %.2f\n", $soma / count($v));
