// Ícone "Fluxo Vivo" em SVG (o mesmo desenho de scripts/gerar-icones-conceito.mjs),
// usado pela tela de abertura (main) e pela tela inicial (renderer). Cada lugar
// anima as classes m-* no seu próprio CSS.

export const ICONE_SVG = `<svg class="marca" viewBox="100 100 824 824" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="m-fundo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2a1b7a"/><stop offset=".55" stop-color="#3b1c8c"/><stop offset="1" stop-color="#0b4f86"/>
    </linearGradient>
    <linearGradient id="m-tinta" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffe066"/><stop offset=".5" stop-color="#ff8fb1"/><stop offset="1" stop-color="#7df9ff"/>
    </linearGradient>
    <filter id="m-brilho" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="m-borrao"><feGaussianBlur stdDeviation="28"/></filter>
    <clipPath id="m-corpo"><rect x="100" y="100" width="824" height="824" rx="186"/></clipPath>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#m-fundo)"/>
  <g clip-path="url(#m-corpo)">
    <circle cx="260" cy="230" r="360" fill="#7b5cff" opacity=".35" filter="url(#m-borrao)"/>
    <circle cx="860" cy="880" r="300" fill="#00d4ff" opacity=".28" filter="url(#m-borrao)"/>
  </g>
  <path class="m-traco" d="M300 730 V330 L512 575 L724 330 V730" pathLength="100" fill="none" stroke="url(#m-tinta)"
    stroke-width="74" stroke-linecap="round" stroke-linejoin="round" filter="url(#m-brilho)"/>
  <g class="m-losango">
    <rect x="452" y="515" width="120" height="120" rx="18" transform="rotate(45 512 575)" fill="#fff" stroke="#ffe066" stroke-width="10"/>
    <text x="512" y="597" text-anchor="middle" font-family="Consolas, Menlo, monospace" font-weight="700" font-size="58" fill="#3a1d8f">?</text>
  </g>
  <circle class="m-ponto" cx="300" cy="330" r="34" fill="#ffe066"/>
  <circle class="m-ponto" cx="724" cy="330" r="34" fill="#7df9ff"/>
  <circle class="m-ponto" cx="300" cy="730" r="22" fill="#fff"/>
  <circle class="m-ponto" cx="724" cy="730" r="22" fill="#fff"/>
  ${[0, 1, 2, 3].map((k) => `<circle class="m-rastro" style="--i:${k}" cx="724" cy="${430 + k * 75}" r="${12 - k * 2}" fill="#fff"/>`).join('')}
</svg>`
