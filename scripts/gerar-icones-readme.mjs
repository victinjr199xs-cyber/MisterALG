// Gera os ícones das linguagens (docs/imagens/linguagens/*.svg) para o README, a partir dos mesmos desenhos do app.
import { writeFileSync } from 'node:fs'
import { ICONES_LINGUAGEM } from '../app/src/renderer/icones-linguagens.js'
const CORES = { portugol: '#8b5cf6', csharp: '#e5533d', javascript: '#f2b705', typescript: '#2f6fde', python: '#16a37f', c: '#4361ee', cpp: '#0ea5c6', php: '#ec4899', sql: '#b45309' }
for (const [id, cor] of Object.entries(CORES)) {
  const miolo = ICONES_LINGUAGEM[id].replace('<svg class="ic" viewBox="0 0 64 64"', '<svg x="6" y="6" width="68" height="68" viewBox="0 0 64 64"')
  writeFileSync(`docs/imagens/linguagens/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="18" fill="${cor}"/>${miolo}</svg>\n`)
}
console.log('ok')
