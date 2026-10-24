const v: number[] = [4, 8, 15, 16, 23];
let soma: number = 0;

// Sum all elements with a loop
for (let i = 0; i < v.length; i++) {
  soma += v[i];
}

console.log("Sum: " + soma);
console.log("Average: " + (soma / v.length).toFixed(2));
