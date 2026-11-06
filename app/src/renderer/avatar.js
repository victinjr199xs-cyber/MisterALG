// Avatar da conta: a foto redonda ou, sem foto, as iniciais do nome sobre a cor de acento do tema.
// Nome e foto entram como texto/atributo (nunca como HTML).

import { iniciais } from '../compartilhado/conta.js'
import { ICONES } from './icones.js'

/** @param {{nome?:string, foto?:string|null}} conta  @param tamanho largura em px (opcional) */
export function criarAvatar({ nome = '', foto = null } = {}, tamanho) {
  const disco = document.createElement('span')
  disco.className = 'avatar-disco'
  if (tamanho) disco.style.setProperty('--av', `${tamanho}px`)
  const letras = iniciais(nome)
  if (foto) {
    const img = document.createElement('img')
    img.alt = ''
    img.src = foto
    disco.append(img)
  } else if (letras) {
    disco.textContent = letras
  } else {
    disco.innerHTML = ICONES.avatar // desenho fixo do próprio app
  }
  return disco
}
