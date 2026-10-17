// IDE do MisterALG: junta editor, execução, busca, arquivos, barra e menus.

import { abrirAjuda } from './ajuda.js'
import { criarBusca } from './busca.js'
import * as dialogos from './dialogos.js'
import { criarEditor } from './editor/editor.js'
import { esqueleto } from './editor/modelos.js'
import { INTERVALOS, criarExecucao } from './execucao.js'
import { ICONES } from './icones.js'
import { TEMAS, temaPorId } from '../compartilhado/temas.js'

const api = window.misteralg
const $ = (sel) => document.querySelector(sel)
const VERSAO = '1.5.0'
// Termos de uso: o mesmo texto que o instalador do Windows exibe (app/build/termos.txt).
import TEXTO_TERMOS from '../../build/termos.txt?raw'
const TERMOS = TEXTO_TERMOS.replace(/^﻿/, '').replace(/\r\n/g, '\n')
const VERSAO_TERMOS = '1.4'

let prefs = await api.prefs.ler()
const aplicarTema = (id) => { document.documentElement.dataset.tema = temaPorId(id).id }
aplicarTema(prefs.tema)
const doc = { caminho: null, nome: 'semnome', codificacao: 'windows-1252', modificado: false }
let aleatorioLigado = false

// ---- barra de status -----------------------------------------------------------

const status = {
  posicao: (l, c) => { $('#st-posicao').textContent = `${l}:${c}` },
  estado(texto) {
    $('#st-estado').textContent = texto ?? (doc.modificado ? 'Modificado' : '')
  },
  mensagem(texto) { $('#st-mensagem').textContent = texto ?? '' },
}

// Painel 4: " MENSAGEM: " + a dica do elemento sob o mouse (como o hint do Delphi).
document.addEventListener('mouseover', (e) => {
  const alvo = e.target.closest('[data-dica]')
  if (alvo) status.mensagem(` MENSAGEM: ${alvo.dataset.dica}`)
})

// ---- documento -------------------------------------------------------------------

function atualizarTitulo() {
  const arquivo = doc.caminho ? doc.caminho.split(/[\\/]/).pop() : doc.nome
  $('#titulo-editor').textContent = `Área dos algoritmos ( Edição do código fonte ) -> Nome do arquivo: [${arquivo}]`
  api.janela.titulo(`MisterALG — ${arquivo}${doc.modificado ? ' (modificado)' : ''}`)
  status.estado()
}

function marcarModificado() {
  if (!doc.modificado) {
    doc.modificado = true
    atualizarTitulo()
  }
}

let execucao = null // criada logo abaixo; o editor precisa existir antes
const editor = criarEditor($('#editor'), {
  prefs: () => prefs,
  aoMudar: marcarModificado,
  aoMoverCursor: status.posicao,
  aoAlternarBreakpoint: (linhas) => execucao?.atualizarBreakpoints(linhas),
})

function carregar({ texto, caminho = null, codificacao = 'windows-1252', nome = 'semnome' }) {
  execucao.restaurar()
  editor.definirTexto(texto)
  Object.assign(doc, { caminho, codificacao, nome, modificado: false })
  atualizarTitulo()
  editor.focar()
}

/** Pergunta se deve salvar. Devolve false se o usuário cancelou. */
async function podeDescartar(titulo) {
  if (!doc.modificado) return true
  const r = await api.mensagem({
    type: 'question',
    title: titulo,
    message: `O algoritmo [${doc.nome}] foi modificado. Deseja salvá-lo ?`,
    buttons: ['Sim', 'Não', 'Cancelar'],
    defaultId: 0,
    cancelId: 2,
  })
  if (r === 2) return false
  if (r === 0) return salvar()
  return true
}

async function salvar(comoNovo = false) {
  const texto = editor.texto()
  let r
  if (!doc.caminho || comoNovo) r = await api.arquivo.salvarComo({ texto, nome: doc.nome, codificacao: doc.codificacao })
  else r = await api.arquivo.salvar({ caminho: doc.caminho, texto, codificacao: doc.codificacao })
  if (!r) return false
  doc.caminho = r.caminho
  doc.codificacao = r.codificacao
  doc.nome = r.caminho.split(/[\\/]/).pop().replace(/\.[^.]+$/, '')
  doc.modificado = false
  atualizarTitulo()
  status.mensagem(' MENSAGEM: Pronto! * Este algoritmo está salvo *')
  api.recuperacao.limpar()
  return true
}

async function abrirResultado(lido) {
  if (!lido) return
  if (lido.erro) {
    await api.mensagem({ type: 'warning', title: 'Pesquisa de algoritmo no MisterALG', message: lido.erro })
    return
  }
  carregar({ ...lido, nome: lido.caminho.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') })
}

const pastaAtual = () => (doc.caminho ? doc.caminho.replace(/[\\/][^\\/]*$/, '') : null)

// ---- execução e busca ---------------------------------------------------------------

execucao = criarExecucao({
  editor,
  status,
  configuracao: () => ({
    timerMs: INTERVALOS[prefs.timer]?.[1] ?? 450,
    aleatorio: aleatorioLigado
      ? { min: Number(prefs.aleatorio.de) || 0, max: Number(prefs.aleatorio.ate) || 100, casas: Number(prefs.aleatorio.decimais) || undefined }
      : null,
    arquivos: {
      ler: (nome) => api.dados.ler(nome, pastaAtual()),
      anexar: (nome, linha) => api.dados.anexar(nome, pastaAtual(), linha),
    },
  }),
  aoMudarEstado: (rodando) => {
    api.menu.estado({ executando: rodando })
    for (const id of ['parar']) $(`[data-id="${id}"]`).disabled = !rodando
  },
})

const busca = criarBusca(editor, { estado: status.estado, mensagem: (m) => status.mensagem(m ? ` MENSAGEM: ${m}` : '') })

// ---- comandos (menu, barra e atalhos usam a mesma tabela) ------------------------------

const comandos = {
  novo: async () => {
    if (await podeDescartar(' Incluir um novo algoritmo no MisterALG ')) carregar({ texto: esqueleto(prefs) })
  },
  abrir: async () => {
    if (await podeDescartar(' Abrir um algoritmo no MisterALG ')) abrirResultado(await api.arquivo.abrir())
  },
  'abrir-recente': async (caminho) => {
    if (await podeDescartar(' Abrir um algoritmo no MisterALG ')) abrirResultado(await api.arquivo.abrirCaminho(caminho))
  },
  salvar: () => salvar(false),
  'salvar-como': () => salvar(true),
  imprimir: () => {
    const escapar = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
    const html = `<!doctype html><meta charset="utf-8"><title>${escapar(doc.nome)}</title>
      <style>body{font:11pt Menlo,monospace}pre{white-space:pre-wrap}</style>
      <pre>// Arquivo com um algoritmo: ${escapar(doc.caminho ?? doc.nome)}\n// Data de impressão: ${new Date().toLocaleString('pt-BR')}\n\n${escapar(editor.texto())}</pre>`
    return api.imprimir({ html })
  },
  sair: async () => {
    if (execucao.emExecucao()) execucao.parar()
    if (await podeDescartar(' Encerrando o algoritmo e fechando o MisterALG ')) api.janela.fechar()
  },
  desfazer: () => (document.activeElement?.closest('.cm-editor') ? editor.desfazer() : document.execCommand('undo')),
  refazer: () => (document.activeElement?.closest('.cm-editor') ? editor.refazer() : document.execCommand('redo')),
  cortar: () => { editor.focar(); api.editar('cut') },
  copiar: () => { editor.focar(); api.editar('copy') },
  colar: () => { editor.focar(); api.editar('paste') },
  indentar: () => editor.corrigirIndentacao(),
  localizar: () => busca.localizar(),
  'localizar-proximo': () => busca.proximo(),
  'localizar-anterior': () => busca.anterior(),
  substituir: () => busca.substituir(),
  'gravar-bloco': async () => {
    const texto = editor.textoSelecionado()
    if (texto) await api.arquivo.gravarBloco(texto)
  },
  'inserir-bloco': async () => {
    const texto = await api.arquivo.inserirBloco()
    if (texto !== null) editor.inserir(texto)
  },
  executar: () => execucao.iniciar('continuo'),
  passo: () => execucao.iniciar('passo'),
  timer: () => execucao.iniciar('timer'),
  parar: () => execucao.parar(),
  breakpoint: () => editor.alternarBreakpoint(),
  'limpar-breakpoints': () => editor.limparBreakpoints(),
  restaurar: () => execucao.restaurar(),
  linhas: async () => {
    prefs = await api.prefs.gravar({ numerarLinhas: !prefs.numerarLinhas })
    editor.aplicarPrefs(prefs)
  },
  aleatorio: () => alternarAleatorio(),
  perfil: () => execucao.mostrarPerfil(),
  pilha: () => execucao.mostrarPilha(),
  'exportar-pascal': () => api.mensagem({ type: 'info', title: 'MisterALG', message: 'A ser implementado em futuras versões.' }),
  configuracoes: async () => {
    const novas = await dialogos.configuracoes(prefs, { temas: TEMAS, aoPrever: aplicarTema })
    if (novas) {
      prefs = await api.prefs.gravar(novas)
      editor.aplicarPrefs(prefs)
    }
    aplicarTema(prefs.tema)
  },
  tema: async (id) => {
    aplicarTema(id)
    prefs = await api.prefs.gravar({ tema: temaPorId(id).id })
  },
  calculadora: () => dialogos.calculadora(),
  calendario: () => dialogos.calendario(),
  'ajuda-tela': () => abrirAjuda('tela'),
  'ajuda-linguagem': () => abrirAjuda('linguagem'),
  'ajuda-referencia': () => abrirAjuda('referencia'),
  sobre: () => dialogos.sobre(VERSAO),
  termos: () => dialogos.termos(TERMOS),
}

// Com um diálogo aberto só valem os comandos de edição de texto.
const PERMITIDOS_COM_DIALOGO = new Set(['desfazer', 'refazer', 'cortar', 'copiar', 'colar', 'sair'])

function rodar(id, dados) {
  if (document.querySelector('dialog[open]') && !PERMITIDOS_COM_DIALOGO.has(id)) return
  comandos[id]?.(dados)
}

api.menu.aoComando(rodar)

// ---- barra de ferramentas -----------------------------------------------------------

const BARRA = [
  ['novo', 'novo', 'Botão Novo (⌘N)'],
  ['abrir', 'abrir', 'Botão Abrir (⌘O)'],
  ['salvar', 'salvar', 'Botão Salvar (⌘S)'],
  '|',
  ['executar', 'executar', 'Botão Executar (F9)'],
  ['passo', 'passo', 'Botão Passo a Passo (F8)'],
  ['timer', 'timer', 'Executar com Timer (Tempo) (Shift+F9)'],
  'intervalo',
  '|',
  ['parar', 'parar', 'Botão Parar (Ctrl+F2)'],
  ['breakpoint', 'breakpoint', 'Botão Liga/desliga breakpoint (F5)'],
  ['limpar-breakpoints', 'limparBreakpoints', 'Botão Desmarca todos os breakpoints (Ctrl+F5)'],
  ['restaurar', 'restaurar', 'Botão Restaura a tela inicial do MisterALG'],
  ['cortar', 'cortar', 'Botão Cortar (⌘X)'],
  ['copiar', 'copiar', 'Botão Copiar (⌘C)'],
  ['colar', 'colar', 'Botão Colar (⌘V)'],
  '|',
  ['gravar-bloco', 'gravarBloco', 'Botão Grava o bloco de texto selecionado (Ctrl+W)'],
  ['inserir-bloco', 'inserirBloco', 'Botão Insere um bloco de algoritmo na posição do cursor (Ctrl+R)'],
  ['desfazer', 'desfazer', 'Botão Desfazer (⌘Z)'],
  ['refazer', 'refazer', 'Botão Refazer (Shift+⌘Z)'],
  '|',
  ['localizar', 'localizar', 'Botão Localizar (⌘F ou Ctrl+L)'],
  ['localizar-proximo', 'proximo', 'Botão Localizar o próximo (F3)'],
  ['localizar-anterior', 'anterior', 'Botão Localizar o anterior (F4)'],
  ['substituir', 'substituir', 'Botão Substituir (⌥⌘F ou Ctrl+U)'],
  ['indentar', 'indentar', 'Botão Corrigir indentação (Ctrl+G)'],
  ['imprimir', 'imprimir', 'Botão Imprimir (⌘P)'],
  ['perfil', 'perfil', 'Botão Perfil (F7)'],
  ['aleatorio', 'aleatorio', 'Botão Ativa/Desativa Aleatório'],
  'faixa',
  '|',
  ['pilha', 'pilha', 'Botão Mostra a pilha de ativação dos procedimentos e funções (Ctrl+F3)'],
  ['calculadora', 'calculadora', 'Mostra uma calculadora prática'],
  ['calendario', 'calendario', 'Mostra um calendário do ano atual'],
  ['ajuda-tela', 'ajuda', 'Botão Ajuda on-line (F1)'],
  ['sair', 'sair', 'Sair do MisterALG'],
]

const ehMac = api.plataforma === 'darwin'

/** No Windows as dicas mostram os atalhos originais do VisuAlg em vez dos do Mac. */
function dicaDaPlataforma(dica) {
  if (ehMac) return dica
  return dica
    .replace(' (⌘F ou Ctrl+L)', ' (Ctrl+L)')
    .replace(' (⌥⌘F ou Ctrl+U)', ' (Ctrl+U)')
    .replace('⌘O', 'Ctrl+A')
    .replace('⌘', 'Ctrl+')
}

function montarBarra() {
  const barra = $('#barra')
  for (const item of BARRA) {
    if (item === '|') {
      barra.append(Object.assign(document.createElement('span'), { className: 'separador' }))
    } else if (item === 'intervalo') {
      const sel = document.createElement('select')
      sel.id = 'intervalo'
      sel.dataset.dica = 'Intervalo do timer'
      sel.title = 'Intervalo do timer'
      INTERVALOS.forEach(([rotulo], i) => sel.append(new Option(rotulo, String(i), false, i === prefs.timer)))
      sel.addEventListener('change', async () => { prefs = await api.prefs.gravar({ timer: Number(sel.value) }) })
      const span = Object.assign(document.createElement('span'), { className: 'campo-barra' })
      span.append(sel)
      barra.append(span)
    } else if (item === 'faixa') {
      const campo = (rotulo, chave, dica, opcoes) => {
        const span = Object.assign(document.createElement('span'), { className: 'campo-barra' })
        span.dataset.dica = dica
        const lab = document.createElement('label')
        lab.textContent = rotulo
        let input
        if (opcoes) {
          input = document.createElement('select')
          opcoes.forEach((o) => input.append(new Option(String(o), String(o), false, String(o) === String(prefs.aleatorio[chave]))))
        } else {
          input = Object.assign(document.createElement('input'), { value: prefs.aleatorio[chave], inputMode: 'decimal' })
        }
        input.id = `aleatorio-${chave}`
        input.title = dica
        input.disabled = true
        input.addEventListener('change', async () => {
          prefs = await api.prefs.gravar({ aleatorio: { ...prefs.aleatorio, [chave]: input.value } })
        })
        lab.htmlFor = input.id
        span.append(lab, input)
        barra.append(span)
      }
      campo('De:', 'de', 'Digita o valor aleatório inicial')
      campo('Até:', 'ate', 'Digita o valor aleatório final')
      campo('Decimais:', 'decimais', 'Digita as casas decimais do valor aleatório', [0, 1, 2, 3, 4, 5])
    } else {
      const [id, icone] = item
      const dica = dicaDaPlataforma(item[2])
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'botao'
      b.dataset.id = id
      b.dataset.dica = dica
      b.title = dica
      b.setAttribute('aria-label', dica)
      b.innerHTML = ICONES[icone]
      b.addEventListener('click', () => rodar(id))
      if (id === 'aleatorio') b.setAttribute('aria-pressed', 'false')
      if (id === 'parar') b.disabled = true
      barra.append(b)
    }
  }
}

function alternarAleatorio() {
  aleatorioLigado = !aleatorioLigado
  $('[data-id="aleatorio"]').setAttribute('aria-pressed', String(aleatorioLigado))
  for (const c of ['de', 'ate', 'decimais']) $(`#aleatorio-${c}`).disabled = !aleatorioLigado
  api.menu.estado({ aleatorio: aleatorioLigado })
}

// ---- atalhos originais do VisuAlg que não estão no menu do Mac ----------------------------

document.addEventListener('keydown', (e) => {
  const comando = (() => {
    if (e.key === 'Escape') return execucao.teclaEsc() ? 'nada' : null
    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      const k = e.key.toLowerCase()
      if (k === 'l') return 'localizar'
      if (k === 'u') return 'substituir'
    }
    if (e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'g') return e.shiftKey ? 'localizar-anterior' : 'localizar-proximo'
    return null
  })()
  if (!comando) return
  e.preventDefault()
  if (comando !== 'nada') rodar(comando)
})

$('#console-fechar').addEventListener('click', () => (execucao.emExecucao() ? execucao.parar() : execucao.fecharConsole()))

// ---- recuperação após falha (visualg3.tmp) ------------------------------------------------

setInterval(() => {
  if (doc.modificado) api.recuperacao.gravar({ texto: editor.texto(), caminho: doc.caminho, nome: doc.nome, codificacao: doc.codificacao })
}, 5000)

// ---- início ----------------------------------------------------------------------------------

montarBarra()
editor.aplicarPrefs(prefs)

// No Windows instalado, os termos já foram aceitos no instalador. No Mac, no
// Linux e na versão portátil, o aceite acontece aqui, na primeira abertura.
const precisaAceiteNoApp = ehMac || api.plataforma === 'linux' || api.portatil
if (precisaAceiteNoApp && prefs.termosAceitos !== VERSAO_TERMOS) {
  if (await dialogos.termos(TERMOS, true)) {
    prefs = await api.prefs.gravar({ termosAceitos: VERSAO_TERMOS })
  } else {
    await api.janela.fechar()
  }
}

const pendente = await api.arquivoPendente()
const recuperado = await api.recuperacao.ler()
if (pendente) {
  carregar({ texto: esqueleto(prefs) })
  await abrirResultado(await api.arquivo.abrirCaminho(pendente))
} else if (recuperado?.texto) {
  const r = await api.mensagem({
    type: 'question',
    title: 'Falha!',
    message: 'O MisterALG não foi terminado corretamente da última vez que foi executado. Deseja recuperar o algoritmo que estava sendo editado?',
    buttons: ['Sim', 'Não'],
    defaultId: 0,
    cancelId: 1,
  })
  if (r === 0) {
    carregar(recuperado)
    marcarModificado()
  } else {
    carregar({ texto: esqueleto(prefs) })
  }
  api.recuperacao.limpar()
} else {
  carregar({ texto: esqueleto(prefs) })
}

// Para testes automatizados e depuração no DevTools.
window.__misteralg = { editor, execucao, doc, comandos }
