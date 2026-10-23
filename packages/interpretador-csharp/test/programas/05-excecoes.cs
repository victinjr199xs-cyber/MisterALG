using System;
using System.Collections.Generic;

class MeuErro : Exception
{
    public int Codigo;
    public MeuErro(string msg, int codigo) : base(msg) { Codigo = codigo; }
}

class Recurso : IDisposable
{
    string nome;
    public Recurso(string n) { nome = n; Console.WriteLine("abre " + n); }
    public void Dispose() { Console.WriteLine("fecha " + nome); }
}

class P
{
    static int Dividir(int a, int b) { return a / b; }

    static string Teste(int n)
    {
        try
        {
            Console.WriteLine("try " + n);
            if (n == 1) throw new InvalidOperationException("op inválida");
            if (n == 2) throw new MeuErro("meu erro", 42);
            if (n == 3) return "retornou";
            if (n == 4) { int[] a = new int[1]; a[n] = 0; }
            return "normal";
        }
        catch (InvalidOperationException e)
        {
            Console.WriteLine("catch IOE: " + e.Message);
            return "tratou IOE";
        }
        catch (MeuErro e)
        {
            Console.WriteLine("catch MeuErro: " + e.Message + " " + e.Codigo);
            return "tratou MeuErro";
        }
        catch (Exception e)
        {
            Console.WriteLine("catch Exception: " + e.GetType().Name);
            return "tratou Exception";
        }
        finally
        {
            Console.WriteLine("finally " + n);
        }
    }

    static void Aninhado()
    {
        try
        {
            try
            {
                throw new Exception("interna");
            }
            finally
            {
                Console.WriteLine("finally interno");
            }
        }
        catch (Exception e)
        {
            Console.WriteLine("externo pegou: " + e.Message);
            try { throw new ApplicationException("nova", e); }
            catch (ApplicationException ae) { Console.WriteLine(ae.Message + " <- " + ae.InnerException.Message); }
        }
    }

    static void Relancar()
    {
        try
        {
            try { Dividir(1, 0); }
            catch (DivideByZeroException) { Console.WriteLine("log e relança"); throw; }
        }
        catch (Exception e) { Console.WriteLine("pegou " + e.GetType().Name); }
    }

    static void Main()
    {
        for (int i = 0; i <= 5; i++) Console.WriteLine("=> " + Teste(i));
        Aninhado();
        Relancar();
        using (Recurso r1 = new Recurso("A"))
        using (Recurso r2 = new Recurso("B"))
        {
            Console.WriteLine("usando");
        }
        try
        {
            using (Recurso r = new Recurso("C")) { throw new Exception("dentro do using"); }
        }
        catch (Exception e) { Console.WriteLine(e.Message); }
        try { Convert.ToInt32("abc"); }
        catch (FormatException) { Console.WriteLine("formato inválido"); }
        try { object o = "texto"; int n = (int)o; }
        catch (InvalidCastException) { Console.WriteLine("cast inválido"); }
        try { string s = null; Console.WriteLine(s.Length); }
        catch (NullReferenceException) { Console.WriteLine("null reference"); }
        try { checked { int x = int.MaxValue; x++; } }
        catch (OverflowException) { Console.WriteLine("overflow"); }
        try { throw new ArgumentNullException("param"); }
        catch (ArgumentException e) { Console.WriteLine(e.GetType().Name + " " + e.ParamName); }
        try { Convert.ToInt32(null); Console.WriteLine("ok"); }
        catch (Exception) { Console.WriteLine("não deveria"); }
        int ok;
        Console.WriteLine(int.TryParse("123", out ok) + " " + ok);
        Console.WriteLine(int.TryParse("12x", out ok) + " " + ok);
        double dd; Console.WriteLine(double.TryParse("3,5", out dd) + " " + dd);
    }
}
