// Faixa de guias (abas) de documentos da disposição moderna, como as do VS Code: uma aba por arquivo aberto, "+" para
// criar numa linguagem, relógio para os projetos anteriores (recentes e exemplos). Só desenha; quem sabe de documentos é o main.js.

import { LINGUAGENS } from './inicio.js'
import { ICONES_LINGUAGEM } from './icones-linguagens.js'

const h = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos.filter((f) => f != null))
  return e
}
const lucide = (corpo) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`
const ICONE_MAIS = lucide('<path d="M5 12h14"/><path d="M12 5v14"/>')
const ICONE_X = lucide('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
const ICONE_RELOGIO = lucide('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>')
export const SIGLAS = { portugol: 'Pt', c: 'C', cpp: 'C++', csharp: 'C#', javascript: 'JS', typescript: 'TS', python: 'Py', php: 'PHP', sql: 'SQL' }
const lang = (id) => LINGUAGENS.find((l) => l.id === id) ?? LINGUAGENS[0]
const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * @param op { t, lista(): [{id, nome, linguagem, modificado, ativa}], ativar(id), fechar(id), nova(linguagem), mover(de, para),
 *   recentes(): Promise<string[]>, exemplos(): Promise<{nome, abrir()}[]>, abrirRecente(caminho), linguagemDoCaminho(caminho), linguagemAtiva(): id }
 */
export function criarAbas(op) {
  const { t } = op
  const lista = h('div', { className: 'abas-doc', id: 'abas-doc' })
  lista.setAttribute('role', 'tablist')
  lista.setAttribute('aria-label', t('Documentos abertos'))
  const botao = (classe, rotulo, icone, extra = {}) => {
    const b = h('button', { type: 'button', className: classe, title: rotulo, ...extra })
    b.setAttribute('aria-label', rotulo)
    b.innerHTML = icone
    return b
  }
  const mais = botao('aba-botao aba-nova', t('Nova aba'), ICONE_MAIS)
  mais.setAttribute('aria-haspopup', 'menu')
  mais.setAttribute('aria-expanded', 'false')
  const relogio = botao('aba-botao aba-historico', t('Projetos anteriores'), ICONE_RELOGIO)
  relogio.setAttribute('aria-haspopup', 'dialog')
  relogio.setAttribute('aria-expanded', 'false')
  const fim = h('div', { className: 'faixa-fim' }) // o avatar da conta mora aqui
  const el = h('div', { id: 'faixa-abas', className: 'faixa-abas' }, lista, mais, relogio, fim)

  // ---- as guias ------------------------------------------------------------------------------
  let arrastando = -1
  function atualizar() {
    const itens = op.lista()
    lista.replaceChildren(...itens.map((a, i) => {
      const l = lang(a.linguagem)
      const x = h('button', { type: 'button', className: 'aba-x', tabIndex: -1 })
      x.setAttribute('aria-label', t('Fechar {0}', a.nome))
      x.title = t('Fechar aba')
      x.innerHTML = `<span class="aba-ponto" aria-hidden="true">●</span><span class="aba-cruz">${ICONE_X}</span>`
      x.addEventListener('click', (e) => { e.stopPropagation(); op.fechar(a.id) })
      const b = h('div', { className: 'aba-doc', id: `aba-doc-${a.id}`, tabIndex: a.ativa ? 0 : -1, draggable: true },
        h('i', { className: 'aba-sigla', textContent: SIGLAS[a.linguagem] ?? l.nome.slice(0, 2) }),
        h('span', { className: 'aba-nome', textContent: a.nome }), x)
      b.setAttribute('role', 'tab')
      b.setAttribute('aria-selected', String(a.ativa))
      b.setAttribute('aria-controls', 'editor-painel')
      b.dataset.modificado = String(a.modificado)
      b.title = a.nome
      b.style.setProperty('--cor', l.cor)
      b.addEventListener('click', () => op.ativar(a.id))
      b.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); op.fechar(a.id) } })
      b.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault() }) // sem o cursor de rolagem do clique do meio
      b.addEventListener('dragstart', (e) => { arrastando = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) })
      b.addEventListener('dragover', (e) => { if (arrastando >= 0) { e.preventDefault(); b.dataset.alvo = 'sim' } })
      b.addEventListener('dragleave', () => delete b.dataset.alvo)
      b.addEventListener('drop', (e) => { e.preventDefault(); const de = arrastando; arrastando = -1; if (de >= 0 && de !== i) op.mover(de, i) })
      b.addEventListener('dragend', () => { arrastando = -1; for (const o of lista.children) delete o.dataset.alvo })
      return b
    }))
    lista.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  lista.addEventListener('keydown', (e) => {
    const abas = [...lista.children]
    const i = abas.indexOf(document.activeElement)
    if (i < 0) return
    const alvo = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key]
    if (alvo !== undefined) {
      e.preventDefault()
      const rtl = document.documentElement.dir === 'rtl'
      const k = rtl && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') ? i + (alvo < i ? 1 : -1) : alvo
      abas[(k + abas.length) % abas.length].click()
      lista.children[(k + abas.length) % abas.length]?.focus()
    } else if (e.key === 'Delete') { e.preventDefault(); abas[i].querySelector('.aba-x').click() }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abas[i].click() }
  })
  // A roda do mouse rola a faixa na horizontal quando as guias passam da largura.
  lista.addEventListener('wheel', (e) => {
    if (lista.scrollWidth <= lista.clientWidth || e.ctrlKey) return
    e.preventDefault()
    lista.scrollLeft += e.deltaY || e.deltaX
  }, { passive: false })

  // ---- popovers (um aberto por vez): fecham com Esc, clique fora ou escolhendo ----------------
  let aberto = null // { botao, caixa }
  function fechar(devolverFoco = true) {
    if (!aberto) return
    const { botao: b, caixa } = aberto
    aberto = null
    caixa.remove()
    b.setAttribute('aria-expanded', 'false')
    if (devolverFoco) b.focus({ preventScroll: true })
  }
  function abrirPopover(b, caixa) {
    fechar(false)
    document.body.append(caixa)
    const r = b.getBoundingClientRect()
    const rtl = document.documentElement.dir === 'rtl'
    caixa.style.top = `${r.bottom + 6}px`
    const larg = caixa.offsetWidth
    const x = rtl ? r.right - larg : r.left
    caixa.style.left = `${Math.max(6, Math.min(x, innerWidth - larg - 6))}px`
    caixa.style.maxHeight = `${Math.max(160, innerHeight - r.bottom - 20)}px`
    b.setAttribute('aria-expanded', 'true')
    aberto = { botao: b, caixa }
  }
  document.addEventListener('mousedown', (e) => {
    if (aberto && !aberto.caixa.contains(e.target) && !aberto.botao.contains(e.target)) fechar(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aberto) { e.preventDefault(); e.stopPropagation(); fechar() }
  }, true)
  const setas = (caixa, seletor) => caixa.addEventListener('keydown', (e) => {
    const itens = [...caixa.querySelectorAll(seletor)].filter((x) => !x.closest('[hidden]'))
    const i = itens.indexOf(document.activeElement)
    const alvo = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: itens.length - 1 }[e.key]
    if (alvo === undefined || !itens.length) return
    e.preventDefault()
    itens[(alvo + itens.length) % itens.length].focus()
  })

  function menuNova() {
    if (aberto?.botao === mais) return fechar()
    const caixa = h('div', { className: 'menu-nova' })
    caixa.setAttribute('role', 'menu')
    caixa.setAttribute('aria-label', t('Escolha a linguagem do novo documento'))
    for (const l of LINGUAGENS) {
      const icone = h('span', { className: 'menu-nova-icone' })
      icone.innerHTML = ICONES_LINGUAGEM[l.id]
      icone.style.setProperty('--cor', l.cor)
      const it = h('button', { type: 'button', className: 'menu-nova-item', tabIndex: -1 }, icone,
        h('span', { className: 'menu-nova-nome', textContent: l.nome }), h('span', { className: 'menu-nova-ext', textContent: l.ext }))
      it.setAttribute('role', 'menuitem')
      it.title = t('Novo programa em {0}', l.nome)
      it.addEventListener('click', () => { fechar(false); op.nova(l.id) })
      caixa.append(it)
    }
    setas(caixa, '.menu-nova-item')
    abrirPopover(mais, caixa)
    ;(caixa.querySelector(`.menu-nova-item:nth-child(${Math.max(1, LINGUAGENS.findIndex((l) => l.id === op.linguagemAtiva()) + 1)})`) ?? caixa.firstChild).focus()
  }
  mais.addEventListener('click', menuNova)

  async function painelHistorico() {
    if (aberto?.botao === relogio) return fechar()
    const campo = h('input', { type: 'search', className: 'historico-campo', placeholder: t('Filtrar por nome…'), autocomplete: 'off', spellcheck: false })
    campo.setAttribute('aria-label', t('Filtrar por nome…'))
    const corpo = h('div', { className: 'historico-corpo' })
    const caixa = h('div', { className: 'historico', id: 'historico' }, h('div', { className: 'historico-busca' }, campo), corpo)
    caixa.setAttribute('role', 'dialog')
    caixa.setAttribute('aria-label', t('Projetos anteriores'))
    const item = (rotulo, pasta, id, acao) => {
      const l = lang(id)
      const b = h('button', { type: 'button', className: 'historico-item', tabIndex: -1 },
        h('i', { className: 'aba-sigla', textContent: SIGLAS[id] ?? '' }),
        h('span', { className: 'historico-nome', textContent: rotulo }),
        pasta ? h('small', { className: 'historico-pasta', textContent: pasta }) : null)
      b.style.setProperty('--cor', l.cor)
      b.dataset.busca = sem(`${rotulo} ${pasta ?? ''}`)
      b.title = pasta ? `${pasta}` : rotulo
      b.addEventListener('click', () => { fechar(false); acao() })
      return b
    }
    const secao = (titulo, itens, vazio) => h('section', { className: 'historico-secao' },
      h('h2', { className: 'historico-titulo', textContent: titulo }),
      ...(itens.length ? itens : [h('p', { className: 'historico-vazio', textContent: vazio })]))
    abrirPopover(relogio, caixa)
    const [recentes, exemplos] = await Promise.all([op.recentes(), op.exemplos()])
    if (aberto?.caixa !== caixa) return
    const dir = (c) => c.replace(/[\\/][^\\/]*$/, '')
    corpo.replaceChildren(
      secao(t('Recentes'), recentes.map((c) => item(c.split(/[\\/]/).pop(), dir(c), op.linguagemDoCaminho(c), () => op.abrirRecente(c))), t('Os algoritmos que você abrir aparecem aqui.')),
      secao(t('Exemplos de {0}', lang(op.linguagemAtiva()).nome), exemplos.map((e) => item(e.nome, null, op.linguagemAtiva(), e.abrir)), t('Nenhum resultado')))
    campo.addEventListener('input', () => {
      const partes = sem(campo.value).split(/\s+/).filter(Boolean)
      for (const b of corpo.querySelectorAll('.historico-item')) b.hidden = !partes.every((p) => b.dataset.busca.includes(p))
    })
    setas(caixa, '.historico-campo, .historico-item')
    campo.focus()
  }
  relogio.addEventListener('click', painelHistorico)

  return { el, fim, atualizar, fechar, menuNova, painelHistorico }
}
