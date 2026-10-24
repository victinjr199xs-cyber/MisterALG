// Teste diferencial: cada programa de test/diferencial/corpus*.txt roda no nosso interpretador e a saída tem de
// ser igual à do gcc/g++ de verdade, gravada em test/diferencial/esperados.json (gerado por
// `node test/diferencial/lib.mjs --gravar`, só com o gcc instalado). Sem o gcc o teste continua valendo: ele só lê o JSON.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARQUIVOS_CORPUS, lerCorpus, lerEsperados, rodarMotor } from './diferencial/lib.mjs'

const esperados = lerEsperados()
for (const arq of ARQUIVOS_CORPUS()) {
  const cpp = arq.includes('.cpp.')
  for (const p of lerCorpus(arq)) {
    const chave = (cpp ? 'cpp/' : 'c/') + p.nome
    test(`gcc x MisterALG: ${chave}`, async () => {
      const real = esperados[chave]
      assert.ok(real, `sem saída esperada para ${chave}: rode node test/diferencial/lib.mjs --gravar`)
      const r = await rodarMotor(p.fonte, p.entrada, cpp)
      assert.equal(r.status, 'terminado', JSON.stringify(r.erro))
      assert.equal(r.saida, real.saida)
      assert.equal(r.codigo ?? 0, real.codigo)
    })
  }
}
