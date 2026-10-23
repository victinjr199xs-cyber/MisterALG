import { test } from 'node:test'
import assert from 'node:assert'
import { rodarJS } from '../src/index.js'

test('programa vazio', async () => {
  const { status, saida } = await rodarJS('')
  assert.equal(status, 'terminado')
  assert.equal(saida, '')
})

test('console.log simples', async () => {
  const { status, saida } = await rodarJS('console.log("olá")')
  assert.equal(status, 'terminado')
  assert.equal(saida, 'olá\n')
})

test('variáveis e operações', async () => {
  const { status, saida } = await rodarJS(`
    let x = 5
    let y = 3
    console.log(x + y)
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, '8\n')
})

test('função simples', async () => {
  const { status, saida } = await rodarJS(`
    function soma(a, b) {
      return a + b
    }
    console.log(soma(2, 3))
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, '5\n')
})

test('laço for', async () => {
  const { status, saida } = await rodarJS(`
    for (let i = 0; i < 3; i++) {
      console.log(i)
    }
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, '0\n1\n2\n')
})

test('array', async () => {
  const { status, saida } = await rodarJS(`
    let arr = [1, 2, 3]
    console.log(arr[1])
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, '2\n')
})

test('objeto', async () => {
  const { status, saida } = await rodarJS(`
    let obj = { nome: 'João', idade: 30 }
    console.log(obj.nome)
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, 'João\n')
})

test('classe simples', async () => {
  const { status, saida } = await rodarJS(`
    class Pessoa {
      constructor(nome) {
        this.nome = nome
      }
      saudar() {
        return 'Oi, ' + this.nome
      }
    }
    let p = new Pessoa('Maria')
    console.log(p.saudar())
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, 'Oi, Maria\n')
})

test('recursão', async () => {
  const { status, saida } = await rodarJS(`
    function fat(n) {
      return n <= 1 ? 1 : n * fat(n - 1)
    }
    console.log(fat(5))
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, '120\n')
})

test('typeof', async () => {
  const { status, saida } = await rodarJS(`
    console.log(typeof 42)
    console.log(typeof 'texto')
    console.log(typeof true)
  `)
  assert.equal(status, 'terminado')
  assert.equal(saida, 'number\nstring\nboolean\n')
})
