import assert from 'node:assert/strict'
import { test } from 'node:test'
import { abaReutilizavel, acharPorCaminho, ciclar, lerRecuperacao, nomeDaAba, proximaAoFechar, reordenar, serializarRecuperacao } from './abas-logica.js'

test('reutiliza a única aba sem nome, limpa e vazia', () => {
  const a = { caminho: null, modificado: false }
  assert.equal(abaReutilizavel([a], () => true), a)
  assert.equal(abaReutilizavel([a], () => false), undefined)
  assert.equal(abaReutilizavel([{ ...a, modificado: true }], () => true), undefined)
  assert.equal(abaReutilizavel([{ ...a, caminho: 'C:\\x.alg' }], () => true), undefined)
  assert.equal(abaReutilizavel([a, { ...a }], () => true), undefined)
})

test('acha a aba pelo caminho, sem ligar para caixa nem barra', () => {
  const abas = [{ caminho: null }, { caminho: 'C:\\Aulas\\Soma.alg' }]
  assert.equal(acharPorCaminho(abas, 'c:/aulas/soma.ALG'), abas[1])
  assert.equal(acharPorCaminho(abas, 'C:\\outro.alg'), undefined)
  assert.equal(acharPorCaminho(abas, null), undefined)
})

test('próxima aba ao fechar e Ctrl+Tab', () => {
  assert.equal(proximaAoFechar(1, 0), null)
  assert.equal(proximaAoFechar(3, 0), 0)
  assert.equal(proximaAoFechar(3, 1), 1)
  assert.equal(proximaAoFechar(3, 2), 1)
  assert.equal(ciclar(3, 2, 1), 0)
  assert.equal(ciclar(3, 0, -1), 2)
  assert.deepEqual(reordenar(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
})

test('nome da aba', () => {
  const ext = { python: 'py' }
  assert.equal(nomeDaAba({ caminho: 'C:\\x\\a.alg', linguagem: 'portugol' }, ext), 'a.alg')
  assert.equal(nomeDaAba({ caminho: null, nome: 'semnome', linguagem: 'python' }, ext), 'semnome.py')
  assert.equal(nomeDaAba({ caminho: null, nome: 'semnome', linguagem: 'portugol' }, ext), 'semnome')
})

test('recuperação com várias abas e formato antigo', () => {
  const mk = (n, m) => ({ texto: n, caminho: null, nome: 'semnome', codificacao: 'utf-8', linguagem: 'python', modificado: m })
  assert.equal(serializarRecuperacao([mk('a', false)], 0), null)
  const s = serializarRecuperacao([mk('a', true), mk('b', false), mk('c', true)], 2)
  assert.deepEqual(s.abas.map((a) => a.texto), ['a', 'c'])
  assert.equal(s.ativa, 1)
  assert.equal('modificado' in s.abas[0], false)
  const volta = lerRecuperacao(JSON.parse(JSON.stringify(s)))
  assert.equal(volta.abas.length, 2)
  assert.equal(volta.ativa, 1)
  const antigo = lerRecuperacao({ texto: 'x', caminho: null, nome: 'n', codificacao: 'utf-8', linguagem: 'c' })
  assert.deepEqual(antigo, { abas: [{ texto: 'x', caminho: null, nome: 'n', codificacao: 'utf-8', linguagem: 'c' }], ativa: 0 })
  assert.equal(lerRecuperacao(null), null)
  assert.equal(lerRecuperacao({ abas: [] }), null)
})
