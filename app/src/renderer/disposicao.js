// Disposição "moderna" da tela (preferência `disposicao`): trilho de linguagens, coluna de arquivos, cabeçalho da página,
// painel inferior com abas e a memória à direita. Os blocos da IDE (editor, memória, console, barra, avatar) são os
// MESMOS elementos, só reposicionados por CSS (estilos/disposicao.css); aqui nascem apenas os elementos novos.
// Na disposição clássica nada disto existe na tela.

import { LINGUAGENS } from './inicio.js'
import { ICONES_LINGUAGEM } from './icones-linguagens.js'

const h = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos.filter((f) => f != null))
  return e
}
const ARQUIVO = (doc, ext) => (doc.caminho ? doc.caminho.split(/[\\/]/).pop() : `${doc.nome}.${ext[doc.linguagem]}`)
const ICONE_PAINEL = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>'
const ESTREITA = '(max-width: 1279px)' // abaixo disso a coluna de arquivos começa recolhida

/**
 * @param op { api, t, doc, extensoes, novo(linguagem), abrirRecente(caminho), abrirExemplo({nome,texto}), alturaSalva: number, gravarAltura(px) }
 */
export function criarDisposicao(op) {
  const raiz = document.documentElement
  const { t, doc } = op
  let montado = false
  let ativa = false
  let problema = null
  let nos = {}

  const recolher = (fechado) => {
    raiz.dataset.canais = fechado ? 'fechado' : 'aberto'
    nos.alternar?.setAttribute('aria-expanded', String(!fechado))
  }
  window.matchMedia(ESTREITA).addEventListener('change', (e) => { if (ativa) recolher(e.matches) })

  function montar() {
    montado = true
    const main = document.querySelector('main')
    const barraConta = () => document.querySelector('[data-id="conta"]')

    // Trilho: um botão por linguagem (o mesmo que "Novo" naquela linguagem); o avatar da conta mora embaixo.
    const lista = h('div', { className: 'trilho-lista' })
    for (const l of LINGUAGENS) {
      const nome = t('Novo programa em {0}', l.nome)
      const b = h('button', { type: 'button', className: 'trilho-lang' })
      b.dataset.lang = l.id
      b.dataset.nome = l.nome
      b.setAttribute('aria-label', nome)
      b.style.setProperty('--cor', l.cor)
      b.innerHTML = ICONES_LINGUAGEM[l.id] // desenho fixo do próprio app
      b.addEventListener('click', () => op.novo(l.id))
      lista.append(b)
    }
    // Tooltip único e fixo (a lista rola, então um filho absoluto seria cortado).
    const dica = h('div', { className: 'trilho-dica', hidden: true })
    dica.setAttribute('role', 'tooltip')
    const mostrarDica = (e) => {
      const b = e.target.closest?.('.trilho-lang')
      if (!b) return
      const r = b.getBoundingClientRect()
      dica.textContent = b.dataset.nome
      dica.hidden = false
      const rtl = raiz.dir === 'rtl'
      dica.style.insetBlockStart = `${r.top + r.height / 2}px`
      dica.style.insetInlineStart = rtl ? 'auto' : `${r.right + 10}px`
      dica.style.insetInlineEnd = rtl ? `${innerWidth - r.left + 10}px` : 'auto'
    }
    for (const ev of ['pointerover', 'focusin']) lista.addEventListener(ev, mostrarDica)
    for (const ev of ['pointerleave', 'focusout']) lista.addEventListener(ev, () => { dica.hidden = true })
    lista.addEventListener('click', () => { dica.hidden = true })
    document.body.append(dica)
    const trilho = h('nav', { id: 'trilho', className: 'trilho' }, lista, h('div', { className: 'trilho-rodape' }))
    trilho.setAttribute('aria-label', t('Linguagens'))

    // Coluna de arquivos: recentes e exemplos.
    nos.recentes = h('ul', { className: 'canais-lista' })
    nos.exemplos = h('ul', { className: 'canais-lista' })
    nos.nomeLinguagem = h('span', { className: 'canais-titulo' })
    const canais = h('aside', { id: 'canais', className: 'canais' },
      h('div', { className: 'canais-cab' }, nos.nomeLinguagem),
      h('div', { className: 'canais-corpo' },
        h('h2', { className: 'canais-secao', textContent: t('Recentes') }), nos.recentes,
        h('h2', { className: 'canais-secao', textContent: t('Exemplos') }), nos.exemplos))
    canais.setAttribute('aria-label', t('Arquivos'))

    // Cabeçalho da página (estilo Notion): ícone, título e propriedades.
    nos.alternar = h('button', { type: 'button', className: 'cab-alternar', title: t('Mostrar ou ocultar a lista de arquivos') })
    nos.alternar.setAttribute('aria-label', t('Mostrar ou ocultar a lista de arquivos'))
    nos.alternar.setAttribute('aria-controls', 'canais')
    nos.alternar.innerHTML = ICONE_PAINEL
    nos.alternar.addEventListener('click', () => recolher(raiz.dataset.canais !== 'fechado'))
    nos.icone = h('span', { className: 'cab-icone' })
    nos.titulo = h('h1', { className: 'cab-titulo' })
    nos.propLinguagem = h('b')
    nos.propEstado = h('b')
    nos.pontoEstado = h('i', { className: 'cab-ponto' })
    const prop = (rotulo, ...valor) => h('li', { className: 'cab-prop' }, h('span', { textContent: rotulo }), ...valor)
    const cab = h('header', { id: 'cab-pagina', className: 'cab-pagina' },
      h('div', { className: 'cab-linha' }, nos.alternar, nos.icone, nos.titulo),
      h('ul', { className: 'cab-props' }, prop(t('Linguagem'), nos.propLinguagem), prop(t('Arquivo'), nos.pontoEstado, nos.propEstado)))

    // Divisor arrastável + abas do painel inferior.
    nos.divisor = h('div', { id: 'divisor', className: 'divisor', tabIndex: 0 })
    nos.divisor.setAttribute('role', 'separator')
    nos.divisor.setAttribute('aria-orientation', 'horizontal')
    nos.divisor.setAttribute('aria-label', t('Redimensionar o painel inferior'))
    const aba = (id, rotulo) => {
      const b = h('button', { type: 'button', className: 'aba-inferior', id: `aba-${id}`, textContent: rotulo })
      b.setAttribute('role', 'tab')
      b.setAttribute('aria-controls', id === 'terminal' ? 'painel-terminal' : 'problemas')
      b.addEventListener('click', () => mostrarAba(id))
      return b
    }
    nos.abaTerminal = aba('terminal', t('Terminal'))
    nos.abaProblemas = aba('problemas', t('Problemas'))
    nos.selo = h('span', { className: 'aba-selo', hidden: true })
    nos.abaProblemas.append(nos.selo)
    const abas = h('div', { id: 'abas-inferior', className: 'abas-inferior' }, nos.abaTerminal, nos.abaProblemas)
    abas.setAttribute('role', 'tablist')
    abas.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.preventDefault()
      const outra = nos.abaAtual === 'terminal' ? 'problemas' : 'terminal'
      mostrarAba(outra)
      document.getElementById(`aba-${outra}`).focus()
    })
    nos.problemas = h('div', { id: 'problemas', className: 'problemas', hidden: true })
    nos.problemas.setAttribute('role', 'tabpanel')
    nos.problemas.setAttribute('aria-labelledby', 'aba-problemas')
    nos.terminal = document.querySelector('.moldura-visualizacao')
    nos.terminal.id = 'painel-terminal'
    nos.terminal.setAttribute('role', 'tabpanel')
    nos.terminal.setAttribute('aria-labelledby', 'aba-terminal')

    // Memória: cabeçalho com contador (a tabela #variaveis é a de sempre).
    nos.contador = h('span', { className: 'mem-contador', textContent: '0' })
    const memCab = h('div', { id: 'mem-cab', className: 'mem-cab' }, h('span', { textContent: t('Memória') }), nos.contador)
    const molduraMem = document.querySelector('.moldura-variaveis')
    molduraMem.prepend(memCab)
    new MutationObserver(() => { nos.contador.textContent = String(document.querySelectorAll('#variaveis tbody tr').length) })
      .observe(document.querySelector('#variaveis tbody'), { childList: true })

    document.body.append(trilho)
    main.prepend(canais, cab)
    main.append(nos.divisor, abas, nos.problemas)
    nos.trilho = trilho
    nos.barraConta = barraConta
    nos.rodape = trilho.querySelector('.trilho-rodape')
    ligarDivisor(main)
    mostrarAba('terminal')
    atualizarProblemas()
  }

  function ligarDivisor(main) {
    const altura = (px) => {
      const max = Math.max(160, main.clientHeight - 300)
      const v = Math.round(Math.min(max, Math.max(120, px)))
      main.style.setProperty('--h-inferior', `${v}px`)
      return v
    }
    if (op.alturaSalva > 0) altura(op.alturaSalva)
    const atual = () => nos.terminal.getBoundingClientRect().height
    let ultimo = 0
    nos.divisor.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      nos.divisor.setPointerCapture(e.pointerId)
      const y0 = e.clientY
      const h0 = atual()
      const mover = (m) => { ultimo = altura(h0 + (y0 - m.clientY)) }
      const soltar = () => {
        nos.divisor.removeEventListener('pointermove', mover)
        nos.divisor.removeEventListener('pointerup', soltar)
        if (ultimo) op.gravarAltura(ultimo)
      }
      nos.divisor.addEventListener('pointermove', mover)
      nos.divisor.addEventListener('pointerup', soltar)
    })
    nos.divisor.addEventListener('keydown', (e) => {
      const passo = { ArrowUp: 24, ArrowDown: -24 }[e.key]
      if (!passo) return
      e.preventDefault()
      op.gravarAltura(altura(atual() + passo))
    })
  }

  function mostrarAba(id) {
    nos.abaAtual = id
    nos.terminal.hidden = id !== 'terminal'
    nos.problemas.hidden = id !== 'problemas'
    for (const [k, b] of [['terminal', nos.abaTerminal], ['problemas', nos.abaProblemas]]) {
      b.setAttribute('aria-selected', String(k === id))
      b.tabIndex = k === id ? 0 : -1
    }
  }

  function atualizarProblemas() {
    nos.selo.hidden = !problema
    nos.selo.textContent = problema ? '1' : ''
    if (!problema) {
      nos.problemas.replaceChildren(h('p', { className: 'problemas-vazio', textContent: t('Nenhum problema ✨') }))
      return
    }
    nos.problemas.replaceChildren(h('p', { className: 'problema' },
      h('b', { textContent: t('Linha {0}', problema.linha ?? '?') }), h('span', { textContent: problema.mensagem ?? String(problema) })))
  }

  async function atualizarListas() {
    const prefs = await op.api.prefs.ler()
    const abrir = (fn) => (e) => { e.preventDefault(); fn() }
    const item = (rotulo, atual, fn, dica) => {
      const b = h('button', { type: 'button', className: 'canal', textContent: rotulo, title: dica ?? rotulo })
      if (atual) b.setAttribute('aria-current', 'true')
      b.addEventListener('click', abrir(fn))
      return h('li', {}, b)
    }
    const nomeDe = (c) => c.split(/[\\/]/).pop()
    nos.recentes.replaceChildren(...((prefs.mru ?? []).length
      ? prefs.mru.map((c) => item(nomeDe(c), c === doc.caminho, () => op.abrirRecente(c), c))
      : [h('li', { className: 'canais-vazio', textContent: t('Os algoritmos que você abrir aparecem aqui.') })]))
    const grupos = (await op.api.exemplos.listar()).filter((g) => g.id === doc.linguagem)
    nos.exemplos.replaceChildren(...grupos.flatMap((g) => g.arquivos.map((nome) =>
      item(nome, !doc.caminho && ARQUIVO(doc, op.extensoes) === nome, async () => {
        const r = await op.api.exemplos.ler({ grupo: g.id, arquivo: nome })
        if (r) op.abrirExemplo(r)
      }))))
  }

  /** Chamado quando o documento muda (abrir, novo, salvar, editar). */
  function atualizar() {
    if (!ativa) return
    const l = LINGUAGENS.find((x) => x.id === doc.linguagem) ?? LINGUAGENS[0]
    for (const b of nos.trilho.querySelectorAll('.trilho-lang')) {
      if (b.dataset.lang === l.id) b.setAttribute('aria-current', 'true')
      else b.removeAttribute('aria-current')
    }
    nos.icone.innerHTML = ICONES_LINGUAGEM[l.id]
    nos.icone.style.setProperty('--cor', l.cor)
    nos.titulo.textContent = ARQUIVO(doc, op.extensoes)
    nos.propLinguagem.textContent = l.nome
    nos.nomeLinguagem.textContent = l.nome
    nos.propEstado.textContent = doc.modificado ? t('Modificado') : t('Salvo')
    nos.pontoEstado.dataset.estado = doc.modificado ? 'modificado' : 'salvo'
    atualizarListas()
  }

  return {
    /** 'moderna' monta (uma vez) e mostra; qualquer outro valor devolve tudo à disposição clássica. */
    aplicar(d) {
      const moderna = d === 'moderna'
      if (moderna === ativa) return
      ativa = moderna
      if (moderna) {
        if (!montado) montar()
        raiz.dataset.disposicao = 'moderna'
        nos.rodape.append(nos.barraConta()) // o MESMO botão da conta passa para o rodapé do trilho
        recolher(window.matchMedia(ESTREITA).matches)
        atualizar()
      } else {
        delete raiz.dataset.disposicao
        delete raiz.dataset.canais
        if (montado) document.querySelector('#barra').append(nos.barraConta())
      }
    },
    atualizar,
    /** Último erro de compilação/execução (ou null ao começar uma execução). */
    problema(erro) {
      problema = erro
      if (montado) atualizarProblemas()
    },
    /** Ao executar, o resultado aparece: volta para a aba Terminal. */
    aoExecutar() { if (montado) mostrarAba('terminal') },
  }
}
