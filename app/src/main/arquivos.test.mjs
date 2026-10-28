import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { anexarDados, dentroDaPasta, gravarArquivo, gravarAtomicoSync, lerArquivo, lerDados } from './arquivos.js'

const pasta = mkdtempSync(join(tmpdir(), 'misteralg-arq-'))
test.after(() => rmSync(pasta, { recursive: true, force: true }))

test('grava arquivo novo em CP1252 e lê de volta', async () => {
  const caminho = join(pasta, 'novo.alg')
  const texto = 'algoritmo "ação"\nfimalgoritmo\n'
  assert.equal(await gravarArquivo(caminho, texto, 'windows-1252'), 'windows-1252')
  assert.equal(readFileSync(caminho)[12], 0xe7) // ç em CP1252
  const lido = await lerArquivo(caminho)
  assert.equal(lido.texto, texto)
  assert.equal(lido.codificacao, 'windows-1252')
})

test('caractere fora do 1252 cai para UTF-8', async () => {
  const caminho = join(pasta, 'utf8.alg')
  const texto = 'escreva("日本")\n'
  assert.equal(await gravarArquivo(caminho, texto, 'windows-1252'), 'utf-8')
  assert.equal((await lerArquivo(caminho)).texto, texto)
})

test('programa em UTF-8: CRLF só no Windows; .alg sempre CRLF', async () => {
  const eol = process.platform === 'win32' ? '\r\n' : '\n'
  const js = join(pasta, 'p.js')
  await gravarArquivo(js, 'a\nb\n', 'utf-8')
  assert.equal(readFileSync(js, 'utf8'), `a${eol}b${eol}`)
  const alg = join(pasta, 'p.alg')
  await gravarArquivo(alg, 'a\nb\n', 'windows-1252')
  assert.equal(readFileSync(alg, 'latin1'), 'a\r\nb\r\n')
})

test('sobrescrever mantém o conteúdo novo e não deixa .misteralg-tmp', async () => {
  const caminho = join(pasta, 'sobre.alg')
  await gravarArquivo(caminho, 'antigo\n')
  await gravarArquivo(caminho, 'novo\n')
  assert.equal((await lerArquivo(caminho)).texto, 'novo\n')
  assert.deepEqual(readdirSync(pasta).filter((n) => n.endsWith('.misteralg-tmp')), [])
})

test('pasta inexistente rejeita e não deixa nada', async () => {
  const sumida = join(pasta, 'nao-existe')
  await assert.rejects(gravarArquivo(join(sumida, 'a.alg'), 'x\n'))
  assert.deepEqual(readdirSync(pasta).filter((n) => n.endsWith('.misteralg-tmp') || n === 'nao-existe'), [])
})

test('arquivo oculto continua oculto depois de salvar', { skip: process.platform !== 'win32' }, async () => {
  const caminho = join(pasta, 'oculto.alg')
  writeFileSync(caminho, 'a\n')
  execFileSync('attrib', ['+h', caminho])
  await gravarArquivo(caminho, 'b\n')
  assert.ok(execFileSync('attrib', [caminho], { encoding: 'utf8' }).slice(0, 20).includes('H'))
  assert.equal((await lerArquivo(caminho)).texto, 'b\n')
})

test('comando arquivo: só pasta do algoritmo ou Documentos; .. e absoluto de fora são barrados', () => {
  const algoritmo = join(pasta, 'alg')
  const docs = join(pasta, 'docs')
  const fora = join(pasta, 'fora')
  for (const d of [algoritmo, docs, fora]) mkdirSync(d)
  writeFileSync(join(algoritmo, 'dados.txt'), 'a\nb\n')
  writeFileSync(join(docs, 'dd.txt'), 'doc\n')
  writeFileSync(join(fora, 'segredo.txt'), 'x\n')
  assert.equal(lerDados('dados.txt', algoritmo, docs), 'a\nb\n')
  assert.equal(lerDados('sub/nao-existe.txt', algoritmo, docs), null)
  assert.equal(lerDados(join(docs, 'dd.txt'), algoritmo, docs), 'doc\n') // absoluto dentro de Documentos
  for (const nome of ['..\\fora\\segredo.txt', '../fora/segredo.txt', '..\\..\\..\\Windows\\win.ini', join(fora, 'segredo.txt')]) {
    assert.throws(() => lerDados(nome, algoritmo, docs), { code: 'FORA_DA_PASTA' }, nome)
    assert.throws(() => anexarDados(nome, algoritmo, docs, 'x'), { code: 'FORA_DA_PASTA' }, nome)
  }
  assert.equal(readFileSync(join(fora, 'segredo.txt'), 'utf8'), 'x\n')
  assert.equal(dentroDaPasta(algoritmo, 'a/../b.txt'), resolve(algoritmo, 'b.txt'))
  assert.equal(dentroDaPasta(algoritmo, '..'), null)
})

test('gravarAtomicoSync grava e não deixa .misteralg-tmp', () => {
  const caminho = join(pasta, 'prefs.json')
  gravarAtomicoSync(caminho, '{"a":1}')
  gravarAtomicoSync(caminho, '{"a":2}')
  assert.equal(readFileSync(caminho, 'utf8'), '{"a":2}')
  assert.deepEqual(readdirSync(pasta).filter((n) => n.endsWith('.misteralg-tmp')), [])
  assert.throws(() => gravarAtomicoSync(join(pasta, 'sumida', 'x.json'), '{}'))
})