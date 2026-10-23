// Coleções: List, Dictionary, HashSet, Queue, Stack, LinkedList, as ordenadas, PriorityQueue e os métodos de array.

import { Multicast, igualValor } from '../operadores.js'
import { Arr, Objeto, Ref, Tupla, comoNumero } from '../valores.js'
import { partesGenericas } from '../tipos.js'

const nulo = (m) => m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'source')")

const comparador = (m, f) => {
  if (f === undefined || f === null) return (a, b) => m.comparar(a, b)
  if (f.ehFunc || f instanceof Multicast) return (a, b) => comoNumero(m.chamarFuncao(f, [a, b]))
  if (f instanceof Objeto) {
    const md = m.acharMetodoVirtual(f.cls, 'Compare', 2)
    if (md) return (a, b) => comoNumero(m.rodarSync(m.chamarMetodo(md, f, [a, b], md.cls)))
  }
  if (f.comparar) return (a, b) => f.comparar(m, a, b)
  return (a, b) => m.comparar(a, b)
}

const chamar = (m, f, args) => m.chamarFuncao(f, args)

const modificada = (m) => m.excecao('InvalidOperationException', 'Collection was modified; enumeration operation may not execute.')

// ---- List<T> ------------------------------------------------------------------------------------------------------

export class ListaCS {
  constructor(itens = [], tipoElem = 'object') {
    this.itens = itens
    this.tipoElem = tipoElem
    this.versao = 0
  }

  nomeCS() { return `List<${this.tipoElem}>` }

  paraTexto() { return `System.Collections.Generic.List\`1[${this.tipoElem}]` }

  iterar(m) {
    const lista = this
    const v0 = this.versao
    let i = 0
    return {
      next() {
        if (lista.versao !== v0) throw modificada(m)
        return i < lista.itens.length ? { done: false, value: lista.itens[i++] } : { done: true }
      },
      [Symbol.iterator]() { return this },
    }
  }
}

const elem = (m, o, v) => m.coagir(m.copiar(v), o.tipoElem)
const fora = (m, nome = 'index') => m.excecao('ArgumentOutOfRangeException', `Index was out of range. Must be non-negative and less than the size of the collection. (Parameter '${nome}')`)

ListaCS.METODOS = {
  Add(m, o, [v]) { o.itens.push(elem(m, o, v)); o.versao += 1; return null },
  AddRange(m, o, [c]) {
    if (c === null) throw nulo(m)
    const novos = [...m.iterarSync(c)].map((x) => elem(m, o, x))
    o.itens.push(...novos)
    o.versao += 1
    return null
  },
  Insert(m, o, [i, v]) {
    if (i < 0 || i > o.itens.length) throw fora(m)
    o.itens.splice(i, 0, elem(m, o, v))
    o.versao += 1
    return null
  },
  InsertRange(m, o, [i, c]) {
    if (i < 0 || i > o.itens.length) throw fora(m)
    o.itens.splice(i, 0, ...[...m.iterarSync(c)].map((x) => elem(m, o, x)))
    o.versao += 1
    return null
  },
  Remove(m, o, [v]) {
    const i = o.itens.findIndex((x) => igualValor(m, x, v))
    if (i < 0) return false
    o.itens.splice(i, 1)
    o.versao += 1
    return true
  },
  RemoveAt(m, o, [i]) {
    if (i < 0 || i >= o.itens.length) throw fora(m)
    o.itens.splice(i, 1)
    o.versao += 1
    return null
  },
  RemoveAll(m, o, [f]) {
    const antes = o.itens.length
    o.itens = o.itens.filter((x) => chamar(m, f, [x]) !== true)
    o.versao += 1
    return antes - o.itens.length
  },
  RemoveRange(m, o, [i, n]) {
    if (i < 0 || n < 0 || i + n > o.itens.length) throw m.excecao('ArgumentException', 'Offset and length were out of bounds for the array or count is greater than the number of elements from index to the end of the source collection.')
    o.itens.splice(i, n)
    o.versao += 1
    return null
  },
  Clear(m, o) { o.itens = []; o.versao += 1; return null },
  Contains: (m, o, [v]) => o.itens.some((x) => igualValor(m, x, v)),
  IndexOf(m, o, [v, ini = 0]) {
    for (let i = ini; i < o.itens.length; i += 1) if (igualValor(m, o.itens[i], v)) return i
    return -1
  },
  LastIndexOf(m, o, [v]) {
    for (let i = o.itens.length - 1; i >= 0; i -= 1) if (igualValor(m, o.itens[i], v)) return i
    return -1
  },
  Sort(m, o, [a, b, c]) {
    const cmp = comparador(m, typeof a === 'number' ? c : a)
    if (typeof a === 'number') {
      const parte = o.itens.slice(a, a + b).sort(cmp)
      o.itens.splice(a, b, ...parte)
    } else o.itens.sort(cmp)
    o.versao += 1
    return null
  },
  Reverse(m, o, [i, n]) {
    if (i === undefined) o.itens.reverse()
    else o.itens.splice(i, n, ...o.itens.slice(i, i + n).reverse())
    o.versao += 1
    return null
  },
  Find(m, o, [f]) {
    for (const x of o.itens) if (chamar(m, f, [x]) === true) return x
    return m.valorPadrao(o.tipoElem)
  },
  FindLast(m, o, [f]) {
    for (let i = o.itens.length - 1; i >= 0; i -= 1) if (chamar(m, f, [o.itens[i]]) === true) return o.itens[i]
    return m.valorPadrao(o.tipoElem)
  },
  FindAll: (m, o, [f]) => new ListaCS(o.itens.filter((x) => chamar(m, f, [x]) === true), o.tipoElem),
  FindIndex(m, o, [a, b]) {
    const f = typeof a === 'number' ? b : a
    for (let i = typeof a === 'number' ? a : 0; i < o.itens.length; i += 1) if (chamar(m, f, [o.itens[i]]) === true) return i
    return -1
  },
  FindLastIndex(m, o, [f]) {
    for (let i = o.itens.length - 1; i >= 0; i -= 1) if (chamar(m, f, [o.itens[i]]) === true) return i
    return -1
  },
  Exists: (m, o, [f]) => o.itens.some((x) => chamar(m, f, [x]) === true),
  TrueForAll: (m, o, [f]) => o.itens.every((x) => chamar(m, f, [x]) === true),
  ForEach(m, o, [f]) {
    const v0 = o.versao
    for (const x of o.itens.slice()) {
      chamar(m, f, [x])
      if (o.versao !== v0) throw modificada(m)
    }
    return null
  },
  ToArray: (m, o) => new Arr(o.tipoElem, o.itens.slice()),
  GetRange(m, o, [i, n]) {
    if (i < 0 || n < 0 || i + n > o.itens.length) throw m.excecao('ArgumentException', 'Offset and length were out of bounds for the array or count is greater than the number of elements from index to the end of the source collection.')
    return new ListaCS(o.itens.slice(i, i + n), o.tipoElem)
  },
  CopyTo(m, o, [arr, i = 0]) {
    o.itens.forEach((x, k) => { arr.itens[i + k] = x })
    return null
  },
  ConvertAll: (m, o, [f]) => new ListaCS(o.itens.map((x) => chamar(m, f, [x])), 'object'),
  BinarySearch(m, o, [v, c]) {
    const cmp = comparador(m, c)
    let lo = 0
    let hi = o.itens.length - 1
    while (lo <= hi) {
      const meio = (lo + hi) >> 1
      const r = cmp(o.itens[meio], v)
      if (r === 0) return meio
      if (r < 0) lo = meio + 1
      else hi = meio - 1
    }
    return ~lo
  },
  TrimExcess: () => null,
  EnsureCapacity: (m, o, [n]) => n,
  Equals: (m, o, [x]) => o === x,
  GetHashCode: (m, o) => o.id ?? 0,
  GetType: (m, o) => m.bib.tipoValor(o.nomeCS()),
  AsReadOnly: (m, o) => o,
}

ListaCS.PROPS = {
  Count: { get: (m, o) => o.itens.length },
  Capacity: { get: (m, o) => Math.max(4, o.itens.length), set: () => {} },
  IsReadOnly: { get: () => false },
}

ListaCS.INDICE = {
  get(m, o, [i]) {
    if (i < 0 || i >= o.itens.length) throw fora(m)
    return o.itens[i]
  },
  set(m, o, [i], v) {
    if (i < 0 || i >= o.itens.length) throw fora(m)
    o.itens[i] = elem(m, o, v)
    o.versao += 1
  },
}

// ---- Dictionary<K,V> --------------------------------------------------------------------------------------------

export class DictCS {
  constructor(tipoK = 'object', tipoV = 'object', ordenado = false) {
    this.mapa = new Map()
    this.tipoK = tipoK
    this.tipoV = tipoV
    this.ordenado = ordenado
    this.versao = 0
  }

  nomeCS() { return `${this.ordenado ? 'SortedDictionary' : 'Dictionary'}<${this.tipoK},${this.tipoV}>` }

  paraTexto() { return `System.Collections.Generic.${this.ordenado ? 'SortedDictionary' : 'Dictionary'}\`2[${this.tipoK},${this.tipoV}]` }

  entradas(m) {
    const e = [...this.mapa.values()]
    return this.ordenado ? e.sort((a, b) => m.comparar(a.k, b.k)) : e
  }

  iterar(m) {
    const d = this
    const v0 = this.versao
    const e = this.entradas(m)
    let i = 0
    return {
      next() {
        if (d.versao !== v0) throw modificada(m)
        return i < e.length ? { done: false, value: m.novoKV(e[i].k, e[i++].v) } : { done: true }
      },
      [Symbol.iterator]() { return this },
    }
  }
}

const chaveDe = (m, d, k) => {
  if (k === null || k === undefined) throw m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'key')")
  return m.hashDe(m.coagir(k, d.tipoK))
}
const kv = (m, d, k, v) => ({ k: m.coagir(m.copiar(k), d.tipoK), v: m.coagir(m.copiar(v), d.tipoV) })

DictCS.METODOS = {
  Add(m, d, [k, v]) {
    const h = chaveDe(m, d, k)
    if (d.mapa.has(h)) throw m.excecao('ArgumentException', `An item with the same key has already been added. Key: ${m.aTexto(k)}`)
    d.mapa.set(h, kv(m, d, k, v))
    d.versao += 1
    return null
  },
  TryAdd(m, d, [k, v]) {
    const h = chaveDe(m, d, k)
    if (d.mapa.has(h)) return false
    d.mapa.set(h, kv(m, d, k, v))
    d.versao += 1
    return true
  },
  Remove(m, d, [k, saida]) {
    const h = chaveDe(m, d, k)
    const e = d.mapa.get(h)
    if (!e) {
      if (saida instanceof Ref) saida.v = m.valorPadrao(d.tipoV)
      return false
    }
    if (saida instanceof Ref) saida.v = e.v
    d.mapa.delete(h)
    d.versao += 1
    return true
  },
  ContainsKey: (m, d, [k]) => d.mapa.has(chaveDe(m, d, k)),
  ContainsValue: (m, d, [v]) => [...d.mapa.values()].some((e) => igualValor(m, e.v, v)),
  TryGetValue(m, d, [k, saida]) {
    const e = d.mapa.get(chaveDe(m, d, k))
    saida.v = e ? e.v : m.valorPadrao(d.tipoV)
    return !!e
  },
  GetValueOrDefault(m, d, [k, padrao]) {
    const e = d.mapa.get(chaveDe(m, d, k))
    return e ? e.v : padrao !== undefined ? padrao : m.valorPadrao(d.tipoV)
  },
  Clear(m, d) { d.mapa.clear(); d.versao += 1; return null },
  EnsureCapacity: (m, d, [n]) => n,
  TrimExcess: () => null,
  Equals: (m, d, [x]) => d === x,
  GetHashCode: (m, d) => d.id ?? 0,
  GetType: (m, d) => m.bib.tipoValor(d.nomeCS()),
  Contains: (m, d, [par]) => d.mapa.has(chaveDe(m, d, par.campos.get('Key'))),
}

DictCS.PROPS = {
  Count: { get: (m, d) => d.mapa.size },
  Keys: { get: (m, d) => new ListaCS(d.entradas(m).map((e) => e.k), d.tipoK) },
  Values: { get: (m, d) => new ListaCS(d.entradas(m).map((e) => e.v), d.tipoV) },
}

DictCS.INDICE = {
  get(m, d, [k]) {
    const e = d.mapa.get(chaveDe(m, d, k))
    if (!e) throw m.excecao('KeyNotFoundException', `The given key '${m.aTexto(k)}' was not present in the dictionary.`)
    return e.v
  },
  set(m, d, [k], v) {
    const h = chaveDe(m, d, k)
    const e = d.mapa.get(h)
    if (e) e.v = m.coagir(m.copiar(v), d.tipoV)
    else {
      d.mapa.set(h, kv(m, d, k, v))
      d.versao += 1
    }
  },
}

// ---- HashSet<T> / SortedSet<T> ---------------------------------------------------------------------------------------

export class ConjuntoCS {
  constructor(tipoElem = 'object', ordenado = false) {
    this.mapa = new Map()
    this.tipoElem = tipoElem
    this.ordenado = ordenado
    this.versao = 0
  }

  nomeCS() { return `${this.ordenado ? 'SortedSet' : 'HashSet'}<${this.tipoElem}>` }

  paraTexto() { return `System.Collections.Generic.${this.ordenado ? 'SortedSet' : 'HashSet'}\`1[${this.tipoElem}]` }

  valores(m) {
    const v = [...this.mapa.values()]
    return this.ordenado ? v.sort((a, b) => m.comparar(a, b)) : v
  }

  iterar(m) {
    const s = this
    const v0 = this.versao
    const e = this.valores(m)
    let i = 0
    return {
      next() {
        if (s.versao !== v0) throw modificada(m)
        return i < e.length ? { done: false, value: e[i++] } : { done: true }
      },
      [Symbol.iterator]() { return this },
    }
  }
}

const hv = (m, s, v) => m.hashDe(m.coagir(v, s.tipoElem))
const doConjunto = (m, c) => new Set([...m.iterarSync(c)].map((x) => m.hashDe(x)))

ConjuntoCS.METODOS = {
  Add(m, s, [v]) {
    const h = hv(m, s, v)
    if (s.mapa.has(h)) return false
    s.mapa.set(h, m.coagir(m.copiar(v), s.tipoElem))
    s.versao += 1
    return true
  },
  Remove(m, s, [v]) {
    const ok = s.mapa.delete(hv(m, s, v))
    if (ok) s.versao += 1
    return ok
  },
  Contains: (m, s, [v]) => s.mapa.has(hv(m, s, v)),
  Clear(m, s) { s.mapa.clear(); s.versao += 1; return null },
  UnionWith(m, s, [c]) {
    for (const x of m.iterarSync(c)) ConjuntoCS.METODOS.Add(m, s, [x])
    return null
  },
  IntersectWith(m, s, [c]) {
    const outro = doConjunto(m, c)
    for (const [h] of [...s.mapa]) if (!outro.has(h)) s.mapa.delete(h)
    s.versao += 1
    return null
  },
  ExceptWith(m, s, [c]) {
    for (const x of m.iterarSync(c)) s.mapa.delete(hv(m, s, x))
    s.versao += 1
    return null
  },
  SymmetricExceptWith(m, s, [c]) {
    for (const x of [...m.iterarSync(c)]) {
      const h = hv(m, s, x)
      if (s.mapa.has(h)) s.mapa.delete(h)
      else s.mapa.set(h, x)
    }
    s.versao += 1
    return null
  },
  IsSubsetOf(m, s, [c]) { const o = doConjunto(m, c); return [...s.mapa.keys()].every((h) => o.has(h)) },
  IsSupersetOf(m, s, [c]) { return [...m.iterarSync(c)].every((x) => s.mapa.has(hv(m, s, x))) },
  IsProperSubsetOf(m, s, [c]) { const o = doConjunto(m, c); return s.mapa.size < o.size && [...s.mapa.keys()].every((h) => o.has(h)) },
  IsProperSupersetOf(m, s, [c]) { const o = [...m.iterarSync(c)]; return s.mapa.size > o.length && o.every((x) => s.mapa.has(hv(m, s, x))) },
  Overlaps: (m, s, [c]) => [...m.iterarSync(c)].some((x) => s.mapa.has(hv(m, s, x))),
  SetEquals(m, s, [c]) { const o = doConjunto(m, c); return o.size === s.mapa.size && [...s.mapa.keys()].every((h) => o.has(h)) },
  RemoveWhere(m, s, [f]) {
    let n = 0
    for (const [h, v] of [...s.mapa]) if (chamar(m, f, [v]) === true) { s.mapa.delete(h); n += 1 }
    s.versao += 1
    return n
  },
  TryGetValue(m, s, [v, saida]) {
    const e = s.mapa.get(hv(m, s, v))
    saida.v = e === undefined ? m.valorPadrao(s.tipoElem) : e
    return e !== undefined
  },
  CopyTo(m, s, [arr, i = 0]) { s.valores(m).forEach((x, k) => { arr.itens[i + k] = x }); return null },
  Equals: (m, s, [x]) => s === x,
  GetHashCode: () => 0,
  GetType: (m, s) => m.bib.tipoValor(s.nomeCS()),
}

ConjuntoCS.PROPS = {
  Count: { get: (m, s) => s.mapa.size },
  Min: { get: (m, s) => s.valores(m)[0] },
  Max: { get: (m, s) => { const v = s.valores(m); return v[v.length - 1] } },
}

// ---- Queue<T> e Stack<T> -----------------------------------------------------------------------------------------------

export class FilaCS {
  constructor(tipoElem = 'object') { this.itens = []; this.tipoElem = tipoElem; this.versao = 0 }

  nomeCS() { return `Queue<${this.tipoElem}>` }

  paraTexto() { return `System.Collections.Generic.Queue\`1[${this.tipoElem}]` }

  iterar(m) {
    const f = this
    const v0 = this.versao
    let i = 0
    return {
      next() {
        if (f.versao !== v0) throw modificada(m)
        return i < f.itens.length ? { done: false, value: f.itens[i++] } : { done: true }
      },
      [Symbol.iterator]() { return this },
    }
  }
}

FilaCS.METODOS = {
  Enqueue(m, f, [v]) { f.itens.push(m.coagir(m.copiar(v), f.tipoElem)); f.versao += 1; return null },
  Dequeue(m, f) {
    if (!f.itens.length) throw m.excecao('InvalidOperationException', 'Queue empty.')
    f.versao += 1
    return f.itens.shift()
  },
  Peek(m, f) {
    if (!f.itens.length) throw m.excecao('InvalidOperationException', 'Queue empty.')
    return f.itens[0]
  },
  TryDequeue(m, f, [saida]) {
    if (!f.itens.length) { saida.v = m.valorPadrao(f.tipoElem); return false }
    saida.v = f.itens.shift()
    f.versao += 1
    return true
  },
  TryPeek(m, f, [saida]) {
    if (!f.itens.length) { saida.v = m.valorPadrao(f.tipoElem); return false }
    saida.v = f.itens[0]
    return true
  },
  Clear(m, f) { f.itens = []; f.versao += 1; return null },
  Contains: (m, f, [v]) => f.itens.some((x) => igualValor(m, x, v)),
  ToArray: (m, f) => new Arr(f.tipoElem, f.itens.slice()),
  CopyTo(m, f, [arr, i = 0]) { f.itens.forEach((x, k) => { arr.itens[i + k] = x }); return null },
  EnqueueRange(m, f, [c]) { for (const x of m.iterarSync(c)) f.itens.push(x); f.versao += 1; return null },
  TrimExcess: () => null,
  Equals: (m, f, [x]) => f === x,
  GetHashCode: () => 0,
  GetType: (m, f) => m.bib.tipoValor(f.nomeCS()),
}
FilaCS.PROPS = { Count: { get: (m, f) => f.itens.length } }

export class PilhaCS {
  constructor(tipoElem = 'object') { this.itens = []; this.tipoElem = tipoElem; this.versao = 0 }

  nomeCS() { return `Stack<${this.tipoElem}>` }

  paraTexto() { return `System.Collections.Generic.Stack\`1[${this.tipoElem}]` }

  iterar(m) {
    const p = this
    const v0 = this.versao
    let i = this.itens.length - 1
    return {
      next() {
        if (p.versao !== v0) throw modificada(m)
        return i >= 0 ? { done: false, value: p.itens[i--] } : { done: true }
      },
      [Symbol.iterator]() { return this },
    }
  }
}

PilhaCS.METODOS = {
  Push(m, p, [v]) { p.itens.push(m.coagir(m.copiar(v), p.tipoElem)); p.versao += 1; return null },
  Pop(m, p) {
    if (!p.itens.length) throw m.excecao('InvalidOperationException', 'Stack empty.')
    p.versao += 1
    return p.itens.pop()
  },
  Peek(m, p) {
    if (!p.itens.length) throw m.excecao('InvalidOperationException', 'Stack empty.')
    return p.itens[p.itens.length - 1]
  },
  TryPop(m, p, [saida]) {
    if (!p.itens.length) { saida.v = m.valorPadrao(p.tipoElem); return false }
    saida.v = p.itens.pop()
    p.versao += 1
    return true
  },
  TryPeek(m, p, [saida]) {
    if (!p.itens.length) { saida.v = m.valorPadrao(p.tipoElem); return false }
    saida.v = p.itens[p.itens.length - 1]
    return true
  },
  Clear(m, p) { p.itens = []; p.versao += 1; return null },
  Contains: (m, p, [v]) => p.itens.some((x) => igualValor(m, x, v)),
  ToArray: (m, p) => new Arr(p.tipoElem, p.itens.slice().reverse()),
  CopyTo(m, p, [arr, i = 0]) { p.itens.slice().reverse().forEach((x, k) => { arr.itens[i + k] = x }); return null },
  TrimExcess: () => null,
  Equals: (m, p, [x]) => p === x,
  GetHashCode: () => 0,
  GetType: (m, p) => m.bib.tipoValor(p.nomeCS()),
}
PilhaCS.PROPS = { Count: { get: (m, p) => p.itens.length } }

// ---- PriorityQueue<TElement, TPriority> ---------------------------------------------------------------------------------

export class PrioridadeCS {
  constructor(tipoElem = 'object', tipoPrio = 'int') { this.itens = []; this.tipoElem = tipoElem; this.tipoPrio = tipoPrio; this.versao = 0; this.seq = 0 }

  nomeCS() { return `PriorityQueue<${this.tipoElem},${this.tipoPrio}>` }

  iterar() { return this.itens.map((x) => x.e)[Symbol.iterator]() }
}

const ordenarPrio = (m, q) => q.itens.sort((a, b) => m.comparar(a.p, b.p) || a.seq - b.seq)

PrioridadeCS.METODOS = {
  Enqueue(m, q, [e, p]) { q.itens.push({ e, p, seq: q.seq++ }); ordenarPrio(m, q); q.versao += 1; return null },
  Dequeue(m, q) {
    if (!q.itens.length) throw m.excecao('InvalidOperationException', 'Queue empty.')
    return q.itens.shift().e
  },
  Peek(m, q) {
    if (!q.itens.length) throw m.excecao('InvalidOperationException', 'Queue empty.')
    return q.itens[0].e
  },
  TryDequeue(m, q, [e, p]) {
    if (!q.itens.length) return false
    const x = q.itens.shift()
    e.v = x.e
    if (p instanceof Ref) p.v = x.p
    return true
  },
  TryPeek(m, q, [e, p]) {
    if (!q.itens.length) return false
    e.v = q.itens[0].e
    if (p instanceof Ref) p.v = q.itens[0].p
    return true
  },
  Clear(m, q) { q.itens = []; return null },
  GetType: (m, q) => m.bib.tipoValor(q.nomeCS()),
}
PrioridadeCS.PROPS = { Count: { get: (m, q) => q.itens.length } }

// ---- LinkedList<T> --------------------------------------------------------------------------------------------------------

export class NoCS {
  constructor(v, lista) { this.Value = v; this.lista = lista }

  nomeCS() { return 'LinkedListNode' }
}
NoCS.PROPS = {
  Value: { get: (m, n) => n.Value, set: (m, n, v) => { n.Value = v } },
  Next: { get: (m, n) => { const i = n.lista.nos.indexOf(n); return n.lista.nos[i + 1] ?? null } },
  Previous: { get: (m, n) => { const i = n.lista.nos.indexOf(n); return i > 0 ? n.lista.nos[i - 1] : null } },
  List: { get: (m, n) => n.lista },
}
NoCS.METODOS = {}

export class LigadaCS {
  constructor(tipoElem = 'object') { this.nos = []; this.tipoElem = tipoElem; this.versao = 0 }

  nomeCS() { return `LinkedList<${this.tipoElem}>` }

  iterar() { return this.nos.map((n) => n.Value)[Symbol.iterator]() }
}

LigadaCS.METODOS = {
  AddFirst(m, l, [v]) { const n = v instanceof NoCS ? v : new NoCS(v, l); l.nos.unshift(n); l.versao += 1; return n },
  AddLast(m, l, [v]) { const n = v instanceof NoCS ? v : new NoCS(v, l); l.nos.push(n); l.versao += 1; return n },
  AddAfter(m, l, [no, v]) { const n = new NoCS(v, l); l.nos.splice(l.nos.indexOf(no) + 1, 0, n); l.versao += 1; return n },
  AddBefore(m, l, [no, v]) { const n = new NoCS(v, l); l.nos.splice(l.nos.indexOf(no), 0, n); l.versao += 1; return n },
  RemoveFirst(m, l) {
    if (!l.nos.length) throw m.excecao('InvalidOperationException', 'The LinkedList is empty.')
    l.nos.shift()
    l.versao += 1
    return null
  },
  RemoveLast(m, l) {
    if (!l.nos.length) throw m.excecao('InvalidOperationException', 'The LinkedList is empty.')
    l.nos.pop()
    l.versao += 1
    return null
  },
  Remove(m, l, [x]) {
    const i = x instanceof NoCS ? l.nos.indexOf(x) : l.nos.findIndex((n) => igualValor(m, n.Value, x))
    if (i < 0) return x instanceof NoCS ? null : false
    l.nos.splice(i, 1)
    l.versao += 1
    return x instanceof NoCS ? null : true
  },
  Find: (m, l, [v]) => l.nos.find((n) => igualValor(m, n.Value, v)) ?? null,
  FindLast: (m, l, [v]) => [...l.nos].reverse().find((n) => igualValor(m, n.Value, v)) ?? null,
  Contains: (m, l, [v]) => l.nos.some((n) => igualValor(m, n.Value, v)),
  Clear(m, l) { l.nos = []; l.versao += 1; return null },
  GetType: (m, l) => m.bib.tipoValor(l.nomeCS()),
}
LigadaCS.PROPS = {
  Count: { get: (m, l) => l.nos.length },
  First: { get: (m, l) => l.nos[0] ?? null },
  Last: { get: (m, l) => l.nos[l.nos.length - 1] ?? null },
}

// ---- construtores ----------------------------------------------------------------------------------------------------

const argsDe = (targs, n) => Array.from({ length: n }, (_, i) => targs[i] ?? 'object')

function criarLista(m, args, targs) {
  const [t] = argsDe(targs, 1)
  const l = new ListaCS([], t)
  if (m.ehColecao(args[0])) for (const x of m.iterarSync(args[0])) l.itens.push(m.coagir(x, t))
  return l
}

function criarDict(m, args, targs, ordenado) {
  const [tk, tv] = argsDe(targs, 2)
  const d = new DictCS(tk, tv, ordenado)
  const origem = args.find((a) => a instanceof DictCS)
  if (origem) for (const e of origem.entradas(m)) d.mapa.set(m.hashDe(m.coagir(e.k, tk)), { k: e.k, v: e.v })
  return d
}

export const TIPOS_COLECAO = {
  List: { nome: 'List', criar: criarLista, const: {}, estatico: {} },
  ArrayList: { nome: 'ArrayList', criar: (m, a) => criarLista(m, a, ['object']), const: {}, estatico: {} },
  Dictionary: { nome: 'Dictionary', criar: (m, a, t) => criarDict(m, a, t, false), const: {}, estatico: {} },
  SortedDictionary: { nome: 'SortedDictionary', criar: (m, a, t) => criarDict(m, a, t, true), const: {}, estatico: {} },
  SortedList: { nome: 'SortedList', criar: (m, a, t) => criarDict(m, a, t, true), const: {}, estatico: {} },
  HashSet: {
    nome: 'HashSet',
    criar(m, args, targs) {
      const s = new ConjuntoCS(argsDe(targs, 1)[0])
      if (m.ehColecao(args[0])) for (const x of m.iterarSync(args[0])) ConjuntoCS.METODOS.Add(m, s, [x])
      return s
    },
    const: {},
    estatico: {},
  },
  SortedSet: {
    nome: 'SortedSet',
    criar(m, args, targs) {
      const s = new ConjuntoCS(argsDe(targs, 1)[0], true)
      if (m.ehColecao(args[0])) for (const x of m.iterarSync(args[0])) ConjuntoCS.METODOS.Add(m, s, [x])
      return s
    },
    const: {},
    estatico: {},
  },
  Queue: {
    nome: 'Queue',
    criar(m, args, targs) {
      const f = new FilaCS(argsDe(targs, 1)[0])
      if (m.ehColecao(args[0])) for (const x of m.iterarSync(args[0])) f.itens.push(x)
      return f
    },
    const: {},
    estatico: {},
  },
  Stack: {
    nome: 'Stack',
    criar(m, args, targs) {
      const p = new PilhaCS(argsDe(targs, 1)[0])
      if (m.ehColecao(args[0])) for (const x of m.iterarSync(args[0])) p.itens.push(x)
      return p
    },
    const: {},
    estatico: {},
  },
  LinkedList: {
    nome: 'LinkedList',
    criar(m, args, targs) {
      const l = new LigadaCS(argsDe(targs, 1)[0])
      if (m.ehColecao(args[0])) for (const x of m.iterarSync(args[0])) l.nos.push(new NoCS(x, l))
      return l
    },
    const: {},
    estatico: {},
  },
  PriorityQueue: { nome: 'PriorityQueue', criar: (m, a, t) => new PrioridadeCS(...argsDe(t, 2)), const: {}, estatico: {} },
}

// ---- Array (métodos estáticos e de instância) -----------------------------------------------------------------------------

const arrDe = (m, a) => {
  if (a === null || a === undefined) throw m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'array')")
  return a
}

export const ARRAY = {
  nome: 'Array',
  const: {},
  estatico: {
    Sort(m, [a, b, c]) {
      const arr = arrDe(m, a)
      if (b instanceof Arr) {
        const idx = arr.itens.map((x, i) => i).sort((i, j) => m.comparar(arr.itens[i], arr.itens[j]))
        const chaves = idx.map((i) => arr.itens[i])
        const itens = idx.map((i) => b.itens[i])
        arr.itens = chaves
        b.itens = itens
        return null
      }
      arr.itens.sort(comparador(m, typeof b === 'number' ? c : b))
      return null
    },
    Reverse(m, [a, i, n]) {
      const arr = arrDe(m, a)
      if (i === undefined) arr.itens.reverse()
      else arr.itens.splice(i, n, ...arr.itens.slice(i, i + n).reverse())
      return null
    },
    IndexOf(m, [a, v, i = 0]) {
      const arr = arrDe(m, a)
      for (let k = i; k < arr.itens.length; k += 1) if (igualValor(m, arr.itens[k], v)) return k
      return -1
    },
    LastIndexOf(m, [a, v]) {
      const arr = arrDe(m, a)
      for (let k = arr.itens.length - 1; k >= 0; k -= 1) if (igualValor(m, arr.itens[k], v)) return k
      return -1
    },
    Copy(m, args) {
      const [src, a, b, c, d] = args
      let si = 0
      let dst
      let di = 0
      let n
      if (args.length === 3) { dst = a; n = b } else { si = a; dst = b; di = c; n = d }
      if (n < 0 || si + n > src.itens.length || di + n > dst.itens.length) throw m.excecao('ArgumentException', 'Source array was not long enough. Check the source index, length, and the array\'s lower bounds.')
      const parte = src.itens.slice(si, si + n)
      parte.forEach((x, k) => { dst.itens[di + k] = m.coagir(x, dst.tipoElem) })
      return null
    },
    Resize(m, [ref, n]) {
      const arr = ref.v
      if (arr === null) { ref.v = new Arr('object', Array.from({ length: n }, () => null)); return null }
      const novos = arr.itens.slice(0, n)
      while (novos.length < n) novos.push(m.valorPadrao(arr.tipoElem))
      ref.v = new Arr(arr.tipoElem, novos)
      return null
    },
    Fill(m, [a, v]) {
      const arr = arrDe(m, a)
      arr.itens.fill(m.coagir(v, arr.tipoElem))
      return null
    },
    Clear(m, [a, i = 0, n]) {
      const arr = arrDe(m, a)
      const fim = n === undefined ? arr.itens.length : i + n
      for (let k = i; k < fim; k += 1) arr.itens[k] = m.valorPadrao(arr.tipoElem)
      return null
    },
    Exists: (m, [a, f]) => arrDe(m, a).itens.some((x) => chamar(m, f, [x]) === true),
    Find: (m, [a, f]) => arrDe(m, a).itens.find((x) => chamar(m, f, [x]) === true) ?? m.valorPadrao(a.tipoElem),
    FindAll: (m, [a, f]) => new Arr(a.tipoElem, arrDe(m, a).itens.filter((x) => chamar(m, f, [x]) === true)),
    FindIndex: (m, [a, f]) => arrDe(m, a).itens.findIndex((x) => chamar(m, f, [x]) === true),
    FindLast(m, [a, f]) {
      const it = arrDe(m, a).itens
      for (let i = it.length - 1; i >= 0; i -= 1) if (chamar(m, f, [it[i]]) === true) return it[i]
      return m.valorPadrao(a.tipoElem)
    },
    TrueForAll: (m, [a, f]) => arrDe(m, a).itens.every((x) => chamar(m, f, [x]) === true),
    ForEach(m, [a, f]) {
      for (const x of arrDe(m, a).itens) chamar(m, f, [x])
      return null
    },
    BinarySearch(m, [a, v, c]) {
      const cmp = comparador(m, c)
      let lo = 0
      let hi = arrDe(m, a).itens.length - 1
      while (lo <= hi) {
        const meio = (lo + hi) >> 1
        const r = cmp(a.itens[meio], v)
        if (r === 0) return meio
        if (r < 0) lo = meio + 1
        else hi = meio - 1
      }
      return ~lo
    },
    ConvertAll: (m, [a, f]) => new Arr('object', arrDe(m, a).itens.map((x) => chamar(m, f, [x]))),
    Empty: (m, a, targs) => new Arr(targs?.[0] ?? 'object', []),
    AsReadOnly: (m, [a]) => a,
    Equals: (m, [a, b]) => a === b,
  },
}

export const METODOS_ARRAY = {
  GetLength(m, a, [d]) {
    if (!a.dims) {
      if (d !== 0) throw m.excecao('IndexOutOfRangeException', 'Index was outside the bounds of the array.')
      return a.itens.length
    }
    if (d < 0 || d >= a.dims.length) throw m.excecao('IndexOutOfRangeException', 'Index was outside the bounds of the array.')
    return a.dims[d]
  },
  GetUpperBound: (m, a, [d]) => (a.dims ? a.dims[d] : a.itens.length) - 1,
  GetLowerBound: () => 0,
  Clone: (m, a) => new Arr(a.tipoElem, a.itens.slice(), a.dims ? a.dims.slice() : null),
  CopyTo(m, a, [dst, i = 0]) { a.itens.forEach((x, k) => { dst.itens[i + k] = x }); return null },
  GetValue: (m, a, args) => a.itens[m.posicaoNoArray(a, args)],
  SetValue(m, a, [v, ...idx]) { a.itens[m.posicaoNoArray(a, idx)] = m.coagir(v, a.tipoElem); return null },
  Initialize: () => null,
  Equals: (m, a, [b]) => a === b,
  GetHashCode: (m, a) => a.id ?? 0,
  GetType: (m, a) => m.bib.tipoValor(`${a.tipoElem}[${a.dims ? ','.repeat(a.dims.length - 1) : ''}]`),
  ToString: (m, a) => m.aTexto(a),
}

export const PROPS_ARRAY = {
  Length: (m, a) => a.itens.length,
  LongLength: (m, a) => BigInt(a.itens.length),
  Rank: (m, a) => (a.dims ? a.dims.length : 1),
  IsReadOnly: () => false,
  IsFixedSize: () => true,
}

export { Tupla, partesGenericas }
