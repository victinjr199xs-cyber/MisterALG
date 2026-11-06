// Paleta de comandos (Ctrl+K ou Ctrl+Shift+P): uma busca única por comandos, temas, disposição, recentes e exemplos.
// Os rótulos são os mesmos do menu (traduzidos pela chave em português), os atalhos os mesmos da barra e do menu.

import { TEMAS, temaPorId } from '../compartilhado/temas.js'

// [id do comando em main.js, rótulo do menu (chave de tradução), atalho no Windows/Linux]
const COMANDOS = [
  ['novo', '&Novo', 'Ctrl+N'], ['abrir', '&Abrir…', 'Ctrl+A'], ['tela-inicial', '&Tela inicial'], ['salvar', '&Salvar', 'Ctrl+S'],
  ['salvar-como', 'Salvar &Como…', 'Ctrl+Alt+C'], ['imprimir', '&Imprimir…', 'Ctrl+P'],
  ['desfazer', '&Desfazer', 'Ctrl+Z'], ['refazer', '&Refazer', 'Ctrl+Shift+Z'], ['indentar', '&Indentação', 'Ctrl+G'],
  ['localizar', '&Localizar…', 'Ctrl+L'], ['localizar-proximo', 'Localizar o &Próximo', 'F3'], ['localizar-anterior', 'Localizar o &Anterior', 'F4'],
  ['substituir', 'S&ubstituir…', 'Ctrl+U'], ['gravar-bloco', '&Gravar bloco…', 'Ctrl+W'], ['inserir-bloco', 'I&nserir bloco…', 'Ctrl+R'],
  ['executar', 'Rodar o &Algoritmo', 'F9'], ['passo', 'Rodar &Passo a passo', 'F8'], ['timer', 'Rodar com Tempo', 'Shift+F9'],
  ['parar', '&Parar  (stop)', 'Ctrl+F2'], ['breakpoint', '&Liga/desliga breakpoint', 'F5'], ['limpar-breakpoints', '&Desmarcar todas (os breakpoints)', 'Ctrl+F5'],
  ['linhas', 'Linhas (Ativa/Desativa)'], ['aleatorio', '&Gerar valores aleatórios'], ['perfil', 'Per&fil', 'F7'], ['pilha', '&Pilha de ativação', 'Ctrl+F3'],
  ['exportar-pascal', 'a Linguagem &Pascal…'], ['exportar-c', 'a Linguagem &C / C++'], ['exportar-java', 'a Linguagem &Java'],
  ['configuracoes', '&Configurações', 'Ctrl+,'], ['configurar-cores', 'Personalizar as cores do código…'],
  ['assistente', 'Assistente de &IA', 'Ctrl+I'], ['configurar-ia', 'Configurar o assistente de IA…'],
  ['calculadora', '&A Calculadora'], ['calendario', '&O Calendário'],
  ['ajuda-tela', 'A &Tela do MisterALG', 'F1'], ['ajuda-linguagem', 'A &Linguagem (Portugol)', 'Ctrl+H'], ['ajuda-referencia', '&Referência da Linguagem', 'Ctrl+Alt+H'],
  ['tutorial', 'T&utorial do MisterALG'], ['dica', '&Dica do dia'], ['atualizacoes', '&Procurar atualizações…'], ['termos', '&Termos de uso e privacidade'],
  ['sobre', 'Sobre o MisterALG'],
]

/** Sem acento, sem caixa e sem os "&" de atalho do menu: é o que a busca compara. */
const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const limpar = (s) => s.replace(/\(&.\)/g, '').replace(/&/g, '').replace(/\s+/g, ' ').trim()

const h = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos)
  return e
}

/**
 * Liga o atalho e devolve `{ abrir, fechar, aberta }`.
 * @param {{api: object, rodar: (id:string, dados?:any)=>void, t: (...a:any[])=>string, prefs: ()=>object, aplicarDisposicao: (d:string)=>Promise<void>}} op
 */
export function criarPaleta(op) {
  const ehMac = op.api.plataforma === 'darwin'
  const atalhoDe = (a) => (a && ehMac ? a.replace('Ctrl+Alt+', '⌥⌘').replace('Ctrl+Shift+', '⇧⌘').replace('Ctrl+', '⌘') : a)
  let no = null // { caixa, campo, lista, anterior }
  let itens = [] // [{ grupo, rotulo, dica, amostra, atalho, acao }] já filtrados
  let ativo = 0
  let todos = []
  let pedido = 0

  async function montarItens() {
    const t = op.t
    const prefs = op.prefs()
    const lista = COMANDOS.map(([id, chave, atalho]) => ({ grupo: t('Comandos'), rotulo: limpar(t(chave)), atalho: atalhoDe(atalho), acao: () => op.rodar(id) }))
    const temas = TEMAS.map((tema) => ({
      grupo: t('Temas'), rotulo: t('Tema: {0}', t(tema.nome)), amostra: tema.amostra[0], atual: tema.id === temaPorId(prefs.tema).id, acao: () => op.rodar('tema', tema.id),
    }))
    const moderna = prefs.disposicao !== 'classica'
    const disposicao = [
      ...(moderna ? [{ grupo: t('Disposição'), rotulo: t('Disposição clássica'), acao: () => op.aplicarDisposicao('classica') }] : []),
      ...(moderna ? [] : [{ grupo: t('Disposição'), rotulo: t('Disposição moderna'), acao: () => op.aplicarDisposicao('moderna') }]),
    ]
    const abas = op.abas?.() // só na disposição moderna (a clássica não tem guias)
    const deAbas = abas ? [
      { grupo: t('Comandos'), rotulo: t('Nova aba'), acao: () => op.rodar('nova-aba') },
      { grupo: t('Comandos'), rotulo: t('Fechar aba'), atalho: atalhoDe('Ctrl+W'), acao: () => op.rodar('fechar-aba') },
      ...abas.map((a) => ({ grupo: t('Documentos abertos'), rotulo: t('Aba: {0}', a.nome), atual: a.ativa, acao: () => op.rodar('ir-aba', a.id) })),
    ] : []
    const nome = (c) => c.split(/[\\/]/).pop()
    const recentes = (prefs.mru ?? []).map((c) => ({ grupo: t('Recentes'), rotulo: nome(c), dica: c, acao: () => op.rodar('abrir-recente', c) }))
    let exemplos = []
    try {
      const grupos = await op.api.exemplos.listar()
      exemplos = grupos.flatMap((g) => g.arquivos.map((arquivo) => ({
        grupo: t('Exemplos'), rotulo: t('Exemplo: {0}', arquivo), dica: g.nome,
        acao: async () => { const r = await op.api.exemplos.ler({ grupo: g.id, arquivo }); if (r) op.rodar('exemplo', r) },
      })))
    } catch { /* sem exemplos: a paleta segue com o resto */ }
    return [...lista, ...deAbas, ...temas, ...disposicao, ...recentes, ...exemplos].map((i) => ({ ...i, busca: normalizar(`${i.rotulo} ${i.grupo} ${i.dica ?? ''}`) }))
  }

  function filtrar(texto) {
    const partes = normalizar(texto).split(/\s+/).filter(Boolean)
    if (!partes.length) return todos.slice(0, 80)
    // menos pontos = melhor: começo do texto, depois início de palavra (Noite antes de Meia-noite), depois qualquer lugar
    const pontos = (i) => partes.reduce((s, p) => s + (i.busca.startsWith(p) ? 0 : i.busca.includes(` ${p}`) ? 1 : 2), 0)
    return todos.filter((i) => partes.every((p) => i.busca.includes(p))).sort((a, b) => pontos(a) - pontos(b)).slice(0, 80)
  }

  function desenhar() {
    const t = op.t
    no.lista.replaceChildren()
    if (!itens.length) no.lista.append(h('div', { className: 'paleta-vazio', textContent: t('Nenhum resultado') }))
    let grupo = null
    itens.forEach((i, n) => {
      if (i.grupo !== grupo) { grupo = i.grupo; no.lista.append(h('div', { className: 'paleta-grupo', textContent: grupo, role: 'presentation' })) }
      const linha = h('div', { className: 'paleta-item', id: `paleta-op-${n}`, role: 'option' })
      linha.setAttribute('aria-selected', String(n === ativo))
      if (i.amostra) linha.append(h('i', { className: 'paleta-amostra', style: `background:${i.amostra}` }))
      linha.append(h('span', { className: 'paleta-rotulo', textContent: i.rotulo }))
      if (i.dica) linha.append(h('small', { className: 'paleta-dica', textContent: i.dica }))
      if (i.atual) linha.append(h('small', { className: 'paleta-dica', textContent: '✓' }))
      if (i.atalho) linha.append(h('kbd', { className: 'paleta-atalho', textContent: i.atalho }))
      linha.addEventListener('mousemove', () => { if (ativo !== n) mover(n) })
      linha.addEventListener('click', () => escolher(n))
      no.lista.append(linha)
    })
    no.campo.setAttribute('aria-activedescendant', itens.length ? `paleta-op-${ativo}` : '')
  }

  function mover(n, rolar = false) {
    if (!itens.length) return
    no.lista.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false')
    ativo = (n + itens.length) % itens.length
    const alvo = no.lista.querySelector(`#paleta-op-${ativo}`)
    alvo?.setAttribute('aria-selected', 'true')
    if (rolar) alvo?.scrollIntoView({ block: 'nearest' })
    no.campo.setAttribute('aria-activedescendant', `paleta-op-${ativo}`)
  }

  function escolher(n) {
    const item = itens[n]
    if (!item) return
    fechar()
    void item.acao()
  }

  function fechar() {
    if (!no) return
    const { caixa, anterior } = no
    no = null
    caixa.remove()
    if (anterior?.isConnected) anterior.focus({ preventScroll: true })
  }

  async function abrir() {
    if (no || document.querySelector('dialog[open], .tutorial')) return
    const t = op.t
    const anterior = document.activeElement
    const campo = h('input', { type: 'text', className: 'paleta-campo', placeholder: t('Digite um comando, tema ou exemplo…'), autocomplete: 'off', spellcheck: false })
    campo.setAttribute('role', 'combobox')
    campo.setAttribute('aria-expanded', 'true')
    campo.setAttribute('aria-controls', 'paleta-lista')
    campo.setAttribute('aria-autocomplete', 'list')
    campo.setAttribute('aria-label', t('Paleta de comandos'))
    const lista = h('div', { className: 'paleta-lista', id: 'paleta-lista', role: 'listbox' })
    lista.setAttribute('aria-label', t('Paleta de comandos'))
    const rodape = h('div', { className: 'paleta-rodape' },
      h('span', {}, h('kbd', { textContent: '↑↓' }), ` ${t('navegar')}`), h('span', {}, h('kbd', { textContent: 'Enter' }), ` ${t('selecionar')}`), h('span', {}, h('kbd', { textContent: 'Esc' }), ` ${t('fechar')}`))
    const janela = h('div', { className: 'paleta', role: 'dialog' }, h('div', { className: 'paleta-busca' }, campo), lista, rodape)
    janela.setAttribute('aria-modal', 'true')
    janela.setAttribute('aria-label', t('Paleta de comandos'))
    const caixa = h('div', { className: 'paleta-fundo' }, janela)
    caixa.addEventListener('mousedown', (e) => { if (e.target === caixa) { e.preventDefault(); fechar() } })
    caixa.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); mover(ativo + 1, true) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mover(ativo - 1, true) }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); mover(e.key === 'Home' ? 0 : itens.length - 1, true) }
      else if (e.key === 'Enter') { e.preventDefault(); escolher(ativo) }
      else if (e.key === 'Tab') { e.preventDefault(); campo.focus() } // foco preso: o campo é o único alvo
    })
    campo.addEventListener('input', () => { ativo = 0; itens = filtrar(campo.value); desenhar() })
    no = { caixa, campo, lista, anterior }
    const meu = ++pedido
    document.body.append(caixa)
    campo.focus()
    const feitos = await montarItens()
    if (!no || meu !== pedido) return
    todos = feitos
    ativo = 0
    itens = filtrar(campo.value)
    desenhar()
  }

  // Captura: vale mesmo com o foco no editor (Ctrl+K e Ctrl+Shift+P, também ⌘ no Mac).
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    const mod = e.ctrlKey || e.metaKey
    if (!mod || e.altKey || !((k === 'k' && !e.shiftKey) || (k === 'p' && e.shiftKey))) return
    e.preventDefault()
    e.stopPropagation()
    if (no) fechar()
    else void abrir()
  }, true)

  return { abrir, fechar, aberta: () => Boolean(no) }
}
