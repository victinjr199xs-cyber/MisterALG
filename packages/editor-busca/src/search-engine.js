/**
 * Motor de busca e substituição de texto.
 *
 * Modelado no que o VisuAlg 3.0.7 faz através do componente SynEdit
 * (veja docs/EVIDENCIAS-VISUALG.md). São funções puras, sem DOM: recebem o
 * texto, as opções e a seleção atual, e devolvem posições (índices UTF-16).
 */

export const TEXTO_NAO_ENCONTRADO = 'Texto não encontrado!';

export class SearchError extends Error {}

/**
 * Opções equivalentes às do diálogo "Pesquisar o Texto" do VisuAlg.
 * `ignoreAccents` é uma extensão (o VisuAlg tem um rótulo parecido, mas o
 * comportamento exato dele não foi verificado).
 */
export const defaultOptions = Object.freeze({
  matchCase: false, // "Coincidir maiúsc./minusc."  (ssoMatchCase)
  wholeWord: false, // "Palavra inteira somente"    (ssoWholeWord)
  regex: false, // "Expressão Regular"          (TSynEditRegexSearch)
  ignoreAccents: false, // extensão: "Ignorar acentos" (desligado com regex)
  backwards: false, // Direção "para Trás"          (ssoBackwards)
  fromCaret: true, // false = escopo inteiro       (ssoEntireScope)
  selectedOnly: false, // "Só o texto selecionado"     (ssoSelectedOnly)
});

const MARKS = /\p{M}/gu;
const WORD_CHAR = /^[\p{L}\p{N}_]$/u;

const isWordChar = (ch) => ch !== undefined && WORD_CHAR.test(ch);

const stripAccents = (s) => s.normalize('NFD').replace(MARKS, '');

/**
 * Normaliza o texto para comparação sem mudar o seu comprimento, para que os
 * índices do texto normalizado valham também no texto original.
 * (Acentos já decompostos em marca combinante separada não são ignorados.)
 */
export function fold(text, { matchCase = false, ignoreAccents = false } = {}) {
  if (matchCase && !ignoreAccents) return text;
  const whole = (matchCase ? text : text.toLowerCase());
  const fast = ignoreAccents ? stripAccents(whole) : whole;
  if (fast.length === text.length) return fast;

  let out = '';
  for (const ch of text) {
    let c = ch;
    if (ignoreAccents) {
      const base = stripAccents(c);
      if (base.length === c.length) c = base;
    }
    if (!matchCase) {
      const low = c.toLowerCase();
      if (low.length === c.length) c = low;
    }
    out += c;
  }
  return out;
}

function isWholeWord(text, start, end) {
  return !isWordChar(text[start - 1]) && !isWordChar(text[end]);
}

function buildRegex(query, opts) {
  let source = query;
  if (opts.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  const flags = 'gum' + (opts.matchCase ? '' : 'i');
  try {
    return new RegExp(source, flags);
  } catch (e) {
    throw new SearchError(`Expressão regular inválida: ${e.message}`);
  }
}

function plainMatch(text, start, end) {
  return { start, end, text: text.slice(start, end), groups: null, named: null };
}

function regexMatch(m) {
  return {
    start: m.index,
    end: m.index + m[0].length,
    text: m[0],
    groups: Array.from(m),
    named: m.groups ?? null,
  };
}

function findPlain(text, query, opts, lo, hi, from, to) {
  const hay = fold(text, opts);
  const needle = fold(opts.ignoreAccents ? query.normalize('NFC') : query, opts);
  const n = needle.length;
  if (n === 0) return null;

  if (!opts.backwards) {
    let i = from;
    while (i >= 0 && i <= hi - n) {
      i = hay.indexOf(needle, i);
      if (i === -1 || i + n > hi) return null;
      if (!opts.wholeWord || isWholeWord(text, i, i + n)) return plainMatch(text, i, i + n);
      i += 1;
    }
    return null;
  }

  let i = to - n;
  while (i >= lo) {
    i = hay.lastIndexOf(needle, i);
    if (i === -1 || i < lo) return null;
    if (!opts.wholeWord || isWholeWord(text, i, i + n)) return plainMatch(text, i, i + n);
    i -= 1;
  }
  return null;
}

function findRegex(text, query, opts, lo, hi, from, to) {
  const re = buildRegex(query, opts);

  if (!opts.backwards) {
    re.lastIndex = from;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index >= hi) return null;
      const len = m[0].length;
      if (len === 0 || m.index + len > hi) {
        re.lastIndex = m.index + 1; // ignora casamentos vazios (evita laço infinito)
        continue;
      }
      return regexMatch(m);
    }
    return null;
  }

  // Para trás: varre do início, sem sobreposição (para "\d+" dar "333" e não só
  // o sufixo "3"), e fica com o último casamento que termina em `to` ou antes.
  re.lastIndex = lo;
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index >= to) break;
    const len = m[0].length;
    if (len > 0 && m.index + len <= to) last = m;
    re.lastIndex = m.index + Math.max(len, 1);
  }
  return last ? regexMatch(last) : null;
}

/**
 * Procura a próxima (ou anterior) ocorrência.
 *
 * - `selection`: seleção/cursor atual. Para frente a busca começa no fim dela;
 *   para trás, termina no início dela (como o SynEdit). Não dá a volta no texto.
 * - `scope`: trecho ao qual a busca fica limitada quando `selectedOnly` é true.
 * - Devolve `null` se não encontrar. Lança `SearchError` para regex inválida.
 */
export function findMatch(text, query, options = {}, selection = { start: 0, end: 0 }, scope = null) {
  const opts = { ...defaultOptions, ...options };
  if (!query) return null;

  let lo = 0;
  let hi = text.length;
  if (opts.selectedOnly) {
    if (!scope || scope.end <= scope.start) return null;
    lo = Math.max(0, scope.start);
    hi = Math.min(text.length, scope.end);
  }

  const from = opts.fromCaret ? Math.max(lo, selection.end) : lo;
  const to = opts.fromCaret ? Math.min(hi, selection.start) : hi;

  return opts.regex
    ? findRegex(text, query, opts, lo, hi, from, to)
    : findPlain(text, query, opts, lo, hi, from, to);
}

/** Expande $1, $&, $$ e $<nome> no texto de substituição (só no modo regex). */
export function expandReplacement(match, replacement, useRegex) {
  if (!useRegex || !match.groups) return replacement;
  return replacement.replace(/\$(\$|&|\d{1,2}|<([^>]+)>)/g, (all, token, name) => {
    if (token === '$') return '$';
    if (token === '&') return match.groups[0];
    if (name !== undefined) return match.named?.[name] ?? all;
    if (token.length === 2) {
      const two = Number(token);
      if (two > 0 && two < match.groups.length) return match.groups[two] ?? '';
    }
    const one = Number(token[0]);
    if (one > 0 && one < match.groups.length) return (match.groups[one] ?? '') + token.slice(1);
    return all;
  });
}

const ACTIONS = new Set(['replace', 'skip', 'all', 'cancel']);

/**
 * Substitui ocorrências, uma a uma, como o SynEdit com ssoPrompt/ssoReplaceAll.
 *
 * `confirm(info)` (opcional, pode ser assíncrona) é chamada a cada ocorrência e
 * devolve 'replace' | 'skip' | 'all' | 'cancel' — os quatro botões do diálogo
 * "Confirmar a substituição". Sem `confirm`, substitui tudo direto.
 * `info` = { text, match, replacement, replaced, skipped }, onde `text` é o texto
 * já com as substituições anteriores e `match` indexa esse texto.
 */
export async function replaceAll(
  text,
  query,
  replacement,
  options = {},
  { selection = { start: 0, end: 0 }, scope = null, confirm } = {},
) {
  const loopOpts = { ...defaultOptions, ...options };
  let current = text;
  let sel = { ...selection };
  let sc = scope ? { ...scope } : null;
  let replaced = 0;
  let skipped = 0;
  let cancelled = false;
  let all = !confirm;
  let last = null;

  for (;;) {
    const m = findMatch(current, query, loopOpts, sel, sc);
    if (!m) break;
    loopOpts.fromCaret = true; // depois da 1ª ocorrência, sempre continua de onde parou

    const rep = expandReplacement(m, replacement, loopOpts.regex);
    let action = 'replace';
    if (m.text === rep) {
      action = 'noop'; // substituir por texto idêntico não muda nada (SynEdit também pula)
    } else if (!all) {
      action = await confirm({ text: current, match: m, replacement: rep, replaced, skipped });
      if (!ACTIONS.has(action)) action = 'cancel';
    }

    if (action === 'cancel') {
      cancelled = true;
      break;
    }
    if (action === 'all') {
      all = true;
      action = 'replace';
    }

    last = { start: m.start, end: m.end };
    if (action === 'skip' || action === 'noop') {
      if (action === 'skip') skipped += 1;
      const pos = loopOpts.backwards ? m.start : m.end;
      sel = { start: pos, end: pos };
      continue;
    }

    current = current.slice(0, m.start) + rep + current.slice(m.end);
    replaced += 1;
    const endPos = m.start + rep.length;
    if (sc) sc.end += rep.length - (m.end - m.start);
    last = { start: m.start, end: endPos };
    const pos = loopOpts.backwards ? m.start : endPos;
    sel = { start: pos, end: pos };
  }

  return { text: current, replaced, skipped, cancelled, selection: last, scope: sc };
}

/** Palavra (letras, dígitos, _) que contém ou toca a posição `index`. */
export function wordAt(text, index) {
  let start = index;
  let end = index;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  return text.slice(start, end);
}

/** Linha e coluna (base 1) de uma posição, como a barra de status do VisuAlg. */
export function lineCol(text, index) {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const col = index - (before.lastIndexOf('\n') + 1) + 1;
  return { line, col };
}
