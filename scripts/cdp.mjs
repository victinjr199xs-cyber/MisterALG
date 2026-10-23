// Controle do app via Chrome DevTools Protocol, para testes de fumaça da IDE.
// Uso: node scripts/cdp.mjs <porta> <arquivo-de-passos.mjs>
// O arquivo de passos exporta `default async ({ avaliar, foto, tecla, esperar }) => {...}`.

import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const [porta = '9333', roteiro] = process.argv.slice(2)

async function alvo() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${porta}/json`)).json()
      // A tela de abertura (data: URL, sem JavaScript) não é a IDE.
      const pagina = lista.find((t) => t.type === 'page' && !t.url.startsWith('data:'))
      if (pagina) return pagina.webSocketDebuggerUrl
    } catch {
      // app ainda subindo
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('não achei a página do app')
}

const ws = new WebSocket(await alvo())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pendentes = new Map()
const erros = []
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pendentes.has(msg.id)) {
    pendentes.get(msg.id)(msg)
    pendentes.delete(msg.id)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    erros.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    erros.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
  }
})
const enviar = (method, params = {}) => new Promise((res, rej) => {
  id += 1
  const meu = id
  const limite = setTimeout(() => {
    pendentes.delete(meu)
    rej(new Error(`sem resposta do app para ${method} ${JSON.stringify(params).slice(0, 120)}`))
  }, 15000)
  pendentes.set(meu, (msg) => {
    clearTimeout(limite)
    res(msg)
  })
  ws.send(JSON.stringify({ id: meu, method, params }))
})

await enviar('Runtime.enable')
await enviar('Page.enable')

const ferramentas = {
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  async avaliar(expr) {
    const r = await enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'erro')
    return r.result?.result?.value
  },
  async foto(arquivo) {
    await enviar('Page.bringToFront')
    await new Promise((r) => setTimeout(r, 400))
    const r = await enviar('Page.captureScreenshot', { format: 'png' })
    writeFileSync(arquivo, Buffer.from(r.result.data, 'base64'))
  },
  /** tecla('F9'), tecla('F2', ['Control']), tecla('Enter') */
  async tecla(key, mods = [], code) {
    const bits = { Alt: 1, Control: 2, Meta: 4, Shift: 8 }
    const modifiers = mods.reduce((s, m) => s | bits[m], 0)
    const vk = { F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F7: 118, F8: 119, F9: 120, Enter: 13, Escape: 27 }[key]
    const base = { key, code: code ?? key, modifiers, windowsVirtualKeyCode: vk ?? key.toUpperCase().charCodeAt(0) }
    await enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
    await enviar('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  },
  async digitar(texto) {
    await enviar('Input.insertText', { text: texto })
  },
  erros,
}

const passos = (await import(pathToFileURL(resolve(roteiro)).href)).default
try {
  await passos(ferramentas)
} finally {
  if (erros.length) console.log('ERROS NO CONSOLE DA PÁGINA:\n' + erros.join('\n'))
  ws.close()
}
