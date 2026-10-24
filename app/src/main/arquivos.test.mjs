import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gravarArquivo, lerArquivo } from './arquivos.js'

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
