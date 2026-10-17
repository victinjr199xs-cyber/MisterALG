import test from 'node:test'
import assert from 'node:assert/strict'
import { executar, rodar, verificar } from '../src/index.js'

const prog = (corpo, decl = '') => `algoritmo "t"\nvar\n${decl}\ninicio\n${corpo}\nfimalgoritmo\n`

async function saida(corpo, decl, entradas = []) {
  const r = await rodar(prog(corpo, decl), { entradas })
  if (r.status === 'erro') throw new Error(`linha ${r.erro.linha}: ${r.erro.mensagem}`)
  return r.saida
}

async function falha(corpo, decl = '', entradas = []) {
  const r = await rodar(prog(corpo, decl), { entradas })
  assert.equal(r.status, 'erro')
  return r.erro
}

test('escreva: espaço antes de números e lógicos, reais sem zeros', async () => {
  assert.equal(await saida('escreval(7, "a", 7/2, 10/2, 1/3, verdadeiro)'), ' 7a 3.5 5 0.3333333333 VERDADEIRO\n')
  assert.equal(await saida('escreval(pi)'), ' 3.1415926536\n')
  assert.equal(await saida('escreval(-5, 0.1 + 0.2)'), ' -5 0.3\n')
})

test('escreva com largura e casas decimais', async () => {
  assert.equal(await saida('escreval("x", 2.5:4:1, 9:4)'), 'x 2.5   9\n')
  assert.equal(await saida('escreval(2.675:0:2, 3:6:2, "ab":4)'), '2.68  3.00  ab\n')
})

test('aritmética e precedência', async () => {
  assert.equal(await saida('escreval(7 \\ 2, 7 div 2, 8 mod 3, 25 % 3, 2 ^ 10, -3 ^ 2)'), ' 3 3 2 1 1024 9\n')
  assert.equal(await saida('escreval(2 + 3 * 4, (2 + 3) * 4, exp(2, 9), int(-1.8))'), ' 14 20 512 -1\n')
  assert.equal(await saida('escreval("Rio " + "de Janeiro", "ABC" = "abc", "A" > "B")'), 'Rio de Janeiro VERDADEIRO FALSO\n')
})

test('se, escolha com faixas e listas', async () => {
  const corpo = `para i de 1 ate 5 faca
  escolha i
  caso 1, 2
    escreva("a")
  caso 3 ate 4
    escreva("b")
  outrocaso
    escreva("c")
  fimescolha
fimpara`
  assert.equal(await saida(corpo, 'i: inteiro'), 'aabbc')
})

test('para com passo negativo, enquanto, repita e interrompa', async () => {
  assert.equal(await saida('para i de 3 ate 1 passo -1 faca\nescreva(i)\nfimpara\nescreval(i)', 'i: inteiro'), ' 3 2 1 0\n')
  assert.equal(await saida('i <- 0\nenquanto i < 3 faca\ni <- i + 1\nfimenquanto\nescreval(i)', 'i: inteiro'), ' 3\n')
  assert.equal(await saida('repita\ni <- i + 2\nate i > 5\nescreval(i)', 'i: inteiro'), ' 6\n')
  assert.equal(await saida('repita\ni <- i + 1\nse i = 4 entao\ninterrompa\nfimse\nfimrepita\nescreval(i)', 'i: inteiro'), ' 4\n')
})

test('passo zero dá erro', async () => {
  const e = await falha('para i de 1 ate 3 passo 0 faca\nfimpara', 'i: inteiro')
  assert.match(e.mensagem, /O passo de um PARA...FACA não pode ser zero/)
})

test('funções, recursão, parâmetro por referência e sombreamento', async () => {
  const fonte = `algoritmo "f"
var
  a, b, t: inteiro
funcao fat(n: inteiro): inteiro
inicio
  se n <= 1 entao
    retorne 1
  fimse
  retorne n * fat(n - 1)
fimfuncao
procedimento troca(var x, y: inteiro)
var t: inteiro
inicio
  t <- x
  x <- y
  y <- t
fimprocedimento
inicio
  a <- 1
  b <- 2
  t <- 99
  troca(a, b)
  escreval(a, b, t, fat(5))
fimalgoritmo`
  const r = await rodar(fonte)
  assert.equal(r.saida, ' 2 1 99 120\n')
})

test('vetores, matrizes e registros (cópia por valor)', async () => {
  const fonte = `algoritmo "r"
const
  MAX = 3
tipo
  pessoa = registro
    nome: caractere
    idade: inteiro
  fimregistro
var
  m: vetor[1..2, 1..MAX] de inteiro
  p: vetor[1..MAX] de pessoa
  q: pessoa
inicio
  m[2, 3] <- 7
  p[1].nome <- "Ana"
  q <- p[1]
  q.nome <- "Bia"
  escreval(m[2, 3], m[1, 1], " ", p[1].nome, q.nome)
fimalgoritmo`
  assert.equal((await rodar(fonte)).saida, ' 7 0 AnaBia\n')
})

test('leia converte por tipo e ecoa; eco off cala', async () => {
  assert.equal(await saida('leia(n, r, c, l)\nescreval(n + 1, r, c, l)', 'n: inteiro\nr: real\nc: caractere\nl: logico', ['4', '2.5', 'oi', 'v']),
    '4\n2.5\noi\nv\n 5 2.5oi VERDADEIRO\n')
  assert.equal(await saida('eco off\nleia(n)\nescreval(n)', 'n: inteiro', ['8']), ' 8\n')
  const e = await falha('leia(n)', 'n: inteiro', ['abc'])
  assert.match(e.mensagem, /Não consegui converter 'abc'/)
})

test('mensagens de erro do catálogo, com a linha certa', async () => {
  let e = await falha('x <- 1')
  assert.equal(e.mensagem, "Variável 'x' não foi encontrada.")
  assert.equal(e.linha, 5)
  e = await falha('v[4] <- 1', 'v: vetor[1..3] de inteiro')
  assert.match(e.mensagem, /Índice fora dos limites/)
  e = await falha('c <- 5', 'c: caractere')
  assert.equal(e.mensagem, 'Erro na atribuição de valores à variável C.')
  e = await falha('escreval(1 / 0)')
  assert.equal(e.mensagem, 'Valor inválido para a operação /.')
  e = await falha('escreval(raizq(-1))')
  assert.equal(e.mensagem, 'Valor inválido para a função RAIZQ.')
  assert.match(verificar('algoritmo "a"\ninicio\nse 1 = 1 entao\nfimalgoritmo').mensagem, /Esperava encontrar FIMSE/)
  assert.match(verificar('var\ninicio').mensagem, /Um algoritmo começa com a palavra-chave ALGORITMO/)
  assert.equal(verificar(prog('escreval(1)')), null)
})

test('funções de texto', async () => {
  assert.equal(
    await saida('escreval(copia("Brasil", 2, 3), compr("abc"), pos("as", "Brasil"), maiusc("ação"), asc("A"), carac(66), numpcarac(2.50) + "x", caracpnum("12") + 1)'),
    'ras 3 3AçãO 65B2.5x 13\n',
  )
})

test('limpatela e cronômetro', async () => {
  let agora = 1000
  const r = await rodar(prog('limpatela\ncronometro on\ncronometro off'), { relogio: { agora: () => (agora += 1500) } })
  assert.equal(r.saida, '\fCronômetro iniciado.\nCronômetro terminado. Tempo decorrido: 1 segundo(s) e 500 ms.\n')
})

test('sessão: passo a passo, ponto de parada, variáveis e pilha', async () => {
  const fonte = `algoritmo "p"
var
  i: inteiro
procedimento p()
inicio
  i <- i + 10
fimprocedimento
inicio
  i <- 1
  p()
  escreval(i)
fimalgoritmo`
  const passos = []
  let quadro
  let pilha
  let fim
  const s = executar(fonte, {
    breakpoints: [6],
    onStep: ({ linha }) => passos.push(linha),
    onVariables: (q) => { quadro = q },
    onStack: (p) => { pilha = p },
    onEnd: (status) => { fim = status },
  })
  s.passo()
  assert.equal(s.estado, 'pausado')
  assert.deepEqual(passos, [9])
  s.continuar() // para no breakpoint dentro do procedimento
  assert.equal(passos.at(-1), 6)
  assert.equal(pilha[0].nome, 'p')
  assert.equal(quadro.globais.find((v) => v.nome === 'I').valor, '1')
  s.continuar()
  assert.equal(fim, 'terminado')
  assert.equal(s.inspecionar().globais[0].valor, '11')
})

test('sessão: leia espera entrada e parar encerra', async () => {
  const eventos = []
  const s = executar(prog('leia(n)\nescreval(n * 2)', 'n: inteiro'), {
    fatias: false,
    onWaitInput: (d) => eventos.push(`espera ${d.descricao}`),
    onOutput: (t) => eventos.push(t),
    onEnd: (st) => eventos.push(`fim ${st}`),
  })
  s.continuar()
  assert.equal(s.estado, 'aguardando')
  s.fornecerEntrada('21')
  assert.deepEqual(eventos, ['espera n', '21\n 42\n', 'fim terminado'])

  const s2 = executar(prog('leia(n)', 'n: inteiro'), { onEnd: (st) => eventos.push(`fim2 ${st}`) })
  s2.continuar()
  s2.fornecerEntrada(null)
  assert.equal(eventos.at(-1), 'fim2 parado')
})

test('laço infinito pode ser parado entre fatias', async () => {
  await new Promise((resolve) => {
    const s = executar(prog('repita\nfimrepita'), {
      onEnd: (status) => {
        assert.equal(status, 'parado')
        resolve()
      },
    })
    s.continuar()
    setTimeout(() => s.parar(), 30)
  })
})

test('lista: o aleatório sorteia os itens da lista escolhida', async () => {
  const listas = [{ nome: 'Meses', itens: ['Janeiro', 'Fevereiro'] }, { nome: 'Dias da semana', itens: ['Domingo'] }]
  const fonte = prog('aleatorio on\nlista meses\nleia(m)\nlista "DIAS DA SEMANA"\nleia(d)\nescreval(m, "-", d)', 'm, d : caractere')
  const r = await rodar(fonte, { listas, rng: () => 0.7 })
  assert.equal(r.status, 'terminado')
  assert.ok(r.saida.endsWith('Fevereiro-Domingo\n'), r.saida)
  const sem = await rodar(prog('lista frutas'), { listas })
  assert.equal(sem.erro.codigo, 104)
})