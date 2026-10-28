// Teste diferencial do F9 (clang WebAssembly de verdade): cada programa de diferencial/f9.cpp.txt é compilado
// pelo worker do app, executado em rodar-wasm.js e comparado com o g++ (esperados-f9.json).
//   node test/diferencial/f9.mjs            compara (precisa do g++) e mostra as diferenças
//   node test/diferencial/f9.mjs --gravar   regrava esperados-f9.json com a saída do g++
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { lerCorpus } from './lib.mjs'

const aqui = fileURLToPath(new URL('./', import.meta.url))
const raiz = join(aqui, '..', '..', '..', '..')
export const ARQUIVO_F9 = aqui + 'esperados-f9.json'
export const programasF9 = () => lerCorpus('f9.cpp.txt')
export const lerEsperadosF9 = () => JSON.parse(readFileSync(ARQUIVO_F9, 'utf8'))

let worker, seq = 0
const pend = new Map()
export function compilarF9(fonte) {
  if (!worker) {
    const clang = pathToFileURL(createRequire(join(raiz, 'app', 'package.json')).resolve('@yowasp/clang')).href
    worker = new Worker(join(raiz, 'app', 'src', 'main', 'compilador.js'), { workerData: { clang } })
    worker.on('message', ({ id, ...r }) => pend.get(id)?.(r))
  }
  return new Promise((res) => { const id = ++seq; pend.set(id, res); worker.postMessage({ id, tipo: 'compilar', linguagem: 'cpp', fonte }) })
}
export const fecharF9 = () => worker?.terminate()

export function rodarWasm(wasm, entrada) {
  const dir = join(tmpdir(), 'misteralg-f9'); mkdirSync(dir, { recursive: true })
  const arq = join(dir, 'p.wasm'); writeFileSync(arq, wasm)
  const r = spawnSync(process.execPath, ['--no-warnings', join(raiz, 'app', 'src', 'main', 'rodar-wasm.js'), arq], { input: entrada, encoding: 'utf8' })
  return { saida: r.stdout.replace(/\r\n/g, '\n'), codigo: r.status }
}

const GPP = ['D:\\REP. MR.CLAUDE\\ferramentas\\w64devkit\\bin\\g++.exe', process.env.GPP].filter(Boolean).find((c) => existsSync(c))
export const temGpp = Boolean(GPP)
export function rodarGpp(nome, fonte, entrada) {
  const dir = join(tmpdir(), 'misteralg-f9'); mkdirSync(dir, { recursive: true })
  const src = join(dir, nome + '.cpp'); const exe = join(dir, nome + '.exe')
  writeFileSync(src, fonte)
  const c = spawnSync(GPP, ['-std=c++20', src, '-o', exe], { encoding: 'utf8' })
  if (c.status !== 0) throw new Error(`g++ falhou em ${nome}:\n${c.stderr}`)
  const r = spawnSync(exe, [], { input: entrada, encoding: 'utf8' })
  return { saida: r.stdout.replace(/\r\n/g, '\n'), codigo: r.status }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\//g, '\\')) {
  if (!temGpp) { console.error('g++ não encontrado'); process.exit(1) }
  const gravar = process.argv.includes('--gravar')
  const esperados = {}
  let ruins = 0
  for (const p of programasF9()) {
    const real = rodarGpp(p.nome, p.fonte, p.entrada)
    const t = Date.now()
    const c = await compilarF9(p.fonte)
    const wasm = c.wasm ? rodarWasm(c.wasm, p.entrada) : { saida: '', codigo: -1 }
    esperados[p.nome] = real
    if (!c.wasm || wasm.saida !== real.saida || wasm.codigo !== real.codigo) {
      ruins++
      console.log(`DIFERENTE ${p.nome} ${c.erros ?? ''}\n  wasm=${JSON.stringify(wasm.saida)}\n  g++ =${JSON.stringify(real.saida)}`)
    } else console.log('ok', p.nome, Date.now() - t, 'ms')
  }
  if (gravar) writeFileSync(ARQUIVO_F9, JSON.stringify(esperados, null, 1) + '\n')
  console.log(ruins ? `${ruins} diferença(s)` : 'tudo igual')
  process.exit(ruins ? 1 : 0)
}
