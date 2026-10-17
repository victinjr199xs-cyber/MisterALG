// Ícones da barra de ferramentas (SVG 24×24 desenhados para o MisterALG,
// inspirados nos desenhos do VisuAlg: folha, pasta, disquete, binóculo...).

// O "papel" branco dos ícones ganha a cor do tema (.papel no CSS), senão vira
// uma mancha branca nos temas escuros.
const svg = (corpo) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${corpo.replaceAll('fill="#fff"', 'class="papel"')}</svg>`

const folha = '<path d="M6 2.5h8l4 4V21.5H6z" fill="#fff"/><path d="M14 2.5v4h4"/>'

export const ICONES = {
  novo: svg(folha),
  abrir: svg('<path d="M2.5 6.5h6l2 2h9v10.5h-17z" fill="#f6d365" stroke="#8a6d00"/><path d="M2.5 19l3-7h16l-3 7" fill="#fbe39b" stroke="#8a6d00"/>'),
  salvar: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="#5b7fc7" stroke="#20365f"/><rect x="7" y="4" width="10" height="6" fill="#fff" stroke="#20365f"/><rect x="7" y="13.5" width="10" height="6.5" fill="#dfe7f5" stroke="#20365f"/>'),
  executar: svg(`${folha}<path d="M10 9.5l5 3-5 3z" fill="#1c5ad6" stroke="#1c5ad6"/>`),
  passo: svg('<path d="M4 6h9M4 10h6M4 14h9M4 18h6" stroke-dasharray="1.5 2"/><path d="M14 13l3-6 2 1-1.5 5h3.5v5h-7z" fill="#f5d0a9" stroke="#7a4a1d"/>'),
  timer: svg('<circle cx="12" cy="13" r="8" fill="#fff"/><path d="M12 8.5v4.5l3 2M9.5 2.5h5"/>'),
  parar: svg('<circle cx="12" cy="12" r="8.5" fill="#fff" stroke="#c00000" stroke-width="2.4"/><path d="M6 18L18 6" stroke="#c00000" stroke-width="2.4"/>'),
  breakpoint: svg('<circle cx="12" cy="12" r="6.5" fill="#c00000" stroke="#600000"/><path d="M3 12h2.5M18.5 12H21"/>'),
  limparBreakpoints: svg('<circle cx="10" cy="12" r="5.5" fill="#c00000" stroke="#600000"/><path d="M15 15l6 6M21 15l-6 6" stroke="#c00000" stroke-width="2"/>'),
  restaurar: svg(`${folha}<path d="M8.5 13.5h7m-2.5-2.5 2.5 2.5-2.5 2.5" stroke="#c00000"/>`),
  cortar: svg('<circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/><path d="M8.8 14.6 17 3M15.2 14.6 7 3"/>'),
  copiar: svg('<rect x="8" y="7" width="12" height="14" rx="1" fill="#fff"/><path d="M5 17V4h11"/>'),
  colar: svg('<rect x="5" y="4.5" width="14" height="17" rx="1.5" fill="#d9b382" stroke="#6b4a1f"/><rect x="8.5" y="2.5" width="7" height="4" rx="1" fill="#ddd"/><rect x="8" y="9" width="8" height="10" fill="#fff"/>'),
  gravarBloco: svg('<path d="M2.5 6.5h6l2 2h9v10.5h-17z" fill="#f6d365" stroke="#8a6d00"/><path d="M12 11v6m-3-3 3-3 3 3" stroke="#c00000" stroke-width="2"/>'),
  inserirBloco: svg('<path d="M10 5h10M10 9h10M10 15h10M10 19h10"/><path d="M3 12h7m-3-3 3 3-3 3" stroke="#c00000" stroke-width="2"/>'),
  desfazer: svg('<path d="M9 7 4 12l5 5" stroke="#1c5ad6" stroke-width="2"/><path d="M4 12h10a6 6 0 0 1 0 12" stroke="#1c5ad6" stroke-width="2" transform="translate(0 -6)"/>'),
  refazer: svg('<path d="m15 7 5 5-5 5" stroke="#1c5ad6" stroke-width="2"/><path d="M20 12H10a6 6 0 0 0 0 12" stroke="#1c5ad6" stroke-width="2" transform="translate(0 -6)"/>'),
  localizar: svg('<circle cx="7" cy="14" r="4" fill="#cfe0f7"/><circle cx="17" cy="14" r="4" fill="#cfe0f7"/><path d="M11 14h2M5 10l2-5h3l1 5M19 10l-2-5h-3l-1 5"/>'),
  proximo: svg('<circle cx="7" cy="15" r="3.5" fill="#cfe0f7"/><circle cx="15" cy="15" r="3.5" fill="#cfe0f7"/><path d="M10.5 15h1M16 4h5m-2-2 2 2-2 2" stroke="#1c5ad6" stroke-width="2"/>'),
  anterior: svg('<circle cx="9" cy="15" r="3.5" fill="#cfe0f7"/><circle cx="17" cy="15" r="3.5" fill="#cfe0f7"/><path d="M12.5 15h1M8 4H3m2-2-2 2 2 2" stroke="#1c5ad6" stroke-width="2"/>'),
  substituir: svg('<text x="2" y="11" font-size="9" font-weight="700" fill="currentColor" stroke="none">A</text><text x="14" y="21" font-size="9" font-weight="700" fill="#c00000" stroke="none">B</text><path d="M9 7h6l-2-2m2 2-2 2M15 17H9l2 2m-2-2 2-2"/>'),
  indentar: svg('<path d="M4 5h16M9 9.5h11M9 14h11M4 18.5h16"/><path d="M3 9.5l3 2.25L3 14" stroke="#c00000"/>'),
  imprimir: svg('<rect x="6" y="3" width="12" height="6" fill="#fff"/><rect x="3" y="9" width="18" height="8" rx="1.5" fill="#d0d0d0"/><rect x="6.5" y="14" width="11" height="7" fill="#fff"/>'),
  perfil: svg(`${folha}<circle cx="11" cy="13" r="3"/><path d="m13.2 15.2 3 3" stroke-width="2"/>`),
  aleatorio: svg('<path d="M4 20 15 9" stroke="#6b3f1d" stroke-width="2.4"/><path d="M17 3v4M15 5h4M20 9v3M18.5 10.5h3M12 3.5v2M11 4.5h2" stroke="#d4a000"/>'),
  pilha: svg('<rect x="5" y="4" width="14" height="4" fill="#fff"/><rect x="5" y="10" width="14" height="4" fill="#fff"/><rect x="5" y="16" width="14" height="4" fill="#cfe0f7"/><path d="M21 6v12" stroke="#c00000"/>'),
  calculadora: svg('<rect x="5" y="2.5" width="14" height="19" rx="2" fill="#e8e8e8"/><rect x="7.5" y="5" width="9" height="4" fill="#cfe8cf"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" stroke-width="2.6"/>'),
  calendario: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="1.5" fill="#fff"/><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M7 13h2M11 13h2M15 13h2M7 16.5h2M11 16.5h2" stroke="#1c5ad6"/>'),
  ajuda: svg('<circle cx="12" cy="12" r="9" fill="#fff"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7V14"/><path d="M12 17.5h.01" stroke-width="2.4"/>'),
  sair: svg('<path d="M4 3.5h9v17H4z" fill="#f6d365" stroke="#8a6d00"/><path d="M13 12h8m-3-3 3 3-3 3" stroke="#c00000" stroke-width="2"/>'),
}
