import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SearchError,
  expandReplacement,
  findMatch,
  fold,
  lineCol,
  replaceAll,
  wordAt,
} from '../src/search-engine.js';

const at = (text, query, options, selection, scope) => {
  const m = findMatch(text, query, options, selection, scope);
  return m && [m.start, m.end];
};

test('ignora maiúsculas por padrão e respeita matchCase', () => {
  assert.deepEqual(at('Algoritmo "x"', 'algoritmo'), [0, 9]);
  assert.equal(at('Algoritmo "x"', 'algoritmo', { matchCase: true }), null);
  assert.deepEqual(at('Algoritmo "x"', 'Algoritmo', { matchCase: true }), [0, 9]);
});

test('palavra inteira não casa dentro de outra palavra', () => {
  const t = 'nota1 nota notas';
  assert.deepEqual(at(t, 'nota', { wholeWord: true }), [6, 10]);
  assert.equal(at('avaré', 'var', { wholeWord: true }), null); // letra acentuada conta como letra
  assert.deepEqual(at('x_var', 'var'), [2, 5]);
  assert.equal(at('x_var', 'var', { wholeWord: true }), null); // _ faz parte da palavra
});

test('ignorar acentos mantém os índices do texto original', () => {
  const t = 'Média e media e MÉDIA';
  assert.deepEqual(at(t, 'media'), [8, 13]); // sem a opção: só a palavra sem acento
  assert.deepEqual(at(t, 'media', { ignoreAccents: true }), [0, 5]);
  assert.deepEqual(at(t, 'media', { ignoreAccents: true }, { start: 0, end: 5 }), [8, 13]);
  assert.deepEqual(at(t, 'media', { ignoreAccents: true }, { start: 13, end: 13 }), [16, 21]);
  assert.deepEqual(at('ação', 'ACAO', { ignoreAccents: true }), [0, 4]);
  assert.equal(at('ação', 'acao', { ignoreAccents: true, matchCase: true }) !== null, true);
  assert.equal(at('Ação', 'acao', { ignoreAccents: true, matchCase: true }), null);
});

test('fold preserva o comprimento', () => {
  const s = 'ÀÉÎÕÜ ç ß İ 😀';
  for (const o of [{}, { matchCase: true, ignoreAccents: true }, { ignoreAccents: true }]) {
    assert.equal(fold(s, o).length, s.length);
  }
});

test('para frente a partir do cursor, sem dar a volta', () => {
  const t = 'a b a b a';
  assert.deepEqual(at(t, 'a'), [0, 1]);
  assert.deepEqual(at(t, 'a', {}, { start: 0, end: 1 }), [4, 5]);
  assert.deepEqual(at(t, 'a', {}, { start: 4, end: 5 }), [8, 9]);
  assert.equal(at(t, 'a', {}, { start: 8, end: 9 }), null);
});

test('para trás termina no início da seleção', () => {
  const t = 'a b a b a';
  assert.deepEqual(at(t, 'a', { backwards: true }, { start: 9, end: 9 }), [8, 9]);
  assert.deepEqual(at(t, 'a', { backwards: true }, { start: 8, end: 9 }), [4, 5]);
  assert.deepEqual(at(t, 'a', { backwards: true }, { start: 4, end: 5 }), [0, 1]);
  assert.equal(at(t, 'a', { backwards: true }, { start: 0, end: 1 }), null);
});

test('escopo inteiro ignora o cursor nas duas direções', () => {
  const t = 'a b a b a';
  const cursor = { start: 4, end: 5 };
  assert.deepEqual(at(t, 'a', { fromCaret: false }, cursor), [0, 1]);
  assert.deepEqual(at(t, 'a', { fromCaret: false, backwards: true }, cursor), [8, 9]);
});

test('só o texto selecionado limita a busca ao trecho', () => {
  const t = 'ab ab ab ab';
  const scope = { start: 3, end: 8 }; // "ab ab"
  const o = { selectedOnly: true, fromCaret: false };
  assert.deepEqual(at(t, 'ab', o, undefined, scope), [3, 5]);
  assert.deepEqual(at(t, 'ab', { ...o, backwards: true }, undefined, scope), [6, 8]);
  assert.equal(at(t, 'ab', { selectedOnly: true }, undefined, null), null);
  // casamento que ultrapassa o fim do trecho não vale
  assert.equal(at('xxabcxx', 'abc', { selectedOnly: true, fromCaret: false }, undefined, { start: 0, end: 4 }), null);
});

test('consulta vazia ou inexistente não casa', () => {
  assert.equal(at('abc', ''), null);
  assert.equal(at('abc', 'z'), null);
  assert.equal(at('', 'a'), null);
});

test('expressão regular: casamento, maiúsculas, palavra inteira, vazio', () => {
  assert.deepEqual(at('x 12 y 345', '\\d+', { regex: true }), [2, 4]);
  assert.equal(at('x 12 y 345', '\\d+'), null); // sem a opção, "\d+" é texto literal
  assert.deepEqual(at('x 12 y 345', '\\d+', { regex: true }, { start: 2, end: 4 }), [7, 10]);
  assert.deepEqual(at('Leia(x)', 'LEIA', { regex: true }), [0, 4]);
  assert.equal(at('Leia(x)', 'LEIA', { regex: true, matchCase: true }), null);
  assert.deepEqual(at('nota1 nota', 'nota', { regex: true, wholeWord: true }), [6, 10]);
  assert.deepEqual(at('abc', 'x*', { regex: true }), null); // só casa vazio
  assert.deepEqual(at('a1\nb2', '^b', { regex: true }), [3, 4]); // ^ vale por linha
});

test('regex para trás devolve o último casamento antes do cursor', () => {
  const t = 'a1 b22 c333';
  assert.deepEqual(at(t, '\\d+', { regex: true, backwards: true }, { start: 11, end: 11 }), [8, 11]);
  assert.deepEqual(at(t, '\\d+', { regex: true, backwards: true }, { start: 8, end: 11 }), [4, 6]);
  assert.deepEqual(at(t, '\\d+', { regex: true, backwards: true }, { start: 4, end: 6 }), [1, 2]);
});

test('regex inválida lança SearchError', () => {
  assert.throws(() => findMatch('abc', '(', { regex: true }), SearchError);
});

test('expandReplacement', () => {
  const m = { groups: ['ab-cd', 'ab', 'cd'], named: { x: 'ab' } };
  assert.equal(expandReplacement(m, '$2 $1', true), 'cd ab');
  assert.equal(expandReplacement(m, '[$&] $$ $<x> $3 $0', true), '[ab-cd] $ ab $3 $0');
  assert.equal(expandReplacement(m, '$21', true), 'cd1'); // $2 seguido de "1"
  assert.equal(expandReplacement(m, '$1', false), '$1'); // modo texto: literal
});

test('replaceAll sem confirm troca tudo', async () => {
  const r = await replaceAll('um dois um dois um', 'um', 'UM');
  assert.equal(r.text, 'UM dois UM dois UM');
  assert.equal(r.replaced, 3);
});

test('replaceAll com escopo inteiro não repete a mesma ocorrência', async () => {
  const r = await replaceAll('aaa', 'a', 'aa', { fromCaret: false }, { selection: { start: 2, end: 2 } });
  assert.equal(r.text, 'aaaaaa');
  assert.equal(r.replaced, 3);
});

test('replaceAll respeita o cursor quando parte dele', async () => {
  const r = await replaceAll('a a a', 'a', 'b', { fromCaret: true }, { selection: { start: 2, end: 2 } });
  assert.equal(r.text, 'a b b');
});

test('confirmação: substituir, pular, todos e cancelar', async () => {
  const calls = [];
  const script = ['replace', 'skip', 'all'];
  const r = await replaceAll('x x x x x', 'x', 'y', {}, {
    confirm: (info) => {
      calls.push(info.match.start);
      return script.shift();
    },
  });
  assert.equal(r.text, 'y x y y y');
  assert.equal(r.replaced, 4);
  assert.equal(r.skipped, 1);
  assert.deepEqual(calls, [0, 2, 4]); // depois de "todos" não pergunta mais

  const c = await replaceAll('x x x', 'x', 'y', {}, { confirm: (i) => (i.match.start === 0 ? 'replace' : 'cancel') });
  assert.equal(c.text, 'y x x');
  assert.equal(c.cancelled, true);
});

test('confirm recebe o texto já alterado e posições coerentes', async () => {
  const seen = [];
  await replaceAll('a a', 'a', 'bbb', {}, {
    confirm: (info) => {
      seen.push([info.text, info.match.start, info.match.end]);
      return 'replace';
    },
  });
  assert.deepEqual(seen, [['a a', 0, 1], ['bbb a', 4, 5]]);
});

test('resposta inválida do confirm cancela', async () => {
  const r = await replaceAll('a a', 'a', 'b', {}, { confirm: () => 'talvez' });
  assert.equal(r.cancelled, true);
  assert.equal(r.text, 'a a');
});

test('substituição para trás', async () => {
  const r = await replaceAll('a a a', 'a', 'bb', { backwards: true }, { selection: { start: 5, end: 5 } });
  assert.equal(r.text, 'bb bb bb');
  assert.equal(r.replaced, 3);
});

test('substituição só no trecho selecionado ajusta o escopo', async () => {
  const r = await replaceAll('a [a a] a', 'a', 'xyz', { selectedOnly: true, fromCaret: false }, {
    scope: { start: 3, end: 6 },
  });
  assert.equal(r.text, 'a [xyz xyz] a');
  assert.deepEqual(r.scope, { start: 3, end: 10 });
});

test('regex com grupos na substituição', async () => {
  const r = await replaceAll('nome: ana\nnome: bia', '(\\w+): (\\w+)', '$2 = $1', { regex: true });
  assert.equal(r.text, 'ana = nome\nbia = nome');
});

test('substituir por texto idêntico não conta nem pergunta', async () => {
  let asked = 0;
  const r = await replaceAll('ab ab', 'ab', 'ab', {}, { confirm: () => { asked += 1; return 'replace'; } });
  assert.equal(asked, 0);
  assert.equal(r.replaced, 0);
  assert.equal(r.text, 'ab ab');
});

test('wordAt e lineCol', () => {
  assert.equal(wordAt('leia(nota1)', 7), 'nota1');
  assert.equal(wordAt('a  b', 2), '');
  assert.deepEqual(lineCol('ab\ncd', 4), { line: 2, col: 2 });
  assert.deepEqual(lineCol('ab\ncd', 0), { line: 1, col: 1 });
});
