// Os cabeçalhos pré-compilados do C++ no disco: o worker do compilador grava o PCH dos #include de um
// programa, e outro worker (o app aberto de novo) já compila com ele, sem gerar de novo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

const clang = pathToFileURL(createRequire(import.meta.url).resolve('@yowasp/clang')).href
const PROGRAMA = '#include <iostream>\nint main() { std::cout << 42 << std::endl; }\n'

function abrir(pasta) {
  const w = new Worker(new URL('./compilador.js', import.meta.url), { workerData: { clang, pastasPch: [pasta] } })
  let id = 0
  const pedir = (msg) => new Promise((resolve) => {
    const meu = ++id
    const ouvir = (r) => { if (r.id === meu) { w.off('message', ouvir); resolve(r) } }
    w.on('message', ouvir)
    w.postMessage({ id: meu, ...msg })
  })
  return { pedir, fechar: () => w.terminate() }
}

test('o PCH gerado fica no disco e o próximo worker já compila com ele', { timeout: 300_000 }, async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'misteralg-pch-'))
  try {
    const a = abrir(pasta)
    const r1 = await a.pedir({ tipo: 'compilar', linguagem: 'cpp', fonte: PROGRAMA })
    assert.ok(r1.wasm, r1.erros)
    assert.ok(!r1.comPch)
    await a.pedir({ tipo: 'aquecer', linguagem: 'c', fonte: '' }) // espera a fila: o PCH é gerado depois da resposta
    await a.fechar()
    assert.equal(readdirSync(pasta).filter((f) => f.endsWith('.pch')).length, 1)

    const b = abrir(pasta)
    const r2 = await b.pedir({ tipo: 'compilar', linguagem: 'cpp', fonte: PROGRAMA.replace('42', '43') })
    assert.ok(r2.wasm, r2.erros)
    assert.equal(r2.comPch, true)
    await b.fechar()

    // um PCH de outra versão (o nome não confere) é ignorado
    writeFileSync(join(pasta, 'abc.txt'), '#include <vector>')
    writeFileSync(join(pasta, 'abc.pch'), 'lixo')
    const c = abrir(pasta)
    const r3 = await c.pedir({ tipo: 'compilar', linguagem: 'cpp', fonte: '#include <vector>\nint main() {}\n' })
    assert.ok(r3.wasm && !r3.comPch, r3.erros)
    await c.fechar()
  } finally {
    rmSync(pasta, { recursive: true, force: true })
  }
})
