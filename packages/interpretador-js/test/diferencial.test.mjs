// Teste diferencial: cada programa de test/diferencial/corpus*.js.txt roda no interpretador do MisterALG e a saída
// tem de ser igual à do Node de verdade, gravada em test/diferencial/esperados.json (gerado por
// `node test/diferencial/lib.mjs --gravar`). Sem o node de referência o teste continua valendo: ele só lê o JSON.
// (console.log, util.inspect, quebras de linha, classes, getters, closures, async, process.stdout.write...)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerCorpus, lerEsperados, rodarMotor } from './diferencial/lib.mjs'

const esperados = lerEsperados()
for (const p of lerCorpus()) {
  test(`node x MisterALG: ${p.nome}`, async () => {
    const real = esperados[p.nome]
    assert.ok(real, `sem saída esperada para ${p.nome}: rode node test/diferencial/lib.mjs --gravar`)
    const r = await rodarMotor(p.fonte, p.entrada)
    assert.equal(r.saida, real.saida)
    assert.equal(r.status, real.erro ? 'erro' : 'terminado', JSON.stringify(r.erro))
  })
}
