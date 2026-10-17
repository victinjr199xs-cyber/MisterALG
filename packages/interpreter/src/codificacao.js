// Bytes de um .alg → texto. Arquivos do VisuAlg vêm em Windows-1252; os
// salvos pelo MisterALG, em UTF-8. Usa UTF-8 se for válido, senão CP1252.

const utf8 = new TextDecoder('utf-8', { fatal: true })
const cp1252 = new TextDecoder('windows-1252')

/** @param {Uint8Array} bytes */
export function decodificar(bytes) {
  let inicio = 0
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) inicio = 3
  const corpo = bytes.subarray(inicio)
  let texto
  try {
    texto = utf8.decode(corpo)
  } catch {
    texto = cp1252.decode(corpo)
  }
  return texto.replace(/\r\n?/g, '\n')
}

const TABELA_1252 = (() => {
  const mapa = new Map()
  const bytes = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) bytes[i] = i
  const chars = cp1252.decode(bytes)
  for (let i = 0; i < 256; i += 1) if (!mapa.has(chars[i])) mapa.set(chars[i], i)
  return { chars, mapa }
})()

/** Código Windows-1252 de um caractere (asc); 63 ('?') se não existir. */
export const codigo1252 = (ch) => TABELA_1252.mapa.get(ch) ?? 63

/** Caractere de um código Windows-1252 (carac). */
export const caractere1252 = (n) => TABELA_1252.chars[((n % 256) + 256) % 256]
