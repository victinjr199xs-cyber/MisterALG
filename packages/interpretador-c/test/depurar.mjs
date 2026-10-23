// Uso: node test/depurar.mjs arquivo.c|arquivo.cpp [entradas...] — mostra a saída, o erro e a pilha interna.
import { readFileSync } from 'node:fs'
import { rodar, rodarCpp } from './ajudante.mjs'

const [arquivo, ...entradas] = process.argv.slice(2)
const r = await (arquivo.endsWith('.cpp') ? rodarCpp : rodar)(readFileSync(arquivo, 'utf8'), entradas)
console.log('status:', r.status, 'código:', r.codigo)
console.log('saída:', JSON.stringify(r.saida))
if (r.erro) console.log('erro:', r.erro.linha, r.erro.mensagem, (r.erro.interno ?? r.erro).stack)
