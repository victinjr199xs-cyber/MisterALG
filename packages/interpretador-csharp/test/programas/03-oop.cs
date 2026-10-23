using System;
using System.Collections.Generic;

interface IForma { double Area(); string Nome { get; } }
interface IDesenhavel { void Desenhar(); }

abstract class Forma : IForma
{
    private static int contador = 0;
    public readonly int Id;
    protected string cor;
    public Forma(string cor) { this.cor = cor; Id = ++contador; }
    public abstract double Area();
    public virtual string Nome { get { return "Forma"; } }
    public override string ToString() { return Nome + "#" + Id + "(" + cor + ") area=" + Area().ToString("F2"); }
    public static int Total { get { return contador; } }
}

class Circulo : Forma, IDesenhavel
{
    double r;
    public Circulo(double r, string cor) : base(cor) { this.r = r; }
    public Circulo(double r) : this(r, "preto") { }
    public override double Area() { return Math.PI * r * r; }
    public override string Nome { get { return "Circulo"; } }
    public void Desenhar() { Console.WriteLine("o"); }
}

class Retangulo : Forma
{
    public double L { get; set; }
    public double A { get; set; }
    public Retangulo(double l, double a) : base("azul") { L = l; A = a; }
    public override double Area() { return L * A; }
    public override string Nome { get { return "Retangulo"; } }
}

class Quadrado : Retangulo
{
    public Quadrado(double l) : base(l, l) { }
    public override string Nome { get { return "Quadrado"; } }
}

class Conta
{
    private decimal saldo;
    public string Titular { get; private set; }
    public decimal Saldo { get { return saldo; } }
    public Conta(string t, decimal inicial) { Titular = t; saldo = inicial; }
    public void Depositar(decimal v)
    {
        if (v <= 0) throw new ArgumentException("valor inválido");
        saldo += v;
    }
    public bool Sacar(decimal v)
    {
        if (v > saldo) return false;
        saldo -= v;
        return true;
    }
}

class Pilha
{
    int[] dados = new int[4];
    int n;
    public void Push(int x)
    {
        if (n == dados.Length) Array.Resize(ref dados, dados.Length * 2);
        dados[n++] = x;
    }
    public int Pop() { return dados[--n]; }
    public int Count { get { return n; } }
    public int this[int i] { get { return dados[i]; } set { dados[i] = value; } }
}

class P
{
    static void Main()
    {
        List<Forma> formas = new List<Forma>();
        formas.Add(new Circulo(1.5));
        formas.Add(new Retangulo(2, 3.5));
        formas.Add(new Quadrado(4));
        formas.Add(new Circulo(2, "vermelho"));
        foreach (Forma f in formas) Console.WriteLine(f);
        Console.WriteLine(Forma.Total);
        double soma = 0;
        foreach (IForma f in formas) soma += f.Area();
        Console.WriteLine(soma.ToString("F3"));
        Console.WriteLine(formas[2] is Retangulo);
        Console.WriteLine(formas[0] is Retangulo);
        Console.WriteLine(formas[0] is IDesenhavel);
        Retangulo r = formas[2] as Retangulo;
        Console.WriteLine(r.L + " " + r.A);
        Circulo c = formas[1] as Circulo;
        Console.WriteLine(c == null);
        IDesenhavel d = (IDesenhavel)formas[0];
        d.Desenhar();
        Console.WriteLine(formas[0].GetType().Name + " " + formas[2].GetType().BaseType.Name);
        Quadrado q = new Quadrado(2);
        Console.WriteLine(q.ToString());

        Conta conta = new Conta("Ana", 100.50m);
        conta.Depositar(49.50m);
        Console.WriteLine(conta.Titular + ": " + conta.Saldo);
        Console.WriteLine(conta.Sacar(500));
        Console.WriteLine(conta.Sacar(50.25m) + " " + conta.Saldo);
        try { conta.Depositar(-1); }
        catch (ArgumentException e) { Console.WriteLine("erro: " + e.Message); }

        Pilha p = new Pilha();
        for (int i = 1; i <= 6; i++) p.Push(i * i);
        p[0] = 100;
        Console.WriteLine(p.Count + " " + p[0] + " " + p.Pop() + " " + p.Pop() + " " + p.Count);
        object o = p;
        Console.WriteLine(o is Pilha);
        Console.WriteLine(o.ToString());
        object[] misto = new object[] { 1, "dois", 3.0, 'c', null, new Pilha() };
        foreach (object x in misto) Console.WriteLine(x == null ? "(null)" : x.GetType().Name);
    }
}
