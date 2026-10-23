// Mensagens do PHP em português, com uma explicação para quem está começando.
// O PHP escreve no stderr linhas como:  PHP Warning:  Undefined variable $x in /arquivo.php on line 3

const TRADUCOES = [
  [/^syntax error, unexpected end of file/, () => ['o arquivo terminou antes da hora', 'Falta fechar uma chave }, um parêntese ) ou um comando com ponto e vírgula. Conte as aberturas e os fechamentos.']],
  [/^syntax error, unexpected token "(.*)", expecting "(.*)"/, (x) => [`símbolo inesperado "${x[1]}" (esperava "${x[2]}")`, 'Confira a linha marcada e a de cima: o erro costuma ser um ponto e vírgula (;) que faltou no fim do comando anterior.']],
  [/^syntax error, unexpected token "(.*)"/, (x) => [`símbolo inesperado "${x[1]}"`, 'Confira a linha marcada e a de cima: o erro costuma ser um ponto e vírgula (;) que faltou, ou um parêntese/aspas sem par.']],
  [/^syntax error, unexpected identifier "(.*)"/, (x) => [`palavra inesperada "${x[1]}"`, 'Provavelmente faltou um ponto e vírgula (;) ou um operador (como o ponto da concatenação) antes dela.']],
  [/^syntax error, unexpected variable "(.*)"/, (x) => [`variável inesperada ${x[1]}`, 'Provavelmente faltou um ponto e vírgula (;) no fim da linha de cima.']],
  [/^syntax error, unexpected double-quoted string "(.*)"/, () => ['texto inesperado entre aspas', 'Para juntar textos use o ponto (.) ou escreva tudo dentro de uma só string.']],
  [/^syntax error/, (x, m) => [m, 'O programa tem um erro de escrita nesta linha (ou logo antes dela): ponto e vírgula, parênteses, chaves ou aspas.']],
  [/^Undefined variable (\$\w+)/, (x) => [`a variável ${x[1]} não existe`, 'Dê um valor à variável antes de usá-la (ex.: $nome = "Ana";) e confira a grafia — maiúsculas e minúsculas contam.']],
  [/^Undefined array key (.*)/, (x) => [`o índice ${x[1]} não existe no array`, 'Confira o índice (ou a chave) usado. Use isset($v[chave]) ou ?? para o caso de não existir.']],
  [/^Undefined index: (.*)/, (x) => [`o índice ${x[1]} não existe no array`, 'Confira a chave usada e use isset() para testar antes.']],
  [/^Undefined offset: (.*)/, (x) => [`a posição ${x[1]} não existe no array`, 'Os índices começam em 0 e vão até count()-1.']],
  [/^Undefined constant "(.*)"/, (x) => [`a constante "${x[1]}" não existe`, 'Textos precisam de aspas ("assim"). Sem aspas, o PHP acha que é o nome de uma constante.']],
  [/^Undefined property: (.*)/, (x) => [`a propriedade ${x[1]} não existe`, 'Confira o nome da propriedade do objeto.']],
  [/^Uncaught DivisionByZeroError: Division by zero/, () => ['divisão por zero', 'Não existe divisão por zero. Confira o divisor antes de dividir.']],
  [/^Uncaught DivisionByZeroError: Modulo by zero/, () => ['resto da divisão por zero', 'O divisor do % não pode ser zero.']],
  [/^Division by zero/, () => ['divisão por zero', 'Não existe divisão por zero. Confira o divisor antes de dividir.']],
  [/^Uncaught Error: Call to undefined function (.*)\(\)/, (x) => [`a função ${x[1]}() não existe`, 'Confira o nome (maiúsculas não contam em funções, mas a grafia sim) e se a função foi definida ou incluída (include/require).']],
  [/^Uncaught Error: Call to undefined method (.*)/, (x) => [`o método ${x[1]} não existe`, 'Confira o nome do método e a classe do objeto.']],
  [/^Uncaught Error: Class "(.*)" not found/, (x) => [`a classe "${x[1]}" não foi encontrada`, 'Confira a grafia e se o arquivo da classe foi incluído (require).']],
  [/^Uncaught Error: Call to a member function (.*) on null/, (x) => [`chamou ${x[1]} em algo que é null`, 'A variável antes da seta (->) não guarda um objeto. Confira de onde ela veio.']],
  [/^Uncaught TypeError: (.*)/, (x) => [`tipo de dado errado: ${x[1]}`, 'Uma função recebeu (ou devolveu) um valor de tipo diferente do esperado. Confira os argumentos da chamada.']],
  [/^Uncaught ArgumentCountError: (.*)/, (x) => [`quantidade errada de argumentos: ${x[1]}`, 'Passe um valor para cada parâmetro obrigatório da função.']],
  [/^Uncaught ValueError: (.*)/, (x) => [`valor inválido: ${x[1]}`, 'A função recebeu um valor fora do que ela aceita.']],
  [/^Uncaught (\w+): (.*)/, (x) => [`${x[1]}: ${x[2]}`, 'Uma exceção foi lançada (throw) e nenhum catch tratou.']],
  [/^Maximum execution time of (\d+) seconds? exceeded/, (x) => [`o programa passou de ${x[1]} segundos`, 'Provavelmente um laço que nunca termina (while ou for sem condição de parada).']],
  [/^Allowed memory size of .* exhausted/, () => ['faltou memória', 'O programa tentou guardar dados demais (um array enorme ou um laço que não para).']],
  [/^Cannot redeclare (.*)/, (x) => [`${x[1]} já foi declarada`, 'Duas funções (ou classes) com o mesmo nome. Renomeie uma delas.']],
  [/^Cannot modify header information - headers already sent/, () => ['header() depois de já ter escrito algo na página', 'header(), setcookie() e session_start() precisam vir antes de qualquer saída (echo, HTML ou até um espaço antes do <?php).']],
  [/^(include|require)(?:_once)?\((.*)\): Failed to open stream/, (x) => [`não achei o arquivo ${x[2]}`, 'Confira o nome do arquivo e se ele está na mesma pasta do programa (salve o programa antes para o include achar os outros arquivos).']],
  [/^(.*) expects parameter (\d+) to be (.*), (.*) given/, (x) => [`${x[1]}: o argumento ${x[2]} devia ser ${x[3]}`, 'Confira o tipo do valor passado na chamada.']],
  [/^Array to string conversion/, () => ['um array foi usado como texto', 'echo não mostra um array inteiro: use print_r($v), var_dump($v) ou implode(", ", $v).']],
  [/^Undefined function (.*)/, (x) => [`a função ${x[1]} não existe`, 'Confira o nome e se ela foi definida.']],
  [/^A non-numeric value encountered/, () => ['um valor que não é número entrou numa conta', 'Converta com (int) ou (float) e confira de onde veio o valor.']],
  [/^Unsupported operand types: (.*)/, (x) => [`operação sem sentido entre tipos: ${x[1]}`, 'Os dois lados da operação precisam ser de tipos compatíveis (número com número, texto com texto).']],
]

/** @returns { mensagem, explicacao } — o texto original em inglês, se não houver tradução, vai como está. */
export function traduzirMensagem(texto) {
  for (const [re, f] of TRADUCOES) {
    const x = re.exec(texto)
    if (x) {
      const [mensagem, explicacao] = f(x, texto)
      return { mensagem, explicacao }
    }
  }
  return { mensagem: texto, explicacao: 'Este erro aconteceu durante a execução do programa em PHP. Leia a mensagem: ela diz o que deu errado e em que linha.' }
}

const NIVEIS = { 'Parse error': 'parse', 'Fatal error': 'fatal', Warning: 'aviso', Notice: 'nota', Deprecated: 'obsoleto' }
const ROTULOS = { parse: 'Erro de sintaxe', fatal: 'Erro', aviso: 'Aviso', nota: 'Nota', obsoleto: 'Obsoleto' }

/**
 * Lê o stderr do PHP e devolve os diagnósticos: [{ nivel, rotulo, mensagem, original, explicacao, arquivo, linha }]
 * (nivel: 'parse' | 'fatal' | 'aviso' | 'nota' | 'obsoleto').
 */
export function lerDiagnosticos(stderr) {
  const saida = []
  const linhas = String(stderr ?? '').split('\n')
  for (let i = 0; i < linhas.length; i += 1) {
    // "PHP Fatal error:  Uncaught Error: Call to undefined function f() in /a.php:3" (e a linha 'thrown in ... on line N' mais abaixo)
    let m = /^PHP (Parse error|Fatal error|Warning|Notice|Deprecated):\s+(Uncaught .*?) in (.+?):(\d+)$/.exec(linhas[i])
    if (m) {
      saida.push({ nivel: NIVEIS[m[1]], original: m[2], arquivo: m[3], linha: Number(m[4]) })
      continue
    }
    m = /^PHP (Parse error|Fatal error|Warning|Notice|Deprecated):\s+(.*) in (.+?) on line (\d+)$/.exec(linhas[i])
    if (m) saida.push({ nivel: NIVEIS[m[1]], original: m[2], arquivo: m[3], linha: Number(m[4]) })
  }
  return saida.map((d) => {
    const t = traduzirMensagem(d.original)
    return { ...d, rotulo: ROTULOS[d.nivel], mensagem: t.mensagem, explicacao: t.explicacao }
  })
}
