// Teste do X da janela (segundo plano/fechar), da bandeja e de "Abrir quando o computador ligar" no Windows.
// Uso (PowerShell, na raiz do repositório, depois de `npm run build` em app/): node scripts/teste-sistema.mjs
// Usa MISTERALG_TESTE_SISTEMA=1 (faz o app se comportar como o instalado, mesmo com pasta de dados própria).
// Mexe na chave HKCU\...\Run (valor "MisterALG") e a limpa no final. Porta de depuração: 9334.

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const raiz = resolve(import.meta.dirname, '..')
const electron = resolve(raiz, 'node_modules/electron/dist/electron.exe')
const PORTA = 9334
const CHAVE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
let falhas = 0
const conferir = (nome, ok, extra = '') => {
  console.log(`${ok ? 'OK ' : 'ERRO'} ${nome}${extra ? ` -> ${extra}` : ''}`)
  if (!ok) falhas += 1
}
const ps = (cmd) => execFileSync('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(cmd, 'utf16le').toString('base64')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const vivo = (pid) => ps(`(Get-Process -Id ${pid} -ErrorAction SilentlyContinue) -ne $null`) === 'True'
const registro = () => { try { return ps(`(Get-ItemProperty '${CHAVE.replace('HKCU\\', 'HKCU:\\')}' -Name MisterALG -ErrorAction Stop).MisterALG`) } catch { return null } }

function iniciar(dados, extraEnv = {}) {
  const env = { ...process.env, MISTERALG_DADOS: dados, MISTERALG_TESTE_SISTEMA: '1', ...extraEnv }
  delete env.ELECTRON_RUN_AS_NODE
  const filho = spawn(electron, ['out/main/index.js', `--remote-debugging-port=${PORTA}`], { cwd: resolve(raiz, 'app'), env })
  filho.saida = ''
  filho.stdout.on('data', (d) => { filho.saida += d })
  filho.stderr.on('data', (d) => { filho.saida += d })
  return filho
}

async function alvo() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PORTA}/json`)).json()
      const p = lista.find((a) => a.type === 'page' && a.url.startsWith('file:'))
      if (p) return p
    } catch { /* ainda subindo */ }
    await pausa(500)
  }
  throw new Error('página do app não apareceu')
}
/** Avalia uma expressão na página via CDP (o alvo é procurado de novo a cada chamada). */
async function avaliar(expr) {
  const a = await alvo()
  const ws = new WebSocket(a.webSocketDebuggerUrl)
  await new Promise((r) => { ws.onopen = r })
  return new Promise((r) => {
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id === 1) { ws.close(); r(d.result?.result?.value) }
    }
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }))
  })
}
/** Alguma janela de topo visível e grande do processo (EnumWindows + IsWindowVisible). */
const CS = "using System;using System.Runtime.InteropServices;public class JV{public delegate bool CB(IntPtr h,IntPtr l);[DllImport(\"user32.dll\")]public static extern bool EnumWindows(CB c,IntPtr l);[DllImport(\"user32.dll\")]public static extern bool IsWindowVisible(IntPtr h);[DllImport(\"user32.dll\")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport(\"user32.dll\")]public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);public static int X(uint pid){int n=0;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid&&IsWindowVisible(h)){PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero);n++;}return true;},IntPtr.Zero);return n;}public static int N(uint pid){int n=0;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid&&IsWindowVisible(h))n++;return true;},IntPtr.Zero);return n;}}"
/** O X da janela: manda WM_CLOSE para a janela principal (o mesmo que clicar no X). */
const clicarNoX = (pid) => ps(`Add-Type '${CS}'; [JV]::X(${pid})`)
const janelaVisivel = (pid) => Number(ps(`Add-Type '${CS}'; [JV]::N(${pid})`)) > 0
/** Espera o processo sair (até 12 s). */
const aguardarSaida = async (pid) => { for (let i = 0; i < 24 && vivo(pid); i += 1) await pausa(500) }
const matar = (f) => { try { ps(`Stop-Process -Id ${f.pid} -Force -ErrorAction SilentlyContinue`) } catch { /* já saiu */ } }

const base = `D:\\temp-misteralg-dados\\sistema-${Date.now()}`

let n = 0
const pasta = (prefs) => {
  const d = `${base}\\${(n += 1)}`
  mkdirSync(d, { recursive: true })
  if (prefs) writeFileSync(`${d}\\preferencias.json`, JSON.stringify({ tutorialVisto: true, ...prefs }))
  return d
}

try {
  // 1. X com aoFechar = 'segundoPlano': a janela some, o processo fica e a bandeja existe.
  console.log('--- X: segundo plano')
  let dados = pasta({ aoFechar: 'segundoPlano' })
  let app = iniciar(dados)
  await alvo(); await pausa(2500)
  clicarNoX(app.pid); await pausa(2500)
  conferir('processo continua vivo', vivo(app.pid))
  conferir('bandeja criada', app.saida.includes('[bandeja] criada'))
  conferir('janela escondida', janelaVisivel(app.pid) === false)
  // 2. segunda instância traz a janela de volta.
  const segunda = iniciar(dados)
  for (let i = 0; i < 20 && vivo(segunda.pid); i += 1) await pausa(500)
  conferir('segunda instância saiu sozinha', !vivo(segunda.pid))
  await pausa(1000)
  conferir('janela voltou (second-instance)', janelaVisivel(app.pid) === true)
  // 3. de novo em segundo plano e "Sair" da bandeja = o mesmo que o 'sair' vindo do main.
  clicarNoX(app.pid); await pausa(2000)
  conferir('voltou ao segundo plano', janelaVisivel(app.pid) === false)
  // (o menu da bandeja é nativo; o item "Sair" faz mostrarJanela() + menu 'sair' direto, simulado aqui)
  void avaliar("window.__misteralg.comandos.sair({ direto: true })")
  await aguardarSaida(app.pid)
  conferir('Sair da bandeja encerra o processo sem 2ª pergunta', !vivo(app.pid))
  matar(app)

  // 4. aoFechar = 'fechar': o X encerra o processo.
  console.log('--- X: fechar')
  dados = pasta({ aoFechar: 'fechar' })
  app = iniciar(dados)
  await alvo(); await pausa(2500)
  clicarNoX(app.pid); await aguardarSaida(app.pid)
  conferir('processo encerrou', !vivo(app.pid))
  matar(app)

  // 5. "Abrir quando o computador ligar" (portátil: PORTABLE_EXECUTABLE_FILE).
  console.log('--- abrir ao ligar')
  const falso = 'D:\\temp-misteralg-dados\\MisterALG-portatil.exe'
  dados = pasta({})
  app = iniciar(dados, { PORTABLE_EXECUTABLE_FILE: falso })
  await alvo(); await pausa(2500)
  await avaliar("window.misteralg.prefs.gravar({ abrirAoLigar: true })")
  await pausa(800)
  let reg = registro()
  conferir('entrada criada com o .exe portátil e --ao-ligar', !!reg && reg.includes(falso) && reg.includes('--ao-ligar'), reg ?? 'sem entrada')
  conferir('prefs:ler confirma ligado', (await avaliar("window.misteralg.prefs.ler().then((p) => p.abrirAoLigar)")) === true)
  await avaliar("window.misteralg.prefs.gravar({ abrirAoLigar: false })")
  await pausa(800)
  reg = registro()
  conferir('entrada removida ao desligar', reg === null, String(reg))
  matar(app)
} finally {
  try { ps(`Remove-ItemProperty '${CHAVE.replace('HKCU\\', 'HKCU:\\')}' -Name MisterALG -ErrorAction SilentlyContinue`) } catch { /* nada a limpar */ }
}
console.log(falhas ? `${falhas} falha(s)` : 'TUDO OK')
process.exit(falhas ? 1 : 0)
