#include <iostream>
using namespace std;

int main() {
    int grade;

    cout << "Enter your grade (0-10): ";
    if (!(cin >> grade)) {
        cout << "Invalid input" << endl;
        return 1;
    }

    if (grade >= 6) {
        cout << "Approved" << endl;
    } else {
        cout << "Failed" << endl;
    }
    return 0;
}
