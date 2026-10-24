import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WASI } from 'node:wasi'
import { gerarC, gerarJava } from '../src/exportar.js'
import { decodificar } from '../src/codificacao.js'
import { ErroVisualg } from '../src/erros.js'

const EXEMPLOS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'exemplos')

const PROG_LEIA = `algoritmo "t1"
var n: inteiro
r: real
nome: caractere
ok: logico
inicio
leia(n, r, nome)
ok <- n > 2
escreval("Oi, ", nome + "!", " n=", n, " r=", r, " ok=", ok)
escreval(r:8:2, n:4)
fimalgoritmo`

const PROG_VETOR = `algoritmo "t2"
var v: vetor[1..5] de inteiro
i, s: inteiro
funcao quad2(x: inteiro): inteiro
inicio
retorne x * x
fimfuncao
procedimento soma(var t: inteiro, a: inteiro)
inicio
t <- t + a
fimprocedimento
inicio
para i de 1 ate 5 faca
v[i] <- quad2(i)
fimpara
para i de 5 ate 1 passo -2 faca
soma(s, v[i])
fimpara
escolha s
caso 1, 2
escreval("pequeno")
caso 30 ate 40
escreval("medio ", s)
outrocaso
escreval("grande ", s)
fimescolha
escreval(7 \\ 2, 7 % 2, 7 / 2, 2 ^ 10)
fimalgoritmo`

const PROG_TEXTOS = `algoritmo "t3"
tipo pessoa = registro
nome: caractere
idade: inteiro
fimregistro
const MAX = 3
var m: vetor[1..2, 0..2] de real
nomes: vetor[1..MAX] de caractere
p: pessoa
s, t: caractere
i, k: inteiro
ok: logico
funcao ola(n: caractere): caractere
inicio
retorne "Ola, " + maiusc(n)
fimfuncao
procedimento aniv(var q: pessoa, var z: real)
inicio
q.idade <- q.idade + 1
z <- z * 2
fimprocedimento
inicio
s <- "abc"
t <- ola(s)
escreval(t, compr(t), copia(t, 1, 3), pos("A", t))
se s = "ABC" entao
escreval("igual")
fimse
p.nome <- "Ze"
p.idade <- 9
nomes[2] <- p.nome
m[2, 1] <- 1.5
aniv(p, m[2, 1])
escreval(p.idade, m[2, 1], nomes[2])
k <- 0
repita
k <- k + 1
ate k >= 3
enquanto k > 0 faca
k <- k - 1
fimenquanto
ok <- (k = 0) e nao (i > 1)
escreval(ok, raizq(16), int(3.9), 10 / 4)
fimalgoritmo`
// Compila com o clang WebAssembly do repositório (se estiver instalado) e roda com WASI.
let clang
try {
  clang = (await import('@yowasp/clang')).runClang
} catch {
  clang = null
}

async function compilarERodar(codigo, entrada = '') {
  const dec = new TextDecoder()
  let msg = ''
  const r = await clang(['clang', '-std=c99', '-Wall', '-Werror', '-o', 'p.wasm', 'a.c'], { 'a.c': codigo }, {
    stdout: null,
    fetchProgress: () => {},
    stderr: (b) => { if (b) msg += dec.decode(b, { stream: true }) },
  }).catch((e) => assert.fail(`clang: ${msg || e.message}`))
  const dir = mkdtempSync(join(tmpdir(), 'misteralg-c-'))
  try {
    writeFileSync(join(dir, 'in.txt'), entrada)
    const entradaFd = openSync(join(dir, 'in.txt'), 'r')
    const saidaFd = openSync(join(dir, 'out.txt'), 'w')
    const wasi = new WASI({ version: 'preview1', args: ['p'], stdin: entradaFd, stdout: saidaFd, returnOnExit: true })
    const modulo = await WebAssembly.compile(r['p.wasm'])
    const codigoSaida = wasi.start(await WebAssembly.instantiate(modulo, wasi.getImportObject()))
    closeSync(entradaFd)
    closeSync(saidaFd)
    assert.equal(codigoSaida, 0)
    return readFileSync(join(dir, 'out.txt'), 'utf8')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

for (const arquivo of readdirSync(EXEMPLOS).filter((f) => f.endsWith('.alg'))) {
  test(`exemplo ${arquivo} gera C e Java`, () => {
    const fonte = decodificar(readFileSync(join(EXEMPLOS, arquivo)))
    assert.match(gerarC(fonte).codigo, /int main\(void\) \{[\s\S]*return 0;\n\}\n$/)
    const j = gerarJava(fonte)
    assert.match(j.codigo, new RegExp(`public class ${j.classe} \\{[\\s\\S]*public static void main\\(String\\[\\] args\\)`))
  })
}

test('erro de sintaxe lança ErroVisualg', () => {
  assert.throws(() => gerarC('algoritmo "x"\ninicio\nse x entao\nfimalgoritmo'), ErroVisualg)
  assert.throws(() => gerarJava('algoritmo "x"\ninicio\nse x entao\nfimalgoritmo'), ErroVisualg)
})

test('C: leia, escreval, texto, real e lógico', () => {
  const c = gerarC(PROG_LEIA).codigo
  assert.match(c, /char nome\[256\] = \{0\};/)
  assert.match(c, /mister_ler\(\);\n {2}n = atoi\(mister_linha\);/)
  assert.match(c, /strcpy\(nome, mister_linha\);/)
  assert.match(c, /printf\("Oi, %s n=\(?|printf\("Oi, %s n= ?/)
  assert.match(c, /printf\("%\*\.\*f%\*d\\n", 8, 2, r, 4, n\);/)
})

test('C: vetor com para, função, referência e escolha', () => {
  const c = gerarC(PROG_VETOR).codigo
  assert.match(c, /int v\[5\] = \{0\};/)
  assert.match(c, /int quad2\(int x\) \{\n {2}return x \* x;\n\}/)
  assert.match(c, /void soma\(int \*t, int a\)/)
  assert.match(c, /\(\*t\) = \(\*t\) \+ a;/)
  assert.match(c, /for \(i = 1; i <= 5; i\+\+\) \{\n {4}v\[i - 1\] = quad2\(i\);/)
  assert.match(c, /for \(i = 5; i >= 1; i -= 2\)/)
  assert.match(c, /soma\(&s, v\[i - 1\]\);/)
  assert.match(c, /\} else if \(s >= 30 && s <= 40\) \{/)
})

test('Java: leia, escreval, texto, real e lógico', () => {
  const { codigo, classe } = gerarJava(PROG_LEIA)
  assert.equal(classe, 'T1')
  assert.match(codigo, /public class T1 \{/)
  assert.match(codigo, /static final Scanner teclado = new Scanner\(System\.in\);/)
  assert.match(codigo, /n = misterLerInt\(\);/)
  assert.match(codigo, /nome = misterLerTexto\(\);/)
  assert.match(codigo, /System\.out\.println\("Oi, " \+ nome \+ "!" \+ " n= " \+ n \+ " r= " \+ misterReal\(r\)/)
  assert.match(codigo, /String\.format\(Locale\.ROOT, "%8\.2f", r\)/)
})

test('Java: vetor, função, referência (caixa) e escolha', () => {
  const { codigo } = gerarJava(PROG_VETOR)
  assert.match(codigo, /static int\[\] v = new int\[5\];/)
  assert.match(codigo, /static int\[\] s = \{0\};/)
  assert.match(codigo, /static int quad2\(int x\) \{\n {4}return x \* x;/)
  assert.match(codigo, /static void soma\(int\[\] t, int a\)/)
  assert.match(codigo, /t\[0\] = t\[0\] \+ a;/)
  assert.match(codigo, /soma\(s, v\[i - 1\]\);/)
  assert.match(codigo, /\} else if \(s\[0\] >= 30 && s\[0\] <= 40\) \{/)
})

test('Java: elemento de vetor por referência grava de volta', () => {
  const { codigo } = gerarJava('algoritmo "tr"\nvar v: vetor[1..2] de inteiro\nprocedimento troca(var a, b: inteiro)\nvar t: inteiro\ninicio\nt <- a\na <- b\nb <- t\nfimprocedimento\ninicio\ntroca(v[1], v[2])\nfimalgoritmo')
  assert.match(codigo, /int\[\] misterRef1 = \{v\[1 - 1\]\};/)
  assert.match(codigo, /v\[1 - 1\] = misterRef1\[0\];/)
})

test('nomes reservados e acentos são renomeados', () => {
  const c = gerarC('algoritmo "a"\nvar int, ação: inteiro\ninicio\nint <- 1\nação <- int\nfimalgoritmo').codigo
  assert.match(c, /int int_ = 0;/)
  assert.match(c, /int acao = 0;/)
  assert.match(gerarJava('algoritmo "class"\ninicio\nfimalgoritmo').codigo, /public class Class_? \{|public class Class \{/)
})

test('C: compila (-Wall -Werror) e roda leia/escreval', { skip: !clang }, async () => {
  assert.equal(await compilarERodar(gerarC(PROG_LEIA).codigo, '5\n2.5\nAna\n'), 'Oi, Ana! n= 5 r= 2.5 ok= VERDADEIRO\n    2.50   5\n')
})

test('C: compila e roda vetor, função, referência, escolha e operadores', { skip: !clang }, async () => {
  assert.equal(await compilarERodar(gerarC(PROG_VETOR).codigo), 'medio  35\n 3 1 3.5 1024\n')
})

test('C: compila e roda os exemplos de ordenação e fatorial', { skip: !clang }, async () => {
  const ler = (f) => decodificar(readFileSync(join(EXEMPLOS, f)))
  assert.match(await compilarERodar(gerarC(ler('ordena_vetor.alg')).codigo), /Ordenado: 3 7 11 19 25 42/)
  assert.match(await compilarERodar(gerarC(ler('fatorial_recursivo.alg')).codigo, '5\n'), /120/)
})

test('C: compila e roda textos, registro por referência, matriz e laços', { skip: !clang }, async () => {
  assert.equal(await compilarERodar(gerarC(PROG_TEXTOS).codigo), 'Ola, ABC 8Ola 6\nigual\n 10 3Ze\n VERDADEIRO 4 3 2.5\n')
})

test('C: compila e roda caractere por valor atribuído dentro da função', { skip: !clang }, async () => {
  const fonte = `algoritmo "t4"
var s: caractere
procedimento troca(n: caractere)
inicio
n <- n + "!"
escreval(n)
fimprocedimento
inicio
s <- "oi"
troca(s)
escreval(s)
fimalgoritmo`
  assert.equal(await compilarERodar(gerarC(fonte).codigo), 'oi!\noi\n')
})

test('Java: textos, registro, matriz e vetor de texto', () => {
  const { codigo } = gerarJava(PROG_TEXTOS)
  assert.match(codigo, /static double\[\]\[\] m = new double\[2\]\[3\];/)
  assert.match(codigo, /static String\[\] nomes = misterPreencher\(new String\[MAX - \(1\) \+ 1\], \(\) -> ""\);/)
  assert.match(codigo, /static void aniv\(pessoa q, double\[\] z\)/)
  assert.match(codigo, /z\[0\] = z\[0\] \* 2;/)
  assert.match(codigo, /s\.compareToIgnoreCase\("ABC"\) == 0/)
  assert.match(codigo, /\} while \(!\(k >= 3\)\);/)
})

// Compila e roda o Java gerado se MISTERALG_JDK apontar para uma pasta de JDK.
const JDK = process.env.MISTERALG_JDK
const exe = (n) => (JDK ? join(JDK, 'bin', process.platform === 'win32' ? `${n}.exe` : n) : '')
const temJdk = Boolean(JDK) && existsSync(exe('javac')) && existsSync(exe('java'))

function compilarERodarJava(fonte, entrada = '') {
  const { codigo, classe } = gerarJava(fonte)
  const dir = mkdtempSync(join(tmpdir(), 'misteralg-j-'))
  try {
    writeFileSync(join(dir, `${classe}.java`), codigo)
    const c = spawnSync(exe('javac'), ['-encoding', 'UTF-8', '-Xlint:all', `${classe}.java`], { cwd: dir, encoding: 'utf8' })
    assert.equal(c.status, 0, `javac: ${c.stdout}${c.stderr}\n${codigo}`)
    const r = spawnSync(exe('java'), ['-cp', dir, classe], { cwd: dir, input: entrada, encoding: 'utf8' })
    assert.equal(r.status, 0, `java: ${r.stderr}`)
    return r.stdout.replace(/\r\n/g, '\n')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const J = { skip: !temJdk && 'defina MISTERALG_JDK' }

test('Java: compila e roda leia/escreval', J, () => {
  assert.equal(compilarERodarJava(PROG_LEIA, '5\n2.5\nAna\n'), 'Oi, Ana! n= 5 r= 2.5 ok= VERDADEIRO\n    2.50   5\n')
})

test('Java: compila e roda vetor, função, referência, escolha e operadores', J, () => {
  assert.equal(compilarERodarJava(PROG_VETOR), 'medio  35\n 3 1 3.5 1024\n')
})

test('Java: compila e roda textos, registro por referência, matriz e laços', J, () => {
  assert.equal(compilarERodarJava(PROG_TEXTOS), 'Ola, ABC 8Ola 6\nigual\n 10 3Ze\n VERDADEIRO 4 3 2.5\n')
})

test('Java: compila e roda os exemplos de ordenação e fatorial', J, () => {
  const ler = (f) => decodificar(readFileSync(join(EXEMPLOS, f)))
  assert.match(compilarERodarJava(ler('ordena_vetor.alg')), /Ordenado: 3 7 11 19 25 42/)
  assert.match(compilarERodarJava(ler('fatorial_recursivo.alg'), '5\n'), /120/)
})

test('Java: função em expressão grava de volta elemento e campo por referência', J, () => {
  const fonte = `algoritmo "ja"
tipo pt = registro
x: inteiro
fimregistro
var v: vetor[1..3] de inteiro
p: pt
r: inteiro
funcao inc(var a: inteiro): inteiro
inicio
a <- a + 10
retorne a
fimfuncao
funcao dobra(var a: inteiro): inteiro
inicio
a <- a + 1
retorne a * 2
fimfuncao
inicio
v[2] <- 1
p.x <- 5
r <- inc(v[2]) + inc(p.x)
escreval(r, v[2], p.x)
escreval(dobra(v[2]))
escreval(v[2])
fimalgoritmo`
  assert.equal(compilarERodarJava(fonte), ' 26 11 15\n 24\n 12\n')
})

test('Java: vetor de registros e de textos vêm preenchidos', J, () => {
  const fonte = `algoritmo "jb"
tipo pessoa = registro
nome: caractere
idade: inteiro
fimregistro
var a: vetor[1..3] de pessoa
t: vetor[1..2] de caractere
m: vetor[1..2, 1..2] de pessoa
inicio
a[3].idade <- a[3].idade + 7
m[2, 2].nome <- "x" + m[1, 1].nome
escreval(a[1].idade, a[3].idade, "[", a[2].nome, "]", "[", t[1], "]", m[2, 2].nome)
fimalgoritmo`
  assert.equal(compilarERodarJava(fonte), ' 0 7[][]x\n')
})

test('Java: atribuir vetor e registro copia (semântica de valor)', J, () => {
  const fonte = `algoritmo "jc"
tipo pt = registro
x: inteiro
fimregistro
tipo caixa = registro
p: pt
fimregistro
var a, b: vetor[1..3] de inteiro
p, q: pt
c, d: caixa
w: vetor[1..2] de pt
z: vetor[1..2] de pt
procedimento muda(v: vetor[1..3] de inteiro)
inicio
v[1] <- 99
fimprocedimento
inicio
a[1] <- 1
b <- a
b[1] <- 2
p.x <- 1
q <- p
q.x <- 2
c.p.x <- 1
d <- c
d.p.x <- 2
w[1].x <- 1
z <- w
z[1].x <- 2
muda(a)
escreval(a[1], b[1], p.x, q.x, c.p.x, d.p.x, w[1].x, z[1].x)
fimalgoritmo`
  assert.equal(compilarERodarJava(fonte), ' 1 2 1 2 1 2 1 2\n')
})