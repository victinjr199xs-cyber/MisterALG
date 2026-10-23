// LINQ: os métodos de extensão de System.Linq sobre qualquer coleção (array, lista, texto, yield...).
// Os "lentos" (Where, Select, Take...) só rodam quando alguém percorre o resultado, como no C#.

import { igualValor } from '../operadores.js'
import { Arr, Chr, Dbl, Dec, Objeto, Ref, Tupla, comoNumero, converterNumero, tipoNumerico } from '../valores.js'
import { DictCS, ConjuntoCS, ListaCS } from './colecoes.js'

/** Uma sequência que se refaz a cada vez que é percorrida. */
export class SeqCS {
  constructor(fabrica, tipoElem = 'object') {
    this.fabrica = fabrica
    this.tipoElem = tipoElem
  }

  iterar() { return this.fabrica() }

  nomeCS() { return `IEnumerable<${this.tipoElem}>` }

  paraTexto() { return 'System.Linq.Enumerable+Iterator' }
}
SeqCS.METODOS = {}
SeqCS.PROPS = {}

export class OrdenadaCS extends SeqCS {
  constructor(m, fonte, chaves) {
    super(() => this.ordenar()[Symbol.iterator]())
    this.m = m
    this.fonte = fonte
    this.chaves = chaves
  }

  ordenar() {
    const m = this.m
    const itens = [...m.iterarSync(this.fonte)]
    const calc = itens.map((x, i) => ({ x, i, ks: this.chaves.map((c) => m.chamarFuncao(c.f, [x])) }))
    calc.sort((a, b) => {
      for (let k = 0; k < this.chaves.length; k += 1) {
        const c = this.chaves[k]
        const r = c.cmp(a.ks[k], b.ks[k])
        if (r !== 0) return c.desc ? -r : r
      }
      return a.i - b.i
    })
    return calc.map((c) => c.x)
  }

  nomeCS() { return 'IOrderedEnumerable' }
}
OrdenadaCS.METODOS = {}
OrdenadaCS.PROPS = {}

export class AgrupamentoCS {
  constructor(chave, itens) { this.Key = chave; this.itens = itens }

  iterar() { return this.itens[Symbol.iterator]() }

  nomeCS() { return 'IGrouping' }

  paraTexto() { return 'System.Linq.Grouping' }
}
AgrupamentoCS.METODOS = {}
AgrupamentoCS.PROPS = { Key: { get: (m, g) => g.Key } }

const chamar = (m, f, args) => m.chamarFuncao(f, args)
const todos = (m, fonte) => [...m.iterarSync(fonte)]
const nenhum = (m) => m.excecao('InvalidOperationException', 'Sequence contains no elements')
const nuloFonte = (m, fonte) => {
  if (fonte === null || fonte === undefined) throw m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'source')")
}
const seq = (fabrica, tipo) => new SeqCS(fabrica, tipo)
const aridade = (f) => f?.params?.length ?? 1

const comparadorChave = (m, c) => {
  if (c && (c.ehFunc)) return (a, b) => comoNumero(m.chamarFuncao(c, [a, b]))
  if (c instanceof Objeto) {
    const md = m.acharMetodoVirtual(c.cls, 'Compare', 2)
    if (md) return (a, b) => comoNumero(m.rodarSync(m.chamarMetodo(md, c, [a, b], md.cls)))
  }
  return (a, b) => m.comparar(a, b)
}

const somar = (m, a, b) => m.bib.somar(m, a, b)

function soma(m, itens, tipoElem) {
  if (!itens.length) {
    if (tipoElem === 'double') return new Dbl(0)
    if (tipoElem === 'decimal') return new Dec(0n, 0)
    if (tipoElem === 'long') return 0n
    return 0
  }
  let s = itens[0]
  for (let i = 1; i < itens.length; i += 1) s = somar(m, s, itens[i])
  return s
}

function media(m, itens) {
  if (!itens.length) throw nenhum(m)
  const k = tipoNumerico(itens[0])
  const s = soma(m, itens, k)
  if (k === 'decimal') return m.bib.dividir(m, s, itens.length)
  return new Dbl(comoNumero(s instanceof Dec ? converterNumero(s, 'double') : s) / itens.length)
}

const escolher = (m, fonte, args) => {
  const itens = todos(m, fonte)
  const f = args[0]
  return f && f.ehFunc ? itens.map((x) => chamar(m, f, [x])) : itens
}

const tipoDe = (m, fonte) => (fonte instanceof Arr ? fonte.tipoElem : fonte?.tipoElem ?? 'object')

export const LINQ = {
  Where(m, fonte, [f]) {
    nuloFonte(m, fonte)
    const idx = aridade(f) === 2
    return seq(() => (function* g() {
      let i = 0
      for (const x of m.iterarSync(fonte)) {
        if ((idx ? chamar(m, f, [x, i]) : chamar(m, f, [x])) === true) yield x
        i += 1
      }
    }()), tipoDe(m, fonte))
  },
  Select(m, fonte, [f]) {
    nuloFonte(m, fonte)
    const idx = aridade(f) === 2
    return seq(() => (function* g() {
      let i = 0
      for (const x of m.iterarSync(fonte)) {
        yield idx ? chamar(m, f, [x, i]) : chamar(m, f, [x])
        i += 1
      }
    }()))
  },
  SelectMany(m, fonte, [f, g]) {
    return seq(() => (function* gen() {
      for (const x of m.iterarSync(fonte)) {
        for (const y of m.iterarSync(chamar(m, f, [x]))) yield g ? chamar(m, g, [x, y]) : y
      }
    }()))
  },
  OrderBy: (m, fonte, [f, c]) => new OrdenadaCS(m, fonte, [{ f, desc: false, cmp: comparadorChave(m, c) }]),
  OrderByDescending: (m, fonte, [f, c]) => new OrdenadaCS(m, fonte, [{ f, desc: true, cmp: comparadorChave(m, c) }]),
  ThenBy(m, fonte, [f, c]) { return new OrdenadaCS(m, fonte.fonte, [...fonte.chaves, { f, desc: false, cmp: comparadorChave(m, c) }]) },
  ThenByDescending(m, fonte, [f, c]) { return new OrdenadaCS(m, fonte.fonte, [...fonte.chaves, { f, desc: true, cmp: comparadorChave(m, c) }]) },
  Reverse: (m, fonte) => seq(() => todos(m, fonte).reverse()[Symbol.iterator](), tipoDe(m, fonte)),
  Take: (m, fonte, [n]) => seq(() => (function* g() {
    let i = 0
    if (n <= 0) return
    for (const x of m.iterarSync(fonte)) {
      yield x
      i += 1
      if (i >= n) return
    }
  }()), tipoDe(m, fonte)),
  TakeLast: (m, fonte, [n]) => seq(() => todos(m, fonte).slice(Math.max(0, todos(m, fonte).length - n))[Symbol.iterator](), tipoDe(m, fonte)),
  Skip: (m, fonte, [n]) => seq(() => (function* g() {
    let i = 0
    for (const x of m.iterarSync(fonte)) {
      if (i >= n) yield x
      i += 1
    }
  }()), tipoDe(m, fonte)),
  SkipLast: (m, fonte, [n]) => seq(() => todos(m, fonte).slice(0, Math.max(0, todos(m, fonte).length - n))[Symbol.iterator](), tipoDe(m, fonte)),
  TakeWhile: (m, fonte, [f]) => seq(() => (function* g() {
    for (const x of m.iterarSync(fonte)) {
      if (chamar(m, f, [x]) !== true) return
      yield x
    }
  }()), tipoDe(m, fonte)),
  SkipWhile: (m, fonte, [f]) => seq(() => (function* g() {
    let pulando = true
    for (const x of m.iterarSync(fonte)) {
      if (pulando && chamar(m, f, [x]) === true) continue
      pulando = false
      yield x
    }
  }()), tipoDe(m, fonte)),
  Distinct: (m, fonte) => seq(() => (function* g() {
    const vistos = new Set()
    for (const x of m.iterarSync(fonte)) {
      const h = m.hashDe(x)
      if (!vistos.has(h)) {
        vistos.add(h)
        yield x
      }
    }
  }()), tipoDe(m, fonte)),
  DistinctBy: (m, fonte, [f]) => seq(() => (function* g() {
    const vistos = new Set()
    for (const x of m.iterarSync(fonte)) {
      const h = m.hashDe(chamar(m, f, [x]))
      if (!vistos.has(h)) {
        vistos.add(h)
        yield x
      }
    }
  }()), tipoDe(m, fonte)),
  Concat: (m, fonte, [outra]) => seq(() => (function* g() { yield* m.iterarSync(fonte); yield* m.iterarSync(outra) }()), tipoDe(m, fonte)),
  Append: (m, fonte, [v]) => seq(() => (function* g() { yield* m.iterarSync(fonte); yield v }()), tipoDe(m, fonte)),
  Prepend: (m, fonte, [v]) => seq(() => (function* g() { yield v; yield* m.iterarSync(fonte) }()), tipoDe(m, fonte)),
  Union: (m, fonte, [outra]) => LINQ.Distinct(m, LINQ.Concat(m, fonte, [outra]), []),
  Intersect: (m, fonte, [outra]) => seq(() => {
    const o = new Set(todos(m, outra).map((x) => m.hashDe(x)))
    return LINQ.Distinct(m, fonte, []).iterar().constructor === Object ? [] : (function* g() { for (const x of m.iterarSync(LINQ.Distinct(m, fonte, []))) if (o.has(m.hashDe(x))) yield x }())
  }, tipoDe(m, fonte)),
  Except: (m, fonte, [outra]) => seq(() => {
    const o = new Set(todos(m, outra).map((x) => m.hashDe(x)))
    return (function* g() { for (const x of m.iterarSync(LINQ.Distinct(m, fonte, []))) if (!o.has(m.hashDe(x))) yield x }())
  }, tipoDe(m, fonte)),
  Zip: (m, fonte, [outra, f]) => seq(() => (function* g() {
    const a = todos(m, fonte)
    const b = todos(m, outra)
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) yield f ? chamar(m, f, [a[i], b[i]]) : new Tupla([a[i], b[i]])
  }())),
  Cast: (m, fonte, [], targs) => seq(() => (function* g() {
    for (const x of m.iterarSync(fonte)) {
      if (targs?.[0] && !m.ehTipo(x, targs[0]) && x !== null) throw m.excecao('InvalidCastException', `Unable to cast object of type '${m.nomeDoTipoDe(x)}' to type '${targs[0]}'.`)
      yield x
    }
  }()), targs?.[0] ?? 'object'),
  OfType: (m, fonte, [], targs) => seq(() => (function* g() { for (const x of m.iterarSync(fonte)) if (m.ehTipo(x, targs?.[0] ?? 'object')) yield x }()), targs?.[0] ?? 'object'),
  DefaultIfEmpty: (m, fonte, [v]) => seq(() => (function* g() {
    let tem = false
    for (const x of m.iterarSync(fonte)) { tem = true; yield x }
    if (!tem) yield v ?? null
  }())),
  Chunk: (m, fonte, [n]) => seq(() => (function* g() {
    let lote = []
    for (const x of m.iterarSync(fonte)) {
      lote.push(x)
      if (lote.length === n) { yield new Arr(tipoDe(m, fonte), lote); lote = [] }
    }
    if (lote.length) yield new Arr(tipoDe(m, fonte), lote)
  }())),
  GroupBy(m, fonte, [kf, a, b]) {
    return seq(() => {
      const grupos = new Map()
      const elemSel = a && b ? a : null
      const resSel = b ?? (a && aridade(a) === 2 ? a : null)
      const es = elemSel ?? (a && aridade(a) === 1 && !b && false ? a : null)
      for (const x of m.iterarSync(fonte)) {
        const k = chamar(m, kf, [x])
        const h = m.hashDe(k)
        if (!grupos.has(h)) grupos.set(h, { k, itens: [] })
        grupos.get(h).itens.push(es ? chamar(m, es, [x]) : x)
      }
      const r = [...grupos.values()]
      if (resSel) return r.map((g) => chamar(m, resSel, [g.k, new SeqCS(() => g.itens[Symbol.iterator]())]))[Symbol.iterator]()
      return r.map((g) => new AgrupamentoCS(g.k, g.itens))[Symbol.iterator]()
    })
  },
  Join: (m, fonte, [interno, chaveExt, chaveInt, res]) => seq(() => (function* g() {
    const ii = todos(m, interno)
    for (const x of m.iterarSync(fonte)) {
      const k = chamar(m, chaveExt, [x])
      for (const y of ii) if (igualValor(m, chamar(m, chaveInt, [y]), k)) yield chamar(m, res, [x, y])
    }
  }())),
  GroupJoin: (m, fonte, [interno, chaveExt, chaveInt, res]) => seq(() => (function* g() {
    const ii = todos(m, interno)
    for (const x of m.iterarSync(fonte)) {
      const k = chamar(m, chaveExt, [x])
      yield chamar(m, res, [x, new SeqCS(() => ii.filter((y) => igualValor(m, chamar(m, chaveInt, [y]), k))[Symbol.iterator]())])
    }
  }())),
  // ---- resultados imediatos ----
  ToList: (m, fonte) => { nuloFonte(m, fonte); return new ListaCS(todos(m, fonte), tipoDe(m, fonte)) },
  ToArray: (m, fonte) => { nuloFonte(m, fonte); return new Arr(tipoDe(m, fonte), todos(m, fonte)) },
  ToHashSet(m, fonte) {
    const s = new ConjuntoCS(tipoDe(m, fonte))
    for (const x of m.iterarSync(fonte)) ConjuntoCS.METODOS.Add(m, s, [x])
    return s
  },
  ToDictionary(m, fonte, [kf, vf]) {
    const d = new DictCS('object', 'object')
    for (const x of m.iterarSync(fonte)) {
      const k = chamar(m, kf, [x])
      const h = m.hashDe(k)
      if (d.mapa.has(h)) throw m.excecao('ArgumentException', `An item with the same key has already been added. Key: ${m.aTexto(k)}`)
      d.mapa.set(h, { k, v: vf ? chamar(m, vf, [x]) : x })
    }
    return d
  },
  Count(m, fonte, [f]) {
    nuloFonte(m, fonte)
    if (!f) {
      if (fonte instanceof Arr) return fonte.itens.length
      if (typeof fonte === 'string') return fonte.length
      if (fonte instanceof ListaCS) return fonte.itens.length
    }
    let n = 0
    for (const x of m.iterarSync(fonte)) if (!f || chamar(m, f, [x]) === true) n += 1
    return n
  },
  LongCount: (m, fonte, a) => BigInt(LINQ.Count(m, fonte, a)),
  Any(m, fonte, [f]) {
    nuloFonte(m, fonte)
    for (const x of m.iterarSync(fonte)) if (!f || chamar(m, f, [x]) === true) return true
    return false
  },
  All(m, fonte, [f]) {
    for (const x of m.iterarSync(fonte)) if (chamar(m, f, [x]) !== true) return false
    return true
  },
  Contains: (m, fonte, [v]) => { for (const x of m.iterarSync(fonte)) if (igualValor(m, x, v)) return true; return false },
  First(m, fonte, [f]) {
    nuloFonte(m, fonte)
    for (const x of m.iterarSync(fonte)) if (!f || chamar(m, f, [x]) === true) return x
    throw m.excecao('InvalidOperationException', f ? 'Sequence contains no matching element' : 'Sequence contains no elements')
  },
  FirstOrDefault(m, fonte, [f, padrao]) {
    nuloFonte(m, fonte)
    const pred = f && f.ehFunc ? f : null
    for (const x of m.iterarSync(fonte)) if (!pred || chamar(m, pred, [x]) === true) return x
    const def = pred ? padrao : f
    return def !== undefined && !(f && f.ehFunc && padrao === undefined) ? def : m.valorPadrao(tipoDe(m, fonte))
  },
  Last(m, fonte, [f]) {
    let achou = false
    let r
    for (const x of m.iterarSync(fonte)) if (!f || chamar(m, f, [x]) === true) { achou = true; r = x }
    if (!achou) throw m.excecao('InvalidOperationException', f ? 'Sequence contains no matching element' : 'Sequence contains no elements')
    return r
  },
  LastOrDefault(m, fonte, [f]) {
    let r = m.valorPadrao(tipoDe(m, fonte))
    const pred = f && f.ehFunc ? f : null
    for (const x of m.iterarSync(fonte)) if (!pred || chamar(m, pred, [x]) === true) r = x
    return r
  },
  Single(m, fonte, [f]) {
    const achados = todos(m, fonte).filter((x) => !f || chamar(m, f, [x]) === true)
    if (!achados.length) throw m.excecao('InvalidOperationException', f ? 'Sequence contains no matching element' : 'Sequence contains no elements')
    if (achados.length > 1) throw m.excecao('InvalidOperationException', f ? 'Sequence contains more than one matching element' : 'Sequence contains more than one element')
    return achados[0]
  },
  SingleOrDefault(m, fonte, [f]) {
    const achados = todos(m, fonte).filter((x) => !f || chamar(m, f, [x]) === true)
    if (achados.length > 1) throw m.excecao('InvalidOperationException', 'Sequence contains more than one element')
    return achados.length ? achados[0] : m.valorPadrao(tipoDe(m, fonte))
  },
  ElementAt(m, fonte, [i]) {
    const itens = todos(m, fonte)
    if (i < 0 || i >= itens.length) throw m.excecao('ArgumentOutOfRangeException', "Index was out of range. Must be non-negative and less than the size of the collection. (Parameter 'index')")
    return itens[i]
  },
  ElementAtOrDefault: (m, fonte, [i]) => todos(m, fonte)[i] ?? m.valorPadrao(tipoDe(m, fonte)),
  Sum: (m, fonte, args) => soma(m, escolher(m, fonte, args), tipoDe(m, fonte)),
  Average: (m, fonte, args) => media(m, escolher(m, fonte, args)),
  Min(m, fonte, args) {
    const itens = escolher(m, fonte, args)
    if (!itens.length) throw nenhum(m)
    return itens.reduce((a, b) => (m.comparar(b, a) < 0 ? b : a))
  },
  Max(m, fonte, args) {
    const itens = escolher(m, fonte, args)
    if (!itens.length) throw nenhum(m)
    return itens.reduce((a, b) => (m.comparar(b, a) > 0 ? b : a))
  },
  MinBy(m, fonte, [f]) {
    const itens = todos(m, fonte)
    if (!itens.length) throw nenhum(m)
    return itens.reduce((a, b) => (m.comparar(chamar(m, f, [b]), chamar(m, f, [a])) < 0 ? b : a))
  },
  MaxBy(m, fonte, [f]) {
    const itens = todos(m, fonte)
    if (!itens.length) throw nenhum(m)
    return itens.reduce((a, b) => (m.comparar(chamar(m, f, [b]), chamar(m, f, [a])) > 0 ? b : a))
  },
  Aggregate(m, fonte, args) {
    const itens = todos(m, fonte)
    let acc
    let i = 0
    let f
    let res
    if (args.length === 1) {
      if (!itens.length) throw nenhum(m)
      acc = itens[0]
      i = 1
      f = args[0]
    } else {
      acc = args[0]
      f = args[1]
      res = args[2]
    }
    for (; i < itens.length; i += 1) acc = chamar(m, f, [acc, itens[i]])
    return res ? chamar(m, res, [acc]) : acc
  },
  SequenceEqual(m, fonte, [outra]) {
    const a = todos(m, fonte)
    const b = todos(m, outra)
    return a.length === b.length && a.every((x, i) => igualValor(m, x, b[i]))
  },
  ToLookup: (m, fonte, [kf]) => LINQ.GroupBy(m, fonte, [kf]),
  AsEnumerable: (m, fonte) => fonte,
  AsQueryable: (m, fonte) => fonte,
  ForEach(m, fonte, [f]) { for (const x of m.iterarSync(fonte)) chamar(m, f, [x]); return null },
}

// Enumerable.Range, Repeat, Empty
export const ENUMERABLE = {
  nome: 'Enumerable',
  const: {},
  estatico: {
    Range(m, [ini, n]) {
      if (n < 0) throw m.excecao('ArgumentOutOfRangeException', "Specified argument was out of the range of valid values. (Parameter 'count')")
      return seq(() => (function* g() { for (let i = 0; i < n; i += 1) yield (ini + i) | 0 }()), 'int')
    },
    Repeat: (m, [v, n]) => seq(() => (function* g() { for (let i = 0; i < n; i += 1) yield v }()), m.nomeDoTipoDe(v)),
    Empty: (m, a, targs) => seq(() => [][Symbol.iterator](), targs?.[0] ?? 'object'),
  },
}

export { Chr, Ref }
