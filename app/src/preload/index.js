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
  clang: {
    aquecer: invocar('clang:aquecer'),
    executar: invocar('clang:executar'),
    arvore: invocar('clang:arvore'),
    verificar: invocar('clang:verificar'),
    entrada: invocar('clang:entrada'),
    parar: invocar('clang:parar'),
    aoEvento(fn) {
      const ouvinte = (_e, id, evento) => fn(id, evento)
      ipcRenderer.on('clang:evento', ouvinte)
      return () => ipcRenderer.removeListener('clang:evento', ouvinte)
    },
  },
  // Python e PHP: programas que rodam num processo à parte (main/programas.js).
  programa: {
    aquecer: invocar('programa:aquecer'),
    iniciar: invocar('programa:iniciar'),
    comando: (id, cmd) => ipcRenderer.invoke('programa:comando', { id, cmd }),
    parar: invocar('programa:parar'),
    aoEvento(fn) {
      const ouvinte = (_e, id, evento) => fn(id, evento)
      ipcRenderer.on('programa:evento', ouvinte)
      return () => ipcRenderer.removeListener('programa:evento', ouvinte)
    },
  },
  csharp: {
    analisar: invocar('csharp:analisar'),
    preludio: invocar('csharp:preludio'),
    aquecer: invocar('csharp:aquecer'),
  },
  php: {
    aquecer: invocar('php:aquecer'),
    definir: invocar('php:definir'),
    ultima: invocar('php:ultima'),
    aoResponder(fn) {
      const ouvinte = (_e, resposta) => fn(resposta)
      ipcRenderer.on('php:resposta', ouvinte)
      return () => ipcRenderer.removeListener('php:resposta', ouvinte)
    },
  },
  ia: {
    chaves: invocar('ia:chaves'),
    gravarChave: invocar('ia:gravarChave'),
    perguntar: invocar('ia:perguntar'),
    cancelar: invocar('ia:cancelar'),
    aoReceber(fn) {
      const ouvinte = (_e, id, pedaco) => fn(id, pedaco)
      ipcRenderer.on('ia:parte', ouvinte)
      return () => ipcRenderer.removeListener('ia:parte', ouvinte)
    },
  },
  arquivoPendente: invocar('app:abrirPendente'),
})
