import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consoleEmJanela, contarQuebras, criarHistorico, descreverSelo, dividirLinhas, formatarTempo } from './console-logica.js'

test('formatarTempo: centésimos, décimos e minutos', () => {
  assert.equal(formatarTempo(40), '0,04 s')
  assert.equal(formatarTempo(950), '0,95 s')
  assert.equal(formatarTempo(12_340), '12,3 s')
  assert.equal(formatarTempo(65_000), '1 min 05 s')
  assert.equal(formatarTempo(-5), '0,00 s')
  assert.equal(formatarTempo(2500, 'en-US'), '2.5 s')
})

test('descreverSelo: cada estado tem texto e tom', () => {
  assert.deepEqual(descreverSelo('rodando'), { texto: 'Executando', tom: 'rodando', pulsa: true })
  assert.equal(descreverSelo('aguardando').tom, 'espera')
  const fim = descreverSelo('finalizado', { ms: 1234, codigo: 0 })
  assert.equal(fim.texto, 'Finalizado em 1,2 s · código 0')
  assert.equal(fim.tom, 'ok')
  const erro = descreverSelo('erro', { linha: 7 })
  assert.equal(erro.texto, 'Erro na linha 7')
  assert.equal(erro.linha, 7)
  assert.equal(descreverSelo('erro', { linha: 0 }).linha, undefined)
  assert.equal(descreverSelo('parado').texto, 'Interrompido')
})

test('histórico do leia: ↑ volta, ↓ avança e devolve o rascunho', () => {
  const h = criarHistorico()
  assert.equal(h.anterior('x'), null)
  h.adicionar('10')
  h.adicionar('20')
  h.adicionar('20') // repetido em seguida não entra
  h.adicionar('')
  assert.deepEqual(h.itens, ['10', '20'])
  assert.equal(h.anterior('rasc'), '20')
  assert.equal(h.anterior('20'), '10')
  assert.equal(h.anterior('10'), null) // já no mais antigo
  assert.equal(h.proximo(), '20')
  assert.equal(h.proximo(), 'rasc') // volta ao que estava sendo digitado
  assert.equal(h.proximo(), null)
})

test('histórico respeita o limite', () => {
  const h = criarHistorico(3)
  for (const v of ['a', 'b', 'c', 'd']) h.adicionar(v)
  assert.deepEqual(h.itens, ['b', 'c', 'd'])
})

test('dividirLinhas acha "linha N" nos formatos de erro', () => {
  assert.deepEqual(dividirLinhas('linha 5, coluna 3: erro: x'), [{ texto: 'linha 5', linha: 5 }, { texto: ', coluna 3: erro: x' }])
  assert.deepEqual(dividirLinhas('a\nprograma.cs(12,5): erro'), [{ texto: 'a\n' }, { texto: 'programa.cs(12', linha: 12 }, { texto: ',5): erro' }])
  const py = dividirLinhas('  File "<exec>", line 3, in <module>')
  assert.equal(py.find((p) => p.linha)?.linha, 3)
  assert.deepEqual(dividirLinhas('sem número'), [{ texto: 'sem número' }])
  assert.deepEqual(dividirLinhas('linha 0'), [{ texto: 'linha 0' }])
})

test('contarQuebras e consoleEmJanela', () => {
  assert.equal(contarQuebras('a\nb\n\nc'), 3)
  assert.equal(contarQuebras(''), 0)
  assert.equal(consoleEmJanela(null, 'classica'), true)
  assert.equal(consoleEmJanela(undefined, 'moderna'), false)
  assert.equal(consoleEmJanela(true, 'moderna'), true)
  assert.equal(consoleEmJanela(false, 'classica'), false)
})
