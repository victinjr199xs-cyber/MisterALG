// Analisador léxico do Portugol. Uma linha física = um comando, então as
// quebras de linha viram tokens NL. Palavras são comparadas pela forma
// normalizada (maiúsculas, sem acento, sinônimos resolvidos) em `n`; o texto
// original fica em `v`.

import { erro } from './erros.js'
import { canonica, normalizar } from './palavras.js'

const LETRA = /[\p{L}_]/u
const LETRA_OU_DIGITO = /[\p{L}\p{N}_]/u
const DIGITO = /[0-9]/
const DUPLOS = new Set(['<-', ':=', '<=', '>=', '<>', '..'])
const SIMPLES = new Set(['+', '-', '*', '/', '\\', '^', '%', '=', '<', '>', '(', ')', '[', ']', ',', ':', ';', '.'])
const BRANCOS = new Set([' ', '\t', '\f', '\v', ' ', '﻿'])

/**
 * @returns {{k:'NL'|'NUM'|'STR'|'ID'|'OP'|'EOF', v:string, n?:string, t?:'I'|'R', valor?:number, linha:number, col:number}[]}
 */
export function tokenizar(fonte) {
  const texto = String(fonte).replace(/\r\n?/g, '\n')
  const tokens = []
  let i = 0
  let linha = 1
  let inicioLinha = 0

  while (i < texto.length) {
    const c = texto[i]
    const col = i - inicioLinha + 1
    const push = (tok) => tokens.push({ ...tok, linha, col })

    if (c === '\n') {
      push({ k: 'NL', v: '\n' })
      i += 1
      linha += 1
      inicioLinha = i
      continue
    }
    if (BRANCOS.has(c)) {
      i += 1
      continue
    }
    if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1
      continue
    }
    if (c === '"') {
      const fim = texto.indexOf('"', i + 1)
      const quebra = texto.indexOf('\n', i + 1)
      if (fim === -1 || (quebra !== -1 && quebra < fim)) throw erro(26, linha)
      push({ k: 'STR', v: texto.slice(i + 1, fim) })
      i = fim + 1
      continue
    }
    if (DIGITO.test(c)) {
      let j = i
      while (j < texto.length && DIGITO.test(texto[j])) j += 1
      let tipo = 'I'
      if (texto[j] === '.' && DIGITO.test(texto[j + 1] ?? '')) {
        j += 1
        while (j < texto.length && DIGITO.test(texto[j])) j += 1
        tipo = 'R'
      }
      const bruto = texto.slice(i, j)
      push({ k: 'NUM', v: bruto, t: tipo, valor: Number(bruto) })
      i = j
      continue
    }
    if (LETRA.test(c)) {
      let j = i
      while (j < texto.length && LETRA_OU_DIGITO.test(texto[j])) j += 1
      const bruto = texto.slice(i, j)
      push({ k: 'ID', v: bruto, n: canonica(normalizar(bruto)) })
      i = j
      continue
    }
    const dois = texto.slice(i, i + 2)
    if (DUPLOS.has(dois)) {
      push({ k: 'OP', v: dois })
      i += 2
      continue
    }
    if (SIMPLES.has(c)) {
      push({ k: 'OP', v: c })
      i += 1
      continue
    }
    throw erro(25, linha, c)
  }

  tokens.push({ k: 'NL', v: '\n', linha, col: i - inicioLinha + 1 })
  tokens.push({ k: 'EOF', v: '', linha, col: 1 })
  return tokens
}
