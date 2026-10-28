// SQL no modo timer: o Parar durante a espera entre dois comandos não pode executar o próximo.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const executados = []
globalThis.window = {
  misteralg: {
    sql: {
      comando: async ({ c, sql }) => {
        if (c === 'executar') {
          executados.push(sql)
          return { campos: [], linhas: [], afetadas: 0 }
        }
        return c === 'banco' ? { tabelas: [] } : {}
      },
      parar: () => {},
    },
  },
}
const { SessaoSQL } = await import('./sessao-sql.js')

test('Parar durante a espera do timer não executa o próximo comando', async () => {
  const fins = []
  const sessao = new SessaoSQL('select 1;\nselect 2;\nselect 3;', {
    modo: 'timer',
    timerMs: 60,
    onOutput: () => {},
    onStep: () => {},
    onEnd: (estado) => fins.push(estado),
  })
  const rodando = sessao.rodar()
  await new Promise((r) => setTimeout(r, 25)) // o 1º comando já rodou e a sessão espera o timer
  sessao.parar()
  await rodando
  await new Promise((r) => setTimeout(r, 120))
  assert.deepEqual(executados, ['select 1'])
  assert.deepEqual(fins, ['parado'])
})
