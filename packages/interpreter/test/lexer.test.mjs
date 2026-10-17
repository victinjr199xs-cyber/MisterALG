import test from 'node:test'
import assert from 'node:assert/strict'
import { tokenizar } from '../src/lexer.js'

const tipos = (fonte) => tokenizar(fonte).filter((t) => t.k !== 'NL' && t.k !== 'EOF')

test('tokeniza atribuição com posição', () => {
  const t = tipos('x := 1.5')
  assert.deepEqual(t.map((x) => x.k), ['ID', 'OP', 'NUM'])
  assert.equal(t[2].t, 'R')
  assert.equal(t[0].col, 1)
  assert.equal(t[2].col, 6)
})

test('comentário, CRLF e linhas', () => {
  const t = tokenizar('algoritmo "a"\r\n// linha\r\nfimalgoritmo')
  const ids = t.filter((x) => x.k === 'ID')
  assert.equal(ids[1].linha, 3)
})

test('palavras acentuadas e sinônimos viram a forma canônica', () => {
  const n = tipos('ENTÃO Faça caracter literal numérico Variável ATÉ_QUE').map((x) => x.n)
  assert.deepEqual(n, ['ENTAO', 'FACA', 'CARACTERE', 'CARACTERE', 'REAL', 'VAR', 'ATE'])
})

test('intervalo 1..10 não vira número real', () => {
  assert.deepEqual(tipos('[1..10]').map((x) => x.v), ['[', '1', '..', '10', ']'])
})

test('aspas não fechadas dão o erro do VisuAlg', () => {
  assert.throws(() => tokenizar('x <- "abc\ny'), /Número de '"' \(aspas duplas\) incorreto/)
})
