#include <stdio.h>

/* Recursive factorial: n! = n * (n-1)! */
long long factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main(void) {
    int n = 5;
    printf("%d! = %lld\n", n, factorial(n));
    return 0;
}
