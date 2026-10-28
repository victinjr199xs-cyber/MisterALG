// Temas de cores da IDE. As cores ficam em estilos/visualg.css (html[data-tema]);
// aqui só o que o main e o renderer precisam saber: nome, cor da janela antes de
// a página pintar, se o tema é escuro (menus, diálogos nativos e barras de
// rolagem), uma amostra (fundo do editor + 3 cores do código) para o botão de temas
// e os 3 acentos dos ícones da barra (ok = executar, perigo = parar/breakpoint,
// acento = passo/timer/assistente/avatar), todos com contraste >= 3:1 contra `fundo`.

export const TEMAS = [
  { id: 'classico', nome: 'Clássico (VisuAlg)', fundo: '#c0dcc0', escuro: false, amostra: ['#ffffff', '#0000a0', '#000000', '#ff0000'], icones: { ok: '#1a7a1a', perigo: '#b00000', acento: '#1c4fb0' } },
  { id: 'escuro', nome: 'Escuro', fundo: '#181818', escuro: true, amostra: ['#1e1e1e', '#569cd6', '#9cdcfe', '#ce9178'], icones: { ok: '#4ec96a', perigo: '#ff6b6b', acento: '#6cb6ff' } },
  { id: 'meia-noite', nome: 'Meia-noite', fundo: '#16161e', escuro: true, amostra: ['#1a1b26', '#7aa2f7', '#9ece6a', '#ff9e64'], icones: { ok: '#9ece6a', perigo: '#f7768e', acento: '#7aa2f7' } },
  { id: 'dracula', nome: 'Drácula', fundo: '#21222c', escuro: true, amostra: ['#282a36', '#ff79c6', '#f8f8f2', '#f1fa8c'], icones: { ok: '#50fa7b', perigo: '#ff5555', acento: '#bd93f9' } },
  { id: 'terminal', nome: 'Terminal (fósforo verde)', fundo: '#000000', escuro: true, amostra: ['#000000', '#5fd7ff', '#33ff66', '#ffaf00'], icones: { ok: '#33ff66', perigo: '#ff5555', acento: '#ffb000' } },
  { id: 'sepia', nome: 'Sépia (papel)', fundo: '#e9dfc7', escuro: false, amostra: ['#fbf4e2', '#1f5f9f', '#3b3226', '#b5481a'], icones: { ok: '#2f6b1f', perigo: '#a8321a', acento: '#1f5f9f' } },
]

export const temaPorId = (id) => TEMAS.find((t) => t.id === id) ?? TEMAS[0]
