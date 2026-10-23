// Os operadores do C#: contas com a promoção numérica, texto, comparação e igualdade.

import {
  Arr, Chr, Dbl, DivisaoPorZero, Flt, Num, Objeto, Tupla, ValorEnum,
  comoNumero, converterNumero, decComparar, decDividir, decMultiplicar, decParaNumero, decSomar, decSubtrair, ehNumero,
  tipoDaConta, tipoNumerico, Dec,
} from './valores.js'

export class Multicast {
  constructor(itens) { this.itens = itens }
}

const estouro = (m) => m.excecao('OverflowException', 'Arithmetic operation resulted in an overflow.')

/** Dois delegates são o mesmo método (no mesmo objeto)? Serve para o -= de eventos. */
function igualFuncao(a, b) {
  if (a === b) return true
  if (a.md && b.md) return a.md === b.md && a.este === b.este
  if (a.candidatos && b.candidatos) return a.nome === b.nome && a.este === b.este
  if (a.md && b.candidatos) return b.candidatos.includes(a.md) && a.este === b.este
  if (a.candidatos && b.md) return a.candidatos.includes(b.md) && a.este === b.este
  return false
}

const comoBig = (v) => {
  if (typeof v === 'bigint') return v
  if (v instanceof Num) return BigInt(v.v)
  if (v instanceof Chr) return BigInt(v.c)
  if (typeof v === 'number') return BigInt(v)
  return BigInt(Math.trunc(comoNumero(v)))
}

/** Conta entre dois números de tipos possivelmente diferentes. op: + - * / % */
function contaNumerica(op, a, b, m = null) {
  const k = tipoDaConta(a, b)
  switch (k) {
    case 'double': {
      const x = a instanceof Dec ? decParaNumero(a) : comoNumero(a)
      const y = b instanceof Dec ? decParaNumero(b) : comoNumero(b)
      return new Dbl(op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : x % y)
    }
    case 'float': {
      const x = comoNumero(a)
      const y = comoNumero(b)
      return new Flt(op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : x % y)
    }
    case 'decimal': {
      const x = converterNumero(a, 'decimal')
      const y = converterNumero(b, 'decimal')
      if (op === '+') return decSomar(x, y)
      if (op === '-') return decSubtrair(x, y)
      if (op === '*') return decMultiplicar(x, y)
      if (op === '/') return decDividir(x, y)
      if (y.u === 0n) throw new DivisaoPorZero()
      const q = decDividir(x, y)
      const inteiro = new Dec(q.u / 10n ** BigInt(q.s), 0)
      return decSubtrair(x, decMultiplicar(inteiro, y))
    }
    case 'long':
    case 'ulong': {
      const x = comoBig(a)
      const y = comoBig(b)
      let r
      if (op === '+') r = x + y
      else if (op === '-') r = x - y
      else if (op === '*') r = x * y
      else {
        if (y === 0n) throw new DivisaoPorZero()
        r = op === '/' ? x / y : x % y
      }
      if (m?.verificado && (k === 'long' ? BigInt.asIntN(64, r) !== r : BigInt.asUintN(64, r) !== r)) throw estouro(m)
      return k === 'long' ? BigInt.asIntN(64, r) : new Num('ulong', BigInt.asUintN(64, r))
    }
    case 'uint': {
      const x = comoNumero(a)
      const y = comoNumero(b)
      let r
      if (op === '+') r = x + y
      else if (op === '-') r = x - y
      else if (op === '*') r = Number(BigInt(x) * BigInt(y))
      else {
        if (y === 0) throw new DivisaoPorZero()
        r = op === '/' ? Math.trunc(x / y) : x % y
      }
      return new Num('uint', Number(BigInt.asUintN(32, BigInt(Math.trunc(r)))))
    }
    default: {
      const x = comoNumero(a)
      const y = comoNumero(b)
      if (op === '+' || op === '-' || op === '*') {
        const r = op === '+' ? x + y : op === '-' ? x - y : x * y
        if (m?.verificado && (r > 2147483647 || r < -2147483648)) throw estouro(m)
        return op === '*' ? Math.imul(x, y) : r | 0
      }
      if (y === 0) throw new DivisaoPorZero()
      return op === '/' ? Math.trunc(x / y) | 0 : x % y | 0
    }
  }
}

/** Compara dois números (-1, 0, 1; NaN se algum for NaN). */
export function compararNumeros(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  const ta = tipoNumerico(a)
  const tb = tipoNumerico(b)
  if (ta === 'decimal' || tb === 'decimal') {
    if (ta === 'double' || tb === 'double' || ta === 'float' || tb === 'float') {
      const x = comoNumero(a)
      const y = comoNumero(b)
      return x < y ? -1 : x > y ? 1 : 0
    }
    return decComparar(converterNumero(a, 'decimal'), converterNumero(b, 'decimal'))
  }
  const inteiros = (t) => t !== 'double' && t !== 'float'
  if (inteiros(ta) && inteiros(tb) && (typeof a === 'bigint' || typeof b === 'bigint' || ta === 'ulong' || tb === 'ulong')) {
    const x = comoBig(a)
    const y = comoBig(b)
    return x < y ? -1 : x > y ? 1 : 0
  }
  const x = comoNumero(a)
  const y = comoNumero(b)
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN
  return x < y ? -1 : x > y ? 1 : 0
}

const igualEnum = (a, b) => a.def === b.def && a.v === b.v

/** a == b do C# (para ==, !=, e a base do Equals). `m` resolve operadores e Equals definidos pelo aluno. */
export function igualdade(m, a, b) {
  if (a === b) return typeof a !== 'number' || !Number.isNaN(a)
  if (a === null || b === null || a === undefined || b === undefined) return false
  if (typeof a === 'string' || typeof b === 'string') return false
  if (typeof a === 'boolean' || typeof b === 'boolean') return false
  if (ehNumero(a) && ehNumero(b)) return compararNumeros(a, b) === 0
  if (a instanceof ValorEnum && b instanceof ValorEnum) return igualEnum(a, b)
  if (a instanceof ValorEnum && ehNumero(b)) return a.v === comoNumero(b) // enum == 0
  if (b instanceof ValorEnum && ehNumero(a)) return b.v === comoNumero(a)
  if (a instanceof Tupla && b instanceof Tupla) return a.itens.length === b.itens.length && a.itens.every((x, i) => igualdade(m, x, b.itens[i]))
  if (a instanceof Objeto || b instanceof Objeto) return m.igualObjetos(a, b)
  return false
}

/** object.Equals(a, b): como ==, mas strings e records comparam o conteúdo, e o Equals do aluno vale. */
export function igualValor(m, a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return a == b
  if (a instanceof Objeto) return m.equalsObjeto(a, b)
  if (a instanceof Arr || b instanceof Arr) return a === b
  return igualdade(m, a, b)
}

const mascarar = (a, b, f) => {
  const k = tipoDaConta(a, b)
  if (k === 'long' || k === 'ulong') {
    const r = f(comoBig(a), comoBig(b))
    return k === 'long' ? BigInt.asIntN(64, r) : new Num('ulong', BigInt.asUintN(64, r))
  }
  const r = f(BigInt(comoNumero(a)), BigInt(comoNumero(b)))
  if (k === 'uint') return new Num('uint', Number(BigInt.asUintN(32, r)))
  return Number(BigInt.asIntN(32, r))
}

function deslocar(op, a, b) {
  const n = comoNumero(b)
  const ta = tipoNumerico(a)
  if (ta === 'long' || ta === 'ulong') {
    const c = BigInt(n & 63)
    const x = comoBig(a)
    if (ta === 'long') return BigInt.asIntN(64, op === '<<' ? x << c : x >> c)
    return new Num('ulong', BigInt.asUintN(64, op === '<<' ? x << c : x >> c))
  }
  const x = comoNumero(a)
  const c = n & 31
  if (ta === 'uint') return new Num('uint', op === '<<' ? (x << c) >>> 0 : x >>> c)
  return op === '<<' ? x << c : x >> c
}

/** Operadores binários que não dependem de curto-circuito. Devolve undefined se não souber (a máquina tenta operador do aluno). */
export function binario(m, op, a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    switch (op) {
      case '+': { const r = a + b; if (m.verificado && (r > 2147483647 || r < -2147483648)) throw estouro(m); return r | 0 }
      case '-': { const r = a - b; if (m.verificado && (r > 2147483647 || r < -2147483648)) throw estouro(m); return r | 0 }
      case '*': { if (m.verificado) { const r = a * b; if (r > 2147483647 || r < -2147483648) throw estouro(m) } return Math.imul(a, b) }
      case '/': if (b === 0) throw new DivisaoPorZero(); return Math.trunc(a / b) | 0
      case '%': if (b === 0) throw new DivisaoPorZero(); return a % b | 0
      case '<': return a < b
      case '>': return a > b
      case '<=': return a <= b
      case '>=': return a >= b
      case '==': return a === b
      case '!=': return a !== b
      case '&': return a & b
      case '|': return a | b
      case '^': return a ^ b
      case '<<': return a << (b & 31)
      case '>>': return a >> (b & 31)
      case '>>>': return a >>> (b & 31)
      default:
    }
  }
  switch (op) {
    case '+':
      if (typeof a === 'string' || typeof b === 'string') return m.aTexto(a) + m.aTexto(b)
      if (a instanceof Multicast || b instanceof Multicast || (a && a.ehFunc) || (b && b.ehFunc)) return combinar(a, b)
      if (ehNumero(a) && ehNumero(b)) return contaNumerica('+', a, b, m)
      if (a instanceof ValorEnum || b instanceof ValorEnum) return enumConta(a, b, '+')
      return undefined
    case '-':
      if (a instanceof Multicast || (a && a.ehFunc)) return remover(a, b)
      if (ehNumero(a) && ehNumero(b)) return contaNumerica('-', a, b, m)
      if (a instanceof ValorEnum || b instanceof ValorEnum) return enumConta(a, b, '-')
      return undefined
    case '*': case '/': case '%':
      return ehNumero(a) && ehNumero(b) ? contaNumerica(op, a, b, m) : undefined
    case '==': return igualdade(m, a, b)
    case '!=': return !igualdade(m, a, b)
    case '<': case '>': case '<=': case '>=': {
      if (a instanceof ValorEnum && b instanceof ValorEnum) {
        const c = a.v - b.v
        return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0
      }
      if (a instanceof ValorEnum && ehNumero(b)) a = a.v
      else if (b instanceof ValorEnum && ehNumero(a)) b = b.v
      if (!(ehNumero(a) && ehNumero(b))) return undefined
      const c = compararNumeros(a, b)
      if (Number.isNaN(c)) return false
      return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0
    }
    case '&': case '|': case '^':
      if (typeof a === 'boolean' && typeof b === 'boolean') return op === '&' ? a && b : op === '|' ? a || b : a !== b
      if (a instanceof ValorEnum && b instanceof ValorEnum) return enumBits(a, b, op)
      if (ehNumero(a) && ehNumero(b)) return mascarar(a, b, op === '&' ? (x, y) => x & y : op === '|' ? (x, y) => x | y : (x, y) => x ^ y)
      return undefined
    case '<<': case '>>': case '>>>':
      return ehNumero(a) && ehNumero(b) ? deslocar(op === '>>>' ? '>>' : op, a, b) : undefined
    default:
      return undefined
  }
}

function enumConta(a, b, op) {
  const x = a instanceof ValorEnum ? a.v : comoNumero(a)
  const y = b instanceof ValorEnum ? b.v : comoNumero(b)
  const v = op === '+' ? x + y : x - y
  const def = a instanceof ValorEnum ? a.def : b.def
  return a instanceof ValorEnum && b instanceof ValorEnum ? v : def.valorDe(v)
}

function enumBits(a, b, op) {
  const v = op === '&' ? a.v & b.v : op === '|' ? a.v | b.v : a.v ^ b.v
  return a.def.valorDe(v)
}

function combinar(a, b) {
  if (a === null) return b
  if (b === null) return a
  const lista = (x) => (x instanceof Multicast ? x.itens : [x])
  return new Multicast([...lista(a), ...lista(b)])
}

function remover(a, b) {
  const itens = (a instanceof Multicast ? a.itens : [a]).slice()
  for (const x of b instanceof Multicast ? b.itens : [b]) {
    let i = -1
    for (let k = itens.length - 1; k >= 0 && i < 0; k -= 1) if (igualFuncao(itens[k], x)) i = k
    if (i >= 0) itens.splice(i, 1)
  }
  return itens.length === 0 ? null : itens.length === 1 ? itens[0] : new Multicast(itens)
}

/** Operadores unários: - + ! ~ (o ++ e -- ficam com a máquina, que sabe onde guardar). */
export function unario(m, op, a) {
  switch (op) {
    case '-':
      if (typeof a === 'number') return -a | 0
      if (a instanceof Dbl) return new Dbl(-a.v)
      if (a instanceof Flt) return new Flt(-a.v)
      if (typeof a === 'bigint') return BigInt.asIntN(64, -a)
      if (a instanceof Dec) return new Dec(-a.u, a.s)
      if (a instanceof Num || a instanceof Chr) return converterNumero(-comoNumero(a), a instanceof Chr ? 'int' : a.k === 'uint' ? 'long' : 'int')
      return undefined
    case '+':
      return ehNumero(a) ? (a instanceof Chr ? a.c : a) : undefined
    case '!':
      return typeof a === 'boolean' ? !a : undefined
    case '~':
      if (typeof a === 'number') return ~a
      if (typeof a === 'bigint') return BigInt.asIntN(64, ~a)
      if (a instanceof Num) return a.k === 'ulong' ? new Num('ulong', BigInt.asUintN(64, ~a.v)) : a.k === 'uint' ? new Num('uint', ~a.v >>> 0) : ~a.v
      if (a instanceof Chr) return ~a.c
      if (a instanceof ValorEnum) return a.def.valorDe(~a.v)
      return undefined
    default:
      return undefined
  }
}

/** x + 1 e x - 1 mantendo o tipo de x (para ++ e --). */
export function maisUm(a, delta, m = null) {
  if (typeof a === 'number') {
    const r = a + delta
    if (m?.verificado && (r > 2147483647 || r < -2147483648)) throw estouro(m)
    return r | 0
  }
  if (typeof a === 'bigint') {
    const r = a + BigInt(delta)
    if (m?.verificado && BigInt.asIntN(64, r) !== r) throw estouro(m)
    return BigInt.asIntN(64, r)
  }
  if (a instanceof Dbl) return new Dbl(a.v + delta)
  if (a instanceof Flt) return new Flt(a.v + delta)
  if (a instanceof Chr) return new Chr((a.c + delta) & 0xffff)
  if (a instanceof Dec) return contaNumerica(delta > 0 ? '+' : '-', a, 1)
  if (a instanceof Num) return converterNumero(comoNumero(a) + delta, a.k)
  if (a instanceof ValorEnum) return a.def.valorDe(a.v + delta)
  return undefined
}
