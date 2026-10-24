// Teste diferencial: o mesmo programa no gcc de verdade e no interpretador do MisterALG.
//   node test/diferencial/lib.mjs            compara todos os programas (precisa do gcc) e mostra as diferenças
//   node test/diferencial/lib.mjs --gravar   regrava esperados.json com a saída do gcc
// O teste automático (diferencial.test.mjs) usa só o esperados.json, então roda em qualquer máquina.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { astDe } from '../ajudante.mjs'
import { SessaoC } from '../../src/index.js'

const aqui = fileURLToPath(new URL('./', import.meta.url))
export const ARQUIVO_ESPERADOS = aqui + 'esperados.json'

export const ARQUIVOS_CORPUS = () => readdirSync(aqui).filter((f) => /^corpus.*\.(c|cpp)\.txt$/.test(f)).sort()

/** @returns {{nome, fonte, entrada: string}[]} */
export function lerCorpus(arquivo) {
  const texto = readFileSync(aqui + arquivo, 'utf8').replace(/\r\n/g, '\n')
  return texto.split(/^@@@ /m).filter(Boolean).map((bloco) => {
    const nl = bloco.indexOf('\n')
    const nome = bloco.slice(0, nl).trim()
    const [fonte, entrada = ''] = bloco.slice(nl + 1).split(/^--- entrada\n/m)
    return { nome, fonte, entrada }
  })
}

export function rodarMotor(fonte, entrada, cpp = false) {
  return new Promise((resolve, reject) => {
    astDe(fonte, cpp).then((ast) => {
      let saida = ''
      const linhas = entrada ? entrada.replace(/\n$/, '').split('\n') : []
      const s = new SessaoC(ast, fonte, {
        semAtrasos: true, fatias: false, maxLinhas: 5_000_000, entrada: linhas, cpp,
        onOutput: (t) => { saida += t },
        onWaitInput: () => queueMicrotask(() => s.fornecerEntrada(null)), // acabou a entrada: EOF
        onEnd: (status, erro, codigo) => resolve({ saida, status, erro, codigo }),
      })
      s.continuar()
    }, reject)
  })
}

const GCC = [process.env.GCC, 'D:\\REP. MR.CLAUDE\\ferramentas\\w64devkit\\bin\\gcc.exe'].filter(Boolean).find((c) => existsSync(c))
const GPP = GCC && GCC.replace(/gcc(\.exe)?$/, 'g++$1')
export const temGcc = Boolean(GCC)

export function rodarReal(nome, fonte, entrada, cpp = false) {
  const dir = join(tmpdir(), 'misteralg-dif'); mkdirSync(dir, { recursive: true })
  const src = join(dir, nome + (cpp ? '.cpp' : '.c')); const exe = join(dir, nome + '.exe')
  writeFileSync(src, fonte)
  const c = spawnSync(cpp ? GPP : GCC, cpp ? ['-std=c++17', src, '-o', exe] : ['-std=c11', '-w', src, '-o', exe, '-lm'], { encoding: 'utf8' })
  if (c.status !== 0) throw new Error(`gcc falhou em ${nome}:\n${c.stderr}`)
  const r = spawnSync(exe, [], { input: entrada, encoding: 'utf8' })
  return { saida: r.stdout.replace(/\r\n/g, '\n'), codigo: r.status }
}

export function lerEsperados() { return JSON.parse(readFileSync(ARQUIVO_ESPERADOS, 'utf8')) }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\//g, '\\')) {
  if (!temGcc) { console.error('gcc não encontrado (defina GCC=caminho)'); process.exit(1) }
  const gravar = process.argv.includes('--gravar')
  const so = process.argv.find((a) => /^\d/.test(a))
  const esperados = {}
  let ruins = 0
  for (const arq of ARQUIVOS_CORPUS()) {
    const cpp = arq.includes('.cpp.')
    for (const p of lerCorpus(arq)) {
      if (so && !p.nome.startsWith(so)) continue
      const real = rodarReal(p.nome, p.fonte, p.entrada, cpp)
      const motor = await rodarMotor(p.fonte, p.entrada, cpp).catch((e) => ({ saida: '', status: 'nao-compila', erro: e.message.slice(0, 300) }))
      esperados[(cpp ? 'cpp/' : 'c/') + p.nome] = real
      if (motor.saida !== real.saida || (motor.codigo ?? 0) !== (real.codigo ?? 0) || motor.status !== 'terminado') {
        ruins++
        const a = motor.saida.split('\n'); const b = real.saida.split('\n')
        console.log(`DIFERENTE ${p.nome} (status ${motor.status}, codigo ${motor.codigo} vs ${real.codigo}) ${motor.erro ? JSON.stringify(motor.erro) : ''}`)
        for (let i = 0, n = 0; i < Math.max(a.length, b.length) && n < 6; i++) if (a[i] !== b[i]) { n++; console.log(`  l${i + 1} motor=${JSON.stringify(a[i])}\n     real =${JSON.stringify(b[i])}`) }
      } else console.log('ok', p.nome)
    }
  }
  if (gravar && !so) writeFileSync(ARQUIVO_ESPERADOS, JSON.stringify(esperados, null, 1) + '\n')
  console.log(ruins ? `${ruins} diferença(s)` : 'tudo igual')
}
