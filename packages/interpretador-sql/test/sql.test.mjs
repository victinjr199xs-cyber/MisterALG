import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { descreverErroSQL, dividirComandos, rotuloDoComando, tabelaPsql } from '../src/index.js'
import { executarComando, lerBanco, reiniciar } from '../src/executor.mjs'

test('divide os comandos e guarda a linha de cada um', () => {
  const fonte = `-- cria a tabela
create table t (a text);

insert into t values ('a;b'), ('it''s');
/* um ; aqui /* e aninhado ; */ não conta */
select "x;y" from t;
create function f() returns int as $$ select 1; $$ language sql;
select 1`
  const c = dividirComandos(fonte)
  assert.deepEqual(c.map((x) => x.linha), [2, 4, 6, 7, 8])
  assert.equal(c[1].sql, "insert into t values ('a;b'), ('it''s')")
  assert.equal(c[2].sql.startsWith('/*'), false)
  assert.match(c[3].sql, /\$\$ select 1; \$\$/)
  assert.equal(c[4].sql, 'select 1')
  assert.deepEqual(dividirComandos('  -- só comentário\n ;; '), [])
})

test('tabela no formato do psql', () => {
  const campos = [{ nome: 'id', tipo: 23 }, { nome: 'nome', tipo: 25 }]
  assert.equal(tabelaPsql(campos, [['1', 'Ana'], ['10', null]]), [
    ' id | nome',
    '----+------',
    '  1 | Ana',
    ' 10 |',
    '(2 rows)',
  ].join('\n'))
  assert.equal(tabelaPsql([{ nome: 'n', tipo: 23 }], [['5']]).endsWith('(1 row)'), true)
})

test('rótulos dos comandos como no psql', () => {
  assert.equal(rotuloDoComando('insert into t values (1)', 3), 'INSERT 0 3')
  assert.equal(rotuloDoComando('UPDATE t set a = 1', 2), 'UPDATE 2')
  assert.equal(rotuloDoComando('create table if not exists t (a int)'), 'CREATE TABLE')
  assert.equal(rotuloDoComando('create unique index i on t (a)'), 'CREATE INDEX')
  assert.equal(rotuloDoComando('drop table t'), 'DROP TABLE')
})

test('PostgreSQL de verdade: comandos, erros com a linha certa e a fotografia do banco', async () => {
  const db = await PGlite.create()
  const script = `create table curso (id serial primary key, nome text not null);
create table aluno (
  id serial primary key,
  nome text not null,
  curso_id int references curso (id)
);
insert into curso (nome) values ('ADS');
insert into aluno (nome, curso_id) values ('Ana', 1), ('Bia', 1);
select a.nome, c.nome as curso from aluno a join curso c on c.id = a.curso_id order by a.nome;
select idade
  from aluno;`
  const cmds = dividirComandos(script)
  const r = []
  for (const c of cmds) r.push(await executarComando(db, c.sql))
  assert.equal(r[3].afetadas, 2)
  assert.deepEqual(r[4].linhas, [['Ana', 'ADS'], ['Bia', 'ADS']])
  assert.equal(r[5].erro.codigo, '42703')
  const e = descreverErroSQL(r[5].erro, cmds[5])
  assert.equal(e.linha, 10)
  assert.match(e.explicacao, /coluna não existe/)

  const banco = await lerBanco(db)
  assert.deepEqual(banco.map((t) => t.nome), ['curso', 'aluno'])
  const aluno = banco[1]
  assert.deepEqual(aluno.colunas.find((c) => c.nome === 'curso_id').referencia, { tabela: 'curso', coluna: 'id' })
  assert.deepEqual(aluno.estrangeiras.map(({ nome, ...f }) => f), [{ colunas: ['curso_id'], tabela: 'curso', referencias: ['id'] }])
  assert.match(aluno.estrangeiras[0].nome, /curso_id_fkey/)
  assert.deepEqual(banco[0].estrangeiras, [])
  assert.equal(aluno.colunas.find((c) => c.nome === 'id').chave, true)
  assert.equal(aluno.total, 2)

  await reiniciar(db)
  assert.deepEqual(await lerBanco(db), [])
  await db.close()
})
