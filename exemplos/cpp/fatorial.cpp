#include <iostream>
using namespace std;

// Recursive factorial: n! = n * (n-1)!
unsigned long long factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main() {
    int n = 5;
    cout << n << "! = " << factorial(n) << endl;
    return 0;
}
