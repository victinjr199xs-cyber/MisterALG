import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lerDiagnosticos, traduzirMensagem } from '../src/index.js'
import { iniciarServidor } from './ajudante.mjs'

let php
before(() => { php = iniciarServidor() })
after(() => php.parar())

test('echo e HTML: a página inteira volta, com acentos', async () => {
  const r = await php.pedir({ fonte: '<h1>Olá, <?= strtoupper("mundo") ?>!</h1>\n<?php foreach ([1, 2] as $n) echo "<p>$n</p>"; ?>' })
  assert.equal(r.status, 200)
  assert.equal(r.texto, '<h1>Olá, MUNDO!</h1>\n<p>1</p><p>2</p>')
  assert.match(r.cabecalhos['content-type'], /text\/html/)
  assert.deepEqual(r.diagnosticos, [])
})

test('$_GET, $_POST e $_SERVER como num servidor de verdade', async () => {
  let r = await php.pedir({ fonte: '<?php echo $_GET["x"] ?? "sem", " ", $_SERVER["REQUEST_METHOD"];', url: '/index.php?x=7' })
  assert.equal(r.texto, '7 GET')
  r = await php.pedir({
    fonte: '<?php echo json_encode($_POST), " ", $_SERVER["REQUEST_METHOD"];',
    metodo: 'POST',
    cabecalhos: { 'Content-Type': 'application/x-www-form-urlencoded' },
    corpo: Buffer.from('nome=Ana&idade=20').toString('base64'),
  })
  assert.equal(r.texto, '{"nome":"Ana","idade":"20"} POST')
})

test('header() muda o status e os cabeçalhos', async () => {
  const r = await php.pedir({ fonte: '<?php http_response_code(404); header("X-Oi: sim"); echo "nada";' })
  assert.equal(r.status, 404)
  assert.equal(r.cabecalhos['x-oi'], 'sim')
})

test('include de outro arquivo da pasta do programa', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'misteralg-php-'))
  writeFileSync(join(pasta, 'inc.php'), '<?php function oi($n) { return "Oi, $n"; }')
  const r = await php.pedir({ fonte: '<?php include "inc.php"; echo oi("Ana");', diretorio: pasta })
  assert.equal(r.texto, 'Oi, Ana')
  const outro = await php.pedir({ arquivo: 'inc.php', diretorio: pasta })
  assert.equal(outro.status, 200)
})

test('erro fatal: a página sai até onde foi, e o diagnóstico traz a linha e a tradução', async () => {
  const r = await php.pedir({ fonte: '<h1>Antes</h1>\n<?php\necho 1 / 0;\n' })
  assert.match(r.texto, /^<h1>Antes<\/h1>/)
  const d = r.diagnosticos.find((x) => x.nivel === 'fatal')
  assert.equal(d.linha, 3)
  assert.equal(d.principal, true)
  assert.equal(d.mensagem, 'divisão por zero')
})

test('erro de sintaxe: linha e tradução', async () => {
  const r = await php.pedir({ fonte: '<?php\necho "a"\necho "b";\n' })
  const d = r.diagnosticos.find((x) => x.nivel === 'parse')
  assert.equal(d.linha, 3)
  assert.match(d.mensagem, /símbolo inesperado "echo"/)
})

test('aviso (variável inexistente) não derruba a página', async () => {
  const r = await php.pedir({ fonte: '<?php echo $nao_existe; echo "fim";' })
  assert.match(r.texto, /fim$/)
  const d = r.diagnosticos[0]
  assert.equal(d.nivel, 'aviso')
  assert.equal(d.mensagem, 'a variável $nao_existe não existe')
})

test('lerDiagnosticos e traduzirMensagem', () => {
  const d = lerDiagnosticos('PHP Warning:  Undefined array key "x" in /a.php on line 4\nPHP Fatal error:  Uncaught Error: Call to undefined function f() in /a.php:7\nStack trace:\n#0 {main}\n  thrown in /a.php on line 7\n')
  assert.deepEqual(d.map((x) => [x.nivel, x.linha]), [['aviso', 4], ['fatal', 7]])
  assert.equal(d[1].mensagem, 'a função f() não existe')
  assert.match(traduzirMensagem('algo que ninguém traduziu').explicacao, /Leia a mensagem/)
})
