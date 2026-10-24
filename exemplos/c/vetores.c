#include <stdio.h>

int main(void) {
    int v[5] = {4, 8, 15, 16, 23};
    int soma = 0;
    int i;

    /* Sum all elements with a loop */
    for (i = 0; i < 5; i++) {
        soma += v[i];
    }

    printf("Sum: %d\n", soma);
    printf("Average: %.2f\n", (double)soma / 5);
    return 0;
}
