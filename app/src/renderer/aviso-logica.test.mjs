import test from 'node:test'
import assert from 'node:assert/strict'
import { alterou, linhaCorrigida, textoVisivel } from './aviso-logica.js'

test('textoVisivel tira só a indentação', () => {
  assert.equal(textoVisivel('   escreva ("a")  '), 'escreva ("a")  ')
  assert.equal(textoVisivel('\t\tx'), 'x')
})

test('linhaCorrigida preserva a indentação original', () => {
  assert.equal(linhaCorrigida('   escrva ("a")', 'escreva ("a")'), '   escreva ("a")')
  assert.equal(linhaCorrigida('\tx', 'y'), '\ty')
  assert.equal(linhaCorrigida('x', 'y'), 'y')
})

test('linhaCorrigida respeita a indentação digitada pelo aluno', () => {
  assert.equal(linhaCorrigida('      escrva', '  escreva'), '  escreva')
  assert.equal(linhaCorrigida('   x', ''), '   ')
})

test('alterou: igual desabilita a correção', () => {
  assert.equal(alterou('   escreva ("a")', 'escreva ("a")'), false)
  assert.equal(alterou('   escreva ("a")', 'escreva ("b")'), true)
  assert.equal(alterou('   escreva', '  escreva'), true) // mudou só a indentação
})
