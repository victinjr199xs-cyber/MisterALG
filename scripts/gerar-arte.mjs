// Gera as artes do repositório renderizando HTML no Electron:
//   docs/imagens/banner.png          (1280×420, topo do README)
//   docs/imagens/social-preview.png  (1280×640, prévia ao compartilhar o link)
// Uso (sem ELECTRON_RUN_AS_NODE): electron scripts/gerar-arte.mjs
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const img = (caminho) => `data:image/png;base64,${readFileSync(join(raiz, caminho)).toString('base64')}`
const icone = img('app/build/icon.png')
const print = img('docs/imagens/02-execucao.png')

const estilo = `
  * { box-sizing: border-box; margin: 0; }
  body { width: W; height: H; overflow: hidden; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: radial-gradient(1200px 600px at 15% 20%, #2f5f9e 0%, #0e2a5c 55%, #071735 100%); color: #fff; position: relative; }
  .grade { position: absolute; inset: 0; background-image:
      linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
    background-size: 32px 32px; }
  .faixa { position: absolute; left: 0; right: 0; top: 0; height: 8px;
    background: linear-gradient(90deg, #ff8080 0 33%, #ffff80 33% 66%, #a6caf0 66%); }
  .texto { position: absolute; left: 72px; }
  .marca { display: flex; align-items: center; gap: 22px; }
  .marca img { width: 112px; height: 112px; filter: drop-shadow(0 10px 18px rgba(0,0,0,.4)); }
  h1 { font-size: 76px; font-weight: 800; letter-spacing: -1px; }
  h1 span { color: #ffff80; }
  .slogan { margin-top: 14px; font-size: 27px; color: #d8e6ff; line-height: 1.35; }
  .slogan b { color: #fff; }
  .chips { display: flex; gap: 10px; margin-top: 22px; flex-wrap: wrap; }
  .chip { padding: 7px 16px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25);
    font-size: 19px; font-weight: 600; }
  .codigo { font-family: Consolas, 'Courier New', monospace; color: #a6caf0; }
  .tela { position: absolute; border-radius: 12px; border: 1px solid rgba(255,255,255,.35);
    box-shadow: 0 30px 70px rgba(0,0,0,.55); }
`

const banner = `<!doctype html><html><head><meta charset="utf-8"><style>${estilo.replace('W', '1280px').replace('H', '420px')}</style></head><body>
  <div class="grade"></div><div class="faixa"></div>
  <img class="tela" src="${print}" style="width:560px; right:-70px; top:64px; transform: rotate(3deg)">
  <div class="texto" style="top:78px">
    <div class="marca"><img src="${icone}"><h1>Mister<span>ALG</span></h1></div>
    <p class="slogan">Algoritmos em <b>Portugol</b> no<br><b>Windows</b>, <b>macOS</b> e <b>Linux</b></p>
    <div class="chips"><span class="chip">inspirado no VisuAlg</span><span class="chip">grátis · MIT</span></div>
  </div>
</body></html>`

const social = `<!doctype html><html><head><meta charset="utf-8"><style>${estilo.replace('W', '1280px').replace('H', '640px')}</style></head><body>
  <div class="grade"></div><div class="faixa"></div>
  <img class="tela" src="${print}" style="width:600px; right:-150px; top:150px; transform: rotate(-3deg)">
  <div class="texto" style="top:110px">
    <div class="marca"><img src="${icone}"><h1>Mister<span>ALG</span></h1></div>
    <p class="slogan">Interpretador, editor e depurador<br>de algoritmos em <b>Portugol</b></p>
    <p class="slogan" style="font-size:22px; margin-top:22px">
      <span class="codigo">se</span> você estuda lógica de programação<br><span class="codigo">entao</span> roda no Windows, macOS e Linux
    </p>
    <div class="chips" style="margin-top:34px"><span class="chip">inspirado no VisuAlg</span><span class="chip">código aberto · MIT</span><span class="chip">100% offline</span></div>
  </div>
</body></html>`

async function render(html, largura, altura, destino) {
  const w = new BrowserWindow({ width: largura, height: altura, show: false, frame: false, webPreferences: { offscreen: true } })
  // As imagens embutidas passam do limite de uma URL data:, então usamos um arquivo temporário.
  const temp = join(tmpdir(), `misteralg-arte-${largura}x${altura}.html`)
  writeFileSync(temp, html, 'utf8')
  await w.loadFile(temp)
  await new Promise((r) => setTimeout(r, 700))
  const imagem = await w.webContents.capturePage({ x: 0, y: 0, width: largura, height: altura })
  writeFileSync(join(raiz, destino), imagem.resize({ width: largura, height: altura }).toPNG())
  w.destroy()
  console.log('gravado', destino)
}

// Sem isto o Electron encerra quando a primeira janela é fechada.
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  await render(banner, 1280, 420, 'docs/imagens/banner.png')
  await render(social, 1280, 640, 'docs/imagens/social-preview.png')
  app.quit()
})
