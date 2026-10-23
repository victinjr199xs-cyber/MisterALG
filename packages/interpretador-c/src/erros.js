// Erro de execução do passo a passo do C: a mensagem em português e a linha.

export class ErroC extends Error {
  constructor(mensagem, linha = 0, explicacao) {
    super(mensagem)
    this.mensagem = mensagem
    this.linha = linha
    this.explicacao = explicacao
  }
}

// Explicações, no estilo dos avisos do VisuAlg, para os erros que a memória detecta.
export const EXPLICACOES = {
  nulo: 'O ponteiro vale NULL (não aponta para nada). Confira se ele recebeu um endereço (de uma variável ou do malloc) antes de ser usado.',
  vetor: 'Em C, um vetor de N elementos vai do índice 0 ao N-1. Fora disso, o programa lê ou estraga a memória de outra variável.',
  liberado: 'Essa memória já foi devolvida com free(). Depois do free, o ponteiro não pode mais ser usado (ele fica "pendurado").',
  escopo: 'O ponteiro aponta para uma variável local de uma função que já terminou: essa memória não existe mais.',
  invalido: 'O ponteiro tem um endereço que não pertence a nenhuma variável nem a um bloco do malloc. Ele foi inicializado?',
  free: 'Só se pode passar para free() o endereço que o malloc/calloc/realloc devolveu, e uma vez só.',
  divisao: 'Divisão inteira por zero. Confira o valor do divisor antes de dividir.',
  pilha: 'Cada chamada de função ocupa um pedaço da pilha. Uma recursão sem caso base (ou com caso base que nunca acontece) enche a pilha.',
}
