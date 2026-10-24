# Novidades do MisterALG

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[versionamento semântico](https://semver.org/lang/pt-BR/). Cada item aponta o commit onde a mudança entrou.

## [1.7.2] — 2026-10-23

- Instalador de Linux: o teste dos temas no Ubuntu volta para o Portugol antes de conferir as cores (a fumaça da IDE terminava no C++, que tem a IDE escura própria).

## [1.7.1] — 2026-10-23

Correções da auditoria da 1.7.0.

### Corrigido

- **Instaladores de Windows e Linux** voltam a ser gerados: o teste do C# lia as saídas esperadas com
  CRLF no Windows do GitHub, e o teste do Ubuntu esperava a IDE onde agora abre a tela inicial.
- **Recuperar algoritmo** depois de o app fechar de repente voltou a funcionar (o arquivo de
  recuperação era apagado ao abrir o app).
- **Duplo clique num `.alg`** no Windows e no Linux abre o arquivo. Com o app já aberto, o arquivo vai
  para a mesma janela (uma cópia só do app).
- Trocar o idioma ou voltar para a tela inicial **encerra os programas em execução** e não mostra mais
  o aviso falso de "não foi terminado corretamente".
- Laços pesados em **C#** não travam mais a tela: a execução devolve a vez a cada 16 ms.

### Removido

- A opção "Mostrar esta tela ao abrir", que deixou de existir quando a tela inicial virou obrigatória.

## [1.7.0] — 2026-10-23

A versão que transforma o MisterALG de "VisuAlg para Mac e Linux" em um ambiente para aprender
**oito linguagens**, com a interface em **dezoito idiomas**.

### Novas linguagens

- **C#**, com interpretador próprio: o tree-sitter lê o programa e uma máquina em geradores o executa
  passo a passo, com pilha de chamadas, objetos e referências desenhados com setas. Inclui classes,
  structs, records, interfaces (também explícitas), generics, delegates e eventos, LINQ, exceções,
  `checked`, tuplas, pattern matching, `Random` com o mesmo algoritmo do .NET e formatação numérica
  conferida contra o .NET em 816 casos. Cultura pt-BR por padrão. (`dacec74`, `93bd276`)
- **JavaScript e TypeScript** rodam de verdade no passo a passo (F8), com a pilha de chamadas, a fila
  de eventos (microtarefas, tarefas, Web APIs) e os objetos ligados por setas. (`f60184c`, `d04f92e`, `4cc004c`)
- **Python** com o Pyodide local (sem internet): passo a passo, `input()`, objetos e referências,
  erros traduzidos e a linha do erro marcada. (`dc73955`, `9f17817`, `4cc004c`)
- **PHP 8.3** de verdade (php-wasm): a página gerada aparece ao vivo, se atualiza enquanto você
  edita e tem a aba "HTML gerado". (`3b402da`)
- **C e C++**: parar um programa compilado volta a funcionar logo em seguida (F8 deixava de
  responder). (`4250291`)

### Tela inicial

- O app abre **só na tela inicial**: a IDE não é carregada por trás e só abre depois que você escolhe
  a linguagem (ou abre um arquivo). Nos testes e em arquivos abertos pelo sistema, vai direto para a
  IDE. (`ea70eb4`)
- Visual novo, no estilo de um *launcher*: grade de cartões numerados, cada linguagem com ícone
  ilustrado próprio, descrição, o que a IDE mostra e o botão **Criar programa**; dica do dia em
  destaque; arquivos recentes. (`13b685f`, `52106b3`, `b0f7f97`)
- **Sair** pergunta se você quer voltar para a tela inicial ou fechar o app. (`b0f7f97`)

### IDE para as linguagens de programação

- C#, JavaScript, TypeScript, Python, C, C++ e PHP ganharam uma IDE escura "de terminal", com o nome
  do arquivo em aba, painéis **Variables / Call stack and objects / Terminal** e as mensagens do
  terminal em inglês (`Process finished with exit code 0`). O Portugol continua com a tela do
  VisuAlg. (`f12edda`)
- Os modelos de programa novo começam com `Hello, World!`. (`b0f7f97`)

### Idiomas

- Interface em **18 idiomas**: português, inglês, espanhol, francês, alemão, italiano, holandês,
  polonês, turco, russo, ucraniano, árabe, hindi, indonésio, vietnamita, chinês, japonês e coreano.
  Escolha na tela inicial ou em **Manutenção → Idioma**. São traduzidos o menu, a tela inicial, a
  barra de ferramentas, as mensagens da barra de status, as janelas, as dicas do dia e as janelas do
  sistema (abrir, salvar, avisos). (`b0f7f97`, `86e2090`)

### Instaladores

- Python (Pyodide), PHP (php-wasm 8.3) e C# (tree-sitter) vão dentro do instalador
  (`scripts/preparar-linguagens.mjs`, chamado pelo `npm run dist:*`). (`ea6b298`)

### Qualidade

- Testes diferenciais do C#: 11 programas compilados com o `csc` do .NET e comparados linha a linha
  com o interpretador. (`93bd276`)
- Teste das traduções: todo texto tem tradução em todos os idiomas e os `{0}` são preservados. (`86e2090`)
- Testes de fumaça no app de verdade (`scripts/fumaca-ide.mjs`, `scripts/fumaca-linguagens.mjs`),
  agora cobrindo também o C# e o app empacotado.
- `npm test` passa a rodar também os testes do C#. (`9e4a96d`)

## [1.6.1] — 2026-10-17

- A dica do dia não abre junto com os termos de uso. (`277db91`)
- CI: os instaladores só são gerados nas tags; no `main` rodam só os testes. (`b8f4fd7`)

## [1.6.0]

- Botão de temas, cores do código configuráveis, exportar para Pascal, listas e dica do dia. (`f2bd11d`)

[1.7.2]: https://github.com/victinjr199xs-cyber/MisterALG/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/victinjr199xs-cyber/MisterALG/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/victinjr199xs-cyber/MisterALG/compare/b8f4fd7...v1.7.0
[1.6.1]: https://github.com/victinjr199xs-cyber/MisterALG/releases/tag/v1.6.1
[1.6.0]: https://github.com/victinjr199xs-cyber/MisterALG/releases/tag/v1.6.0
