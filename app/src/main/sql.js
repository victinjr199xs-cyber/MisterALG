// O processo do SQL (rodar-sql.js): um só, que guarda o banco do PostgreSQL (PGlite) entre os comandos do
// passo a passo. Ele demora uns segundos para subir, então fica "aquecido". Uma consulta que não termina
// (ou o Parar) mata o processo; o próximo pedido sobe outro.

import { app } from 'electron'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const arquivoVizinho = (nome) => fileURLToPath(new URL(nome, import.meta.url)).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
const caminhoPGlite = () => (app.isPackaged
  ? join(process.resourcesPath, 'linguagens', 'pglite', 'dist', 'index.js')
  : createRequire(import.meta.url).resolve('@electric-sql/pglite').replace(/index\.cjs$/, 'index.js'))

const LIMITE_MS = 20000

let servidor = null // { filho, pronto, pendentes }
let proximoId = 0

function subir() {
  const filho = spawn(process.execPath, ['--no-warnings', arquivoVizinho('./rodar-sql.js'), pathToFileURL(caminhoPGlite()).href], {
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
    for (const resolver of s.pendentes.values()) resolver({ erro: { codigo: null, mensagem: 'O banco de dados foi encerrado.', parado: true } })
    s.pendentes.clear()
  })
  return s
}

/** Manda um pedido ({ c: 'reiniciar' | 'executar' | 'banco', sql? }) e espera a resposta. Nunca rejeita. */
export async function comandoSQL(pedido) {
  servidor ??= subir()
  const s = servidor
  await s.pronto
  const id = ++proximoId
  return new Promise((resolver) => {
    const relogio = setTimeout(() => {
      s.pendentes.delete(id)
      resolver({ erro: { codigo: null, mensagem: 'O comando demorou demais (uma consulta que nunca termina?). O banco foi reiniciado.', demorou: true } })
      s.filho.kill()
    }, LIMITE_MS)
    s.pendentes.set(id, (resposta) => {
      clearTimeout(relogio)
      s.pendentes.delete(id)
      resolver(resposta)
    })
    s.filho.stdin.write(`${JSON.stringify({ ...pedido, id })}\n`)
  })
}

export function aquecerSQL() {
  servidor ??= subir()
}

/** Parar (Ctrl+F2) ou sair: mata o processo; o banco recomeça do zero no próximo F9/F8. */
export function pararSQL() {
  servidor?.filho.kill()
}