// A árvore do passo a passo (F8) feita de antemão: depois de um F9 que deu certo (e ao abrir o arquivo), o
// worker das árvores (clang.js) recebe "antecipar" e deixa pronta a árvore do programa; o F8 não espera o clang.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

const clang = pathToFileURL(createRequire(import.meta.url).resolve('@yowasp/clang')).href
const PROGRAMA = '#include <iostream>\nint main() { int x = 2; std::cout << x * 21 << std::endl; }\n'

test('a árvore antecipada sai pronta no F8', { timeout: 300_000 }, async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'misteralg-arvore-'))
  const w = new Worker(new URL('./compilador.js', import.meta.url), { workerData: { clang, pastasPch: [pasta], pchGravavel: false } })
  let id = 0
  const pedir = (msg) => new Promise((resolve) => {
    const meu = ++id
    const ouvir = (r) => { if (r.id === meu) { w.off('message', ouvir); resolve(r) } }
    w.on('message', ouvir)
    w.postMessage({ id: meu, ...msg })
  })
  try {
    await pedir({ tipo: 'antecipar', linguagem: 'cpp', fonte: PROGRAMA })
    const inicio = performance.now()
    const a = await pedir({ tipo: 'arvore', linguagem: 'cpp', fonte: PROGRAMA })
    const tempo = performance.now() - inicio
    assert.ok(a.ast && JSON.parse(a.ast).inner.some((n) => n.name === 'main'), a.erros)
    assert.ok(tempo < 200, `a árvore devia vir pronta, levou ${Math.round(tempo)} ms`)
    // outro texto: não vem do que está guardado
    const b = await pedir({ tipo: 'arvore', linguagem: 'cpp', fonte: PROGRAMA.replace('21', '22') })
    assert.ok(b.ast && b.ast !== a.ast)
  } finally {
    await w.terminate()
    rmSync(pasta, { recursive: true, force: true })
  }
})
