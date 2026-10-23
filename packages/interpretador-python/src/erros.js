// Erros do Python em português, com uma explicação para quem está começando
// (no mesmo estilo de traduzirErro do interpretador de JavaScript).

const POR_TIPO = {
  ZeroDivisionError: [/.*/, () => ['divisão por zero', 'Não existe divisão por zero. Confira o valor do divisor (o número depois de /, // ou %) antes de dividir.']],
  RecursionError: [/.*/, () => ['a pilha de chamadas estourou (recursão infinita?)', 'Uma função que chama a si mesma precisa de um caso base que pare a recursão.']],
  EOFError: [/.*/, () => ['o input() não recebeu nada para ler', 'O programa pediu uma entrada e a digitação foi encerrada (Esc) antes de chegar um valor.']],
  KeyboardInterrupt: [/.*/, () => ['programa interrompido', 'A execução foi interrompida.']],
  MemoryError: [/.*/, () => ['faltou memória', 'O programa tentou guardar dados demais de uma vez.']],
  AssertionError: [/.*/, (x, m) => [m ? `assert falhou: ${m}` : 'um assert falhou', 'Um assert é uma afirmação sobre o programa; ela era falsa neste ponto.']],
  StopIteration: [/.*/, () => ['não há mais itens para ler', 'O iterador chegou ao fim. Um for cuida disso sozinho; com next() é preciso tratar o fim.']],
  FileNotFoundError: [/'(.*)'$/, (x) => [`o arquivo ${x[1]} não existe`, 'Confira o nome e a pasta do arquivo. O MisterALG roda o programa numa pasta de trabalho própria.']],
  ModuleNotFoundError: [/No module named '(.*)'/, (x) => [`o módulo "${x[1]}" não foi encontrado`, 'Confira o nome do módulo. Aqui roda o Python padrão, sem internet: pacotes extras como numpy ou pandas não estão disponíveis.']],
  ImportError: [/cannot import name '(.*)' from '(.*)'/, (x) => [`"${x[1]}" não existe em "${x[2]}"`, 'Confira a grafia do nome que você quer importar.']],
  OverflowError: [/.*/, () => ['número grande demais para esta operação', 'O resultado não cabe no tipo usado (um float, por exemplo).']],
  UnboundLocalError: [/local variable '(.*)' referenced before assignment/, (x) => [`"${x[1]}" foi usada antes de receber um valor`, 'Dentro de uma função, uma variável que recebe valor com = é local: dê um valor a ela antes de usá-la (ou declare global).']],
  NameError: [/name '(.*)' is not defined/, (x) => [`"${x[1]}" não foi definida`, 'Crie a variável (nome = valor) antes de usá-la e confira a grafia — maiúsculas e minúsculas contam.']],
  IndexError: [/.*/, (x, m) => [/string/.test(m) ? 'índice fora do texto' : /tuple/.test(m) ? 'índice fora da tupla' : /pop/.test(m) ? 'pop de uma lista vazia' : 'índice fora da lista', 'Os índices começam em 0 e vão até tamanho-1. Confira o índice e use len() para saber o tamanho.']],
  KeyError: [/.*/, (x, m) => [`a chave ${m} não existe no dicionário`, 'Use "chave in dicionario" para conferir, ou dicionario.get(chave) para não dar erro.']],
  ValueError: [/invalid literal for int\(\) with base \d+: (.*)/, (x) => [`${x[1]} não pode virar um número inteiro`, 'int() só aceita texto com dígitos (ex.: "42"). Confira o que foi digitado e use try/except se precisar tratar.']],
  AttributeError: [/'(.*)' object has no attribute '(.*)'/, (x) => [x[1] === 'NoneType' ? `a variável é None e não tem "${x[2]}"` : `o tipo ${x[1]} não tem "${x[2]}"`, x[1] === 'NoneType' ? 'None quer dizer "sem valor". Uma função sem return devolve None; confira de onde esse valor veio.' : 'Confira o nome do atributo ou método e o tipo do objeto (maiúsculas contam).']],
}

// Dentro de um mesmo tipo, mensagens específicas vêm antes das gerais.
const ESPECIAIS = [
  ['ValueError', /could not convert string to float: (.*)/, (x) => [`${x[1]} não pode virar um número real`, 'float() só aceita texto como "3.14" (com ponto, não vírgula).']],
  ['ValueError', /math domain error/, () => ['valor fora do domínio da função', 'Por exemplo, raiz quadrada de número negativo ou logaritmo de zero.']],
  ['ValueError', /not enough values to unpack|too many values to unpack/, (x, m) => [m, 'A quantidade de variáveis à esquerda do = precisa ser igual à quantidade de valores à direita.']],
  ['TypeError', /unsupported operand type\(s\) for (.+): '(.*)' and '(.*)'/, (x) => [`não dá para usar ${x[1]} entre ${x[2]} e ${x[3]}`, 'Os dois lados da operação precisam ser de tipos compatíveis. Converta com int(), float() ou str().']],
  ['TypeError', /can only concatenate str \(not "(.*)"\) to str/, (x) => [`só dá para juntar texto com texto (veio ${x[1]})`, 'Converta com str(valor) ou use uma f-string: f"valor = {valor}".']],
  ['TypeError', /can't multiply sequence by non-int of type '(.*)'/, (x) => [`não dá para repetir um texto/lista ${x[1]} vezes`, 'Multiplicar texto ou lista só funciona com número inteiro.']],
  ['TypeError', /'(.*)' object is not callable/, (x) => [`um valor do tipo ${x[1]} não pode ser chamado como função`, 'Parênteses logo depois de um nome chamam uma função. Talvez o nome tenha sido sobrescrito por uma variável.']],
  ['TypeError', /'(.*)' object is not subscriptable/, (x) => [`o tipo ${x[1]} não aceita [ ]`, x[1] === 'NoneType' ? 'A variável é None (sem valor); confira de onde ela veio.' : 'Só listas, textos, tuplas e dicionários aceitam colchetes.']],
  ['TypeError', /'(.*)' object is not iterable/, (x) => [`o tipo ${x[1]} não dá para percorrer com for`, 'O for percorre listas, textos, range(), dicionários... Um número sozinho não: use range(n).']],
  ['TypeError', /'(.*)' object does not support item assignment/, (x) => [`o tipo ${x[1]} não aceita alterar um item com [ ] =`, 'Textos e tuplas são imutáveis: crie um novo valor em vez de alterar.']],
  ['TypeError', /(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/, (x) => [`${x[1]}() recebe ${x[2]} argumento(s), mas vieram ${x[3]}`, 'Confira a quantidade de valores na chamada. Em métodos, o self conta como o primeiro parâmetro.']],
  ['TypeError', /(\w+)\(\) missing (\d+) required positional arguments?: (.*)/, (x) => [`faltam ${x[2]} argumento(s) em ${x[1]}(): ${x[3]}`, 'Passe um valor para cada parâmetro da função.']],
  ['TypeError', /(\w+)\(\) got an unexpected keyword argument '(.*)'/, (x) => [`${x[1]}() não tem o parâmetro "${x[2]}"`, 'Confira o nome do parâmetro na definição da função.']],
  ['TypeError', /unhashable type: '(.*)'/, (x) => [`o tipo ${x[1]} não pode ser chave de dicionário nem entrar num set`, 'Use um tipo imutável (número, texto, tupla).']],
  ['TypeError', /object of type '(.*)' has no len\(\)/, (x) => [`len() não funciona com o tipo ${x[1]}`, 'len() mede textos, listas, tuplas, dicionários...']],
  ['TypeError', /'(<|>|<=|>=)' not supported between instances of '(.*)' and '(.*)'/, (x) => [`não dá para comparar ${x[2]} com ${x[3]} usando ${x[1]}`, 'Compare valores do mesmo tipo (converta com int() ou float()).']],
  ['IndentationError', /expected an indented block after (.*) on line (\d+)/, (x) => [`falta o bloco indentado depois de ${x[1]} (linha ${x[2]})`, 'Depois de ":" a próxima linha precisa ter recuo (4 espaços). Use pass se o bloco ficar vazio.']],
  ['IndentationError', /unexpected indent/, () => ['recuo inesperado', 'Esta linha está mais para a direita do que deveria. Alinhe com a linha de cima.']],
  ['IndentationError', /unindent does not match/, () => ['o recuo não bate com nenhum bloco anterior', 'Use o mesmo número de espaços em todas as linhas do mesmo bloco (não misture Tab e espaços).']],
  ['TabError', /.*/, () => ['mistura de Tab e espaços', 'Use só espaços (4 por nível) ou só Tab, nunca os dois.']],
  ['SyntaxError', /expected ':'/, () => ['falta o dois-pontos (:)', 'if, for, while, def, class e else terminam a linha com ":".']],
  ['SyntaxError', /unterminated string literal/, () => ['texto sem aspas de fechamento', 'Feche as aspas do texto na mesma linha.']],
  ['SyntaxError', /'(.)' was never closed/, (x) => [`o "${x[1]}" nunca foi fechado`, 'Conte os parênteses, colchetes e chaves: cada abertura precisa do seu fechamento.']],
  ['SyntaxError', /unmatched '(.)'/, (x) => [`o "${x[1]}" não tem par de abertura`, 'Sobrou um fechamento. Conte os parênteses, colchetes e chaves.']],
  ['SyntaxError', /invalid syntax\. Perhaps you forgot a comma/, () => ['falta uma vírgula (ou um operador) na linha', 'Entre dois valores seguidos numa lista, tupla ou chamada, falta uma vírgula.']],
  ['SyntaxError', /cannot assign to (.*) here\. Maybe you meant '==' instead of '='/, () => ['"=" no lugar de "=="', 'Para comparar use ==; = serve para dar valor a uma variável.']],
  ['SyntaxError', /invalid syntax/, () => ['escrita inválida nesta linha (ou logo antes dela)', 'Confira dois-pontos, parênteses, aspas e vírgulas, e se a palavra-chave está escrita certa (if, else, elif, for, while, def).']],
  ['SyntaxError', /'return' outside function/, () => ['return fora de uma função', 'O return só vale dentro de def.']],
  ['SyntaxError', /.*/, (x, m) => [m, 'O programa tem um erro de escrita nesta linha (ou logo antes dela).']],
]

/** @param tipo nome da exceção (ZeroDivisionError...) @param texto a mensagem original em inglês */
export function traduzirErro(tipo, texto) {
  const m = String(texto ?? '')
  for (const [t, re, f] of ESPECIAIS) {
    const x = t === tipo ? re.exec(m) : null
    if (x) {
      const [mensagem, explicacao] = f(x, m)
      return { mensagem: `${tipo}: ${mensagem}`, explicacao }
    }
  }
  const caso = POR_TIPO[tipo]
  const x = caso?.[0].exec(m)
  if (x) {
    const [mensagem, explicacao] = caso[1](x, m)
    return { mensagem: `${tipo}: ${mensagem}`, explicacao }
  }
  return { mensagem: m ? `${tipo}: ${m}` : tipo, explicacao: 'Este erro aconteceu durante a execução do programa em Python. Leia a última linha da mensagem: ela diz o que deu errado.' }
}
