using System;
using System.Collections.Generic;
using System.Linq;

delegate int Operacao(int a, int b);
delegate void Notificar(string msg);

class Sensor
{
    public event Notificar Alerta;
    public event EventHandler Mudou;
    int temp;
    public int Temp
    {
        get { return temp; }
        set
        {
            temp = value;
            if (Mudou != null) Mudou(this, EventArgs.Empty);
            if (value > 100 && Alerta != null) Alerta("quente: " + value);
        }
    }
}

class P
{
    static int Soma(int a, int b) { return a + b; }
    static int Mult(int a, int b) { return a * b; }
    static void Logar(string s) { Console.WriteLine("LOG " + s); }
    static void Outro(string s) { Console.WriteLine("OUTRO " + s); }

    static Func<int, int> CriaSomador(int n) { return x => x + n; }

    static IEnumerable<int> Pares(int ate)
    {
        for (int i = 0; i <= ate; i += 2) yield return i;
    }

    static IEnumerable<string> Palavras()
    {
        yield return "um";
        yield return "dois";
        Console.WriteLine("(entre os yields)");
        yield return "tres";
    }

    static void Main()
    {
        Operacao op = Soma;
        Console.WriteLine(op(3, 4));
        op = Mult;
        Console.WriteLine(op(3, 4));
        op = delegate(int a, int b) { return a - b; };
        Console.WriteLine(op(3, 4));
        op = (a, b) => a % b;
        Console.WriteLine(op(17, 5));
        Operacao[] ops = { Soma, Mult, (a, b) => a - b };
        foreach (Operacao o in ops) Console.Write(o(6, 3) + " ");
        Console.WriteLine();

        Notificar n = Logar;
        n += Outro;
        n("a");
        n -= Logar;
        n("b");

        Sensor s = new Sensor();
        s.Alerta += Logar;
        s.Mudou += (o, e) => Console.WriteLine("mudou");
        s.Temp = 50;
        s.Temp = 120;

        Func<int, int, int> f = (a, b) => a * b + 1;
        Action<string> act = x => Console.WriteLine("act " + x);
        Predicate<int> par = x => x % 2 == 0;
        Func<int> sem = () => 99;
        Console.WriteLine(f(3, 4) + " " + par(4) + " " + par(5) + " " + sem());
        act("ok");

        Func<int, int> mais5 = CriaSomador(5);
        Func<int, int> mais10 = CriaSomador(10);
        Console.WriteLine(mais5(1) + " " + mais10(1));

        int contador = 0;
        Action inc = () => { contador++; };
        for (int i = 0; i < 5; i++) inc();
        Console.WriteLine(contador);

        List<Action> acoes = new List<Action>();
        for (int i = 0; i < 3; i++) { int copia = i; acoes.Add(() => Console.Write(copia + " ")); }
        foreach (Action a in acoes) a();
        Console.WriteLine();

        Console.WriteLine(string.Join(",", Pares(10)));
        foreach (string p in Palavras()) Console.WriteLine(p);
        IEnumerable<int> quad = Enumerable.Range(1, 5).Select(x => x * x);
        Console.WriteLine(string.Join(" ", quad));
        Func<int, Func<int, int>> curry = a => b => a * b;
        Console.WriteLine(curry(6)(7));
        Func<int, int> fat = null;
        fat = x => x <= 1 ? 1 : x * fat(x - 1);
        Console.WriteLine(fat(6));
        List<int> nums = new List<int> { 1, 2, 3, 4, 5, 6 };
        nums.ForEach(x => Console.Write(x * 2 + ";"));
        Console.WriteLine();
        Console.WriteLine(nums.FindAll(par).Count + " " + nums.TrueForAll(x => x > 0) + " " + nums.RemoveAll(par));
        Console.WriteLine(string.Join(",", nums));
        Comparison<string> porTam = (a, b) => a.Length - b.Length;
        List<string> ps = new List<string> { "ccc", "a", "bb" };
        ps.Sort(porTam);
        Console.WriteLine(string.Join(",", ps));
    }
}
