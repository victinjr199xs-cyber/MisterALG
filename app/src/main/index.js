import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { temaPorId } from '../compartilhado/temas.js'
import { anexarDados, gravarArquivo, lerArquivo, lerDados } from './arquivos.js'
import { criarJanelaPrincipal } from './janelas.js'
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

app.setName('MisterALG')
// Pasta de dados alternativa (usada pelos testes e pelas capturas da documentação).
if (process.env.MISTERALG_DADOS) app.setPath('userData', process.env.MISTERALG_DADOS)

const FILTROS_ALG = [
  { name: 'Algoritmos', extensions: ['alg'] },
  { name: 'Arquivos-texto', extensions: ['txt'] },
  { name: 'Todos os arquivos', extensions: ['*'] },
]
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

const atualizarMenu = () => montarMenu(janela, lerPreferencias(), estadoMenu)
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
      filters: FILTROS_ALG,
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

  ipcMain.handle('arquivo:salvarComo', async (_e, { texto, nome, codificacao }) => {
    const r = await dialog.showSaveDialog(janela, {
      title: 'Salvar algoritmo como',
      filters: FILTROS_ALG,
      defaultPath: `${documentos()}/${nome || 'semnome'}.alg`,
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

  ipcMain.handle('externo:abrir', (_e, url) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
  })

  ipcMain.handle('editar:acao', (_e, acao) => {
    if (['cut', 'copy', 'paste', 'selectAll'].includes(acao)) janela?.webContents[acao]()
  })
  ipcMain.handle('janela:titulo', (_e, titulo) => janela?.setTitle(titulo))
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
  janela = criarJanelaPrincipal(aplicarTemaNativo().fundo)
  atualizarMenu()

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
      atualizarMenu()
    }
  })
})

app.on('window-all-closed', () => app.quit())
