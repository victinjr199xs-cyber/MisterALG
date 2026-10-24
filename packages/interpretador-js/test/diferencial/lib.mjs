// Teste diferencial: o mesmo programa no Node de verdade e no interpretador de JS do MisterALG.
//   node test/diferencial/lib.mjs            compara todos os programas e mostra as diferenças
//   node test/diferencial/lib.mjs --gravar   regrava esperados.json com a saída do node
// O teste automático (diferencial.test.mjs) lê só o esperados.json, então roda em qualquer máquina.
// O prompt() do aluno não existe no Node: o prelúdio abaixo faz o mesmo que o do MisterALG (mostra a pergunta,
// lê uma linha do stdin e a repete na saída como o terminal; fim da entrada devolve null).
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SessaoJS } from '../../src/index.js'

const aqui = fileURLToPath(new URL('./', import.meta.url))
export const ARQUIVO_ESPERADOS = aqui + 'esperados.json'

const PRELUDIO = `globalThis.prompt = (() => { const l = require('fs').readFileSync(0, 'utf8').replace(/\\r/g, '').split('\\n'); if (l[l.length - 1] === '') l.pop(); let i = 0;
  return (m) => { if (m !== undefined) process.stdout.write(String(m) + ' '); if (i >= l.length) return null; process.stdout.write(l[i] + '\\n'); return l[i++] } })();`

export const ARQUIVOS_CORPUS = () => readdirSync(aqui).filter((f) => /^corpus.*\.js\.txt$/.test(f)).sort()

export function lerCorpus() {
  const texto = ARQUIVOS_CORPUS().map((f) => readFileSync(aqui + f, 'utf8').replace(/\r\n/g, '\n')).join('\n')
  return texto.split(/^@@@ /m).filter(Boolean).map((bloco) => {
    const nl = bloco.indexOf('\n')
    const [fonte, entrada = ''] = bloco.slice(nl + 1).split(/^--- entrada\n/m)
    return { nome: bloco.slice(0, nl).trim(), fonte, entrada }
  })
}

export function rodarMotor(fonte, entrada) {
  return new Promise((resolve) => {
    let saida = ''
    const linhas = entrada ? entrada.replace(/\n$/, '').split('\n') : []
    const s = new SessaoJS(fonte, {
      semAtrasos: true, fatias: false, entrada: linhas,
      onOutput: (t) => { saida += t },
      onWaitInput: () => queueMicrotask(() => s.fornecerEntrada(null)),
      onEnd: (status, erro) => resolve({ saida, status, erro }),
    })
    s.continuar()
  })
}

export function rodarReal(nome, fonte, entrada) {
  const dir = join(tmpdir(), 'misteralg-dif-js'); mkdirSync(dir, { recursive: true })
  const arq = join(dir, nome + '.cjs')
  writeFileSync(arq, `${PRELUDIO}\n${fonte}`)
  const r = spawnSync(process.execPath, [arq], { input: entrada, encoding: 'utf8' })
  const linhas = r.stderr.trim().split(/\r?\n/)
  return { saida: r.stdout.replace(/\r\n/g, '\n'), erro: r.status === 0 ? null : (linhas.find((l) => /Error/.test(l)) ?? linhas[0]) }
}

export function lerEsperados() { return JSON.parse(readFileSync(ARQUIVO_ESPERADOS, 'utf8')) }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\//g, '\\')) {
  const so = process.argv.find((a) => /^\d/.test(a))
  const esperados = {}
  let ruins = 0
  for (const p of lerCorpus()) {
    if (so && !p.nome.startsWith(so)) continue
    const real = rodarReal(p.nome, p.fonte, p.entrada)
    const motor = await rodarMotor(p.fonte, p.entrada)
    esperados[p.nome] = real
    if (motor.saida !== real.saida || (motor.status === 'erro') !== Boolean(real.erro) || !['terminado', 'erro'].includes(motor.status)) {
      ruins++
      const a = motor.saida.split('\n'); const b = real.saida.split('\n')
      console.log(`DIFERENTE ${p.nome} (status ${motor.status}, real erro=${real.erro}) ${motor.erro ? motor.erro.mensagem : ''}`)
      for (let i = 0, n = 0; i < Math.max(a.length, b.length) && n < 8; i++) if (a[i] !== b[i]) { n++; console.log(`  l${i + 1} motor=${JSON.stringify(a[i])}\n     real =${JSON.stringify(b[i])}`) }
    } else console.log('ok', p.nome)
  }
  if (process.argv.includes('--gravar') && !so) writeFileSync(ARQUIVO_ESPERADOS, JSON.stringify(esperados, null, 1) + '\n')
  console.log(ruins ? `${ruins} diferença(s)` : 'tudo igual')
}
