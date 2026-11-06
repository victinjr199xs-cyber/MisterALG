// Posição e tamanho da janela do console (janelas.js): o que foi lembrado só vale se ainda cabe numa tela visível.

export const TAMANHO_PADRAO = { width: 880, height: 520 }
export const TAMANHO_MINIMO = { width: 420, height: 240 }

const inteiro = (v) => Number.isFinite(v) ? Math.round(v) : null

/**
 * @param salvo { x, y, width, height } lembrado nas preferências (qualquer coisa pode vir daí)
 * @param area  área útil da tela que mais combina com ele ({ x, y, width, height })
 * @returns limites inteiros inteiramente dentro da área, ou null se `salvo` não presta
 */
export function limitesValidos(salvo, area) {
  if (!salvo || typeof salvo !== 'object' || !area) return null
  const [x, y, w, h] = [salvo.x, salvo.y, salvo.width, salvo.height].map(inteiro)
  if ([x, y, w, h].includes(null) || w < TAMANHO_MINIMO.width || h < TAMANHO_MINIMO.height) return null
  const width = Math.min(w, area.width)
  const height = Math.min(h, area.height)
  return {
    width,
    height,
    x: Math.min(Math.max(x, area.x), area.x + area.width - width),
    y: Math.min(Math.max(y, area.y), area.y + area.height - height),
  }
}

/** Sem posição lembrada: centralizada sobre a janela principal, sem sair da tela. */
export function limitesPadrao(principal, area) {
  const { width, height } = { width: Math.min(TAMANHO_PADRAO.width, area.width), height: Math.min(TAMANHO_PADRAO.height, area.height) }
  return limitesValidos({ x: principal.x + (principal.width - width) / 2, y: principal.y + (principal.height - height) / 2, width, height }, area)
}
