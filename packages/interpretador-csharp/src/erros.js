// Erros do interpretador de C#.
//  - ErroCS: o programa usa algo que o interpretador não conhece, ou está errado de um jeito que o C# acusaria ao compilar.
//  - ExcecaoCS: uma exceção do C# (throw, ou erro em tempo de execução). Leva o objeto da exceção; o try/catch do aluno a pega.

export class ErroCS extends Error {
  constructor(mensagem, linha = 0, explicacao) {
    super(mensagem)
    this.mensagem = mensagem
    this.linha = linha
    this.explicacao = explicacao
  }
}

export class ExcecaoCS extends Error {
  constructor(valor, linha = 0) {
    super('exceção do C#')
    this.valor = valor
    this.linha = linha
  }
}

export const EXPLICACOES = {
  DivideByZeroException: 'Divisão inteira por zero. Confira o divisor antes de dividir (com double o resultado seria infinito, mas com int o C# lança esta exceção).',
  IndexOutOfRangeException: 'O índice está fora do array: os índices vão de 0 até Length - 1. Confira o índice usado e o tamanho do array.',
  ArgumentOutOfRangeException: 'O índice ou o valor está fora do intervalo permitido (por exemplo, list[i] com i maior ou igual a Count, ou Substring além do fim do texto).',
  NullReferenceException: 'A variável não guarda nenhum objeto (é null) e foi usada com "." ou "[ ]". Dê a ela um objeto (new) antes de usar.',
  InvalidCastException: 'O valor não pode ser convertido para esse tipo. Confira o tipo real do objeto antes do cast (use is ou as).',
  FormatException: 'O texto não tem o formato esperado, por exemplo int.Parse("abc"). Use int.TryParse para tratar o erro sem exceção.',
  KeyNotFoundException: 'A chave não existe no dicionário. Use ContainsKey ou TryGetValue antes de ler.',
  InvalidOperationException: 'A operação não vale no estado atual (por exemplo, tirar um item de uma pilha/fila vazia, ou First() numa lista vazia).',
  ArgumentNullException: 'Um argumento obrigatório veio null.',
  ArgumentException: 'Um argumento tem um valor que o método não aceita.',
  OverflowException: 'O número não cabe no tipo (por exemplo, um int maior que 2.147.483.647 em uma conversão com checked).',
  NotImplementedException: 'O método ainda não foi escrito (alguém deixou throw new NotImplementedException()).',
  NotSupportedException: 'Essa operação não é suportada.',
  InsufficientExecutionStackException: 'A pilha de chamadas estourou: uma função que chama a si mesma precisa de um caso base que pare a recursão.',
  OutOfMemoryException: 'Faltou memória para esta operação.',
  FileNotFoundException: 'O arquivo não existe. Confira o nome e a pasta.',
  TimeoutException: 'A operação demorou mais que o tempo permitido.',
}

/** A mensagem e a explicação, em português, de uma exceção do C# que ninguém tratou. */
export function descreverExcecao(m, objeto) {
  const nome = objeto.cls.nome
  const original = m.aTexto(m.rodarSync(m.lerMembro(objeto, 'Message')))
  return {
    mensagem: `${objeto.cls.nomeCompleto}: ${original}`.trim(),
    explicacao: EXPLICACOES[nome] ?? (objeto.cls.base && EXPLICACOES[objeto.cls.base.nome]) ?? 'Uma exceção foi lançada e nenhum catch tratou. Leia o nome e a mensagem: dizem o que deu errado.',
  }
}
