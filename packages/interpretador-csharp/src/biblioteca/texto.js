// Textos: string, char, StringBuilder e bool.

import { Arr, Chr, Dbl, Num, comoNumero } from '../valores.js'
import { ErroCS } from '../erros.js'
import { Multicast } from '../operadores.js'

const chr = (c) => new Chr(c.charCodeAt(0))
/** ToUpper/ToLower do .NET trocam letra por letra (ß continua ß); o do JavaScript também troca uma por duas (ß → SS). */
const caixaSimples = (s, f) => { let r = ''; for (const c of s) { const x = f(c); r += [...x].length === 1 ? x : c } return r }
const letra = (v) => (v instanceof Chr ? String.fromCharCode(v.c) : String(v))
const txtDe = (m, v) => (typeof v === 'string' ? v : v instanceof Chr ? String.fromCharCode(v.c) : m.aTexto(v))
const chars = (a) => (a instanceof Arr ? a.itens.map(letra) : [letra(a)])
const novoArrayTexto = (itens) => new Arr('string', itens)

function comparacao(c) {
  const nome = c?.nome ?? ''
  return { ignorar: /IgnoreCase/.test(nome), ordinal: /Ordinal/.test(nome) }
}

/** Procura em lista de chars/strings (Trim, IndexOfAny, Split...). */
const emConjunto = (conjunto) => (ch) => conjunto.includes(ch)

function argsComoLista(args) {
  if (args.length === 1 && args[0] instanceof Arr) return args[0].itens
  return args
}

function dividir(m, s, args) {
  let separadores = []
  let opcoes = 0
  let limite = Infinity
  for (const a of args) {
    if (a instanceof Chr || typeof a === 'string') separadores.push(letra(a))
    else if (a instanceof Arr) separadores.push(...a.itens.map(letra))
    else if (a && a.def && a.def.nome === 'StringSplitOptions') opcoes = a.v
    else if (typeof a === 'number') limite = a
  }
  separadores = separadores.filter((x) => x !== '')
  let partes
  if (!separadores.length) partes = s.split(/\s+/)
  else {
    partes = []
    let atual = ''
    for (let i = 0; i < s.length;) {
      const achou = separadores.find((sep) => s.startsWith(sep, i))
      if (achou && partes.length < limite - 1) {
        partes.push(atual)
        atual = ''
        i += achou.length
      } else {
        atual += s[i]
        i += 1
      }
    }
    partes.push(atual)
  }
  if (opcoes & 2) partes = partes.map((x) => x.trim())
  if (opcoes & 1) partes = partes.filter((x) => x !== '')
  return novoArrayTexto(partes)
}

function foraDoIntervalo(m, msg, param) {
  return m.excecao('ArgumentOutOfRangeException', `${msg}${param ? ` (Parameter '${param}')` : ''}`)
}

export const METODOS_STRING = {
  Substring(m, s, [i, n]) {
    if (i < 0 || i > s.length) throw foraDoIntervalo(m, 'startIndex cannot be larger than length of string.', 'startIndex')
    if (n === undefined) return s.slice(i)
    if (n < 0 || i + n > s.length) throw foraDoIntervalo(m, 'Index and length must refer to a location within the string.', 'length')
    return s.substr(i, n)
  },
  IndexOf(m, s, [x, a, b]) {
    const inicio = typeof a === 'number' ? a : 0
    const cmp = [a, b].find((y) => y && y.def)
    if (inicio > s.length) throw foraDoIntervalo(m, 'Index was out of range. Must be non-negative and less than or equal to the size of the collection.', 'startIndex')
    const ig = comparacao(cmp).ignorar
    return ig ? s.toLowerCase().indexOf(txtDe(m, x).toLowerCase(), inicio) : s.indexOf(txtDe(m, x), inicio)
  },
  LastIndexOf: (m, s, [x, a]) => (typeof a === 'number' ? s.lastIndexOf(txtDe(m, x), a) : s.lastIndexOf(txtDe(m, x))),
  IndexOfAny: (m, s, [a, i = 0]) => {
    const conj = chars(a)
    for (let k = i; k < s.length; k += 1) if (conj.includes(s[k])) return k
    return -1
  },
  LastIndexOfAny: (m, s, [a]) => {
    const conj = chars(a)
    for (let k = s.length - 1; k >= 0; k -= 1) if (conj.includes(s[k])) return k
    return -1
  },
  Contains(m, s, [x, c]) {
    const { ignorar } = comparacao(c)
    return ignorar ? s.toLowerCase().includes(txtDe(m, x).toLowerCase()) : s.includes(txtDe(m, x))
  },
  StartsWith(m, s, [x, c]) {
    const { ignorar } = comparacao(c && c.def ? c : null)
    const t = txtDe(m, x)
    return ignorar ? s.toLowerCase().startsWith(t.toLowerCase()) : s.startsWith(t)
  },
  EndsWith(m, s, [x, c]) {
    const { ignorar } = comparacao(c && c.def ? c : null)
    const t = txtDe(m, x)
    return ignorar ? s.toLowerCase().endsWith(t.toLowerCase()) : s.endsWith(t)
  },
  __U8: (m, s) => m.bib.novoArray('byte', [...new TextEncoder().encode(s)].map((b) => new Num('byte', b))), // "abc"u8 (preprocessar.js)
  ToUpper: (m, s) => caixaSimples(s, (c) => c.toLocaleUpperCase('pt-BR')),
  ToLower: (m, s) => caixaSimples(s, (c) => c.toLocaleLowerCase('pt-BR')),
  ToUpperInvariant: (m, s) => caixaSimples(s, (c) => c.toUpperCase()),
  ToLowerInvariant: (m, s) => caixaSimples(s, (c) => c.toLowerCase()),
  Trim(m, s, args) {
    if (!args.length) return s.trim()
    const c = emConjunto(argsComoLista(args).map(letra))
    let i = 0
    let f = s.length
    while (i < f && c(s[i])) i += 1
    while (f > i && c(s[f - 1])) f -= 1
    return s.slice(i, f)
  },
  TrimStart(m, s, args) {
    if (!args.length) return s.trimStart()
    const c = emConjunto(argsComoLista(args).map(letra))
    let i = 0
    while (i < s.length && c(s[i])) i += 1
    return s.slice(i)
  },
  TrimEnd(m, s, args) {
    if (!args.length) return s.trimEnd()
    const c = emConjunto(argsComoLista(args).map(letra))
    let f = s.length
    while (f > 0 && c(s[f - 1])) f -= 1
    return s.slice(0, f)
  },
  PadLeft: (m, s, [w, c]) => s.padStart(w, c ? letra(c) : ' '),
  PadRight: (m, s, [w, c]) => s.padEnd(w, c ? letra(c) : ' '),
  Replace(m, s, [a, b, c]) {
    const de = txtDe(m, a)
    if (de === '') throw m.excecao('ArgumentException', "String cannot be of zero length. (Parameter 'oldValue')")
    const para = b === null || b === undefined ? '' : txtDe(m, b)
    const ig = (c === true) || (c && c.def && comparacao(c).ignorar)
    if (ig) return s.replace(new RegExp(de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), () => para)
    return s.split(de).join(para)
  },
  Insert(m, s, [i, t]) {
    if (i < 0 || i > s.length) throw foraDoIntervalo(m, 'Index was out of range. Must be non-negative and less than or equal to the size of the collection.', 'startIndex')
    return s.slice(0, i) + t + s.slice(i)
  },
  Remove(m, s, [i, n]) {
    if (i < 0 || i > s.length) throw foraDoIntervalo(m, 'startIndex must be less than length of string.', 'startIndex')
    if (n === undefined) return s.slice(0, i)
    if (n < 0 || i + n > s.length) throw foraDoIntervalo(m, 'Count must be positive and count must refer to a location within the string/array/collection.', 'count')
    return s.slice(0, i) + s.slice(i + n)
  },
  Split: (m, s, args) => dividir(m, s, args),
  ToCharArray: (m, s) => new Arr('char', [...s].map(chr)),
  Equals(m, s, [o, c]) {
    if (typeof o !== 'string') return false
    return comparacao(c).ignorar ? s.toLowerCase() === o.toLowerCase() : s === o
  },
  CompareTo: (m, s, [o]) => (o === null ? 1 : m.compararTextos(s, o)),
  GetHashCode: (m, s) => {
    let h = 0
    for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
    return h
  },
  ToString: (m, s) => s,
  Clone: (m, s) => s,
  Normalize: (m, s) => s.normalize(),
  IsNormalized: () => true,
  Length: undefined,
  GetType: (m) => m.bib.tipoValor('string'),
  EnumerateRunes: (m, s) => new Arr('char', [...s].map(chr)),
  CopyTo: () => null,
}
delete METODOS_STRING.Length

export const PROPS_STRING = {
  Length: (m, s) => s.length,
  Chars: (m, s) => s,
}

export const STRING = {
  nome: 'String',
  const: { Empty: '' },
  criar(m, args) {
    const [a, n] = args
    if (args.length === 0) return ''
    if (a instanceof Chr) return String.fromCharCode(a.c).repeat(n)
    if (a instanceof Arr) return a.itens.map(letra).join('')
    return String(a)
  },
  estatico: {
    IsNullOrEmpty: (m, [s]) => s === null || s === undefined || s === '',
    IsNullOrWhiteSpace: (m, [s]) => s === null || s === undefined || s.trim() === '',
    Join(m, [sep, ...resto]) {
      const separador = txtDe(m, sep)
      let itens
      if (resto.length === 1 && m.ehColecao(resto[0])) itens = [...m.iterarSync(resto[0])]
      else itens = resto
      return itens.map((x) => (x === null || x === undefined ? '' : m.aTexto(x))).join(separador)
    },
    Concat(m, args) {
      const itens = args.length === 1 && m.ehColecao(args[0]) ? [...m.iterarSync(args[0])] : args
      return itens.map((x) => m.aTexto(x)).join('')
    },
    Format(m, [fmt, ...resto]) {
      // string.Format(IFormatProvider, formato, args): formata na cultura dada
      const cultura = fmt && typeof fmt === 'object' && fmt.cultura && typeof fmt.cultura.decimal === 'string' ? fmt.cultura : null
      if (cultura) [fmt, ...resto] = resto
      const antiga = m.cultura
      if (cultura) m.cultura = cultura
      try {
        if (resto.length === 1 && resto[0] instanceof Arr && resto[0].tipoElem !== 'char') return m.formatar(fmt, resto[0].itens)
        return m.formatar(fmt, resto)
      } finally {
        m.cultura = antiga
      }
    },
    Compare(m, [a, b, c]) {
      if (a === null) return b === null ? 0 : -1
      if (b === null) return 1
      const ig = c === true || (c && c.def && comparacao(c).ignorar)
      return m.compararTextos(ig ? a.toLowerCase() : a, ig ? b.toLowerCase() : b)
    },
    CompareOrdinal: (m, [a, b]) => { // (o .NET devolve a diferença entre os primeiros caracteres diferentes)
      if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1
      const n = Math.min(a.length, b.length)
      for (let i = 0; i < n; i += 1) if (a.charCodeAt(i) !== b.charCodeAt(i)) return a.charCodeAt(i) - b.charCodeAt(i)
      return a.length - b.length
    },
    Equals: (m, [a, b, c]) => (a === null || b === null ? a === b : comparacao(c).ignorar ? a.toLowerCase() === b.toLowerCase() : a === b),
    Copy: (m, [s]) => s,
    Intern: (m, [s]) => s,
    IsInterned: (m, [s]) => s,
  },
}

// ---- char --------------------------------------------------------------------------------------------------

const cod = (v) => (v instanceof Chr ? v.c : typeof v === 'string' ? v.charCodeAt(0) : comoNumero(v))
const alvo = (a) => (typeof a[0] === 'string' && a.length === 2 ? a[0].charCodeAt(a[1]) : cod(a[0]))
const ch = (a) => String.fromCharCode(alvo(a))

export const CHAR = {
  nome: 'Char',
  const: { MaxValue: new Chr(0xffff), MinValue: new Chr(0) },
  estatico: {
    IsDigit: (m, a) => /\p{Nd}/u.test(ch(a)),
    IsNumber: (m, a) => /\p{N}/u.test(ch(a)),
    IsLetter: (m, a) => /\p{L}/u.test(ch(a)),
    IsLetterOrDigit: (m, a) => /[\p{L}\p{Nd}]/u.test(ch(a)),
    IsUpper: (m, a) => /\p{Lu}/u.test(ch(a)),
    IsLower: (m, a) => /\p{Ll}/u.test(ch(a)),
    IsWhiteSpace: (m, a) => /\s/.test(ch(a)),
    IsPunctuation: (m, a) => /\p{P}/u.test(ch(a)),
    IsSymbol: (m, a) => /\p{S}/u.test(ch(a)),
    IsControl: (m, a) => alvo(a) < 32 || (alvo(a) >= 127 && alvo(a) < 160),
    IsSeparator: (m, a) => /\p{Z}/u.test(ch(a)),
    IsAscii: (m, a) => alvo(a) < 128,
    IsAsciiDigit: (m, a) => /[0-9]/.test(ch(a)),
    IsAsciiLetter: (m, a) => /[A-Za-z]/.test(ch(a)),
    ToUpper: (m, [c]) => chr(String.fromCharCode(cod(c)).toLocaleUpperCase('pt-BR')),
    ToLower: (m, [c]) => chr(String.fromCharCode(cod(c)).toLocaleLowerCase('pt-BR')),
    ToUpperInvariant: (m, [c]) => chr(String.fromCharCode(cod(c)).toUpperCase()),
    ToLowerInvariant: (m, [c]) => chr(String.fromCharCode(cod(c)).toLowerCase()),
    ToString: (m, [c]) => String.fromCharCode(cod(c)),
    GetNumericValue: (m, a) => new Dbl(/\d/.test(ch(a)) ? Number(ch(a)) : -1),
    Parse: (m, [s]) => {
      if (s.length !== 1) throw m.excecao('FormatException', 'String must be exactly one character long.')
      return chr(s)
    },
    TryParse: (m, [s, saida]) => {
      if (typeof s !== 'string' || s.length !== 1) {
        saida.v = new Chr(0)
        return false
      }
      saida.v = chr(s)
      return true
    },
    ConvertFromUtf32: (m, [n]) => String.fromCodePoint(n),
    ConvertToUtf32: (m, [s]) => s.codePointAt(0),
  },
}

export const METODOS_CHAR = {
  ToString: (m, c) => String.fromCharCode(c.c),
  CompareTo: (m, c, [o]) => c.c - cod(o),
  Equals: (m, c, [o]) => o instanceof Chr && o.c === c.c,
  GetHashCode: (m, c) => c.c | (c.c << 16),
  GetType: (m) => m.bib.tipoValor('char'),
}

// ---- bool -----------------------------------------------------------------------------------------------------

export const BOOL = {
  nome: 'Boolean',
  const: { TrueString: 'True', FalseString: 'False' },
  estatico: {
    Parse(m, [s]) {
      if (/^\s*true\s*$/i.test(s)) return true
      if (/^\s*false\s*$/i.test(s)) return false
      throw m.excecao('FormatException', `String '${s}' was not recognized as a valid Boolean.`)
    },
    TryParse(m, [s, saida]) {
      if (/^\s*true\s*$/i.test(s)) saida.v = true
      else if (/^\s*false\s*$/i.test(s)) saida.v = false
      else {
        saida.v = false
        return false
      }
      return true
    },
  },
}

export const METODOS_BOOL = {
  ToString: (m, b) => (b ? 'True' : 'False'),
  Equals: (m, b, [o]) => b === o,
  CompareTo: (m, b, [o]) => (b === o ? 0 : b ? 1 : -1),
  GetHashCode: (m, b) => (b ? 1 : 0),
  GetType: (m) => m.bib.tipoValor('bool'),
}

// ---- StringBuilder -----------------------------------------------------------------------------------------------

export class SbCS {
  constructor(s = '') { this.s = s }

  nomeCS() { return 'StringBuilder' }

  paraTexto() { return this.s }

  iterar() { return [...this.s].map(chr)[Symbol.iterator]() }
}

const adicionar = (m, o, v, n) => {
  const t = v instanceof Arr && v.tipoElem === 'char' ? v.itens.map(letra).join('') : txtDe(m, v)
  o.s += n === undefined ? t : t.repeat(n)
  return o
}

SbCS.METODOS = {
  Append: (m, o, [v, n]) => adicionar(m, o, v, typeof n === 'number' ? n : undefined),
  AppendLine(m, o, [v]) {
    if (v !== undefined) adicionar(m, o, v)
    o.s += '\n'
    return o
  },
  AppendFormat: (m, o, [fmt, ...resto]) => {
    o.s += m.formatar(fmt, resto.length === 1 && resto[0] instanceof Arr ? resto[0].itens : resto)
    return o
  },
  Insert(m, o, [i, v]) {
    if (i < 0 || i > o.s.length) throw foraDoIntervalo(m, 'Index was out of range. Must be non-negative and less than or equal to the size of the collection.', 'index')
    o.s = o.s.slice(0, i) + txtDe(m, v) + o.s.slice(i)
    return o
  },
  Remove(m, o, [i, n]) {
    if (i < 0 || n < 0 || i + n > o.s.length) throw foraDoIntervalo(m, 'Index was out of range. Must be non-negative and less than or equal to the size of the collection.', 'length')
    o.s = o.s.slice(0, i) + o.s.slice(i + n)
    return o
  },
  Replace(m, o, [a, b]) {
    o.s = o.s.split(txtDe(m, a)).join(txtDe(m, b))
    return o
  },
  Clear(m, o) {
    o.s = ''
    return o
  },
  ToString: (m, o, [i, n]) => (i === undefined ? o.s : o.s.substr(i, n)),
  EnsureCapacity: (m, o, [n]) => n,
  Equals: (m, o, [x]) => x instanceof SbCS && x.s === o.s,
  GetHashCode: () => 0,
  GetType: (m) => m.bib.tipoValor('StringBuilder'),
}

SbCS.PROPS = {
  Length: { get: (m, o) => o.s.length, set: (m, o, v) => { o.s = v <= o.s.length ? o.s.slice(0, v) : o.s.padEnd(v, '\0') } },
  Capacity: { get: (m, o) => Math.max(16, o.s.length) },
}

SbCS.INDICE = {
  get(m, o, [i]) {
    if (i < 0 || i >= o.s.length) throw m.excecao('IndexOutOfRangeException', 'Index was outside the bounds of the array.')
    return chr(o.s[i])
  },
  set(m, o, [i], v) {
    if (i < 0 || i >= o.s.length) throw m.excecao('IndexOutOfRangeException', 'Index was outside the bounds of the array.')
    o.s = o.s.slice(0, i) + letra(v) + o.s.slice(i + 1)
  },
}

export const STRINGBUILDER = {
  nome: 'StringBuilder',
  criar: (m, args) => new SbCS(typeof args[0] === 'string' ? args[0] : ''),
  const: {},
  estatico: {},
}

export { Multicast, ErroCS, chr, letra, txtDe }
