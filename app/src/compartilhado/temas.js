// Temas de cores da IDE. As cores ficam em estilos/visualg.css (html[data-tema]);
// aqui só o que o main e o renderer precisam saber: nome, cor da janela antes de
// a página pintar, se o tema é escuro (menus, diálogos nativos e barras de
// rolagem), uma amostra (fundo do editor + 3 cores do código) para o botão de temas
// e os 3 acentos dos ícones da barra (ok = executar, perigo = parar/breakpoint,
// acento = passo/timer/assistente/avatar), todos com contraste >= 3:1 contra `fundo`.

export const TEMAS = [
  { id: 'classico', nome: 'VisuAlg Clássico', fundo: '#c0dcc0', escuro: false, amostra: ['#ffffff', '#0000a0', '#000000', '#ff0000'], icones: { ok: '#1a7a1a', perigo: '#b00000', acento: '#1c4fb0' } },
  { id: 'escuro', nome: 'Escuro', fundo: '#181818', escuro: true, amostra: ['#1e1e1e', '#569cd6', '#9cdcfe', '#ce9178'], icones: { ok: '#4ec96a', perigo: '#ff6b6b', acento: '#6cb6ff' } },
  { id: 'meia-noite', nome: 'Meia-noite', fundo: '#16161e', escuro: true, amostra: ['#1a1b26', '#7aa2f7', '#9ece6a', '#ff9e64'], icones: { ok: '#9ece6a', perigo: '#f7768e', acento: '#7aa2f7' } },
  { id: 'dracula', nome: 'Drácula', fundo: '#21222c', escuro: true, amostra: ['#282a36', '#ff79c6', '#f8f8f2', '#f1fa8c'], icones: { ok: '#50fa7b', perigo: '#ff5555', acento: '#bd93f9' } },
  { id: 'terminal', nome: 'Terminal (fósforo verde)', fundo: '#000000', escuro: true, amostra: ['#000000', '#5fd7ff', '#33ff66', '#ffaf00'], icones: { ok: '#33ff66', perigo: '#ff5555', acento: '#ffb000' } },
  { id: 'sepia', nome: 'Sépia (papel)', fundo: '#e9dfc7', escuro: false, amostra: ['#fbf4e2', '#1f5f9f', '#3b3226', '#b5481a'], icones: { ok: '#2f6b1f', perigo: '#a8321a', acento: '#1f5f9f' } },
  { id: 'noite', nome: 'Noite', fundo: '#1e1f22', escuro: true, amostra: ['#313338', '#b4a7ff', '#7ee0a0', '#ffb86b'], icones: { ok: '#3ec46d', perigo: '#ff6b6e', acento: '#8ab4ff' } },
  { id: 'papel', nome: 'Papel', fundo: '#f7f6f3', escuro: false, amostra: ['#fdfdfc', '#a6389c', '#37352f', '#1c7a4d'], icones: { ok: '#1c7a4d', perigo: '#c9372c', acento: '#0b6bcb' } },
  { id: 'hibrido-claro', nome: 'Híbrido claro', fundo: '#e9e8f5', escuro: false, amostra: ['#fcfcff', '#6d3fe0', '#c2570c', '#0f8a5f'], icones: { ok: '#0f8a5f', perigo: '#d03a4a', acento: '#5b4be8' } },
  { id: 'hibrido-escuro', nome: 'Híbrido escuro', fundo: '#100f1b', escuro: true, amostra: ['#1d1c2f', '#b6a9ff', '#ffb86b', '#7ee8b4'], icones: { ok: '#4be0a0', perigo: '#ff8a94', acento: '#8b7cff' } },
]

export const temaPorId = (id) => TEMAS.find((t) => t.id === id) ?? TEMAS[0]
