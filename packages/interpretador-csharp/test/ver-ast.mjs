// Ferramenta de desenvolvimento: mostra a árvore de um trecho de C#.  node test/ver-ast.mjs "int x = 5;"
import { criarAnalisador } from '../src/analisar.js'

const { analisar } = await criarAnalisador()
import { readFileSync, existsSync } from 'node:fs'
const arg = process.argv[2] ?? 'class A { }'
const r = analisar(existsSync(arg) ? readFileSync(arg, 'utf8') : arg)
const mostrar = (n, recuo = '') => {
  const rotulo = `${n.k ? `${n.k}: ` : ''}${n.t}${n.x !== undefined ? ` "${n.x}"` : ''}  @${n.l}:${n.c}`
  console.log(`${recuo}${rotulo}`)
  for (const f of n.f ?? []) mostrar(f, `${recuo}  `)
}
if (r.erros) console.log(JSON.stringify(r.erros, null, 1))
else mostrar(r.ast)

