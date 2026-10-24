// Cada programa em test/programas/*.cs roda no nosso interpretador e a saída tem de ser igual à gerada pelo
// C# de verdade (o .txt do lado, feito por test/gerar-esperados.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rodar } from './ajudante.mjs'

const pasta = fileURLToPath(new URL('./programas/', import.meta.url))
const filtro = process.env.PROGRAMA

for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith('.cs')).sort()) {
  if (filtro && !arquivo.startsWith(filtro)) continue
  const esperado = arquivo.replace(/\.cs$/, '.txt')
  if (!existsSync(pasta + esperado)) continue
  test(arquivo, async () => {
    const r = await rodar(readFileSync(pasta + arquivo, 'utf8'))
    const a = r.saida.split(/\r?\n/)
    const b = readFileSync(pasta + esperado, 'utf8').split(/\r?\n/) // no Windows o git pode trazer os .txt com CRLF
    const diferencas = []
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) diferencas.push(`  linha ${i + 1}: obtido ${JSON.stringify(a[i])}  esperado ${JSON.stringify(b[i])}`)
    }
    const extra = r.erro ? `\n  erro do interpretador (linha ${r.erro.linha}): ${r.erro.mensagem}` : r.erros ? `\n  erro de sintaxe: ${JSON.stringify(r.erros)}` : ''
    assert.equal(diferencas.length, 0, `${arquivo}: ${diferencas.length} diferença(s)\n${diferencas.slice(0, 12).join('\n')}${extra}`)
    assert.equal(r.status, 'terminado', JSON.stringify(r.erro ?? r.erros))
  })
}
