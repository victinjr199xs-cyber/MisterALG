#include <stdio.h>

int main(void) {
    int grade;

    printf("Enter your grade (0-10): ");
    if (scanf("%d", &grade) != 1) {
        printf("Invalid input\n");
        return 1;
    }

    if (grade >= 6) {
        printf("Approved\n");
    } else {
        printf("Failed\n");
    }
    return 0;
}
