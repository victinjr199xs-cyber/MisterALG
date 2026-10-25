// Span<T> e ReadOnlySpan<T> sobre arrays: uma "janela" [off, off+len) que enxerga o mesmo armazenamento do array
// (escrever no span escreve no array). É um Arr cujo `itens` é um Proxy, então indexador, foreach, Length, LINQ e
// string.Join funcionam sem código novo. stackalloc int[n] vira um Span<int> sobre um array novo zerado.

import { igualValor } from '../operadores.js'
import { Arr, Chr } from '../valores.js'

const ehIndice = (k) => typeof k === 'string' && /^(0|[1-9]\d*)$/.test(k)

function janela(base, off, len) {
  return new Proxy([], {
    get(_, k, r) {
      if (k === 'length') return len
      if (ehIndice(k)) return Number(k) < len ? base.itens[off + Number(k)] : undefined
      return Reflect.get(Array.prototype, k, r)
    },
    set(_, k, v) {
      if (ehIndice(k) && Number(k) < len) base.itens[off + Number(k)] = v
      return true
    },
    has: (_, k) => (ehIndice(k) ? Number(k) < len : k in Array.prototype),
  })
}

export class SpanCS extends Arr {
  constructor(base, off, len, ro = false) {
    super(base.tipoElem, janela(base, off, len))
    this.base = base
    this.off = off
    this.len = len
    this.ro = ro
  }

  /** Uma janela de `a` (array ou outro span) a partir de `ini`, com `n` itens. */
  static de(a, ini = 0, n = a.itens.length - ini, ro = false) {
    return a instanceof SpanCS ? new SpanCS(a.base, a.off + ini, n, ro) : new SpanCS(a, ini, n, ro)
  }

  /** ReadOnlySpan<char> de um texto (cópia: o texto não muda). */
  static deTexto(s, ini = 0, n = s.length - ini) {
    return new SpanCS(new Arr('char', [...s.slice(ini, ini + n)].map((c) => new Chr(c.charCodeAt(0)))), 0, n, true)
  }

  nomeCS() { return `${this.ro ? 'ReadOnlySpan' : 'Span'}<${this.tipoElem}>` }

  paraTexto() {
    if (this.tipoElem === 'char') return this.itens.map((c) => String.fromCharCode(c.c)).join('')
    return `System.${this.ro ? 'ReadOnlySpan' : 'Span'}<${NOMES[this.tipoElem] ?? this.tipoElem}>[${this.len}]`
  }
}
const NOMES = { int: 'Int32', long: 'Int64', short: 'Int16', byte: 'Byte', sbyte: 'SByte', ushort: 'UInt16', uint: 'UInt32', ulong: 'UInt64', double: 'Double', float: 'Single', decimal: 'Decimal', bool: 'Boolean', char: 'Char', string: 'String', object: 'Object' }

const fora = (m) => m.excecao('ArgumentOutOfRangeException', 'Specified argument was out of the range of valid values.')

/** Confere [ini, ini+n) dentro de len e devolve o n (o resto, se omitido). */
export function intervalo(m, len, ini, n) {
  n ??= len - ini
  if (ini < 0 || n < 0 || ini + n > len) throw fora(m)
  return n
}

const destino = (m, d, n) => {
  if (d.itens.length < n) throw m.excecao('ArgumentException', "Destination is too short. (Parameter 'destination')")
}

export const METODOS_SPAN = {
  Slice(m, s, [ini, n]) { return SpanCS.de(s, ini, intervalo(m, s.len, ini, n), s.ro) },
  ToArray: (m, s) => new Arr(s.tipoElem, s.itens.slice()),
  Fill(m, s, [v]) { s.itens.fill(m.coagir(v, s.tipoElem)); return null },
  Clear(m, s) { s.itens.fill(m.valorPadrao(s.tipoElem)); return null },
  CopyTo(m, s, [d]) { destino(m, d, s.len); s.itens.forEach((x, i) => { d.itens[i] = x }); return null },
  TryCopyTo(m, s, [d]) {
    if (d.itens.length < s.len) return false
    s.itens.forEach((x, i) => { d.itens[i] = x })
    return true
  },
  Reverse(m, s) {
    const r = s.itens.slice().reverse()
    r.forEach((x, i) => { s.itens[i] = x })
    return null
  },
  Sort(m, s) {
    const r = s.itens.slice().sort((a, b) => m.comparar(a, b))
    r.forEach((x, i) => { s.itens[i] = x })
    return null
  },
  IndexOf: (m, s, [v]) => s.itens.findIndex((x) => igualValor(m, x, v)),
  Contains: (m, s, [v]) => s.itens.some((x) => igualValor(m, x, v)),
  SequenceEqual: (m, s, [o]) => s.len === o.itens.length && s.itens.every((x, i) => igualValor(m, x, o.itens[i])),
  StartsWith: (m, s, [o]) => o.itens.length <= s.len && o.itens.every((x, i) => igualValor(m, x, s.itens[i])),
  EndsWith: (m, s, [o]) => o.itens.length <= s.len && o.itens.every((x, i) => igualValor(m, x, s.itens[s.len - o.itens.length + i])),
  ToString: (m, s) => m.aTexto(s),
  Equals: (m, s, [o]) => o instanceof SpanCS && o.base === s.base && o.off === s.off && o.len === s.len,
  GetHashCode: (m, s) => s.len,
  GetType: (m, s) => m.bib.tipoValor(s.nomeCS()),
}

export const PROPS_SPAN = {
  Length: (m, s) => s.len,
  IsEmpty: (m, s) => s.len === 0,
}
