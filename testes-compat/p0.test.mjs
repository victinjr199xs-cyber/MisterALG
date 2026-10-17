// Oráculo de compatibilidade: cada caso de casos.json precisa produzir
// exatamente a saída esperada (sem trim). Usa os exemplos originais do VisuAlg;
// sem eles (repositório público), os casos são pulados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { casos, executarCaso, temExemplosVisualg } from './suporte/harness.mjs'

const pular = temExemplosVisualg
  ? false
  : 'exemplos do VisuAlg ausentes (defina MISTERALG_VISUALG_DIR com a pasta do VisuAlg 3.0.7)'

for (const [i, caso] of casos.entries()) {
  test(`#${i} ${caso.arquivo} ${JSON.stringify(caso.entradas)}`, { skip: pular }, async () => {
    const r = await executarCaso(caso)
    assert.notEqual(r.status, 'erro', r.erro && `linha ${r.erro.linha}: ${r.erro.mensagem}`)
    assert.equal(r.saida, caso.saidaEsperada)
  })
}
