using System;

class Program
{
    static void Main()
    {
        Console.Write("Enter your grade (0-10): ");
        if (!double.TryParse(Console.ReadLine(), out double grade))
        {
            Console.WriteLine("Invalid input");
            return;
        }

        if (grade >= 6)
        {
            Console.WriteLine("Approved");
        }
        else
        {
            Console.WriteLine("Failed");
        }
    }
}
