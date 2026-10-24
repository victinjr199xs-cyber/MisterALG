// Teste diferencial do C# moderno: cada programa de test/diferencial/corpus*.cs.txt roda no interpretador do MisterALG e
// a saída tem de ser igual à do .NET de verdade, gravada em test/diferencial/esperados.json (gerado por
// `node test/diferencial/lib.mjs --gravar`, só com o SDK do .NET instalado). Sem ele o teste continua valendo: só lê o JSON.
// (Os test/programas/*.cs, em C# 5, são comparados com o csc.exe no programas.test.mjs.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerCorpus, lerEsperados, norm, rodarMotor } from './diferencial/lib.mjs'

const esperados = lerEsperados()
for (const p of lerCorpus()) {
  test(`.NET x MisterALG: ${p.nome}`, async () => {
    const real = esperados[p.nome]
    assert.ok(real, `sem saída esperada para ${p.nome}: rode node test/diferencial/lib.mjs --gravar`)
    const r = await rodarMotor(p.fonte, p.entrada)
    assert.equal(norm(r.saida), norm(real.saida))
    assert.equal(r.status, real.erro ? 'erro' : 'terminado', JSON.stringify(r.erro ?? r.erros))
  })
}
