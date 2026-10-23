using System;
using System.Collections;
using System.Collections.Generic;

class Caixa<T>
{
    private T valor;
    public Caixa(T v) { valor = v; }
    public T Valor { get { return valor; } set { valor = value; } }
    public override string ToString() { return "Caixa[" + valor + "]"; }
}

class Par<A, B>
{
    public A Primeiro;
    public B Segundo;
    public Par(A a, B b) { Primeiro = a; Segundo = b; }
    public Par<B, A> Inverte() { return new Par<B, A>(Segundo, Primeiro); }
    public override string ToString() { return "(" + Primeiro + ", " + Segundo + ")"; }
}

class MinhaLista<T> : IEnumerable<T>
{
    private T[] itens = new T[2];
    private int n;
    public void Add(T x)
    {
        if (n == itens.Length) Array.Resize(ref itens, n * 2);
        itens[n++] = x;
    }
    public int Count { get { return n; } }
    public T this[int i]
    {
        get { if (i < 0 || i >= n) throw new IndexOutOfRangeException(); return itens[i]; }
    }
    public IEnumerator<T> GetEnumerator() { for (int i = 0; i < n; i++) yield return itens[i]; }
    IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }
}

class Pilha<T> where T : IComparable<T>
{
    List<T> d = new List<T>();
    public void Push(T x) { d.Add(x); }
    public T Max()
    {
        T m = d[0];
        foreach (T x in d) if (x.CompareTo(m) > 0) m = x;
        return m;
    }
}

class Util
{
    public static T Maior<T>(T a, T b) where T : IComparable<T> { return a.CompareTo(b) >= 0 ? a : b; }
    public static void Troca<T>(ref T a, ref T b) { T t = a; a = b; b = t; }
    public static List<T> Repete<T>(T x, int n) { List<T> l = new List<T>(); for (int i = 0; i < n; i++) l.Add(x); return l; }
    public static string Descreve<T>(T x) { return typeof(T).Name + ":" + x; }
}

class Pessoa : IComparable<Pessoa>
{
    public string Nome; public int Idade;
    public Pessoa(string n, int i) { Nome = n; Idade = i; }
    public int CompareTo(Pessoa o) { return Idade.CompareTo(o.Idade); }
    public override string ToString() { return Nome + "(" + Idade + ")"; }
}

class P
{
    static void Main()
    {
        Caixa<int> ci = new Caixa<int>(5);
        Caixa<string> cs = new Caixa<string>("oi");
        ci.Valor += 10;
        Console.WriteLine(ci + " " + cs + " " + (ci.Valor + 1));
        Par<int, string> p = new Par<int, string>(1, "um");
        Console.WriteLine(p + " " + p.Inverte());
        MinhaLista<double> ml = new MinhaLista<double>();
        ml.Add(1.5); ml.Add(2.5); ml.Add(3.5);
        double soma = 0;
        foreach (double d in ml) soma += d;
        Console.WriteLine(ml.Count + " " + ml[1] + " " + soma);
        Pilha<Pessoa> pp = new Pilha<Pessoa>();
        pp.Push(new Pessoa("Ana", 30)); pp.Push(new Pessoa("Bia", 41)); pp.Push(new Pessoa("Caio", 25));
        Console.WriteLine(pp.Max());
        Console.WriteLine(Util.Maior(3, 9) + " " + Util.Maior("abc", "abd") + " " + Util.Maior(2.5, 1.5));
        string a = "x", b = "y";
        Util.Troca(ref a, ref b);
        Console.WriteLine(a + b);
        Console.WriteLine(string.Join(",", Util.Repete("ab", 3)));
        Console.WriteLine(Util.Descreve(42) + " " + Util.Descreve("s") + " " + Util.Descreve(1.5));
        List<Pessoa> ps = new List<Pessoa> { new Pessoa("Z", 50), new Pessoa("Y", 20), new Pessoa("X", 35) };
        ps.Sort();
        Console.WriteLine(string.Join(" ", ps));
        Dictionary<string, List<int>> grupos = new Dictionary<string, List<int>>();
        foreach (int n in new int[] { 1, 2, 3, 4, 5, 6 })
        {
            string chave = n % 2 == 0 ? "par" : "impar";
            if (!grupos.ContainsKey(chave)) grupos[chave] = new List<int>();
            grupos[chave].Add(n);
        }
        foreach (KeyValuePair<string, List<int>> kv in grupos) Console.WriteLine(kv.Key + " -> " + string.Join(",", kv.Value));
        List<List<int>> matriz = new List<List<int>>();
        for (int i = 0; i < 3; i++) { matriz.Add(new List<int>()); for (int j = 0; j < 3; j++) matriz[i].Add(i * j); }
        Console.WriteLine(string.Join("|", matriz.ConvertAll(l => string.Join(",", l))));
        Dictionary<int, Dictionary<string, int>> aninhado = new Dictionary<int, Dictionary<string, int>>();
        aninhado[1] = new Dictionary<string, int>();
        aninhado[1]["a"] = 10;
        aninhado[1]["a"] += 5;
        Console.WriteLine(aninhado[1]["a"]);
        List<double> ds = new List<double>();
        ds.Add(1);
        ds.Add(2);
        Console.WriteLine(ds[0] / 2 + " " + ds[1] / 4);
        double[] arrd = { 1, 2, 3 };
        Console.WriteLine(arrd[0] / 2);
        Dictionary<string, double> dd = new Dictionary<string, double>();
        dd["x"] = 5;
        Console.WriteLine(dd["x"] / 2);
        KeyValuePair<string, int> par = new KeyValuePair<string, int>("k", 7);
        Console.WriteLine(par.Key + par.Value);
    }
}
