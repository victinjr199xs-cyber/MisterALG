// printf e scanf do passo a passo. Os textos são "binários" (um caractere do JS
// por byte), como na memória do C; a conversão para UTF-8 acontece só na tela.

import { ErroC } from './erros.js'

const DIRETIVA = /^([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d*))?(hh|h|ll|l|L|z|j|t)?([diouxXeEfFgGaAcspn%])/

const bitsDe = (arg, mod) => {
  if (mod === 'hh') return 8
  if (mod === 'h') return 16
  if (mod === 'll' || mod === 'j') return 64
  return Math.max(32, (arg.tipo?.tamanho ?? 4) * 8)
}

function exponencial(v, prec, maiusculo) {
  let s = v.toExponential(prec).replace(/e([+-])(\d)$/, 'e$10$2')
  if (maiusculo) s = s.toUpperCase()
  return s
}

/** %g do C: escolhe entre %f e %e e tira os zeros do final (a não ser com #). */
function geral(v, prec, alternativo, maiusculo) {
  const p = prec === 0 ? 1 : prec
  if (v === 0) return alternativo ? (0).toFixed(p - 1) : '0'
  const x = Math.floor(Math.log10(Math.abs(Number(v.toExponential(p - 1)))))
  let s = p > x && x >= -4 ? v.toFixed(p - 1 - x) : exponencial(v, p - 1, maiusculo)
  if (!alternativo) s = s.replace(/\.?0+(e|E|$)/, '$1').replace(/(\.\d*?)0+(e|E)/, '$1$2')
  return s
}

/** printf: `args` são {valor, tipo} já com as promoções do C (float vira double, char vira int). */
export function formatar(formato, args, lerCadeia) {
  let saida = ''
  let a = 0
  const proximo = () => {
    if (a >= args.length) throw new ErroC('o printf pede mais valores do que os que foram passados')
    return args[a++]
  }
  for (let i = 0; i < formato.length;) {
    const c = formato[i++]
    if (c !== '%') { saida += c; continue }
    const m = DIRETIVA.exec(formato.slice(i))
    if (!m) { saida += '%'; continue }
    i += m[0].length
    let [, flags, largura, precisao, mod, conv] = m
    if (conv === '%') { saida += '%'; continue }
    if (largura === '*') {
      largura = Number(proximo().valor)
      if (largura < 0) { flags += '-'; largura = -largura }
    }
    if (precisao === '*') {
      precisao = Number(proximo().valor)
      if (precisao < 0) precisao = undefined
    }
    largura = largura === undefined ? 0 : Number(largura)
    precisao = precisao === undefined ? undefined : Number(precisao || 0)
    const arg = proximo()
    let corpo = ''
    let sinal = ''
    let numerico = true
    switch (conv) {
      case 'd': case 'i': {
        let v = BigInt.asIntN(bitsDe(arg, mod), BigInt(typeof arg.valor === 'number' ? Math.trunc(arg.valor) : arg.valor))
        if (v < 0n) { sinal = '-'; v = -v } else if (flags.includes('+')) sinal = '+'
        else if (flags.includes(' ')) sinal = ' '
        corpo = precisao === 0 && v === 0n ? '' : v.toString().padStart(precisao ?? 1, '0')
        break
      }
      case 'u': case 'o': case 'x': case 'X': {
        const v = BigInt.asUintN(bitsDe(arg, mod), BigInt(typeof arg.valor === 'number' ? Math.trunc(arg.valor) : arg.valor))
        const base = conv === 'u' ? 10 : conv === 'o' ? 8 : 16
        corpo = precisao === 0 && v === 0n ? '' : v.toString(base).padStart(precisao ?? 1, '0')
        if (conv === 'X') corpo = corpo.toUpperCase()
        if (flags.includes('#') && v !== 0n && base !== 10) corpo = (base === 8 ? '0' : conv === 'X' ? '0X' : '0x') + corpo
        break
      }
      case 'c':
        corpo = String.fromCharCode(Number(arg.valor) & 0xff)
        numerico = false
        break
      case 's':
        corpo = arg.valor === 0 ? '(null)' : lerCadeia(arg.valor, precisao)
        if (precisao !== undefined) corpo = corpo.slice(0, precisao)
        numerico = false
        break
      case 'p':
        corpo = arg.valor === 0 ? '(nil)' : `0x${(Number(arg.valor) >>> 0).toString(16)}`
        numerico = false
        break
      case 'n':
        continue
      default: { // f F e E g G a A
        let v = Number(arg.valor)
        if (v < 0 || Object.is(v, -0)) { sinal = '-'; v = -v } else if (flags.includes('+')) sinal = '+'
        else if (flags.includes(' ')) sinal = ' '
        const maiusculo = conv === conv.toUpperCase()
        if (!Number.isFinite(v)) {
          corpo = Number.isNaN(v) ? 'nan' : 'inf'
          if (maiusculo) corpo = corpo.toUpperCase()
          numerico = false
        } else if (conv === 'f' || conv === 'F') corpo = v.toFixed(Math.min(precisao ?? 6, 100))
        else if (conv === 'e' || conv === 'E') corpo = exponencial(v, Math.min(precisao ?? 6, 100), maiusculo)
        else if (conv === 'a' || conv === 'A') corpo = v.toString(16)
        else corpo = geral(v, Math.min(precisao ?? 6, 100), flags.includes('#'), maiusculo)
      }
    }
    const tamanho = sinal.length + corpo.length
    if (tamanho >= largura) saida += sinal + corpo
    else if (flags.includes('-')) saida += sinal + corpo + ' '.repeat(largura - tamanho)
    else if (flags.includes('0') && numerico && !(precisao !== undefined && 'diouxX'.includes(conv))) {
      saida += sinal + '0'.repeat(largura - tamanho) + corpo
    } else saida += ' '.repeat(largura - tamanho) + sinal + corpo
  }
  return saida
}

const espaco = (c) => c === 32 || (c >= 9 && c <= 13)
const digitoNaBase = (c, base) => {
  const d = c >= 48 && c <= 57 ? c - 48 : c >= 97 && c <= 122 ? c - 87 : c >= 65 && c <= 90 ? c - 55 : 99
  return d < base
}

/**
 * scanf/sscanf. `leitor` tem *espiar() (código do próximo caractere ou -1 no fim; pode
 * pedir mais entrada) e avancar(). `gravar(indice, valor, conversao)` guarda no destino.
 * Devolve quantos valores foram guardados, ou -1 (EOF) se a entrada acabou antes do primeiro.
 */
export function* escanear(leitor, formato, gravar) {
  let atribuidos = 0
  let destino = 0
  let algumaConversao = false
  const fim = () => (!algumaConversao ? -1 : atribuidos)
  for (let i = 0; i < formato.length;) {
    const c = formato.charCodeAt(i)
    if (espaco(c)) {
      i += 1
      while (espaco(yield* leitor.espiar())) leitor.avancar()
      continue
    }
    if (c !== 37) { // literal
      i += 1
      const ch = yield* leitor.espiar()
      if (ch === -1) return fim()
      if (ch !== c) return atribuidos
      leitor.avancar()
      continue
    }
    i += 1
    let suprimir = false
    if (formato[i] === '*') { suprimir = true; i += 1 }
    let largura = ''
    while (/\d/.test(formato[i] ?? '')) largura += formato[i++]
    const maxima = largura ? Number(largura) : Infinity
    const mod = /^(hh|h|ll|l|L|z|j|t)/.exec(formato.slice(i))?.[1] ?? ''
    i += mod.length
    let conv = formato[i++]
    let conjunto = null
    if (conv === '[') {
      let j = i
      let negar = false
      if (formato[j] === '^') { negar = true; j += 1 }
      if (formato[j] === ']') j += 1
      while (j < formato.length && formato[j] !== ']') j += 1
      const corpo = formato.slice(negar ? i + 1 : i, j)
      i = j + 1
      const permitidos = new Set()
      for (let k = 0; k < corpo.length; k += 1) {
        if (corpo[k + 1] === '-' && k + 2 < corpo.length) {
          for (let x = corpo.charCodeAt(k); x <= corpo.charCodeAt(k + 2); x += 1) permitidos.add(x)
          k += 2
        } else permitidos.add(corpo.charCodeAt(k))
      }
      conjunto = (ch) => ch !== -1 && permitidos.has(ch) !== negar
    }
    if (conv === '%') {
      while (espaco(yield* leitor.espiar())) leitor.avancar()
      if ((yield* leitor.espiar()) !== 37) return atribuidos
      leitor.avancar()
      continue
    }
    if (conv === 'n') {
      if (!suprimir) gravar(destino++, 0, conv)
      continue
    }
    if (conv !== 'c' && conv !== '[') while (espaco(yield* leitor.espiar())) leitor.avancar()
    if ((yield* leitor.espiar()) === -1) return fim()

    let texto = ''
    const pegar = function* (aceita) {
      while (texto.length < maxima) {
        const ch = yield* leitor.espiar()
        if (ch === -1 || !aceita(ch, texto)) break
        texto += String.fromCharCode(ch)
        leitor.avancar()
      }
    }
    let valor
    if ('diuoxX'.includes(conv)) {
      let base = conv === 'o' ? 8 : conv === 'x' || conv === 'X' ? 16 : 10
      yield* pegar((ch, t) => {
        if (t === '' && (ch === 43 || ch === 45)) return true
        const corpo = t.replace(/^[+-]/, '')
        if (conv === 'i' && corpo === '0' && (ch === 120 || ch === 88)) { base = 16; return true }
        if (conv === 'i' && corpo === '' && ch === 48) base = 8
        if ((conv === 'x' || conv === 'X') && corpo === '0' && (ch === 120 || ch === 88)) return true
        if (conv === 'i' && base === 8 && corpo === '0' && digitoNaBase(ch, 10) && !digitoNaBase(ch, 8)) return false
        return digitoNaBase(ch, base)
      })
      const limpo = texto.replace(/^([+-]?)0[xX]/, '$1')
      if (!/\d|[a-fA-F]/.test(limpo.replace(/^[+-]/, ''))) return atribuidos
      const negativo = limpo.startsWith('-')
      const digitos = limpo.replace(/^[+-]/, '')
      let v = 0n
      for (const d of digitos) v = v * BigInt(base) + BigInt(parseInt(d, base))
      valor = negativo ? -v : v
    } else if ('fFeEgGaA'.includes(conv)) {
      yield* pegar((ch, t) => {
        const s = t + String.fromCharCode(ch)
        return /^[+-]?(\d*\.?\d*([eE][+-]?\d*)?|i(n(f(i(n(i(t(y)?)?)?)?)?)?)?|n(a(n)?)?)$/i.test(s)
      })
      const v = Number(texto.replace(/^([+-]?)inf(inity)?$/i, '$1Infinity').replace(/^[+-]?nan$/i, 'NaN'))
      if (texto === '' || texto === '+' || texto === '-' || texto === '.' || (Number.isNaN(v) && !/nan/i.test(texto))) return atribuidos
      valor = v
    } else if (conv === 'c') {
      const n = largura ? maxima : 1
      for (let k = 0; k < n; k += 1) {
        const ch = yield* leitor.espiar()
        if (ch === -1) break
        texto += String.fromCharCode(ch)
        leitor.avancar()
      }
      if (!texto) return fim()
      valor = texto
    } else if (conv === 's') {
      yield* pegar((ch) => !espaco(ch))
      valor = texto
    } else if (conv === '[') {
      yield* pegar((ch) => conjunto(ch))
      if (!texto) return atribuidos
      valor = texto
    } else if (conv === 'p') {
      yield* pegar((ch) => digitoNaBase(ch, 16) || ch === 120)
      valor = Number.parseInt(texto, 16) || 0
    } else {
      throw new ErroC(`o scanf ainda não entende %${conv} no passo a passo`)
    }
    algumaConversao = true
    if (!suprimir) {
      gravar(destino++, valor, conv, mod)
      atribuidos += 1
    }
  }
  return atribuidos
}
