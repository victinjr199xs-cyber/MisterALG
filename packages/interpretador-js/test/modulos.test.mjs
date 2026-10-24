import { test } from 'node:test'
import assert from 'node:assert'
import { rodarJS } from '../src/index.js'

test('readline: question com callback', async () => {
  const { status, saida } = await rodarJS(`
    const readline = require('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('Nome? ', (nome) => {
      console.log('Oi ' + nome)
      rl.question('Idade? ', (idade) => {
        console.log(Number(idade) + 1)
        rl.close()
      })
    })
  `, { entrada: ['Ana', '20'] })
  assert.equal(status, 'terminado')
  assert.equal(saida, 'Nome? Ana\nOi Ana\nIdade? 20\n21\n')
})

test('readline: on(line) com 3 linhas e close pelo fim da entrada', async () => {
  const { status, saida } = await rodarJS(`
    import * as readline from 'node:readline'
    const rl = readline.createInterface({ input: process.stdin })
    const linhas = []
    rl.on('line', (l) => linhas.push(l))
    rl.on('close', () => console.log(linhas.length, linhas.join('+')))
  `, { entrada: ['a', 'b', 'c', null] })
  assert.equal(status, 'terminado')
  assert.equal(saida, 'a\nb\nc\n3 a+b+c\n')
})

test('readline: rl.close() dentro do on(line) termina o programa', async () => {
  const { status, saida } = await rodarJS(`
    import readline from 'readline'
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    let n = 0
    rl.on('line', (l) => { console.log('linha', l); if (++n === 2) rl.close() })
    rl.on('close', () => console.log('fim'))
  `, { entrada: ['x', 'y', 'z'] })
  assert.equal(status, 'terminado')
  assert.equal(saida, 'x\nlinha x\ny\nlinha y\nfim\n')
})

test('readline/promises: await rl.question dentro de função async', async () => {
  const { status, saida } = await rodarJS(`
    const { createInterface } = require('readline/promises')
    async function main() {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const a = Number(await rl.question('a? '))
      const b = Number(await rl.question('b? '))
      console.log(a + b)
      rl.close()
    }
    main()
  `, { entrada: ['2', '3'] })
  assert.equal(status, 'terminado')
  assert.equal(saida, 'a? 2\nb? 3\n5\n')
})

test('fs.readFileSync(0) soma números até a linha vazia', async () => {
  const { status, saida } = await rodarJS(`
    const fs = require('fs')
    const nums = fs.readFileSync(0, 'utf8').trim().split('\\n').map(Number)
    console.log(nums.reduce((a, b) => a + b, 0))
  `, { entrada: ['1', '2', '3', ''] })
  assert.equal(status, 'terminado')
  assert.equal(saida, '1\n2\n3\n\n6\n')
})

test('process.stdin data/end', async () => {
  const { status, saida } = await rodarJS(`
    let txt = ''
    process.stdin.on('data', (c) => { txt += c })
    process.stdin.on('end', () => console.log(txt.trim().split('\\n').length))
  `, { entrada: ['a', 'b', null] })
  assert.equal(status, 'terminado')
  assert.equal(saida, 'a\nb\n2\n')
})

test('util e assert', async () => {
  const { status, saida, erro } = await rodarJS(`
    const util = require('util')
    const assert = require('assert')
    console.log(util.format('%s=%d', 'x', 3), util.inspect({ a: [1] }))
    assert.strictEqual(1, 1)
    assert.deepStrictEqual({ a: 1 }, { a: 1 })
    assert.strictEqual(1, 2)
  `)
  assert.equal(status, 'erro')
  assert.equal(saida, 'x=3 { a: [ 1 ] }\n')
  assert.match(erro.mensagem, /AssertionError/)
})

test('módulo desconhecido dá erro claro em português', async () => {
  const { status, erro } = await rodarJS(`const http = require('http')`)
  assert.equal(status, 'erro')
  assert.equal(erro.mensagem, "O módulo 'http' não existe no MisterALG (só readline, fs para ler a entrada, util e assert).")
  assert.match(erro.explicacao, /Esc/)
})
