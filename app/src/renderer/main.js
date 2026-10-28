// IDE do MisterALG: junta editor, execução, busca, arquivos, barra e menus.

import { abrirAjuda } from './ajuda.js'
import { criarBusca } from './busca.js'
import * as dialogos from './dialogos.js'
import { criarEditor } from './editor/editor.js'
import { esqueleto } from './editor/modelos.js'
import { INTERVALOS, criarExecucao } from './execucao.js'
import { ICONES } from './icones.js'
import { DICAS } from './dicas.js'
import { tradutor } from '../compartilhado/idiomas.js'
import { traduzirPagina } from './traduzir-pagina.js'
import { procurarNaIDE } from './atualizacao.js'
import { criarAssistente } from './assistente.js'
import { abrirTutorial } from './tutorial.js'
import { primeiroPrograma } from './tutorial-passos.js'
import { gerarPascal, gerarC, gerarJava } from '@misteralg/interpreter'
import { TEMAS, temaPorId } from '../compartilhado/temas.js'
import { BARRA, TAMANHOS_ICONE, dicaDaPlataforma as dicaPorPlataforma, idsOcultaveis, itensVisiveis, principaisLateral } from '../compartilhado/barra.js'
import { criarAvatar } from './avatar.js'
import { criarDisposicao } from './disposicao.js'

const api = window.misteralg
const $ = (sel) => document.querySelector(sel)
import { VERSAO } from '../compartilhado/versao.js'
// Termos de uso: o mesmo texto que o instalador do Windows exibe (app/build/termos.txt).
import TEXTO_TERMOS from '../../build/termos.txt?raw'
const TERMOS = TEXTO_TERMOS.replace(/^﻿/, '').replace(/\r\n/g, '\n')
const VERSAO_TERMOS = '1.5'

let prefs = await api.prefs.ler()
let fotoConta = await api.conta.foto() // data URL da foto da conta, ou null
/** Tema + cores de código que o usuário trocou para esse tema (Configurações → Cores). */
function aplicarTema(id, cores = prefs.coresSintaxe?.[temaPorId(id).id] ?? {}) {
  const raiz = document.documentElement
  raiz.dataset.tema = temaPorId(id).id
  for (const [nome, cor] of Object.entries(temaPorId(id).icones)) raiz.style.setProperty(`--icone-${nome}`, cor)
  for (const [cat] of dialogos.CATEGORIAS_SINTAXE) {
    if (cores[cat]) raiz.style.setProperty(`--sx-${cat}`, cores[cat])
    else raiz.style.removeProperty(`--sx-${cat}`)
  }
}
aplicarTema(prefs.tema)

// ---- botão de temas (menu suspenso com amostras) ---------------------------------------

const menuTemas = Object.assign(document.createElement('div'), { className: 'menu-temas', hidden: true })
menuTemas.setAttribute('role', 'menu')
document.body.append(menuTemas)

function fecharMenuTemas() {
  menuTemas.hidden = true
  $('[data-id="temas"]')?.setAttribute('aria-expanded', 'false')
}

function abrirMenuTemas() {
  if (!menuTemas.hidden) return fecharMenuTemas()
  const botao = $('[data-id="temas"]')
  const item = (rotulo, aoClicar, extra = {}) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', ...extra })
    b.setAttribute('role', extra.marcado === undefined ? 'menuitem' : 'menuitemradio')
    if (extra.marcado !== undefined) b.setAttribute('aria-checked', String(extra.marcado))
    b.append(...rotulo)
    b.addEventListener('click', () => { fecharMenuTemas(); aoClicar() })
    return b
  }
  const amostra = (cores) => {
    const s = Object.assign(document.createElement('span'), { className: 'amostra-tema' })
    for (const c of cores) s.append(Object.assign(document.createElement('i'), { style: `background:${c}` }))
    return s
  }
  menuTemas.replaceChildren(
    ...TEMAS.map((t) => item([amostra(t.amostra), t.nome], () => comandos.tema(t.id), { marcado: t.id === temaPorId(prefs.tema).id })),
    document.createElement('hr'),
    item(['Personalizar as cores do código…'], () => comandos['configurar-cores']()),
  )
  let r = botao.getBoundingClientRect()
  if (!r.width) r = $('[data-id="mais"]')?.getBoundingClientRect() ?? r // o painel "⋯" já fechou: ancora no botão dele
  menuTemas.hidden = false
  // Na barra lateral (ou no painel "⋯") o botão fica embaixo: abre ao lado e sem sair da janela.
  const lateral = document.body.classList.contains('barra-lateral')
  const topo = lateral ? r.top : r.bottom + 2
  menuTemas.style.top = `${Math.max(4, Math.min(topo, innerHeight - menuTemas.offsetHeight - 4))}px`
  menuTemas.style.left = `${Math.max(4, Math.min(lateral ? r.right + 4 : r.left, innerWidth - menuTemas.offsetWidth - 4))}px`
  botao.setAttribute('aria-expanded', 'true')
  menuTemas.querySelector('[aria-checked="true"]')?.focus()
}

document.addEventListener('mousedown', (e) => {
  if (!menuTemas.hidden && !menuTemas.contains(e.target) && !e.target.closest('[data-id="temas"]')) fecharMenuTemas()
})
menuTemas.addEventListener('keydown', (e) => {
  const itens = [...menuTemas.querySelectorAll('button')]
  const i = itens.indexOf(document.activeElement)
  if (e.key === 'Escape') { fecharMenuTemas(); $('[data-id="temas"]').focus() }
  else if (e.key === 'ArrowDown') itens[(i + 1) % itens.length].focus()
  else if (e.key === 'ArrowUp') itens[(i - 1 + itens.length) % itens.length].focus()
  else return
  e.preventDefault()
  e.stopPropagation()
})
const editandoCampo = () => !!document.querySelector('dialog[open]') || !!document.activeElement?.matches('input, textarea')
const doc = { caminho: null, nome: 'semnome', codificacao: 'windows-1252', modificado: false, linguagem: 'portugol' }
let disposicao = null // criada junto da barra (disposição moderna); atualizarTitulo avisa quando o documento muda

// ---- linguagens --------------------------------------------------------------------

const EXTENSAO = { portugol: 'alg', c: 'c', cpp: 'cpp', csharp: 'cs', javascript: 'js', typescript: 'ts', python: 'py', php: 'php', sql: 'sql' }
const linguagemDoCaminho = (caminho) => (
  /\.cs$/i.test(caminho) ? 'csharp' :
  /\.ts$/i.test(caminho) ? 'typescript' :
  /\.js$/i.test(caminho) ? 'javascript' :
  /\.py$/i.test(caminho) ? 'python' :
  /\.php$/i.test(caminho) ? 'php' :
  /\.sql$/i.test(caminho) ? 'sql' :
  /\.(cpp|cc|cxx|hpp|hh)$/i.test(caminho) ? 'cpp' :
  /\.[ch]$/i.test(caminho) ? 'c' :
  'portugol'
)
const MODELOS_NOVO = {
  c: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
  csharp: 'using System;\n\nclass Program\n{\n    static void Main()\n    {\n        Console.WriteLine("Hello, World!");\n    }\n}\n',
  javascript: 'console.log("Hello, World!")\n',
  typescript: 'const msg: string = "Hello, World!"\nconsole.log(msg)\n',
  python: 'print("Hello, World!")\n',
  php: '<?php\necho "Hello, World!";\n',
  sql: "-- F9 runs the whole script; F8 runs one statement at a time and shows the tables changing.\nSELECT 'Hello, World!' AS greeting;\n\nCREATE TABLE student (\n  id    SERIAL PRIMARY KEY,\n  name  TEXT NOT NULL,\n  grade NUMERIC(4, 1)\n);\n\nINSERT INTO student (name, grade) VALUES\n  ('Ana', 9.5),\n  ('Bruno', 7.0),\n  ('Carla', 8.2);\n\nSELECT name, grade FROM student WHERE grade >= 8 ORDER BY grade DESC;\n",
}
const esqueletoDe = (linguagem) => MODELOS_NOVO[linguagem] ?? esqueleto(prefs)
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

// Portugol fica com as molduras do VisuAlg; as outras linguagens usam a IDE escura "de terminal",
// com os rótulos em inglês (como nas ferramentas dessas linguagens). Os textos originais voltam no Portugol.
const ROTULOS_CODIGO = [
  ['.moldura-variaveis .legenda', 'Variables'],
  ['.moldura-visualizacao > .legenda', 'Terminal'],
  ['.console-titulo > span:not(.console-icone)', 'Terminal'],
  ['#variaveis th:nth-child(1)', 'Scope'], ['#variaveis th:nth-child(2)', 'Name'],
  ['#variaveis th:nth-child(3)', 'Type'], ['#variaveis th:nth-child(4)', 'Value'],
]
const rotulosOriginais = ROTULOS_CODIGO.map(([sel]) => $(sel).textContent)
function aplicarModo(linguagem) {
  const codigo = linguagem !== 'portugol'
  document.body.classList.toggle('modo-codigo', codigo)
  ROTULOS_CODIGO.forEach(([sel, texto], i) => { $(sel).textContent = codigo ? texto : rotulosOriginais[i] })
}

function atualizarTitulo() {
  const arquivo = doc.caminho ? doc.caminho.split(/[\\/]/).pop() : doc.linguagem === 'portugol' ? doc.nome : `${doc.nome}.${EXTENSAO[doc.linguagem]}`
  $('#titulo-editor').textContent = doc.linguagem === 'portugol' ? `Área dos algoritmos ( Edição do código fonte ) -> Nome do arquivo: [${arquivo}]` : arquivo
  const t = tradutor(prefs.idioma)
  api.janela.titulo(doc.modificado ? t('MisterALG — {0} (modificado)', arquivo) : t('MisterALG — {0}', arquivo))
  status.estado()
  disposicao?.atualizar()
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
  aoMudar: () => {
    marcarModificado()
    execucao?.aoEditar()
  },
  aoMoverCursor: status.posicao,
  aoAlternarBreakpoint: (linhas) => execucao?.atualizarBreakpoints(linhas),
})

function carregar({ texto, caminho = null, codificacao = 'windows-1252', nome = 'semnome', linguagem = 'portugol' }) {
  execucao.restaurar()
  editor.definirLinguagem(linguagem)
  editor.definirTexto(texto)
  Object.assign(doc, { caminho, codificacao, nome, linguagem, modificado: false })
  aplicarModo(linguagem)
  // Carrega o compilador (e o PCH do C++) ou o Python enquanto a pessoa escreve.
  if (linguagem === 'c' || linguagem === 'cpp') api.clang.aquecer({ linguagem, fonte: texto })
  else if (linguagem === 'python') api.programa.aquecer('python')
  else if (linguagem === 'csharp') api.csharp.aquecer()
  else if (linguagem === 'php') api.php.aquecer()
  else if (linguagem === 'sql') api.sql.aquecer()
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
  void api.recuperacao.limpar() // descartado de propósito: um travamento depois disso não deve oferecer o texto antigo
  return true
}

async function salvar(comoNovo = false) {
  const texto = editor.texto()
  let r
  try {
    if (!doc.caminho || comoNovo) r = await api.arquivo.salvarComo({ texto, nome: doc.nome, codificacao: doc.codificacao, extensao: EXTENSAO[doc.linguagem] })
    else r = await api.arquivo.salvar({ caminho: doc.caminho, texto, codificacao: doc.codificacao })
  } catch (e) {
    await api.mensagem({ type: 'error', title: 'Salvar', message: tradutor(prefs.idioma)('Não deu para salvar o arquivo: {0}', e.message) })
    return false
  }
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
  carregar({ ...lido, nome: lido.caminho.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''), linguagem: linguagemDoCaminho(lido.caminho) })
}

/** O main devolve { erro } (já traduzido) quando o comando `arquivo` não pode usar o caminho; o interpretador mostra a mensagem ao aluno. */
function erroDeArquivo(r) {
  if (r && typeof r === 'object' && r.erro) throw Object.assign(new Error(r.erro), { paraAluno: true })
  return r
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
    listas: prefs.listas,
    arquivos: {
      ler: (nome) => erroDeArquivo(api.dados.ler(nome, pastaAtual())),
      anexar: (nome, linha) => erroDeArquivo(api.dados.anexar(nome, pastaAtual(), linha)),
    },
  }),
  idioma: () => prefs.idioma,
  aoErro: (erro) => { ultimoErro = erro; disposicao?.problema(erro) },
  iaAtiva: () => !!prefs.ia?.ativo,
  aoPedirIA: () => assistente.explicarErro(),
  linguagem: () => doc.linguagem,
  // A página do PHP roda a pasta do arquivo salvo (include, css, imagens); sem salvar, só o que está no editor.
  paginaPHP: () => ({
    nome: doc.caminho ? doc.caminho.split(/[\\/]/).pop() : 'index.php',
    diretorio: doc.caminho ? doc.caminho.replace(/[\\/][^\\/]*$/, '') : null,
  }),
  aoMudarEstado: (rodando) => {
    if (rodando) { ultimoErro = null; disposicao?.problema(null); disposicao?.aoExecutar() }
    api.menu.estado({ executando: rodando })
    for (const id of ['parar']) $(`[data-id="${id}"]`).disabled = !rodando
  },
})

let ultimoErro = null // para o Assistente de IA saber o que deu errado
const assistente = criarAssistente({
  prefs: () => prefs,
  gravarPrefs: async (parcial) => (prefs = await api.prefs.gravar(parcial)),
  contexto: () => ({
    linguagem: { portugol: 'Portugol (VisuAlg)', c: 'C', cpp: 'C++' }[doc.linguagem],
    codigo: editor.texto(),
    erro: ultimoErro,
    saida: $('#console-tela').textContent || $('#visualizacao').textContent,
  }),
  aoMudar: (aberto) => $('[data-id="assistente"]')?.setAttribute('aria-pressed', String(aberto)),
})

const busca = criarBusca(editor, { estado: status.estado, mensagem: (m) => status.mensagem(m ? ` MENSAGEM: ${m}` : ''), t: (...a) => tradutor(prefs.idioma)(...a) })

// ---- comandos (menu, barra e atalhos usam a mesma tabela) ------------------------------

let perguntandoSair = false
/** Exportar para Pascal / C / Java: mostra o programa gerado e, se pedido, grava o arquivo. */
async function exportarPrograma(linguagem, rotulo, extensao, gerar) {
  if (doc.linguagem !== 'portugol') return status.mensagem(` MENSAGEM: Exportar para ${rotulo} só vale para algoritmos em Portugol.`)
  let gerado
  try {
    gerado = gerar(editor.texto())
  } catch (e) {
    if (!e.codigo) throw e
    editor.realcarErro(e.linha)
    return dialogos.aviso(e, editor.textoDaLinha(e.linha))
  }
  if (await dialogos.codigoExportado(gerado.codigo, linguagem) === 'salvar') {
    // Em Java o arquivo precisa ter o nome da classe pública.
    const caminho = await api.exportar({ texto: gerado.codigo, nome: gerado.classe ?? doc.nome, extensao })
    if (caminho?.erro) await api.mensagem({ type: 'error', title: 'Exportar', message: caminho.erro })
    else if (caminho) status.mensagem(` MENSAGEM: Programa ${rotulo} gravado em ${caminho}`)
  }
}

const comandos = {
  novo: async (linguagem = doc.linguagem) => {
    if (!(await podeDescartar(' Incluir um novo algoritmo no MisterALG '))) return
    carregar({ texto: esqueletoDe(linguagem), linguagem, codificacao: linguagem === 'portugol' ? 'windows-1252' : 'utf-8' })
  },
  abrir: async () => {
    if (await podeDescartar(' Abrir um algoritmo no MisterALG ')) abrirResultado(await api.arquivo.abrir())
  },
  'abrir-recente': async (caminho) => {
    if (await podeDescartar(' Abrir um algoritmo no MisterALG ')) abrirResultado(await api.arquivo.abrirCaminho(caminho))
  },
  exemplo: async ({ nome, texto }) => {
    if (!(await podeDescartar(' Abrir um algoritmo no MisterALG '))) return
    carregar({ texto, nome: nome.replace(/\.[^.]+$/, ''), linguagem: linguagemDoCaminho(nome), codificacao: /\.alg$/.test(nome) ? 'windows-1252' : 'utf-8' })
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
  sair: async (dados) => {
    // Antes de fechar, oferece voltar para a tela inicial (os testes automatizados fecham direto).
    if (!api.automatizado && !dados?.direto) { // quem já escolheu fechar (X da janela, bandeja) não é perguntado de novo
      if (perguntandoSair) return
      perguntandoSair = true
      const t = tradutor(prefs.idioma)
      const r = await dialogos.janela({
        titulo: t('Sair'),
        corpo: t('Você quer voltar para a tela inicial do MisterALG ou fechar o aplicativo?'),
        botoes: [
          { valor: 'inicio', texto: t('Voltar para a tela inicial'), principal: true },
          { valor: 'fechar', texto: t('Fechar o MisterALG') },
          { valor: 'cancelar', texto: t('Cancelar') },
        ],
      }).finally(() => { perguntandoSair = false })
      if (r === 'inicio') return comandos['tela-inicial']()
      if (r !== 'fechar') return editor.focar()
    }
    if (execucao.emExecucao()) execucao.parar()
    if (await podeDescartar(' Encerrando o algoritmo e fechando o MisterALG ')) api.janela.fechar()
  },
  // Trocar o idioma recarrega a IDE já traduzida, com o mesmo arquivo (ou um novo na mesma linguagem).
  idioma: async (id) => {
    if (!(await podeDescartar(' Incluir um novo algoritmo no MisterALG '))) return
    prefs = await api.prefs.gravar({ idioma: id })
    api.janela.pagina({ pagina: 'ide', params: doc.caminho ? { abrir: doc.caminho } : { linguagem: doc.linguagem } })
  },
  // Só campos de texto e diálogos usam o desfazer do navegador; botões da barra (que ficam com o foco) desfazem o editor.
  desfazer: () => (editandoCampo() ? document.execCommand('undo') : editor.desfazer()),
  refazer: () => (editandoCampo() ? document.execCommand('redo') : editor.refazer()),
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
  'exportar-pascal': () => exportarPrograma('pascal', 'Pascal', 'pas', gerarPascal),
  'exportar-c': () => exportarPrograma('c', 'C / C++', 'c', gerarC),
  'exportar-java': () => exportarPrograma('java', 'Java', 'java', gerarJava),
  configuracoes: async (aba) => {
    const conta = {
      foto: fotoConta,
      aoEscolher: async () => {
        const r = await api.conta.escolherFoto()
        if (r?.foto) { fotoConta = r.foto; atualizarAvatar() }
        return r
      },
      aoRemover: async () => { fotoConta = await api.conta.removerFoto(); atualizarAvatar() },
    }
    const novas = await dialogos.configuracoes(prefs, { temas: TEMAS, aoPrever: aplicarTema, aoPreverBarra: (p) => aplicarBarra({ ...prefs, ...p }), conta, aba })
    if (novas) {
      prefs = await api.prefs.gravar(novas)
      editor.aplicarPrefs(prefs)
    }
    aplicarTema(prefs.tema)
    aplicarBarra()
    atualizarAvatar()
  },
  conta: () => comandos.configuracoes('conta'),
  'configurar-cores': () => comandos.configuracoes('cores'),
  temas: () => abrirMenuTemas(),
  tema: async (id) => {
    prefs = await api.prefs.gravar({ tema: temaPorId(id).id })
    aplicarTema(id)
  },
  dica: () => mostrarDica(),
  'tela-inicial': async () => {
    if (execucao.emExecucao()) execucao.parar()
    if (await podeDescartar(' Voltar para a tela inicial do MisterALG ')) api.janela.pagina({ pagina: 'inicio' })
  },
  assistente: () => assistente.alternar(),
  'configurar-ia': () => assistente.configurar(),
  calculadora: () => dialogos.calculadora(),
  calendario: () => dialogos.calendario(),
  'ajuda-tela': () => abrirAjuda('tela', tradutor(prefs.idioma)),
  'ajuda-linguagem': () => abrirAjuda('linguagem', tradutor(prefs.idioma)),
  'ajuda-referencia': () => abrirAjuda('referencia', tradutor(prefs.idioma)),
  sobre: () => dialogos.sobre(VERSAO),
  atualizacoes: () => procurarNaIDE(tradutor(prefs.idioma), {
    podeDescartar: () => podeDescartar(' Encerrando o algoritmo e fechando o MisterALG '),
    status: (texto) => status.mensagem(texto),
  }),
  termos: () => dialogos.termos(TERMOS),
  tutorial: () => iniciarTutorial(),
}

// Com um diálogo aberto só valem os comandos de edição de texto.
const PERMITIDOS_COM_DIALOGO = new Set(['desfazer', 'refazer', 'cortar', 'copiar', 'colar', 'sair'])

function rodar(id, dados) {
  if (document.querySelector('dialog[open]') && !PERMITIDOS_COM_DIALOGO.has(id)) return
  comandos[id]?.(dados)
}

api.menu.aoComando(rodar)

// ---- barra de ferramentas -----------------------------------------------------------

const ehMac = api.plataforma === 'darwin'

const dicaDaPlataforma = (dica) => dicaPorPlataforma(dica, ehMac)

disposicao = criarDisposicao({
  api,
  t: (...a) => tradutor(prefs.idioma)(...a),
  doc,
  extensoes: EXTENSAO,
  alturaSalva: prefs.alturaPainel ?? 0,
  gravarAltura: async (px) => { prefs = await api.prefs.gravar({ alturaPainel: px }) },
  novo: (linguagem) => rodar('novo', linguagem),
  abrirRecente: (caminho) => rodar('abrir-recente', caminho),
  abrirExemplo: (e) => rodar('exemplo', e),
})

/** Posição, tamanho dos ícones e botões ocultos. `p` pode ser só uma prévia (Configurações), sem gravar. */
function aplicarBarra(p = prefs) {
  disposicao.aplicar(p.disposicao)
  // Na disposição moderna o trilho de linguagens ocupa a lateral: a barra fica sempre no topo (compacta).
  const moderna = p.disposicao === 'moderna'
  const lateral = p.posicaoBarra === 'lateral' && !moderna
  // Compacta = só os botões principais na barra e o resto no painel "⋯" (lateral: ao lado; moderna: logo abaixo do botão, no topo).
  const compacta = lateral || moderna
  document.body.classList.toggle('barra-lateral', lateral)
  document.body.classList.toggle('barra-compacta', compacta)
  document.documentElement.dataset.tamIcone = TAMANHOS_ICONE.includes(p.tamanhoIcones) ? p.tamanhoIcones : 'medio'
  const barra = $('#barra')
  barra.setAttribute('aria-orientation', lateral ? 'vertical' : 'horizontal')
  const ocultos = idsOcultaveis(p.botoesOcultos)
  let ver = itensVisiveis(ocultos)
  // Lateral: só os principais ficam na coluna (separadores calculados entre eles); o resto vai para o painel "⋯".
  const fixo = principaisLateral()
  if (compacta) {
    const sub = itensVisiveis(ocultos, BARRA.filter((_, i) => fixo[i]))
    let k = 0
    ver = ver.map((v, i) => (fixo[i] ? sub[k++] : v))
  } else fecharMais(false)
  // Os MESMOS elementos mudam de pai (nada de clones), na ordem da tabela.
  const lista = barra.querySelector('.barra-lista')
  const painel = $('#barra-mais .barra-mais-lista')
  ;[...document.querySelectorAll('[data-item]')]
    .sort((a, b) => Number(a.dataset.item) - Number(b.dataset.item))
    .forEach((e) => {
      const i = Number(e.dataset.item)
      ;(compacta && !fixo[i] ? painel : lista).append(e)
      e.hidden = !ver[i]
    })
  $('[data-id="mais"]').hidden = !compacta
}

/** Painel flutuante "⋯" da barra lateral: abre ao lado da coluna, foco dentro, Esc/clique fora/ação fecham. */
function abrirMais(foco = true) {
  const painel = $('#barra-mais')
  const botao = $('[data-id="mais"]')
  if (!document.body.classList.contains('barra-compacta') || !painel.hidden) return
  painel.hidden = false
  const r = botao.getBoundingClientRect()
  if (document.body.classList.contains('barra-lateral')) {
    painel.style.top = ''
    painel.style.left = ''
    painel.style.insetInlineStart = `${$('#barra').getBoundingClientRect().width}px`
    painel.style.bottom = `${Math.max(4, innerHeight - r.bottom)}px`
    painel.style.maxHeight = `${Math.max(120, r.bottom - 8)}px`
  } else {
    // Barra no topo (disposição moderna): o painel abre para baixo, alinhado ao botão e sem sair da janela.
    const rtl = document.documentElement.dir === 'rtl'
    painel.style.bottom = ''
    painel.style.top = `${r.bottom + 4}px`
    const larg = painel.offsetWidth
    const x = rtl ? Math.max(4, Math.min(r.right - larg, innerWidth - larg - 4)) : Math.max(4, Math.min(r.left, innerWidth - larg - 4))
    painel.style.insetInlineStart = 'auto'
    painel.style.left = `${x}px`
    painel.style.maxHeight = `${Math.max(120, innerHeight - r.bottom - 12)}px`
  }
  botao.setAttribute('aria-expanded', 'true')
  if (foco) painel.focus({ preventScroll: true })
}
function fecharMais(devolverFoco = true) {
  const painel = $('#barra-mais')
  if (painel.hidden) return
  const ativo = document.activeElement
  painel.hidden = true
  const botao = $('[data-id="mais"]')
  botao.setAttribute('aria-expanded', 'false')
  // Só puxa o foco de volta se ele estava no painel (uma ação que levou o foco ao editor ou a um diálogo manda).
  if (devolverFoco && (painel.contains(ativo) || ativo === document.body || !ativo)) botao.focus({ preventScroll: true })
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || $('#barra-mais').hidden || document.querySelector('.tutorial, dialog[open]')) return
  e.preventDefault()
  e.stopPropagation()
  fecharMais()
}, true)
document.addEventListener('pointerdown', (e) => {
  if ($('#barra-mais').hidden || e.target.closest('#barra-mais, [data-id="mais"], .tutorial')) return
  fecharMais(false)
})
// O tutorial abre o painel quando o alvo do passo está dentro dele (tutorial.js).
document.addEventListener('barra-mais', (e) => (e.detail ? abrirMais(false) : fecharMais(false)))

/** Botão da conta no fim da barra: foto ou iniciais; abre Configurações > Conta. */
function atualizarAvatar() {
  const b = $('[data-id="conta"]')
  if (!b) return
  const nome = prefs.conta?.nome ?? ''
  const dica = nome ? tradutor(prefs.idioma)('Conta de {0}', nome) : tradutor(prefs.idioma)('Conta: nome e foto')
  b.replaceChildren(criarAvatar({ nome, foto: fotoConta }))
  b.title = dica
  b.dataset.dica = dica
  b.setAttribute('aria-label', dica)
}

function montarBarra() {
  const barra = $('#barra')
  // Lista rolável própria: na lateral o avatar fica fora dela (rodapé fixo); no topo ela é `display: contents`.
  const lista = Object.assign(document.createElement('div'), { className: 'barra-lista' })
  barra.append(lista)
  const mais = Object.assign(document.createElement('button'), { type: 'button', className: 'botao' })
  const dicaMais = 'Mais ferramentas' // traduzirPagina troca depois, como nas outras dicas da barra
  Object.assign(mais.dataset, { id: 'mais', dica: dicaMais })
  mais.title = dicaMais
  mais.setAttribute('aria-label', dicaMais)
  mais.setAttribute('aria-haspopup', 'dialog')
  mais.setAttribute('aria-expanded', 'false')
  mais.innerHTML = ICONES.mais
  mais.addEventListener('click', () => ($('#barra-mais').hidden ? abrirMais() : fecharMais()))
  barra.append(mais)
  const painelMais = Object.assign(document.createElement('div'), { id: 'barra-mais', className: 'barra-mais', hidden: true, tabIndex: -1 })
  painelMais.setAttribute('role', 'dialog')
  painelMais.setAttribute('aria-label', dicaMais)
  painelMais.append(Object.assign(document.createElement('div'), { className: 'barra-mais-lista' }))
  // Clicar numa ação fecha o painel (menos o liga/desliga do aleatório, que ainda pede De/Até/Decimais).
  painelMais.addEventListener('click', (e) => {
    const b = e.target.closest('button.botao')
    if (b && b.dataset.id !== 'aleatorio') fecharMais()
  })
  document.body.append(painelMais)
  BARRA.forEach((item, indice) => {
    const antes = lista.childElementCount
    montarItem(lista, item)
    for (const e of [...lista.children].slice(antes)) e.dataset.item = String(indice)
  })
  const avatar = Object.assign(document.createElement('button'), { type: 'button', className: 'botao avatar' })
  avatar.dataset.id = 'conta'
  avatar.addEventListener('click', () => rodar('conta'))
  barra.append(avatar)
  atualizarAvatar()
  aplicarBarra()
}

function montarItem(barra, item) {
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
    // Rótulo só aparece no painel "⋯" da lateral (visualg.css).
    span.append(Object.assign(document.createElement('label'), { className: 'so-painel', htmlFor: 'intervalo', textContent: 'Intervalo do timer' }), sel)
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
    if (id === 'aleatorio' || id === 'assistente') b.setAttribute('aria-pressed', 'false')
    if (id === 'parar') b.disabled = true
    barra.append(b)
  }
}

function alternarAleatorio() {
  aleatorioLigado = !aleatorioLigado
  $('[data-id="aleatorio"]').setAttribute('aria-pressed', String(aleatorioLigado)) // oculto só some (hidden), continua no DOM
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
  if (doc.modificado) api.recuperacao.gravar({ texto: editor.texto(), caminho: doc.caminho, nome: doc.nome, codificacao: doc.codificacao, linguagem: doc.linguagem })
}, 5000)

// ---- início ----------------------------------------------------------------------------------

montarBarra()
editor.aplicarPrefs(prefs)
traduzirPagina(tradutor(prefs.idioma))

// No Windows instalado, os termos já foram aceitos no instalador. No Mac, no
// Linux e na versão portátil, o aceite acontece aqui, na primeira abertura.
const precisaAceiteNoApp = ehMac || api.plataforma === 'linux' || api.portatil
const mostrouTermos = precisaAceiteNoApp && prefs.termosAceitos !== VERSAO_TERMOS
if (mostrouTermos) {
  if (await dialogos.termos(TERMOS, true)) {
    prefs = await api.prefs.gravar({ termosAceitos: VERSAO_TERMOS })
  } else {
    await api.janela.fechar()
  }
}

const pendente = await api.arquivoPendente()
const recuperado = await api.recuperacao.ler()
if (recuperado?.texto) {
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
  // Arquivo pendente (duplo clique): o recuperado fica no editor e, se nao for salvo, o aluno decide antes de abrir o outro.
  if (pendente && (r !== 0 || (await podeDescartar('Abrir')))) await abrirResultado(await api.arquivo.abrirCaminho(pendente))
} else if (pendente) {
  carregar({ texto: esqueleto(prefs) })
  await abrirResultado(await api.arquivo.abrirCaminho(pendente))
} else {
  carregar({ texto: esqueleto(prefs) })
  // A escolha feita na página inicial: uma linguagem nova ou um arquivo para abrir.
  const pedido = new URLSearchParams(location.search)
  if (pedido.get('linguagem')) await comandos.novo(pedido.get('linguagem'))
  else if (pedido.get('abrir')) await abrirResultado(await api.arquivo.abrirCaminho(pedido.get('abrir')))
}

// ---- tutorial (Ajuda > Tutorial do MisterALG) ------------------------------------------------

let tutorial = null
function iniciarTutorial() {
  if (tutorial) return
  const t = tradutor(prefs.idioma)
  tutorial = abrirTutorial({
    t,
    linguagem: () => doc.linguagem,
    // O primeiro programa entra pelo caminho do "Novo": pergunta antes se o atual não está salvo.
    escreverPrograma: async (linguagem) => {
      if (execucao.emExecucao()) execucao.parar()
      if (!(await podeDescartar(' Incluir um novo algoritmo no MisterALG '))) return false
      carregar({ texto: primeiroPrograma(linguagem, t), linguagem, nome: 'primeiro', codificacao: linguagem === 'portugol' ? 'windows-1252' : 'utf-8' })
      return true
    },
    aoEvento: (fn) => execucao.aoEvento(fn),
    aoFechar: () => {
      tutorial = null
      if (!document.querySelector('.console-entrada')) editor.focar()
    },
  })
}

/** Na primeira abertura (também depois de atualizar o app), oferece o tutorial no lugar da dica do dia. */
async function oferecerTutorial() {
  const t = tradutor(prefs.idioma)
  prefs = await api.prefs.gravar({ tutorialVisto: true })
  const r = await dialogos.janela({
    titulo: t('Tutorial do MisterALG'),
    corpo: dialogos.el('p', { textContent: t('Primeira vez por aqui? O tutorial mostra cada parte da tela e ajuda você a escrever e executar o seu primeiro programa. Ele também fica no menu Ajuda.') }),
    botoes: [
      { valor: 'comecar', texto: t('Começar o tutorial'), principal: true },
      { valor: 'depois', texto: t('Agora não') },
    ],
    largura: '460px',
  })
  if (r === 'comecar') iniciarTutorial()
  else editor.focar()
}

// Vindo da página inicial (inicio.html), a dica do dia já foi mostrada lá.
const veioDoInicio = Boolean(location.search)

async function mostrarDica() {
  const t = tradutor(prefs.idioma)
  const r = await dialogos.dicaDoDia(DICAS.map((d) => t(d)), prefs.dicaAtual ?? 0, prefs.mostrarDicas !== false)
  prefs = await api.prefs.gravar({ dicaAtual: r.indice, mostrarDicas: r.mostrar })
  editor.focar()
}

// Dica do dia ao abrir (como o VisuAlg). Não aparece logo depois dos termos (uma
// janela de cada vez na primeira abertura) nem nos testes automatizados.
// O tutorial, oferecido uma vez, toma o lugar dela nessa abertura (também logo depois dos termos: uma janela depois da outra).
if (!prefs.tutorialVisto && !api.automatizado && !recuperado?.texto) void oferecerTutorial()
else if (prefs.mostrarDicas !== false && !api.automatizado && !mostrouTermos && !recuperado?.texto && !veioDoInicio) void mostrarDica()

// Para testes automatizados e depuração no DevTools.
window.__misteralg = { editor, execucao, doc, comandos, get tutorial() { return tutorial } }
