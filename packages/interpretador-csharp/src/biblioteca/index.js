// A biblioteca do .NET em JavaScript: junta os tipos nativos e decide qual deles atende cada chamada.

import { ErroCS } from '../erros.js'
import { FuncGrupo, FuncMetodo, FuncNativa } from '../funcoes.js'
import { Multicast, binario, igualValor } from '../operadores.js'
import { partesGenericas, semNulo } from '../tipos.js'
import { Arr, Chr, Dbl, Dec, Flt, Num, Objeto, Ref, Tupla, ValorEnum, ehNumero, tipoNumerico } from '../valores.js'
import { ClasseDef, IteradorUsuario } from '../maquina.js'
import { Indice, Suspende } from '../refs.js'
import { DictCS, ConjuntoCS, FilaCS, LigadaCS, ListaCS, NoCS, PilhaCS, PrioridadeCS, ARRAY, METODOS_ARRAY, PROPS_ARRAY, TIPOS_COLECAO } from './colecoes.js'
import { CronometroCS, DataCS, DATETIME, STOPWATCH, TIMESPAN, TempoCS } from './datas.js'
import { AgrupamentoCS, ENUMERABLE, LINQ, OrdenadaCS, SeqCS } from './linq.js'
import { AleatorioCS, CONVERT, MATH, METODOS_NUMERO, RANDOM, tipoNumericoNativo } from './numeros.js'
import { METODOS_SPAN, PROPS_SPAN, SpanCS } from './span.js'
import { REGEX, REGEXOPTIONS, MatchCS, GrupoCS, ColecaoMatchesCS, RegexCS } from './regex.js'
import {
  BIGINTEGER, BITCONVERTER, BigCS, CONSOLE, CULTUREINFO, CulturaCS, DIRECTORY, ENCODING, ENUM, ENVIRONMENT, EscritorCS, FILE, FluxoConsoleCS, GC, GUID, GuidCS,
  LeitorCS, PATH, STREAMREADER, STREAMWRITER, TASK, TUPLE, TarefaCS, THREAD, ThreadAtualCS, TeclaCS, TipoCS, esperar,
} from './sistema.js'
import { BOOL, CHAR, METODOS_BOOL, METODOS_CHAR, METODOS_STRING, PROPS_STRING, SbCS, STRING, STRINGBUILDER } from './texto.js'

const NUMERICOS = ['sbyte', 'byte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'float', 'double', 'decimal']
const APELIDOS_NUM = { Int32: 'int', Int64: 'long', Int16: 'short', UInt32: 'uint', UInt64: 'ulong', UInt16: 'ushort', Byte: 'byte', SByte: 'sbyte', Single: 'float', Double: 'double', Decimal: 'decimal' }

const NAMESPACES = new Set([
  'System', 'Microsoft', 'System.Collections', 'System.Collections.Generic', 'System.Linq', 'System.Text', 'System.IO', 'System.Threading', 'System.Threading.Tasks',
  'System.Globalization', 'System.Numerics', 'System.Diagnostics', 'System.Text.RegularExpressions', 'System.Runtime', 'System.Collections.Concurrent',
])

const OBJECT = {
  nome: 'Object',
  const: {},
  criar: () => { throw new ErroCS('não dá para criar um object puro com new object() neste interpretador', 0) },
  estatico: {
    ReferenceEquals: (m, [a, b]) => a === b,
    Equals: (m, [a, b]) => igualValor(m, a, b),
  },
}

const DELEGADOS = Object.fromEntries(['Func', 'Action', 'Predicate', 'Comparison', 'EventHandler', 'Delegate', 'Converter'].map((n) => [n, { nome: n, criar: (m, a) => a[0], const: {}, estatico: {} }]))

class LazyCS {
  constructor(f) { this.f = f; this.pronto = false; this.v = null }

  nomeCS() { return 'Lazy' }
}
LazyCS.PROPS = {
  Value: { get: (m, l) => { if (!l.pronto) { l.v = m.chamarFuncao(l.f, []); l.pronto = true } return l.v } },
  IsValueCreated: { get: (m, l) => l.pronto },
}
LazyCS.METODOS = {}

const INTERLOCKED = {
  nome: 'Interlocked',
  const: {},
  estatico: {
    Increment(m, [r]) { r.v = binario(m, '+', r.v, 1); return r.v },
    Decrement(m, [r]) { r.v = binario(m, '-', r.v, 1); return r.v },
    Add(m, [r, n]) { r.v = binario(m, '+', r.v, n); return r.v },
    Exchange(m, [r, n]) { const a = r.v; r.v = n; return a },
    CompareExchange(m, [r, n, c]) { const a = r.v; if (igualValor(m, a, c)) r.v = n; return a },
  },
}

const DEBUG = { nome: 'Debug', const: {}, estatico: { WriteLine: () => null, Write: () => null, Assert: () => null, Print: () => null } }

const METODOS_ENUM = {
  ToString: (m, v, [f]) => m.aTexto(v, typeof f === 'string' ? f : undefined),
  HasFlag: (m, v, [o]) => (v.v & o.v) === o.v,
  CompareTo: (m, v, [o]) => v.v - o.v,
  Equals: (m, v, [o]) => o instanceof ValorEnum && o.def === v.def && o.v === v.v,
  GetHashCode: (m, v) => v.v,
  GetType: (m, v) => m.bib.tipoValor(v.def.nome),
}

const METODOS_TUPLA = {
  ToString: (m, t) => m.aTexto(t),
  Equals: (m, t, [o]) => igualValor(m, t, o),
  GetHashCode: () => 0,
  CompareTo: (m, t, [o]) => m.comparar(t, o),
  GetType: (m) => m.bib.tipoValor('ValueTuple'),
}

const METODOS_FUNC = {
  Invoke: null,
  GetInvocationList: (m, f) => new Arr('Delegate', f instanceof Multicast ? f.itens.slice() : [f]),
  ToString: () => 'System.Delegate',
  Equals: (m, f, [o]) => f === o,
  GetHashCode: () => 0,
  GetType: (m) => m.bib.tipoValor('Delegate'),
}

export class Biblioteca {
  constructor() {
    this.registro = new Map()
    const r = (nomes, def) => { for (const n of [].concat(nomes)) this.registro.set(n, def) }
    r(['Console'], CONSOLE)
    r(['Math', 'MathF'], MATH)
    r(['Convert'], CONVERT)
    r(['Encoding'], ENCODING)
    r(['BitConverter'], BITCONVERTER)
    r(['string', 'String'], STRING)
    r(['char', 'Char'], CHAR)
    r(['bool', 'Boolean'], BOOL)
    for (const n of NUMERICOS) {
      const def = tipoNumericoNativo(n)
      r(n, def)
    }
    for (const [ap, n] of Object.entries(APELIDOS_NUM)) r(ap, this.registro.get(n))
    r(['Random'], RANDOM)
    r(['StringBuilder'], STRINGBUILDER)
    r(['DateTime'], DATETIME)
    r(['TimeSpan'], TIMESPAN)
    r(['Stopwatch'], STOPWATCH)
    r(['Environment'], ENVIRONMENT)
    r(['Thread'], THREAD)
    r(['GC'], GC)
    r(['Task'], TASK)
    r(['Guid'], GUID)
    r(['Tuple', 'ValueTuple'], TUPLE)
    r(['CultureInfo'], CULTUREINFO)
    r(['Enum'], ENUM)
    r(['BigInteger'], BIGINTEGER)
    r(['File'], FILE)
    r(['Directory'], DIRECTORY)
    r(['Path'], PATH)
    r(['StreamWriter'], STREAMWRITER)
    r(['StreamReader'], STREAMREADER)
    r(['Array'], ARRAY)
    r(['Enumerable'], ENUMERABLE)
    r(['Regex'], REGEX)
    r(['RegexOptions'], REGEXOPTIONS)
    r(['Object', 'object'], OBJECT)
    r(['Interlocked'], INTERLOCKED)
    r(['Debug', 'Trace'], DEBUG)
    r(['Lazy'], { nome: 'Lazy', criar: (m, a) => new LazyCS(a[0]), const: {}, estatico: {} })
    for (const [n, d] of Object.entries(TIPOS_COLECAO)) r(n, d)
    for (const [n, d] of Object.entries(DELEGADOS)) r(n, d)
    this.linq = { lista: (m, itens) => new SeqCS(() => itens[Symbol.iterator](), 'object') }
    this.datas = { converter: (m, v) => (v instanceof DataCS ? v : DATETIME.estatico.Parse(m, [v])) }
    this.anonimos = new Map()
  }

  // ---- tipos ---------------------------------------------------------------------------------------------

  tipo(nome) { return this.registro.get(nome) ?? null }

  ehNamespace(nome) { return NAMESPACES.has(nome) }

  temEstatico(nat, nome) { return !!(nat.estatico?.[nome] || nat.const?.[nome] !== undefined || nat.props?.[nome]) }

  lerEstatico(m, nat, nome) {
    if (nat.const && Object.prototype.hasOwnProperty.call(nat.const, nome)) return nat.const[nome]
    const p = nat.props?.[nome]
    if (p) return p.get(m)
    const f = nat.estatico?.[nome]
    if (f) return new FuncNativa((m2, a) => f(m2, a, [], null), `${nat.nome}.${nome}`)
    throw new ErroCS(`${nat.nome}.${nome} ainda não existe no MisterALG`, m.linhaAtual, 'O interpretador de C# do MisterALG cobre o que se usa nas aulas, mas não toda a biblioteca do .NET. Confira o nome (maiúsculas contam) ou use outra forma.')
  }

  gravarEstatico(m, nat, nome, v) {
    const p = nat.props?.[nome]
    if (!p?.set) throw new ErroCS(`${nat.nome}.${nome} não pode receber valor`, m.linhaAtual)
    p.set(m, v)
  }

  chamarEstatico(m, nat, nome, args, targs, n) {
    const f = nat.estatico?.[nome]
    if (f) return f(m, args, targs, n)
    const p = nat.props?.[nome]
    if (p) {
      const v = p.get(m)
      if (v?.ehFunc) return new Suspende(m.chamarFuncaoGen(v, args))
    }
    throw new ErroCS(`${nat.nome}.${nome}() ainda não existe no MisterALG`, n?.l ?? m.linhaAtual, 'O interpretador de C# do MisterALG cobre o que se usa nas aulas, mas não toda a biblioteca do .NET. Confira o nome (maiúsculas contam).')
  }

  criar(m, nat, args, targs, tipoStr) {
    return nat.criar(m, args, targs, tipoStr)
  }

  // ---- instâncias ----------------------------------------------------------------------------------------

  tabelaDe(v) {
    if (typeof v === 'string') return { metodos: METODOS_STRING, props: null, fn: PROPS_STRING }
    if (typeof v === 'number' || typeof v === 'bigint' || v instanceof Dbl || v instanceof Flt || v instanceof Dec || v instanceof Num) return { metodos: METODOS_NUMERO }
    if (v instanceof Chr) return { metodos: METODOS_CHAR }
    if (typeof v === 'boolean') return { metodos: METODOS_BOOL }
    if (v instanceof SpanCS) return { metodos: METODOS_SPAN, fn: PROPS_SPAN }
    if (v instanceof Arr) return { metodos: METODOS_ARRAY, fn: PROPS_ARRAY }
    if (v instanceof ValorEnum) return { metodos: METODOS_ENUM }
    if (v instanceof Tupla) return { metodos: METODOS_TUPLA }
    if (v?.ehFunc || v instanceof Multicast) return { metodos: METODOS_FUNC }
    if (v && v.constructor) return { metodos: v.constructor.METODOS, props: v.constructor.PROPS, indice: v.constructor.INDICE }
    return {}
  }

  ehEnumeravel(v) {
    return v instanceof Arr || typeof v === 'string' || (v && typeof v.iterar === 'function') || v instanceof IteradorUsuario
  }

  temMetodo(v, nome) {
    const t = this.tabelaDe(v)
    return !!(t.metodos && t.metodos[nome]) || (this.ehEnumeravel(v) && !!LINQ[nome] && !(typeof v === 'string'))
  }

  chamarInstancia(m, v, nome, args, targs, n) {
    const t = this.tabelaDe(v)
    const f = t.metodos?.[nome]
    if (f) return f(m, v, args, targs, n)
    if (v?.ehFunc || v instanceof Multicast) {
      if (nome === 'Invoke') return new Suspende(m.chamarFuncaoGen(v, args))
    }
    if (this.ehEnumeravel(v) && LINQ[nome]) return LINQ[nome](m, v, args, targs, n)
    // métodos que todo objeto tem
    switch (nome) {
      case 'ToString': return m.aTexto(v, args[0])
      case 'Equals': return igualValor(m, v, args[0])
      case 'GetHashCode': return m.hashDe(v).length | 0
      case 'GetType': return this.tipoValor(m.nomeDoTipoDe(v))
      default:
    }
    throw new ErroCS(`${m.nomeDoTipoDe(v)} não tem o método "${nome}" (ou o MisterALG ainda não o conhece)`, n?.l ?? m.linhaAtual, 'Confira o nome do método (maiúsculas e minúsculas contam) e o tipo da variável. CS1061.')
  }

  /** Métodos de object para objetos do aluno: ToString, Equals, GetHashCode, GetType. */
  ehMetodoObjeto(nome) { return ['ToString', 'Equals', 'GetHashCode', 'GetType', 'MemberwiseClone', 'ReferenceEquals'].includes(nome) }

  chamarObjeto(m, o, nome, args, ehBase, n) {
    switch (nome) {
      case 'ToString':
        if (o.cls.ehRecord && !ehBase) return m.textoRecord(o)
        if (o.cls.ehRecord) return m.textoRecord(o)
        return o.cls.nomeCompleto
      case 'Equals': return ehBase && !o.cls.ehRecord && !o.cls.ehTipoValor ? o === args[0] : m.equalsObjeto(o, args[0])
      case 'GetHashCode': return Math.abs(parseInt(String(m.hashDe(o)).replace(/\D/g, '').slice(0, 9) || '0', 10)) | 0
      case 'GetType': return this.tipoValor(o.cls.nome)
      case 'MemberwiseClone': {
        const c = new Objeto(o.cls)
        for (const [k, v] of o.campos) c.campos.set(k, v)
        return c
      }
      default:
    }
    if (m.acharMetodoVirtual(o.cls, 'GetEnumerator', 0) && LINQ[nome]) return LINQ[nome](m, o, args, [], n)
    throw new ErroCS(`${o.cls.nome} não tem o método "${nome}"`, n?.l ?? m.linhaAtual, 'Confira o nome do método (maiúsculas e minúsculas contam) e se ele existe na classe ou nas classes que ela herda. CS1061.')
  }

  chamarObjetoPropriedade() { return undefined }

  lerPropriedade(m, v, nome) {
    if (v === null || v === undefined) throw m.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    const t = this.tabelaDe(v)
    if (t.fn?.[nome]) return t.fn[nome](m, v)
    const p = t.props?.[nome]
    if (p) return p.get(m, v)
    if (v instanceof Tupla) {
      const i = /^Item(\d+)$/.exec(nome)
      if (i) return v.itens[Number(i[1]) - 1]
      const k = v.nomes?.indexOf(nome) ?? -1
      if (k >= 0) return v.itens[k]
    }
    if (v && v.Key !== undefined && nome === 'Key') return v.Key
    if (t.metodos?.[nome] || (this.ehEnumeravel(v) && LINQ[nome])) return new FuncNativa((m2, a) => this.chamarInstancia(m2, v, nome, a, [], null), nome)
    if (v?.ehFunc && (nome === 'Method' || nome === 'Target')) return null
    throw new ErroCS(`${m.nomeDoTipoDe(v)} não tem um membro chamado "${nome}" (ou o MisterALG ainda não o conhece)`, m.linhaAtual, 'Confira o nome (maiúsculas e minúsculas contam) e o tipo da variável. CS1061.')
  }

  gravarPropriedade(m, v, nome, valor) {
    const t = this.tabelaDe(v)
    const p = t.props?.[nome]
    if (!p?.set) throw new ErroCS(`${m.nomeDoTipoDe(v)}.${nome} não pode receber valor`, m.linhaAtual)
    p.set(m, v, valor)
  }

  indexar(m, v, args) {
    args = this.indiceDoFim(v, args)
    const t = this.tabelaDe(v)
    if (t.indice?.get) return t.indice.get(m, v, args)
    throw new ErroCS(`${m.nomeDoTipoDe(v)} não tem indexador ([ ])`, m.linhaAtual, 'Só arrays, textos, listas, dicionários e classes com this[...] aceitam colchetes. CS0021.')
  }

  /** lista[^1]: o índice a partir do fim vira a posição. */
  indiceDoFim(v, args) {
    if (args.length !== 1 || !(args[0] instanceof Indice)) return args
    const n = v?.itens?.length ?? v?.s?.length
    return n === undefined ? args : [args[0].em(n)]
  }

  gravarIndice(m, v, args, valor) {
    args = this.indiceDoFim(v, args)
    const t = this.tabelaDe(v)
    if (t.indice?.set) return t.indice.set(m, v, args, valor)
    throw new ErroCS(`${m.nomeDoTipoDe(v)} não aceita atribuição com [ ]`, m.linhaAtual)
  }

  // ---- tipos em execução -------------------------------------------------------------------------------------

  ehTipoNativo(v, nome, args = []) {
    switch (nome) {
      case 'List': case 'IList': case 'ICollection': case 'IReadOnlyList': case 'IReadOnlyCollection': return v instanceof ListaCS || (nome === 'ICollection' && v instanceof Arr)
      case 'IEnumerable': return this.ehEnumeravel(v)
      case 'Dictionary': case 'IDictionary': case 'IReadOnlyDictionary': case 'SortedDictionary': return v instanceof DictCS
      case 'HashSet': case 'ISet': case 'SortedSet': return v instanceof ConjuntoCS
      case 'Queue': return v instanceof FilaCS
      case 'Stack': return v instanceof PilhaCS
      case 'LinkedList': return v instanceof LigadaCS
      case 'StringBuilder': return v instanceof SbCS
      case 'DateTime': return v instanceof DataCS
      case 'TimeSpan': return v instanceof TempoCS
      case 'Random': return v instanceof AleatorioCS
      case 'Guid': return v instanceof GuidCS
      case 'Stopwatch': return v instanceof CronometroCS
      case 'Task': return v instanceof TarefaCS
      case 'BigInteger': return v instanceof BigCS
      case 'Array': return v instanceof Arr && !(v instanceof SpanCS)
      case 'Span': return v instanceof SpanCS && !v.ro
      case 'ReadOnlySpan': return v instanceof SpanCS
      case 'Func': case 'Action': case 'Predicate': case 'Comparison': case 'Delegate': case 'EventHandler': return !!v?.ehFunc || v instanceof Multicast
      case 'Tuple': case 'ValueTuple': return v instanceof Tupla
      case 'ValueType': return ehNumero(v) || typeof v === 'boolean' || v instanceof ValorEnum || v instanceof Tupla
      case 'IComparable': return ehNumero(v) || typeof v === 'string' || typeof v === 'boolean' || v instanceof ValorEnum
      case 'Regex': return v instanceof RegexCS
      case 'IDisposable': return typeof v?.Dispose === 'function'
      case 'Type': return v instanceof TipoCS
      case 'CultureInfo': return v instanceof CulturaCS
      default: void args; return false
    }
  }

  combinaNativo(v, t) {
    const { nome } = partesGenericas(semNulo(t))
    // array e texto convertem sozinhos para Span/ReadOnlySpan (o texto só para ReadOnlySpan)
    if (nome === 'Span' || nome === 'ReadOnlySpan') return this.ehTipoNativo(v, nome) ? 4 : v instanceof Arr || (nome === 'ReadOnlySpan' && typeof v === 'string') ? 3 : -1
    const conhecidos = ['List', 'IList', 'ICollection', 'IEnumerable', 'Dictionary', 'IDictionary', 'HashSet', 'Queue', 'Stack', 'LinkedList', 'StringBuilder', 'DateTime', 'TimeSpan', 'Random', 'Guid', 'Task', 'BigInteger', 'Array', 'Func', 'Action', 'Predicate', 'Comparison', 'Delegate', 'Tuple', 'ValueTuple', 'ValueType', 'IComparable', 'IReadOnlyList', 'ISet', 'SortedSet', 'SortedDictionary', 'Regex', 'Type', 'CultureInfo', 'Stopwatch', 'EventHandler']
    if (!conhecidos.includes(nome)) return undefined
    return this.ehTipoNativo(v, nome) ? 4 : -1
  }

  coagirNativo(v, t) {
    const { nome } = partesGenericas(t)
    if ((nome === 'Span' || nome === 'ReadOnlySpan') && (v instanceof Arr || typeof v === 'string')) {
      const ro = nome === 'ReadOnlySpan'
      if (v instanceof SpanCS && v.ro === ro) return v
      return typeof v === 'string' ? SpanCS.deTexto(v) : SpanCS.de(v, 0, v.itens.length, ro)
    }
    if (t === 'BigInteger' && ehNumero(v)) return new BigCS(BigInt(Math.trunc(Number(tipoNumerico(v) === 'long' ? v : v instanceof Dbl || v instanceof Flt ? v.v : v instanceof Dec ? Number(v.u) / 10 ** v.s : v.v ?? v.c ?? v))))
    return undefined
  }

  // ---- fábricas usadas pela máquina ---------------------------------------------------------------------------

  tipoValor(nome) { return new TipoCS(nome) }

  criarFuncaoDeMetodo(md, este) { return new FuncMetodo(md, este) }

  criarGrupo(nome, lista, este) { return new FuncGrupo(nome, lista, este) }

  novaTupla(itens, nomes = null) { return new Tupla(itens, nomes) }

  novoArray(tipo, itens) { return new Arr(tipo, itens) }

  novoSpan(arr, ro = false) { return SpanCS.de(arr, 0, arr.itens.length, ro) }

  criarTarefa(v) { return new TarefaCS(v) }

  criarTarefaFalha(e) { return new TarefaCS(null, e) }

  esperar(m, v) { return esperar(m, v) }

  criarAgrupamento(k, itens) { return new AgrupamentoCS(k, itens) }

  somar(m, a, b) { return binario(m, '+', a, b) }

  dividir(m, a, n) { return binario(m, '/', a, n) }

  /** new { Nome = "x", Idade = 3 }: um record sem nome, comparado pelos campos. */
  criarAnonimo(m, campos) {
    const chave = campos.map(([k]) => k).join(',')
    let def = this.anonimos.get(chave)
    if (!def) {
      def = new ClasseDef('<anonimo>', 'record', '', null)
      def.anonima = true
      def.resolvida = true
      def.recordParams = campos.map(([k]) => ({ nome: k, tipo: 'var' }))
      this.anonimos.set(chave, def)
    }
    const o = new Objeto(def)
    for (const [k, v] of campos) o.campos.set(k, v)
    return o
  }
}

export { Ref, ListaCS, NoCS, PrioridadeCS, OrdenadaCS, MatchCS, GrupoCS, ColecaoMatchesCS, ThreadAtualCS, TeclaCS, FluxoConsoleCS, LeitorCS, EscritorCS, DirectoryDummy }
function DirectoryDummy() {}
