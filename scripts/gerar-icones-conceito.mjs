// Gera conceitos de ícone (1024×1024) e uma folha comparativa.
// Uso (sem ELECTRON_RUN_AS_NODE): electron scripts/gerar-icones-conceito.mjs
import { app, BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const pasta = join(raiz, 'docs', 'imagens', 'icones')
mkdirSync(pasta, { recursive: true })

// Formato "squircle" do macOS: corpo de 824 px centrado, cantos de ~185 px.
const base = (conteudo, defs = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1024px;height:1024px;background:transparent;overflow:hidden}
  svg{display:block}
</style></head><body>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="corpo"><rect x="100" y="100" width="824" height="824" rx="186"/></clipPath>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#000" flood-opacity=".38"/>
    </filter>
    <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="borrao"><feGaussianBlur stdDeviation="28"/></filter>
    <linearGradient id="vidro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    ${defs}
  </defs>
  ${conteudo}
</svg></body></html>`

// ---- 1. Fluxo Vivo -----------------------------------------------------------
const fluxo = base(`
  <g filter="url(#sombra)"><rect x="100" y="100" width="824" height="824" rx="186" fill="url(#fundo1)"/></g>
  <g clip-path="url(#corpo)">
    <circle cx="260" cy="230" r="360" fill="#7b5cff" opacity=".35" filter="url(#borrao)"/>
    <circle cx="860" cy="880" r="300" fill="#00d4ff" opacity=".28" filter="url(#borrao)"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${160 + (i % 3) * 30}" y="${190 + i * 76}" width="${120 + ((i * 53) % 150)}" height="14" rx="7" fill="#fff" opacity=".07"/>`).join('')}
    <rect x="100" y="100" width="824" height="420" fill="url(#vidro)" opacity=".55"/>
  </g>
  <g filter="url(#brilho)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M300 730 V330 L512 575 L724 330 V730" stroke="url(#traco1)" stroke-width="74"/>
  </g>
  <g>
    <rect x="452" y="515" width="120" height="120" rx="18" transform="rotate(45 512 575)" fill="#fff" stroke="#ffe066" stroke-width="10"/>
    <text x="512" y="597" text-anchor="middle" font-family="Consolas, monospace" font-weight="700" font-size="58" fill="#3a1d8f">?</text>
    <circle cx="300" cy="330" r="34" fill="#ffe066"/><circle cx="724" cy="330" r="34" fill="#7df9ff"/>
    <circle cx="300" cy="730" r="22" fill="#fff"/><circle cx="724" cy="730" r="22" fill="#fff"/>
    ${[0, 1, 2, 3].map((k) => `<circle cx="${724}" cy="${430 + k * 75}" r="${12 - k * 2}" fill="#fff" opacity="${0.95 - k * 0.2}"/>`).join('')}
  </g>
`, `
  <linearGradient id="fundo1" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2a1b7a"/><stop offset=".55" stop-color="#3b1c8c"/><stop offset="1" stop-color="#0b4f86"/>
  </linearGradient>
  <linearGradient id="traco1" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffe066"/><stop offset=".5" stop-color="#ff8fb1"/><stop offset="1" stop-color="#7df9ff"/>
  </linearGradient>
`)

// ---- 2. Console 3D ---------------------------------------------------------------
const linhaCodigo = (y, partes, destaque = false) => `
  ${destaque ? `<rect x="196" y="${y - 30}" width="632" height="44" rx="6" fill="#1f5cff"/>` : ''}
  <text x="214" y="${y}" font-family="Consolas, 'Courier New', monospace" font-size="30" font-weight="700">
    ${partes.map(([t, c]) => `<tspan fill="${destaque ? '#fff' : c}">${t}</tspan>`).join('')}
  </text>`
const console3d = base(`
  <g filter="url(#sombra)"><rect x="100" y="100" width="824" height="824" rx="186" fill="url(#fundo2)"/></g>
  <g clip-path="url(#corpo)">
    <circle cx="512" cy="980" r="420" fill="#00e0c6" opacity=".25" filter="url(#borrao)"/>
    <circle cx="200" cy="160" r="260" fill="#a6caf0" opacity=".25" filter="url(#borrao)"/>
    <g transform="translate(512 470) skewY(-6) scale(1 .96) translate(-512 -470)">
      <rect x="170" y="210" width="684" height="520" rx="26" fill="#0b1426" stroke="#ffffff" stroke-opacity=".35" stroke-width="3"/>
      <path d="M170 236 a26 26 0 0 1 26 -26 h632 a26 26 0 0 1 26 26 v40 h-684z" fill="#c0dcc0"/>
      <circle cx="214" cy="244" r="13" fill="#ff8080"/><circle cx="254" cy="244" r="13" fill="#ffff80"/><circle cx="294" cy="244" r="13" fill="#a6caf0"/>
      ${linhaCodigo(338, [['algoritmo ', '#4d8bff'], ['"ola"', '#ff6b6b']])}
      ${linhaCodigo(398, [['inicio', '#4d8bff']])}
      ${linhaCodigo(458, [['  para ', '#9fb7ff'], ['i ', '#fff'], ['de ', '#9fb7ff'], ['1 ', '#ff6b6b'], ['ate ', '#9fb7ff'], ['3', '#ff6b6b']], true)}
      ${linhaCodigo(518, [['    escreval', '#9fb7ff'], ['(i)', '#fff']])}
      ${linhaCodigo(578, [['  fimpara', '#9fb7ff']])}
      ${linhaCodigo(638, [['fimalgoritmo', '#4d8bff']])}
      <rect x="172" y="212" width="680" height="200" rx="24" fill="url(#vidro)" opacity=".35"/>
    </g>
    <circle cx="742" cy="760" r="118" fill="url(#ouro)" stroke="#fff" stroke-opacity=".6" stroke-width="6" filter="url(#brilho)"/>
    <text x="742" y="800" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-weight="900" font-size="120" fill="#3d2a00">M</text>
  </g>
`, `
  <linearGradient id="fundo2" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#16325f"/><stop offset=".6" stop-color="#0e2445"/><stop offset="1" stop-color="#063a3f"/>
  </linearGradient>
  <radialGradient id="ouro" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#fff6b0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#d98a00"/>
  </radialGradient>
`)

// ---- 3. Diamante de Decisão --------------------------------------------------------
const diamante = base(`
  <g filter="url(#sombra)"><rect x="100" y="100" width="824" height="824" rx="186" fill="url(#fundo3)"/></g>
  <g clip-path="url(#corpo)">
    <g filter="url(#borrao)" opacity=".85">
      <polygon points="512,560 100,980 330,980" fill="#ff8080"/>
      <polygon points="512,560 400,1000 640,1000" fill="#ffff80"/>
      <polygon points="512,560 700,980 940,960" fill="#a6caf0"/>
    </g>
    <polygon points="512,600 130,960 300,960" fill="#ff8080" opacity=".7"/>
    <polygon points="512,600 425,980 605,980" fill="#ffff80" opacity=".7"/>
    <polygon points="512,600 735,960 905,940" fill="#a6caf0" opacity=".7"/>
    ${[[240, 250, 6], [800, 230, 4], [860, 470, 5], [190, 520, 3], [690, 170, 3]].map(([x, y, r]) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".9"/>`).join('')}
  </g>
  <g filter="url(#brilho)">
    <polygon points="512,150 834,472 512,794 190,472" fill="url(#cristal)" stroke="#ffffff" stroke-width="9" stroke-opacity=".95"/>
  </g>
  <polygon points="512,150 834,472 512,472 190,472" fill="#fff" opacity=".13"/>
  <polygon points="512,150 650,288 512,472 374,288" fill="#fff" opacity=".14"/>
  <polygon points="512,794 834,472 512,472" fill="#000" opacity=".12"/>
  <polyline points="300,420 512,208 600,296" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".55"/>
  <text x="512" y="562" text-anchor="middle" font-family="'Segoe UI', 'Arial Black', Arial, sans-serif" font-weight="900" font-size="250" fill="#071535" opacity=".35" letter-spacing="-6" transform="translate(6 10)">M</text>
  <text x="512" y="562" text-anchor="middle" font-family="'Segoe UI', 'Arial Black', Arial, sans-serif" font-weight="900" font-size="250" fill="url(#letra)" letter-spacing="-6">M</text>
`, `
  <linearGradient id="letra" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#ffffff"/><stop offset="1" stop-color="#ffe9a8"/>
  </linearGradient>
  <radialGradient id="fundo3" cx=".5" cy=".35" r=".85">
    <stop offset="0" stop-color="#23407a"/><stop offset=".6" stop-color="#0e1f45"/><stop offset="1" stop-color="#050b1f"/>
  </radialGradient>
  <linearGradient id="cristal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7fb2ff"/><stop offset=".5" stop-color="#3d5bd9"/><stop offset="1" stop-color="#6a2fd0"/>
  </linearGradient>
`)

// Ícone oficial (escolhido pelo autor do projeto): Fluxo Vivo.
const ESCOLHIDO = '1-fluxo-vivo'

const CONCEITOS = [
  ['1-fluxo-vivo', fluxo, 'Fluxo Vivo'],
  ['2-console-3d', console3d, 'Console 3D'],
  ['3-diamante', diamante, 'Diamante de Decisão'],
]

async function render(html, largura, altura, destino) {
  const w = new BrowserWindow({ width: largura, height: altura, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } })
  const temp = join(tmpdir(), `misteralg-icone-${largura}x${altura}.html`)
  writeFileSync(temp, html, 'utf8')
  await w.loadFile(temp)
  await new Promise((r) => setTimeout(r, 700))
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: largura, height: altura })
  writeFileSync(destino, img.resize({ width: largura, height: altura }).toPNG())
  w.destroy()
}

app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  for (const [nome, html] of CONCEITOS) {
    await render(html, 1024, 1024, join(pasta, `${nome}.png`))
    console.log('ícone', nome)
  }
  const dataUri = (n) => `data:image/png;base64,${readFileSync(join(pasta, `${n}.png`)).toString('base64')}`
  const folha = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;width:1800px;height:760px;background:linear-gradient(#f4f6fb,#dfe5f1);font-family:'Segoe UI',Arial,sans-serif;display:flex;justify-content:space-around;align-items:center}
    figure{margin:0;text-align:center} img{width:480px;height:480px}
    .peq{display:flex;gap:18px;justify-content:center;align-items:end;margin-top:10px} .peq img{width:auto}
    figcaption{font-size:34px;font-weight:700;color:#1c2b4a;margin-top:6px} .n{display:inline-block;width:46px;height:46px;border-radius:50%;background:#1c2b4a;color:#fff;line-height:46px;margin-right:10px}
  </style></head><body>
  ${CONCEITOS.map(([n, , rotulo], i) => `<figure><img src="${dataUri(n)}"><div class="peq"><img src="${dataUri(n)}" style="height:96px"><img src="${dataUri(n)}" style="height:48px"><img src="${dataUri(n)}" style="height:24px"></div><figcaption><span class="n">${i + 1}</span>${rotulo}</figcaption></figure>`).join('')}
  </body></html>`
  await render(folha, 1800, 760, join(pasta, 'comparacao.png'))
  console.log('folha comparativa pronta')
  // Copia o ícone oficial para o app.
  writeFileSync(join(raiz, 'app', 'build', 'icon.png'), readFileSync(join(pasta, `${ESCOLHIDO}.png`)))
  console.log('app/build/icon.png ←', ESCOLHIDO)
  app.quit()
})
