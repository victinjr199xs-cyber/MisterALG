// Disposição "moderna" da tela (preferência `disposicao`): faixa de guias de documentos, cabeçalho da página,
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

/**
 * @param op { api, t, doc, extensoes, faixa, fimFaixa, atualizarFaixa(), alturaSalva: number, gravarAltura(px) }
 */
export function criarDisposicao(op) {
  const raiz = document.documentElement
  const { t, doc } = op
  let montado = false
  let ativa = false
  let problema = null
  let passos = 0
  let nos = {}

  function montar() {
    montado = true
    const main = document.querySelector('main')
    const barraConta = () => document.querySelector('[data-id="conta"]')

    // Cabeçalho da página (estilo Notion): ícone, título e propriedades.
    nos.icone = h('span', { className: 'cab-icone' })
    nos.titulo = h('h1', { className: 'cab-titulo' })
    nos.propLinguagem = h('b')
    nos.propEstado = h('b')
    nos.pontoEstado = h('i', { className: 'cab-ponto' })
    const prop = (rotulo, ...valor) => h('li', { className: 'cab-prop' }, h('span', { textContent: rotulo }), ...valor)
    // Trilha do passo a passo (F8): o total de passos não é conhecido de antemão, então só "Passo N" e uma barrinha em movimento.
    nos.passoTexto = h('span', { className: 'cab-passo-texto' })
    nos.passo = h('div', { className: 'cab-passo', hidden: true }, nos.passoTexto, h('i', { className: 'cab-passo-barra' }))
    nos.passo.setAttribute('role', 'status')
    const cab = h('header', { id: 'cab-pagina', className: 'cab-pagina' },
      h('div', { className: 'cab-linha' }, nos.icone, nos.titulo),
      h('div', { className: 'cab-linha2' },
        h('ul', { className: 'cab-props' }, prop(t('Linguagem'), nos.propLinguagem), prop(t('Arquivo'), nos.pontoEstado, nos.propEstado)),
        nos.passo))

    // Divisor arrastável + abas do painel inferior.
    nos.divisor = h('div', { id: 'divisor', className: 'divisor', tabIndex: 0 })
    nos.divisor.setAttribute('role', 'separator')
    nos.cab = cab
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
    nos.abas = abas
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
    new MutationObserver(() => { nos.contador.textContent = String(document.querySelectorAll('#variaveis tbody tr:not(.memoria-vazia)').length) })
      .observe(document.querySelector('#variaveis tbody'), { childList: true })

    // Faixa de guias no topo da área central, acima do cabeçalho; o editor é o painel da guia ativa.
    const painelEditor = document.querySelector('.moldura-editor')
    painelEditor.id = 'editor-painel'
    painelEditor.setAttribute('role', 'tabpanel')
    main.prepend(op.faixa, cab)
    main.append(nos.divisor, abas, nos.problemas)
    nos.barraConta = barraConta
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
    let manual = op.alturaSalva > 0
    if (manual) altura(op.alturaSalva)
    // Sem altura escolhida: ~32% da área central (editor com pelo menos 200px, painel com pelo menos 120px).
    const automatica = () => {
      if (manual || !ativa) return
      const H = main.clientHeight
      if (!H) return
      const reserva = nos.cab.offsetHeight + nos.divisor.offsetHeight + nos.abas.offsetHeight + 200
      main.style.setProperty('--h-inferior', `${Math.max(120, Math.min(Math.round(H * 0.32), H - reserva))}px`)
    }
    new ResizeObserver(automatica).observe(main)
    nos.automatica = automatica
    const atual = () => nos.terminal.getBoundingClientRect().height
    let ultimo = 0
    nos.divisor.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      manual = true
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
      manual = true
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
    // Clicar (ou Enter) leva o cursor do editor até a linha do problema.
    const item = h('button', { type: 'button', className: 'problema', title: t('Ir para a linha do problema') },
      h('b', { textContent: t('Linha {0}', problema.linha ?? '?') }), h('span', { textContent: problema.mensagem ?? String(problema) }))
    item.addEventListener('click', () => op.irParaLinha?.(problema?.linha))
    nos.problemas.replaceChildren(item)
  }

  /** Chamado quando o documento muda (abrir, novo, salvar, editar, trocar de aba). */
  function atualizar() {
    if (!ativa) return
    const l = LINGUAGENS.find((x) => x.id === doc.linguagem) ?? LINGUAGENS[0]
    op.atualizarFaixa?.()
    nos.icone.innerHTML = ICONES_LINGUAGEM[l.id]
    nos.icone.style.setProperty('--cor', l.cor)
    nos.titulo.textContent = ARQUIVO(doc, op.extensoes)
    nos.propLinguagem.textContent = l.nome
    nos.propEstado.textContent = doc.modificado ? t('Modificado') : t('Salvo')
    nos.pontoEstado.dataset.estado = doc.modificado ? 'modificado' : 'salvo'
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
        op.fimFaixa.append(nos.barraConta()) // o MESMO botão da conta passa para o canto da faixa de guias
        atualizar()
        nos.automatica?.()
      } else {
        delete raiz.dataset.disposicao
        if (montado) document.querySelector('#barra').append(nos.barraConta())
      }
    },
    atualizar,
    /** Último erro de compilação/execução (ou null ao começar uma execução). */
    problema(erro) {
      problema = erro
      if (montado) atualizarProblemas()
    },
    /** Eventos da execução (execucao.aoEvento): conta as pausas (um passo cada) e some ao terminar. */
    passo(tipo) {
      if (!montado) return
      if (tipo === 'inicio') passos = 0
      if (tipo === 'inicio' || tipo === 'fim') nos.passo.hidden = true
      else if (tipo === 'pausa') {
        passos += 1
        nos.passoTexto.textContent = t('Passo {0}', passos)
        nos.passo.hidden = false
      }
    },
    /** Ao executar, o resultado aparece: volta para a aba Terminal. */
    aoExecutar() { if (montado) mostrarAba('terminal') },
  }
}
