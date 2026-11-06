// Conta do aluno (nome + foto): lógica pura, usada pelo main (validar a foto) e pelo renderer (iniciais).

export const FOTO_TAMANHO_MAX = 5 * 1024 * 1024 // bytes do arquivo escolhido
export const FOTO_LADO_MAX = 12000 // px de um lado: acima disso é bomba de descompressão
export const FOTO_LADO = 128 // px da foto guardada
export const FOTO_EXTENSOES = ['png', 'jpg', 'jpeg', 'webp']

/** "Maria da Silva" -> "MS"; "ana" -> "A"; vazio -> "". Letras de qualquer alfabeto. */
export function iniciais(nome) {
  const palavras = String(nome ?? '').match(/[\p{L}\p{N}]+/gu) ?? []
  if (!palavras.length) return ''
  const letra = (p) => Array.from(p)[0].toLocaleUpperCase()
  return palavras.length === 1 ? letra(palavras[0]) : letra(palavras[0]) + letra(palavras[palavras.length - 1])
}

/** Confere o arquivo escolhido antes de decodificar. SVG fica de fora de propósito (pode ter script). */
export function validarFoto({ extensao, tamanho }) {
  const ext = String(extensao ?? '').replace(/^\./, '').toLowerCase()
  if (!FOTO_EXTENSOES.includes(ext)) return { ok: false, motivo: 'tipo' }
  if (!(tamanho > 0) || tamanho > FOTO_TAMANHO_MAX) return { ok: false, motivo: 'tamanho' }
  return { ok: true }
}

/** Recorte quadrado ao centro de uma imagem largura x altura. */
export function recorteQuadrado(largura, altura) {
  const lado = Math.min(largura, altura)
  return { x: Math.floor((largura - lado) / 2), y: Math.floor((altura - lado) / 2), width: lado, height: lado }
}
