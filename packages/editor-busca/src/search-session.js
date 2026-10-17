/**
 * Estado da busca entre uma chamada e outra — o equivalente ao que o formulário
 * principal do VisuAlg guarda (último texto procurado, opções, histórico dos
 * combos) para que F3 / F4 continuem a busca sem abrir o diálogo.
 */

import {
  SearchError,
  TEXTO_NAO_ENCONTRADO,
  defaultOptions,
  findMatch,
  replaceAll,
} from './search-engine.js';

export const SEM_SELECAO = 'Não há texto selecionado.';

const pluralize = (n) => `${n} ${n === 1 ? 'substituição' : 'substituições'}`;

/** Histórico em ordem de uso: o mais recente primeiro, sem repetir. */
export function pushHistory(list, value, limit = 20) {
  if (!value) return list;
  return [value, ...list.filter((v) => v !== value)].slice(0, limit);
}

export class SearchSession {
  constructor({ historyLimit = 20 } = {}) {
    this.historyLimit = historyLimit;
    this.searchText = '';
    this.replaceText = '';
    this.options = { ...defaultOptions };
    this.searchHistory = [];
    this.replaceHistory = [];
    this.scope = null;
  }

  /** Guarda o que foi digitado no diálogo (botão OK). */
  remember({ search, replace = this.replaceText, options }, selection) {
    this.searchText = search;
    this.replaceText = replace;
    this.options = { ...defaultOptions, ...options };
    this.searchHistory = pushHistory(this.searchHistory, search, this.historyLimit);
    if (replace) this.replaceHistory = pushHistory(this.replaceHistory, replace, this.historyLimit);
    const hasSelection = selection && selection.end > selection.start;
    this.scope = this.options.selectedOnly && hasSelection ? { ...selection } : null;
  }

  /**
   * Localiza uma ocorrência. `continuing` = F3/F4: sempre a partir do cursor.
   * Se não achar, o cursor se recolhe no fim (ou início, para trás) da seleção
   * anterior, como no SynEdit.
   */
  find(text, selection, { backwards = this.options.backwards, continuing = false } = {}) {
    if (!this.searchText) return { found: false, needsDialog: true, selection, message: '' };
    if (this.options.selectedOnly && !this.scope) {
      return { found: false, selection, message: SEM_SELECAO };
    }

    const opts = { ...this.options, backwards };
    if (continuing) opts.fromCaret = true;

    let match;
    try {
      match = findMatch(text, this.searchText, opts, selection, this.scope);
    } catch (e) {
      if (e instanceof SearchError) return { found: false, selection, message: e.message };
      throw e;
    }

    if (!match) {
      const pos = backwards ? selection.start : selection.end;
      return { found: false, selection: { start: pos, end: pos }, message: TEXTO_NAO_ENCONTRADO };
    }
    return { found: true, selection: { start: match.start, end: match.end }, match, message: '' };
  }

  findNext(text, selection) {
    return this.find(text, selection, { backwards: false, continuing: true });
  }

  findPrevious(text, selection) {
    return this.find(text, selection, { backwards: true, continuing: true });
  }

  /** Substitui com confirmação ocorrência por ocorrência (ver `replaceAll`). */
  async replace(text, selection, confirm) {
    if (!this.searchText) return { needsDialog: true, text, replaced: 0, selection, message: '' };
    if (this.options.selectedOnly && !this.scope) {
      return { text, replaced: 0, skipped: 0, cancelled: false, selection, message: SEM_SELECAO };
    }

    let result;
    try {
      result = await replaceAll(text, this.searchText, this.replaceText, this.options, {
        selection,
        scope: this.scope,
        confirm,
      });
    } catch (e) {
      if (e instanceof SearchError) {
        return { text, replaced: 0, skipped: 0, cancelled: false, selection, message: e.message };
      }
      throw e;
    }

    if (this.scope) this.scope = result.scope;
    const touched = result.replaced + result.skipped;
    let message;
    if (touched === 0 && !result.cancelled) message = TEXTO_NAO_ENCONTRADO;
    else message = pluralize(result.replaced) + (result.cancelled ? ' (cancelado)' : '');
    return { ...result, selection: result.selection ?? selection, message };
  }
}
