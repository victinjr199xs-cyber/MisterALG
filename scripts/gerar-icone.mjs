// Gera app/build/icon.png (1024×1024) renderizando HTML no Electron.
// Uso (sem ELECTRON_RUN_AS_NODE): electron scripts/gerar-icone.mjs
import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const destino = fileURLToPath(new URL('../app/build/icon.png', import.meta.url))

const html = `<!doctype html><html><body style="margin:0;width:1024px;height:1024px;background:transparent">
<div style="position:absolute;inset:100px;border-radius:200px;background:linear-gradient(160deg,#3a6ea5,#0a246a);
  box-shadow:0 30px 60px rgba(0,0,0,.35);overflow:hidden">
  <div style="position:absolute;left:0;right:0;top:0;height:150px;background:#c0dcc0"></div>
  <div style="position:absolute;left:52px;top:46px;width:56px;height:56px;border-radius:50%;background:#ff8080"></div>
  <div style="position:absolute;left:130px;top:46px;width:56px;height:56px;border-radius:50%;background:#ffff80"></div>
  <div style="position:absolute;left:208px;top:46px;width:56px;height:56px;border-radius:50%;background:#a6caf0"></div>
  <div style="position:absolute;left:0;right:0;top:190px;text-align:center;font:900 330px/1 'Arial Black',Arial,sans-serif;color:#fff;letter-spacing:-10px">M</div>
  <div style="position:absolute;left:0;right:0;top:560px;text-align:center;font:700 150px/1 Consolas,'Courier New',monospace;color:#ffff80">ALG</div>
  <div style="position:absolute;left:150px;right:150px;top:740px;height:22px;background:#ffffff55;border-radius:11px"></div>
</div></body></html>`

app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  await w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((r) => setTimeout(r, 500))
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })
  writeFileSync(destino, img.resize({ width: 1024, height: 1024 }).toPNG())
  console.log('ícone gravado em', destino)
  app.quit()
})
