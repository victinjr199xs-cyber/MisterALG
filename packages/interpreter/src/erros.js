// Catálogo de mensagens do VisuAlg 3.0.7 (textos literais extraídos do
// visualg30.exe — docs/spec/_sintese-A-linguagem.md §5).

export const MENSAGENS = {
  1: 'Um algoritmo começa com a palavra-chave ALGORITMO seguida do nome do programa, entre aspas; O VISUALG3 encontrou um comando (como VAR, INICIO, etc.) antes desta palavra e não pode continuar a execução do programa.',
  2: 'O VISUALG3 encontrou a palavra FIMALGORITMO, que determina o fim do código do programa, sem encontrar a palavra INICIO, que indica o começo do código (isto é, os comandos) do algoritmo, e não pode continuar a execução do programa.',
  3: 'Nenhum erro encontrado.',
  4: 'Esperava encontrar ALGORITMO.',
  5: 'Esperava encontrar INICIO.',
  6: 'Esperava encontrar FIMALGORITMO.',
  7: "'ALGORITMO' encontrado mais de uma vez.",
  8: '%s fora da seção de configuração.',
  9: '%s fora da seção de declarações.',
  10: "Comando '%s' fora da seção apropriada.",
  11: "Variável '%s' não foi encontrada.",
  12: "Nome inválido para variável ou campo de registro: '%s'.",
  13: "Nome inválido para procedimento ou função: '%s'.",
  14: "Tipo inválido para variável: '%s'.",
  15: "Esperava encontrar ',' (vírgula).",
  16: 'FIMPARA sem PARA correspondente.',
  17: 'FIMSE sem SE correspondente.',
  18: 'SENAO sem SE correspondente.',
  19: 'FIMENQUANTO sem ENQUANTO correspondente.',
  20: 'ATE sem REPITA correspondente.',
  21: 'Esperava encontrar FIMSE.',
  22: 'Esperava encontrar ATE.',
  23: "Esperava encontrar '('.",
  24: "Esperava encontrar ')'.",
  25: "Operador desconhecido '%s'.",
  26: `Número de '"' (aspas duplas) incorreto.`,
  27: 'Erro na atribuição de valores à variável %s.',
  28: 'Sintaxe incorreta.',
  29: 'Esperava um argumento do tipo %s.',
  30: 'Esperava encontrar %s.',
  31: 'O passo de um PARA...FACA não pode ser zero.',
  32: 'Esperava um nome de arquivo entre aspas.',
  33: 'Esperava um nome de variável.',
  34: 'Esperava uma variável do tipo %s.',
  35: "Variável ou constante '%s' declarada mais de uma vez.",
  36: "Nome duplicado para procedimento ou função: '%s'.",
  37: "Nome duplicado para parâmetro: '%s'.",
  38: 'Esperava encontrar FIMENQUANTO.',
  39: 'Esperava encontrar FIMPARA.',
  40: "O tipo de dados '%s' não foi reconhecido.",
  41: 'Esperava encontrar VETOR, INTEIRO, REAL, LOGICO ou CARACTER.',
  42: 'Sintaxe incorreta na declaração de variáveis.',
  43: 'O índice de um vetor deve ser uma expressão do tipo INTEIRO.',
  44: "Esperava encontrar '['.",
  45: "Esperava encontrar ']'.",
  46: 'Esperava encontrar ENTAO.',
  47: 'Esperava uma expressão do tipo %s.',
  48: 'O comando %s não é mais suportado no Visualg na versão 3.0 !',
  49: "Não consegui converter '%s' para um valor numérico.",
  50: 'O valor passado para um parâmetro por referência deve ser uma variável.',
  51: 'Valor inválido para a função %s.',
  52: 'Valor inválido para a operação %s.',
  // Mensagens próprias do MisterALG (situações sem texto no original).
  100: 'Índice fora dos limites do vetor %s.',
  101: "Procedimento ou função '%s' não foi encontrado.",
  102: "Número incorreto de argumentos para '%s'.",
  103: 'Excesso de chamadas aninhadas (recursão infinita?).',
  104: 'Lista %s inexistente.', // "Lista " + " inexistente" estão no exe; o ponto final é nosso
}

export const CABECALHO_ERRO = 'VisuAlg3 encontrou o seguinte problema em seu algoritmo, na linha %d :'

export const TEXTOS = {
  inicio: 'Início da execução',
  fimPrograma: '>>> Fim da execução do programa !',
  fimStatus: 'Fim da execução.',
  terminadoErro: '*** Execução terminada por erro.',
  terminadoUsuario: '*** Execução terminada pelo usuário.',
  jaTerminado: 'O programa já foi terminado!!!',
  rodapeConsole: ' MENSAGEM: Tecle <<ESC>> para fechar a janela do programa!',
  tituloConsole: 'Console simulando o modo texto do MS-DOS',
  cronoIniciado: 'Cronômetro iniciado.',
  cronoNaoIniciado: 'O cronômetro não foi iniciado.',
  cronoTerminado: 'Cronômetro terminado. Tempo decorrido: ',
}

function formatar(modelo, args) {
  let i = 0
  return modelo.replace(/%[sd]/g, () => String(args[i++] ?? ''))
}

/** Erro de análise ou de execução, com o número da linha do código (base 1). */
export class ErroVisualg extends Error {
  constructor(codigo, linha, ...args) {
    const mensagem = formatar(MENSAGENS[codigo] ?? MENSAGENS[28], args)
    super(mensagem)
    this.name = 'ErroVisualg'
    this.codigo = codigo
    this.linha = linha
    this.mensagem = mensagem
  }

  get cabecalho() {
    return formatar(CABECALHO_ERRO, [this.linha])
  }
}

export const erro = (codigo, linha, ...args) => new ErroVisualg(codigo, linha, ...args)
