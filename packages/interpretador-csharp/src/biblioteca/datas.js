// DateTime, TimeSpan e Stopwatch.

import { CULTURAS, formatarData } from '../formatar.js'
import { Dbl, ValorEnum, comoNumero } from '../valores.js'

const MS_DIA = 86400000

const dois = (n) => String(n).padStart(2, '0')

const camposDe = (d) => ({
  ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate(), hora: d.getHours(), minuto: d.getMinutes(), segundo: d.getSeconds(), ms: d.getMilliseconds(), diaSemana: d.getDay(),
})

// ---- TimeSpan --------------------------------------------------------------------------------------------------

export class TempoCS {
  constructor(ms) { this.ms = ms }

  nomeCS() { return 'TimeSpan' }

  paraTexto(m, fmt) {
    if (fmt === 'g' || fmt === 'G') return this.formatar(false)
    return this.formatar(true)
  }

  formatar() {
    const neg = this.ms < 0
    let ms = Math.abs(Math.round(this.ms))
    const dias = Math.floor(ms / MS_DIA)
    ms -= dias * MS_DIA
    const h = Math.floor(ms / 3600000)
    ms -= h * 3600000
    const mi = Math.floor(ms / 60000)
    ms -= mi * 60000
    const s = Math.floor(ms / 1000)
    ms -= s * 1000
    return `${neg ? '-' : ''}${dias ? `${dias}.` : ''}${dois(h)}:${dois(mi)}:${dois(s)}${ms ? `.${String(ms).padStart(3, '0')}0000` : ''}`
  }

  operarNativo(m, op, b, esquerda) {
    if (!(b instanceof TempoCS)) {
      if (op === '*' && typeof b === 'number') return new TempoCS(this.ms * b)
      return undefined
    }
    const x = esquerda ? this.ms : b.ms
    const y = esquerda ? b.ms : this.ms
    switch (op) {
      case '+': return new TempoCS(x + y)
      case '-': return new TempoCS(x - y)
      case '<': return x < y
      case '>': return x > y
      case '<=': return x <= y
      case '>=': return x >= y
      case '==': return x === y
      case '!=': return x !== y
      default: return undefined
    }
  }

  igualNativo(b) { return b instanceof TempoCS && b.ms === this.ms }

  compararCom(b) { return Math.sign(this.ms - b.ms) }
}

const tempo = (ms) => new TempoCS(ms)
const dbl = (n) => new Dbl(n)

TempoCS.PROPS = {
  Days: { get: (m, t) => Math.trunc(t.ms / MS_DIA) },
  Hours: { get: (m, t) => Math.trunc((t.ms % MS_DIA) / 3600000) },
  Minutes: { get: (m, t) => Math.trunc((t.ms % 3600000) / 60000) },
  Seconds: { get: (m, t) => Math.trunc((t.ms % 60000) / 1000) },
  Milliseconds: { get: (m, t) => Math.trunc(t.ms % 1000) },
  TotalDays: { get: (m, t) => dbl(t.ms / MS_DIA) },
  TotalHours: { get: (m, t) => dbl(t.ms / 3600000) },
  TotalMinutes: { get: (m, t) => dbl(t.ms / 60000) },
  TotalSeconds: { get: (m, t) => dbl(t.ms / 1000) },
  TotalMilliseconds: { get: (m, t) => dbl(t.ms) },
  Ticks: { get: (m, t) => BigInt(Math.round(t.ms * 10000)) },
}

TempoCS.METODOS = {
  ToString: (m, t, [f]) => t.paraTexto(m, f),
  Add: (m, t, [o]) => tempo(t.ms + o.ms),
  Subtract: (m, t, [o]) => tempo(t.ms - o.ms),
  Negate: (m, t) => tempo(-t.ms),
  Duration: (m, t) => tempo(Math.abs(t.ms)),
  CompareTo: (m, t, [o]) => Math.sign(t.ms - o.ms),
  Equals: (m, t, [o]) => o instanceof TempoCS && o.ms === t.ms,
  GetHashCode: (m, t) => Math.trunc(t.ms) | 0,
  GetType: (m) => m.bib.tipoValor('TimeSpan'),
}

export const TIMESPAN = {
  nome: 'TimeSpan',
  criar(m, args) {
    if (args.length === 1) return tempo(Number(args[0]) / 10000)
    const [a, b, c, d = 0, e = 0] = args.map(comoNumero)
    if (args.length === 3) return tempo(a * 3600000 + b * 60000 + c * 1000)
    return tempo(a * MS_DIA + b * 3600000 + c * 60000 + d * 1000 + e)
  },
  const: { Zero: tempo(0), MaxValue: tempo(Number.MAX_SAFE_INTEGER), MinValue: tempo(-Number.MAX_SAFE_INTEGER) },
  estatico: {
    FromDays: (m, [n]) => tempo(comoNumero(n) * MS_DIA),
    FromHours: (m, [n]) => tempo(comoNumero(n) * 3600000),
    FromMinutes: (m, [n]) => tempo(comoNumero(n) * 60000),
    FromSeconds: (m, [n]) => tempo(comoNumero(n) * 1000),
    FromMilliseconds: (m, [n]) => tempo(comoNumero(n)),
    FromTicks: (m, [n]) => tempo(Number(n) / 10000),
    Parse(m, [s]) {
      const r = /^(-?)(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?(?:\.(\d+))?$/.exec(String(s).trim())
      if (!r) throw m.excecao('FormatException', 'String was not recognized as a valid TimeSpan.')
      const ms = (Number(r[2] ?? 0) * 24 + Number(r[3])) * 3600000 + Number(r[4]) * 60000 + Number(r[5] ?? 0) * 1000 + Number(`0.${r[6] ?? 0}`) * 1000
      return tempo(r[1] ? -ms : ms)
    },
  },
}

// ---- DateTime ---------------------------------------------------------------------------------------------------

export class DataCS {
  constructor(ms, kind = 0) { this.d = new Date(ms); this.kind = kind }

  nomeCS() { return 'DateTime' }

  paraTexto(m, fmt, cultura) { return formatarData(camposDe(this.d), fmt, cultura ?? m.cultura) }

  get ms() { return this.d.getTime() }

  operarNativo(m, op, b, esquerda) {
    if (b instanceof DataCS) {
      const x = esquerda ? this.ms : b.ms
      const y = esquerda ? b.ms : this.ms
      switch (op) {
        case '-': return tempo(x - y)
        case '<': return x < y
        case '>': return x > y
        case '<=': return x <= y
        case '>=': return x >= y
        case '==': return x === y
        case '!=': return x !== y
        default: return undefined
      }
    }
    if (b instanceof TempoCS && esquerda) {
      if (op === '+') return new DataCS(this.ms + b.ms, this.kind)
      if (op === '-') return new DataCS(this.ms - b.ms, this.kind)
    }
    return undefined
  }

  igualNativo(b) { return b instanceof DataCS && b.ms === this.ms }

  compararCom(b) { return Math.sign(this.ms - b.ms) }
}

const nova = (ms, k = 0) => new DataCS(ms, k)
const adicionarMeses = (d, n) => {
  const r = new Date(d.getTime())
  const dia = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(dia, ultimo))
  return r
}

DataCS.PROPS = {
  Year: { get: (m, o) => o.d.getFullYear() },
  Month: { get: (m, o) => o.d.getMonth() + 1 },
  Day: { get: (m, o) => o.d.getDate() },
  Hour: { get: (m, o) => o.d.getHours() },
  Minute: { get: (m, o) => o.d.getMinutes() },
  Second: { get: (m, o) => o.d.getSeconds() },
  Millisecond: { get: (m, o) => o.d.getMilliseconds() },
  DayOfWeek: { get: (m, o) => m.buscarClasse('DayOfWeek').valorDe(o.d.getDay()) },
  DayOfYear: { get: (m, o) => Math.floor((new Date(o.d.getFullYear(), o.d.getMonth(), o.d.getDate()) - new Date(o.d.getFullYear(), 0, 0)) / MS_DIA) },
  Date: { get: (m, o) => nova(new Date(o.d.getFullYear(), o.d.getMonth(), o.d.getDate()).getTime(), o.kind) },
  TimeOfDay: { get: (m, o) => tempo(o.d.getHours() * 3600000 + o.d.getMinutes() * 60000 + o.d.getSeconds() * 1000 + o.d.getMilliseconds()) },
  Ticks: { get: (m, o) => BigInt(Math.round((o.ms + 62135596800000) * 10000)) },
  Kind: { get: (m, o) => m.buscarClasse('DateTimeKind').valorDe(o.kind) },
}

DataCS.METODOS = {
  ToString: (m, o, [f, c]) => o.paraTexto(m, typeof f === 'string' ? f : undefined, c?.cultura),
  ToShortDateString: (m, o) => o.paraTexto(m, 'd'),
  ToLongDateString: (m, o) => o.paraTexto(m, 'D'),
  ToShortTimeString: (m, o) => o.paraTexto(m, 't'),
  ToLongTimeString: (m, o) => o.paraTexto(m, 'T'),
  AddDays: (m, o, [n]) => nova(o.ms + comoNumero(n) * MS_DIA, o.kind),
  AddHours: (m, o, [n]) => nova(o.ms + comoNumero(n) * 3600000, o.kind),
  AddMinutes: (m, o, [n]) => nova(o.ms + comoNumero(n) * 60000, o.kind),
  AddSeconds: (m, o, [n]) => nova(o.ms + comoNumero(n) * 1000, o.kind),
  AddMilliseconds: (m, o, [n]) => nova(o.ms + comoNumero(n), o.kind),
  AddTicks: (m, o, [n]) => nova(o.ms + Number(n) / 10000, o.kind),
  AddMonths: (m, o, [n]) => nova(adicionarMeses(o.d, comoNumero(n)).getTime(), o.kind),
  AddYears: (m, o, [n]) => nova(adicionarMeses(o.d, comoNumero(n) * 12).getTime(), o.kind),
  Add: (m, o, [t]) => nova(o.ms + t.ms, o.kind),
  Subtract: (m, o, [x]) => (x instanceof DataCS ? tempo(o.ms - x.ms) : nova(o.ms - x.ms, o.kind)),
  CompareTo: (m, o, [x]) => Math.sign(o.ms - x.ms),
  Equals: (m, o, [x]) => x instanceof DataCS && x.ms === o.ms,
  GetHashCode: (m, o) => Math.trunc(o.ms) | 0,
  ToUniversalTime: (m, o) => nova(o.ms, 1),
  ToLocalTime: (m, o) => nova(o.ms, 2),
  GetType: (m) => m.bib.tipoValor('DateTime'),
}

function analisar(m, s, cultura = m.cultura) {
  const t = String(s).trim()
  let r = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?Z?$/.exec(t)
  if (r) return new Date(+r[1], +r[2] - 1, +r[3], +(r[4] ?? 0), +(r[5] ?? 0), +(r[6] ?? 0), Number(`0.${r[7] ?? 0}`) * 1000)
  r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t)
  if (r) {
    const brasil = cultura.dataCurta.startsWith('dd')
    const [dia, mes] = brasil ? [+r[1], +r[2]] : [+r[2], +r[1]]
    return new Date(+r[3], mes - 1, dia, +(r[4] ?? 0), +(r[5] ?? 0), +(r[6] ?? 0))
  }
  return null
}

const dataOuErro = (m, s) => {
  const d = analisar(m, s)
  if (!d || Number.isNaN(d.getTime())) throw m.excecao('FormatException', `String '${s}' was not recognized as a valid DateTime.`)
  return d
}

export const DATETIME = {
  nome: 'DateTime',
  criar(m, args) {
    if (args.length === 0) return nova(new Date(1, 0, 1).getTime())
    if (args.length === 1) return nova(Number(args[0]) / 10000 - 62135596800000)
    const [a, b, c, h = 0, mi = 0, s = 0, ms = 0] = args.map((x) => (x instanceof ValorEnum ? x.v : comoNumero(x)))
    const d = new Date(a, b - 1, c, h, mi, s, ms)
    d.setFullYear(a)
    if (a < 1 || a > 9999 || b < 1 || b > 12 || c < 1 || c > new Date(a, b, 0).getDate()) throw m.excecao('ArgumentOutOfRangeException', 'Year, Month, and Day parameters describe an un-representable DateTime.')
    return nova(d.getTime())
  },
  const: { MinValue: nova(new Date(1, 0, 1).getTime()), MaxValue: nova(new Date(9999, 11, 31, 23, 59, 59).getTime()) },
  props: {
    Now: { get: (m) => nova(m.agoraMs()) },
    UtcNow: { get: (m) => nova(m.agoraMs(), 1) },
    Today: { get: (m) => { const d = new Date(m.agoraMs()); return nova(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) } },
  },
  estatico: {
    Parse: (m, [s]) => nova(dataOuErro(m, s).getTime()),
    TryParse(m, [s, saida]) {
      const d = analisar(m, s)
      if (!d || Number.isNaN(d.getTime())) {
        saida.v = nova(new Date(1, 0, 1).getTime())
        return false
      }
      saida.v = nova(d.getTime())
      return true
    },
    ParseExact: (m, [s]) => nova(dataOuErro(m, s).getTime()),
    DaysInMonth: (m, [a, mes]) => new Date(a, mes, 0).getDate(),
    IsLeapYear: (m, [a]) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0,
    Compare: (m, [a, b]) => Math.sign(a.ms - b.ms),
    Equals: (m, [a, b]) => a.ms === b.ms,
  },
}

// ---- Stopwatch ---------------------------------------------------------------------------------------------------

export class CronometroCS {
  constructor() { this.acumulado = 0; this.inicio = null }

  nomeCS() { return 'Stopwatch' }

  agora(m) { return m.agoraMs() }

  decorrido(m) { return this.acumulado + (this.inicio === null ? 0 : this.agora(m) - this.inicio) }

  paraTexto(m) { return tempo(this.decorrido(m)).formatar() }
}

CronometroCS.METODOS = {
  Start(m, c) { if (c.inicio === null) c.inicio = c.agora(m); return null },
  Stop(m, c) { if (c.inicio !== null) { c.acumulado += c.agora(m) - c.inicio; c.inicio = null } return null },
  Reset(m, c) { c.acumulado = 0; c.inicio = null; return null },
  Restart(m, c) { c.acumulado = 0; c.inicio = c.agora(m); return null },
  GetType: (m) => m.bib.tipoValor('Stopwatch'),
}
CronometroCS.PROPS = {
  Elapsed: { get: (m, c) => tempo(c.decorrido(m)) },
  ElapsedMilliseconds: { get: (m, c) => BigInt(Math.floor(c.decorrido(m))) },
  ElapsedTicks: { get: (m, c) => BigInt(Math.floor(c.decorrido(m) * 10000)) },
  IsRunning: { get: (m, c) => c.inicio !== null },
}

export const STOPWATCH = {
  nome: 'Stopwatch',
  criar: () => new CronometroCS(),
  const: { Frequency: 10000000n, IsHighResolution: true },
  estatico: {
    StartNew(m) { const c = new CronometroCS(); c.inicio = c.agora(m); return c },
    GetTimestamp: (m) => BigInt(Math.floor(m.agoraMs() * 10000)),
  },
}

export { CULTURAS, DataCS as _DataCS }
