// System.Text.RegularExpressions, com o RegExp do JavaScript (as expressões comuns são iguais nas duas linguagens).

import { Arr } from '../valores.js'

const OPCOES = { None: 0, IgnoreCase: 1, Multiline: 2, ExplicitCapture: 4, Compiled: 8, Singleline: 16, IgnorePatternWhitespace: 32, RightToLeft: 64, ECMAScript: 256, CultureInvariant: 512 }

function traduzir(padrao, opcoes = 0) {
  let p = String(padrao)
    .replace(/\\A/g, '^')
    .replace(/\\[zZ]/g, '$')
    .replace(/\(\?<([A-Za-z_]\w*)>/g, '(?<$1>')
    .replace(/\\p\{IsLatin1Supplement\}/g, '[\\u00A0-\\u00FF]')
  let flags = 'gu'
  if (opcoes & OPCOES.IgnoreCase) flags += 'i'
  if (opcoes & OPCOES.Multiline) flags += 'm'
  if (opcoes & OPCOES.Singleline) flags += 's'
  if (opcoes & OPCOES.IgnorePatternWhitespace) p = p.replace(/\s+|#.*$/gm, '')
  try {
    return new RegExp(p, flags)
  } catch {
    try {
      return new RegExp(p, flags.replace('u', ''))
    } catch (e) {
      const err = new Error(`Invalid pattern '${padrao}'. ${e.message}`)
      err.csExcecao = 'ArgumentException'
      throw err
    }
  }
}

export class GrupoCS {
  constructor(sucesso, valor, indice, nome = '') { this.sucesso = sucesso; this.valor = valor ?? ''; this.indice = indice ?? 0; this.nome = nome }

  nomeCS() { return 'Group' }

  paraTexto() { return this.valor }
}
GrupoCS.PROPS = {
  Success: { get: (m, g) => g.sucesso },
  Value: { get: (m, g) => g.valor },
  Index: { get: (m, g) => g.indice },
  Length: { get: (m, g) => g.valor.length },
  Name: { get: (m, g) => g.nome },
}
GrupoCS.METODOS = { ToString: (m, g) => g.valor }

class GruposCS {
  constructor(m) { this.m = m }

  nomeCS() { return 'GroupCollection' }

  iterar() { return this.m.grupos()[Symbol.iterator]() }
}
GruposCS.PROPS = { Count: { get: (m, g) => g.m.grupos().length } }
GruposCS.METODOS = {}
GruposCS.INDICE = {
  get(m, g, [i]) {
    const lista = g.m.grupos()
    if (typeof i === 'string') return lista.find((x) => x.nome === i) ?? new GrupoCS(false, '', 0, i)
    return lista[i] ?? new GrupoCS(false, '', 0)
  },
}

export class MatchCS {
  constructor(r, texto, regex) { this.r = r; this.texto = texto; this.regex = regex }

  nomeCS() { return 'Match' }

  paraTexto() { return this.r ? this.r[0] : '' }

  grupos() {
    if (!this.r) return [new GrupoCS(false, '', 0, '0')]
    const lista = [new GrupoCS(true, this.r[0], this.r.index, '0')]
    const nomes = this.r.groups ? Object.keys(this.r.groups) : []
    for (let i = 1; i < this.r.length; i += 1) {
      const nome = nomes.find((n) => this.r.groups[n] === this.r[i]) ?? String(i)
      lista.push(new GrupoCS(this.r[i] !== undefined, this.r[i], this.r.index + (this.r[0].indexOf(this.r[i] ?? '') >= 0 ? this.r[0].indexOf(this.r[i] ?? '') : 0), nome))
    }
    return lista
  }
}
MatchCS.PROPS = {
  Success: { get: (m, o) => !!o.r },
  Value: { get: (m, o) => (o.r ? o.r[0] : '') },
  Index: { get: (m, o) => (o.r ? o.r.index : 0) },
  Length: { get: (m, o) => (o.r ? o.r[0].length : 0) },
  Groups: { get: (m, o) => new GruposCS(o) },
}
MatchCS.METODOS = {
  NextMatch(m, o) {
    const re = o.regex
    re.lastIndex = o.r ? o.r.index + Math.max(1, o.r[0].length) : o.texto.length
    return new MatchCS(re.exec(o.texto), o.texto, re)
  },
  ToString: (m, o) => (o.r ? o.r[0] : ''),
}

export class ColecaoMatchesCS {
  constructor(itens) { this.itens = itens }

  nomeCS() { return 'MatchCollection' }

  iterar() { return this.itens[Symbol.iterator]() }
}
ColecaoMatchesCS.PROPS = { Count: { get: (m, c) => c.itens.length } }
ColecaoMatchesCS.METODOS = {}
ColecaoMatchesCS.INDICE = { get: (m, c, [i]) => c.itens[i] }

function todos(re, texto) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
  const itens = []
  let x = r.exec(texto)
  while (x) {
    itens.push(new MatchCS(x, texto, new RegExp(r.source, r.flags)))
    if (x[0] === '') r.lastIndex += 1
    x = r.exec(texto)
  }
  return itens
}

const primeiro = (re, texto) => {
  const r = new RegExp(re.source, re.flags)
  r.lastIndex = 0
  const x = r.exec(texto)
  return new MatchCS(x, texto, r)
}

function substituir(m, re, texto, subst, max) {
  const r = new RegExp(re.source, re.flags)
  let n = 0
  return texto.replace(r, (...a) => {
    n += 1
    if (max !== undefined && max >= 0 && n > max) return a[0]
    if (typeof subst === 'string') return subst.replace(/\$(\d+|\{(\w+)\}|\$)/g, (_, g, nome) => (g === '$' ? '$' : nome ? (a[a.length - 1] ?? {})[nome] ?? '' : a[Number(g)] ?? ''))
    const grupos = typeof a[a.length - 1] === 'object' ? a[a.length - 1] : undefined
    const idx = grupos ? a.length - 3 : a.length - 2
    const mm = new MatchCS(Object.assign(a.slice(0, idx), { index: a[idx], groups: grupos }), texto, r)
    return m.aTexto(m.chamarFuncao(subst, [mm]))
  })
}

const dividir = (re, texto) => new Arr('string', texto.split(new RegExp(re.source, re.flags.replace('g', ''))).map((x) => x ?? ''))

export class RegexCS {
  constructor(padrao, opcoes) { this.padrao = padrao; this.re = traduzir(padrao, opcoes); this.opcoes = opcoes }

  nomeCS() { return 'Regex' }

  paraTexto() { return this.padrao }
}
RegexCS.METODOS = {
  IsMatch: (m, o, [s]) => new RegExp(o.re.source, o.re.flags.replace('g', '')).test(s),
  Match: (m, o, [s]) => primeiro(o.re, s),
  Matches: (m, o, [s]) => new ColecaoMatchesCS(todos(o.re, s)),
  Replace: (m, o, [s, r, n]) => substituir(m, o.re, s, r, n),
  Split: (m, o, [s]) => dividir(o.re, s),
  ToString: (m, o) => o.padrao,
}
RegexCS.PROPS = {}

export const REGEX = {
  nome: 'Regex',
  criar: (m, [p, o = 0]) => new RegexCS(p, o),
  const: {},
  estatico: {
    IsMatch: (m, [s, p, o = 0]) => new RegExp(traduzir(p, o).source, traduzir(p, o).flags.replace('g', '')).test(s),
    Match: (m, [s, p, o = 0]) => primeiro(traduzir(p, o), s),
    Matches: (m, [s, p, o = 0]) => new ColecaoMatchesCS(todos(traduzir(p, o), s)),
    Replace: (m, [s, p, r, o = 0]) => substituir(m, traduzir(p, typeof o === 'number' ? o : 0), s, r),
    Split: (m, [s, p, o = 0]) => dividir(traduzir(p, o), s),
    Escape: (m, [s]) => s.replace(/[.*+?^${}()|[\]\\#\s]/g, '\\$&'),
    Unescape: (m, [s]) => s.replace(/\\(.)/g, '$1'),
  },
}

export const REGEXOPTIONS = { nome: 'RegexOptions', const: OPCOES, estatico: {} }
