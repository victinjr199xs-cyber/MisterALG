// A página de abertura do app: só a tela inicial, sem a IDE carregada por trás.
// Escolher uma linguagem (ou abrir um arquivo) é o que leva para a IDE (index.html).

import { DICAS } from './dicas.js'
import { telaInicial } from './inicio.js'
import { VERSAO } from '../compartilhado/versao.js'

const api = window.misteralg
const ehMac = api.plataforma === 'darwin'
const irParaIDE = (params) => api.janela.pagina({ pagina: 'ide', params })

// Fechar a janela daqui não tem o que salvar; um arquivo aberto pelo sistema vai direto para a IDE.
api.menu.aoComando((id, dados) => {
  if (id === 'sair') api.janela.fechar()
  else if (id === 'abrir-recente') irParaIDE({ abrir: dados })
})

let prefs = await api.prefs.ler()
// O MisterALG fechou com um algoritmo aberto: a IDE é quem oferece recuperá-lo.
const recuperado = await api.recuperacao.ler()
if (recuperado?.texto) await irParaIDE({})

for (;;) {
  const dica = (prefs.dicaAtual ?? 0) % DICAS.length
  const r = await telaInicial({
    versao: VERSAO,
    recentes: prefs.mru,
    dica: DICAS[dica],
    prefs,
    atalhos: { novo: ehMac ? '⌘N' : 'Ctrl+N', abrir: ehMac ? '⌘O' : 'Ctrl+A' },
  })
  prefs = await api.prefs.gravar({ ...r.prefs, dicaAtual: (dica + 1) % DICAS.length })
  if (r.acao === 'idioma') prefs = await api.prefs.gravar({ idioma: r.idioma })
  else if (r.acao === 'novo') { await irParaIDE({ linguagem: r.linguagem }); break }
  else if (r.acao === 'recente') { await irParaIDE({ abrir: r.caminho }); break }
  else if (r.acao === 'abrir') {
    const lido = await api.arquivo.abrir() // só para escolher; a IDE lê o arquivo de novo pelo caminho
    if (lido?.caminho) { await irParaIDE({ abrir: lido.caminho }); break }
  }
}
