// Teste diferencial do C# moderno: o mesmo programa no .NET de verdade (SDK portátil) e no interpretador do MisterALG.
//   node test/diferencial/lib.mjs            compara todos os programas (precisa do dotnet) e mostra as diferenças
//   node test/diferencial/lib.mjs --gravar   regrava esperados.json com a saída do dotnet
// O teste automático (diferencial.test.mjs) lê só o esperados.json, então roda em qualquer máquina.
// (Os programas de test/programas/*.cs, em C# 5, continuam sendo gerados com o csc.exe do .NET Framework.)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRELUDIO, SessaoCS } from '../../src/index.js'
import { criarAnalisador } from '../../src/analisar.js'

const aqui = fileURLToPath(new URL('./', import.meta.url))
export const ARQUIVO_ESPERADOS = aqui + 'esperados.json'

export const ARQUIVOS_CORPUS = () => readdirSync(aqui).filter((f) => /^corpus.*\.cs\.txt$/.test(f)).sort()

export function lerCorpus() {
  const texto = ARQUIVOS_CORPUS().map((f) => readFileSync(aqui + f, 'utf8').replace(/\r\n/g, '\n')).join('\n')
  return texto.split(/^@@@ /m).filter(Boolean).map((bloco) => {
    const nl = bloco.indexOf('\n')
    const [fonte, entrada = ''] = bloco.slice(nl + 1).split(/^--- entrada\n/m)
    return { nome: bloco.slice(0, nl).trim(), fonte, entrada }
  })
}

const analisador = await criarAnalisador()
const preludio = analisador.analisar(PRELUDIO)

export function rodarMotor(fonte, entrada) {
  const r = analisador.analisar(fonte)
  if (r.erros) return Promise.resolve({ saida: '', status: 'sintaxe', erro: { mensagem: JSON.stringify(r.erros) } })
  return new Promise((resolve) => {
    let saida = ''
    const linhas = entrada ? entrada.replace(/\n$/, '').split('\n') : []
    const s = new SessaoCS(r.ast, preludio.ast, {
      semAtrasos: true, fatias: false, entrada: linhas, eco: false, // (o console redirecionado do .NET não ecoa a entrada)
      onOutput: (t) => { saida += t },
      onWaitInput: () => queueMicrotask(() => s.fornecerEntrada(null)),
      onEnd: (status, erro, codigo) => resolve({ saida, status, erro, codigo }),
    })
    s.continuar()
  })
}

const DOTNET = [process.env.DOTNET, 'D:\\REP. MR.CLAUDE\\ferramentas\\dotnet-sdk\\dotnet.exe'].filter(Boolean).find((c) => existsSync(c))
export const temDotnet = Boolean(DOTNET)
const DIR = process.env.DIF_TMP ?? 'D:\\REP. MR.CLAUDE\\ferramentas\\cache-dif\\cs'

const CSPROJ = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework>
<LangVersion>latest</LangVersion><Nullable>disable</Nullable><ImplicitUsings>disable</ImplicitUsings><AssemblyName>dif</AssemblyName>
<TieredPGO>false</TieredPGO><InvariantGlobalization>false</InvariantGlobalization><NoWarn>CS0168;CS0219;CS0162;CS0649;CS8321;CS0169;CS0414;CS1717;CS8600;CS8602;CS8603</NoWarn></PropertyGroup></Project>`

export function rodarReal(nome, fonte, entrada) {
  mkdirSync(DIR, { recursive: true })
  const env = { ...process.env, DOTNET_CLI_HOME: join(DIR, '..', 'dotnet-home'), DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_ROOT: DOTNET.replace(/[\\\\/]dotnet\.exe$/, '') }
  writeFileSync(join(DIR, 'dif.csproj'), CSPROJ)
  writeFileSync(join(DIR, 'p.cs'), fonte)
  const b = spawnSync(DOTNET, ['build', '-c', 'Release', '-nologo', '-v', 'q', '-o', join(DIR, 'saida')], { cwd: DIR, env, encoding: 'utf8' })
  if (b.status !== 0) throw new Error(`dotnet build falhou em ${nome}:\n${b.stdout}`.slice(0, 1500))
  // chcp 65001: o console do filho escreve e lê em UTF-8 (os programas têm acentos).
  writeFileSync(join(DIR, 'entrada.txt'), entrada, 'utf8')
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', `"chcp 65001>nul && "${join(DIR, 'saida', 'dif.exe')}" < "${join(DIR, 'entrada.txt')}""`], { cwd: DIR, env, windowsVerbatimArguments: true, maxBuffer: 20_000_000, timeout: 60000 })
  const saida = r.stdout.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  return { saida, codigo: r.status, erro: r.status ? r.stderr.toString('utf8').split(/\r?\n/).find((l) => /Exception/.test(l)) ?? 'erro' : null }
}

// (a cultura pt-BR do Windows usa espaço comum na moeda; a ICU do Mac/Linux usa o espaço sem quebra)
export const norm = (s) => s.replace(/\u00a0/g, ' ')

export function lerEsperados() { return JSON.parse(readFileSync(ARQUIVO_ESPERADOS, 'utf8')) }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\//g, '\\')) {
  if (!temDotnet) { console.error('dotnet não encontrado (defina DOTNET=caminho)'); process.exit(1) }
  const so = process.argv.find((a) => /^\d/.test(a))
  const esperados = {}
  let ruins = 0
  for (const p of lerCorpus()) {
    if (so && !p.nome.startsWith(so)) continue
    let real
    try { real = rodarReal(p.nome, p.fonte, p.entrada) } catch (e) { console.log(`NAO COMPILA NO DOTNET : ${e.message}`); ruins++; continue }
    const motor = await rodarMotor(p.fonte, p.entrada)
    esperados[p.nome] = real
    const motorErro = motor.status === 'erro'
    if (norm(motor.saida) !== norm(real.saida) || motorErro !== Boolean(real.erro) || !['terminado', 'erro'].includes(motor.status)) {
      ruins++
      const a = motor.saida.split('\n'); const b = real.saida.split('\n')
      console.log(`DIFERENTE ${p.nome} (status ${motor.status}, real erro=${real.erro}) ${motor.erro ? motor.erro.mensagem : ''}`)
      for (let i = 0, n = 0; i < Math.max(a.length, b.length) && n < 8; i++) if (a[i] !== b[i]) { n++; console.log(`  l${i + 1} motor=${JSON.stringify(a[i])}\n     real =${JSON.stringify(b[i])}`) }
    } else console.log('ok', p.nome)
  }
  if (process.argv.includes('--gravar') && !so) writeFileSync(ARQUIVO_ESPERADOS, JSON.stringify(esperados, null, 1) + '\n')
  console.log(ruins ? `${ruins} diferença(s)` : 'tudo igual')
}
