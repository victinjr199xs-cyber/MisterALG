import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { temaPorId } from '../compartilhado/temas.js'
import { mostrarAbertura } from './abertura.js'
import { anexarDados, gravarArquivo, lerArquivo, lerDados } from './arquivos.js'
import { aquecer, arvore, compilar, enviarEntrada, executar, foiCancelado, parar, pararTudo } from './clang.js'
import { cancelar, gravarChave, perguntar, provedoresComChave } from './ia.js'
import { carregarPagina, criarJanelaPrincipal } from './janelas.js'
import * as programas from './programas.js'
import { aquecerPHP, pararPHP } from './php.js'
import { analisarCSharp, aquecerCSharp, preludioCSharp } from './csharp.js'
import { definirPagina, iniciarPrevia, registrarEsquema, ultimaResposta } from './previa.js'
import { montarMenu } from './menu.js'
import {
  adicionarRecente,
  gravarPreferencias,
  gravarRecuperacao,
  lerPreferencias,
  lerRecuperacao,
  limparRecuperacao,
  removerRecente,
} from './preferencias.js'

registrarEsquema() // precisa vir antes do app ficar pronto
app.setName('MisterALG')
// Pasta de dados alternativa (usada pelos testes e pelas capturas da documentação).
if (process.env.MISTERALG_DADOS) app.setPath('userData', process.env.MISTERALG_DADOS)

const TODOS = { name: 'Todos os arquivos', extensions: ['*'] }
const FILTROS_ALG = [
  { name: 'Algoritmos', extensions: ['alg'] },
  { name: 'Arquivos-texto', extensions: ['txt'] },
  TODOS,
]
const FILTROS_ABRIR = [
  { name: 'Algoritmos e programas', extensions: ['alg', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'cs', 'js', 'ts', 'py', 'php'] },
  { name: 'Algoritmos (Portugol)', extensions: ['alg'] },
  { name: 'Programas em C', extensions: ['c', 'h'] },
  { name: 'Programas em C++', extensions: ['cpp', 'cc', 'cxx', 'hpp'] },
  { name: 'Programas em C#', extensions: ['cs'] },
  { name: 'Programas em JavaScript', extensions: ['js'] },
  { name: 'Programas em TypeScript', extensions: ['ts'] },
  { name: 'Programas em Python', extensions: ['py'] },
  { name: 'Programas em PHP', extensions: ['php'] },
  { name: 'Arquivos-texto', extensions: ['txt'] },
  TODOS,
]
const FILTROS_SALVAR = {
  alg: FILTROS_ALG,
  c: [{ name: 'Programas em C', extensions: ['c'] }, TODOS],
  cpp: [{ name: 'Programas em C++', extensions: ['cpp'] }, TODOS],
  cs: [{ name: 'Programas em C#', extensions: ['cs'] }, TODOS],
  js: [{ name: 'Programas em JavaScript', extensions: ['js'] }, TODOS],
  ts: [{ name: 'Programas em TypeScript', extensions: ['ts'] }, TODOS],
  py: [{ name: 'Programas em Python', extensions: ['py'] }, TODOS],
  php: [{ name: 'Programas em PHP', extensions: ['php'] }, TODOS],
}
const FILTROS_BLOCO = [
  { name: 'Arquivos de inclusão', extensions: ['inc'] },
  { name: 'Arquivos-texto', extensions: ['txt'] },
  { name: 'Algoritmos', extensions: ['alg'] },
  { name: 'Blocos de algoritmos', extensions: ['blc'] },
  { name: 'Todos os arquivos', extensions: ['*'] },
]

let janela = null
let podeFechar = false
let estadoMenu = {}
let arquivoParaAbrir = null // arquivo .alg aberto pelo Finder antes da janela existir

let naInicio = false // a janela está na página inicial (sem a IDE)

// Na página inicial não há menu da IDE (no Mac o menu do app continua, por causa do ⌘Q).
const atualizarMenu = () => (naInicio && process.platform !== 'darwin' ? Menu.setApplicationMenu(null) : montarMenu(janela, lerPreferencias(), estadoMenu))
/** Troca a página da janela: a tela inicial sozinha ou a IDE. */
const irPara = (pagina, params) => {
  naInicio = pagina === 'inicio'
  if (naInicio) limparRecuperacao() // voltar ao início descarta o algoritmo (já confirmado na IDE)
  atualizarMenu()
  return carregarPagina(janela, pagina, params)
}
// Testes automatizados e arquivos abertos pelo sistema vão direto para a IDE.
const paginaInicial = () => (process.env.MISTERALG_DADOS || arquivoParaAbrir ? 'ide' : 'inicio')
const documentos = () => app.getPath('documents')

// Temas escuros deixam escuros também a barra de título, os menus e as caixas
// de diálogo nativas; os claros seguem o sistema, como antes.
function aplicarTemaNativo() {
  const tema = temaPorId(lerPreferencias().tema)
  nativeTheme.themeSource = tema.escuro ? 'dark' : 'system'
  janela?.setBackgroundColor(tema.fundo)
  return tema
}

function registrarIpc() {
  ipcMain.handle('prefs:ler', () => lerPreferencias())
  ipcMain.handle('prefs:gravar', (_e, prefs) => {
    const r = gravarPreferencias(prefs)
    if ('tema' in prefs) aplicarTemaNativo()
    atualizarMenu()
    return r
  })
  ipcMain.handle('menu:estado', (_e, estado) => {
    estadoMenu = { ...estadoMenu, ...estado }
    atualizarMenu()
  })

  ipcMain.handle('arquivo:abrir', async () => {
    const r = await dialog.showOpenDialog(janela, {
      title: 'Abrir algoritmo',
      filters: FILTROS_ABRIR,
      properties: ['openFile'],
      defaultPath: documentos(),
    })
    if (r.canceled || !r.filePaths[0]) return null
    const lido = await lerArquivo(r.filePaths[0])
    adicionarRecente(lido.caminho)
    atualizarMenu()
    return lido
  })

  ipcMain.handle('arquivo:abrirCaminho', async (_e, caminho) => {
    try {
      const lido = await lerArquivo(caminho)
      adicionarRecente(caminho)
      atualizarMenu()
      return lido
    } catch {
      removerRecente(caminho)
      atualizarMenu()
      return { erro: `O arquivo ${caminho} não pode ser encontrado.` }
    }
  })

  ipcMain.handle('arquivo:salvar', async (_e, { caminho, texto, codificacao }) => {
    const usada = await gravarArquivo(caminho, texto, codificacao)
    adicionarRecente(caminho)
    atualizarMenu()
    return { caminho, codificacao: usada }
  })

  ipcMain.handle('arquivo:salvarComo', async (_e, { texto, nome, codificacao, extensao = 'alg' }) => {
    const r = await dialog.showSaveDialog(janela, {
      title: extensao === 'alg' ? 'Salvar algoritmo como' : 'Salvar programa como',
      filters: FILTROS_SALVAR[extensao] ?? FILTROS_ALG,
      defaultPath: `${documentos()}/${nome || 'semnome'}.${extensao}`,
    })
    if (r.canceled || !r.filePath) return null
    const usada = await gravarArquivo(r.filePath, texto, codificacao)
    adicionarRecente(r.filePath)
    atualizarMenu()
    return { caminho: r.filePath, codificacao: usada }
  })

  ipcMain.handle('bloco:gravar', async (_e, texto) => {
    const r = await dialog.showSaveDialog(janela, { title: 'Gravar bloco de algoritmo', filters: FILTROS_BLOCO })
    if (r.canceled || !r.filePath) return false
    await gravarArquivo(r.filePath, texto, 'windows-1252')
    return true
  })

  ipcMain.handle('bloco:inserir', async () => {
    const r = await dialog.showOpenDialog(janela, {
      title: 'Inserir bloco de algoritmo',
      filters: FILTROS_BLOCO,
      properties: ['openFile'],
    })
    if (r.canceled || !r.filePaths[0]) return null
    return (await lerArquivo(r.filePaths[0])).texto
  })

  // Exportar para Pascal: grava o .pas gerado no renderer, em UTF-8.
  ipcMain.handle('exportar:salvar', async (_e, { texto, nome }) => {
    const r = await dialog.showSaveDialog(janela, {
      title: 'Exportar para a linguagem Pascal',
      filters: [{ name: 'Programas Pascal', extensions: ['pas'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
      defaultPath: `${documentos()}/${nome || 'semnome'}.pas`,
    })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, texto, 'utf8')
    return r.filePath
  })

  ipcMain.handle('dialogo:mensagem', async (_e, opcoes) => {
    const r = await dialog.showMessageBox(janela, { noLink: true, ...opcoes })
    return r.response
  })

  ipcMain.handle('recuperacao:ler', () => lerRecuperacao())
  ipcMain.handle('recuperacao:gravar', (_e, dados) => gravarRecuperacao(dados))
  ipcMain.handle('recuperacao:limpar', () => limparRecuperacao())

  // Comando `arquivo "x.txt"` do Portugol: o interpretador lê de forma síncrona.
  ipcMain.on('dados:ler', (e, { nome, pasta }) => {
    try {
      e.returnValue = lerDados(nome, pasta, documentos())
    } catch {
      e.returnValue = null
    }
  })
  ipcMain.on('dados:anexar', (e, { nome, pasta, linha }) => {
    try {
      anexarDados(nome, pasta, documentos(), linha)
      e.returnValue = true
    } catch {
      e.returnValue = false
    }
  })

  ipcMain.handle('imprimir', async (_e, { html }) => {
    const folha = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await folha.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise((resolve) => folha.webContents.print({}, () => resolve()))
    folha.destroy()
  })

  ipcMain.handle('ia:chaves', () => provedoresComChave())
  ipcMain.handle('ia:gravarChave', (_e, { provedor, chave }) => {
    gravarChave(provedor, typeof chave === 'string' ? chave.trim() : '')
    return provedoresComChave()
  })
  ipcMain.handle('ia:perguntar', (e, { id, mensagens }) => {
    const config = lerPreferencias().ia
    if (!config?.ativo) return { erro: 'O assistente de IA está desligado. Ative em Configurar.' }
    const validas = Array.isArray(mensagens) && mensagens.every((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
    if (!validas) return { erro: 'Pergunta inválida.' }
    return perguntar(id, config, mensagens, (pedaco) => {
      if (!e.sender.isDestroyed()) e.sender.send('ia:parte', id, pedaco)
    })
  })
  ipcMain.handle('ia:cancelar', (_e, id) => cancelar(id))

  // C e C++ (main/clang.js): compila e, se deu certo, já começa a rodar.
  ipcMain.handle('clang:aquecer', (_e, pedido) => aquecer(pedido?.linguagem === 'cpp' ? 'cpp' : 'c', pedido?.fonte))
  ipcMain.handle('clang:executar', async (e, { id, linguagem, fonte }) => {
    if (!['c', 'cpp'].includes(linguagem) || typeof fonte !== 'string') return { erros: 'Pedido inválido.' }
    const r = await compilar(linguagem, fonte)
    if (r.erros !== undefined) return { erros: r.erros }
    if (foiCancelado(id)) return { cancelado: true }
    executar(id, r.wasm, (evento) => {
      if (!e.sender.isDestroyed()) e.sender.send('clang:evento', id, evento)
    })
    return { avisos: r.avisos }
  })
  // Só compila (sem rodar): diz se um erro do passo a passo é do programa ou do passo a passo.
  ipcMain.handle('clang:verificar', async (_e, { linguagem, fonte }) => {
    const r = await compilar(linguagem, String(fonte))
    return r.erros !== undefined ? { erros: r.erros } : { ok: true }
  })
  ipcMain.handle('clang:arvore', (_e, { fonte, linguagem }) => (typeof fonte === 'string' ? arvore(fonte, linguagem === 'cpp' ? 'cpp' : 'c') : { erros: 'Pedido inválido.' }))
  ipcMain.handle('clang:entrada',(_e, { id, texto }) => enviarEntrada(id, String(texto)))
  ipcMain.handle('clang:parar', (_e, id) => parar(id))

  // Python e PHP (main/programas.js): cada programa num processo à parte.
  ipcMain.handle('programa:aquecer', (_e, linguagem) => programas.aquecer(linguagem))
  ipcMain.handle('programa:iniciar', (e, pedido) => {
    if (pedido?.linguagem !== 'python' || typeof pedido.fonte !== 'string' || typeof pedido.id !== 'string') return { erro: 'Pedido inválido.' }
    programas.iniciar(pedido, (evento) => {
      if (!e.sender.isDestroyed()) e.sender.send('programa:evento', pedido.id, evento)
    })
    return {}
  })
  ipcMain.handle('programa:comando', (_e, { id, cmd }) => programas.comando(id, cmd))
  ipcMain.handle('programa:parar', (_e, id) => programas.parar(id))

  // C#: o tree-sitter lê o programa aqui; a IDE o executa (packages/interpretador-csharp).
  ipcMain.handle('csharp:analisar', (_e, { fonte }) => (typeof fonte === 'string' ? analisarCSharp(fonte) : { erros: [{ linha: 1, coluna: 0, mensagem: 'pedido inválido' }] }))
  ipcMain.handle('csharp:preludio', () => preludioCSharp())
  ipcMain.handle('csharp:aquecer', () => aquecerCSharp())

  // PHP: a página ao vivo (main/previa.js). O iframe da IDE abre a URL devolvida e o PHP responde a cada requisição.
  ipcMain.handle('php:definir', (_e, { fonte, nome, diretorio }) => ({ url: definirPagina({ fonte, nome, diretorio }) }))
  ipcMain.handle('php:ultima', () => ultimaResposta())
  ipcMain.handle('php:aquecer', () => aquecerPHP())

  ipcMain.handle('externo:abrir', (_e, url) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
  })

  ipcMain.handle('editar:acao', (_e, acao) => {
    if (['cut', 'copy', 'paste', 'selectAll'].includes(acao)) janela?.webContents[acao]()
  })
  ipcMain.handle('janela:titulo', (_e, titulo) => janela?.setTitle(titulo))
  ipcMain.handle('janela:pagina', (_e, { pagina, params } = {}) => {
    if (pagina !== 'inicio' && pagina !== 'ide') return
    void irPara(pagina, params && typeof params === 'object' ? params : {}) // a página atual vai embora; não há resposta a esperar
  })
  ipcMain.handle('janela:fechar', () => {
    podeFechar = true
    limparRecuperacao()
    janela?.close()
  })
  ipcMain.handle('app:abrirPendente', () => {
    const c = arquivoParaAbrir
    arquivoParaAbrir = null
    return c
  })
}

// Arquivo .alg aberto pelo Finder (duplo-clique ou arrastar para o ícone).
app.on('open-file', (evento, caminho) => {
  evento.preventDefault()
  if (janela) janela.webContents.send('menu', 'abrir-recente', caminho)
  else arquivoParaAbrir = caminho
})

app.whenReady().then(() => {
  registrarIpc()
  iniciarPrevia((resposta) => janela?.webContents.send('php:resposta', resposta))
  // Testes e capturas (pasta de dados própria) abrem direto, sem a animação.
  const abertura = lerPreferencias().abertura !== false && !process.env.MISTERALG_DADOS ? mostrarAbertura(app.getVersion()) : null
  janela = criarJanelaPrincipal(aplicarTemaNativo().fundo, abertura?.pronta)
  if (abertura) janela.once('show', abertura.fechar)
  irPara(paginaInicial())

  // Fechar a janela pergunta ao renderer se há alterações não salvas.
  janela.on('close', (evento) => {
    if (podeFechar) return
    evento.preventDefault()
    janela.webContents.send('menu', 'sair')
  })
  janela.on('closed', () => {
    janela = null
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      podeFechar = false
      janela = criarJanelaPrincipal(aplicarTemaNativo().fundo)
      irPara(paginaInicial())
    }
  })
})

app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => { // nenhum programa C/C++, Python ou PHP fica rodando depois que a IDE fecha
  pararTudo()
  programas.pararTudo()
  pararPHP()
})
