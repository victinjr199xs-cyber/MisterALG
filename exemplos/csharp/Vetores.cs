using System;

class Program
{
    static void Main()
    {
        int[] v = { 4, 8, 15, 16, 23 };
        int sum = 0;

        // Sum all elements with a loop
        for (int i = 0; i < v.Length; i++)
        {
            sum += v[i];
        }

        Console.WriteLine($"Sum: {sum}");
        Console.WriteLine($"Average: {(double)sum / v.Length:F2}");
    }
}
