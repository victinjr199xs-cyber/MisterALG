// Os valores do C# no interpretador.
//
//   null            → null              bool   → boolean            string → string
//   int             → number (inteiro)  long   → bigint
//   double          → Dbl               float  → Flt                decimal → Dec
//   char            → Chr               byte, sbyte, short, ushort, uint, ulong → Num
//   enum            → ValorEnum         tupla  → Tupla              array  → Arr
//   objeto de classe, struct ou record → Objeto
// O int é o número do JavaScript puro (é o mais comum e o mais rápido); os outros números ganham uma
// "etiqueta", para 5 / 2 ser 2 (int) e 5.0 / 2 ser 2,5 (double), como no C#.

let sequencia = 0

export class Dbl { constructor(v) { this.v = v } }
export class Flt { constructor(v) { this.v = Math.fround(v) } }
/** decimal: u (BigInt) dividido por 10^s. */
export class Dec { constructor(u, s = 0) { this.u = u; this.s = s } }
export class Chr { constructor(c) { this.c = c } }
/** byte, sbyte, short, ushort, uint (v: number) e ulong (v: bigint). */
export class Num { constructor(k, v) { this.k = k; this.v = v } }

export class ValorEnum {
  constructor(def, nome, v) { this.def = def; this.nome = nome; this.v = v }
}

export class Tupla {
  constructor(itens, nomes = null) { this.itens = itens; this.nomes = nomes }
}

/** Array (vetor, matriz, vetor de vetores). dims só existe nas matrizes (int[,]), com os dados em fila. */
export class Arr {
  constructor(tipoElem, itens, dims = null) { this.tipoElem = tipoElem; this.itens = itens; this.dims = dims; this.id = ++sequencia }
}

export class Objeto {
  constructor(cls) { this.cls = cls; this.campos = new Map(); this.id = ++sequencia }
}

/** Referência a uma variável, campo ou posição de array: é o que ref, out e as variáveis capturadas compartilham. */
export class Ref {
  constructor(v, t = null) { this.v = v; this.t = t }
}

export class RefElem {
  constructor(arr, i) { this.arr = arr; this.i = i }
  get v() { return this.arr.itens[this.i] }
  set v(x) { this.arr.itens[this.i] = x }
}

export class RefCampo {
  constructor(obj, nome) { this.obj = obj; this.nome = nome }
  get v() { return this.obj.campos.get(this.nome) }
  set v(x) { this.obj.campos.set(this.nome, x) }
}

export const proximoId = () => ++sequencia

// ---- tipos numéricos ---------------------------------------------------------------------------

export const LIMITES = {
  sbyte: [-128, 127], byte: [0, 255], short: [-32768, 32767], ushort: [0, 65535],
  int: [-2147483648, 2147483647], uint: [0, 4294967295],
}
export const NOMES_NUMERICOS = new Set(['sbyte', 'byte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'float', 'double', 'decimal', 'char'])

/** O nome do tipo numérico de um valor ('int', 'double'...), ou null se não for número. */
export function tipoNumerico(v) {
  if (typeof v === 'number') return 'int'
  if (typeof v === 'bigint') return 'long'
  if (v instanceof Dbl) return 'double'
  if (v instanceof Num) return v.k
  if (v instanceof Chr) return 'char'
  if (v instanceof Dec) return 'decimal'
  if (v instanceof Flt) return 'float'
  return null
}

/** O valor como número do JavaScript (para contas em ponto flutuante e índices). */
export function comoNumero(v) {
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Dbl || v instanceof Flt) return v.v
  if (v instanceof Num) return Number(v.v)
  if (v instanceof Chr) return v.c
  if (v instanceof Dec) return Number(v.u) / 10 ** v.s
  if (v instanceof ValorEnum) return v.v
  return NaN
}

export const ehInteiro = (v) => typeof v === 'number' || typeof v === 'bigint' || v instanceof Chr || (v instanceof Num) || v instanceof ValorEnum
export const ehNumero = (v) => tipoNumerico(v) !== null

// ---- decimal -----------------------------------------------------------------------------------

const DEC_MAX_ESCALA = 28
const POT10 = (n) => 10n ** BigInt(n)

export function decDeNumero(n) {
  if (!Number.isFinite(n)) throw new RangeError('Value was either too large or too small for a Decimal.')
  // O texto mais curto do double dá os dígitos que o aluno espera (0,1 e não 0,1000000000000000055...).
  const txt = n.toExponential(15 - 1).replace(/0+e/, 'e')
  const [mant, exp] = txt.split('e')
  const [inteira, frac = ''] = mant.replace('-', '').split('.')
  let escala = frac.length - Number(exp)
  let u = BigInt(inteira + frac)
  if (n < 0) u = -u
  if (escala < 0) {
    u *= POT10(-escala)
    escala = 0
  }
  return normalizarDec(new Dec(u, escala))
}

export function decDeTexto(texto) {
  const m = /^\s*([+-]?)(\d*)(?:[.,](\d*))?(?:[eE]([+-]?\d+))?\s*$/.exec(texto)
  if (!m || (m[2] === '' && !m[3])) return null
  let u = BigInt((m[2] || '0') + (m[3] ?? ''))
  let s = (m[3] ?? '').length
  if (m[4]) {
    const e = Number(m[4])
    if (e >= 0) u *= POT10(e)
    else s -= e
  }
  if (m[1] === '-') u = -u
  return normalizarDec(new Dec(u, s))
}

function normalizarDec(d) {
  let { u, s } = d
  while (s > DEC_MAX_ESCALA) {
    u /= 10n
    s -= 1
  }
  return new Dec(u, s)
}

const alinhar = (a, b) => {
  const s = Math.max(a.s, b.s)
  return [a.u * POT10(s - a.s), b.u * POT10(s - b.s), s]
}

export const decSomar = (a, b) => { const [x, y, s] = alinhar(a, b); return normalizarDec(new Dec(x + y, s)) }
export const decSubtrair = (a, b) => { const [x, y, s] = alinhar(a, b); return normalizarDec(new Dec(x - y, s)) }
export const decMultiplicar = (a, b) => normalizarDec(new Dec(a.u * b.u, a.s + b.s))
export function decDividir(a, b) {
  if (b.u === 0n) throw new DivisaoPorZero()
  const escalaExtra = DEC_MAX_ESCALA
  const num = a.u * POT10(escalaExtra + b.s)
  const den = b.u * POT10(a.s)
  let q = num / den
  const resto = num % den
  if (resto * 2n >= (den < 0n ? -den : den) && resto !== 0n) q += (num < 0n) !== (den < 0n) ? -1n : 1n
  // O .NET dá o resultado com a menor escala que o representa, mas nunca menor que a do dividendo menos a do divisor.
  let r = new Dec(q, escalaExtra)
  const minima = Math.max(0, a.s - b.s)
  while (r.s > minima && r.u % 10n === 0n) r = new Dec(r.u / 10n, r.s - 1)
  return r
}
export const decComparar = (a, b) => { const [x, y] = alinhar(a, b); return x < y ? -1 : x > y ? 1 : 0 }
export const decParaNumero = (d) => Number(d.u) / 10 ** d.s

export function decParaTexto(d, virgula = true) {
  const negativo = d.u < 0n
  let dig = (negativo ? -d.u : d.u).toString()
  if (d.s > 0) {
    dig = dig.padStart(d.s + 1, '0')
    dig = `${dig.slice(0, -d.s)}.${dig.slice(-d.s)}`
  }
  if (virgula) dig = dig.replace('.', ',')
  return (negativo ? '-' : '') + dig
}

/** Arredonda para n casas (modo: 'par' = banker's, o padrão do C#; 'longe' = para longe do zero). */
export function decArredondar(d, casas, modo = 'par') {
  if (d.s <= casas) return d
  const fator = POT10(d.s - casas)
  let q = d.u / fator
  const resto = d.u % fator
  const dobro = (resto < 0n ? -resto : resto) * 2n
  if (dobro > fator || (dobro === fator && (modo === 'longe' || q % 2n !== 0n))) q += d.u < 0n ? -1n : 1n
  return new Dec(q, casas)
}

// ---- exceção interna para a divisão por zero (a máquina a transforma numa DivideByZeroException) ----

export class DivisaoPorZero extends Error {}

// ---- conversão para um tipo numérico -----------------------------------------------------------

const envolver = (v, k) => {
  if (k === 'int') return v | 0
  if (k === 'uint') return v >>> 0
  const [min, max] = LIMITES[k]
  const faixa = max - min + 1
  return ((((v - min) % faixa) + faixa) % faixa) + min
}

/** Converte um número para o tipo k ('int', 'double'...), truncando e dando a volta como o C# (unchecked). */
export function converterNumero(v, k) {
  if (k === 'double') return tipoNumerico(v) === 'double' ? v : new Dbl(v instanceof Dec ? decParaNumero(v) : comoNumero(v))
  if (k === 'float') return v instanceof Flt ? v : new Flt(v instanceof Dec ? decParaNumero(v) : comoNumero(v))
  if (k === 'decimal') {
    if (v instanceof Dec) return v
    if (typeof v === 'number') return new Dec(BigInt(v), 0)
    if (typeof v === 'bigint') return new Dec(v, 0)
    if (v instanceof Num || v instanceof Chr) return new Dec(BigInt(comoNumero(v)), 0)
    return decDeNumero(comoNumero(v))
  }
  if (k === 'char') return v instanceof Chr ? v : new Chr(comoNumero(v) & 0xffff)
  if (k === 'long' || k === 'ulong') {
    let b
    if (typeof v === 'bigint') b = v
    else if (v instanceof Num && typeof v.v === 'bigint') b = v.v
    else {
      const n = v instanceof Dec ? decParaNumero(v) : comoNumero(v)
      b = BigInt(Number.isFinite(n) ? Math.trunc(n) : 0)
    }
    if (k === 'long') return BigInt.asIntN(64, b)
    return new Num('ulong', BigInt.asUintN(64, b))
  }
  // sbyte, byte, short, ushort, int, uint
  let n
  if (typeof v === 'bigint') n = Number(BigInt.asIntN(32, v))
  else if (v instanceof Num && typeof v.v === 'bigint') n = Number(BigInt.asIntN(32, v.v))
  else {
    n = v instanceof Dec ? decParaNumero(v) : comoNumero(v)
    n = Number.isFinite(n) ? Math.trunc(n) : 0
    if (!Number.isSafeInteger(n)) n = 0
  }
  const r = envolver(n, k)
  return k === 'int' ? r : new Num(k, r)
}

/** O valor (truncado) cabe no tipo inteiro k? Usado nas conversões dentro de checked. */
export function cabeEm(v, k) {
  const n = v instanceof Dec ? decParaNumero(v) : typeof v === 'bigint' ? v : v instanceof Num && typeof v.v === 'bigint' ? v.v : comoNumero(v)
  if (typeof n === 'number' && !Number.isFinite(n)) return false
  const t = typeof n === 'bigint' ? n : BigInt(Math.trunc(n))
  if (k === 'long') return t >= -(2n ** 63n) && t < 2n ** 63n
  if (k === 'ulong') return t >= 0n && t < 2n ** 64n
  if (LIMITES[k]) return t >= BigInt(LIMITES[k][0]) && t <= BigInt(LIMITES[k][1])
  return true
}

/** Dos dois operandos, o tipo em que a conta é feita (a "promoção numérica" do C#). */
export function tipoDaConta(a, b) {
  const ta = tipoNumerico(a)
  const tb = tipoNumerico(b)
  if (ta === 'decimal' || tb === 'decimal') return 'decimal'
  if (ta === 'double' || tb === 'double') return 'double'
  if (ta === 'float' || tb === 'float') return 'float'
  if (ta === 'ulong' || tb === 'ulong') return 'ulong'
  if (ta === 'long' || tb === 'long') return 'long'
  if (ta === 'uint' || tb === 'uint') return (ta === 'int' || tb === 'int' || ta === 'sbyte' || tb === 'sbyte' || ta === 'short' || tb === 'short') ? 'long' : 'uint'
  return 'int'
}

// ---- formatação de double (o texto mais curto, com as regras do .NET) -----------------------------

/** double.ToString(): "R" do .NET Core 3.0+ — o mais curto que volta ao mesmo número; E+15 a partir de 1e15. */
export function textoDouble(n, virgula = true) {
  if (Number.isNaN(n)) return 'NaN'
  if (n === Infinity) return virgula ? '∞' : 'Infinity'
  if (n === -Infinity) return virgula ? '-∞' : '-Infinity'
  if (n === 0) return Object.is(n, -0) ? '-0' : '0'
  const [mant, expTexto] = n.toExponential().split('e')
  const exp = Number(expTexto)
  const digitos = mant.replace('-', '').replace('.', '')
  const sinal = n < 0 ? '-' : ''
  let r
  if (exp >= 15 || exp < -4) {
    const m = digitos.length > 1 ? `${digitos[0]}.${digitos.slice(1)}` : digitos
    r = `${sinal}${m}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`
  } else if (exp >= 0) {
    r = digitos.length <= exp + 1 ? `${sinal}${digitos.padEnd(exp + 1, '0')}` : `${sinal}${digitos.slice(0, exp + 1)}.${digitos.slice(exp + 1)}`
  } else {
    r = `${sinal}0.${'0'.repeat(-exp - 1)}${digitos}`
  }
  return virgula ? r.replace('.', ',') : r
}

/** float.ToString(): o mais curto para 32 bits. */
export function textoFloat(n, virgula = true) {
  if (!Number.isFinite(n)) return textoDouble(n, virgula)
  for (let p = 1; p <= 9; p += 1) {
    const t = Number(n.toPrecision(p))
    if (Math.fround(t) === n) return textoDouble(t, virgula)
  }
  return textoDouble(n, virgula)
}
