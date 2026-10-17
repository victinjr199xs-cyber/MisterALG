// Localizar (Ctrl+L / ⌘F), Próximo (F3), Anterior (F4) e Substituir
// (Ctrl+U / ⌥⌘F), com os diálogos do VisuAlg. O motor é @misteralg/editor-busca.

import { SearchSession } from '@misteralg/editor-busca/session'
import { wordAt } from '@misteralg/editor-busca'
import { el, janela } from './dialogos.js'

export function criarBusca(editor, { estado, mensagem }) {
  const sessao = new SearchSession()

  function sugestao() {
    const sel = editor.textoSelecionado()
    if (sel && !sel.includes('\n')) return sel
    return wordAt(editor.texto(), editor.selecao().start) || sessao.searchText
  }

  async function dialogo(substituindo) {
    const o = sessao.options
    const historico = (id, itens) => el('datalist', { id }, ...itens.map((v) => el('option', { value: v })))
    const procurar = el('input', { value: sugestao(), autofocus: true, spellcheck: false })
    procurar.setAttribute('list', 'hist-procurar')
    const trocar = el('input', { value: sessao.replaceText, spellcheck: false })
    trocar.setAttribute('list', 'hist-substituir')
    const caixa = (texto, marcado) => {
      const input = el('input', { type: 'checkbox', checked: marcado })
      return { input, label: el('label', {}, input, texto) }
    }
    const maiusc = caixa('Coincidir maiúsc./minusc.', o.matchCase)
    const palavra = caixa('Palavra inteira somente', o.wholeWord)
    const acentos = caixa('Ignorar acentos', o.ignoreAccents)
    const cursor = caixa('Procurar a partir do cursor', o.fromCaret && sessao.searchText !== '')
    const selecionado = caixa('Só o texto selecionado', o.selectedOnly)
    const regex = caixa('Expressão Regular', o.regex)
    const frente = el('input', { type: 'radio', name: 'direcao', checked: !o.backwards })
    const tras = el('input', { type: 'radio', name: 'direcao', checked: o.backwards })
    const sincronizar = () => { acentos.input.disabled = regex.input.checked }
    regex.input.addEventListener('change', sincronizar)
    sincronizar()
    procurar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        procurar.closest('dialog').close('ok')
      }
    })

    const corpo = el('div', {},
      el('label', { textContent: 'Procurar por:' }), procurar, historico('hist-procurar', sessao.searchHistory),
      substituindo ? el('label', { textContent: 'Substituir por :' }) : null,
      substituindo ? trocar : null,
      historico('hist-substituir', sessao.replaceHistory),
      el('div', { className: 'linhas-2' },
        el('fieldset', {}, el('legend', { textContent: ' Opções: ' }), maiusc.label, palavra.label, acentos.label, cursor.label, selecionado.label, regex.label),
        el('fieldset', {}, el('legend', { textContent: ' Direção: ' }), el('label', {}, frente, 'para Frente'), el('label', {}, tras, 'para Trás')),
      ),
    )
    const selecaoAntes = editor.selecao()
    const r = await janela({
      titulo: substituindo ? 'Substituir os textos' : 'Pesquisar o Texto',
      corpo,
      botoes: [{ valor: 'cancelar', texto: 'Cancela' }, { valor: 'ok', texto: 'OK', principal: true }],
      largura: '480px',
    })
    if (r !== 'ok' || !procurar.value) {
      editor.focar()
      return
    }
    sessao.remember({
      search: procurar.value,
      replace: substituindo ? trocar.value : sessao.replaceText,
      options: {
        matchCase: maiusc.input.checked,
        wholeWord: palavra.input.checked,
        ignoreAccents: acentos.input.checked && !regex.input.checked,
        fromCaret: cursor.input.checked,
        selectedOnly: selecionado.input.checked,
        regex: regex.input.checked,
        backwards: tras.checked,
      },
    }, selecaoAntes)
    if (substituindo) await substituir()
    else localizar({})
  }

  function localizar({ backwards, continuing = false }) {
    estado('Pesquisando')
    const r = sessao.find(editor.texto(), editor.selecao(), { backwards, continuing })
    estado()
    if (r.needsDialog) return dialogo(false)
    editor.selecionar(r.selection.start, r.selection.end)
    editor.focar()
    mensagem(r.found ? '' : r.message)
    return undefined
  }

  function confirmar({ text, match, replacement }) {
    // Mostra o texto com as trocas já feitas e seleciona a ocorrência atual.
    if (editor.texto() !== text) {
      const sel = { start: match.start, end: match.end }
      editor.view.dispatch({ changes: { from: 0, to: editor.view.state.doc.length, insert: text } })
      editor.selecionar(sel.start, sel.end)
    } else {
      editor.selecionar(match.start, match.end)
    }
    estado('Confirmando')
    const corpo = el('p', {}, 'Substituir ', el('b', { textContent: `"${match.text}"` }), ' por ', el('b', { textContent: `"${replacement}"` }), '?')
    return janela({
      titulo: 'Confirmar a substituição',
      corpo,
      botoes: [
        { valor: 'replace', texto: 'Sim', principal: true },
        { valor: 'skip', texto: 'Não' },
        { valor: 'cancel', texto: 'Cancela' },
        { valor: 'all', texto: 'Sim pra Todos' },
      ],
    }).then((v) => (v === 'cancelar' ? 'cancel' : v))
  }

  async function substituir() {
    estado('Substituindo')
    const original = editor.texto()
    const r = await sessao.replace(original, editor.selecao(), confirmar)
    estado()
    if (r.needsDialog) return dialogo(true)
    if (r.text !== editor.texto()) {
      editor.view.dispatch({ changes: { from: 0, to: editor.view.state.doc.length, insert: r.text } })
    }
    if (r.selection) editor.selecionar(r.selection.start, r.selection.end)
    editor.focar()
    mensagem(r.message)
    return undefined
  }

  return {
    localizar: () => dialogo(false),
    substituir: () => dialogo(true),
    proximo: () => localizar({ backwards: false, continuing: true }),
    anterior: () => localizar({ backwards: true, continuing: true }),
  }
}
