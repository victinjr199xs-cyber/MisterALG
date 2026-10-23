// Python e PHP: cada programa roda num processo à parte (rodar-python.js, rodar-php.js) que fala com a
// IDE por linhas de JSON. Um laço infinito ou um travamento ficam lá, longe da IDE; parar é matar o
// processo. O Python demora alguns segundos para carregar, então um processo "aquecido" fica esperando.

import { app } from 'electron'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// O processo não lê de dentro do app.asar: os scripts vão em app.asar.unpacked.
const arquivoVizinho = (nome) => fileURLToPath(new URL(nome, import.meta.url)).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
const requerer = createRequire(import.meta.url)

// No app instalado, o Pyodide e o PHP vão em resources/linguagens (extraResources); em desenvolvimento, no node_modules.
const LINGUAGENS = {
  python: {
    nome: 'Python',
    script: './rodar-python.js',
    modulo: () => (app.isPackaged ? join(process.resourcesPath, 'linguagens', 'pyodide', 'pyodide.mjs') : requerer.resolve('pyodide/pyodide.mjs')),
  },
  php: {
    nome: 'PHP',
    script: './rodar-php.js',
    modulo: () => (app.isPackaged ? join(process.resourcesPath, 'linguagens', 'php', 'node_modules', '@php-wasm', 'node', 'index.js') : requerer.resolve('@php-wasm/node')),
  },
}

const ativos = new Map() // id → processo
let aquecido = null
let relogioAquecido = null

function lancar(linguagem) {
  const cfg = LINGUAGENS[linguagem]
  const filho = spawn(process.execPath, ['--no-warnings', arquivoVizinho(cfg.script), pathToFileURL(cfg.modulo()).href], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
  })
  const p = { filho, linguagem, aoEvento: null, espera: [], fim: false, parado: false, erroTexto: '' }
  const entregar = (ev) => (p.aoEvento ? p.aoEvento(ev) : p.espera.push(ev))

  let resto = ''
  const decodificador = new TextDecoder()
  filho.stdout.on('data', (d) => {
    resto += decodificador.decode(d, { stream: true })
    for (let i = resto.indexOf('\n'); i >= 0; i = resto.indexOf('\n')) {
      const linha = resto.slice(0, i)
      resto = resto.slice(i + 1)
      let ev
      try {
        ev = JSON.parse(linha)
      } catch {
        continue
      }
      if (ev.tipo === 'fim') p.fim = true
      entregar(ev)
    }
  })
  filho.stderr.on('data', (d) => { p.erroTexto = (p.erroTexto + d).slice(-2000) })
  filho.stdin.on('error', () => {}) // o programa já terminou e alguém ainda mandou algo
  filho.on('close', (codigo) => {
    if (p.id) ativos.delete(p.id)
    if (aquecido === p) aquecido = null
    if (p.fim) return
    p.fim = true
    entregar(p.parado
      ? { tipo: 'fim', estado: 'parado' }
      : {
          tipo: 'fim',
          estado: 'erro',
          erro: {
            mensagem: `O ${cfg.nome} parou inesperadamente (código ${codigo}).`,
            explicacao: /stack|RangeError/i.test(p.erroTexto)
              ? 'A pilha estourou: provavelmente uma recursão sem fim.'
              : 'O processo que executa o programa foi encerrado. Tente rodar de novo.',
            linha: 0,
          },
        })
  })
  return p
}

/** Deixa um processo do Python já carregado esperando o próximo F8/F9 (o carregamento leva alguns segundos). */
export function aquecer(linguagem) {
  if (linguagem !== 'python' || aquecido) return
  aquecido = lancar('python')
  clearTimeout(relogioAquecido)
  relogioAquecido = setTimeout(() => { // ninguém usou: não fica gastando memória
    aquecido?.filho.kill()
    aquecido = null
  }, 10 * 60 * 1000)
  relogioAquecido.unref?.()
}

/** @param pedido { id, linguagem, fonte, passo?, breakpoints? } @param aoEvento recebe os eventos do processo */
export function iniciar({ id, linguagem, fonte, passo = false, breakpoints = [] }, aoEvento) {
  const p = linguagem === 'python' && aquecido ? aquecido : lancar(linguagem)
  if (p === aquecido) aquecido = null
  p.id = id
  ativos.set(id, p)
  p.aoEvento = aoEvento
  for (const ev of p.espera.splice(0)) aoEvento(ev)
  p.filho.stdin.write(`${JSON.stringify({ fonte, passo, breakpoints })}\n`)
  if (linguagem === 'python') aquecer('python')
}

export const comando = (id, cmd) => ativos.get(id)?.filho.stdin.write(`${JSON.stringify(cmd)}\n`)

export function parar(id) {
  const p = ativos.get(id)
  if (!p) return
  p.parado = true
  p.filho.kill()
}

export function pararTudo() {
  for (const p of ativos.values()) p.filho.kill()
  aquecido?.filho.kill()
}
