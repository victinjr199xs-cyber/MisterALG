// Teste diferencial do SQL: cada comando de test/diferencial/corpus.sql.txt roda no PGlite do MisterALG e o texto do
// resultado (tabela no formato do psql, ou o rótulo INSERT 0 1...) tem de ser igual ao do psql de verdade, gravado em
// test/diferencial/esperados.json (gerado por `node test/diferencial/lib.mjs --gravar`, só com o psql e um servidor à
// mão). Sem eles o teste continua valendo: só lê o JSON.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dividirComandos } from '../src/index.js'
import { lerCorpus, lerEsperados, rodarMotor } from './diferencial/lib.mjs'

const esperados = lerEsperados()
for (const p of lerCorpus()) {
  test(`psql x MisterALG: ${p.nome}`, async () => {
    const real = esperados[p.nome]
    assert.ok(real, `sem saída esperada para ${p.nome}: rode node test/diferencial/lib.mjs --gravar`)
    const motor = await rodarMotor(p.fonte)
    const comandos = dividirComandos(p.fonte)
    assert.equal(motor.length, real.length)
    motor.forEach((saida, i) => assert.equal(saida, real[i], `comando ${i + 1}: ${comandos[i].sql.slice(0, 80)}`))
  })
}
