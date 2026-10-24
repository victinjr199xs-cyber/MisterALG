// Confere as traduções: todo número existe em chaves.js, os {0} continuam lá e os atalhos (&) do menu não se repetem.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import CHAVES from './traducoes/chaves.js'
import { IDIOMAS, TRADUCOES, tradutor } from './idiomas.js'

const marcas = (s) => [...s.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort().join()

for (const { id } of IDIOMAS.filter((i) => i.id !== 'pt')) {
  test(`traduções: ${id}`, () => {
    const lista = TRADUCOES[id]
    assert.ok(lista, `falta traducoes/${id}.js`)
    for (const [n, texto] of Object.entries(lista)) {
      assert.ok(CHAVES[n], `${id}: o número ${n} não existe em chaves.js`)
      assert.equal(marcas(texto), marcas(CHAVES[n]), `${id} ${n}: os {0} não batem`)
      if (Number(n) < 70) assert.ok((texto.match(/&/g) ?? []).length <= 1, `${id} ${n}: mais de um & no atalho do menu`)
    }
    const faltando = Object.keys(CHAVES).filter((n) => !lista[n])
    assert.deepEqual(faltando, [], `${id}: textos sem tradução`)
  })
}

test('textos preenchidos são reconhecidos', () => {
  const t = tradutor('en')
  assert.equal(t('MENSAGEM: Pausado na linha {0} — F8 executa a linha, F9 continua, Ctrl+F2 para', 7), 'MESSAGE: Paused at line 7 — F8 runs the line, F9 continues, Ctrl+F2 stops')
  assert.equal(t.reconhecer('Área dos algoritmos ( Edição do código fonte ) -> Nome do arquivo: [aula.alg]'), 'Program area ( Source code editing ) -> File name: [aula.alg]')
  assert.equal(t.reconhecer('texto que não existe'), null)
  assert.equal(tradutor('pt')('Fechar'), 'Fechar')
})

test('explicações do SQL são traduzidas', async () => {
  const { EXPLICACOES_SQL } = await import('../../../packages/interpretador-sql/src/erros.js')
  for (const id of Object.keys(TRADUCOES)) {
    const t = tradutor(id)
    for (const pt of Object.values(EXPLICACOES_SQL)) assert.notEqual(t(pt), pt, `${id}: ${pt}`)
  }
  assert.equal(tradutor('en')(EXPLICACOES_SQL['22012']), 'Division by zero.')
})

test('mensagens de erro do Portugol são traduzidas', async () => {
  const { MENSAGENS, ErroVisualg } = await import('../../../packages/interpreter/src/erros.js')
  for (const id of Object.keys(TRADUCOES)) {
    const t = tradutor(id)
    for (const codigo of Object.keys(MENSAGENS)) {
      const pt = new ErroVisualg(Number(codigo), 1, 'v', 'w').mensagem
      const r = t.reconhecer(pt)
      assert.ok(r && r !== pt, `${id}: ${codigo} ${pt}`)
      assert.ok(!/\{\d+\}/.test(r), `${id}: ${codigo} ficou com {n}`)
    }
  }
  assert.equal(tradutor('en').reconhecer(new ErroVisualg(100, 1, 'v').mensagem), 'Index out of the bounds of vector v.')
  assert.equal(tradutor('en').reconhecer(new ErroVisualg(11, 1, 'x').mensagem), "Variable 'x' was not found.")
})

test('erros dos interpretadores (JS, Python, PHP, C#, C) são traduzidos', async () => {
  const t = tradutor('en')
  const py = await import('../../../packages/interpretador-python/src/erros.js')
  const php = await import('../../../packages/interpretador-php/src/erros.js')
  const js = await import('../../../packages/interpretador-js/src/index.js')
  const cs = await import('../../../packages/interpretador-csharp/src/erros.js')
  const c = await import('../../../packages/interpretador-c/src/erros.js')
  const r = py.traduzirErro('NameError', "name 'x' is not defined")
  assert.equal(t.reconhecer(r.mensagem), 'NameError: "x" was not defined')
  assert.match(t.reconhecer(r.explicacao), /^Create the variable/)
  const p = php.traduzirMensagem('Undefined variable $x')
  assert.equal(t.reconhecer(`Aviso: ${p.mensagem}`), 'Warning: the variable $x does not exist')
  assert.match(t.reconhecer(p.explicacao), /^Give the variable a value/)
  const e = js.traduzirErro(new ReferenceError('x is not defined'))
  assert.equal(t.reconhecer(e.mensagem), 'ReferenceError: "x" was not declared')
  assert.ok(t.reconhecer(e.explicacao))
  for (const pt of [...Object.values(c.EXPLICACOES), ...Object.values(cs.EXPLICACOES)]) assert.ok(t.reconhecer(pt), pt)
})