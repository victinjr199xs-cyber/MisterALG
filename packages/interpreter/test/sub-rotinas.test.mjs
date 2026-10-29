// Sub-rotinas (funcao/procedimento): onde ficam, como são escritas e as mensagens dos erros comuns.
import test from 'node:test'
import assert from 'node:assert/strict'
import { rodar } from '../src/index.js'

const exec = (src) => rodar(src, { entradas: [], rng: () => 0.5, limitePassos: 100000 })

test('sub-rotina antes de Algoritmo: erro 1 chama o programa de MisterALG e explica onde ela fica', async () => {
  const r = await exec('FUNCAO F (N: REAL): REAL\ninicio\nretorne N\nfimfuncao\nAlgoritmo "x"\ninicio\nfimalgoritmo')
  assert.equal(r.status, 'erro')
  assert.equal(r.erro.codigo, 1)
  assert.equal(r.erro.linha, 1)
  assert.doesNotMatch(r.erro.mensagem, /VISUALG/i)
  assert.match(r.erro.mensagem, /MisterALG/)
  assert.match(r.erro.explicacao, /DENTRO do algoritmo/)
})

test('procedimento antes de Algoritmo recebe a mesma explicação; outro comando antes, a geral', async () => {
  const a = await exec('procedimento p\ninicio\nfimprocedimento\nalgoritmo "x"\ninicio\nfimalgoritmo')
  assert.match(a.erro.explicacao, /DENTRO do algoritmo/)
  const b = await exec('var x: inteiro\nalgoritmo "x"\ninicio\nfimalgoritmo')
  assert.equal(b.erro.codigo, 1)
  assert.match(b.erro.explicacao, /começa com a linha Algoritmo/)
})

test('parâmetro sem dois-pontos: "Esperava encontrar \':\'" com explicação', async () => {
  const r = await exec('algoritmo "x"\nfuncao f(num numerico): real\ninicio\nretorne num\nfimfuncao\ninicio\nfimalgoritmo')
  assert.equal(r.erro.codigo, 30)
  assert.equal(r.erro.linha, 2)
  assert.match(r.erro.mensagem, /':'/)
  assert.match(r.erro.explicacao, /nome: tipo/)
})

test('função sem tipo de retorno: mesmo erro com explicação', async () => {
  const r = await exec('algoritmo "x"\nfuncao f(num: real)\ninicio\nretorne num\nfimfuncao\ninicio\nfimalgoritmo')
  assert.equal(r.erro.codigo, 30)
  assert.match(r.erro.explicacao, /nome: tipo/)
})

test('sub-rotinas bem escritas: ENTÃO/SENÃO com acento, numerico, vários parâmetros, locais e recursão', async () => {
  const r = await exec(`algoritmo "x"
var r: numerico
FUNÇÃO VERIFICA (NUM: REAL): REAL
var res: real
INÍCIO
  SE (NUM >= 0) ENTÃO
    res <- 1
  SENÃO
    res <- 0
  FIMSE
  RETORNE res
FIMFUNÇÃO
funcao soma(a, b: inteiro; c: real): real
inicio
  retorne a + b + c
fimfuncao
funcao fat(n: inteiro): inteiro
inicio
  se n <= 1 entao
    retorne 1
  fimse
  retorne n * fat(n - 1)
fimfuncao
procedimento oi
inicio
  escreval("oi")
fimprocedimento
inicio
  oi
  r <- VERIFICA(5) + VERIFICA(-5)
  escreval(r, " ", soma(1, 2, 3.5), " ", fat(5))
fimalgoritmo`)
  assert.equal(r.status, 'terminado', r.erro?.mensagem)
  assert.equal(r.saida, 'oi\n 1  6.5  120\n')
})

test('variável usada só como parâmetro não existe fora da função (erro 11)', async () => {
  const r = await exec('algoritmo "x"\nfuncao f(num: real): real\ninicio\nretorne num\nfimfuncao\ninicio\nleia(num)\nfimalgoritmo')
  assert.equal(r.erro.codigo, 11)
  assert.equal(r.erro.linha, 7)
})
