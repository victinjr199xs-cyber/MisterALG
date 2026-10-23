using System;
using System.Collections.Generic;
using System.Text;

class P
{
    static int Fib(int n) { return n < 2 ? n : Fib(n - 1) + Fib(n - 2); }
    static long FatL(int n) { return n <= 1 ? 1 : n * FatL(n - 1); }
    static int Mdc(int a, int b) { return b == 0 ? a : Mdc(b, a % b); }
    static bool Primo(int n)
    {
        if (n < 2) return false;
        for (int i = 2; i * i <= n; i++) if (n % i == 0) return false;
        return true;
    }
    static void Hanoi(int n, char o, char d, char a, List<string> mov)
    {
        if (n == 0) return;
        Hanoi(n - 1, o, a, d, mov);
        mov.Add(o + ">" + d);
        Hanoi(n - 1, a, d, o, mov);
    }
    static void Bolha(int[] v)
    {
        for (int i = 0; i < v.Length - 1; i++)
            for (int j = 0; j < v.Length - 1 - i; j++)
                if (v[j] > v[j + 1]) { int t = v[j]; v[j] = v[j + 1]; v[j + 1] = t; }
    }
    static void Quick(int[] v, int lo, int hi)
    {
        if (lo >= hi) return;
        int p = v[(lo + hi) / 2], i = lo, j = hi;
        while (i <= j)
        {
            while (v[i] < p) i++;
            while (v[j] > p) j--;
            if (i <= j) { int t = v[i]; v[i] = v[j]; v[j] = t; i++; j--; }
        }
        Quick(v, lo, j);
        Quick(v, i, hi);
    }
    static int BuscaBin(int[] v, int x)
    {
        int lo = 0, hi = v.Length - 1;
        while (lo <= hi)
        {
            int m = (lo + hi) / 2;
            if (v[m] == x) return m;
            if (v[m] < x) lo = m + 1; else hi = m - 1;
        }
        return -1;
    }
    static void Perm(string pre, string resto, List<string> saida)
    {
        if (resto.Length == 0) { saida.Add(pre); return; }
        for (int i = 0; i < resto.Length; i++) Perm(pre + resto[i], resto.Substring(0, i) + resto.Substring(i + 1), saida);
    }
    static bool Palindromo(string s)
    {
        string t = "";
        foreach (char c in s) if (char.IsLetterOrDigit(c)) t += char.ToLower(c);
        for (int i = 0; i < t.Length / 2; i++) if (t[i] != t[t.Length - 1 - i]) return false;
        return true;
    }
    static string Binario(int n)
    {
        if (n == 0) return "0";
        StringBuilder sb = new StringBuilder();
        while (n > 0) { sb.Insert(0, n % 2); n /= 2; }
        return sb.ToString();
    }

    static void Main()
    {
        for (int i = 0; i <= 15; i++) Console.Write(Fib(i) + " ");
        Console.WriteLine();
        Console.WriteLine(FatL(15) + " " + FatL(20));
        Console.WriteLine(Mdc(48, 18) + " " + Mdc(17, 5));
        List<int> primos = new List<int>();
        for (int i = 0; i < 60; i++) if (Primo(i)) primos.Add(i);
        Console.WriteLine(string.Join(",", primos));
        bool[] crivo = new bool[50];
        for (int i = 2; i < 50; i++) crivo[i] = true;
        for (int i = 2; i * i < 50; i++) if (crivo[i]) for (int j = i * i; j < 50; j += i) crivo[j] = false;
        int cont = 0;
        for (int i = 0; i < 50; i++) if (crivo[i]) cont++;
        Console.WriteLine(cont);
        List<string> mov = new List<string>();
        Hanoi(3, 'A', 'C', 'B', mov);
        Console.WriteLine(mov.Count + ": " + string.Join(" ", mov));
        int[] v = { 29, 4, 17, 8, 55, 1, 33, 8 };
        int[] w = (int[])v.Clone();
        Bolha(v);
        Quick(w, 0, w.Length - 1);
        Console.WriteLine(string.Join(",", v) + " | " + string.Join(",", w));
        Console.WriteLine(BuscaBin(v, 33) + " " + BuscaBin(v, 5));
        List<string> perms = new List<string>();
        Perm("", "abc", perms);
        Console.WriteLine(string.Join(",", perms));
        Console.WriteLine(Palindromo("Socorram-me, subi no onibus em Marrocos") + " " + Palindromo("abc"));
        Console.WriteLine(Binario(10) + " " + Binario(255) + " " + Convert.ToString(10, 2) + " " + Convert.ToInt32("1010", 2));
        int[,] a = { { 1, 2 }, { 3, 4 } };
        int[,] b = { { 5, 6 }, { 7, 8 } };
        int[,] c = new int[2, 2];
        for (int i = 0; i < 2; i++)
            for (int j = 0; j < 2; j++)
                for (int k = 0; k < 2; k++) c[i, j] += a[i, k] * b[k, j];
        Console.WriteLine(c[0, 0] + " " + c[0, 1] + " " + c[1, 0] + " " + c[1, 1]);
        int soma = 0;
        for (int i = 1; i <= 100; i++) { if (i % 3 == 0) continue; if (i > 50) break; soma += i; }
        Console.WriteLine(soma);
        int k2 = 0;
        while (true) { k2++; if (k2 * k2 > 200) break; }
        Console.WriteLine(k2);
        int d2 = 0;
        do { d2 += 7; } while (d2 < 30);
        Console.WriteLine(d2);
        for (int i = 1; i <= 4; i++)
        {
            string linha = "";
            for (int j = 1; j <= i; j++) linha += "*";
            Console.WriteLine(linha.PadLeft(4));
        }
        long acc = 1;
        for (int i = 0; i < 40; i++) acc = acc * 3 % 1000003;
        Console.WriteLine(acc);
        double x = 1;
        for (int i = 0; i < 10; i++) x = (x + 2 / x) / 2;
        Console.WriteLine(x.ToString("F10"));
        string texto = "a vida e bela e a vida e curta";
        Dictionary<string, int> freq = new Dictionary<string, int>();
        foreach (string pal in texto.Split(' ')) freq[pal] = freq.ContainsKey(pal) ? freq[pal] + 1 : 1;
        List<string> chaves = new List<string>(freq.Keys);
        chaves.Sort();
        foreach (string ch in chaves) Console.Write(ch + "=" + freq[ch] + " ");
        Console.WriteLine();
        int dia = 15, mes = 3, ano = 2024;
        Console.WriteLine(string.Format("{0:00}/{1:00}/{2}", dia, mes, ano));
        Console.WriteLine(DateTime.IsLeapYear(2024) + " " + DateTime.DaysInMonth(2024, 2) + " " + (new DateTime(2024, 3, 15)).DayOfWeek);
    }
}
