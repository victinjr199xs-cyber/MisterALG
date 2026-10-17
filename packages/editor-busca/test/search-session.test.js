import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchSession, pushHistory, SEM_SELECAO } from '../src/search-session.js';
import { TEXTO_NAO_ENCONTRADO } from '../src/search-engine.js';

const caret = (n) => ({ start: n, end: n });

test('histórico: mais recente primeiro, sem repetir, com limite', () => {
  let h = [];
  h = pushHistory(h, 'a');
  h = pushHistory(h, 'b');
  h = pushHistory(h, 'a');
  assert.deepEqual(h, ['a', 'b']);
  assert.deepEqual(pushHistory(h, '', 5), h);
  assert.deepEqual(pushHistory(['x', 'y', 'z'], 'w', 3), ['w', 'x', 'y']);
});

test('F3 sem busca anterior pede o diálogo', () => {
  const s = new SearchSession();
  assert.equal(s.findNext('abc', caret(0)).needsDialog, true);
});

test('F3 e F4 encadeiam a partir da seleção', () => {
  const s = new SearchSession();
  const text = 'ab ab ab';
  s.remember({ search: 'ab', options: {} }, caret(0));

  let r = s.find(text, caret(0));
  assert.deepEqual(r.selection, { start: 0, end: 2 });
  r = s.findNext(text, r.selection);
  assert.deepEqual(r.selection, { start: 3, end: 5 });
  r = s.findNext(text, r.selection);
  assert.deepEqual(r.selection, { start: 6, end: 8 });
  r = s.findPrevious(text, r.selection);
  assert.deepEqual(r.selection, { start: 3, end: 5 });
});

test('não achar recolhe o cursor e devolve a mensagem do VisuAlg', () => {
  const s = new SearchSession();
  s.remember({ search: 'ab', options: {} }, caret(0));
  const fim = { start: 6, end: 8 };

  const frente = s.findNext('ab ab ab', fim);
  assert.equal(frente.found, false);
  assert.equal(frente.message, TEXTO_NAO_ENCONTRADO);
  assert.deepEqual(frente.selection, caret(8));

  const inicio = { start: 0, end: 2 };
  const tras = s.findPrevious('ab ab ab', inicio);
  assert.equal(tras.message, TEXTO_NAO_ENCONTRADO);
  assert.deepEqual(tras.selection, caret(0));
});

test('escopo inteiro vale só na busca do diálogo; F3 sempre parte do cursor', () => {
  const s = new SearchSession();
  const text = 'ab ab';
  s.remember({ search: 'ab', options: { fromCaret: false } }, caret(4));
  const primeira = s.find(text, caret(4));
  assert.deepEqual(primeira.selection, { start: 0, end: 2 });
  const proxima = s.findNext(text, primeira.selection);
  assert.deepEqual(proxima.selection, { start: 3, end: 5 });
});

test('"só o texto selecionado" sem seleção avisa', () => {
  const s = new SearchSession();
  s.remember({ search: 'ab', options: { selectedOnly: true } }, caret(0));
  assert.equal(s.find('ab', caret(0)).message, SEM_SELECAO);
});

test('"só o texto selecionado" fixa o trecho para o F3', () => {
  const s = new SearchSession();
  const text = 'ab ab ab ab';
  s.remember({ search: 'ab', options: { selectedOnly: true, fromCaret: false } }, { start: 3, end: 8 });
  let r = s.find(text, { start: 3, end: 8 });
  assert.deepEqual(r.selection, { start: 3, end: 5 });
  r = s.findNext(text, r.selection);
  assert.deepEqual(r.selection, { start: 6, end: 8 });
  r = s.findNext(text, r.selection);
  assert.equal(r.found, false); // o quarto "ab" está fora do trecho
});

test('regex inválida vira mensagem, não exceção', () => {
  const s = new SearchSession();
  s.remember({ search: '(', options: { regex: true } }, caret(0));
  const r = s.find('abc', caret(0));
  assert.equal(r.found, false);
  assert.match(r.message, /Expressão regular inválida/);
});

test('substituir: conta, mensagem e histórico do campo "substituir por"', async () => {
  const s = new SearchSession();
  s.remember({ search: 'x', replace: 'y', options: { fromCaret: false } }, caret(0));
  assert.deepEqual(s.replaceHistory, ['y']);

  const r = await s.replace('x x x', caret(0));
  assert.equal(r.text, 'y y y');
  assert.equal(r.message, '3 substituições');

  s.remember({ search: 'y', replace: 'z', options: { fromCaret: false } }, caret(0));
  const um = await s.replace('y', caret(0));
  assert.equal(um.message, '1 substituição');
});

test('substituir sem ocorrências e cancelado', async () => {
  const s = new SearchSession();
  s.remember({ search: 'q', replace: 'w', options: {} }, caret(0));
  assert.equal((await s.replace('abc', caret(0))).message, TEXTO_NAO_ENCONTRADO);

  s.remember({ search: 'a', replace: 'b', options: {} }, caret(0));
  const r = await s.replace('a a', caret(0), () => 'cancel');
  assert.equal(r.cancelled, true);
  assert.equal(r.message, '0 substituições (cancelado)');
  assert.equal(r.text, 'a a');
});
