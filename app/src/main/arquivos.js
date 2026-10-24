// Leitura e gravação de .alg. Os arquivos do VisuAlg (Windows) usam
// Windows-1252; gravamos no mesmo formato para continuarem abrindo lá, e só
// caímos para UTF-8 se o texto tiver algum caractere fora do 1252.

import { open, readFile, rename, rm } from 'node:fs/promises'
import { readFileSync, appendFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { isAbsolute, join } from 'node:path'

const cp1252 = new TextDecoder('windows-1252')
const utf8 = new TextDecoder('utf-8', { fatal: true })

const TABELA = (() => {
  const bytes = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) bytes[i] = i
  const chars = cp1252.decode(bytes)
  const mapa = new Map()
  for (let i = 0; i < 256; i += 1) if (!mapa.has(chars[i])) mapa.set(chars[i], i)
  return mapa
})()

export function decodificar(bytes) {
  let corpo = bytes
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) corpo = bytes.subarray(3)
  try {
    return { texto: utf8.decode(corpo), codificacao: 'utf-8' }
  } catch {
    return { texto: cp1252.decode(corpo), codificacao: 'windows-1252' }
  }
}

/** Texto → bytes em CP1252 (com CRLF, como no Windows), ou null se não couber. */
function emCp1252(texto) {
  const comCrlf = texto.replace(/\r?\n/g, '\r\n')
  const saida = new Uint8Array(comCrlf.length)
  for (let i = 0; i < comCrlf.length; i += 1) {
    const b = TABELA.get(comCrlf[i])
    if (b === undefined) return null
    saida[i] = b
  }
  return saida
}

export function codificar(texto, codificacao = 'windows-1252') {
  if (codificacao === 'windows-1252') {
    const bytes = emCp1252(texto)
    if (bytes) return { bytes, codificacao }
  }
  return { bytes: Buffer.from(texto.replace(/\r?\n/g, '\r\n'), 'utf8'), codificacao: 'utf-8' }
}

export async function lerArquivo(caminho) {
  const { texto, codificacao } = decodificar(await readFile(caminho))
  return { caminho, texto: texto.replace(/\r\n?/g, '\n'), codificacao }
}

export async function gravarArquivo(caminho, texto, codificacao) {
  const r = codificar(texto, codificacao)
  // Grava num .tmp e troca de nome: uma falha no meio nunca deixa o original vazio.
  const tmp = `${caminho}.${process.pid}.misteralg-tmp`
  try {
    const arquivo = await open(tmp, 'w')
    try {
      await arquivo.writeFile(r.bytes)
      await arquivo.datasync() // no pen drive, garante os bytes no disco antes da troca
    } finally {
      await arquivo.close()
    }
    const oculto = estaOculto(caminho)
    await rename(tmp, caminho)
    if (oculto) ocultar(caminho)
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {})
    throw e
  }
  return r.codificacao
}

// No Windows o rename troca o arquivo e perde o atributo "oculto"; reaplicamos (falhar aqui não pode derrubar o salvar).
function estaOculto(caminho) {
  if (process.platform !== 'win32' || !existsSync(caminho)) return false
  try {
    return execFileSync('attrib', [caminho], { encoding: 'utf8', windowsHide: true }).slice(0, 20).includes('H')
  } catch {
    return false
  }
}

function ocultar(caminho) {
  try {
    execFileSync('attrib', ['+h', caminho], { windowsHide: true })
  } catch {}
}

// ---- comando `arquivo "dados.txt"` do Portugol (chamado de forma síncrona) ----

function resolver(nome, pastaBase, pastaPadrao) {
  if (isAbsolute(nome)) return nome
  return join(pastaBase || pastaPadrao, nome)
}

export function lerDados(nome, pastaBase, pastaPadrao) {
  const caminho = resolver(nome, pastaBase, pastaPadrao)
  if (!existsSync(caminho)) return null
  return decodificar(readFileSync(caminho)).texto
}

export function anexarDados(nome, pastaBase, pastaPadrao, linha) {
  const caminho = resolver(nome, pastaBase, pastaPadrao)
  appendFileSync(caminho, codificar(linha + '\n').bytes)
}
