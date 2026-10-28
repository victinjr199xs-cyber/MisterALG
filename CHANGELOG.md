# Novidades do MisterALG

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[versionamento semântico](https://semver.org/lang/pt-BR/). Cada item aponta o commit onde a mudança entrou.

## [1.11.0] — 2026-10-28

### Novidades

- **JavaScript**: `yield*` dentro de `async function*`, `for await` com rótulo, geradores assíncronos como
  método de classe, recursão até ~12 mil níveis (antes ~700) e aviso claro quando um `await` espera uma
  Promise que nunca termina.
- **C#**: `Span`/`ReadOnlySpan` e `stackalloc`, `BitConverter`, `Encoding.ASCII/Unicode/UTF32/Latin1`,
  `Convert` para Base64 e hexadecimal, fatias com subpadrão em padrões de lista, `ToLookup`, `new()` como
  argumento e `Math.DivRem` em tupla.
- **C no passo a passo (F8)**: funções variádicas com `va_list` (`va_start`, `va_arg`, `va_end`, `va_copy`) e
  arrays de tamanho variável (VLA), inclusive na tela de memória.
- **Tutorial**: na primeira vez que a IDE abre, o MisterALG oferece um passeio guiado (também em Ajuda > Tutorial
  do MisterALG). Balões destacam o editor, o F9, o F8, o F5, a tela de memória, o console, o assistente e a ajuda,
  com o texto de cada linguagem. Depois o tutorial guia o primeiro programa: escreve um exemplo, espera o aluno
  apertar F9, digitar o nome no console e seguir com F8 até o fim (no PHP, a página ao vivo; no SQL, um comando
  por vez). Esc fecha a qualquer momento, e a IDE continua funcionando por baixo.
- **Abrir quando o computador ligar**: opção na tela inicial e em Configurações > Sistema (desligada de fábrica).
  No Windows e no Mac fica nos itens de início do sistema; no Linux, em `~/.config/autostart`. Na versão portátil
  do Windows e no AppImage vale o arquivo que o aluno baixou. Desinstalar tira o MisterALG do início do Windows.
- **Fechar ou deixar em segundo plano**: o X da janela pergunta se é para fechar o MisterALG ou deixá-lo em segundo
  plano, com um ícone perto do relógio (clique para voltar; o menu dele tem Abrir e Sair). "Não perguntar de novo"
  guarda a escolha, que dá para mudar em Configurações > Sistema. Abrir o MisterALG de novo também traz a janela.
- **C++ no passo a passo (F8) com lambdas e a STL**: lambdas (captura por valor, por referência, `[n = 0]`, `this`,
  `auto` nos parâmetros, `mutable`), `map`, `set`, `multimap`, `multiset`, `unordered_map`, `unordered_set`, `list`,
  `deque`, `queue`, `priority_queue`, `stack`, `array`, `pair`, `tuple`, `tie`, `function`, `unique_ptr`,
  `shared_ptr`, `stringstream`, `numeric_limits`, `<numeric>` e quase todo o `<algorithm>`, além de `auto [a, b]`,
  `if constexpr` e `<bits/stdc++.h>`. A biblioteca é C++ de verdade, executada como o código do aluno (sem pausar
  nas linhas dela): o `map` aparece na memória como a árvore que é, a `list` com os nós ligados, o `shared_ptr` com
  o contador. Na tela de memória cada contêiner mostra também o conteúdo (`{"ana": 3, "bia": 1}`), e os tipos
  internos aparecem com nomes legíveis (`nó<...>`, `lambda da linha 12`).
- Saída igual à do g++ inclusive onde o C++ deixa a ordem livre: `sort` e `priority_queue` usam os algoritmos da
  libstdc++ (empates na mesma ordem) e o `unordered_map` usa a mesma dispersão e os mesmos tamanhos de tabela
  (percorre na mesma ordem). Manipuladores novos: `left`, `right`, `scientific`, `boolalpha`, `hex`, `showpos`...
- **`<bits/stdc++.h>` também no F9.**
- **Primeiro F9 do C++ mais rápido**: os cabeçalhos pré-compilados de `<iostream>` e `<bits/stdc++.h>` já vêm no
  instalador, e os que o app gera ficam no disco (antes sumiam ao fechar o app). Medido num app recém-aberto:
  `<iostream>` + `<vector>` de 4,5 s para 1,4 s; `<bits/stdc++.h>` de 5,5 s para 2,0 s.

- **Passo a passo do C/C++ mais rápido**: expressões simples calculadas sem gerador, o código da biblioteca
  não sobe mais um evento de linha por comando, caches por chamada e heap com busca binária. Um programa com
  2000 elementos em `vector`, `sort`, `map`, `set` e `unordered_map` roda em 1,9 s (antes, 7,2 s); C puro com
  laços e ponteiros, na metade do tempo.
- **F8 do C++ começa mais rápido**: os cabeçalhos vão sob medida para cada programa (só o que ele usa), e a
  árvore do `map`/`set` e a tabela do `unordered_map` fazem a busca e o rebalanceamento em JavaScript, com as
  mesmas regras da libstdc++ (o JSON do clang fica de 15% a 40% menor). A árvore do programa já é preparada em
  segundo plano depois de um F9 e ao abrir o arquivo, num worker à parte (o F9 nunca espera por ela): o F8
  nesse caso começa em menos de 0,2 s.

### Correções

- C++ no passo a passo: `set`/`map` com uma lambda como comparador (`set<int, decltype(cmp)> s(cmp)`); a ordem de
  `v[i] = ++i` agora é a do C++17 (o lado direito antes).
- PHP: a atualização automática da página (700 ms depois de cada edição) disparava mesmo depois de fechar a
  página ou de trocar de documento, e então reabria a página do PHP e escondia a tela do banco do SQL.
- C++ no passo a passo: membros `static` de mesmo nome em classes diferentes viravam uma variável só.
- C++ no passo a passo: uma exceção que atravessava um bloco destruía os temporários da expressão depois de liberar
  a pilha (`stoi(...)` dentro de `try` dava "acesso à variável de uma função que já terminou").
- Cópia de objetos de classes-template com construtor de cópia próprio dentro de um `vector` (antes copiava campo a
  campo); campos que são referência; especializações com argumentos padrão (`map<string, int>`).

### Testes

- 22 programas novos com a STL comparados com o g++ (`corpus-stl*.cpp.txt`) e testes de vazamento de memória,
  da tela de memória e do passo a passo dentro de lambdas. O teste diferencial agora roda também no Linux.

## [1.10.2] — 2026-10-24

### Novidades

- **JavaScript no estilo do Node**: `require('readline')` (`question`, `on('line')`, `readline/promises`),
  `fs.readFileSync(0)` para ler toda a entrada, `process.stdin`, `util` e `assert`. Esc encerra a entrada.
  Um módulo que não existe no MisterALG dá uma mensagem clara.
- **JavaScript assíncrono**: `await` direto no programa (fora de função `async`), `for await` (inclusive
  `for await (const linha of rl)` no readline e sobre `process.stdin`) e geradores `async function*`, com
  passo a passo e breakpoints.
- **C# 11**: deslocamento sem sinal `>>>` / `>>>=` (também dentro de `$"..."`) e textos brutos `"""…"""`
  (também com `$"""` e `$$"""`).
- **C# 11, padrões de lista**: `x is [1, 2, ..]`, `[var primeiro, .., var ultimo]`, `[1, .. var resto]` em `is`
  e `switch`, sobre vetores, `List<T>` e textos.
- **C#**: literais UTF-8 `"abc"u8` e `Encoding.UTF8` (`GetBytes`, `GetString`, `GetByteCount`).

## [1.10.0] — 2026-10-24

### Novidades

- **Exportar para C/C++ e Java**: o menu **Exportar para** agora gera, além do Pascal, o algoritmo em C (C99)
  e em Java (uma classe com `main` e `Scanner`).
- **Arquivo → Exemplos**: exemplos prontos de cada linguagem (vetores, recursão, entrada de dados) e um banco
  de escola no SQL. Abrem como documento novo, sem mexer no original.
- **SQL: setas das chaves estrangeiras** no painel do banco, ligando a coluna `REFERENCES` à tabela de origem.

### Testado contra as ferramentas oficiais

- Os motores de C/C++, Python, JavaScript, C# e SQL foram comparados com gcc, CPython, Node, .NET e psql
  rodando os mesmos programas, e as diferenças foram corrigidas: `printf` (`%g`, arredondamento de `%f`),
  vetores inicializados pela metade e `goto` no C; `console.log` igual ao do Node; datas, BigInteger, `?.`,
  `nameof` e `Parse` com cultura no C#; saída do SQL idêntica à do psql (inclusive `RETURNING`).
- Portugol: os 80 testes com os exemplos do VisuAlg 3.0.7 original passam; números grandes não mostram mais
  "ruído" nas casas decimais e a recursão sem fim tem uma mensagem clara.

### Interface e idiomas

- Mensagens de erro de todas as linguagens e mais 160 textos da interface traduzidos para os 18 idiomas;
  caixas de diálogo do sistema também traduzidas. Árabe da direita para a esquerda.
- O seletor de idioma da tela inicial não deixa mais a tela em branco.
- Desfazer (Ctrl+Z) funciona mesmo com o foco num botão da barra; contraste maior nos campos desativados.
- "Não salvar" ao descartar apaga a recuperação; programas que não são .alg salvam com a quebra de linha do sistema.

### Correções

- **Salvar mais seguro**: o arquivo é gravado primeiro numa cópia temporária, sincronizado no disco e só
  então troca de lugar com o original. Tirar o pen drive ou faltar espaço no meio não deixa mais o
  algoritmo vazio, e um erro ao salvar agora aparece numa mensagem (antes não acontecia nada).
- **JavaScript e TypeScript isolados**: o programa do aluno roda num Web Worker, sem acesso à tela da IDE
  nem aos arquivos do computador. Um laço infinito é encerrado pelo **Parar**.
- SQL e PHP: se o motor não consegue abrir, a mensagem aparece na hora (antes esperava 20 s com o aviso errado).
- Voltar para a tela inicial também encerra o PHP.
- Atualizador: o botão **Atualizar** só aparece se a versão nova tiver o arquivo do seu sistema.
- Teste novo para a comparação de versões do atualizador.
- Salvar mantém o atributo "oculto" do arquivo no Windows.
- **Pilha de ativação** (Ctrl+F3) agora funciona em JavaScript e TypeScript.
- As explicações dos erros do SQL aparecem no idioma escolhido (antes só em português).
- Testes novos: gravação de arquivos e, no teste do app, entrada de dados, laço infinito, fim normal e
  isolamento do JavaScript.

## [1.9.0] — 2026-10-24

### Atualizações pelo próprio app

- Ao abrir, o MisterALG pergunta ao GitHub se há versão nova e mostra uma faixa na tela inicial com
  **Novidades** e **Atualizar**. Também dá para procurar em **Ajuda → Procurar atualizações…**.
- **Windows (instalado)** e **Linux (AppImage)**: o app baixa a versão nova, mostra o progresso e
  reinicia já atualizado. **Mac**, versão **portátil** e **.deb/.rpm**: o botão **Baixar** abre a
  página da versão nova.
- A procura pode ser desligada na tela inicial ("Procurar atualizações ao abrir"). Nada além do número
  da versão é consultado.
- Os pacotes passam a sair com o `latest.yml` que o atualizador usa. A primeira atualização pelo app
  acontece da 1.9.0 para a próxima versão.
## [1.8.0] — 2026-10-24

### Nova linguagem: SQL

- **PostgreSQL de verdade** (PGlite, o PostgreSQL compilado para WebAssembly), dentro do app e sem
  internet: o que funciona aqui funciona no PostgreSQL da faculdade.
- **F9** roda o script inteiro e mostra cada resultado no formato do `psql` (`(2 rows)`, `INSERT 0 3`...).
- **F8** roda **um comando por vez** e para antes de cada um. A tela **Database** mostra as tabelas com
  as chaves primárias (🔑) e estrangeiras (→), e destaca as linhas **novas** (verde), **alteradas**
  (amarelo) e **apagadas** (riscadas).
- Erros com a linha certa e explicados em português (coluna ou tabela que não existe, `GROUP BY`,
  chave repetida, chave estrangeira, `NOT NULL`...).
- Cada execução começa com o banco vazio; uma consulta que não termina é interrompida em 20 segundos.
- Cartão **SQL** na tela inicial, arquivos `.sql` e textos traduzidos nos 18 idiomas.

### Melhorado

- As janelas (avisos, configurações) ficam escuras na IDE das linguagens de programação.
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

[1.9.0]: https://github.com/victinjr199xs-cyber/MisterALG/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/victinjr199xs-cyber/MisterALG/compare/v1.7.2...v1.8.0
[1.7.2]: https://github.com/victinjr199xs-cyber/MisterALG/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/victinjr199xs-cyber/MisterALG/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/victinjr199xs-cyber/MisterALG/compare/b8f4fd7...v1.7.0
[1.6.1]: https://github.com/victinjr199xs-cyber/MisterALG/releases/tag/v1.6.1
[1.6.0]: https://github.com/victinjr199xs-cyber/MisterALG/releases/tag/v1.6.0
