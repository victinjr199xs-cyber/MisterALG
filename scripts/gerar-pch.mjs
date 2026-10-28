// Gera os cabeçalhos pré-compilados do C++ que vão no instalador (app/build/pch → resources/pch), para o
// primeiro F9 com os #include mais comuns não esperar o clang ler toda a biblioteca padrão. Usa o próprio
// worker do compilador do app (mesmo clang, mesmas opções: o nome de cada arquivo confere isso).
// Uso: node scripts/gerar-pch.mjs
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const destino = join(raiz, 'app', 'build', 'pch')
const PREFIXOS = ['#include <iostream>', '#include <bits/stdc++.h>']

rmSync(destino, { recursive: true, force: true })
const clang = pathToFileURL(createRequire(join(raiz, 'app', 'package.json')).resolve('@yowasp/clang')).href
const trabalhador = new Worker(join(raiz, 'app', 'src', 'main', 'compilador.js'), { workerData: { clang, pastasPch: [destino] } })
let proximo = 0
const pedir = (fonte) => new Promise((resolve) => {
  const id = ++proximo
  const ouvir = (r) => { if (r.id === id) { trabalhador.off('message', ouvir); resolve(r) } }
  trabalhador.on('message', ouvir)
  trabalhador.postMessage({ id, tipo: 'pch', fonte })
})
for (const prefixo of PREFIXOS) {
  const inicio = Date.now()
  const { caminho } = await pedir(prefixo)
  if (!caminho) throw new Error(`não consegui gerar o PCH de ${prefixo}`)
  console.log(`${prefixo}: ${caminho} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`)
}
await trabalhador.terminate()
