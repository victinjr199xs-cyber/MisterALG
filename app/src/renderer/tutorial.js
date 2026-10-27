// Tutorial da IDE (Ajuda > Tutorial do MisterALG; oferecido sozinho na primeira abertura): balões que
// passeiam pela tela com um recorte em volta de cada parte, e depois o primeiro programa na linguagem do
// documento, esperando o aluno apertar F9, digitar no console e seguir com F8. O roteiro fica em
// tutorial-passos.js. A sobreposição não é um <dialog>: a IDE continua funcionando por baixo dela
// (os atalhos, o console, o editor), e fechar no meio não deixa nada pela metade.

import { passosDoPasseio, passosDoPrograma, posicaoDoBalao, nomeDaLinguagem } from './tutorial-passos.js'

const el = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos)
  return e
}

/**
 * @param op { t, linguagem(): id, escreverPrograma(linguagem): Promise<boolean> (false = o aluno cancelou),
 *             aoEvento(fn): desligar, aoFechar() }
 */
export function abrirTutorial(op) {
  const { t } = op
  const linguagem = op.linguagem()
  const passos = [...passosDoPasseio(linguagem), ...passosDoPrograma(linguagem)]
  const rtl = document.documentElement.dir === 'rtl'
  let atual = 0
  let fechado = false

  const recorte = el('div', { className: 'tutorial-recorte' })
  const contador = el('span', { className: 'tutorial-contador' })
  const texto = el('p', { className: 'tutorial-texto', id: 'tutorial-texto' })
  const voltar = el('button', { type: 'button', className: 'acao', textContent: t('Voltar') })
  const proximo = el('button', { type: 'button', className: 'acao principal' })
  const sair = el('button', { type: 'button', className: 'tutorial-sair', textContent: '×', title: t('Fechar o tutorial (Esc)') })
  sair.setAttribute('aria-label', t('Fechar o tutorial (Esc)'))
  const balao = el('div', { className: 'tutorial-balao' },
    el('div', { className: 'tutorial-cabecalho' }, el('b', { textContent: t('Tutorial do MisterALG') }), contador, sair),
    texto,
    el('div', { className: 'tutorial-acoes' }, voltar, proximo),
  )
  balao.setAttribute('role', 'dialog')
  balao.setAttribute('aria-modal', 'false')
  balao.setAttribute('aria-labelledby', 'tutorial-texto')
  balao.tabIndex = -1
  const raiz = el('div', { className: 'tutorial' }, recorte, balao)
  document.body.append(raiz)

  const passo = () => passos[atual]
  const alvo = () => (passo().alvo ? document.querySelector(passo().alvo) : null)

  function posicionar() {
    if (fechado) return
    const a = alvo()
    const r = a?.getBoundingClientRect()
    const visivel = r && r.width > 0 && r.height > 0
    raiz.classList.toggle('leve', !!passo().leve)
    raiz.classList.toggle('sem-alvo', !visivel)
    if (visivel) {
      const folga = 4
      Object.assign(recorte.style, { left: `${r.left - folga}px`, top: `${r.top - folga}px`, width: `${r.width + folga * 2}px`, height: `${r.height + folga * 2}px` })
    }
    const p = posicaoDoBalao(
      visivel ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
      { w: balao.offsetWidth, h: balao.offsetHeight },
      { w: innerWidth, h: innerHeight },
      { rtl, canto: !!passo().leve },
    )
    balao.style.left = `${p.x}px`
    balao.style.top = `${p.y}px`
    balao.dataset.lado = p.lado
  }

  function mostrar(i) {
    atual = Math.max(0, Math.min(i, passos.length - 1))
    const p = passo()
    contador.textContent = t('Passo {0} de {1}', atual + 1, passos.length)
    texto.textContent = t(p.texto, nomeDaLinguagem(linguagem))
    voltar.hidden = atual === 0
    const ultimo = atual === passos.length - 1
    proximo.textContent = p.acao === 'programa' ? t('Escrever o programa') : p.espera ? t('Pular esta parte') : ultimo ? t('Concluir') : t('Próximo')
    proximo.classList.toggle('principal', !p.espera)
    balao.classList.toggle('esperando', !!p.espera)
    posicionar()
    // Nos passos de ação o foco fica com a IDE (o editor ou o console); nos outros, no botão do balão.
    if (!p.espera) proximo.focus({ preventScroll: true })
    else if (!document.activeElement || balao.contains(document.activeElement)) document.querySelector('.cm-content')?.focus()
  }

  async function avancar() {
    const p = passo()
    if (p.acao === 'programa') {
      proximo.disabled = true
      const escreveu = await op.escreverPrograma(linguagem).finally(() => { proximo.disabled = false })
      if (fechado || !escreveu) return
    }
    if (atual === passos.length - 1) fechar()
    else mostrar(atual + 1)
  }

  function fechar() {
    if (fechado) return
    fechado = true
    desligar()
    clearInterval(relogio)
    removeEventListener('resize', posicionar)
    removeEventListener('keydown', teclas, true)
    raiz.remove()
    op.aoFechar?.()
  }

  // Os passos de ação avançam sozinhos quando a execução chega lá.
  const desligar = op.aoEvento((tipo) => {
    if (!fechado && passo().espera === tipo) mostrar(atual + 1)
  })

  function teclas(e) {
    if (e.key === 'Escape') {
      // O Esc no campo de digitação do console é do programa (termina a execução); os diálogos também cuidam do seu.
      if (e.target.closest?.('.console-entrada') || document.querySelector('dialog[open]')) return
      e.preventDefault()
      e.stopPropagation()
      fechar()
      return
    }
    if (!balao.contains(e.target)) return
    const frente = rtl ? 'ArrowLeft' : 'ArrowRight'
    const tras = rtl ? 'ArrowRight' : 'ArrowLeft'
    if (e.key === frente && !passo().espera && !passo().acao) avancar()
    else if (e.key === tras && atual > 0) mostrar(atual - 1)
    else if (e.key === 'Tab') { // o foco circula dentro do balão
      const botoes = [...balao.querySelectorAll('button:not([hidden]):not(:disabled)')]
      const i = botoes.indexOf(document.activeElement)
      const prox = e.shiftKey ? (i <= 0 ? botoes.length - 1 : i - 1) : (i + 1) % botoes.length
      botoes[prox]?.focus()
    } else return
    e.preventDefault()
    e.stopPropagation()
  }

  voltar.addEventListener('click', () => mostrar(atual - 1))
  proximo.addEventListener('click', avancar)
  sair.addEventListener('click', fechar)
  addEventListener('resize', posicionar)
  addEventListener('keydown', teclas, true)
  // Os alvos mudam de tamanho e de lugar (o console abre, a memória aparece): acompanha.
  const relogio = setInterval(posicionar, 250)

  mostrar(0)
  return {
    fechar,
    get passo() { return atual },
    get total() { return passos.length },
    get esperando() { return passo().espera ?? null },
    avancar,
  }
}
