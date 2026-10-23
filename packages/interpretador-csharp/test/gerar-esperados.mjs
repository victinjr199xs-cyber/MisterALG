// Gera os arquivos .txt com a saída esperada dos programas de test/programas/*.cs, compilando e rodando cada um
// com o C# de verdade (csc.exe do .NET Framework, só no Windows). Os .txt são commitados: os testes comparam
// o nosso interpretador com eles em qualquer sistema.
//   node test/gerar-esperados.mjs            (todos)     node test/gerar-esperados.mjs 03 05   (só os que começam com 03 e 05)
// Os programas precisam ser C# 5 (sem $"", ?., =>, nameof...) e não podem depender de diferenças entre o
// .NET Framework e o .NET moderno (como o ToString() de um double sem formato).

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CSC = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
if (!existsSync(CSC)) {
  console.error('csc.exe não encontrado: este gerador só funciona no Windows com o .NET Framework.')
  process.exit(1)
}

const pasta = fileURLToPath(new URL('./programas/', import.meta.url))
const filtros = process.argv.slice(2)
const temp = join(tmpdir(), 'misteralg-esperados')
mkdirSync(temp, { recursive: true })

for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith('.cs')).sort()) {
  if (filtros.length && !filtros.some((f) => arquivo.startsWith(f))) continue
  const base = arquivo.replace(/\.cs$/, '')
  const exe = join(temp, `${base}.exe`)
  try {
    execFileSync(CSC, ['/nologo', '/r:System.Numerics.dll', '/r:System.Core.dll', `/out:${exe}`, join(pasta, arquivo)], { stdio: 'pipe' })
  } catch (e) {
    console.log(`✖ ${arquivo}: não compilou\n${String(e.stdout)}`)
    continue
  }
  let saida
  try {
    // chcp 65001: o console do filho escreve em UTF-8 (os programas têm acentos).
    saida = execFileSync('cmd.exe', ['/d', '/s', '/c', `"chcp 65001>nul && "${exe}""`], { cwd: temp, timeout: 20000, maxBuffer: 20_000_000, windowsVerbatimArguments: true })
  } catch (e) {
    saida = e.stdout ?? Buffer.alloc(0)
    console.log(`! ${arquivo}: terminou com código ${e.status} (a saída até lá foi guardada)`)
  }
  const texto = saida.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  writeFileSync(join(pasta, `${base}.txt`), texto, 'utf8')
  console.log(`✔ ${arquivo} → ${texto.split('\n').length - 1} linhas`)
}
void readFileSync
