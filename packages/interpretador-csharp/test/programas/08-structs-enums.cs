using System;
using System.Collections.Generic;

enum Dia { Segunda = 1, Terca, Quarta, Quinta, Sexta, Sabado, Domingo }
enum Cor : byte { Vermelho, Verde = 5, Azul }

[Flags]
enum Perm { Nenhuma = 0, Ler = 1, Escrever = 2, Executar = 4, Tudo = 7 }

struct Ponto
{
    public int X, Y;
    public Ponto(int x, int y) { X = x; Y = y; }
    public double Dist(Ponto o) { int dx = X - o.X, dy = Y - o.Y; return Math.Sqrt(dx * dx + dy * dy); }
    public override string ToString() { return "(" + X + "," + Y + ")"; }
    public void Mover(int dx) { X += dx; }
}

class Linha { public Ponto A, B; }

class P
{
    static void Muda(Ponto p) { p.X = 1000; }
    static void MudaRef(ref Ponto p) { p.X = 1000; }
    static void MudaArr(int[] a) { a[0] = 1000; }

    static string NomeDia(Dia d)
    {
        switch (d)
        {
            case Dia.Sabado:
            case Dia.Domingo: return "fim de semana";
            case Dia.Sexta: return "quase";
            default: return "útil";
        }
    }

    static void Main()
    {
        Dia d = Dia.Quarta;
        Console.WriteLine(d + " " + (int)d + " " + d.ToString() + " " + (Dia)6 + " " + Dia.Domingo);
        Console.WriteLine(NomeDia(Dia.Sabado) + " " + NomeDia(Dia.Sexta) + " " + NomeDia(Dia.Segunda));
        Console.WriteLine(Enum.Parse(typeof(Dia), "Terca") + " " + Enum.IsDefined(typeof(Dia), 9));
        foreach (Dia x in Enum.GetValues(typeof(Dia))) Console.Write((int)x);
        Console.WriteLine();
        Console.WriteLine(string.Join(",", Enum.GetNames(typeof(Cor))));
        Console.WriteLine((Cor)5 + " " + (byte)Cor.Azul + " " + (d == Dia.Quarta) + " " + (d > Dia.Segunda));
        Perm p = Perm.Ler | Perm.Escrever;
        Console.WriteLine(p + " " + (int)p + " " + ((p & Perm.Escrever) != 0) + " " + ((p & Perm.Executar) != 0) + " " + p.HasFlag(Perm.Ler));
        p |= Perm.Executar;
        Console.WriteLine(p + " " + (p == Perm.Tudo));
        p &= ~Perm.Ler;
        Console.WriteLine(p + " " + Perm.Nenhuma);

        Ponto a = new Ponto(3, 4);
        Ponto b = a;
        b.X = 10;
        Console.WriteLine(a + " " + b + " " + a.Dist(new Ponto(0, 0)));
        Muda(a);
        Console.WriteLine(a);
        MudaRef(ref a);
        Console.WriteLine(a);
        a.Mover(5);
        Console.WriteLine(a);
        Ponto[] pts = new Ponto[3];
        pts[1].X = 7;
        Console.WriteLine(pts[0] + " " + pts[1]);
        Ponto copia = pts[1];
        copia.X = 99;
        Console.WriteLine(pts[1] + " " + copia);
        Linha l = new Linha();
        l.A.X = 5;
        Console.WriteLine(l.A + " " + l.B);
        Linha l2 = l;
        l2.A.Y = 8;
        Console.WriteLine(l.A);
        List<Ponto> lista = new List<Ponto>();
        lista.Add(a);
        a.X = -1;
        Console.WriteLine(lista[0] + " " + a);
        Console.WriteLine(new Ponto(1, 2).Equals(new Ponto(1, 2)) + " " + (default(Ponto)));
        int[] arr = { 1, 2, 3 };
        int[] alias = arr;
        MudaArr(arr);
        alias[1] = 2000;
        Console.WriteLine(arr[0] + " " + arr[1] + " " + (arr == alias));
        int[] clone = (int[])arr.Clone();
        clone[2] = 3000;
        Console.WriteLine(arr[2] + " " + clone[2]);
        string s1 = "oi", s2 = "oi";
        string s3 = new string(new char[] { 'o', 'i' });
        Console.WriteLine((s1 == s2) + " " + (s1 == s3) + " " + object.ReferenceEquals(s1, s2) + " " + s1.Equals(s3));
        object o1 = new Ponto(1, 1);
        object o2 = o1;
        Console.WriteLine(o1.Equals(o2) + " " + (o1 == o2));
        object boxed = 42;
        int unboxed = (int)boxed;
        Console.WriteLine(unboxed + 1);
        Console.WriteLine(boxed is int);
        Console.WriteLine(boxed is long);
        Tuple<int, string> t = Tuple.Create(1, "um");
        Console.WriteLine(t.Item1 + t.Item2 + " " + t);
        Nullable<int> ni = null;
        int? nj = 5;
        Console.WriteLine(ni.HasValue + " " + nj.HasValue + " " + nj.Value + " " + (ni ?? -1) + " " + (nj + 1) + " " + ni.GetValueOrDefault());
    }
}
