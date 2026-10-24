// Números: Math, os tipos numéricos (int.Parse, double.MaxValue...), Convert, Random e os métodos dos números.

import { ErroFormato, formatarNumero } from '../formatar.js'
import { igualValor } from '../operadores.js'
import {
  Chr, Dbl, Dec, Flt, LIMITES, Num, ValorEnum,
  comoNumero, converterNumero, decArredondar, decDeNumero, decDeTexto, decParaNumero, ehNumero, tipoNumerico,
} from '../valores.js'

const NOMES = { Int32: 'int', Int64: 'long', Int16: 'short', UInt32: 'uint', UInt64: 'ulong', UInt16: 'ushort', Byte: 'byte', SByte: 'sbyte', Double: 'double', Single: 'float', Decimal: 'decimal' }

const MAXIMOS = {
  sbyte: [-128, 127], byte: [0, 255], short: [-32768, 32767], ushort: [0, 65535],
  int: [-2147483648, 2147483647], uint: [0, 4294967295],
}

const NOME_DOTNET = { sbyte: 'SByte', byte: 'Byte', short: 'Int16', ushort: 'UInt16', int: 'Int32', uint: 'UInt32', long: 'Int64', ulong: 'UInt64', float: 'Single', double: 'Double', decimal: 'Decimal' }

/** Converte o texto digitado em número do tipo dado (com as regras de cultura do pt-BR). null se inválido. */
export function analisarNumero(m, texto, tipo, estiloInvariante = false, cultura = null) {
  if (texto === null || texto === undefined) return { erro: 'nulo' }
  let t = String(texto).trim()
  const c = cultura ?? m.cultura
  const decimal = estiloInvariante ? '.' : c.decimal
  const milhar = estiloInvariante ? ',' : c.milhar
  if (t === '') return { erro: 'formato' }
  if (tipo === 'double' || tipo === 'float' || tipo === 'decimal') {
    if (milhar) t = t.split(milhar).join('')
    if (decimal !== '.') t = t.replace(decimal, '.')
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
      if (tipo !== 'decimal' && /^[+-]?(Infinity|∞)$/.test(t)) return { valor: new Dbl(t.startsWith('-') ? -Infinity : Infinity) }
      if (tipo !== 'decimal' && /^NaN$/.test(t)) return { valor: new Dbl(NaN) }
      return { erro: 'formato' }
    }
    if (tipo === 'decimal') {
      const d = decDeTexto(t)
      return d ? { valor: d } : { erro: 'formato' }
    }
    const n = parseFloat(t)
    return { valor: tipo === 'float' ? new Flt(n) : new Dbl(n) }
  }
  if (milhar && false) t = t.split(milhar).join('')
  if (!/^[+-]?\d+$/.test(t)) return { erro: 'formato' }
  const big = BigInt(t)
  if (tipo === 'long') return big >= -(2n ** 63n) && big < 2n ** 63n ? { valor: big } : { erro: 'estouro' }
  if (tipo === 'ulong') return big >= 0n && big < 2n ** 64n ? { valor: new Num('ulong', big) } : { erro: 'estouro' }
  const [min, max] = MAXIMOS[tipo]
  if (big < BigInt(min) || big > BigInt(max)) return { erro: 'estouro' }
  const n = Number(big)
  return { valor: tipo === 'int' ? n : new Num(tipo, n) }
}

function mensagemErro(r, texto, tipo) {
  if (r.erro === 'nulo') return ['ArgumentNullException', "Value cannot be null. (Parameter 's')"]
  if (r.erro === 'estouro') return ['OverflowException', `Value was either too large or too small for an ${NOME_DOTNET[tipo] === 'Int32' ? 'Int32' : NOME_DOTNET[tipo]}.`]
  return ['FormatException', `The input string '${texto}' was not in a correct format.`]
}

/** O IFormatProvider (CultureInfo) entre os argumentos de Parse/TryParse/Convert, se houver. */
export const culturaDe = (args) => args.find((a) => a && typeof a === 'object' && a.cultura && typeof a.cultura.decimal === 'string')?.cultura ?? null

export function parse(m, texto, tipo, cultura = null) {
  const r = analisarNumero(m, texto, tipo, false, cultura)
  if (r.erro) {
    const [classe, msg] = mensagemErro(r, texto, tipo)
    throw m.excecao(classe, msg)
  }
  return r.valor
}

export function tryParse(m, args, tipo) {
  const texto = args[0]
  const saida = args[args.length - 1]
  const r = analisarNumero(m, texto, tipo, false, culturaDe(args))
  if (r.erro) {
    saida.v = m.valorPadrao(tipo)
    return false
  }
  saida.v = r.valor
  return true
}

const arredondar = (n, casas, modo) => {
  const f = 10 ** casas
  const x = n * f
  let r
  if (modo === 1) r = Math.sign(x) * Math.round(Math.abs(x))
  else if (modo === 2) r = Math.trunc(x)
  else if (modo === 3) r = Math.floor(x)
  else if (modo === 4) r = Math.ceil(x)
  else {
    const piso = Math.floor(x)
    const dif = x - piso
    if (Math.abs(dif - 0.5) < 1e-12) r = piso % 2 === 0 ? piso : piso + 1
    else r = Math.round(x)
  }
  return r / f
}

const num = (v) => (v instanceof Dec ? decParaNumero(v) : comoNumero(v))
const ehDec = (v) => v instanceof Dec
const comoDouble = (v) => new Dbl(v)

/** Math.Abs/Max/Min: mantêm o tipo dos argumentos. */
function manterTipo(a, b, r) {
  const k = tipoNumerico(a)
  if (k === 'double') return new Dbl(r)
  if (k === 'float') return new Flt(r)
  if (k === 'decimal') return converterNumero(new Dbl(r), 'decimal')
  if (k === 'long') return BigInt(r)
  if (k === 'int') return r | 0
  return converterNumero(r, k)
}

function maxMin(a, b, ehMax) {
  const k = tipoNumerico(a) === tipoNumerico(b) ? tipoNumerico(a) : null
  if (ehDec(a) && ehDec(b)) return (decParaNumero(a) >= decParaNumero(b)) === ehMax ? a : b
  const x = num(a)
  const y = num(b)
  if (k === 'long') return (a >= b) === ehMax ? a : b
  const r = ehMax ? (Number.isNaN(x) || Number.isNaN(y) ? NaN : Math.max(x, y)) : Number.isNaN(x) || Number.isNaN(y) ? NaN : Math.min(x, y)
  if (k) return manterTipo(a, b, r)
  const alvo = tipoNumerico(a) === 'double' || tipoNumerico(b) === 'double' ? 'double' : tipoNumerico(a) === 'float' || tipoNumerico(b) === 'float' ? 'float' : tipoNumerico(a) === 'long' || tipoNumerico(b) === 'long' ? 'long' : 'int'
  return converterNumero(new Dbl(r), alvo)
}

export const MATH = {
  nome: 'Math',
  const: { PI: new Dbl(Math.PI), E: new Dbl(Math.E), Tau: new Dbl(2 * Math.PI) },
  estatico: {
    Abs(m, [a]) {
      if (a instanceof Dec) return new Dec(a.u < 0n ? -a.u : a.u, a.s)
      if (typeof a === 'bigint') return a < 0n ? -a : a
      return manterTipo(a, a, Math.abs(num(a)))
    },
    Max: (m, [a, b]) => maxMin(a, b, true),
    Min: (m, [a, b]) => maxMin(a, b, false),
    Sqrt: (m, [a]) => comoDouble(Math.sqrt(num(a))),
    Cbrt: (m, [a]) => comoDouble(Math.cbrt(num(a))),
    Pow: (m, [a, b]) => comoDouble(num(a) ** num(b)),
    Exp: (m, [a]) => comoDouble(Math.exp(num(a))),
    Log: (m, [a, b]) => comoDouble(b === undefined ? Math.log(num(a)) : Math.log(num(a)) / Math.log(num(b))),
    Log10: (m, [a]) => comoDouble(Math.log10(num(a))),
    Log2: (m, [a]) => comoDouble(Math.log2(num(a))),
    Sin: (m, [a]) => comoDouble(Math.sin(num(a))),
    Cos: (m, [a]) => comoDouble(Math.cos(num(a))),
    Tan: (m, [a]) => comoDouble(Math.tan(num(a))),
    Asin: (m, [a]) => comoDouble(Math.asin(num(a))),
    Acos: (m, [a]) => comoDouble(Math.acos(num(a))),
    Atan: (m, [a]) => comoDouble(Math.atan(num(a))),
    Atan2: (m, [a, b]) => comoDouble(Math.atan2(num(a), num(b))),
    Sinh: (m, [a]) => comoDouble(Math.sinh(num(a))),
    Cosh: (m, [a]) => comoDouble(Math.cosh(num(a))),
    Tanh: (m, [a]) => comoDouble(Math.tanh(num(a))),
    Floor: (m, [a]) => (ehDec(a) ? decArredondar(new Dec(a.u - (a.u % 10n ** BigInt(a.s) < 0n ? 10n ** BigInt(a.s) : 0n), a.s), 0) : tipoNumerico(a) === 'float' ? new Flt(Math.floor(num(a))) : comoDouble(Math.floor(num(a)))),
    Ceiling: (m, [a]) => (tipoNumerico(a) === 'float' ? new Flt(Math.ceil(num(a))) : ehDec(a) ? decDeNumero(Math.ceil(num(a))) : comoDouble(Math.ceil(num(a)))),
    Truncate: (m, [a]) => (ehDec(a) ? decDeNumero(Math.trunc(num(a))) : comoDouble(Math.trunc(num(a)))),
    Round(m, [a, b, c]) {
      const modo = c instanceof ValorEnum ? c.v : b instanceof ValorEnum ? b.v : 0
      const casas = typeof b === 'number' ? b : 0
      if (ehDec(a)) return decArredondar(a, casas, modo === 1 ? 'longe' : 'par')
      const r = arredondar(num(a), casas, modo)
      return tipoNumerico(a) === 'float' ? new Flt(r) : comoDouble(r)
    },
    Sign: (m, [a]) => {
      const n = num(a)
      if (Number.isNaN(n)) throw m.excecao('ArithmeticException', 'Function does not accept floating point Not-a-Number values.')
      return Math.sign(n)
    },
    Clamp: (m, [v, lo, hi]) => maxMin(maxMin(v, lo, true), hi, false),
    DivRem: (m, [a, b]) => {
      if (comoNumero(b) === 0) throw m.excecao('DivideByZeroException', 'Attempted to divide by zero.')
      return m.bib.novaTupla([Math.trunc(comoNumero(a) / comoNumero(b)) | 0, comoNumero(a) % comoNumero(b) | 0])
    },
    IEEERemainder: (m, [a, b]) => comoDouble(num(a) - num(b) * Math.round(num(a) / num(b))),
    BigMul: (m, [a, b]) => BigInt(comoNumero(a)) * BigInt(comoNumero(b)),
    CopySign: (m, [a, b]) => comoDouble(Math.sign(num(b)) * Math.abs(num(a)) || Math.abs(num(a))),
    ToRadians: (m, [a]) => comoDouble((num(a) * Math.PI) / 180),
  },
}

/** int, double, long...: statics (Parse, TryParse, MaxValue...). */
export function tipoNumericoNativo(tipo) {
  const nome = NOME_DOTNET[tipo]
  const limites = MAXIMOS[tipo]
  const r = {
    nome,
    const: {},
    estatico: {
      Parse: (m, [t, ...resto]) => parse(m, t, tipo, culturaDe(resto)),
      TryParse: (m, a) => tryParse(m, a, tipo),
      Equals: (m, [a, b]) => igualValor(m, a, b),
      Compare: (m, [a, b]) => m.comparar(a, b),
    },
  }
  if (limites) {
    r.const.MaxValue = tipo === 'int' ? limites[1] : new Num(tipo, limites[1])
    r.const.MinValue = tipo === 'int' ? limites[0] : new Num(tipo, limites[0])
  }
  if (tipo === 'long') {
    r.const.MaxValue = 2n ** 63n - 1n
    r.const.MinValue = -(2n ** 63n)
  }
  if (tipo === 'ulong') {
    r.const.MaxValue = new Num('ulong', 2n ** 64n - 1n)
    r.const.MinValue = new Num('ulong', 0n)
  }
  if (tipo === 'double') {
    Object.assign(r.const, {
      MaxValue: new Dbl(Number.MAX_VALUE), MinValue: new Dbl(-Number.MAX_VALUE), Epsilon: new Dbl(Number.MIN_VALUE),
      NaN: new Dbl(NaN), PositiveInfinity: new Dbl(Infinity), NegativeInfinity: new Dbl(-Infinity),
    })
    Object.assign(r.estatico, {
      IsNaN: (m, [a]) => Number.isNaN(num(a)),
      IsInfinity: (m, [a]) => !Number.isFinite(num(a)) && !Number.isNaN(num(a)),
      IsPositiveInfinity: (m, [a]) => num(a) === Infinity,
      IsNegativeInfinity: (m, [a]) => num(a) === -Infinity,
      IsFinite: (m, [a]) => Number.isFinite(num(a)),
    })
  }
  if (tipo === 'float') {
    Object.assign(r.const, { MaxValue: new Flt(3.4028235e38), MinValue: new Flt(-3.4028235e38), Epsilon: new Flt(1.4e-45), NaN: new Flt(NaN), PositiveInfinity: new Flt(Infinity), NegativeInfinity: new Flt(-Infinity) })
    Object.assign(r.estatico, { IsNaN: (m, [a]) => Number.isNaN(num(a)), IsInfinity: (m, [a]) => !Number.isFinite(num(a)) && !Number.isNaN(num(a)) })
  }
  if (tipo === 'decimal') {
    Object.assign(r.const, { MaxValue: new Dec(79228162514264337593543950335n, 0), MinValue: new Dec(-79228162514264337593543950335n, 0), Zero: new Dec(0n, 0), One: new Dec(1n, 0), MinusOne: new Dec(-1n, 0) })
    Object.assign(r.estatico, {
      Round: MATH.estatico.Round,
      Floor: MATH.estatico.Floor,
      Ceiling: MATH.estatico.Ceiling,
      Truncate: MATH.estatico.Truncate,
      Add: (m, [a, b]) => m.bib.somar(m, a, b),
    })
  }
  return r
}

// ---- Convert --------------------------------------------------------------------------------------------

function paraNumeroConvert(m, v, tipo, cultura = null) {
  if (v === null || v === undefined) return m.valorPadrao(tipo)
  if (typeof v === 'string') return parse(m, v, tipo, cultura)
  if (typeof v === 'boolean') return converterNumero(v ? 1 : 0, tipo)
  if (v instanceof Chr) {
    if (tipo === 'char') return v
    if (tipo === 'int' || tipo === 'long' || tipo === 'uint' || tipo === 'ushort' || tipo === 'byte' || tipo === 'short') return converterNumero(v.c, tipo)
    throw m.excecao('InvalidCastException', `Invalid cast from 'Char' to '${NOME_DOTNET[tipo]}'.`)
  }
  if (ehNumero(v)) {
    // Convert arredonda (para o par mais próximo) ao ir de real para inteiro
    const de = tipoNumerico(v)
    if ((de === 'double' || de === 'float' || de === 'decimal') && !['double', 'float', 'decimal'].includes(tipo)) {
      const n = num(v)
      const r = arredondar(n, 0, 0)
      const [min, max] = tipo === 'long' || tipo === 'ulong' ? [-Infinity, Infinity] : MAXIMOS[tipo] ?? [-Infinity, Infinity]
      if (r < min || r > max || Number.isNaN(r)) throw m.excecao('OverflowException', `Value was either too large or too small for an ${NOME_DOTNET[tipo]}.`)
      return converterNumero(r, tipo)
    }
    const alvo = MAXIMOS[tipo]
    if (alvo) {
      const n = num(v)
      if (n < alvo[0] || n > alvo[1]) throw m.excecao('OverflowException', `Value was either too large or too small for an ${NOME_DOTNET[tipo]}.`)
    }
    return converterNumero(v, tipo)
  }
  if (v instanceof ValorEnum) return converterNumero(v.v, tipo)
  throw m.excecao('InvalidCastException', `Invalid cast from '${m.nomeDoTipoDe(v)}' to '${NOME_DOTNET[tipo] ?? tipo}'.`)
}

export const CONVERT = {
  nome: 'Convert',
  estatico: {
    ToInt32: (m, [v, base]) => (typeof v === 'string' && typeof base === 'number' ? parseInt(v, base) | 0 : paraNumeroConvert(m, v, 'int', culturaDe([base]))),
    ToInt64: (m, [v]) => paraNumeroConvert(m, v, 'long'),
    ToInt16: (m, [v]) => paraNumeroConvert(m, v, 'short'),
    ToUInt32: (m, [v]) => paraNumeroConvert(m, v, 'uint'),
    ToUInt64: (m, [v]) => paraNumeroConvert(m, v, 'ulong'),
    ToByte: (m, [v]) => paraNumeroConvert(m, v, 'byte'),
    ToSByte: (m, [v]) => paraNumeroConvert(m, v, 'sbyte'),
    ToDouble: (m, [v, p]) => paraNumeroConvert(m, v, 'double', culturaDe([p])),
    ToSingle: (m, [v, p]) => paraNumeroConvert(m, v, 'float', culturaDe([p])),
    ToDecimal: (m, [v, p]) => paraNumeroConvert(m, v, 'decimal', culturaDe([p])),
    ToChar: (m, [v]) => (typeof v === 'string' ? new Chr(v.charCodeAt(0)) : paraNumeroConvert(m, v, 'char')),
    ToBoolean(m, [v]) {
      if (typeof v === 'boolean') return v
      if (typeof v === 'string') {
        if (/^true$/i.test(v.trim())) return true
        if (/^false$/i.test(v.trim())) return false
        throw m.excecao('FormatException', `String '${v}' was not recognized as a valid Boolean.`)
      }
      if (ehNumero(v)) return num(v) !== 0
      throw m.excecao('InvalidCastException', 'Invalid cast to Boolean.')
    },
    ToString(m, [v, base]) {
      if (typeof base === 'number' && ehNumero(v)) return (typeof v === 'bigint' ? v : BigInt(comoNumero(v))).toString(base)
      return m.aTexto(v)
    },
    ToBase64String: (m, [a]) => btoa(String.fromCharCode(...a.itens.map((x) => comoNumero(x)))),
    FromBase64String: (m, [t]) => m.bib.novoArray('byte', [...atob(t)].map((c) => new Num('byte', c.charCodeAt(0)))),
    ToHexString: (m, [a]) => a.itens.map((x) => comoNumero(x).toString(16).padStart(2, '0').toUpperCase()).join(''),
    ToDateTime: (m, [v]) => m.bib.datas.converter(m, v),
  },
}

// ---- Random -----------------------------------------------------------------------------------------------

/**
 * System.Random: com semente, o mesmo algoritmo do .NET (gerador subtrativo de Knuth), então new Random(42)
 * dá exatamente os mesmos números que no C# de verdade. Sem semente, é aleatório de verdade.
 */
export class AleatorioCS {
  constructor(semente) {
    this.comSemente = semente !== undefined && semente !== null
    if (!this.comSemente) return
    const MBIG = 2147483647
    const MSEED = 161803398
    const s = new Array(56).fill(0)
    const subtracao = semente === -2147483648 ? MBIG : Math.abs(semente)
    let mj = MSEED - subtracao
    s[55] = mj
    let mk = 1
    for (let i = 1; i < 55; i += 1) {
      const ii = (21 * i) % 55
      s[ii] = mk
      mk = mj - mk
      if (mk < 0) mk += MBIG
      mj = s[ii]
    }
    for (let k = 1; k < 5; k += 1) {
      for (let i = 1; i < 56; i += 1) {
        s[i] -= s[1 + ((i + 30) % 55)]
        if (s[i] < 0) s[i] += MBIG
      }
    }
    this.s = s
    this.inext = 0
    this.inextp = 21
  }

  interno() {
    if (!this.comSemente) return Math.floor(Math.random() * 2147483647)
    let a = this.inext + 1
    let b = this.inextp + 1
    if (a >= 56) a = 1
    if (b >= 56) b = 1
    let r = this.s[a] - this.s[b]
    if (r === 2147483647) r -= 1
    if (r < 0) r += 2147483647
    this.s[a] = r
    this.inext = a
    this.inextp = b
    return r
  }

  proximo() { return this.interno() * (1.0 / 2147483647) }

  nomeCS() { return 'Random' }

  paraTexto() { return 'System.Random' }
}
AleatorioCS.METODOS = {
  Next(m, o, args) {
    const [a, b] = args
    if (args.length === 0) return o.interno()
    if (args.length === 1) {
      if (comoNumero(a) < 0) throw m.excecao('ArgumentOutOfRangeException', "'maxValue' must be greater than zero. (Parameter 'maxValue')")
      return Math.floor(o.proximo() * comoNumero(a))
    }
    if (comoNumero(a) > comoNumero(b)) throw m.excecao('ArgumentOutOfRangeException', "'minValue' cannot be greater than maxValue. (Parameter 'minValue')")
    return comoNumero(a) + Math.floor(o.proximo() * (comoNumero(b) - comoNumero(a)))
  },
  NextDouble: (m, o) => new Dbl(o.proximo()),
  NextSingle: (m, o) => new Flt(o.proximo()),
  NextInt64: (m, o, [a, b]) => BigInt(Math.floor(o.proximo() * Number(b ?? a ?? 2 ** 53))) + (b === undefined ? 0n : BigInt(a)),
  NextBytes(m, o, [arr]) {
    for (let i = 0; i < arr.itens.length; i += 1) arr.itens[i] = new Num('byte', o.interno() % 256)
    return null
  },
  Shuffle(m, o, [arr]) {
    for (let i = arr.itens.length - 1; i > 0; i -= 1) {
      const j = Math.floor(o.proximo() * (i + 1))
      ;[arr.itens[i], arr.itens[j]] = [arr.itens[j], arr.itens[i]]
    }
    return null
  },
}

export const RANDOM = {
  nome: 'Random',
  criar: (m, args) => new AleatorioCS(args[0] === undefined ? m.aleatorio : comoNumero(args[0])),
  props: { Shared: { get: (m) => (m.aleatorioCompartilhado ??= new AleatorioCS()) } },
  const: {},
  estatico: {},
}

// ---- métodos dos números (instância) --------------------------------------------------------------------------

export const METODOS_NUMERO = {
  ToString(m, v, args) {
    const [a, b] = args
    let fmt
    let cultura = m.cultura
    for (const x of [a, b]) {
      if (typeof x === 'string') fmt = x
      else if (x && x.ehCultura) cultura = x.cultura
    }
    return formatarNumero(v, fmt, cultura)
  },
  CompareTo: (m, v, [o]) => m.comparar(v, o),
  Equals: (m, v, [o]) => igualValor(m, v, o),
  GetHashCode: (m, v) => Number(BigInt.asIntN(32, BigInt(Math.trunc(comoNumero(v)) || 0))),
  GetType: (m, v) => m.bib.tipoValor(m.nomeDoTipoDe(v)),
  GetTypeCode: () => 0,
  IsNaN: (m, v) => Number.isNaN(comoNumero(v)),
  IsInfinity: (m, v) => !Number.isFinite(comoNumero(v)) && !Number.isNaN(comoNumero(v)),
}

export { ErroFormato, LIMITES, NOMES }
