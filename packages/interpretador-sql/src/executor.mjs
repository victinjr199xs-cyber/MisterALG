// O processo que guarda o banco de dados (PostgreSQL de verdade, via PGlite) e executa um comando por vez:
//   entra pelo stdin (uma linha de JSON por mensagem):
//     { c: 'reiniciar', id }        → apaga tudo (o script recomeça do zero)
//     { c: 'executar', id, sql }    → roda UM comando
//     { c: 'banco', id }            → as tabelas, colunas, chaves e linhas, para a tela do banco
//   sai pelo stdout:
//     { tipo: 'pronto' }
//     { tipo: 'resposta', id, ... }  (executar: { campos, linhas, afetadas } ou { erro: { codigo, mensagem, posicao, dica } })
// Uma consulta que nunca termina fica aqui, longe da IDE: o MisterALG mata este processo.
// Uso: node rodar-sql.js <url do @electric-sql/pglite/dist/index.js>

import { writeSync } from 'node:fs'
import { textoDoValor } from './formatar.js'

const LINHAS_NA_TELA = 50

function escreverTudo(texto) {
  const buf = Buffer.from(texto)
  for (let i = 0; i < buf.length;) {
    try {
      i += writeSync(1, buf, i)
    } catch (e) {
      if (e.code !== 'EAGAIN') throw e
    }
  }
}

const nome = (s) => `"${String(s).replace(/"/g, '""')}"`

/** Fotografia do banco: cada tabela do schema public com as colunas, chaves e as primeiras linhas. */
export async function lerBanco(db) {
  const q = async (sql) => (await db.query(sql)).rows
  const tabelas = await q(`select c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.oid`)
  const colunas = await q(`select table_name as tabela, column_name as nome, data_type as tipo from information_schema.columns
    where table_schema = 'public' order by table_name, ordinal_position`)
  const chaves = await q(`select tc.table_name as tabela, kcu.column_name as coluna from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = 'public'`)
  const estrangeiras = await q(`select tc.table_name as tabela, kcu.column_name as coluna, ccu.table_name as ref_tabela, ccu.column_name as ref_coluna
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`)
  const resultado = []
  for (const { nome: t } of tabelas) {
    // Pela chave primária: senão um UPDATE "move" a linha para o fim e a tela pula.
    const pk = chaves.filter((k) => k.tabela === t).map((k) => nome(k.coluna))
    const ordem = pk.length ? ` order by ${pk.join(', ')}` : ''
    const r = await db.query(`select * from public.${nome(t)}${ordem} limit ${LINHAS_NA_TELA + 1}`, [], { rowMode: 'array' })
    const total = (await db.query(`select count(*)::int as n from public.${nome(t)}`)).rows[0].n
    resultado.push({
      nome: t,
      colunas: colunas.filter((c) => c.tabela === t).map((c) => ({
        nome: c.nome,
        tipo: c.tipo,
        chave: chaves.some((k) => k.tabela === t && k.coluna === c.nome),
        referencia: estrangeiras.find((f) => f.tabela === t && f.coluna === c.nome)
          ? (({ ref_tabela, ref_coluna }) => ({ tabela: ref_tabela, coluna: ref_coluna }))(estrangeiras.find((f) => f.tabela === t && f.coluna === c.nome))
          : null,
      })),
      linhas: r.rows.slice(0, LINHAS_NA_TELA).map((l) => l.map((v, i) => (v === null ? null : textoDoValor(v, r.fields[i]?.dataTypeID)))),
      total,
    })
  }
  return resultado
}

/** Um comando: as linhas (como vieram do PostgreSQL) ou o erro. */
export async function executarComando(db, sql) {
  try {
    const r = await db.query(sql, [], { rowMode: 'array' })
    return {
      campos: r.fields.map((f) => ({ nome: f.name, tipo: f.dataTypeID })),
      linhas: r.rows.map((l) => l.map((v, i) => (v === null ? null : textoDoValor(v, r.fields[i]?.dataTypeID)))),
      afetadas: r.affectedRows ?? 0,
    }
  } catch (e) {
    return { erro: { codigo: e.code ?? null, mensagem: e.message, posicao: e.position ?? null, dica: e.hint ?? null, detalhe: e.detail ?? null } }
  }
}

export async function reiniciar(db) {
  await db.exec('drop schema if exists public cascade; create schema public;')
}

export async function main({ pgliteUrl, entrada = process.stdin, emitir = (ev) => escreverTudo(`${JSON.stringify(ev)}\n`) }) {
  const { PGlite } = await import(/* @vite-ignore */ pgliteUrl)
  const db = await PGlite.create()
  emitir({ tipo: 'pronto' })
  let resto = ''
  let fila = Promise.resolve()
  entrada.setEncoding?.('utf8')
  entrada.on('data', (d) => {
    resto += d
    for (let i = resto.indexOf('\n'); i >= 0; i = resto.indexOf('\n')) {
      const linha = resto.slice(0, i)
      resto = resto.slice(i + 1)
      let msg
      try {
        msg = JSON.parse(linha)
      } catch {
        continue
      }
      // Um de cada vez, na ordem em que chegaram.
      fila = fila.then(async () => {
        if (msg.c === 'reiniciar') { await reiniciar(db); emitir({ tipo: 'resposta', id: msg.id }) }
        else if (msg.c === 'executar') emitir({ tipo: 'resposta', id: msg.id, ...(await executarComando(db, String(msg.sql))) })
        else if (msg.c === 'banco') emitir({ tipo: 'resposta', id: msg.id, tabelas: await lerBanco(db) })
      }).catch((e) => emitir({ tipo: 'resposta', id: msg.id, erro: { codigo: null, mensagem: String(e?.message ?? e) } }))
    }
  })
  entrada.on('end', () => process.exit(0))
}
