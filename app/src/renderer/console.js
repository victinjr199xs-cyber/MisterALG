// Console moderno (estilo Windows Terminal): cabeçalho com a linguagem, o programa e o selo de estado ao vivo,
// botões (executar de novo, parar, copiar, limpar, fixar, janela própria) e rodapé com tempo e linhas.
// O texto da saída continua sendo escrito por execucao.js; a lógica pura está em console-logica.js.
//
// Janela própria: o MESMO elemento #console é movido (adoptNode) para uma janela aberta com window.open
// (main/janelas.js só permite esse nome) e volta ao painel quando a janela fecha, sem parar o programa.

import { ICONES } from './icones.js'
import { LINGUAGENS } from './inicio.js'
import { consoleEmJanela, contarQuebras, criarHistorico, descreverSelo, formatarTempo } from './console-logica.js'

/** Entradas do `leia` desta sessão do app (em memória), compartilhadas por todas as execuções. */
export const historicoLeia = criarHistorico()

const NOME_JANELA = 'misteralg-console'
const SIGLAS = { portugol: 'Pt', c: 'C', cpp: 'C++', csharp: 'C#', javascript: 'JS', typescript: 'TS', python: 'Py', php: 'PHP', sql: 'SQL' }
const ATIVOS = new Set(['rodando', 'compilando', 'aguardando', 'pausado'])
const ATRIBUTOS_DA_RAIZ = ['data-tema', 'data-disposicao', 'data-tam-icone', 'lang', 'dir', 'style']

const h = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos.filter((f) => f != null))
  return e
}

/**
 * @param op { el, tela, t, idioma(), pref(): null|boolean, plataforma, api, programa(): {nome, linguagem}, rodar(id),
 *             aoParar(), aoFechar(), aoIrParaLinha(n), aoTecla(e), emTutorial?(), emExecucao?() }
 */
export function criarConsole(op) {
  const { el, tela } = op
  const t = (...a) => op.t(...a)
  const idioma = () => op.idioma?.() ?? 'pt'

  let estado = 'rodando'
  let linhaDoSelo = 0
  let inicio = performance.now()
  let fim = null
  let linhas = 0
  let relogio = null
  let fixado = false
  let janela = null // Window da janela própria, quando o console está nela
  let lugar = null
  let observador = null
  let sondagem = null

  // ---- cabeçalho e rodapé ------------------------------------------------------------------

  const siglaEl = h('span', { className: 'console-lang' })
  const nomeEl = h('span', { className: 'console-nome' })
  const ponto = h('i', { className: 'console-ponto' })
  const textoSelo = h('span')
  const selo = h('span', { className: 'console-selo' }, ponto, textoSelo)
  selo.setAttribute('role', 'status')
  selo.addEventListener('click', () => { if (linhaDoSelo) op.aoIrParaLinha(linhaDoSelo) })
  selo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && linhaDoSelo) op.aoIrParaLinha(linhaDoSelo) })

  const botao = (id, icone, fn) => {
    const b = h('button', { type: 'button', className: 'console-btn', innerHTML: ICONES[icone] })
    b.dataset.acao = id
    b.addEventListener('click', fn)
    return b
  }
  const reexecutar = botao('reexecutar', 'reexecutar', () => op.rodar('executar'))
  const parar = botao('parar', 'parar', () => op.aoParar())
  const copiar = botao('copiar', 'copiar', () => copiarSaida())
  const limparBtn = botao('limpar', 'limpar', () => limpar())
  const fixar = botao('fixar', 'fixar', () => alternarFixo())
  const janelaBtn = botao('janela', 'destacar', () => (janela ? recolocar() : destacar()))
  const fechar = botao('fechar', 'fechar', () => (ATIVOS.has(estado) ? op.aoParar() : op.aoFechar()))
  fixar.setAttribute('aria-pressed', 'false')
  const rotular = () => {
    const nomes = {
      reexecutar: 'Executar de novo', parar: 'Parar', copiar: 'Copiar saída', limpar: 'Limpar o console', fixar: 'Fixar no topo',
      janela: janela ? 'Recolocar no painel' : 'Abrir em janela própria', fechar: 'Fechar (Esc)',
    }
    for (const b of [reexecutar, parar, copiar, limparBtn, fixar, janelaBtn, fechar]) {
      const texto = t(nomes[b.dataset.acao])
      b.title = texto
      b.setAttribute('aria-label', texto)
    }
    janelaBtn.innerHTML = ICONES[janela ? 'recolocar' : 'destacar']
    fixar.hidden = !janela
  }

  const cab = document.getElementById('console-cab')
  cab.append(
    siglaEl, nomeEl, selo,
    h('span', { className: 'console-espaco' }),
    reexecutar, parar, copiar, limparBtn, fixar, janelaBtn, fechar,
  )
  cab.setAttribute('role', 'toolbar')
  const tempoEl = h('span', { className: 'console-tempo' })
  const linhasEl = h('span', { className: 'console-linhas' })
  document.getElementById('console-rodape').append(tempoEl, linhasEl)
  el.setAttribute('aria-label', t('Console'))

  const decorrido = () => (fim ?? performance.now()) - inicio
  function atualizarRodape() {
    tempoEl.textContent = formatarTempo(decorrido(), idioma())
    linhasEl.textContent = linhas === 1 ? t('1 linha') : t('{0} linhas', linhas)
  }

  /** estado: 'rodando' | 'compilando' | 'aguardando' | 'pausado' | 'finalizado' | 'erro' | 'parado' */
  function mudarEstado(novo, dados = {}) {
    if (novo === 'rodando' && estado === 'compilando') inicio = performance.now() // o tempo conta só a execução, não a compilação
    estado = novo
    const ativo = ATIVOS.has(novo)
    if (ativo) fim = null
    else fim ??= performance.now()
    const selado = descreverSelo(novo, { ...dados, ms: decorrido() }, t, idioma())
    linhaDoSelo = selado.linha ?? 0
    textoSelo.textContent = selado.texto
    selo.dataset.tom = selado.tom
    selo.dataset.pulsa = String(selado.pulsa)
    selo.classList.toggle('clicavel', !!linhaDoSelo)
    if (linhaDoSelo) {
      selo.setAttribute('role', 'button')
      selo.tabIndex = 0
      selo.title = t('Ir para a linha {0}', linhaDoSelo)
    } else {
      selo.setAttribute('role', 'status')
      selo.removeAttribute('tabindex')
      selo.removeAttribute('title')
    }
    parar.disabled = !ativo
    reexecutar.disabled = ativo
    limparBtn.disabled = novo === 'aguardando' // com o campo do `leia` aberto, limpar tiraria o campo do lugar
    clearInterval(relogio)
    relogio = ativo ? setInterval(atualizarRodape, 250) : null
    atualizarRodape()
    el.dataset.estado = novo
  }

  // ---- ações -------------------------------------------------------------------------------------

  function limpar() {
    if (estado === 'aguardando') return
    for (const n of [...tela.childNodes]) if (!n.classList?.contains('console-entrada')) n.remove()
    linhas = 0
    atualizarRodape()
  }

  let relogioCopia = null
  async function copiarSaida() {
    const texto = tela.textContent
    const dono = el.ownerDocument
    try {
      await dono.defaultView.navigator.clipboard.writeText(texto)
    } catch {
      const area = h('textarea', { value: texto })
      dono.body.append(area)
      area.select()
      dono.execCommand('copy')
      area.remove()
    }
    copiar.innerHTML = ICONES.verificado
    copiar.classList.add('feito')
    copiar.title = t('Copiado!')
    clearTimeout(relogioCopia)
    relogioCopia = setTimeout(() => {
      copiar.innerHTML = ICONES.copiar
      copiar.classList.remove('feito')
      copiar.title = t('Copiar saída')
    }, 1600)
  }

  function alternarFixo() {
    fixado = !fixado
    fixar.setAttribute('aria-pressed', String(fixado))
    op.api.console.fixar(fixado)
  }

  // ---- janela própria ----------------------------------------------------------------------------

  function sincronizar() {
    if (!janela || janela.closed) return
    const de = document.documentElement
    const para = janela.document.documentElement
    for (const a of ATRIBUTOS_DA_RAIZ) {
      if (de.hasAttribute(a)) para.setAttribute(a, de.getAttribute(a))
      else para.removeAttribute(a)
    }
    para.dataset.consoleJanela = '1'
    janela.document.body.className = document.body.className
  }

  function destacar() {
    if (janela && !janela.closed) { janela.focus(); return }
    const j = window.open('about:blank', NOME_JANELA, 'popup=yes,width=880,height=520')
    if (!j) return // o processo principal negou: o console fica no painel
    janela = j
    lugar = { pai: el.parentNode, depois: el.nextSibling }
    const d = j.document
    d.title = t('MisterALG — Console')
    d.head.append(h('meta', { charset: 'UTF-8' }))
    for (const n of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
      if (n.localName === 'link') d.head.append(Object.assign(d.createElement('link'), { rel: 'stylesheet', href: n.href }))
      else d.head.append(d.importNode(n, true))
    }
    sincronizar()
    d.body.append(d.adoptNode(el))
    observador = new MutationObserver(sincronizar)
    observador.observe(document.documentElement, { attributes: true })
    observador.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    j.addEventListener('pagehide', recolocar)
    j.addEventListener('beforeunload', recolocar)
    d.addEventListener('keydown', (e) => op.aoTecla(e))
    sondagem = setInterval(() => { if (j.closed) recolocar() }, 500)
    rotular()
    j.focus()
    if (fixado) op.api.console.fixar(true)
    ;(tela.querySelector('.console-entrada') ?? tela).focus()
  }

  /** A janela fechou (ou o aluno pediu): o console volta ao painel e o programa segue rodando. */
  function recolocar() {
    if (!janela) return
    const j = janela
    janela = null
    clearInterval(sondagem)
    observador?.disconnect()
    try {
      lugar.pai.insertBefore(document.adoptNode(el), lugar.depois?.parentNode === lugar.pai ? lugar.depois : null)
    } catch {
      lugar.pai.append(el)
    }
    try { if (!j.closed) j.close() } catch { /* já fechando */ }
    rotular()
    window.focus()
    ;(tela.querySelector('.console-entrada') ?? tela).focus()
  }

  // ---- ciclo ---------------------------------------------------------------------------------------

  rotular()
  mudarEstado('parado')
  textoSelo.textContent = ''

  return {
    historico: historicoLeia,
    get estado() { return estado },
    get emJanela() { return !!janela },
    el,
    /** Console aberto para uma nova execução: nome, sigla, relógio e contagem de linhas recomeçam. */
    comecar() {
      const { nome, linguagem } = op.programa()
      const lang = LINGUAGENS.find((l) => l.id === linguagem)
      siglaEl.textContent = SIGLAS[linguagem] ?? '?'
      siglaEl.style.setProperty('--cor', lang?.cor ?? '#7c6af7')
      nomeEl.textContent = nome
      nomeEl.title = nome
      linhas = 0
      inicio = performance.now()
      fim = null
      historicoLeia.recomecar()
      mudarEstado('rodando')
      if (!janela && !op.emTutorial?.() && consoleEmJanela(op.pref?.(), document.documentElement.dataset.disposicao)) destacar()
    },
    estadoAtual: mudarEstado,
    contar(texto) {
      linhas += contarQuebras(texto)
      if (!relogio) atualizarRodape()
    },
    zerarLinhas() { linhas = 0 },
    /** O console foi fechado (Esc depois do fim, ou o ×): a janela própria some junto. */
    aoEsconder() {
      if (janela) recolocar()
    },
    destacar,
    recolocar,
    /** "linha 5" clicável: leva o cursor do editor até a linha. */
    linkLinha({ texto, linha }) {
      const a = h('a', { className: 'console-linha-link', textContent: texto, tabIndex: 0, title: t('Ir para a linha {0}', linha) })
      a.setAttribute('role', 'link')
      const ir = () => op.aoIrParaLinha(linha)
      a.addEventListener('click', ir)
      a.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir() })
      return a
    },
    /** Mensagem do sistema ("Fim da execução"...): discreta, em cinza, com ícone. */
    sistema(texto, tom = 'info') {
      const linha = h('div', { className: 'saida-sistema', innerHTML: ICONES[tom === 'ok' ? 'verificado' : 'info'] }, h('span', { textContent: texto }))
      linha.dataset.tom = tom
      tela.append(linha)
      tela.scrollTop = tela.scrollHeight
    },
  }
}
