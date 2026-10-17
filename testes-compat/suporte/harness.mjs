// Carrega os casos do oráculo (casos.json) e roda cada um no interpretador.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodificar, rodar } from '../../packages/interpreter/src/index.js'

// Os programas de exemplo do VisuAlg pertencem aos autores dele e NÃO vão no
// repositório público. Para rodar o oráculo, aponte MISTERALG_VISUALG_DIR para a
// pasta do VisuAlg 3.0.7 (a que contém "Exemplos") ou copie-a para fixtures/.
const pastaLocal = fileURLToPath(new URL('../fixtures', import.meta.url))
export const pastaVisualg = process.env.MISTERALG_VISUALG_DIR ?? pastaLocal
export const temExemplosVisualg = existsSync(join(pastaVisualg, 'Exemplos'))

export const casos = JSON.parse(readFileSync(new URL('../casos.json', import.meta.url), 'utf8'))

export function fonteDe(arquivo) {
  return decodificar(readFileSync(join(pastaVisualg, arquivo)))
}

/** RNG determinístico para casos que usam aleatório (os do oráculo não dependem do valor). */
export function rngFixo(semente = 42) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export async function executarCaso(caso) {
  const fonte = fonteDe(caso.arquivo)
  return rodar(fonte, { entradas: caso.entradas, rng: rngFixo(), maxLinhas: 2_000_000 })
}
