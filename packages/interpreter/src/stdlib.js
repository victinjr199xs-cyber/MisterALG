// As 28 funções pré-definidas (docs/spec/_sintese-A-linguagem.md §4).
// Cada função recebe valores tipados {t, v} e devolve um valor tipado.

import { caractere1252, codigo1252 } from './codificacao.js'
import { erro } from './erros.js'
import { textoReal } from './formatos.js'

const I = (v) => ({ t: 'I', v })
const R = (v) => ({ t: 'R', v })
const C = (v) => ({ t: 'C', v })

const NOMES_TIPO = { I: 'INTEIRO', R: 'REAL', C: 'CARACTER', L: 'LOGICO' }

function numero(arg, linha) {
  if (arg.t !== 'I' && arg.t !== 'R') throw erro(29, linha, 'INTEIRO ou REAL')
  return arg.v
}

function texto(arg, linha) {
  if (arg.t !== 'C') throw erro(29, linha, NOMES_TIPO.C)
  return arg.v
}

function dominio(ok, nome, linha) {
  if (!ok) throw erro(51, linha, nome)
}

const maiusculaAscii = (s) => s.replace(/[a-z]/g, (c) => c.toUpperCase())
const minusculaAscii = (s) => s.replace(/[A-Z]/g, (c) => c.toLowerCase())

/** Converte texto em número como caracpnum/leia: inteiro se não tiver ponto. */
export function textoParaNumero(bruto, linha) {
  const s = bruto.trim()
  if (/^[+-]?\d+$/.test(s)) return I(Number(s))
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return R(Number(s))
  throw erro(49, linha, bruto)
}

/** nome normalizado → { aridade, fn(args, ctx) }. ctx = { linha, rng } */
export const FUNCOES_EMBUTIDAS = {
  ABS: { aridade: 1, fn: ([x], { linha }) => ({ t: x.t === 'I' ? 'I' : 'R', v: Math.abs(numero(x, linha)) }) },
  ARCCOS: {
    aridade: 1,
    fn: ([x], { linha }) => {
      const v = numero(x, linha)
      dominio(v >= -1 && v <= 1, 'ARCCOS', linha)
      return R(Math.acos(v))
    },
  },
  ARCSEN: {
    aridade: 1,
    fn: ([x], { linha }) => {
      const v = numero(x, linha)
      dominio(v >= -1 && v <= 1, 'ARCSEN', linha)
      return R(Math.asin(v))
    },
  },
  ARCTAN: { aridade: 1, fn: ([x], { linha }) => R(Math.atan(numero(x, linha))) },
  ASC: {
    aridade: 1,
    fn: ([s], { linha }) => {
      const v = texto(s, linha)
      return I(v === '' ? 0 : codigo1252(v[0]))
    },
  },
  CARAC: { aridade: 1, fn: ([c], { linha }) => C(caractere1252(Math.trunc(numero(c, linha)))) },
  CARACPNUM: { aridade: 1, fn: ([s], { linha }) => textoParaNumero(texto(s, linha), linha) },
  COMPR: { aridade: 1, fn: ([s], { linha }) => I(texto(s, linha).length) },
  COPIA: {
    aridade: 3,
    fn: ([s, p, n], { linha }) => {
      const v = texto(s, linha)
      const inicio = Math.max(Math.trunc(numero(p, linha)), 1)
      const quantos = Math.trunc(numero(n, linha))
      if (quantos <= 0 || inicio > v.length) return C('')
      return C(v.substr(inicio - 1, quantos))
    },
  },
  COS: { aridade: 1, fn: ([x], { linha }) => R(Math.cos(numero(x, linha))) },
  COTAN: {
    aridade: 1,
    fn: ([x], { linha }) => {
      const t = Math.tan(numero(x, linha))
      dominio(t !== 0, 'COTAN', linha)
      return R(1 / t)
    },
  },
  EXP: {
    aridade: 2,
    fn: ([b, e], { linha }) => {
      const base = numero(b, linha)
      const expoente = numero(e, linha)
      dominio(!(base < 0 && !Number.isInteger(expoente)) && !(base === 0 && expoente < 0), 'EXP', linha)
      return R(base ** expoente)
    },
  },
  GRAUPRAD: { aridade: 1, fn: ([g], { linha }) => R((numero(g, linha) * Math.PI) / 180) },
  INT: { aridade: 1, fn: ([x], { linha }) => I(Math.trunc(numero(x, linha))) },
  LOG: {
    aridade: 1,
    fn: ([x], { linha }) => {
      const v = numero(x, linha)
      dominio(v > 0, 'LOG', linha)
      return R(Math.log10(v))
    },
  },
  LOGN: {
    aridade: 1,
    fn: ([x], { linha }) => {
      const v = numero(x, linha)
      dominio(v > 0, 'LOGN', linha)
      return R(Math.log(v))
    },
  },
  MAIUSC: { aridade: 1, fn: ([s], { linha }) => C(maiusculaAscii(texto(s, linha))) },
  MINUSC: { aridade: 1, fn: ([s], { linha }) => C(minusculaAscii(texto(s, linha))) },
  NUMPCARAC: {
    aridade: 1,
    fn: ([n], { linha }) => {
      const v = numero(n, linha)
      return C(n.t === 'I' ? String(v) : textoReal(v))
    },
  },
  PI: { aridade: 0, fn: () => R(Math.PI) },
  POS: {
    aridade: 2,
    fn: ([sub, s], { linha }) => {
      const agulha = texto(sub, linha)
      return I(agulha === '' ? 0 : texto(s, linha).indexOf(agulha) + 1)
    },
  },
  QUAD: {
    aridade: 1,
    fn: ([x], { linha }) => {
      const v = numero(x, linha)
      return { t: x.t === 'I' ? 'I' : 'R', v: v * v }
    },
  },
  RADPGRAU: { aridade: 1, fn: ([r], { linha }) => R((numero(r, linha) * 180) / Math.PI) },
  RAIZQ: {
    aridade: 1,
    fn: ([x], { linha }) => {
      const v = numero(x, linha)
      dominio(v >= 0, 'RAIZQ', linha)
      return R(Math.sqrt(v))
    },
  },
  RAND: { aridade: 0, fn: (_, { rng }) => R(rng()) },
  RANDI: {
    aridade: 1,
    fn: ([n], { linha, rng }) => {
      const limite = Math.trunc(numero(n, linha))
      return I(limite <= 0 ? 0 : Math.floor(rng() * limite))
    },
  },
  SEN: { aridade: 1, fn: ([x], { linha }) => R(Math.sin(numero(x, linha))) },
  TAN: { aridade: 1, fn: ([x], { linha }) => R(Math.tan(numero(x, linha))) },
}
