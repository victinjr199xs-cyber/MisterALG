// C e C++ com a biblioteca padrão completa: um clang compilado para WebAssembly
// (@yowasp/clang) compila o programa num worker (compilador.js), e um processo à
// parte (rodar-wasm.js) o executa, com a entrada e a saída ligadas ao console da IDE.

import { app } from 'electron'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

const MARCA_ERRO = '\u0001MISTERALG-ERRO:' // escrita por rodar-wasm.js num erro em tempo de execução

// Worker e processo filho não leem de dentro do app.asar: os dois arquivos vão em app.asar.unpacked.
const arquivoVizinho = (nome) => fileURLToPath(new URL(nome, import.meta.url)).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')

// No app instalado o clang vai em resources/clang (extraResources); em desenvolvimento, no node_modules.
const caminhoClang = () =>
  app.isPackaged ? join(process.resourcesPath, 'clang', 'gen', 'bundle.js') : createRequire(import.meta.url).resolve('@yowasp/clang')

// Os cabeçalhos pré-compilados do C++: os do instalador (scripts/gerar-pch.mjs) e os que o app grava.
const pastasPch = () => [
  app.isPackaged ? join(process.resourcesPath, 'pch') : fileURLToPath(new URL('../../build/pch', import.meta.url)),
  join(app.getPath('userData'), 'pch'),
]

// ---- compilação -------------------------------------------------------------------

// Dois workers com o clang: um para o F9 (compilar) e outro para as árvores do F8. A árvore é feita de
// antemão (depois de um F9 que deu certo e ao abrir o arquivo) e pode demorar; num worker à parte, o F9
// nunca espera por ela. O das árvores fecha depois de um tempo parado, para não ocupar memória à toa.
const OCIOSO_MS = 120_000
const trabalhadores = { compilacao: null, arvores: null }
let proximoPedido = 0
const pedidos = new Map() // id → { responder, qual }
const ociosos = {}

function trabalhador(qual) {
  clearTimeout(ociosos[qual])
  if (trabalhadores[qual]) return trabalhadores[qual]
  const w = new Worker(arquivoVizinho('./compilador.js'), { workerData: { clang: pathToFileURL(caminhoClang()).href, pastasPch: pastasPch() } })
  trabalhadores[qual] = w
  w.on('message', ({ id, ...r }) => {
    pedidos.get(id)?.responder(r)
    pedidos.delete(id)
    if (qual === 'arvores' && ![...pedidos.values()].some((p) => p.qual === qual)) {
      ociosos[qual] = setTimeout(() => { if (trabalhadores[qual] === w) { trabalhadores[qual] = null; w.terminate() } }, OCIOSO_MS)
    }
  })
  const falhou = (motivo) => {
    if (trabalhadores[qual] !== w) return // (fechado por estar parado)
    for (const [id, p] of pedidos) if (p.qual === qual) { p.responder({ erros: `O compilador parou: ${motivo}` }); pedidos.delete(id) }
    trabalhadores[qual] = null
  }
  w.on('error', (e) => falhou(e.message))
  w.on('exit', (codigo) => falhou(`código ${codigo}`))
  return w
}

function pedir(mensagem, qual = 'compilacao') {
  return new Promise((responder) => {
    const id = ++proximoPedido
    pedidos.set(id, { responder, qual })
    trabalhador(qual).postMessage({ id, ...mensagem })
  })
}

const antecipar = (linguagem, fonte) => {
  if (linguagem === 'c' || linguagem === 'cpp') void pedir({ tipo: 'antecipar', linguagem, fonte }, 'arvores')
}

/** @returns {Promise<{wasm?: Uint8Array, avisos?: string, erros?: string}>} */
export async function compilar(linguagem, fonte) {
  const r = await pedir({ tipo: 'compilar', linguagem, fonte })
  if (r.erros === undefined) antecipar(linguagem, fonte) // depois de um F9 que deu certo, o F8 é provável
  return r
}

/** Árvore do programa para o passo a passo (F8). @returns {Promise<{ast?: string, avisos?: string, erros?: string}>} */
export const arvore = (fonte, linguagem) => pedir({ tipo: 'arvore', fonte, linguagem }, 'arvores')

/** Carrega o clang em segundo plano (e, no C++, o cabeçalho pré-compilado), para o F9 ser mais rápido. */
export function aquecer(linguagem, fonte) {
  void pedir({ tipo: 'aquecer', linguagem, fonte: String(fonte ?? '') })
  antecipar(linguagem, String(fonte ?? ''))
}

// ---- execução -----------------------------------------------------------------------

const execucoes = new Map() // id → processo filho
const cancelados = new Set() // parados ainda durante a compilação

export const foiCancelado = (id) => cancelados.delete(id)

/**
 * Roda o programa compilado. `aoEvento` recebe { tipo: 'saida' | 'erro', texto } e,
 * no fim, { tipo: 'fim', codigo, parado, erroExecucao }.
 */
export function executar(id, wasm, aoEvento) {
  const pasta = mkdtempSync(join(tmpdir(), 'misteralg-'))
  const programa = join(pasta, 'programa.wasm')
  writeFileSync(programa, wasm)
  const filho = spawn(process.execPath, ['--no-warnings', arquivoVizinho('./rodar-wasm.js'), programa], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
  })
  execucoes.set(id, filho)

  const saida = new TextDecoder()
  const erro = new TextDecoder()
  let erroExecucao = null
  filho.stdout.on('data', (d) => aoEvento({ tipo: 'saida', texto: saida.decode(d, { stream: true }) }))
  filho.stderr.on('data', (d) => {
    let texto = erro.decode(d, { stream: true })
    const i = texto.indexOf(MARCA_ERRO)
    if (i >= 0) {
      erroExecucao = texto.slice(i + MARCA_ERRO.length).trim()
      texto = texto.slice(0, i)
    }
    if (texto) aoEvento({ tipo: 'erro', texto })
  })
  filho.stdin.on('error', () => {}) // o programa já terminou e alguém ainda digitou algo
  filho.on('close', (codigo) => {
    execucoes.delete(id)
    rmSync(pasta, { recursive: true, force: true })
    aoEvento({ tipo: 'fim', codigo, parado: !!filho.parado, erroExecucao })
  })
}

export const enviarEntrada = (id, texto) => execucoes.get(id)?.stdin.write(texto)

export function parar(id) {
  const filho = execucoes.get(id)
  if (!filho) return cancelados.add(id)
  filho.parado = true
  filho.kill()
}

export function pararTudo() {
  for (const filho of execucoes.values()) filho.kill()
  for (const w of Object.values(trabalhadores)) w?.terminate()
}
