// Roda um programa em C# de ponta a ponta: o tree-sitter lê o prelúdio e o programa, e a SessaoCS executa.
import { criarAnalisador } from '../src/analisar.js'
import { PRELUDIO, rodarCS } from '../src/index.js'

const analisador = await criarAnalisador()
const preludio = analisador.analisar(PRELUDIO)
if (preludio.erros) throw new Error(`o prelúdio tem erros: ${JSON.stringify(preludio.erros)}`)

export function analisar(fonte) {
  return analisador.analisar(fonte)
}

/** @returns { saida, status, erro, codigo } — com a saída do programa. */
export async function rodar(fonte, opcoes = {}) {
  const r = analisador.analisar(fonte)
  if (r.erros) return { status: 'sintaxe', erros: r.erros, saida: '' }
  return rodarCS(r.ast, preludio.ast, opcoes)
}

/** Atalho: a saída de um programa que precisa terminar sem erro. */
export async function saida(fonte, opcoes = {}) {
  const r = await rodar(fonte, opcoes)
  if (r.status !== 'terminado') throw new Error(`${r.status}: ${JSON.stringify(r.erro ?? r.erros)}\n--- saída até agora:\n${r.saida}`)
  return r.saida
}
