// O resultado de cada comando no formato do psql (o terminal do PostgreSQL), para o aluno ver
// no MisterALG a mesma coisa que veria no terminal da faculdade.

// int2, int4, int8, oid, float4, float8, numeric: alinhados à direita, como no psql
const NUMERICOS = new Set([20, 21, 23, 26, 700, 701, 1700])

const dois = (n) => String(n).padStart(2, '0')

/** Um valor vindo do PGlite como o psql o mostraria. */
export function textoDoValor(v, tipo) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 't' : 'f'
  if (v instanceof Date) {
    const data = `${v.getUTCFullYear()}-${dois(v.getUTCMonth() + 1)}-${dois(v.getUTCDate())}`
    if (tipo === 1082) return data // date
    return `${data} ${dois(v.getUTCHours())}:${dois(v.getUTCMinutes())}:${dois(v.getUTCSeconds())}`
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Tabela no estilo do psql: cabeçalho centralizado, colunas separadas por "|", e "(n rows)". */
export function tabelaPsql(campos, linhas) {
  const textos = linhas.map((l) => l.map((v, i) => textoDoValor(v, campos[i]?.tipo)))
  const larguras = campos.map((c, i) => Math.max(c.nome.length, ...textos.map((l) => l[i].length)))
  const centro = (s, w) => {
    const esq = Math.floor((w - s.length) / 2)
    return ' '.repeat(esq) + s + ' '.repeat(w - s.length - esq)
  }
  const cabecalho = campos.map((c, i) => ` ${centro(c.nome, larguras[i])} `).join('|')
  const separador = larguras.map((w) => '-'.repeat(w + 2)).join('+')
  const corpo = textos.map((l) => l.map((t, i) => ` ${NUMERICOS.has(campos[i].tipo) ? t.padStart(larguras[i]) : t.padEnd(larguras[i])} `).join('|').replace(/\s+$/, ''))
  const rodape = `(${linhas.length} ${linhas.length === 1 ? 'row' : 'rows'})`
  return [cabecalho.replace(/\s+$/, ''), separador, ...corpo, rodape].join('\n')
}

/** O que o psql escreve depois de um comando que não devolve tabela (INSERT 0 1, UPDATE 2, CREATE TABLE...). */
export function rotuloDoComando(sql, afetadas = 0) {
  const palavras = sql.replace(/^\s*\(+/, '').split(/\s+/).map((p) => p.toUpperCase())
  const [p1, p2, p3] = palavras
  if (p1 === 'INSERT') return `INSERT 0 ${afetadas}`
  if (['UPDATE', 'DELETE', 'MERGE', 'COPY', 'FETCH', 'MOVE'].includes(p1)) return `${p1} ${afetadas}`
  if (['CREATE', 'DROP', 'ALTER'].includes(p1)) {
    // CREATE [OR REPLACE] [UNIQUE|TEMP] INDEX/TABLE/VIEW/FUNCTION...
    const resto = palavras.slice(1).filter((p) => !['OR', 'REPLACE', 'UNIQUE', 'TEMP', 'TEMPORARY', 'UNLOGGED', 'MATERIALIZED', 'IF', 'NOT', 'EXISTS'].includes(p))
    const objeto = (p2 === 'MATERIALIZED' || p3 === 'MATERIALIZED') ? `MATERIALIZED ${resto[0] ?? ''}` : resto[0] ?? ''
    return `${p1} ${objeto.replace(/[^A-Z ]/g, '')}`.trim()
  }
  if (p1 === 'BEGIN' || p1 === 'START') return 'BEGIN'
  if (p1 === 'END') return 'COMMIT'
  return (p1 ?? '').replace(/[^A-Z]/g, '')
}

/** Comandos que devolvem linhas mesmo sem colunas (SELECT sem FROM com 0 colunas é raro, mas existe). */
export const devolveTabela = (sql, campos) => campos.length > 0 || /^\s*(select|with|values|table|show|explain)\b/i.test(sql)
