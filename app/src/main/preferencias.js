// Preferências persistidas (equivalente ao VISUALG30.INI) em JSON, na pasta
// de dados do app (~/Library/Application Support/MisterALG no Mac).

import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

// Fonte monoespaçada que vem instalada em cada sistema.
const FONTE_DO_SISTEMA = { darwin: 'Menlo', win32: 'Consolas', linux: 'DejaVu Sans Mono' }[process.platform] ?? 'Courier New'

export const PADRAO = {
  fonte: FONTE_DO_SISTEMA,
  tamanho: 13,
  tabulacao: 3,
  numerarLinhas: true,
  tema: 'classico', // ids em ../compartilhado/temas.js
  mru: [],
  disciplina: '[Linguagem e Lógica de Programação]',
  professor: '',
  entidade: '',
  timer: 5, // índice da lista de intervalos (0,45 s)
  aleatorio: { de: 0, ate: 100, decimais: 0 },
}

const pasta = () => {
  const p = app.getPath('userData')
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}
const arquivoPrefs = () => join(pasta(), 'preferencias.json')
const arquivoRecuperacao = () => join(pasta(), 'misteralg.tmp')

export function lerPreferencias() {
  try {
    return { ...PADRAO, ...JSON.parse(readFileSync(arquivoPrefs(), 'utf8')) }
  } catch {
    return { ...PADRAO }
  }
}

export function gravarPreferencias(prefs) {
  const final = { ...lerPreferencias(), ...prefs }
  writeFileSync(arquivoPrefs(), JSON.stringify(final, null, 2), 'utf8')
  return final
}

/** Lista dos 5 últimos arquivos: o mais recente primeiro, sem repetir. */
export function adicionarRecente(caminho) {
  const prefs = lerPreferencias()
  const mru = [caminho, ...prefs.mru.filter((c) => c !== caminho)].slice(0, 5)
  return gravarPreferencias({ mru })
}

export function removerRecente(caminho) {
  const prefs = lerPreferencias()
  return gravarPreferencias({ mru: prefs.mru.filter((c) => c !== caminho) })
}

// ---- recuperação após falha (visualg3.tmp do original) ----

export function lerRecuperacao() {
  try {
    return JSON.parse(readFileSync(arquivoRecuperacao(), 'utf8'))
  } catch {
    return null
  }
}

export function gravarRecuperacao(dados) {
  writeFileSync(arquivoRecuperacao(), JSON.stringify(dados), 'utf8')
}

export function limparRecuperacao() {
  try {
    unlinkSync(arquivoRecuperacao())
  } catch {
    // não havia arquivo
  }
}
