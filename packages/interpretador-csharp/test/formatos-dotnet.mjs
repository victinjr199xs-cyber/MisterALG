// Teste diferencial (só no Windows, com o .NET Framework instalado): compila um programa em C# com o csc.exe,
// roda, e compara cada formato numérico com o que o nosso formatador produz. Uso: node test/formatos-dotnet.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Dbl, Dec, decDeTexto } from '../src/valores.js'
import { CULTURAS, formatarNumero } from '../src/formatar.js'

const CSC = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
if (!existsSync(CSC)) {
  console.log('csc.exe não encontrado: teste ignorado')
  process.exit(0)
}

const INTEIROS = [0, 5, -5, 42, 1234, -1234567, 2147483647]
const DOUBLES = ['0.0', '0.5', '-0.5', '1.5', '2.5', '3.14159', '-3.14159', '1234.5678', '0.001234', '1234567.891', '0.256', '12.345', '999.9999', '0.000001', '100.0']
const DECIMAIS = ['0', '1.5', '-2.75', '1234.5678', '0.05', '99.995']
const FORMATOS = ['F0', 'F1', 'F2', 'F3', 'N0', 'N1', 'N2', 'C', 'C0', 'C1', 'P', 'P0', 'P1', 'E', 'E2', 'e3', 'G', 'G3', 'G5', '0', '00', '000', '0.0', '0.00', '0.###', '#.##', '#,##0', '#,##0.00', '#,0.0', '0.0%', '0%', '00.00', '#.00', '0.00E+00']
const FORMATOS_INT = ['D', 'D3', 'D8', 'X', 'x', 'X4', 'N0', 'N2', 'F2', 'C', 'P0', 'E3', 'G', '0', '000000', '#,##0', '#,##0.00', '0.0']

const casos = []
const lit = { i: (v) => String(v), d: (v) => `${v}d`, m: (v) => `${v}m` }
for (const v of INTEIROS) for (const f of [...FORMATOS_INT]) casos.push({ tipo: 'i', v, f, cs: `(${lit.i(v)}).ToString("${f}", C)` })
for (const v of DOUBLES) for (const f of FORMATOS) casos.push({ tipo: 'd', v, f, cs: `(${lit.d(v)}).ToString("${f}", C)` })
for (const v of DECIMAIS) for (const f of FORMATOS.filter((x) => !/^e|^E|E\+/.test(x))) casos.push({ tipo: 'm', v, f, cs: `(${lit.m(v)}).ToString("${f}", C)` })

const fonte = `using System;
using System.Globalization;
class P {
  static void Main() {
    CultureInfo C = CultureInfo.GetCultureInfo("pt-BR");
    string[] r = new string[] {
${casos.map((c) => `      ${c.cs}`).join(',\n')}
    };
    Console.OutputEncoding = System.Text.Encoding.UTF8;
    foreach (string s in r) Console.WriteLine(s);
  }
}
`
const pasta = join(tmpdir(), 'misteralg-formatos')
mkdirSync(pasta, { recursive: true })
const cs = join(pasta, 'f.cs')
const exe = join(pasta, 'f.exe')
writeFileSync(cs, fonte, 'utf8')
execFileSync(CSC, ['/nologo', `/out:${exe}`, cs], { stdio: 'pipe' })
const saida = execFileSync(exe, [], { encoding: 'utf8' }).split(/\r?\n/)

const pt = CULTURAS['pt-BR']
let falhas = 0
casos.forEach((c, i) => {
  const valor = c.tipo === 'i' ? c.v : c.tipo === 'd' ? new Dbl(parseFloat(c.v)) : decDeTexto(c.v)
  let meu
  try {
    meu = formatarNumero(valor, c.f, pt)
  } catch (e) {
    meu = `ERRO:${e.message}`
  }
  // O .NET Framework (NLS) usa espaço comum na moeda; o .NET moderno (ICU) usa o espaço sem quebra: comparamos sem a diferença.
  const esperado = saida[i]
  if (meu.replace(/\u00a0/g, ' ') !== esperado.replace(/\u00a0/g, ' ')) {
    falhas += 1
    if (falhas <= 200) console.log(`✖ ${c.tipo} ${c.v} ${JSON.stringify(c.f)}: meu=${JSON.stringify(meu)} .NET=${JSON.stringify(esperado)}`)
  }
})
console.log(`${casos.length - falhas}/${casos.length} iguais`)
void Dec
if (falhas) process.exitCode = 1
