// Recursive factorial: n! = n * (n-1)!
function factorial(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const n: number = 5;
console.log(n + "! = " + factorial(n));
