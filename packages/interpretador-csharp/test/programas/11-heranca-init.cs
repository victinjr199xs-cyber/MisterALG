using System;
using System.Collections.Generic;

class Base
{
    public static int contagem;
    public int id = Registra("campo Base");
    static Base() { Console.WriteLine("static ctor Base"); }
    public Base() { Console.WriteLine("ctor Base"); Inicializa(); }
    public Base(string s) : this() { Console.WriteLine("ctor Base(" + s + ")"); }
    protected static int Registra(string quem) { Console.WriteLine("init " + quem); return ++contagem; }
    protected virtual void Inicializa() { Console.WriteLine("Inicializa Base"); }
    public virtual string Quem() { return "Base"; }
    public string Fixo() { return "fixo de Base chamando " + Quem(); }
}

class Filho : Base
{
    public int extra = Registra("campo Filho");
    static Filho() { Console.WriteLine("static ctor Filho"); }
    public Filho() : base("do filho") { Console.WriteLine("ctor Filho"); }
    protected override void Inicializa() { Console.WriteLine("Inicializa Filho extra=" + extra); }
    public override string Quem() { return "Filho/" + base.Quem(); }
}

class Neto : Filho
{
    public override string Quem() { return "Neto/" + base.Quem(); }
}

class Contador
{
    static int total;
    int meu;
    public Contador() { meu = ++total; }
    public int Meu { get { return meu; } }
    public static int Total { get { return total; } }
    public static Contador Novo() { return new Contador(); }
}

abstract class Veiculo
{
    public string Placa { get; protected set; }
    public abstract int Rodas { get; }
    public Veiculo(string p) { Placa = p; }
    public virtual string Info() { return Placa + " tem " + Rodas + " rodas"; }
}
class Carro : Veiculo { public Carro(string p) : base(p) { } public override int Rodas { get { return 4; } } }
class Moto : Veiculo
{
    public Moto(string p) : base(p) { }
    public override int Rodas { get { return 2; } }
    public override string Info() { return "Moto " + base.Info(); }
}

interface IA { string Nome(); }
interface IB { string Nome(); }
class Dupla : IA, IB
{
    string IA.Nome() { return "A"; }
    string IB.Nome() { return "B"; }
    public string Nome() { return "pública"; }
}

class P
{
    static void Main()
    {
        Console.WriteLine("--- criando Filho");
        Filho f = new Filho();
        Console.WriteLine("--- criando Neto");
        Neto n = new Neto();
        Console.WriteLine(f.id + " " + f.extra + " " + n.id + " " + n.extra + " " + Base.contagem);
        Console.WriteLine(f.Quem() + " | " + n.Quem());
        Base b = n;
        Console.WriteLine(b.Quem() + " | " + b.Fixo());
        Console.WriteLine((b is Filho) + " " + (b is Neto) + " " + (f is Neto) + " " + (b as Filho != null));
        Contador c1 = new Contador(), c2 = Contador.Novo(), c3 = new Contador();
        Console.WriteLine(c1.Meu + " " + c2.Meu + " " + c3.Meu + " " + Contador.Total);
        Veiculo[] vs = { new Carro("ABC"), new Moto("XYZ") };
        foreach (Veiculo v in vs) Console.WriteLine(v.Info());
        Dupla d = new Dupla();
        IA ia = d; IB ib = d;
        Console.WriteLine(d.Nome() + ia.Nome() + ib.Nome());
        object o = f;
        Console.WriteLine(o.GetType().Name + " " + ((Base)o).Quem());
    }
}
