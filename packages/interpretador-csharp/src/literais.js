// Os literais do C#: números (com sufixos), textos com escapes, textos "verbatim" (@"") e "raw" ("""...""").

import { Chr, Dbl, Flt, Num, decDeTexto } from './valores.js'

const ESCAPES = { n: '\n', r: '\r', t: '\t', 0: '\0', a: '\x07', b: '\b', f: '\f', v: '\v', '\\': '\\', '"': '"', "'": "'" }

/** Resolve \n, \t, A, \x41... de um texto do C#. */
export function desescapar(texto) {
  if (!texto.includes('\\')) return texto
  return texto.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{1,4}|.)/gs, (_, e) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16))
    if (e[0] === 'U' && e.length === 9) return String.fromCodePoint(parseInt(e.slice(1), 16))
    if (e[0] === 'x' && e.length > 1) return String.fromCharCode(parseInt(e.slice(1), 16))
    return ESCAPES[e] ?? e
  })
}

/** O texto de um string_literal da árvore (com as aspas) como o valor do programa. */
export function lerTexto(x) {
  if (x.startsWith('@"')) return x.slice(2, -1).replace(/""/g, '"')
  if (/^"{3,}/.test(x)) return lerTextoCru(x)
  if (x.startsWith('"')) return desescapar(x.slice(1, -1))
  return x
}

/** Texto "raw": entre três ou mais aspas; tira a primeira e a última linha e o recuo do fechamento. */
function lerTextoCru(x) {
  const aspas = /^"+/.exec(x)[0].length
  const corpo = x.slice(aspas, x.length - aspas)
  const linhas = corpo.split(/\r?\n/)
  if (linhas.length < 3) return corpo.trim()
  const recuo = /^[ \t]*/.exec(linhas[linhas.length - 1])[0]
  const meio = linhas.slice(1, -1).map((l) => (l.startsWith(recuo) ? l.slice(recuo.length) : l.trimStart()))
  return meio.join('\n')
}

export function lerChar(x) {
  const t = desescapar(x.slice(1, -1))
  return new Chr(t.charCodeAt(0))
}

const cabeNoInt = (b) => b >= -2147483648n && b <= 2147483647n

export function lerInteiro(txt) {
  const m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9_]+)([uUlL]*)$/.exec(txt)
  if (!m) return 0
  const big = BigInt(m[1].replace(/_/g, ''))
  const suf = m[2].toLowerCase()
  if (suf.includes('u') && suf.includes('l')) return new Num('ulong', BigInt.asUintN(64, big))
  if (suf.includes('l')) return BigInt.asIntN(64, big)
  if (suf.includes('u')) return big <= 0xffffffffn ? new Num('uint', Number(big)) : new Num('ulong', BigInt.asUintN(64, big))
  if (cabeNoInt(big)) return Number(big)
  if (big <= 0xffffffffn) return new Num('uint', Number(big))
  if (big <= 0x7fffffffffffffffn) return big
  return new Num('ulong', BigInt.asUintN(64, big))
}

export function lerReal(txt) {
  const m = /^([0-9_.]*(?:[eE][+-]?\d+)?)([fFdDmM]?)$/.exec(txt)
  const corpo = (m?.[1] ?? txt).replace(/_/g, '')
  const suf = (m?.[2] ?? '').toLowerCase()
  if (suf === 'f') return new Flt(parseFloat(corpo))
  if (suf === 'm') return decDeTexto(corpo) ?? new Dbl(0)
  return new Dbl(parseFloat(corpo))
}
