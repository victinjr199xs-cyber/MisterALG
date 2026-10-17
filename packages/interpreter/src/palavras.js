// Tabelas de palavras do Portugol do VisuAlg. Compartilhadas pelo lexer, pelo
// parser e pelo realce de sintaxe do editor (fonte única de verdade).

/** Maiúsculas e sem acento: a forma usada para comparar palavras-chave e nomes. */
export function normalizar(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
}

/** Sinônimos aceitos → forma canônica (já normalizada). */
export const SINONIMOS = {
  CARACTER: 'CARACTERE',
  LITERAL: 'CARACTERE',
  NUMERICO: 'REAL',
  VARIAVEL: 'VAR',
  DECLARE: 'VAR',
  MODULO: 'MOD',
  ATE_QUE: 'ATE',
}

export const canonica = (norm) => SINONIMOS[norm] ?? norm

export const PALAVRAS_CHAVE = new Set([
  'ALGORITMO', 'FIMALGORITMO', 'INICIO', 'VAR', 'CONST', 'TIPO', 'REGISTRO', 'FIMREGISTRO',
  'INTEIRO', 'REAL', 'CARACTERE', 'LOGICO', 'VETOR', 'DE',
  'SE', 'ENTAO', 'SENAO', 'FIMSE',
  'ESCOLHA', 'CASO', 'OUTROCASO', 'FIMESCOLHA',
  'PARA', 'ATE', 'PASSO', 'FACA', 'FIMPARA',
  'ENQUANTO', 'FIMENQUANTO', 'REPITA', 'FIMREPITA', 'INTERROMPA',
  'PROCEDIMENTO', 'FIMPROCEDIMENTO', 'FUNCAO', 'FIMFUNCAO', 'RETORNE',
  'ESCREVA', 'ESCREVAL', 'LEIA',
  'E', 'OU', 'NAO', 'XOU', 'MOD', 'DIV',
  'VERDADEIRO', 'FALSO',
  'ALEATORIO', 'ARQUIVO', 'CRONOMETRO', 'DEBUG', 'ECO', 'LIMPATELA', 'PAUSA', 'TIMER',
  'MUDACOR', 'DOS', 'PERFIL', 'LISTA', 'MENSAGEM', 'ON', 'OFF',
])

export const TIPOS_BASICOS = new Set(['INTEIRO', 'REAL', 'CARACTERE', 'LOGICO'])

/** Funções pré-definidas (28), na ordem da lista Ctrl+J do original. */
export const FUNCOES = [
  'abs', 'arccos', 'arcsen', 'arctan', 'asc', 'carac', 'caracpnum', 'compr', 'copia', 'cos',
  'cotan', 'exp', 'grauprad', 'int', 'log', 'logn', 'maiusc', 'minusc', 'numpcarac', 'pi',
  'pos', 'quad', 'radpgrau', 'raizq', 'rand', 'randi', 'sen', 'tan',
]

/** Grupos usados pelo realce do editor (cores do VisuAlg). */
export const REALCE = {
  tipos: ['inteiro', 'real', 'caractere', 'caracter', 'literal', 'logico', 'numerico', 'vetor', 'registro'],
  especiais: [
    'aleatorio', 'arquivo', 'cronometro', 'debug', 'eco', 'limpatela', 'pausa',
    'timer', 'mudacor', 'dos', 'perfil', 'lista', 'mensagem', 'on', 'off',
  ],
  constantes: ['verdadeiro', 'falso', 'pi'],
}
