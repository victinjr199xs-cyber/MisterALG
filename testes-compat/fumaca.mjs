// Roda todos os .alg de exemplo do VisuAlg (MISTERALG_VISUALG_DIR) com entradas
// genéricas e mostra o que deu erro.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { rodar } from '../packages/interpreter/src/index.js'
import { fonteDe, pastaVisualg, rngFixo, temExemplosVisualg } from './suporte/harness.mjs'

if (!temExemplosVisualg) {
  console.log('Exemplos do VisuAlg não encontrados: defina MISTERALG_VISUALG_DIR.')
  process.exit(0)
}
const arquivos = [
  ...readdirSync(join(pastaVisualg, 'Exemplos')).filter((f) => /\.alg$/i.test(f)).map((f) => `Exemplos/${f}`),
  ...(existsSync(join(pastaVisualg, 'TESTE.alg')) ? ['TESTE.alg'] : []),
]
const entradas = Array.from({ length: 200 }, (_, i) => ['3', '5', 'n', '2', '0', '1', 's', '4'][i % 8])

const resumo = {}
for (const arquivo of arquivos) {
  const r = await rodar(fonteDe(arquivo), { entradas, rng: rngFixo(), maxLinhas: 300_000 })
  resumo[r.status] = (resumo[r.status] ?? 0) + 1
  if (r.status === 'erro') {
    console.log(`✖ ${arquivo}: linha ${r.erro.linha}: ${r.erro.mensagem}`)
    if (r.erro.interno) console.log(r.erro.interno.stack)
  }
}
console.log(resumo)
