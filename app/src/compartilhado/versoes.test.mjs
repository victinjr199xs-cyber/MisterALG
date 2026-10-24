import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maisNova } from './versoes.js'

test('compara versões numericamente', () => {
  assert.equal(maisNova('1.10.0', '1.9.2'), true)
  assert.equal(maisNova('1.9.0', '1.9.0'), false)
  assert.equal(maisNova('1.9.0', '1.9.0-beta'), true)
  assert.equal(maisNova('v1.9.1', '1.9.0'), true)
  assert.equal(maisNova('1.9.0', '1.9.1'), false)
})
