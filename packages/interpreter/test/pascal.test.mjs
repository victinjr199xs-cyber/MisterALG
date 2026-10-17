import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarPascal } from '../src/pascal.js'
import { decodificar } from '../src/codificacao.js'
import { ErroVisualg } from '../src/erros.js'

const EXEMPLOS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'exemplos')

const gerar = (corpo, decl = '') => gerarPascal(`algoritmo "teste"\n${decl}\ninicio\n${corpo}\nfimalgoritmo\n`).codigo

for (const arquivo of readdirSync(EXEMPLOS).filter((f) => f.endsWith('.alg'))) {
  test(`exemplo ${arquivo} gera Pascal`, () => {
    const fonte = decodificar(readFileSync(join(EXEMPLOS, arquivo)))
    const { codigo } = gerarPascal(fonte)
    assert.match(codigo, /^\{ Programa gerado pelo MisterALG/)
    assert.match(codigo, /\{\$mode objfpc\}\{\$H\+\}/)
    assert.match(codigo, /\nbegin\n[\s\S]*\nend\.\n$/)
  })
}

test('cabeçalho, program e tipos básicos', () => {
  const c = gerar('x <- 1', 'var\n x: inteiro\n y: real\n s: caractere\n b: logico')
  assert.match(c, /program teste;/)
  assert.match(c, /uses SysUtils;/)
  assert.match(c, /x: Integer;/)
  assert.match(c, /y: Double;/)
  assert.match(c, /s: String;/)
  assert.match(c, /b: Boolean;/)
  assert.match(c, /x := 1;/)
})

test('erro de sintaxe lança ErroVisualg', () => {
  assert.throws(() => gerarPascal('algoritmo "x"\ninicio\nse x entao\nfimalgoritmo'), ErroVisualg)
})

test('escreva com formatação e espaço antes de números', () => {
  const c = gerar('escreval("a", x, y:8:2, x:5)\nescreva(y)', 'var x: inteiro\ny: real')
  assert.match(c, /writeln\('a ', x, y:8:2, x:5\);/)
  assert.match(c, /write\(' ', MisterFmtReal\(y\)\);/)
  assert.match(c, /function MisterFmtReal/)
})

test('leia: readln, mensagem e lógico', () => {
  const c = gerar('leia(x, b)', 'var x: inteiro\nb: logico')
  assert.match(c, /readln\(x\);/)
  assert.match(c, /b := MisterLerLogico;/)
})

test('vetores multidimensionais e constantes', () => {
  const c = gerar('m[1, 2] <- 3', 'const N = 5\nvar m: vetor[1..N, 0..3] de real')
  assert.match(c, /const\n {2}N = 5;/)
  assert.match(c, /TVetor1 = array\[1\.\.N, 0\.\.3\] of Double;/)
  assert.match(c, /m: TVetor1;/)
  assert.match(c, /m\[1, 2\] := 3;/)
})

test('registro vira record', () => {
  const c = gerar('p.nome <- "x"', 'tipo pessoa = registro\nnome: caractere\nidade: inteiro\nfimregistro\nvar p: pessoa')
  assert.match(c, /pessoa = record\n {4}nome: String;\n {4}idade: Integer;\n {2}end;/)
  assert.match(c, /p\.nome := 'x';/)
})

test('função, retorne e parâmetro por referência', () => {
  const fonte = `algoritmo "f"
funcao dobro(n: inteiro): inteiro
inicio
retorne n * 2
fimfuncao
procedimento zera(var a: inteiro)
var t: real
inicio
a <- 0
fimprocedimento
var x: inteiro
inicio
x <- dobro(3)
zera(x)
fimalgoritmo`
  const c = gerarPascal(fonte).codigo
  assert.match(c, /function dobro\(n: Integer\): Integer;/)
  assert.match(c, /Result := n \* 2;\n {2}Exit;/)
  assert.match(c, /procedure zera\(var a: Integer\);\nvar\n {2}t: Double;/)
  assert.match(c, /t := 0;/)
  assert.match(c, /x := dobro\(3\);/)
})

test('se/senao e operadores lógicos', () => {
  const c = gerar('se (x > 1) e nao b ou (x mod 2 = 0) entao\nx <- x \\ 2\nsenao\nx <- 2 ^ 3\nfimse', 'var x: inteiro\nb: logico')
  assert.match(c, /if \(\(x > 1\) and not b\) or \(\(x mod 2\) = 0\) then/)
  assert.match(c, /x := x div 2;/)
  assert.match(c, /end\n {2}else\n/)
  assert.match(c, /x := Round\(Power\(2, 3\)\);/)
  assert.match(c, /uses SysUtils, Math;/)
})

test('escolha inteiro vira case com faixas', () => {
  const c = gerar('escolha x\ncaso 1, 2\nescreval("a")\ncaso 3 ate 5\nescreval("b")\noutrocaso\nescreval("c")\nfimescolha', 'var x: inteiro')
  assert.match(c, /case x of\n {4}1, 2:/)
  assert.match(c, /3\.\.5:/)
  assert.match(c, /else\n {4}writeln\('c'\);\n {2}end;/)
})

test('escolha de texto vira if encadeado com CompareText', () => {
  const c = gerar('escolha s\ncaso "a"\nescreval(1)\ncaso "b", "c"\nescreval(2)\nfimescolha', 'var s: caractere')
  assert.match(c, /if CompareText\(s, 'a'\) = 0 then/)
  assert.match(c, /else if \(CompareText\(s, 'b'\) = 0\) or \(CompareText\(s, 'c'\) = 0\) then/)
})

test('para com passo: to, downto e while', () => {
  const c = gerar('para i de 1 ate 10 faca\nfimpara\npara i de 10 ate 1 passo -1 faca\ninterrompa\nfimpara\npara i de 0 ate 10 passo 2 faca\nfimpara', 'var i: inteiro')
  assert.match(c, /for i := 1 to 10 do/)
  assert.match(c, /for i := 10 downto 1 do\n {2}begin\n {4}Break;/)
  assert.match(c, /i := 0;\n {2}while i <= 10 do\n {2}begin\n {4}i := i \+ 2;/)
})

test('enquanto e repita', () => {
  const c = gerar('enquanto x < 3 faca\nx <- x + 1\nfimenquanto\nrepita\nx <- x - 1\nate x = 0', 'var x: inteiro')
  assert.match(c, /while x < 3 do\n {2}begin\n {4}x := x \+ 1;\n {2}end;/)
  assert.match(c, /repeat\n {4}x := x - 1;\n {2}until x = 0;/)
})

test('funções pré-definidas mapeadas', () => {
  const c = gerar(
    's <- maiusc(copia(s, 1, 2)) + carac(65) + numpcarac(x)\nx <- compr(s) + pos("a", s) + asc(s) + int(r) + randi(10)\nr <- raizq(quad(r)) + abs(r) + rand + caracpnum("1.5") + exp(2, 3) + logn(r) + pi',
    'var s: caractere\nx: inteiro\nr: real',
  )
  for (const trecho of ['UpperCase(Copy(s, 1, 2))', 'Chr(65)', 'IntToStr(x)', 'Length(s)', "Pos('a', s)", 'Ord((s + #0)[1])', 'Trunc(r)', 'Random(10)', 'Sqrt(Sqr(r))', 'Abs(r)', 'Random', "MisterCaracPNum('1.5')", 'Power(2, 3)', 'Ln(r)', 'Pi', 'Randomize;']) {
    assert.ok(c.includes(trecho), `faltou ${trecho}`)
  }
})

test('real atribuído a inteiro usa Trunc; divisão real', () => {
  const c = gerar('x <- r / 2\nr <- x / 2', 'var x: inteiro\nr: real')
  assert.match(c, /x := Trunc\(r \/ 2\);/)
  assert.match(c, /r := x \/ 2;/)
})

test('nomes reservados do Pascal e acentos são renomeados', () => {
  const c = gerar('begin <- 1\nação <- begin\nlength <- 2', 'var begin, ação, length: inteiro')
  assert.match(c, /begin_, acao, length_: Integer;/)
  assert.match(c, /acao := begin_;/)
})

test('comentários são preservados', () => {
  const c = gerar('// explica\nx <- 1 // no fim', 'var x: inteiro')
  assert.match(c, /\/\/ explica\n {2}x := 1; \/\/ no fim/)
})

test('comandos sem equivalente viram comentário', () => {
  const c = gerar('limpatela\npausa\ntimer 100\naleatorio on\neco off\ncronometro on', '')
  for (const nome of ['limpatela', 'pausa', 'timer', 'aleatorio', 'eco', 'cronometro']) {
    assert.ok(c.includes(`{ MisterALG: comando ${nome} não tem equivalente em Pascal }`), nome)
  }
  assert.doesNotMatch(c, /crt/i)
})

test('para em procedimento com variável global usa while', () => {
  const c = gerarPascal('algoritmo "a"\nvar i: inteiro\nprocedimento p\ninicio\npara i de 1 ate 3 faca\nfimpara\nfimprocedimento\ninicio\np\nfimalgoritmo').codigo
  assert.match(c, /i := 1;\n {2}while i <= 3 do/)
  assert.match(c, /\n {2}p;\n/)
})

test('chamada antes da definição gera forward', () => {
  const c = gerarPascal('algoritmo "a"\nprocedimento p\ninicio\nq\nfimprocedimento\nprocedimento q\ninicio\nfimprocedimento\ninicio\np\nfimalgoritmo').codigo
  assert.match(c, /procedure q; forward;/)
})

// ---- regressões apontadas pelos revisores ------------------------------------

test('para com limite real não trunca o limite (usa while)', () => {
  const c = gerarPascal('algoritmo "b"\nvar i: inteiro\nx: real\ninicio\nx <- 5\npara i de 10 ate x/2 passo -1 faca\nescreval(i)\nfimpara\nfimalgoritmo').codigo
  assert.doesNotMatch(c, /for i/)
  assert.doesNotMatch(c, /Trunc\(x \/ 2\)/)
  assert.match(c, /MisterFim1: Double;/)
  assert.match(c, /MisterFim1 := x \/ 2;\n {2}i := 10;\n {2}while i >= MisterFim1 do/)
})

test('para com while avalia limite e passo uma vez só', () => {
  const c = gerarPascal('algoritmo "a"\nvar i, n: inteiro\ninicio\nn <- 3\npara i de 10 ate n passo -2 faca\n  n <- 0\nfimpara\nfimalgoritmo').codigo
  assert.match(c, /MisterFim1: Integer;/)
  assert.match(c, /MisterFim1 := n;\n {2}i := 10;\n {2}while i >= MisterFim1 do/)
  const d = gerarPascal('algoritmo "a"\nvar i, s: inteiro\ninicio\ns <- 1\npara i de 1 ate 9 passo s faca\n  s <- 5\nfimpara\nfimalgoritmo').codigo
  assert.match(d, /MisterPasso1 := s;/)
  assert.match(d, /i := i \+ MisterPasso1;/)
  assert.doesNotMatch(d, /\(s > 0\)/)
})

test('para cuja variável é lida depois do laço usa while', () => {
  const c = gerarPascal('algoritmo "a2"\nvar i, n: inteiro\ninicio\nn <- 3\npara i de 1 ate n faca\nfimpara\nescreval(i)\nfimalgoritmo').codigo
  assert.doesNotMatch(c, /for i/)
  assert.match(c, /while i <= MisterFim1 do/)
  // Sem uso depois, continua for.
  assert.match(gerar('para i de 1 ate 3 faca\nescreval(i)\nfimpara', 'var i: inteiro'), /for i := 1 to 3 do/)
})

test('para com contador passado como var em expressão usa while', () => {
  const c = gerarPascal('algoritmo "c"\nvar i: inteiro\nfuncao f(var k: inteiro): inteiro\ninicio\nk <- 100\nretorne 1\nfimfuncao\ninicio\npara i de 1 ate 10 faca\n  escreval(f(i))\nfimpara\nfimalgoritmo').codigo
  assert.doesNotMatch(c, /for i/)
  const d = gerarPascal('algoritmo "a"\nvar i, r: inteiro\nfuncao f(var z: inteiro): inteiro\ninicio\nz <- 5\nretorne z\nfimfuncao\ninicio\npara i de 1 ate 3 faca\nr <- f(i)\nfimpara\nfimalgoritmo').codigo
  assert.doesNotMatch(d, /for i/)
  assert.match(d, /while i <= 3 do/)
})

test('para cujo corpo chama subprograma que mexe na global usa while', () => {
  const c = gerarPascal('algoritmo "a"\nvar i: inteiro\nprocedimento p\ninicio\ni <- 100\nfimprocedimento\ninicio\npara i de 1 ate 10 faca\np\nfimpara\nfimalgoritmo').codigo
  assert.match(c, /\n {2}while i <= 10 do/)
})

test('parâmetro var não vira contador de for', () => {
  const c = gerarPascal('algoritmo "a"\nvar k: inteiro\nprocedimento p(var i: inteiro)\ninicio\npara i de 1 ate 3 faca\nescreval(i)\nfimpara\nfimprocedimento\ninicio\np(k)\nfimalgoritmo').codigo
  assert.doesNotMatch(c, /for i/)
  assert.match(c, /while i <= 3 do/)
})

test('escolha com rótulos repetidos ou sobrepostos vira if encadeado', () => {
  const c = gerar('escolha x\ncaso 1, 2\nescreval("a")\ncaso 2 ate 4\nescreval("b")\nfimescolha', 'var x: inteiro')
  assert.doesNotMatch(c, /case x of/)
  assert.match(c, /if \(x = 1\) or \(x = 2\) then/)
  assert.match(c, /else if \(x >= 2\) and \(x <= 4\) then/)
  assert.match(gerar('escolha x\ncaso 1, 2\nescreval("a")\ncaso 3 ate 4\nescreval("b")\nfimescolha', 'var x: inteiro'), /case x of/)
})

test('variáveis trim e strtofloat não escondem as funções auxiliares', () => {
  const c = gerarPascal('algoritmo "a"\nvar trim, strtofloat, tan: inteiro\nx: logico\ninicio\nleia(x)\nfimalgoritmo').codigo
  assert.match(c, /trim_, strtofloat_, tan_: Integer;/)
})
