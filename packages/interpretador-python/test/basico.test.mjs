import { test } from 'node:test'
import assert from 'node:assert'
import { rodarPython } from '../src/index.js'

test('print simples', async () => {
  const { status, saida } = await rodarPython('print("Olá")')
  assert.equal(status, 'terminado')
  assert(saida.includes('Olá'))
})

test('variáveis e aritmética', async () => {
  const { status, saida } = await rodarPython(`
x = 5
y = 3
print(x + y)
`)
  assert.equal(status, 'terminado')
  assert(saida.includes('8'))
})

test('lista', async () => {
  const { status, saida } = await rodarPython(`
lista = [1, 2, 3]
print(lista[1])
`)
  assert.equal(status, 'terminado')
  assert(saida.includes('2'))
})

test('dicionário', async () => {
  const { status, saida } = await rodarPython(`
d = {'nome': 'João', 'idade': 30}
print(d['nome'])
`)
  assert.equal(status, 'terminado')
  assert(saida.includes('João'))
})

test('função', async () => {
  const { status, saida } = await rodarPython(`
def soma(a, b):
    return a + b
print(soma(2, 3))
`)
  assert.equal(status, 'terminado')
  assert(saida.includes('5'))
})

test('laço for', async () => {
  const { status, saida } = await rodarPython(`
for i in range(3):
    print(i)
`)
  assert.equal(status, 'terminado')
  assert(saida.includes('0'))
  assert(saida.includes('2'))
})

test('classe', async () => {
  const { status, saida } = await rodarPython(`
class Pessoa:
    def __init__(self, nome):
        self.nome = nome
    def saudar(self):
        return f'Oi, {self.nome}'
p = Pessoa('Maria')
print(p.saudar())
`)
  assert.equal(status, 'terminado')
  assert(saida.includes('Maria'))
})
