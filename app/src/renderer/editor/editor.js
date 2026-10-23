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
import { defaultKeymap, history, historyKeymap, indentSelection, indentWithTab, redo, undo } from '@codemirror/commands'
import { HighlightStyle, StreamLanguage, bracketMatching, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { autocompletion, closeBrackets, completionKeymap, startCompletion } from '@codemirror/autocomplete'
import { cpp } from '@codemirror/lang-cpp'
import { javascript } from '@codemirror/lang-javascript'
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

// As cores vêm do tema (variáveis --sx-* em estilos/visualg.css).
const coresVisualg = HighlightStyle.define([
  { tag: t.comment, color: 'var(--sx-comentario)', fontStyle: 'italic' },
  { tag: [t.string, t.number, t.atom], color: 'var(--sx-literal)' },
  { tag: t.keyword, color: 'var(--sx-chave)' },
  { tag: t.macroName, color: 'var(--sx-especial)', textDecoration: 'underline' },
  { tag: t.typeName, color: 'var(--sx-tipo)', textDecoration: 'underline' },
  { tag: t.variableName, color: 'var(--sx-variavel)', fontWeight: 'bold' },
])

// C e C++: as mesmas variáveis de cor do tema, sem o sublinhado e o negrito do VisuAlg.
const coresC = HighlightStyle.define([
  { tag: t.comment, color: 'var(--sx-comentario)', fontStyle: 'italic' },
  { tag: [t.string, t.character, t.number, t.bool, t.null], color: 'var(--sx-literal)' },
  { tag: t.keyword, color: 'var(--sx-chave)', fontWeight: 'bold' },
  { tag: [t.processingInstruction, t.macroName], color: 'var(--sx-especial)' },
  { tag: t.typeName, color: 'var(--sx-tipo)' },
  { tag: t.variableName, color: 'var(--sx-variavel)' },
])

/** Realce, sugestões e recursos de edição de cada linguagem. */
const EXTENSOES = {
  portugol: () => [portugol, syntaxHighlighting(coresVisualg)],
  c: () => [cpp(), syntaxHighlighting(coresC), bracketMatching(), closeBrackets()],
  cpp: () => [cpp(), syntaxHighlighting(coresC), bracketMatching(), closeBrackets()],
  javascript: () => [javascript(), bracketMatching(), closeBrackets()],
  typescript: () => [javascript({ typescript: true }), bracketMatching(), closeBrackets()],
}

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

const comoOpcoes = (lista) => lista.map(([label, detail]) => ({ label, detail, type: 'keyword' }))
const SUGESTOES_C = [
  ['printf', 'printf("texto %d\\n", valor); — escreve na tela'], ['scanf', 'scanf("%d", &variavel); — lê do teclado'],
  ['puts', 'puts("texto"); — escreve e pula linha'], ['fgets', 'fgets(texto, tamanho, stdin); — lê uma linha'],
  ['getchar', 'getchar() — lê um caractere'], ['strlen', 'strlen(texto) — tamanho do texto (string.h)'],
  ['strcpy', 'strcpy(destino, origem) — copia texto'], ['strcmp', 'strcmp(a, b) — compara textos (0 = iguais)'],
  ['strcat', 'strcat(destino, origem) — junta textos'], ['malloc', 'malloc(n * sizeof(int)) — reserva memória (stdlib.h)'],
  ['free', 'free(ponteiro) — devolve a memória'], ['sqrt', 'sqrt(x) — raiz quadrada (math.h)'], ['pow', 'pow(base, expoente) (math.h)'],
  ['abs', 'abs(x) — valor absoluto'], ['rand', 'rand() % n — número aleatório'], ['srand', 'srand(time(NULL)); — sorteios diferentes a cada execução'],
  ['system', 'system("pause") ou system("cls")'], ['for', 'for (int i = 0; i < n; i++) { }'], ['while', 'while (condição) { }'],
  ['do', 'do { } while (condição);'], ['if', 'if (condição) { } else { }'], ['switch', 'switch (x) { case 1: break; default: break; }'],
  ['struct', 'struct Nome { int campo; };'], ['typedef', 'typedef struct { int campo; } Nome;'], ['return', 'return valor;'],
  ['int', 'número inteiro'], ['float', 'número real'], ['double', 'número real (mais precisão)'], ['char', 'caractere'],
  ['const', 'valor que não muda'], ['void', 'função sem retorno'],
]
const SUGESTOES_CPP = [
  ...SUGESTOES_C,
  ['cout', 'cout << valor << endl; — escreve na tela'], ['cin', 'cin >> variavel; — lê do teclado'],
  ['endl', 'fim de linha'], ['getline', 'getline(cin, texto); — lê uma linha inteira'], ['string', 'texto (#include <string>)'],
  ['vector', 'vector<int> v; — vetor que cresce (#include <vector>)'], ['push_back', 'v.push_back(x); — põe no fim do vetor'],
  ['size', 'v.size() — quantidade de elementos'], ['sort', 'sort(v.begin(), v.end()); (#include <algorithm>)'],
  ['map', 'map<string, int> m; (#include <map>)'], ['class', 'class Nome { public: ... };'], ['auto', 'tipo deduzido pelo compilador'],
  ['new', 'new Tipo — cria um objeto na memória'], ['delete', 'delete ponteiro; — destrói o objeto'],
]
const OPCOES_CTRL_J = { portugol: comoOpcoes(SUGESTOES), c: comoOpcoes(SUGESTOES_C), cpp: comoOpcoes(SUGESTOES_CPP) }

function fonteCtrlJ(contexto, linguagem) {
  const palavra = contexto.matchBefore(/[\p{L}_][\p{L}\p{N}_]*/u)
  if (!palavra && !contexto.explicit) return null
  return { from: palavra ? palavra.from : contexto.pos, options: OPCOES_CTRL_J[linguagem], validFor: /^[\p{L}_][\p{L}\p{N}_]*$/u }
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
  const linguagem = new Compartment()
  let linguagemAtual = 'portugol'

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
        linguagem.of(EXTENSOES.portugol()),
        autocompletion({ override: [(c) => fonteCtrlJ(c, linguagemAtual)], activateOnTyping: false, icons: false }),
        aparencia.of(temaFonte(prefs0)),
        somenteLeitura.of([]),
        keymap.of([
          // As abreviaturas do VisuAlg (dcn, escl...) só valem no Portugol.
          { key: 'Ctrl-Space', run: (v) => linguagemAtual === 'portugol' && autodigitar(v, op.prefs) },
          { key: 'Alt-Space', run: (v) => linguagemAtual === 'portugol' && autodigitar(v, op.prefs) },
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
    definirLinguagem(id) {
      linguagemAtual = EXTENSOES[id] ? id : 'portugol'
      view.dispatch({ effects: linguagem.reconfigure(EXTENSOES[linguagemAtual]()) })
    },
    corrigirIndentacao() {
      if (linguagemAtual !== 'portugol') {
        // C/C++: o recuo vem da própria gramática do CodeMirror (lang-cpp).
        const cursor = view.state.selection.main.head
        view.dispatch({ selection: EditorSelection.single(0, view.state.doc.length) })
        indentSelection(view)
        view.dispatch({ selection: EditorSelection.cursor(Math.min(cursor, view.state.doc.length)) })
        return
      }
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
