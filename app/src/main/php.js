// O processo do PHP (rodar-php.js): um só, de vida longa, que atende as "requisições" da página ao vivo
// (main/previa.js) uma de cada vez. Se uma resposta demora demais (laço infinito), ele é morto e um novo sobe.

import { app } from 'electron'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const arquivoVizinho = (nome) => fileURLToPath(new URL(nome, import.meta.url)).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
const caminhoPHP = () => (app.isPackaged
  ? join(process.resourcesPath, 'linguagens', 'php', 'node_modules', '@php-wasm', 'node', 'index.js')
  : createRequire(import.meta.url).resolve('@php-wasm/node').replace(/index\.cjs$/, 'index.js'))

const LIMITE_MS = 15000

let servidor = null // { filho, pronto: Promise, pendentes: Map }
let proximoId = 0

function subir() {
  const filho = spawn(process.execPath, ['--no-warnings', arquivoVizinho('./rodar-php.js'), pathToFileURL(caminhoPHP()).href], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
  })
  const s = { filho, pendentes: new Map(), pronto: null }
  let marcarPronto
  s.pronto = new Promise((r) => { marcarPronto = r })
  let resto = ''
  filho.stdout.on('data', (d) => {
    resto += d
    for (let i = resto.indexOf('\n'); i >= 0; i = resto.indexOf('\n')) {
      let ev
      try {
        ev = JSON.parse(resto.slice(0, i))
      } catch {
        ev = null
      }
      resto = resto.slice(i + 1)
      if (ev?.tipo === 'pronto') marcarPronto()
      else if (ev?.tipo === 'resposta') s.pendentes.get(ev.id)?.(ev)
    }
  })
  filho.stdin.on('error', () => {})
  filho.stderr.on('data', () => {})
  filho.on('close', () => {
    if (servidor === s) servidor = null
    marcarPronto()
    for (const resolver of s.pendentes.values()) resolver(respostaDeErro('O PHP parou inesperadamente. Rode de novo.'))
    s.pendentes.clear()
  })
  return s
}

const respostaDeErro = (mensagem) => ({
  tipo: 'resposta',
  status: 500,
  cabecalhos: { 'content-type': 'text/html; charset=utf-8' },
  corpo: Buffer.from(`<p style="font:16px sans-serif;color:#b00020">${mensagem}</p>`).toString('base64'),
  diagnosticos: [],
})

/** Pede ao PHP para executar. @returns { status, cabecalhos, corpo (base64), diagnosticos } — nunca rejeita. */
export async function executar(pedido) {
  servidor ??= subir()
  const s = servidor
  await s.pronto
  if (s.filho.exitCode !== null || s.filho.signalCode !== null) return respostaDeErro('O PHP não abriu (o PHP do MisterALG não pôde ser iniciado).')
  const id = ++proximoId
  return new Promise((resolver) => {
    const relogio = setTimeout(() => {
      s.pendentes.delete(id)
      resolver(respostaDeErro('O programa demorou demais para responder (um laço que nunca termina?). O PHP foi reiniciado.'))
      s.filho.kill()
    }, LIMITE_MS)
    s.pendentes.set(id, (resposta) => {
      clearTimeout(relogio)
      s.pendentes.delete(id)
      resolver(resposta)
    })
    s.filho.stdin.write(`${JSON.stringify({ c: 'executar', id, ...pedido })}\n`)
  })
}

export function aquecerPHP() {
  servidor ??= subir()
}

export function pararPHP() {
  servidor?.filho.kill()
}
