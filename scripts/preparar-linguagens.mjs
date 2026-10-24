// Copia para app/build/linguagens o que o app instalado precisa em tempo de execução e que não vai no
// bundle: Pyodide (Python), php-wasm (só PHP 8.3) e o tree-sitter de C#. O electron-builder leva a pasta
// para resources/linguagens (extraResources). Uso: node scripts/preparar-linguagens.mjs
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const nm = join(raiz, 'node_modules')
const destino = join(raiz, 'app', 'build', 'linguagens')
rmSync(destino, { recursive: true, force: true })

const copiar = (de, para) => {
  if (!existsSync(de)) throw new Error(`faltou ${de} (rode npm install)`)
  mkdirSync(dirname(para), { recursive: true })
  cpSync(de, para, { recursive: true })
}

// Python: o pacote inteiro do Pyodide (a stdlib e o wasm vêm junto; o .map só pesa).
for (const f of ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json', 'package.json']) {
  copiar(join(nm, 'pyodide', f), join(destino, 'pyodide', f))
}

// PHP: @php-wasm/node e o fecho das dependências, só com o PHP 8.3 (cada versão pesa dezenas de MB).
const feito = new Set()
const levar = (nome) => {
  if (feito.has(nome) || /^@php-wasm\/node-\d/.test(nome) && nome !== '@php-wasm/node-8-3') return
  feito.add(nome)
  copiar(join(nm, nome), join(destino, 'php', 'node_modules', nome))
  const pkg = JSON.parse(readFileSync(join(nm, nome, 'package.json'), 'utf8'))
  for (const d of Object.keys(pkg.dependencies ?? {})) levar(d)
}
levar('@php-wasm/node')

// SQL: o PostgreSQL do PGlite (dist sem os .map e sem as extensões opcionais).
cpSync(join(nm, '@electric-sql', 'pglite', 'dist'), join(destino, 'pglite', 'dist'), { recursive: true, filter: (f) => !/\.(map|d\.ts|d\.cts)$/.test(f) && !/\.tar\.gz$/.test(f) })
copiar(join(nm, '@electric-sql', 'pglite', 'package.json'), join(destino, 'pglite', 'package.json'))

// C#: o motor do tree-sitter e a gramática.
const cs = join(destino, 'csharp')
copiar(join(nm, 'web-tree-sitter', 'tree-sitter.js'), join(cs, 'web-tree-sitter', 'tree-sitter.js'))
// O tree-sitter.js é CommonJS: sem um package.json ao lado, um "type": "module" mais acima o trataria como ESM.
writeFileSync(join(cs, 'web-tree-sitter', 'package.json'), '{"type":"commonjs"}\n')
copiar(join(nm, 'web-tree-sitter', 'tree-sitter.wasm'), join(cs, 'web-tree-sitter', 'tree-sitter.wasm'))
copiar(join(nm, 'tree-sitter-wasms', 'out', 'tree-sitter-c_sharp.wasm'), join(cs, 'tree-sitter-c_sharp.wasm'))

console.log(`linguagens prontas em ${destino}: ${[...feito].join(', ')}`)
