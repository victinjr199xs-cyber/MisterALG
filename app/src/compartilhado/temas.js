// Temas de cores da IDE. As cores ficam em estilos/visualg.css (html[data-tema]);
// aqui só o que o main e o renderer precisam saber: nome, cor da janela antes de
// a página pintar e se o tema é escuro (menus, diálogos nativos e barras de rolagem).

export const TEMAS = [
  { id: 'classico', nome: 'Clássico (VisuAlg)', fundo: '#c0dcc0', escuro: false },
  { id: 'escuro', nome: 'Escuro', fundo: '#181818', escuro: true },
  { id: 'meia-noite', nome: 'Meia-noite', fundo: '#16161e', escuro: true },
  { id: 'dracula', nome: 'Drácula', fundo: '#21222c', escuro: true },
  { id: 'terminal', nome: 'Terminal (fósforo verde)', fundo: '#000000', escuro: true },
  { id: 'sepia', nome: 'Sépia (papel)', fundo: '#e9dfc7', escuro: false },
]

export const temaPorId = (id) => TEMAS.find((t) => t.id === id) ?? TEMAS[0]
