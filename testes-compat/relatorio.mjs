// node testes-compat/relatorio.mjs [filtro]  — mostra quais casos passam e os diffs.

import { casos, executarCaso } from './suporte/harness.mjs'

const filtro = process.argv[2]
let ok = 0
const falhas = []

for (const [i, caso] of casos.entries()) {
  if (filtro && !caso.arquivo.toLowerCase().includes(filtro.toLowerCase())) continue
  let r
  try {
    r = await executarCaso(caso)
  } catch (e) {
    falhas.push({ i, caso, motivo: `exceção: ${e.stack}` })
    continue
  }
  if (r.saida === caso.saidaEsperada && r.status !== 'erro') ok += 1
  else falhas.push({ i, caso, r })
}

for (const f of falhas) {
  console.log(`\n✖ #${f.i} ${f.caso.arquivo}  entradas=${JSON.stringify(f.caso.entradas)}`)
  if (f.motivo) { console.log(f.motivo); continue }
  console.log(`  status=${f.r.status}${f.r.erro ? `  erro(linha ${f.r.erro.linha}): ${f.r.erro.mensagem}` : ''}`)
  const esperado = f.caso.saidaEsperada.split('\n')
  const obtido = f.r.saida.split('\n')
  for (let l = 0; l < Math.max(esperado.length, obtido.length); l += 1) {
    if (esperado[l] !== obtido[l]) {
      console.log(`  linha ${l + 1}:\n    esperado: ${JSON.stringify(esperado[l])}\n    obtido:   ${JSON.stringify(obtido[l])}`)
      break
    }
  }
}
console.log(`\n${ok}/${ok + falhas.length} casos iguais ao oráculo`)
