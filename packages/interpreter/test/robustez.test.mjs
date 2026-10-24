// Programas complicados: funções matemáticas/texto, formatação, erros de execução,
// escolha/para/repita, passagem por referência, registros e recursão.
import test from 'node:test'
import assert from 'node:assert/strict'
import { rodar } from '../src/index.js'

const P = (corpo, v = '') => `algoritmo "t"\n${v}\ninicio\n${corpo}\nfimalgoritmo`
const exec = (src, entradas = []) => rodar(src, { entradas, rng: () => 0.5, limitePassos: 200000 })

const SAIDAS = [
  ['matemática', P('escreval(abs(-3.5), " ", int(-3.9), " ", raizq(16), " ", quad(5), " ", exp(2,3), " ", log(100), " ", grauprad(180), " ", radpgrau(pi))'),
    ' 3.5  -3  4  25  8  2  3.1415926536  180\n'],
  ['operadores', P('escreval(-7 mod 3, " ", 7.5 mod 2, " ", -7 \\ 2, " ", 2 ^ 3 ^ 2, " ", 10 - 2 - 3)'), ' -1  1  -3  64  5\n'],
  ['texto', P('escreval(copia("abcdef",2,3),"|",pos("c","abc"),"|",pos("z","abc"),"|",maiusc("aB"),"|",numpcarac(12.5),"|",caracpnum("42")+1,"|",asc("A"),"|",carac(66))'),
    'bcd| 3| 0|AB|12.5| 43| 65|B\n'],
  ['formatação', P('escreval(3.14159:8:2,"|",1.5:0:3,"|",-2:6:2,"|",0.5:5:0,"|",verdadeiro:8,"|",123456789.123456)'),
    '    3.14|1.500| -2.00|    1|VERDADEIRO| 123456789.123456\n'],
  ['real sem ruído de double', P('escreval(0.1+0.2, " ", 100/3)'), ' 0.3  33.3333333333\n'],
  ['escolha com faixa', P('para i de 1 ate 4 faca\nescolha i\ncaso 1,2\nescreval("a")\ncaso 3..3\nescreval("b")\noutrocaso\nescreval("c")\nfimescolha\nfimpara', 'var i: inteiro'),
    'a\na\nb\nc\n'],
  ['para passo negativo e laço vazio', P('para i de 10 ate 1 passo -3 faca\nescreva(i," ")\nfimpara\npara i de 1 ate 0 faca\nescreva("x")\nfimpara', 'var i: inteiro'),
    ' 10  7  4  1 '],
  ['interrompa em repita', P('repita\ni <- i+1\nse i = 3 entao\ninterrompa\nfimse\nate falso\nescreval(i)', 'var i: inteiro'), ' 3\n'],
  ['vetor com limite negativo', P('v[-1] <- 2\nescreval(v[-1], v[-2])', 'var v: vetor[-2..0] de inteiro'), ' 2 0\n'],
  ['matriz 3D', P('m[1,1,2] <- 5\nescreval(m[1,1,2])', 'var m: vetor[1..2,1..2,1..2] de inteiro'), ' 5\n'],
  ['valores iniciais', P('escreval(i, "|", s, "|", l, "|", r)', 'var i: inteiro\ns: caractere\nl: logico\nr: real'), ' 0|| FALSO| 0\n'],
  ['variável local sombreia a global', `algoritmo "t"\nvar x: inteiro\nprocedimento p()\nvar x: inteiro\ninicio\nx <- 5\nfimprocedimento\ninicio\nx <- 1\np()\nescreval(x)\nfimalgoritmo`, ' 1\n'],
  ['var troca; parâmetro por valor não vaza', `algoritmo "t"
var a,b: inteiro
procedimento troca(var x,y: inteiro)
var t: inteiro
inicio
t<-x
x<-y
y<-t
fimprocedimento
funcao inc(x: inteiro): inteiro
inicio
x <- x+1
retorne x
fimfuncao
inicio
a<-1
b<-2
troca(a,b)
escreval(a,b,inc(a),a)
fimalgoritmo`, ' 2 1 3 2\n'],
  ['vetor por var', `algoritmo "t"\nvar v: vetor[1..3] de inteiro\nprocedimento z(var w: vetor[1..3] de inteiro)\ninicio\nw[1] <- 9\nfimprocedimento\ninicio\nz(v)\nescreval(v[1])\nfimalgoritmo`, ' 9\n'],
  ['registro copiado por valor', `algoritmo "t"\ntipo r = registro\na: inteiro\nfimregistro\nvar x, y: r\ninicio\nx.a <- 3\ny <- x\ny.a <- 4\nescreval(x.a, y.a)\nfimalgoritmo`, ' 3 4\n'],
  ['recursão (fibonacci)', `algoritmo "t"\nfuncao fib(n: inteiro): inteiro\ninicio\nse n<2 entao\nretorne n\nfimse\nretorne fib(n-1)+fib(n-2)\nfimfuncao\ninicio\nescreval(fib(15))\nfimalgoritmo`, ' 610\n'],
  ['comparação de texto ignora caixa', P('escreval("A"="a", " ", "abc" > "abd")'), ' VERDADEIRO  FALSO\n'],
]
for (const [nome, src, saida] of SAIDAS) {
  test(nome, async () => {
    const r = await exec(src)
    assert.equal(r.status, 'terminado', r.erro?.mensagem)
    assert.equal(r.saida, saida)
  })
}

const ERROS = [
  ['divisão por zero', P('escreval(5/0)'), /Valor inválido para a operação \//],
  ['div por zero', P('escreval(5 \\ 0)'), /DIV/],
  ['mod por zero', P('escreval(5 mod 0)'), /MOD/],
  ['raizq negativa', P('escreval(raizq(-1))'), /RAIZQ/],
  ['log de zero', P('escreval(log(0))'), /LOG/],
  ['índice abaixo do limite', P('v[0] <- 1', 'var v: vetor[1..3] de inteiro'), /Índice fora dos limites do vetor v/],
  ['índice de matriz acima do limite', P('m[1,4] <- 1', 'var m: vetor[1..3,1..3] de inteiro'), /limites do vetor m/],
  ['tipo errado na atribuição', P('i <- "a"', 'var i: inteiro'), /atribuição/],
  ['variável inexistente', P('x <- 1'), /'x' não foi encontrada/],
  ['passo zero', P('para i de 1 ate 3 passo 0 faca\nfimpara', 'var i: inteiro'), /passo/],
  ['recursão infinita não é erro interno', `algoritmo "t"\nfuncao f(n: inteiro): inteiro\ninicio\nretorne f(n+1)\nfimfuncao\ninicio\nescreval(f(1))\nfimalgoritmo`, /Estouro de pilha/],
]
for (const [nome, src, msg] of ERROS) {
  test(`erro: ${nome}`, async () => {
    const r = await exec(src)
    assert.equal(r.status, 'erro')
    assert.match(r.erro.mensagem, msg)
  })
}

test('leia de valor inválido dá erro de conversão', async () => {
  const r = await exec(P('leia(i)', 'var i: inteiro'), ['abc'])
  assert.equal(r.status, 'erro')
  assert.match(r.erro.mensagem, /converter 'abc'/)
})
