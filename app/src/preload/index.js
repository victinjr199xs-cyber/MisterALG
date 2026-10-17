import { contextBridge, ipcRenderer } from 'electron'

// Única ponte entre a IDE (renderer, sem Node) e o sistema (main).
const invocar = (canal) => (dados) => ipcRenderer.invoke(canal, dados)

contextBridge.exposeInMainWorld('misteralg', {
  plataforma: process.platform,
  // A versão portátil do Windows (electron-builder) define esta variável; ela não passa pelo instalador.
  portatil: Boolean(process.env.PORTABLE_EXECUTABLE_DIR),
  // Testes e capturas usam uma pasta de dados própria; neles não abre a dica do dia.
  automatizado: Boolean(process.env.MISTERALG_DADOS),
  prefs: { ler: invocar('prefs:ler'), gravar: invocar('prefs:gravar') },
  menu: {
    aoComando(fn) {
      const ouvinte = (_e, id, dados) => fn(id, dados)
      ipcRenderer.on('menu', ouvinte)
      return () => ipcRenderer.removeListener('menu', ouvinte)
    },
    estado: invocar('menu:estado'),
  },
  arquivo: {
    abrir: invocar('arquivo:abrir'),
    abrirCaminho: invocar('arquivo:abrirCaminho'),
    salvar: invocar('arquivo:salvar'),
    salvarComo: invocar('arquivo:salvarComo'),
    gravarBloco: invocar('bloco:gravar'),
    inserirBloco: invocar('bloco:inserir'),
  },
  dados: {
    ler: (nome, pasta) => ipcRenderer.sendSync('dados:ler', { nome, pasta }),
    anexar: (nome, pasta, linha) => ipcRenderer.sendSync('dados:anexar', { nome, pasta, linha }),
  },
  recuperacao: {
    ler: invocar('recuperacao:ler'),
    gravar: invocar('recuperacao:gravar'),
    limpar: invocar('recuperacao:limpar'),
  },
  mensagem: invocar('dialogo:mensagem'),
  editar: invocar('editar:acao'),
  imprimir: invocar('imprimir'),
  exportar: invocar('exportar:salvar'),
  abrirExterno: invocar('externo:abrir'),
  janela: { titulo: invocar('janela:titulo'), fechar: invocar('janela:fechar') },
  arquivoPendente: invocar('app:abrirPendente'),
})
