import { test } from 'node:test'
import assert from 'node:assert/strict'
import { traduzirErro } from '../src/index.js'
import { rodar } from './ajudante.mjs'

const ok = async (fonte, esperado, op) => {
  const r = await rodar(fonte, op)
  assert.equal(r.fim.estado, 'terminado', JSON.stringify(r.fim))
  assert.equal(r.saida, esperado)
  return r
}

test('print, variáveis, laços e funções', async () => {
  await ok('x = 5\ny = 3\nprint(x + y)\n', '8\n')
  await ok('for i in range(3):\n    print(i)\n', '0\n1\n2\n')
  await ok('def soma(a, b):\n    return a + b\nprint(soma(2, 3))\n', '5\n')
  await ok('d = {"nome": "João", "idade": 30}\nprint(d["nome"])\n', 'João\n')
  await ok('class P:\n    def __init__(self, n):\n        self.n = n\n    def oi(self):\n        return f"Oi, {self.n}"\nprint(P("Maria").oi())\n', 'Oi, Maria\n')
})

test('o texto do aluno chega intacto: string de várias linhas e Tab', async () => {
  await ok('texto = """a\n  b"""\nprint(texto)\nif True:\n\tprint("tab")\n', 'a\n  b\ntab\n')
})

test('input() recebe a linha digitada e o prompt aparece na saída', async () => {
  await ok('nome = input("Nome? ")\nprint("oi", nome)\n', 'Nome? oi Ana\n', { entradas: ['Ana'] })
})

test('Esc no input() termina o programa como parado', async () => {
  const r = await rodar('x = input("? ")\nprint(x)\n')
  assert.equal(r.fim.estado, 'parado')
})

test('erro em tempo de execução: linha do aluno, traceback e explicação em português', async () => {
  const r = await rodar('x = 1\ny = x / 0\n')
  assert.equal(r.fim.estado, 'erro')
  assert.equal(r.fim.erro.linha, 2)
  assert.match(r.fim.erro.mensagem, /^ZeroDivisionError: divisão por zero/)
  assert.ok(r.fim.erro.explicacao)
  assert.match(r.erroSaida, /Traceback[\s\S]*line 2/)
})

test('erro numa função aponta a linha dentro dela', async () => {
  const r = await rodar('def f(v):\n    return v[5]\nf([1])\n')
  assert.equal(r.fim.erro.linha, 2)
  assert.match(r.fim.erro.mensagem, /IndexError: índice fora da lista/)
})

test('erro de sintaxe traz a linha e a tradução', async () => {
  const r = await rodar('print("ok")\nif x\n  pass\n')
  assert.equal(r.fim.estado, 'erro')
  assert.equal(r.fim.erro.linha, 2)
  assert.match(r.fim.erro.mensagem, /falta o dois-pontos/)
})

test('sys.exit() termina sem erro', async () => {
  const r = await rodar('import sys\nprint("a")\nsys.exit(0)\nprint("b")\n')
  assert.equal(r.fim.estado, 'terminado')
  assert.equal(r.saida, 'a\n')
})

test('recursão infinita vira RecursionError, não trava o processo', async () => {
  const r = await rodar('def f(n):\n    return f(n + 1)\nf(0)\n')
  assert.equal(r.fim.estado, 'erro')
  assert.match(r.fim.erro.mensagem, /RecursionError/)
})

test('passo a passo: uma pausa por linha executada, com a pilha e as variáveis', async () => {
  const r = await rodar('def soma(a, b):\n    return a + b\nx = soma(1, 2)\nprint(x)\n', { passo: true })
  assert.equal(r.fim.estado, 'terminado')
  assert.deepEqual(r.pausas.map((p) => p.linha), [1, 3, 2, 4])
  const dentro = r.pausas[2].foto
  assert.deepEqual(dentro.quadros.map((q) => q.nome), ['(programa principal)', 'soma'])
  assert.deepEqual(dentro.quadros[1].variaveis.map((v) => [v.nome, v.valor.texto]), [['a', '1'], ['b', '2']])
  assert.equal(r.pausas[3].foto.quadros[0].variaveis.find((v) => v.nome === 'x').valor.texto, '3')
})

test('passo a passo: referências compartilhadas têm o mesmo número de objeto', async () => {
  const r = await rodar('a = [1, 2]\nb = a\nc = [1, 2]\nd = {"k": a}\ne = 0\n', { passo: true })
  const f = r.pausas.at(-1).foto
  const ref = (nome) => f.quadros[0].variaveis.find((v) => v.nome === nome)?.valor.ref
  assert.equal(ref('a'), ref('b'))
  assert.notEqual(ref('a'), ref('c'))
  const dic = f.objetos.find((o) => o.tipo === 'dict')
  assert.equal(dic.itens[0].valor.ref, ref('a'))
  assert.deepEqual(f.objetos.find((o) => o.id === ref('a')).itens.map((i) => i.valor.texto), ['1', '2'])
})

test('passo a passo: instâncias mostram os atributos e a lista cíclica não trava', async () => {
  const r = await rodar('class N:\n    pass\na = N()\na.nome = "x"\na.eu = a\nz = 0\n', { passo: true })
  assert.deepEqual(r.pausas.map((p) => p.linha), [1, 2, 3, 4, 5, 6]) // "class N:" não pausa duas vezes
  const o = r.pausas.at(-1).foto.objetos.find((x) => x.rotulo === 'N')
  assert.deepEqual(o.itens.map((i) => i.chave), ['nome', 'eu'])
  assert.equal(o.itens[1].valor.ref, o.id)
})

test('breakpoints: roda direto até a linha marcada', async () => {
  const r = await rodar('a = 1\nb = 2\nc = 3\nd = 4\n', { breakpoints: [3], aoPausa: () => ({ c: 'continuar' }) })
  assert.deepEqual(r.pausas.map((p) => p.linha), [3])
  assert.equal(r.fim.estado, 'terminado')
})

test('compreensões e lambdas não geram pausas repetidas', async () => {
  const r = await rodar('v = [i * 2 for i in range(3)]\nf = lambda n: n + 1\nprint(f(1), v)\n', { passo: true })
  assert.deepEqual(r.pausas.map((p) => p.linha), [1, 2, 3])
  assert.equal(r.saida, '2 [0, 2, 4]\n')
})

test('traduzirErro: mensagens comuns', () => {
  assert.match(traduzirErro('NameError', "name 'x' is not defined").mensagem, /"x" não foi definida/)
  assert.match(traduzirErro('TypeError', "unsupported operand type(s) for +: 'int' and 'str'").mensagem, /não dá para usar \+ entre int e str/)
  assert.match(traduzirErro('ValueError', "invalid literal for int() with base 10: 'abc'").mensagem, /'abc' não pode virar um número inteiro/)
  assert.match(traduzirErro('AttributeError', "'NoneType' object has no attribute 'x'").mensagem, /None/)
  assert.match(traduzirErro('KeyError', "'a'").mensagem, /chave 'a' não existe/)
  assert.match(traduzirErro('IndentationError', "expected an indented block after 'if' statement on line 2").mensagem, /falta o bloco indentado/)
  assert.match(traduzirErro('ErroQueNaoExiste', 'algo').mensagem, /^ErroQueNaoExiste: algo/)
})
