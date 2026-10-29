// Menu "/" do editor, no estilo do Notion: "/" no começo de uma linha abre uma lista flutuante de blocos da linguagem.
// A lógica de filtro e de montagem do trecho está em barra-logica.js; os blocos, em blocos.js.

import { indentUnit, syntaxTree } from '@codemirror/language'
import { EditorSelection, Prec } from '@codemirror/state'
import { EditorView, ViewPlugin, keymap } from '@codemirror/view'
import { BLOCOS } from './blocos.js'
import { consultaValida, deveAbrir, filtrar, montarTrecho } from './barra-logica.js'

const ID_LISTA = 'barra-lista'
const LARGURA = 340

const h = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos)
  return e
}

/** Cursor dentro de string ou comentário (a árvore de sintaxe da linguagem diz). */
function emTextoOuComentario(state, pos) {
  const no = syntaxTree(state).resolveInner(pos, 1)
  for (let n = no; n; n = n.parent) if (/comment|string|template/i.test(n.name)) return true
  return false
}

const previa = (modelo) => modelo.replaceAll('|', '').replaceAll('\t', '  ').split('\n').slice(0, 3).join('\n')

/**
 * @param {{ ativo: () => boolean, linguagem: () => string, t?: (...a: any[]) => string }} op
 */
export function menuBarra(op) {
  const t = (...a) => (op.t ? op.t(...a) : a[0])

  const plugin = ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view
      this.estado = null // { de, consulta, todos, itens, ativo, no }
      this.fecharAoRolar = () => this.fechar()
      view.scrollDOM.addEventListener('scroll', this.fecharAoRolar, { passive: true })
    }

    update(u) {
      if (!this.estado) {
        if (u.docChanged) this.talvezAbrir(u)
        return
      }
      if (u.focusChanged && !this.view.hasFocus) return this.fechar()
      if (u.docChanged || u.selectionSet) {
        const de = u.changes.mapPos(this.estado.de, -1)
        const { state } = this.view
        const sel = state.selection.main
        const linha = state.doc.lineAt(de)
        const consulta = state.sliceDoc(de + 1, sel.head)
        const valido = sel.empty && state.sliceDoc(de, de + 1) === '/' && sel.head > de && sel.head <= linha.to && consultaValida(consulta)
        if (!valido) return this.fechar()
        this.estado.de = de
        if (consulta !== this.estado.consulta) {
          this.estado.consulta = consulta
          this.estado.itens = filtrar(this.estado.todos, consulta)
          this.estado.ativo = 0
          this.desenhar()
        }
      }
      if (u.geometryChanged || u.viewportChanged || u.docChanged) this.posicionar()
    }

    talvezAbrir(u) {
      if (!op.ativo()) return
      const blocos = BLOCOS[op.linguagem()]
      if (!blocos?.length) return
      let pos = -1
      let unico = true
      u.changes.iterChanges((deA, ateA, deB, ateB, texto) => {
        if (pos !== -1) unico = false
        if (deA === ateA && texto.toString() === '/') pos = deB
        else unico = false
      })
      if (!unico || pos < 0) return
      if (!u.transactions.some((tr) => tr.isUserEvent('input.type'))) return
      const { state } = this.view
      const sel = state.selection.main
      if (!sel.empty || sel.head !== pos + 1) return
      const linha = state.doc.lineAt(pos)
      if (!deveAbrir(state.sliceDoc(linha.from, pos), emTextoOuComentario(state, pos))) return
      this.abrir(pos, blocos)
    }

    abrir(de, blocos) {
      const lista = h('div', { id: ID_LISTA, className: 'barra-lista', role: 'listbox' })
      lista.setAttribute('aria-label', t('Blocos de código'))
      const no = h('div', { className: 'barra-menu' }, h('div', { className: 'barra-titulo', textContent: t('Blocos de código'), role: 'presentation' }), lista)
      no.addEventListener('mousedown', (e) => e.preventDefault()) // o foco fica no editor
      this.estado = { de, consulta: '', todos: blocos, itens: blocos, ativo: 0, no, lista }
      document.body.append(no)
      this.desenhar()
      const c = this.view.contentDOM
      c.setAttribute('aria-haspopup', 'listbox')
      c.setAttribute('aria-controls', ID_LISTA)
      c.setAttribute('aria-expanded', 'true')
      this.posicionar()
    }

    desenhar() {
      const e = this.estado
      e.lista.replaceChildren()
      if (!e.itens.length) e.lista.append(h('div', { className: 'barra-vazio', textContent: t('Nenhum bloco encontrado') }))
      e.itens.forEach((item, n) => {
        const linha = h('div', { className: 'barra-item', id: `barra-op-${n}`, role: 'option' })
        linha.setAttribute('aria-selected', String(n === e.ativo))
        linha.append(
          h('span', { className: 'barra-ico', textContent: item.icone }),
          h('span', { className: 'barra-txt' },
            h('b', { className: 'barra-nome', textContent: item.nome }),
            h('small', { className: 'barra-desc', textContent: t(item.desc) }),
            h('code', { className: 'barra-previa', textContent: previa(item.modelo) })),
        )
        linha.addEventListener('mousemove', () => { if (e.ativo !== n) this.mover(n) })
        linha.addEventListener('click', () => this.inserir(n))
        e.lista.append(linha)
      })
      this.atualizarAria()
    }

    atualizarAria() {
      const c = this.view.contentDOM
      if (this.estado?.itens.length) c.setAttribute('aria-activedescendant', `barra-op-${this.estado.ativo}`)
      else c.removeAttribute('aria-activedescendant')
    }

    mover(n, rolar = false) {
      const e = this.estado
      if (!e?.itens.length) return
      e.lista.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false')
      e.ativo = (n + e.itens.length) % e.itens.length
      const alvo = e.lista.querySelector(`#barra-op-${e.ativo}`)
      alvo?.setAttribute('aria-selected', 'true')
      if (rolar) alvo?.scrollIntoView({ block: 'nearest' })
      this.atualizarAria()
    }

    posicionar() {
      const e = this.estado
      if (!e) return
      const { view } = this
      view.requestMeasure({
        read: () => view.coordsAtPos(view.state.selection.main.head),
        write: (coords) => {
          if (!this.estado || !coords) return
          const no = this.estado.no
          const largura = Math.min(LARGURA, window.innerWidth - 16)
          no.style.width = `${largura}px`
          const rtl = getComputedStyle(document.documentElement).direction === 'rtl'
          const esquerda = Math.max(8, Math.min((rtl ? coords.left - largura : coords.left), window.innerWidth - largura - 8))
          const altura = no.offsetHeight
          let topo = coords.bottom + 4
          if (topo + altura > window.innerHeight - 8) topo = Math.max(8, coords.top - altura - 4)
          no.style.left = `${esquerda}px`
          no.style.top = `${topo}px`
        },
      })
    }

    inserir(n) {
      const e = this.estado
      const item = e?.itens[n]
      if (!item) return false
      const { view } = this
      const { state } = view
      const head = state.selection.main.head
      const linha = state.doc.lineAt(e.de)
      const recuo = /^\s*/.exec(linha.text)[0]
      const { texto, cursor } = montarTrecho(item.modelo, recuo, state.facet(indentUnit))
      this.fechar()
      view.dispatch({
        changes: { from: e.de, to: head, insert: texto },
        selection: EditorSelection.cursor(e.de + cursor),
        scrollIntoView: true,
        userEvent: 'input.complete',
      })
      view.focus()
      return true
    }

    fechar() {
      if (!this.estado) return false
      this.estado.no.remove()
      this.estado = null
      const c = this.view.contentDOM
      for (const a of ['aria-haspopup', 'aria-controls', 'aria-expanded', 'aria-activedescendant']) c.removeAttribute(a)
      return true
    }

    destroy() {
      this.fechar()
      this.view.scrollDOM.removeEventListener('scroll', this.fecharAoRolar)
    }
  })

  const comMenu = (fn) => (view) => {
    const p = view.plugin(plugin)
    return p?.estado ? fn(p) : false
  }
  const teclas = Prec.highest(keymap.of([
    { key: 'ArrowDown', run: comMenu((p) => (p.mover(p.estado.ativo + 1, true), true)) },
    { key: 'ArrowUp', run: comMenu((p) => (p.mover(p.estado.ativo - 1, true), true)) },
    { key: 'Enter', run: comMenu((p) => (p.estado.itens.length ? p.inserir(p.estado.ativo) : (p.fechar(), false))) },
    { key: 'Tab', run: comMenu((p) => (p.estado.itens.length ? p.inserir(p.estado.ativo) : (p.fechar(), false))) },
    { key: 'Escape', run: comMenu((p) => (p.fechar(), true)) },
  ]))

  return [plugin, teclas, EditorView.domEventHandlers({ blur: (_e, view) => { view.plugin(plugin)?.fechar(); return false } })]
}
