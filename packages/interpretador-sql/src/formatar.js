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

/** Largura na tela, como o psql conta: letras acentuadas = 1, japonês/emoji = 2, acento solto (combinante) = 0. */
export function larguraNaTela(texto) {
  let w = 0
  for (const c of texto) {
    const p = c.codePointAt(0)
    if (p < 0x300) w += 1
    else if (/\p{M}|\p{Cf}/u.test(c)) w += 0
    else if ((p >= 0x1100 && p <= 0x115f) || (p >= 0x2e80 && p <= 0xa4cf && p !== 0x303f) || (p >= 0xac00 && p <= 0xd7a3) || (p >= 0xf900 && p <= 0xfaff)
      || (p >= 0xfe30 && p <= 0xfe6f) || (p >= 0xff00 && p <= 0xff60) || (p >= 0xffe0 && p <= 0xffe6) || (p >= 0x1f300 && p <= 0x1f64f)
      || (p >= 0x1f900 && p <= 0x1f9ff) || (p >= 0x20000 && p <= 0x3fffd)) w += 2
    else w += 1
  }
  return w
}

// Os tipos que o psql alinha à direita: int2, int4, int8, oid, xid, cid, float4, float8, money, numeric, xid8.
const ALINHADOS_A_DIREITA = new Set([...NUMERICOS, 28, 29, 790, 5069])

/**
 * Tabela no estilo do psql: cabeçalho centralizado, colunas separadas por "|", valores com várias linhas marcados
 * com "+", e "(n rows)". Igual ao psql byte a byte, inclusive os espaços do fim da linha.
 */
export function tabelaPsql(campos, linhas) {
  const rodape = `(${linhas.length} ${linhas.length === 1 ? 'row' : 'rows'})`
  if (campos.length === 0) return ['--', rodape].join('\n')
  const textos = linhas.map((l) => l.map((v, i) => textoDoValor(v, campos[i]?.tipo)))
  const partes = textos.map((l) => l.map((t) => t.split('\n')))
  const larguras = campos.map((c, i) => Math.max(larguraNaTela(c.nome), ...partes.map((l) => Math.max(...l[i].map(larguraNaTela)))))
  const ultima = campos.length - 1
  const centro = (s, w) => {
    const esq = Math.floor((w - larguraNaTela(s)) / 2)
    return ' '.repeat(esq) + s + ' '.repeat(w - larguraNaTela(s) - esq)
  }
  const cabecalho = campos.map((c, i) => ` ${centro(c.nome, larguras[i])} `).join('|')
  const separador = larguras.map((w) => '-'.repeat(w + 2)).join('+')
  const corpo = []
  partes.forEach((l) => {
    const altura = Math.max(...l.map((p) => p.length))
    for (let k = 0; k < altura; k += 1) {
      corpo.push(l.map((p, i) => {
        const t = p[k] ?? ''
        const continua = k + 1 < p.length
        const sobra = larguras[i] - larguraNaTela(t)
        if (p[k] === undefined && i === ultima) return ' '
        if (ALINHADOS_A_DIREITA.has(campos[i].tipo)) return ` ${' '.repeat(sobra)}${t}${i < ultima ? ' ' : ''}`
        if (i === ultima) return ` ${t}${continua ? '+' : ''}` // a última coluna não leva espaços de enchimento
        return ` ${t}${' '.repeat(sobra)}${continua ? '+' : ' '}`
      }).join('|'))
    }
  })
  return [cabecalho, separador, ...corpo, rodape].join('\n')
}

/** O que o psql escreve depois de um comando que não devolve tabela (INSERT 0 1, UPDATE 2, CREATE TABLE...). */
export function rotuloDoComando(sql, afetadas = 0) {
  const palavras = sql.replace(/^\s*\(+/, '').split(/\s+/).map((p) => p.toUpperCase())
  const [p1, p2, p3] = palavras
  if (p1 === 'INSERT') return `INSERT 0 ${afetadas}`
  if (['UPDATE', 'DELETE', 'MERGE', 'COPY', 'FETCH', 'MOVE'].includes(p1)) return `${p1} ${afetadas}`
  if (criaTabelaDeConsulta(sql)) return `SELECT ${afetadas}` // create table t as select..., select ... into t, create materialized view v as...
  if (p1 === 'TRUNCATE') return 'TRUNCATE TABLE'
  if (p1 === 'START') return 'START TRANSACTION'
  if (p1 === 'ABORT') return 'ROLLBACK'
  if (p1 === 'REFRESH') return 'REFRESH MATERIALIZED VIEW'
  if (p1 === 'LOCK') return 'LOCK TABLE'
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

// O comando sem os textos entre aspas simples e sem os comentários (para procurar palavras sem cair em 'create table').
const semTextos = (sql) => sql.replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

/**
 * O comando guarda o resultado numa tabela nova (e o psql escreve "SELECT n" em vez de uma tabela):
 * CREATE TABLE t AS SELECT..., CREATE MATERIALIZED VIEW v AS..., SELECT ... INTO t FROM...
 * @returns o nome da tabela criada (como escrito), ou null
 */
export function tabelaCriadaPorConsulta(sql) {
  const t = semTextos(sql)
  const nome = '("(?:[^"]|"")+"|[\\w$]+)(?:\\s*\\.\\s*("(?:[^"]|"")+"|[\\w$]+))?'
  const ctas = new RegExp(`^\\s*create\\s+(?:(?:global\\s+|local\\s+)?(?:temp\\s+|temporary\\s+)|unlogged\\s+)?(?:materialized\\s+view|table)\\s+(?:if\\s+not\\s+exists\\s+)?${nome}[^;]*?\\bas\\b`, 'i').exec(t)
  if (ctas) return ctas[2] ? `${ctas[1]}.${ctas[2]}` : ctas[1]
  if (/^\s*select\b/i.test(t)) {
    const i = t.search(/\binto\b/i)
    const f = t.search(/\bfrom\b/i)
    if (i >= 0 && (f < 0 || i < f)) {
      const m = new RegExp(`\\binto\\s+(?:(?:temp|temporary|unlogged)\\s+)?(?:table\\s+)?${nome}`, 'i').exec(t.slice(i))
      if (m) return m[2] ? `${m[1]}.${m[2]}` : m[1]
    }
  }
  return null
}
const criaTabelaDeConsulta = (sql) => tabelaCriadaPorConsulta(sql) !== null

/** Comandos que devolvem linhas mesmo sem colunas (SELECT sem FROM com 0 colunas é raro, mas existe). */
export const devolveTabela = (sql, campos) => !criaTabelaDeConsulta(sql) && (campos.length > 0 || /^\s*(select|with|values|table|show|explain)\b/i.test(sql))

/**
 * O que o psql escreve para um comando: a tabela, ou o rótulo (INSERT 0 1...). Com RETURNING vem a tabela e,
 * depois de uma linha em branco, o rótulo (INSERT 0 3), como no psql.
 */
export function resultadoPsql(sql, campos, linhas, afetadas = 0) {
  const rotulo = rotuloDoComando(sql, afetadas)
  if (!devolveTabela(sql, campos)) return rotulo
  const tabela = tabelaPsql(campos, linhas)
  return /^(INSERT|UPDATE|DELETE|MERGE)\b/.test(rotulo) ? `${tabela}\n\n${rotulo}` : tabela
}
