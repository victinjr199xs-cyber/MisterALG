import { BrowserWindow, screen } from 'electron'
import { fileURLToPath } from 'node:url'

const caminhoPreload = fileURLToPath(new URL('../preload/index.mjs', import.meta.url))
const caminhoRenderer = fileURLToPath(new URL('../renderer/index.html', import.meta.url))

// Modo de captura (só para gerar as imagens da documentação): desenha fora da
// tela, em tamanho fixo, para o print sair igual em qualquer máquina.
const MODO_CAPTURA = process.env.MISTERALG_CAPTURA === '1'

/** @param fundo cor do tema escolhido, para a janela não piscar verde antes de a página pintar */
export function criarJanelaPrincipal(fundo = '#c0dcc0') {
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

  janela.once('ready-to-show', () => {
    if (MODO_CAPTURA) return
    janela.maximize()
    janela.show()
  })

  // Links externos (ajuda, sobre) abrem fora do app; navegação interna é bloqueada.
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  janela.webContents.on('will-navigate', (evento) => evento.preventDefault())

  const urlDesenvolvimento = import.meta.env.ELECTRON_RENDERER_URL
  if (urlDesenvolvimento) janela.loadURL(urlDesenvolvimento)
  else janela.loadFile(caminhoRenderer)

  return janela
}
