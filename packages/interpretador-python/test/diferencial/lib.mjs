// Teste diferencial: o mesmo programa no Python de verdade e no Pyodide do MisterALG.
//   node test/diferencial/lib.mjs            compara todos (precisa do python) e mostra as diferenças
//   node test/diferencial/lib.mjs --gravar   regrava esperados.json com a saída do python
// O teste automático (diferencial.test.mjs) lê só o esperados.json, então roda em qualquer máquina.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rodar } from '../ajudante.mjs'

const aqui = fileURLToPath(new URL('./', import.meta.url))
export const ARQUIVO_ESPERADOS = aqui + 'esperados.json'

export function lerCorpus() {
  const texto = readFileSync(aqui + 'corpus.py.txt', 'utf8').replace(/\r\n/g, '\n')
  return texto.split(/^@@@ /m).filter(Boolean).map((bloco) => {
    const nl = bloco.indexOf('\n')
    const [fonte, entrada = ''] = bloco.slice(nl + 1).split(/^--- entrada\n/m)
    return { nome: bloco.slice(0, nl).trim(), fonte, entrada }
  })
}

export async function rodarMotor(fonte, entrada) {
  const entradas = entrada ? entrada.replace(/\n$/, '').split('\n') : []
  const r = await rodar(fonte, { entradas })
  return { saida: r.saida, estado: r.fim?.estado, erro: r.fim?.erro, erroSaida: r.erroSaida }
}

const PY = [process.env.PYTHON, 'D:\\REP. MR.CLAUDE\\ferramentas\\python312\\python.exe'].filter(Boolean).find((c) => existsSync(c))
export const temPython = Boolean(PY)

export function rodarReal(nome, fonte, entrada) {
  const dir = join(tmpdir(), 'misteralg-dif-py'); mkdirSync(dir, { recursive: true })
  const arq = join(dir, nome + '.py')
  writeFileSync(arq, fonte)
  const r = spawnSync(PY, ['-I', '-X', 'utf8', arq], { input: entrada, encoding: 'utf8' })
  const linhas = r.stderr.trim().split(/\r?\n/)
  return { saida: r.stdout.replace(/\r\n/g, '\n'), erro: r.status === 0 ? null : linhas[linhas.length - 1] }
}

export function lerEsperados() { return JSON.parse(readFileSync(ARQUIVO_ESPERADOS, 'utf8')) }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\//g, '\\')) {
  if (!temPython) { console.error('python não encontrado (defina PYTHON=caminho)'); process.exit(1) }
  const so = process.argv.find((a) => /^\d/.test(a))
  const esperados = {}
  let ruins = 0
  for (const p of lerCorpus()) {
    if (so && !p.nome.startsWith(so)) continue
    const real = rodarReal(p.nome, p.fonte, p.entrada)
    const motor = await rodarMotor(p.fonte, p.entrada)
    esperados[p.nome] = real
    const motorErro = motor.estado === 'erro'
    if (motor.saida !== real.saida || motorErro !== Boolean(real.erro) || (motor.estado !== 'terminado' && !motorErro)) {
      ruins++
      const a = motor.saida.split('\n'); const b = real.saida.split('\n')
      console.log(`DIFERENTE ${p.nome} (estado ${motor.estado}, real erro=${real.erro}) ${motor.erro ? motor.erro.mensagem : ''}`)
      for (let i = 0, n = 0; i < Math.max(a.length, b.length) && n < 6; i++) if (a[i] !== b[i]) { n++; console.log(`  l${i + 1} motor=${JSON.stringify(a[i])}\n     real =${JSON.stringify(b[i])}`) }
    } else console.log('ok', p.nome)
  }
  if (process.argv.includes('--gravar') && !so) writeFileSync(ARQUIVO_ESPERADOS, JSON.stringify(esperados, null, 1) + '\n')
  console.log(ruins ? `${ruins} diferença(s)` : 'tudo igual')
}
