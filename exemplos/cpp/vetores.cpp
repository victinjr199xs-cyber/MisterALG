#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v = {4, 8, 15, 16, 23};
    int soma = 0;

    // Sum all elements with a loop
    for (size_t i = 0; i < v.size(); i++) {
        soma += v[i];
    }

    cout << "Sum: " << soma << endl;
    cout << "Average: " << static_cast<double>(soma) / v.size() << endl;
    return 0;
}
