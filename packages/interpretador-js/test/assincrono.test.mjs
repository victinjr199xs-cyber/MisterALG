import { test } from 'node:test'
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import { rodarJS, SessaoJS } from '../src/index.js'

/** Roda no Node de verdade (como módulo, para o await no topo valer) e compara com a saída do MisterALG. */
async function igualAoNode(codigo) {
  const esperado = execFileSync(process.execPath, ['--input-type=module'], { input: codigo, encoding: 'utf8' })
  const { status, saida, erro } = await rodarJS(codigo)
  assert.equal(status, 'terminado', erro?.mensagem)
  assert.equal(saida, esperado)
}

test('await no topo com setTimeout', () => igualAoNode(`
  const espera = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms))
  console.log('antes')
  const a = await espera(50, 'a')
  console.log(a)
  const [b, c] = await Promise.all([espera(10, 'b'), espera(5, 'c')])
  console.log(b, c)
  try { await Promise.reject(new Error('x')) } catch (e) { console.log('pegou', e.message) }
  console.log('depois')
`))

test('await no topo deixa as microtarefas e timers rodarem na ordem do Node', () => igualAoNode(`
  setTimeout(() => console.log('timer'), 0)
  Promise.resolve().then(() => console.log('micro'))
  console.log('um')
  await null
  console.log('dois')
  await new Promise((r) => setTimeout(r, 1))
  console.log('tres')
`))

test('for await sobre async function*', () => igualAoNode(`
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
  async function* contar(n) {
    for (let i = 1; i <= n; i++) { await dorme(10); yield i * 10 }
    return 'fim'
  }
  for await (const v of contar(3)) console.log(v)
  const g = contar(2)
  console.log(await g.next(), await g.next(), await g.next(), await g.next())
`))

test('for await sobre lista de promessas, break fecha o gerador e try/finally', () => igualAoNode(`
  for await (const x of [1, Promise.resolve(2), new Promise((r) => setTimeout(() => r(3), 5))]) console.log(x)
  async function* g() { try { yield 1; yield 2; yield 3 } finally { console.log('limpou') } }
  for await (const x of g()) { console.log(x); if (x === 2) break }
  const obj = { async *[Symbol.asyncIterator]() { yield 'a'; yield 'b' } }
  let juntos = ''
  for await (const x of obj) juntos += x
  console.log(juntos)
  class Fila { constructor() { this.n = 2 } async *itens() { for (let i = 0; i < this.n; i++) yield 'i' + i } }
  for await (const x of new Fila().itens()) console.log(x)
`))

test('for await sobre iterável assíncrono escrito à mão e destructuring', () => igualAoNode(`
  const fonte = {
    [Symbol.asyncIterator]() {
      let i = 0
      return { next: async () => (i < 3 ? { value: [i, i * i], done: (i++, false) } : { done: true }) }
    },
  }
  for await (const [a, b] of fonte) console.log(a, b)
  let x
  for await (x of [7, 8]) ;
  console.log(x)
`))

test('readline/promises: await rl.question no topo', async () => {
  const { status, saida } = await rodarJS(`
    const { createInterface } = require('readline/promises')
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const nome = await rl.question('Nome? ')
    const idade = Number(await rl.question('Idade? '))
    console.log(nome, idade + 1)
    rl.close()
  `, { entrada: ['Ana', '20'] })
  assert.equal(status, 'terminado')
  assert.equal(saida, 'Nome? Ana\nIdade? 20\nAna 21\n')
})

test('for await (const l of rl) com 3 linhas e Esc', async () => {
  const { status, saida } = await rodarJS(`
    const readline = require('readline')
    const rl = readline.createInterface({ input: process.stdin })
    const linhas = []
    for await (const linha of rl) linhas.push(linha.toUpperCase())
    console.log(linhas.join(','), 'fim')
  `, { entrada: ['a', 'b', 'c', null] })
  assert.equal(status, 'terminado')
  assert.equal(saida, 'a\nb\nc\nA,B,C fim\n')
})

test('for await sobre rl: break fecha a interface; rl.close() também encerra', async () => {
  const r1 = await rodarJS(`
    import readline from 'readline'
    const rl = readline.createInterface({ input: process.stdin })
    rl.on('close', () => console.log('fechou'))
    for await (const l of rl) { console.log('li', l); if (l === 'b') break }
    console.log('depois')
  `, { entrada: ['a', 'b', 'c'] })
  assert.equal(r1.status, 'terminado')
  assert.equal(r1.saida, 'a\nli a\nb\nli b\ndepois\nfechou\n')
  const r2 = await rodarJS(`
    const rl = require('readline').createInterface({ input: process.stdin })
    let n = 0
    for await (const l of rl) { console.log(l); if (++n === 2) rl.close() }
    console.log('fim')
  `, { entrada: ['x', 'y', 'z'] })
  assert.equal(r2.status, 'terminado')
  assert.equal(r2.saida, 'x\nx\ny\ny\nfim\n')
})

test('for await dentro de função async e sobre process.stdin', async () => {
  const { status, saida } = await rodarJS(`
    async function main() {
      let total = 0
      for await (const pedaco of process.stdin) total += Number(pedaco)
      return total
    }
    main().then((t) => console.log('total', t))
  `, { entrada: ['1', '2', '3', null] })
  assert.equal(status, 'terminado')
  assert.equal(saida, '1\n2\n3\ntotal 6\n')
})

test('for await com valor que não é iterável dá erro', async () => {
  const { status, erro } = await rodarJS('for await (const x of 5) {}\n')
  assert.equal(status, 'erro')
  assert.match(erro.mensagem, /não é iterável/)
})

test('passo a passo: para nas linhas certas num programa assíncrono', async () => {
  const fonte = [
    'const espera = (ms) => new Promise((r) => setTimeout(r, ms))', // 1
    'async function* gerar() {', // 2
    '  await espera(5)', // 3
    '  yield 1', // 4
    '  yield 2', // 5
    '}', // 6
    'await espera(10)', // 7
    'for await (const v of gerar()) {', // 8
    '  console.log(v)', // 9
    '}', // 10
    'console.log("fim")', // 11
  ].join('\n')
  const linhas = []
  const sessao = new SessaoJS(fonte, { semAtrasos: true, fatias: false, onStep: ({ linha, evento }) => { if (!evento) linhas.push(linha) } })
  sessao.passo()
  for (let i = 0; i < 200 && !sessao.terminado; i += 1) sessao.passo()
  assert.equal(sessao.estado, 'terminado')
  const visitadas = new Set(linhas)
  for (const l of [1, 3, 4, 5, 7, 8, 9, 11]) assert.ok(visitadas.has(l), `não parou na linha ${l}: ${linhas}`)
  assert.ok(!visitadas.has(6) && !visitadas.has(10), `parou numa linha de chave: ${linhas}`)
  assert.equal(linhas.filter((l) => l === 9).length, 2) // um passo por volta
  assert.equal(linhas.filter((l) => l === 4).length, 1)
})

test('breakpoint dentro do corpo do for await e variáveis visíveis', async () => {
  const fonte = ['async function* g() { yield 1; yield 2 }', 'let soma = 0', 'for await (const v of g()) {', '  soma += v', '}', 'console.log(soma)'].join('\n')
  const paradas = []
  const sessao = new SessaoJS(fonte, { semAtrasos: true, fatias: false, breakpoints: [4],
    onStep: ({ linha }) => paradas.push([linha, sessao.rt.pilha.at(-1)?.leitura?.()]) })
  sessao.continuar()
  assert.equal(sessao.estado, 'pausado')
  assert.equal(paradas.at(-1)[0], 4)
  assert.equal(paradas.at(-1)[1].v, 1)
  assert.equal(paradas.at(-1)[1].soma, 0)
  sessao.continuar()
  assert.equal(sessao.estado, 'pausado')
  assert.equal(paradas.at(-1)[1].v, 2)
  sessao.continuar()
  assert.equal(sessao.estado, 'terminado')
})
