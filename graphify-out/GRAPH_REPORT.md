# Graph Report - MisterALG  (2026-10-22)

## Corpus Check
- 105 files · ~185,171 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .alg 7, (none) 3, .json5 1)

## Summary
- 686 nodes · 1525 edges · 42 communities (26 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.84)
- Token cost: 117,093 input · 0 output

## Community Hubs (Navigation)
- Ajuda e Assistente (painel)
- Execução e Console
- Codificação e Formatos
- Parser do Portugol
- Exportação para Pascal
- Docs, CI e Templates
- Motor de Busca
- package.json Raiz
- Scripts de Imagens
- Realce do Editor
- Configuração do App
- Processo Principal e Preferências
- Assistente de IA (main)
- Sessão de Execução
- Dependências do App
- Arquivos CP1252
- Pacote editor-busca
- Janela e Preload
- Pacote interpreter
- Abertura Animada
- Controle via CDP
- Scripts de Build
- Indentação Automática
- Verificação de Codificação
- Fumaça dos Temas
- Temas e Menu
- Breakpoints do Editor
- Autor do App
- Teste AppArmor no CI
- Área do Editor (docs)
- Busca (docs)
- Template de Ideia

## God Nodes (most connected - your core abstractions)
1. `erro()` - 47 edges
2. `Parser` - 47 edges
3. `GeradorPascal` - 44 edges
4. `Maquina` - 33 edges
5. `el()` - 28 edges
6. `janela()` - 23 edges
7. `registrarIpc()` - 20 edges
8. `Sessao` - 17 edges
9. `criarAssistente()` - 14 edges
10. `scripts` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Issue template: Relatar um problema` --semantically_similar_to--> `CONTRIBUTING guide`  [INFERRED] [semantically similar]
  .github/ISSUE_TEMPLATE/1-problema.yml → CONTRIBUTING.md
- `atualizar()` --indirect_call--> `enviar()`  [INFERRED]
  app/src/renderer/assistente.js → scripts/cdp.mjs
- `criarBusca()` --calls--> `SearchSession`  [EXTRACTED]
  app/src/renderer/busca.js → packages/editor-busca/src/search-session.js
- `fonte()` --calls--> `decodificar()`  [EXTRACTED]
  testes-compat/exemplos.test.mjs → packages/interpreter/src/codificacao.js
- `Issue template: Relatar um problema` --references--> `MisterALG (Portugol IDE, VisuAlg-inspired)`  [EXTRACTED]
  .github/ISSUE_TEMPLATE/1-problema.yml → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Portugol interpreter pipeline (Sessao -> lexer -> parser -> maquina)** — docs_como_funciona_sessao, docs_como_funciona_lexer, docs_como_funciona_parser, docs_como_funciona_maquina [EXTRACTED 1.00]
- **VisuAlg compatibility verification (issue template, PR checklist, p0 oracle, CI tests)** — _github_issue_template_2_diferenca_visualg_template, _github_pull_request_template_template, docs_como_funciona_p0_oracle, _github_workflows_pacotes_testes, readme_visualg [INFERRED 0.85]
- **Renderer IDE surface (editor, console, variables grid driven by execucao.js)** — app_src_renderer_index_editor, app_src_renderer_index_console, app_src_renderer_index_variaveis, docs_como_funciona_execucao, docs_como_funciona_editor_js [INFERRED 0.85]

## Communities (42 total, 16 thin omitted)

### Community 0 - "Ajuda e Assistente (painel)"
Cohesion: 0.05
Nodes (70): abrirAjuda(), html(), PAGINAS, ACOES, contextoTexto(), criarAssistente(), abrir(), atualizar() (+62 more)

### Community 1 - "Execução e Console"
Cohesion: 0.05
Nodes (59): criarExecucao(), abrirConsole(), escrever(), iniciar(), mostrarVariaveis(), mudarCor(), novaSessao(), pedirEntrada() (+51 more)

### Community 2 - "Codificação e Formatos"
Cohesion: 0.07
Nodes (29): caractere1252(), codigo1252(), cp1252, TABELA_1252, utf8, fixo(), formatarSaida(), textoGrade() (+21 more)

### Community 4 - "Exportação para Pascal"
Cohesion: 0.15
Nodes (3): GeradorPascal, identificador(), textoPascal()

### Community 5 - "Docs, CI e Templates"
Cohesion: 0.06
Nodes (39): Issue template: Relatar um problema, Issue template: Diferenca em relacao ao VisuAlg, Issue chooser contact links (docs + releases), Pull request template, scripts/ci-ubuntu-seguranca.sh (AppArmor + sandbox test), CI job: pacote (matrix mac/win/linux installers on v* tags), CI job: testes (push to main), GitHub Actions workflow: MisterALG (Mac, Windows e Linux) (+31 more)

### Community 6 - "Motor de Busca"
Cohesion: 0.13
Nodes (22): ACTIONS, buildRegex(), defaultOptions, expandReplacement(), findMatch(), findPlain(), findRegex(), fold() (+14 more)

### Community 7 - "package.json Raiz"
Cohesion: 0.06
Nodes (31): allowScripts, electron@44.8.0, electron-winstaller@5.4.0, esbuild@0.25.12, description, devDependencies, electron, electron-builder (+23 more)

### Community 8 - "Scripts de Imagens"
Cohesion: 0.09
Nodes (12): quadros, raiz, saida, icone, print, raiz, CONCEITOS, console3d (+4 more)

### Community 9 - "Realce do Editor"
Cohesion: 0.11
Nodes (21): alternarBp, autodigitar(), campoBps, campoRealce, CHAVES, CONSTANTES, coresVisualg, definirRealce (+13 more)

### Community 10 - "Configuração do App"
Cohesion: 0.09
Nodes (20): description, homepage, license, main, name, private, productName, type (+12 more)

### Community 11 - "Processo Principal e Preferências"
Cohesion: 0.26
Nodes (18): aplicarTemaNativo(), atualizarMenu(), documentos(), estadoMenu, FILTROS_ALG, FILTROS_BLOCO, registrarIpc(), adicionarRecente() (+10 more)

### Community 12 - "Assistente de IA (main)"
Cohesion: 0.20
Nodes (16): PROVEDORES, provedorPorId(), separarSSE(), arquivoChaves(), cancelar(), chaveDe(), emAndamento, explicarErro() (+8 more)

### Community 14 - "Dependências do App"
Cohesion: 0.14
Nodes (14): devDependencies, @anthropic-ai/sdk, codemirror, @codemirror/autocomplete, @codemirror/commands, @codemirror/language, @codemirror/search, @codemirror/state (+6 more)

### Community 15 - "Arquivos CP1252"
Cohesion: 0.27
Nodes (11): anexarDados(), codificar(), cp1252, decodificar(), emCp1252(), gravarArquivo(), lerArquivo(), lerDados() (+3 more)

### Community 16 - "Pacote editor-busca"
Cohesion: 0.18
Nodes (10): description, exports, ./session, main, name, private, scripts, test (+2 more)

### Community 17 - "Janela e Preload"
Cohesion: 0.20
Nodes (4): caminhoPreload, caminhoRenderer, criarJanelaPrincipal(), electron

### Community 18 - "Pacote interpreter"
Cohesion: 0.20
Nodes (9): description, exports, main, name, private, scripts, test, type (+1 more)

### Community 19 - "Abertura Animada"
Cohesion: 0.39
Nodes (6): ICONE_SVG, escapar(), esperar(), mostrarAbertura(), pagina(), TRECHOS

### Community 20 - "Controle via CDP"
Cohesion: 0.25
Nodes (6): enviar(), erros, ferramentas, pendentes, [porta = '9333', roteiro], ws

### Community 21 - "Scripts de Build"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dist:linux, dist:mac, dist:win, start

### Community 22 - "Indentação Automática"
Cohesion: 0.38
Nodes (6): ABRE, corrigirIndentacao(), FECHA, normalizar(), primeiraPalavra(), SECOES

### Community 23 - "Verificação de Codificação"
Cohesion: 0.29
Nodes (5): argumentos, decodificador, EXTENSOES, problemas, RAIZ

### Community 24 - "Fumaça dos Temas"
Cohesion: 0.33
Nodes (3): contraste(), luminancia(), TOKENS

### Community 25 - "Temas e Menu"
Cohesion: 0.53
Nodes (4): temaPorId(), TEMAS, montarMenu(), aplicarTema()

### Community 26 - "Breakpoints do Editor"
Cohesion: 0.50
Nodes (5): criarEditor(), alternar(), decoBps, fonteCtrlJ(), linhasComBp()

### Community 27 - "Autor do App"
Cohesion: 0.67
Nodes (3): author, email, name

## Knowledge Gaps
- **22 isolated node(s):** `@misteralg/editor-busca`, `@misteralg/interpreter`, `codemirror`, `vite`, `electron-builder` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 241 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GeradorPascal` connect `Exportação para Pascal` to `Execução e Console`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `@misteralg/editor-busca`, `@misteralg/interpreter`, `codemirror` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Ajuda e Assistente (painel)` be split into smaller, more focused modules?**
  _Cohesion score 0.05042016806722689 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `Janela e Preload` to `package.json Raiz`, `Scripts de Imagens`, `Processo Principal e Preferências`, `Assistente de IA (main)`, `Abertura Animada`, `Temas e Menu`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Should `Execução e Console` be split into smaller, more focused modules?**
  _Cohesion score 0.05126582278481013 - nodes in this community are weakly interconnected._
- **Why does `gerarPascal()` connect `Execução e Console` to `Ajuda e Assistente (painel)`, `Exportação para Pascal`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Should `Codificação e Formatos` be split into smaller, more focused modules?**
  _Cohesion score 0.06944444444444445 - nodes in this community are weakly interconnected._