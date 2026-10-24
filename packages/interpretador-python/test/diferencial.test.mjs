// Teste diferencial: cada programa de test/diferencial/corpus.py.txt roda no Pyodide do MisterALG e a saída tem de
// ser igual à do Python de verdade, gravada em test/diferencial/esperados.json (gerado por
// `node test/diferencial/lib.mjs --gravar`, só com o python instalado). Sem ele o teste continua valendo.
// Atenção: o Pyodide 0.24 é Python 3.11; evite no corpus o que mudou na 3.12 (ex.: sum() de floats é compensada).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerCorpus, lerEsperados, rodarMotor } from './diferencial/lib.mjs'

const esperados = lerEsperados()
for (const p of lerCorpus()) {
  test(`python x MisterALG: ${p.nome}`, async () => {
    const real = esperados[p.nome]
    assert.ok(real, `sem saída esperada para ${p.nome}: rode node test/diferencial/lib.mjs --gravar`)
    const r = await rodarMotor(p.fonte, p.entrada)
    assert.equal(r.saida, real.saida)
    if (real.erro) {
      assert.equal(r.estado, 'erro')
      // a mensagem do motor vem traduzida; o nome da exceção é o mesmo
      assert.equal(r.erro.mensagem.split(':')[0], real.erro.split(':')[0])
    } else assert.equal(r.estado, 'terminado', JSON.stringify(r.erro))
  })
}
