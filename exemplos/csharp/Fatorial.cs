using System;

class Program
{
    // Recursive factorial: n! = n * (n-1)!
    static long Factorial(int n)
    {
        if (n <= 1)
        {
            return 1;
        }
        return n * Factorial(n - 1);
    }

    static void Main()
    {
        int n = 5;
        Console.WriteLine($"{n}! = {Factorial(n)}");
    }
}
