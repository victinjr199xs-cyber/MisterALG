// Os erros do PostgreSQL que mais aparecem para quem está começando, explicados em português.
// A chave é o SQLSTATE (o código de 5 letras que o PostgreSQL manda junto com a mensagem).

export const EXPLICACOES_SQL = {
  '42601': 'Erro de escrita no comando: confira vírgulas, parênteses, aspas simples nos textos e se a palavra-chave está certa (ela aparece logo depois de "at or near").',
  '42P01': 'A tabela não existe: confira o nome (o PostgreSQL guarda os nomes em minúsculas, a não ser que estejam entre aspas duplas) e se o CREATE TABLE veio antes.',
  '42703': 'A coluna não existe nessa tabela: confira o nome. Textos vão entre aspas simples (\'Ana\'); aspas duplas ("Ana") são para nomes de colunas.',
  '42702': 'O nome da coluna existe em mais de uma tabela do FROM: escreva tabela.coluna para dizer qual é.',
  '42P07': 'Já existe uma tabela com esse nome. Use outro nome, apague a antiga com DROP TABLE, ou escreva CREATE TABLE IF NOT EXISTS.',
  '42803': 'No SELECT com GROUP BY (ou com COUNT, SUM, AVG...), toda coluna que não está numa função de agregação precisa aparecer no GROUP BY.',
  '42883': 'Essa função ou operação não existe para esses tipos: confira o nome da função e os tipos dos valores (talvez falte converter com ::tipo).',
  '42804': 'O tipo do valor não combina com o tipo da coluna ou da expressão: converta com ::tipo ou CAST(valor AS tipo).',
  '23505': 'Valor repetido numa coluna que não aceita repetição (chave primária ou UNIQUE). Cada linha precisa ter um valor diferente ali.',
  '23503': 'Chave estrangeira: o valor não existe na tabela referenciada (ou ainda há linhas que dependem desta). Insira primeiro a linha "pai", ou apague antes as "filhas".',
  '23502': 'A coluna é NOT NULL: ela precisa de um valor. Inclua a coluna no INSERT ou dê um valor padrão (DEFAULT) a ela.',
  '23514': 'O valor não passou na regra CHECK da tabela.',
  '22P02': 'O texto não pode ser convertido para o tipo da coluna (por exemplo, \'abc\' numa coluna integer). Números vão sem aspas.',
  '22012': 'Divisão por zero.',
  '22001': 'O texto é maior do que o tamanho da coluna (varchar(n)).',
  '25P02': 'Um comando anterior falhou dentro de uma transação (BEGIN): desfaça com ROLLBACK para continuar.',
}

/** { codigo, mensagem, posicao } do PostgreSQL → { mensagem, explicacao, linha } para o aviso da IDE. */
export function descreverErroSQL(erro, comando) {
  const linhaNoComando = erro.posicao ? comando.sql.slice(0, Number(erro.posicao) - 1).split('\n').length - 1 : 0
  return {
    mensagem: `ERROR: ${erro.mensagem}${erro.codigo ? ` (SQLSTATE ${erro.codigo})` : ''}`,
    explicacao: EXPLICACOES_SQL[erro.codigo] ?? erro.dica ?? null,
    linha: comando.linha + linhaNoComando,
  }
}
