// node --test app/src/compartilhado/ia.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { provedorPorId, separarSSE } from './ia.js'

test('separarSSE junta trechos quebrados no meio da linha', () => {
  const a = separarSSE('data: {"x":1}\n\ndata: {"x"')
  assert.deepEqual(a.dados, ['{"x":1}'])
  const b = separarSSE(`${a.resto}:2}\r\n\ndata: [DONE]\n\n`)
  assert.deepEqual(b.dados, ['{"x":2}'])
  assert.equal(b.resto, '')
})

test('separarSSE ignora comentários e eventos sem data', () => {
  assert.deepEqual(separarSSE(': ping\nevent: x\ndata:{"y":1}\n').dados, ['{"y":1}'])
})

test('provedor desconhecido cai no Claude', () => {
  assert.equal(provedorPorId('nada').id, 'claude')
})
