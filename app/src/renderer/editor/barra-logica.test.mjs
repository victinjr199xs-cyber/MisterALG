import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consultaValida, deveAbrir, filtrar, montarTrecho, semAcento } from './barra-logica.js'
import { BLOCOS } from './blocos.js'

test('abre só com "/" no começo da linha, fora de string e comentário', () => {
  assert.equal(deveAbrir(''), true)
  assert.equal(deveAbrir('    '), true)
  assert.equal(deveAbrir('\t  '), true)
  assert.equal(deveAbrir('a '), false) // divisão: a / b
  assert.equal(deveAbrir('x <- 4 '), false)
  assert.equal(deveAbrir('', true), false) // dentro de string ou comentário
})

test('a consulta só aceita letras, números e _', () => {
  assert.equal(consultaValida(''), true)
  assert.equal(consultaValida('enq'), true)
  assert.equal(consultaValida('senão'), true)
  assert.equal(consultaValida('a b'), false)
  assert.equal(consultaValida('/'), false)
  assert.equal(consultaValida('*'), false)
})

test('filtro sem acento nem caixa, começo do nome primeiro', () => {
  assert.equal(semAcento('FUNÇÃO'), 'funcao')
  const blocos = BLOCOS.portugol
  assert.deepEqual(filtrar(blocos, 'enq').map((b) => b.id), ['enquanto'])
  assert.equal(filtrar(blocos, 'FUNÇ')[0].id, 'funcao')
  assert.equal(filtrar(blocos, 'funcao')[0].id, 'funcao')
  assert.equal(filtrar(blocos, '').length, blocos.length)
  assert.deepEqual(filtrar(blocos, 'zzz'), [])
  assert.equal(filtrar(blocos, 'se')[0].id, 'se')
  assert.equal(filtrar(BLOCOS.python, 'pri')[0].id, 'print')
})

test('o trecho leva a indentação da linha e o cursor onde o | estava', () => {
  const enq = BLOCOS.portugol.find((b) => b.id === 'enquanto')
  const { texto, cursor } = montarTrecho(enq.modelo, '  ')
  assert.equal(texto, 'enquanto  faca\n  fimenquanto')
  assert.equal(cursor, 'enquanto '.length)
  const se = montarTrecho(BLOCOS.c.find((b) => b.id === 'if').modelo, '    ', '  ')
  assert.equal(se.texto, 'if () {\n      \n    }')
  assert.equal(se.cursor, 4)
})

test('todo bloco tem modelo, descrição e um único cursor', () => {
  for (const [lang, lista] of Object.entries(BLOCOS)) {
    for (const b of lista) {
      assert.ok(b.nome && b.icone && b.desc && b.modelo, `${lang}/${b.id}`)
      assert.ok(b.modelo.split('|').length <= 2 || /<<|\|\|/.test(b.modelo), `${lang}/${b.id}: mais de um |`)
    }
  }
})
