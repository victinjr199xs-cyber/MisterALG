// F9 (clang WebAssembly) x g++. Lento (compila 16 programas no clang wasm): s? roda com MISTERALG_F9=1.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { compilarF9, fecharF9, lerEsperadosF9, programasF9, rodarWasm } from './diferencial/f9.mjs'

const rodar = process.env.MISTERALG_F9 === '1'
const esperados = lerEsperadosF9()
after(() => fecharF9())
for (const p of programasF9()) {
  test(`g++ x F9: ${p.nome}`, { skip: !rodar && 'defina MISTERALG_F9=1', timeout: 300000 }, async () => {
    const c = await compilarF9(p.fonte)
    assert.ok(c.wasm, c.erros)
    const r = rodarWasm(c.wasm, p.entrada)
    assert.equal(r.saida, esperados[p.nome].saida)
    assert.equal(r.codigo, esperados[p.nome].codigo)
  })
}
