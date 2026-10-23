using System;
using System.Collections.Generic;
using System.Linq;

class Produto
{
    public string Nome { get; set; }
    public string Categoria { get; set; }
    public decimal Preco { get; set; }
    public int Estoque { get; set; }
}

class P
{
    static void Main()
    {
        int[] n = { 5, 3, 8, 1, 9, 2, 8 };
        Console.WriteLine(n.Sum() + " " + n.Min() + " " + n.Max() + " " + n.Count() + " " + n.Average().ToString("F3"));
        Console.WriteLine(string.Join(",", n.Where(x => x > 3)));
        Console.WriteLine(string.Join(",", n.Select(x => x * x)));
        Console.WriteLine(string.Join(",", n.OrderBy(x => x)));
        Console.WriteLine(string.Join(",", n.OrderByDescending(x => x)));
        Console.WriteLine(string.Join(",", n.Distinct()));
        Console.WriteLine(string.Join(",", n.Skip(2).Take(3)));
        Console.WriteLine(string.Join(",", n.Reverse()));
        Console.WriteLine(n.First() + " " + n.Last() + " " + n.FirstOrDefault(x => x > 100) + " " + n.First(x => x > 5));
        Console.WriteLine(n.Any(x => x > 8) + " " + n.All(x => x > 0) + " " + n.Contains(9) + " " + n.Count(x => x == 8));
        Console.WriteLine(string.Join(",", n.TakeWhile(x => x != 1)) + " | " + string.Join(",", n.SkipWhile(x => x != 1)));
        Console.WriteLine(n.Aggregate((a, b) => a * b) + " " + n.Aggregate(100, (a, b) => a - b));
        Console.WriteLine(string.Join(",", n.Select((x, i) => x * i)));
        Console.WriteLine(string.Join(",", n.Concat(new int[] { 0 }).Union(new int[] { 7 }).Intersect(new int[] { 7, 0, 5, 3 })));
        Console.WriteLine(string.Join(",", n.Except(new int[] { 8, 9 })));
        Console.WriteLine(n.ToList().Count + " " + n.ToArray().Length);
        Console.WriteLine(string.Join(",", Enumerable.Range(3, 4)) + " " + string.Join("", Enumerable.Repeat("ab", 3)));
        Console.WriteLine(string.Join(",", n.Zip(new string[] { "a", "b", "c" }, (x, s) => x + s)));

        List<Produto> ps = new List<Produto>
        {
            new Produto { Nome = "Caneta", Categoria = "Papelaria", Preco = 2.5m, Estoque = 100 },
            new Produto { Nome = "Caderno", Categoria = "Papelaria", Preco = 15.9m, Estoque = 30 },
            new Produto { Nome = "Mouse", Categoria = "Info", Preco = 49.9m, Estoque = 15 },
            new Produto { Nome = "Teclado", Categoria = "Info", Preco = 120m, Estoque = 0 },
            new Produto { Nome = "Mochila", Categoria = "Acessorios", Preco = 89.9m, Estoque = 8 }
        };
        Console.WriteLine(ps.Sum(p => p.Preco) + " " + ps.Max(p => p.Preco) + " " + ps.Average(p => p.Estoque));
        foreach (Produto p in ps.Where(p => p.Estoque > 0).OrderBy(p => p.Preco)) Console.WriteLine(p.Nome + " " + p.Preco);
        foreach (var g in ps.GroupBy(p => p.Categoria)) Console.WriteLine(g.Key + ": " + g.Count() + " itens, total " + g.Sum(p => p.Preco));
        var nomes = ps.Select(p => p.Nome.ToUpper()).ToList();
        Console.WriteLine(string.Join("/", nomes));
        var cara = ps.OrderByDescending(p => p.Preco).First();
        Console.WriteLine(cara.Nome);
        var barato = ps.OrderBy(p => p.Preco).ThenBy(p => p.Nome).Select(p => p.Nome).Take(2);
        Console.WriteLine(string.Join(",", barato));
        Dictionary<string, decimal> mapa = ps.ToDictionary(p => p.Nome, p => p.Preco);
        Console.WriteLine(mapa["Mouse"] + " " + mapa.Count);
        var anon = ps.Select(p => new { p.Nome, Total = p.Preco * p.Estoque }).Where(x => x.Total > 100);
        foreach (var a in anon) Console.WriteLine(a.Nome + "=" + a.Total);
        var consulta = from p in ps where p.Preco > 10 orderby p.Nome select p.Nome;
        Console.WriteLine(string.Join(",", consulta));
        string frase = "o rato roeu a roupa do rei de roma";
        var freq = frase.Split(' ').GroupBy(w => w.Length).OrderBy(g => g.Key).Select(g => g.Key + ":" + g.Count());
        Console.WriteLine(string.Join(" ", freq));
        Console.WriteLine(frase.Where(c => "aeiou".Contains(c)).Count());
        var ordenadas = frase.Split(' ').OrderBy(w => w.Length).ThenBy(w => w);
        Console.WriteLine(string.Join(" ", ordenadas));
        Console.WriteLine(new int[0].Sum() + " " + new int[0].DefaultIfEmpty(7).First());
        try { new int[0].Max(); }
        catch (InvalidOperationException) { Console.WriteLine("sequência vazia"); }
        try { n.Single(x => x == 8); }
        catch (InvalidOperationException) { Console.WriteLine("mais de um"); }
        var sel = n.Where(x => { Console.Write("w" + x + " "); return x > 7; }).Select(x => { Console.Write("s" + x + " "); return x; });
        Console.WriteLine("antes");
        foreach (int x in sel) Console.Write("[" + x + "] ");
        Console.WriteLine();
    }
}
