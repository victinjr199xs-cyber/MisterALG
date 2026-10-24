// Teste diferencial do SQL: cada comando roda no PGlite do MisterALG (com a tabela formatada por tabelaPsql) e no psql de
// verdade (um PostgreSQL à parte), e o texto de cada resultado tem de ser igual.
//   node test/diferencial/lib.mjs            compara (precisa do psql; defina PSQL=caminho do psql.exe e PGPORT/PGHOST se preciso)
//   node test/diferencial/lib.mjs --gravar   regrava esperados.json com a saída do psql
// O teste automático (diferencial.test.mjs) lê só o esperados.json, então roda em qualquer máquina.
// Servidor de referência usado aqui: initdb -D <pasta> -U postgres --auth=trust -E UTF8 --locale=C ; pg_ctl -o "-p 5544" start
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { dividirComandos, resultadoPsql } from '../../src/index.js'
import { executarComando, reiniciar } from '../../src/executor.mjs'

const aqui = fileURLToPath(new URL('./', import.meta.url))
export const ARQUIVO_ESPERADOS = aqui + 'esperados.json'
export const ERRO = '<ERRO>'

export function lerCorpus() {
  const texto = readFileSync(aqui + 'corpus.sql.txt', 'utf8').replace(/\r\n/g, '\n')
  return texto.split(/^@@@ /m).filter(Boolean).map((bloco) => {
    const nl = bloco.indexOf('\n')
    return { nome: bloco.slice(0, nl).trim(), fonte: bloco.slice(nl + 1) }
  })
}

let db
/** O que o MisterALG mostraria para cada comando do script (tabela no formato do psql, ou o rótulo do comando). */
export async function rodarMotor(fonte) {
  db ??= await PGlite.create()
  await reiniciar(db)
  const saidas = []
  for (const c of dividirComandos(fonte)) {
    const r = await executarComando(db, c.sql)
    if (r.erro) saidas.push(ERRO)
    else saidas.push(resultadoPsql(c.sql, r.campos, r.linhas, r.afetadas))
  }
  return saidas
}

const PSQL = [process.env.PSQL, 'D:\\PostgreSQL\\18\\bin\\psql.exe'].filter(Boolean).find((c) => existsSync(c))
export const temPsql = Boolean(PSQL)

export function rodarReal(nome, fonte) {
  const comandos = dividirComandos(fonte)
  const script = ['drop schema public cascade;', 'create schema public;', "\\echo '@@@'",
    ...comandos.map((c) => `${c.sql};\n\\echo '@@@'`)].join('\n')
  const dir = join(tmpdir(), 'misteralg-dif-sql'); mkdirSync(dir, { recursive: true })
  const arq = join(dir, `${nome}.sql`)
  writeFileSync(arq, script, 'utf8')
  const env = { ...process.env, PGCLIENTENCODING: 'UTF8', PGPASSWORD: 'postgres', PGOPTIONS: '-c client_min_messages=warning', LANGUAGE: 'en', LC_MESSAGES: 'C' }
  const r = spawnSync(PSQL, ['-X', '-h', process.env.PGHOST ?? 'localhost', '-p', process.env.PGPORT ?? '5544', '-U', 'postgres', '-d', 'postgres', '-f', arq], { env, encoding: 'buffer' })
  const partes = r.stdout.toString('utf8').replace(/\r\n/g, '\n').split('@@@\n')
  partes.shift() // o que veio antes do primeiro marcador (a preparação)
  return comandos.map((_, i) => {
    const t = (partes[i] ?? '').replace(/\n+$/, '')
    return t === '' ? ERRO : t
  })
}

export function lerEsperados() { return JSON.parse(readFileSync(ARQUIVO_ESPERADOS, 'utf8')) }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\//g, '\\')) {
  if (!temPsql) { console.error('psql não encontrado (defina PSQL=caminho)'); process.exit(1) }
  const so = process.argv.find((a) => /^\d/.test(a))
  const esperados = {}
  let ruins = 0
  for (const p of lerCorpus()) {
    if (so && !p.nome.startsWith(so)) continue
    const real = rodarReal(p.nome, p.fonte)
    const motor = await rodarMotor(p.fonte)
    esperados[p.nome] = real
    const cmds = dividirComandos(p.fonte)
    let ok = true
    for (let i = 0; i < Math.max(real.length, motor.length); i++) {
      if (real[i] !== motor[i]) {
        ok = false; ruins++
        console.log(`DIFERENTE ${p.nome} #${i + 1}: ${cmds[i]?.sql.slice(0, 90).replace(/\n/g, ' ')}\n--- motor\n${motor[i]}\n--- psql\n${real[i]}\n`)
      }
    }
    if (ok) console.log('ok', p.nome)
  }
  if (process.argv.includes('--gravar') && !so) writeFileSync(ARQUIVO_ESPERADOS, JSON.stringify(esperados, null, 1) + '\n')
  console.log(ruins ? `${ruins} diferença(s)` : 'tudo igual')
  process.exit(0)
}
