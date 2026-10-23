// Ferramenta de desenvolvimento: roda um arquivo .cs e mostra a saída.  node test/rodar.mjs programa.cs
import { readFileSync } from 'node:fs'
import { rodar } from './ajudante.mjs'

const fonte = readFileSync(process.argv[2], 'utf8')
const r = await rodar(fonte, { entrada: process.argv.slice(3) })
process.stdout.write(r.saida)
if (r.status !== 'terminado') console.log(`\n[${r.status}]`, JSON.stringify(r.erro ?? r.erros, null, 1))
