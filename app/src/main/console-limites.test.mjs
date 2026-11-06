import { test } from 'node:test'
import assert from 'node:assert/strict'
import { limitesPadrao, limitesValidos } from './console-limites.js'

const tela = { x: 0, y: 0, width: 1920, height: 1040 }

test('limites salvos dentro da tela ficam como estão', () => {
  assert.deepEqual(limitesValidos({ x: 100, y: 80, width: 800, height: 500 }, tela), { x: 100, y: 80, width: 800, height: 500 })
})

test('janela que ficou fora da tela (monitor desligado) volta para dentro', () => {
  assert.deepEqual(limitesValidos({ x: 3000, y: -400, width: 800, height: 500 }, tela), { x: 1120, y: 0, width: 800, height: 500 })
})

test('maior que a tela encolhe; lixo e tamanhos minúsculos são recusados', () => {
  assert.deepEqual(limitesValidos({ x: 0, y: 0, width: 5000, height: 4000 }, tela), { x: 0, y: 0, width: 1920, height: 1040 })
  assert.equal(limitesValidos(null, tela), null)
  assert.equal(limitesValidos({ x: 'a', y: 1, width: 800, height: 500 }, tela), null)
  assert.equal(limitesValidos({ x: 1, y: 1, width: 50, height: 50 }, tela), null)
})

test('limite padrão centraliza sobre a janela principal', () => {
  assert.deepEqual(limitesPadrao({ x: 0, y: 0, width: 1920, height: 1040 }, tela), { x: 520, y: 260, width: 880, height: 520 })
})
