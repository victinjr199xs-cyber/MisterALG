// Temas de cores da IDE. As cores ficam em estilos/visualg.css (html[data-tema]);
// aqui só o que o main e o renderer precisam saber: nome, cor da janela antes de
// a página pintar, se o tema é escuro (menus, diálogos nativos e barras de
// rolagem) e uma amostra (fundo do editor + 3 cores do código) para o botão de temas.

export const TEMAS = [
  { id: 'classico', nome: 'Clássico (VisuAlg)', fundo: '#c0dcc0', escuro: false, amostra: ['#ffffff', '#0000a0', '#000000', '#ff0000'] },
  { id: 'escuro', nome: 'Escuro', fundo: '#181818', escuro: true, amostra: ['#1e1e1e', '#569cd6', '#9cdcfe', '#ce9178'] },
  { id: 'meia-noite', nome: 'Meia-noite', fundo: '#16161e', escuro: true, amostra: ['#1a1b26', '#7aa2f7', '#9ece6a', '#ff9e64'] },
  { id: 'dracula', nome: 'Drácula', fundo: '#21222c', escuro: true, amostra: ['#282a36', '#ff79c6', '#f8f8f2', '#f1fa8c'] },
  { id: 'terminal', nome: 'Terminal (fósforo verde)', fundo: '#000000', escuro: true, amostra: ['#000000', '#5fd7ff', '#33ff66', '#ffaf00'] },
  { id: 'sepia', nome: 'Sépia (papel)', fundo: '#e9dfc7', escuro: false, amostra: ['#fbf4e2', '#1f5f9f', '#3b3226', '#b5481a'] },
]

export const temaPorId = (id) => TEMAS.find((t) => t.id === id) ?? TEMAS[0]
