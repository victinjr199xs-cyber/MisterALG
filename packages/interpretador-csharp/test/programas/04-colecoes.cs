using System;
using System.Collections.Generic;
using System.Linq;

class Aluno
{
    public string Nome;
    public int Nota;
    public Aluno(string n, int nota) { Nome = n; Nota = nota; }
    public override string ToString() { return Nome + ":" + Nota; }
}

class P
{
    static void Main()
    {
        int[] v = { 5, 3, 9, 1, 7 };
        Console.WriteLine(v.Length + " " + v[0] + " " + v[v.Length - 1]);
        Array.Sort(v);
        Console.WriteLine(string.Join(",", v));
        Array.Reverse(v);
        Console.WriteLine(string.Join(",", v));
        Console.WriteLine(Array.IndexOf(v, 3));
        int[,] m = new int[2, 3];
        for (int i = 0; i < 2; i++) for (int j = 0; j < 3; j++) m[i, j] = i * 3 + j;
        Console.WriteLine(m.GetLength(0) + "x" + m.GetLength(1) + " " + m[1, 2]);
        foreach (int x in m) Console.Write(x + " ");
        Console.WriteLine();
        int[][] jag = new int[3][];
        for (int i = 0; i < 3; i++) { jag[i] = new int[i + 1]; for (int j = 0; j <= i; j++) jag[i][j] = j; }
        Console.WriteLine(jag[2].Length + " " + jag[2][2]);
        string[] nomes = new string[3];
        Console.WriteLine(nomes[0] == null);
        double[] ds = new double[2];
        Console.WriteLine(ds[1]);

        List<int> lista = new List<int>();
        lista.Add(10); lista.Add(20); lista.Add(30); lista.Add(20);
        Console.WriteLine(lista.Count + " " + lista[1] + " " + lista.IndexOf(20) + " " + lista.LastIndexOf(20));
        lista.Remove(20);
        lista.Insert(0, 5);
        lista.RemoveAt(1);
        Console.WriteLine(string.Join(",", lista));
        lista.AddRange(new int[] { 1, 2 });
        lista.Sort();
        Console.WriteLine(string.Join(",", lista));
        Console.WriteLine(lista.Contains(30) + " " + lista.Contains(99));
        Console.WriteLine(lista.Exists(x => x > 25) + " " + lista.Find(x => x > 5) + " " + lista.FindAll(x => x < 10).Count);
        List<string> palavras = new List<string> { "banana", "maçã", "uva", "abacaxi" };
        palavras.Sort();
        Console.WriteLine(string.Join(",", palavras));
        palavras.Sort((a, b) => a.Length.CompareTo(b.Length));
        Console.WriteLine(string.Join(",", palavras));
        List<Aluno> alunos = new List<Aluno> { new Aluno("Ana", 80), new Aluno("Bia", 95), new Aluno("Caio", 70), new Aluno("Duda", 85) };
        alunos.Sort((a, b) => b.Nota - a.Nota);
        Console.WriteLine(string.Join(" ", alunos));

        Dictionary<string, int> d = new Dictionary<string, int>();
        d["um"] = 1;
        d.Add("dois", 2);
        d["tres"] = 3;
        d["um"] = 11;
        Console.WriteLine(d.Count + " " + d["um"] + " " + d.ContainsKey("dois") + " " + d.ContainsKey("x"));
        int val;
        Console.WriteLine(d.TryGetValue("tres", out val) + " " + val);
        Console.WriteLine(d.TryGetValue("zzz", out val) + " " + val);
        foreach (KeyValuePair<string, int> kv in d) Console.Write(kv.Key + "=" + kv.Value + ";");
        Console.WriteLine();
        d.Remove("dois");
        Console.WriteLine(string.Join(",", d.Keys) + " | " + string.Join(",", d.Values));
        try { int z = d["naoexiste"]; }
        catch (KeyNotFoundException) { Console.WriteLine("chave ausente"); }
        try { d.Add("um", 5); }
        catch (ArgumentException) { Console.WriteLine("chave repetida"); }

        HashSet<int> hs = new HashSet<int> { 1, 2, 3, 2, 1 };
        Console.WriteLine(hs.Count + " " + hs.Add(4) + " " + hs.Add(4) + " " + hs.Contains(2));
        HashSet<int> hs2 = new HashSet<int> { 3, 4, 5 };
        hs.IntersectWith(hs2);
        Console.WriteLine(string.Join(",", hs));
        Queue<string> fila = new Queue<string>();
        fila.Enqueue("a"); fila.Enqueue("b"); fila.Enqueue("c");
        Console.WriteLine(fila.Dequeue() + fila.Peek() + fila.Count);
        Stack<int> pilha = new Stack<int>();
        pilha.Push(1); pilha.Push(2); pilha.Push(3);
        Console.WriteLine(pilha.Pop() + " " + pilha.Peek() + " " + pilha.Count);
        foreach (int x in pilha) Console.Write(x);
        Console.WriteLine();
        try { new Stack<int>().Pop(); }
        catch (InvalidOperationException e) { Console.WriteLine("pilha vazia"); }
        try { List<int> l2 = new List<int>(); Console.WriteLine(l2[0]); }
        catch (ArgumentOutOfRangeException) { Console.WriteLine("fora do intervalo"); }
        try { int[] a = new int[2]; a[2] = 1; }
        catch (IndexOutOfRangeException) { Console.WriteLine("fora do array"); }
        try { foreach (int x in lista) lista.Add(1); }
        catch (InvalidOperationException) { Console.WriteLine("coleção modificada"); }
        List<int> copia = new List<int>(lista);
        copia.Clear();
        Console.WriteLine(lista.Count + " " + copia.Count);
        int[] arr2 = lista.ToArray();
        Console.WriteLine(arr2.Length);
        LinkedList<int> ll = new LinkedList<int>();
        ll.AddLast(2); ll.AddFirst(1); ll.AddLast(3);
        Console.WriteLine(string.Join(",", ll) + " " + ll.First.Value + " " + ll.Last.Value);
        SortedDictionary<string, int> sd = new SortedDictionary<string, int>();
        sd["z"] = 1; sd["a"] = 2; sd["m"] = 3;
        Console.WriteLine(string.Join(",", sd.Keys));
    }
}
