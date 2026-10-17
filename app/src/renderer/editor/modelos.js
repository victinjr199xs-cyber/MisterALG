// Auto-digitação (Ctrl+Espaço): abreviatura → modelo. `|` marca onde o cursor
// fica. Lista do VisuAlg 3.0.7 (docs/spec/_sintese-B §2.7), com o bug do
// "aon" corrigido (o original inseria "aleatorio off").

export const MODELOS = {
  '!': 'algoritmo "semnome"\nvar\n|\ninicio\n\nfimalgoritmo',
  abs: 'abs(|)',
  ale: 'aleatorio |',
  aof: 'aleatorio off\n|',
  aon: 'aleatorio on\n|',
  alg: 'algoritmo "|"',
  arcc: 'arccos(|)',
  arcs: 'arcsen(|)',
  arct: 'arctan(|)',
  arq: 'arquivo "|"',
  asc: 'asc(|)',
  car: 'carac(|)',
  carp: 'caracpnum(|)',
  cof: 'cronometro off\n|',
  com: 'compr(|)',
  con: 'cronometro on\n|',
  cop: 'copia(|,,)',
  cos: 'cos(|)',
  cot: 'cotan(|)',
  dcc: 'declare | : caracter',
  dci: 'declare | : inteiro',
  dcl: 'declare | : logico',
  dcli: 'declare | : literal',
  dcn: 'declare | : numerico',
  dcr: 'declare | : real',
  deb: 'debug |',
  enq: 'enquanto | faca\nfimenquanto',
  eof: 'eco off\n|',
  eon: 'eco on\n|',
  esc: 'escreva(|)',
  escl: 'escreval(|)',
  escc: 'escolha |\ncaso\nfimescolha',
  esco: 'escolha |\ncaso\noutrocaso\nfimescolha',
  exp: 'exp(|)',
  fal: 'fimalgoritmo',
  fun: 'funcao |\ninicio\n\nfimfuncao',
  gra: 'grauprad(|)',
  ini: 'inicio',
  int: 'int(|)',
  inte: 'interrompa',
  lep: 'leia "|"',
  lem: 'mensagem |\nleia mensagem,',
  lim: 'limpatela\n|',
  log: 'log(|)',
  mai: 'maiusc(|)',
  men: 'mensagem |',
  min: 'minusc(|)',
  nump: 'numpcarac(|)',
  par: 'para | de 1 ate  faca\nfimpara',
  parp: 'para | de  ate  passo  faca\nfimpara',
  pos: 'pos(|,)',
  pro: 'procedimento |\ninicio\n\nfimprocedimento',
  qua: 'quad(|)',
  rad: 'radpgrau(|)',
  rai: 'raizq(|)',
  rep: 'repita\n|\nate',
  repf: 'repita\n|\nfimrepita',
  ret: 'retorne |',
  see: 'se | entao\nfimse',
  sen: 'sen(|)',
  ses: 'se | entao\nsenao\nfimse',
  tan: 'tan(|)',
  tim: 'timer on\n|\ntimer off',
  ton: 'timer on\n|',
  tof: 'timer off\n|',
  vet: 'vetor[|] de',
  vetc: 'vetor[|] de caracter',
  veti: 'vetor[|] de inteiro',
  vetl: 'vetor[|] de logico',
  vetn: 'vetor[|] de numerico',
  vetr: 'vetor[|] de real',
}

/** Modelo "#": cabeçalho com os dados pessoais das configurações. */
export function cabecalho(prefs, hoje = new Date()) {
  const data = hoje.toLocaleDateString('pt-BR')
  return [
    `// Disciplina  : ${prefs.disciplina ?? ''}`,
    `// Professor(a): ${prefs.professor ?? ''}`,
    '// Descrição   : Aqui você descreve o que o programa faz! (função)',
    '// Autor(a)    : Nome do(a) aluno(a)',
    `// Data atual  : ${data}`,
    '|',
  ].join('\n')
}

/** Texto do "Novo" (esqueleto do VisuAlg 3.0.7, §2.6.7). */
export function esqueleto(prefs, hoje = new Date()) {
  return [
    'Algoritmo "semnome"',
    `// Disciplina  : ${prefs.disciplina ?? ''}`,
    `// Professor(a): ${prefs.professor ?? ''}`,
    '// Descrição   : Aqui você descreve o que o programa faz! (função)',
    '// Autor(a)    : Nome do(a) aluno(a)',
    `// Data atual  : ${hoje.toLocaleDateString('pt-BR')}`,
    'Var',
    '// Seção de Declarações das variáveis ',
    '',
    '',
    'Inicio',
    '// Seção de Comandos, procedimento, funções, operadores, etc... ',
    'Fimalgoritmo',
    '',
  ].join('\n')
}

/**
 * Expande `modelo` com a indentação `recuo` nas linhas seguintes.
 * Devolve { texto, cursor } (cursor = deslocamento do `|` dentro do texto).
 */
export function expandir(modelo, recuo) {
  const linhas = modelo.split('\n').map((l, i) => (i === 0 ? l : recuo + l))
  const junto = linhas.join('\n')
  const cursor = junto.indexOf('|')
  return { texto: junto.replace('|', ''), cursor: cursor === -1 ? junto.length : cursor }
}

/** Lista da sugestão Ctrl+J: palavra e descrição (§2.8). */
export const SUGESTOES = [
  ['abs', '(valor : real) : real'], ['aleatorio', 'on | off | <menor valor>,<maior valor>'],
  ['algoritmo', '<nome do algoritmo>'], ['arccos', '(valor : real) : real'], ['arcsen', '(valor : real) : real'],
  ['arctan', '(valor : real) : real'], ['arquivo', '<nome do arquivo de dados>'], ['asc', '(s : caracter) : inteiro'],
  ['ate', '<expressão lógica>'], ['carac', '(c : inteiro) : caracter'], ['caracpnum', '(c : caracter) : inteiro ou real'],
  ['caracter', ''], ['caso', '<lista de expressões>'], ['compr', '(c : caracter) : inteiro'], ['const', ''],
  ['copia', '(c : caracter ; p, n : inteiro) : caracter'], ['cos', '(valor : real) : real'], ['cotan', '(valor : real) : real'],
  ['cronometro', 'on | off'], ['de', ''], ['debug', '<expressão lógica>'], ['declare', ''], ['div', ''], ['dos', ''], ['e', ''],
  ['eco', 'on | off'], ['enquanto', '<expressão lógica> faca'], ['entao', ''], ['escolha', '<expressão de seleção>'],
  ['escreva', '( <lista de expressões>)'], ['escreval', '( <lista de expressões>)'], ['exp', '(<base>,<expoente>)'],
  ['faca', ''], ['falso', ''], ['fimalgoritmo', ''], ['fimenquanto', ''], ['fimescolha', ''], ['fimfuncao', ''],
  ['fimpara', ''], ['fimprocedimento', ''], ['fimrepita', ''], ['fimse', ''],
  ['funcao', '<nome>(parâmetros) : tipo de retorno'], ['grauprad', '(valor : real) : real'], ['inicio', ''],
  ['int', '(valor : real) : inteiro'], ['inteiro', ''], ['interrompa', ''], ['leia', '(var1,var2,...,varN)'],
  ['limpatela', ''], ['lista', '<nome da lista>'], ['literal', ''], ['log', '(valor : real) : real'],
  ['logn', '(valor : real) : real'], ['logico', ''], ['maiusc', '(c : caracter) : caracter'], ['mensagem', '<texto>'],
  ['minusc', '(c : caracter) : caracter'], ['mod', ''], ['nao', ''], ['numerico', ''],
  ['numpcarac', '(n : inteiro ou real) : caracter'], ['ou', ''], ['outrocaso', ''],
  ['para', '<variável> de <início> ate <fim> faca'], ['passo', ''], ['pausa', ''], ['pi', ': real'],
  ['pos', '(subc, c : caracter) : inteiro'], ['procedimento', '<nome>(parâmetros)'], ['quad', '(valor : real) : real'],
  ['radpgrau', '(valor : real) : real'], ['raizq', '(valor : real) : real'], ['rand', ': real'],
  ['randi', '(limite : inteiro) : inteiro'], ['real', ''], ['repita', ''], ['retorne', '<valor de retorno da função>'],
  ['se', '<expressão lógica> entao'], ['sen', '(valor : real) : real'], ['senao', ''], ['tan', '(valor : real) : real'],
  ['timer', 'on | off | intervalo'], ['var', ''], ['verdadeiro', ''],
  ['vetor', '[ <limite inferior>..<limite superior>] de <tipo de dado>'], ['xou', ''],
]
