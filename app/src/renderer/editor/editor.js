// Editor de código (CodeMirror 6) configurado como o SynEdit do VisuAlg.

import { Compartment, EditorSelection, EditorState, RangeSet, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  GutterMarker,
  drawSelection,
  dropCursor,
  gutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { HighlightStyle, StreamLanguage, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { autocompletion, completionKeymap, startCompletion } from '@codemirror/autocomplete'
import { highlightSelectionMatches } from '@codemirror/search'
import { tags as t } from '@lezer/highlight'
import { FUNCOES, PALAVRAS_CHAVE, normalizar } from '@misteralg/interpreter'
import { corrigirIndentacao } from './indentacao.js'
import { MODELOS, SUGESTOES, cabecalho, expandir } from './modelos.js'

// ---- realce de sintaxe (cores do VISUALG30.INI padrão) ----------------------

const ESPECIAIS = new Set([
  'ALGORITMO', 'VAR', 'VARIAVEL', 'DECLARE', 'INICIO', 'FIMALGORITMO', 'FUNCAO', 'FIMFUNCAO',
  'PROCEDIMENTO', 'FIMPROCEDIMENTO', 'CONST', 'TIPO', 'REGISTRO', 'FIMREGISTRO',
])
const TIPOS = new Set(['INTEIRO', 'REAL', 'CARACTERE', 'CARACTER', 'LITERAL', 'LOGICO', 'NUMERICO'])
const CONSTANTES = new Set(['VERDADEIRO', 'FALSO', 'PI'])
const CHAVES = new Set([...PALAVRAS_CHAVE, ...FUNCOES.map((f) => f.toUpperCase()), 'ATE_QUE'])

const portugol = StreamLanguage.define({
  name: 'portugol',
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(/^"[^"]*"?/)) return 'string'
    if (stream.match(/^\d+(\.\d+)?/)) return 'number'
    const palavra = stream.match(/^[\p{L}_][\p{L}\p{N}_]*/u)
    if (palavra) {
      const n = normalizar(palavra[0])
      if (ESPECIAIS.has(n)) return 'macroName'
      if (TIPOS.has(n)) return 'typeName'
      if (CONSTANTES.has(n)) return 'atom'
      if (CHAVES.has(n)) return 'keyword'
      return 'variableName'
    }
    stream.next()
    return null
  },
  languageData: { commentTokens: { line: '//' } },
})

const coresVisualg = HighlightStyle.define([
  { tag: t.comment, color: '#008000', fontStyle: 'italic' },
  { tag: [t.string, t.number, t.atom], color: '#ff0000' },
  { tag: t.keyword, color: '#0000a0' },
  { tag: t.macroName, color: '#0000ff', textDecoration: 'underline' },
  { tag: t.typeName, color: '#800000', textDecoration: 'underline' },
  { tag: t.variableName, color: '#000000', fontWeight: 'bold' },
])

// ---- pontos de parada (calha + linha vermelha) ---------------------------

const alternarBp = StateEffect.define({ map: (v, m) => ({ pos: m.mapPos(v.pos), ligar: v.ligar }) })
const limparBps = StateEffect.define()

const marcadorBp = new (class extends GutterMarker {
  toDOM() {
    const d = document.createElement('div')
    d.className = 'cm-marcador-breakpoint'
    return d
  }
})()

const campoBps = StateField.define({
  create: () => RangeSet.empty,
  update(conjunto, tr) {
    let s = conjunto.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(limparBps)) s = RangeSet.empty
      else if (e.is(alternarBp)) {
        s = e.value.ligar
          ? s.update({ add: [marcadorBp.range(e.value.pos)] })
          : s.update({ filter: (de) => de !== e.value.pos })
      }
    }
    return s
  },
})

function linhasComBp(state) {
  const linhas = new Set()
  const it = state.field(campoBps).iter()
  while (it.value) {
    linhas.add(state.doc.lineAt(it.from).number)
    it.next()
  }
  return linhas
}

const decoBps = EditorView.decorations.compute([campoBps], (state) => {
  const linha = Decoration.line({ class: 'cm-linha-breakpoint' })
  return Decoration.set([...linhasComBp(state)].sort((a, b) => a - b).map((n) => linha.range(state.doc.line(n).from)))
})

// ---- linha em execução / linha com erro --------------------------------------

const definirRealce = StateEffect.define()
const campoRealce = StateField.define({
  create: () => ({ execucao: null, erro: null }),
  update(v, tr) {
    let r = tr.docChanged ? { ...v, erro: null } : v
    for (const e of tr.effects) if (e.is(definirRealce)) r = { ...r, ...e.value }
    return r
  },
  provide: (campo) => EditorView.decorations.compute([campo], (state) => {
    const { execucao, erro } = state.field(campo)
    const deco = []
    const total = state.doc.lines
    if (erro && erro <= total) deco.push(Decoration.line({ class: 'cm-linha-erro' }).range(state.doc.line(erro).from))
    if (execucao && execucao <= total) deco.push(Decoration.line({ class: 'cm-linha-execucao' }).range(state.doc.line(execucao).from))
    return Decoration.set(deco.sort((a, b) => a.from - b.from), true)
  }),
})

// ---- auto-digitação (Ctrl+Espaço) e sugestões (Ctrl+J) -----------------------

function autodigitar(view, prefs) {
  const { state } = view
  const cursor = state.selection.main.head
  const linha = state.doc.lineAt(cursor)
  const antes = linha.text.slice(0, cursor - linha.from)
  const m = /([!#]|[\p{L}_][\p{L}\p{N}_]*)$/u.exec(antes)
  if (!m) return true
  const abrev = m[1].toLowerCase()
  const modelo = abrev === '#' ? cabecalho(prefs()) : MODELOS[abrev]
  if (!modelo) return true
  const recuo = /^\s*/.exec(linha.text)[0]
  const { texto, cursor: pos } = expandir(modelo, recuo)
  const de = cursor - m[1].length
  view.dispatch({
    changes: { from: de, to: cursor, insert: texto },
    selection: EditorSelection.cursor(de + pos),
    scrollIntoView: true,
    userEvent: 'input.complete',
  })
  return true
}

const opcoesCtrlJ = SUGESTOES.map(([label, detail]) => ({ label, detail, type: 'keyword' }))

function fonteCtrlJ(contexto) {
  const palavra = contexto.matchBefore(/[\p{L}_][\p{L}\p{N}_]*/u)
  if (!palavra && !contexto.explicit) return null
  return { from: palavra ? palavra.from : contexto.pos, options: opcoesCtrlJ, validFor: /^[\p{L}_][\p{L}\p{N}_]*$/u }
}

// ---- criação do editor ---------------------------------------------------------

/**
 * @param parent elemento onde o editor é montado
 * @param op { prefs: () => prefs, aoMudar(), aoMoverCursor(linha, coluna), aoAlternarBreakpoint(linhas) }
 */
export function criarEditor(parent, op) {
  const somenteLeitura = new Compartment()
  const numeracao = new Compartment()
  const aparencia = new Compartment()

  const temaFonte = (prefs) => [
    EditorView.theme({
      '&': { fontSize: `${prefs.tamanho}px` },
      '.cm-content, .cm-gutter': {
        fontFamily: `'${prefs.fonte}', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'Courier New', monospace`,
      },
    }),
    EditorState.tabSize.of(prefs.tabulacao),
    indentUnit.of(' '.repeat(prefs.tabulacao)),
  ]

  const avisarBreakpoints = EditorView.updateListener.of((u) => {
    const mudouBp = u.transactions.some((tr) => tr.effects.some((e) => e.is(alternarBp) || e.is(limparBps)))
    if (mudouBp || (u.docChanged && u.startState.field(campoBps).size)) op.aoAlternarBreakpoint?.(linhasComBp(u.state))
    if (u.docChanged) op.aoMudar?.()
    if (u.selectionSet || u.docChanged) {
      const pos = u.state.selection.main.head
      const linha = u.state.doc.lineAt(pos)
      op.aoMoverCursor?.(linha.number, pos - linha.from + 1)
    }
  })

  function alternar(view, pos, ligar) {
    const linha = view.state.doc.lineAt(pos)
    const tem = linhasComBp(view.state).has(linha.number)
    view.dispatch({ effects: alternarBp.of({ pos: linha.from, ligar: ligar ?? !tem }) })
  }

  const prefs0 = op.prefs()
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        numeracao.of(prefs0.numerarLinhas ? lineNumbers() : []),
        gutter({
          class: 'cm-gutter-breakpoint',
          markers: (v) => v.state.field(campoBps),
          initialSpacer: () => marcadorBp,
          domEventHandlers: {
            mousedown(v, linha) {
              alternar(v, linha.from)
              return true
            },
          },
        }),
        campoBps,
        decoBps,
        campoRealce,
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        highlightSelectionMatches(),
        portugol,
        syntaxHighlighting(coresVisualg),
        autocompletion({ override: [fonteCtrlJ], activateOnTyping: false, icons: false }),
        aparencia.of(temaFonte(prefs0)),
        somenteLeitura.of([]),
        keymap.of([
          { key: 'Ctrl-Space', run: (v) => autodigitar(v, op.prefs) },
          { key: 'Alt-Space', run: (v) => autodigitar(v, op.prefs) },
          { key: 'Ctrl-j', run: startCompletion },
          { key: 'Mod-j', run: startCompletion },
          { key: 'Ctrl-g', run: () => (api.corrigirIndentacao(), true) },
          ...completionKeymap,
          indentWithTab,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        avisarBreakpoints,
        EditorView.contentAttributes.of({ spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
      ],
    }),
  })

  const api = {
    view,
    texto: () => view.state.doc.toString(),
    definirTexto(texto) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: texto },
        selection: EditorSelection.cursor(0),
        effects: [limparBps.of(null), definirRealce.of({ execucao: null, erro: null })],
      })
      view.scrollDOM.scrollTop = 0
    },
    selecao: () => ({ start: view.state.selection.main.from, end: view.state.selection.main.to }),
    selecionar(inicio, fim) {
      view.dispatch({ selection: EditorSelection.single(inicio, fim), scrollIntoView: true })
    },
    textoSelecionado: () => {
      const { from, to } = view.state.selection.main
      return view.state.sliceDoc(from, to)
    },
    inserir(texto) {
      view.dispatch(view.state.replaceSelection(texto))
      view.focus()
    },
    linhaDoCursor: () => view.state.doc.lineAt(view.state.selection.main.head).number,
    textoDaLinha: (n) => (n >= 1 && n <= view.state.doc.lines ? view.state.doc.line(n).text : ''),
    breakpoints: () => linhasComBp(view.state),
    alternarBreakpoint() {
      alternar(view, view.state.selection.main.head)
    },
    limparBreakpoints() {
      view.dispatch({ effects: limparBps.of(null) })
    },
    realcarExecucao(linha) {
      const efeitos = [definirRealce.of({ execucao: linha })]
      const dentro = linha && linha <= view.state.doc.lines
      view.dispatch({
        effects: dentro ? [...efeitos, EditorView.scrollIntoView(view.state.doc.line(linha).from, { y: 'nearest' })] : efeitos,
      })
    },
    realcarErro(linha) {
      const dentro = linha && linha <= view.state.doc.lines
      view.dispatch({
        effects: [
          definirRealce.of({ erro: linha }),
          ...(dentro ? [EditorView.scrollIntoView(view.state.doc.line(linha).from, { y: 'center' })] : []),
        ],
        selection: dentro ? EditorSelection.cursor(view.state.doc.line(linha).from) : undefined,
      })
    },
    somenteLeitura(sim) {
      view.dispatch({
        effects: somenteLeitura.reconfigure(sim ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
      })
    },
    aplicarPrefs(prefs) {
      view.dispatch({
        effects: [
          aparencia.reconfigure(temaFonte(prefs)),
          numeracao.reconfigure(prefs.numerarLinhas ? lineNumbers() : []),
        ],
      })
    },
    corrigirIndentacao() {
      const novo = corrigirIndentacao(api.texto(), op.prefs().tabulacao)
      if (novo !== api.texto()) {
        const linha = api.linhaDoCursor()
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: novo }, userEvent: 'input.indent' })
        const alvo = view.state.doc.line(Math.min(linha, view.state.doc.lines))
        view.dispatch({ selection: EditorSelection.cursor(alvo.from + /^\s*/.exec(alvo.text)[0].length) })
      }
    },
    desfazer: () => undo(view),
    refazer: () => redo(view),
    focar: () => view.focus(),
  }
  return api
}
