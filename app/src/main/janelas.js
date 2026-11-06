import { BrowserWindow, screen } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { temaPorId } from '../compartilhado/temas.js'
import { limitesPadrao, limitesValidos, TAMANHO_MINIMO } from './console-limites.js'
import { gravarPreferencias, lerPreferencias } from './preferencias.js'

const caminhoPreload = fileURLToPath(new URL('../preload/index.mjs', import.meta.url))
const arquivoPagina = (html) => fileURLToPath(new URL(`../renderer/${html}`, import.meta.url))

/** 'inicio' (só a tela inicial, sem a IDE) ou 'ide' (index.html), com os parâmetros na URL. */
export function carregarPagina(janela, pagina, params = {}) {
  const html = pagina === 'inicio' ? 'inicio.html' : 'index.html'
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  const urlDesenvolvimento = import.meta.env.ELECTRON_RENDERER_URL
  if (urlDesenvolvimento) return janela.loadURL(`${urlDesenvolvimento}/${html}?${new URLSearchParams(query)}`)
  return janela.loadFile(arquivoPagina(html), { query })
}

// Modo de captura (só para gerar as imagens da documentação): desenha fora da
// tela, em tamanho fixo, para o print sair igual em qualquer máquina.
const MODO_CAPTURA = process.env.MISTERALG_CAPTURA === '1'

/**
 * @param fundo cor do tema escolhido, para a janela não piscar verde antes de a página pintar
 * @param aguardar a janela só aparece quando isto resolver (o fim da tela de abertura)
 */
export function criarJanelaPrincipal(fundo = '#c0dcc0', aguardar = null) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const janela = new BrowserWindow({
    width: MODO_CAPTURA ? 1440 : Math.min(1366, width),
    height: MODO_CAPTURA ? 860 : Math.min(860, height),
    minWidth: 900,
    minHeight: 560,
    title: 'MisterALG',
    backgroundColor: fundo,
    show: false,
    webPreferences: {
      preload: caminhoPreload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      offscreen: MODO_CAPTURA,
    },
  })

  janela.once('ready-to-show', async () => {
    if (MODO_CAPTURA) return
    await aguardar
    if (janela.isDestroyed()) return
    janela.maximize()
    janela.show()
  })

  // Links externos (ajuda, sobre) abrem fora do app; navegação interna é bloqueada.
  // Única exceção: a janela do console (renderer/console.js), aberta em branco com este nome.
  janela.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (frameName !== NOME_CONSOLE || url !== 'about:blank' || (consoleFilha && !consoleFilha.isDestroyed())) return { action: 'deny' }
    return { action: 'allow', overrideBrowserWindowOptions: opcoesDoConsole(janela) }
  })
  janela.webContents.on('did-create-window', (filha, { frameName }) => {
    if (frameName === NOME_CONSOLE) ligarConsole(filha, janela)
  })
  janela.webContents.on('will-navigate', (evento) => evento.preventDefault())

  return janela
}

// ---- janela própria do console ------------------------------------------------------------
// O renderer abre a janela com window.open e muda o elemento do console para dentro dela; aqui só se
// define como ela nasce (tamanho lembrado, tema, ícone), que nada navegue e que ela feche com o app.

const NOME_CONSOLE = 'misteralg-console'
let consoleFilha = null

function iconeDoApp() {
  const candidatos = [join(process.resourcesPath ?? '', 'icone.png'), fileURLToPath(new URL('../../build/icon.png', import.meta.url))]
  return candidatos.find((c) => existsSync(c))
}

function opcoesDoConsole(principal) {
  const salvo = lerPreferencias().janelaConsole
  const area = (limites) => screen.getDisplayMatching(limites).workArea
  const limites = limitesValidos(salvo, area(salvo ?? principal.getBounds())) ?? limitesPadrao(principal.getBounds(), area(principal.getBounds()))
  return {
    ...limites,
    minWidth: TAMANHO_MINIMO.width,
    minHeight: TAMANHO_MINIMO.height,
    title: 'MisterALG — Console',
    icon: iconeDoApp(),
    backgroundColor: temaPorId(lerPreferencias().tema).fundo,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false },
  }
}

function ligarConsole(filha, principal) {
  consoleFilha = filha
  filha.removeMenu?.() // Windows/Linux: sem barra de menus (F9, F8 e Esc são repassados pelo renderer)
  filha.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  filha.webContents.on('will-navigate', (evento) => evento.preventDefault())
  let relogio = null
  const lembrar = () => {
    if (filha.isDestroyed() || filha.isMinimized() || filha.isMaximized() || filha.isFullScreen()) return
    gravarPreferencias({ janelaConsole: filha.getBounds() })
  }
  const agendar = () => { clearTimeout(relogio); relogio = setTimeout(lembrar, 400) }
  filha.on('resize', agendar)
  filha.on('move', agendar)
  filha.on('close', () => { clearTimeout(relogio); lembrar() })
  filha.on('closed', () => { consoleFilha = null })
  principal.on('closed', () => { if (!filha.isDestroyed()) filha.destroy() }) // fechar o app fecha o console
}

/** "Fixar no topo" do console. Sem janela própria aberta, não faz nada. */
export function fixarConsole(sim) {
  if (consoleFilha && !consoleFilha.isDestroyed()) consoleFilha.setAlwaysOnTop(!!sim, 'floating')
  return !!consoleFilha && !consoleFilha.isDestroyed() && consoleFilha.isAlwaysOnTop()
}
