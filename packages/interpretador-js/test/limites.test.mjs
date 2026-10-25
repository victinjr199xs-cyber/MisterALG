import { test } from 'node:test'
import assert from 'node:assert'
import { execFileSync, spawnSync } from 'node:child_process'
import { rodarJS, SessaoJS } from '../src/index.js'

/** Roda no Node de verdade (como módulo, para o await no topo valer) e compara com a saída do MisterALG. */
async function igualAoNode(codigo) {
  const esperado = execFileSync(process.execPath, ['--input-type=module'], { input: codigo, encoding: 'utf8' })
  const { status, saida, erro } = await rodarJS(codigo)
  assert.equal(status, 'terminado', erro?.mensagem)
  assert.equal(saida, esperado)
}

test('yield* dentro de async function*: iterável assíncrono, síncrono e valor de retorno', () => igualAoNode(`
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
  async function* interno() { await dorme(5); yield 'a'; yield 'b'; return 'fim-interno' }
  async function* externo() {
    yield 0
    const r = yield* interno()
    console.log('retorno', r)
    yield* [1, Promise.resolve(2)]
    yield* 'xy'
    return 'fim'
  }
  for await (const v of externo()) console.log(v)
  const g = externo()
  console.log(await g.next(), await g.next(), await g.next())
`))

test('yield* dentro de async function*: throw e return chegam ao iterável de dentro', () => igualAoNode(`
  async function* interno() {
    try { yield 1; yield 2 } catch (e) { console.log('interno pegou', e); yield 'recuperou' } finally { console.log('interno limpou') }
  }
  async function* externo() { try { yield* interno() } finally { console.log('externo limpou') } }
  const a = externo()
  console.log(await a.next())
  console.log(await a.throw('boom'))
  console.log(await a.next())
  const b = externo()
  await b.next()
  console.log(await b.return('cedo'))
  for await (const v of externo()) { console.log(v); break }
`))

test('yield* em async function* recebe os valores de next(v)', () => igualAoNode(`
  async function* eco() { let x = yield 'pronto'; while (x !== 'fim') x = yield 'eco ' + x }
  async function* fora() { yield* eco() }
  const g = fora()
  console.log((await g.next()).value, (await g.next('a')).value, (await g.next('b')).value, (await g.next('fim')).done)
`))

test('for await com rótulo: continue e break rotulo', () => igualAoNode(`
  async function* g(n) { for (let i = 0; i < n; i++) yield i }
  externo: for await (const i of g(4)) {
    for await (const j of g(4)) {
      if (j === 2) continue externo
      if (i === 3) break externo
      console.log(i, j)
    }
  }
  fim: for await (const x of [1, 2, 3]) { if (x === 2) break fim; console.log('x', x) }
  console.log('ok')
`))

test('async *[Symbol.asyncIterator]() em classe (chave calculada), estático e com nome calculado', () => igualAoNode(`
  class Fila {
    constructor() { this.itens = ['a', 'b', 'c'] }
    async *[Symbol.asyncIterator]() { for (const x of this.itens) { await null; yield x } }
    static async *['de' + 'zero'](n) { for (let i = 0; i < n; i++) yield i }
  }
  for await (const x of new Fila()) console.log(x)
  for await (const x of Fila.dezero(3)) console.log(x)
`))

test('async *[Symbol.asyncIterator]() em classe passa pelo passo a passo', async () => {
  const fonte = ['class C {', '  async *[Symbol.asyncIterator]() {', '    yield 1', '    yield 2', '  }', '}', 'for await (const v of new C()) {', '  console.log(v)', '}'].join('\n')
  const linhas = []
  const s = new SessaoJS(fonte, { semAtrasos: true, fatias: false, onStep: ({ linha, evento }) => { if (!evento) linhas.push(linha) } })
  for (let i = 0; i < 100 && !s.terminado; i += 1) s.passo()
  assert.equal(s.estado, 'terminado')
  assert.ok(linhas.includes(3) && linhas.includes(4), `não entrou no método: ${linhas}`)
})

test('for await: variável do laço com o mesmo nome de uma declaração do corpo', () => igualAoNode(`
  for await (const x of [1, 2]) { const y = x * 2; { const x = 'dentro'; console.log(x, y) } }
  for await (const v of [1, 2]) { let v = 'corpo'; console.log(v) }
  async function* g() { yield 5 }
  for await (const item of g()) { const item2 = item; var item3 = item2 + 1 }
  console.log(item3)
`))

test('await no topo numa Promise que nunca termina: mensagem clara com a linha do await (como o código 13 do Node)', async () => {
  const fonte = 'console.log("antes")\nsetTimeout(() => console.log("timer"), 5)\nconst x = await new Promise(() => {})\nconsole.log("nunca")\n'
  const real = spawnSync(process.execPath, ['--input-type=module'], { input: fonte, encoding: 'utf8' })
  assert.equal(real.status, 13)
  const { status, saida, erro } = await rodarJS(fonte)
  assert.equal(saida, real.stdout)
  assert.equal(status, 'erro')
  assert.match(erro.mensagem, /nunca foi resolvida/)
  assert.equal(erro.linha, 3)
  assert.match(erro.explicacao, /unsettled top-level await/)
})

test('await no topo que termina normalmente, e async solta pendente, não dão erro', async () => {
  await igualAoNode('await null\nasync function f() { await new Promise(() => {}) }\nf()\nconsole.log("ok")\n')
})

test('recursão funda: 5000, 10000 e recursão mútua dão o mesmo resultado do Node', () => igualAoNode(`
  const soma = (n) => (n === 0 ? 0 : n + soma(n - 1))
  function par(n) { return n === 0 ? true : impar(n - 1) }
  function impar(n) { return n === 0 ? false : par(n - 1) }
  class Arvore { constructor(p) { this.p = p } prof() { return this.p ? 1 + this.p.prof() : 0 } }
  let a = null
  for (let i = 0; i < 6000; i++) a = new Arvore(a)
  console.log(soma(5000), soma(6000), par(7001), a.prof())
  function pega(n) { try { if (n === 0) throw new Error('fundo'); return pega(n - 1) } catch (e) { if (n % 2500 === 0) console.log('pegou em', n); throw e } }
  try { pega(5000) } catch (e) { console.log(e.message) }
  const mapeia = (n) => (n === 0 ? [0] : [n].concat([n].map((x) => x - 1).flatMap((x) => mapeia(x))))
  console.log(mapeia(800).length)
`))

test('recursão funda dentro de função async e com await no meio', () => igualAoNode(`
  async function conta(n) { if (n === 0) return 0; await null; return 1 + (await conta(n - 1)) }
  console.log(await conta(1500))
  function prof(n) { return n === 0 ? 0 : 1 + prof(n - 1) }
  async function usa() { await null; return prof(7000) }
  console.log(await usa())
`))

test('recursão infinita continua dando a mensagem de estouro de pilha, e dá para pegar com try/catch', async () => {
  const r = await rodarJS('function f(n) { return f(n + 1) + 1 }\nf(0)\n')
  assert.equal(r.status, 'erro')
  assert.match(r.erro.mensagem, /pilha de chamadas estourou/)
  assert.equal(r.erro.linha, 1)
  const r2 = await rodarJS('function f() { return f() }\ntry { f() } catch (e) { console.log("pegou") }\nconsole.log("seguiu")\n')
  assert.equal(r2.status, 'terminado')
  assert.equal(r2.saida, 'pegou\nseguiu\n')
  const r3 = await rodarJS('async function f() { await f() }\nf()\n')
  assert.equal(r3.status, 'erro')
  assert.match(r3.erro.mensagem, /pilha de chamadas estourou/)
})

test('recursão funda no passo a passo: a pilha mostrada é limitada e o passo não trava', async () => {
  const s = new SessaoJS('function f(n) {\n  if (n === 0) return 0\n  return 1 + f(n - 1)\n}\nconsole.log(f(4000))\n', { semAtrasos: true, fatias: false, breakpoints: [2] })
  let fotos = 0
  s.op.onMemory = (m) => { if (m) { fotos += 1; assert.ok(m.quadros.length <= 301) } }
  s.continuar()
  assert.equal(s.estado, 'pausado')
  for (let i = 0; i < 50; i += 1) s.continuar()
  assert.ok(fotos > 10)
  s.breakpoints.clear()
  s.continuar()
  assert.equal(s.estado, 'terminado')
})
