// Leitura e gravação de .alg. Os arquivos do VisuAlg (Windows) usam
// Windows-1252; gravamos no mesmo formato para continuarem abrindo lá, e só
// caímos para UTF-8 se o texto tiver algum caractere fora do 1252.

import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync, appendFileSync, existsSync } from 'node:fs'
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
  await writeFile(caminho, r.bytes)
  return r.codificacao
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
