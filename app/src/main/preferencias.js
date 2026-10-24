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
  coresSintaxe: {}, // por tema: { [idTema]: { comentario: '#rrggbb', ... } }
  mostrarDicas: true, // dica do dia ao abrir
  abertura: true, // animação de abertura (main/abertura.js)
  procurarAtualizacoes: true, // ao abrir, pergunta ao GitHub se há versão nova (main/atualizacao.js)
  idioma: 'pt', // idioma da interface (compartilhado/idiomas.js)
  // Assistente de IA (main/ia.js): desligado até o usuário ativar. As chaves ficam à parte, criptografadas.
  ia: { ativo: false, provedor: 'claude', modelos: {}, urls: {}, modo: 'dica' },
  dicaAtual: 0,
  // Listas do comando `lista` (as 3 primeiras são as do listas.txt do VisuAlg).
  listas: [
    { nome: 'MESES', itens: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'] },
    { nome: 'DIAS DA SEMANA', itens: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'] },
    {
      nome: 'ESTADOS',
      itens: [
        'Acre', 'Alagoas', 'Amazonas', 'Amapá', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás',
        'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco',
        'Piauí', 'Rio de Janeiro', 'Rondônia', 'Rio Grande do Norte', 'Roraima', 'Rio Grande do Sul', 'Santa Catarina',
        'Sergipe', 'São Paulo', 'Tocantins',
      ],
    },
    { nome: 'CORES', itens: ['Amarelo', 'Azul', 'Branco', 'Cinza', 'Laranja', 'Marrom', 'Preto', 'Rosa', 'Roxo', 'Verde', 'Vermelho'] },
    { nome: 'NOMES', itens: ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Pedro', 'Rafaela', 'Thiago'] },
  ],
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
