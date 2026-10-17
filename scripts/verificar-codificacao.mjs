// Guarda de codificação: recusa arquivos de texto que não sejam UTF-8 válido ou
// que tenham "mojibake" (UTF-8 lido como CP1252 e regravado: "ç" vira "A-til + seção").
// As versões 1.4.1 e 1.4.2 saíram assim sem ninguém perceber.
// Uso: node scripts/verificar-codificacao.mjs [arquivos...]
// Sem argumentos, confere os arquivos versionados (git ls-files).
// Os exemplos/*.alg ficam de fora: são CP1252 de propósito (igual ao VisuAlg).

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { extname, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXTENSOES = new Set(['.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.yml', '.txt', '.nsh'])
// Sequências que só aparecem quando UTF-8 foi decodificado como CP1252/Latin-1,
// mais o caractere de substituição U+FFFD. Escritas com \u para este próprio
// arquivo não disparar a guarda.
const MOJIBAKE = /\u00C3[\u0080-\u00BF]|\u00E2\u20AC|\u00E2\u0152|\u00C2[\u00A0-\u00BF]|\u00EF\u00BB\u00BF|\uFFFD/
const decodificador = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

const argumentos = process.argv.slice(2)
const arquivos = argumentos.length
  ? argumentos.map((a) => resolve(a))
  : execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8' })
      .split('\0')
      .filter((f) => f && EXTENSOES.has(extname(f).toLowerCase()) && !/^exemplos\/.*\.alg$/i.test(f))
      .map((f) => resolve(RAIZ, f))

const problemas = []
for (const arquivo of arquivos) {
  let bytes
  try {
    bytes = readFileSync(arquivo)
  } catch {
    continue // apagado no disco mas ainda no índice do git
  }
  let texto
  try {
    texto = decodificador.decode(bytes)
  } catch {
    problemas.push(`${arquivo}: não é UTF-8 válido`)
    continue
  }
  // BOM no início é permitido (instalador NSIS); o BOM lido como CP1252 (3 letras), não.
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1)
  texto.split('\n').forEach((linha, i) => {
    const achado = linha.match(MOJIBAKE)
    if (achado) problemas.push(`${arquivo}:${i + 1}: mojibake "${achado[0]}" → ${linha.trim().slice(0, 100)}`)
  })
}

if (problemas.length) {
  console.error(`Codificação quebrada em ${problemas.length} lugar(es):\n` + problemas.join('\n'))
  process.exit(1)
}
console.log(`Codificação OK (${arquivos.length} arquivos de texto em UTF-8, sem mojibake).`)
