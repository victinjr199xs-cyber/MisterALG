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

/** Volta à tela inicial (o X dentro da IDE faz isto) e espera a página 'inicio' carregar. */
const naInicio = async () => { for (let i = 0; i < 30; i += 1) { try { if ((await alvo()).url.includes('inicio')) return true } catch { /* recarregando */ } await pausa(500) } return false }
const irParaInicio = async () => { void avaliar("window.__misteralg.comandos['tela-inicial']()"); await naInicio(); await pausa(1500) }

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
  // 0. Dentro da IDE o X NÃO oferece fechar/segundo plano: volta para a tela inicial (sem alterações, sem pergunta).
  console.log('--- X na IDE')
  // Com o documento modificado: o X pergunta se salva (fica na IDE, com a pergunta aberta); depois Não salvar leva à tela inicial.
  await avaliar("window.__misteralg.editor.view?.dispatch?.({ changes: { from: 0, insert: 'x' } }); true")
  await avaliar("window.__misteralg.doc.modificado = true")
  clicarNoX(app.pid); await pausa(2000)
  conferir('X na IDE modificada pergunta antes de sair', !(await alvo()).url.includes('inicio') && (await avaliar("!!document.querySelector('dialog[open]')")) === true)
  await avaliar("window.__misteralg.doc.modificado = false; document.querySelector('dialog[open]')?.dispatchEvent(new Event('cancel', { cancelable: true })); document.querySelector('dialog[open]')?.close(); true")
  await pausa(500)
  clicarNoX(app.pid)
  conferir('X na IDE volta para a tela inicial', await naInicio())
  await pausa(1500)
  conferir('X na IDE não escondeu a janela', janelaVisivel(app.pid) === true && vivo(app.pid))
  conferir('X na IDE não criou a bandeja', !app.saida.includes('[bandeja] criada'))
  // X na tela inicial: aplica aoFechar (segundo plano).
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
  // 3. de novo em segundo plano e "Sair" da bandeja = o mesmo que o 'sair' vindo do main (testado na IDE).
  void avaliar("window.misteralg.janela.pagina({ pagina: 'ide' })")
  for (let i = 0; i < 30 && (await alvo()).url.includes('inicio'); i += 1) await pausa(500)
  await pausa(2000)
  conferir('IDE aberta de novo', !(await alvo()).url.includes('inicio'))
  await irParaInicio()
  clicarNoX(app.pid); await pausa(2000)
  conferir('voltou ao segundo plano', janelaVisivel(app.pid) === false)
  void avaliar("window.misteralg.janela.pagina({ pagina: 'ide' })")
  await pausa(3500)
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
  await irParaInicio() // o X só fecha de verdade na tela inicial
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
