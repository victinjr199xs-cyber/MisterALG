// Todos os textos traduzíveis da interface, em português (o idioma de origem), numerados.
// Cada idioma (en.js, es.js...) traz { número: tradução }; o que faltar continua em português.
// {0}, {1}... marcam as partes que mudam (nome do arquivo, número da linha...) e precisam ficar na tradução.
// Ao acrescentar um texto aqui, use o próximo número livre e não reaproveite números.

export default {
  // ---- menu ----
  1: 'Sobre o MisterALG', 2: 'Configurações…', 3: 'Serviços', 4: 'Ocultar MisterALG', 5: 'Ocultar outros', 6: 'Mostrar tudo',
  7: 'Sair do MisterALG', 8: '&Arquivo', 9: '&Novo', 10: '&Abrir…', 11: '&Tela inicial', 12: '&Salvar', 13: 'Salvar &Como…',
  14: '&Imprimir…', 15: 'Sai&r', 16: 'E&ditar', 17: '&Desfazer', 18: '&Refazer', 19: 'Recor&tar', 20: '&Copiar', 21: 'Col&ar',
  22: '&Indentação', 23: '&Selecionar tudo', 24: '&Localizar…', 25: 'Localizar o &Próximo', 26: 'Localizar o &Anterior',
  27: 'S&ubstituir…', 28: '&Gravar bloco…', 29: 'I&nserir bloco…', 30: '&Run (executar)', 31: 'Rodar o &Algoritmo',
  32: 'Rodar &Passo a passo', 33: 'Rodar com Tempo', 34: '&Parar  (stop)', 35: '&Liga/desliga breakpoint',
  36: '&Desmarcar todas (os breakpoints)', 37: 'Executar em modo &DOS', 38: 'Linhas (Ativa/Desativa)', 39: '&Gerar valores aleatórios',
  40: 'Per&fil', 41: '&Pilha de ativação', 42: '&Exportar para', 43: 'a Linguagem &Pascal…', 44: 'a Linguagem &C / C++',
  45: 'a Linguagem &Java', 46: '&Manutenção', 47: '&Configurações', 48: '&Tema (cores)', 49: 'Personalizar as cores do código…',
  50: 'Assistente de &IA', 51: 'Configurar o assistente de IA…', 52: '&A Calculadora', 53: '&O Calendário', 54: '&Idioma',
  55: '&Help (Ajuda)', 56: 'A &Tela do MisterALG', 57: 'A &Linguagem (Portugol)', 58: '&Referência da Linguagem', 59: '&Dica do dia',
  60: '&Termos de uso e privacidade', 61: '&Sobre os autores do Software', 62: 'Janela',

  // ---- tela inicial ----
  70: 'Aprenda a programar vendo o código rodar.', 71: 'Em qual linguagem você quer programar?', 72: 'Começar', 73: 'Novo algoritmo',
  74: 'Abrir…', 75: 'Recentes', 76: 'Os algoritmos que você abrir aparecem aqui.', 77: 'Dica do dia',
  79: 'Animação de abertura', 80: 'Fechar', 81: 'Fechar (Esc)', 82: 'versão', 83: 'Idioma', 84: 'em breve',
  85: 'Variáveis, pilha de ativação e perfil, como no VisuAlg', 86: 'Pilha de chamadas, objetos e referências (setas)',
  87: 'Pilha de chamadas e fila de eventos', 88: 'O tipo de cada valor durante a execução', 89: 'Objetos e referências, ligados por setas',
  90: 'Biblioteca padrão completa (clang). Em breve: memória e ponteiros', 91: 'Biblioteca padrão completa (clang). Em breve: objetos',
  92: 'A página gerada, ao vivo', 93: 'Tela inicial do MisterALG', 94: 'Linguagens', 95: 'Criar programa', 96: 'Início',
  97: 'Ambiente de programação', 98: 'Lógica de programação em português', 99: 'Orientação a objetos com .NET', 100: 'A linguagem da web',
  101: 'JavaScript com tipos', 102: 'Simples, legível e poderosa', 103: 'Memória, ponteiros e desempenho', 104: 'C com classes e a STL',
  105: 'Páginas web geradas no servidor', 106: 'Como no VisuAlg', 107: 'Objetos e setas', 108: 'Pilha e eventos', 109: 'Tipos ao vivo',
  110: 'Memória e ponteiros', 111: 'Compilador clang', 112: 'Página ao vivo', 113: 'Criar programa: {0}', 114: 'MisterALG versão {0}',

  // ---- sair ----
  120: 'Sair', 121: 'Você quer voltar para a tela inicial do MisterALG ou fechar o aplicativo?', 122: 'Voltar para a tela inicial',
  123: 'Fechar o MisterALG', 124: 'Cancelar',

  // ---- tela da IDE ----
  130: 'Área de desenvolvimento de programas', 131: 'Permite CRIAR, ALTERAR, EXCLUIR, CONSULTAR e VISUALIZAR o código fonte escrito em Portugol',
  132: 'Área dos algoritmos ( Edição do código fonte ) -> Nome do arquivo: [{0}]', 133: 'Mostra todas as variáveis de memória (GLOBAIS e LOCAIS) usadas nos programas !',
  134: 'Áreas das variáveis de memória (Globais e Locais)', 135: 'Mostra o resultado final de um programa escrito em Portugol depois de finalizado !',
  136: 'Área de visualização dos resultados', 137: 'Escopo', 138: 'Nome', 139: 'Tipo', 140: 'Valor', 141: 'Página', 142: 'HTML gerado',
  143: 'Executar de novo (F9)', 144: 'Página gerada pelo PHP', 145: 'Console simulando o modo texto do MS-DOS',
  146: 'Use as setas (<- ou ->) <<Ctrl J>> p/ LISTA dos(Comandos/Funções)', 147: 'De:', 148: 'Até:', 149: 'Decimais:',
  150: 'Digita o valor aleatório inicial', 151: 'Digita o valor aleatório final', 152: 'Digita as casas decimais do valor aleatório',
  153: '(modificado)', 154: 'MisterALG — {0}', 155: 'MisterALG — {0} (modificado)',

  // ---- barra de ferramentas ----
  160: 'Botão Novo (⌘N)', 161: 'Botão Abrir (⌘O)', 162: 'Botão Salvar (⌘S)', 163: 'Botão Executar (F9)', 164: 'Botão Passo a Passo (F8)',
  165: 'Executar com Timer (Tempo) (Shift+F9)', 166: 'Botão Parar (Ctrl+F2)', 167: 'Botão Liga/desliga breakpoint (F5)',
  168: 'Botão Desmarca todos os breakpoints (Ctrl+F5)', 169: 'Botão Restaura a tela inicial do MisterALG', 170: 'Botão Cortar (⌘X)',
  171: 'Botão Copiar (⌘C)', 172: 'Botão Colar (⌘V)', 173: 'Botão Grava o bloco de texto selecionado (Ctrl+W)',
  174: 'Botão Insere um bloco de algoritmo na posição do cursor (Ctrl+R)', 175: 'Botão Desfazer (⌘Z)', 176: 'Botão Refazer (Shift+⌘Z)',
  177: 'Botão Localizar (⌘F ou Ctrl+L)', 178: 'Botão Localizar o próximo (F3)', 179: 'Botão Localizar o anterior (F4)',
  180: 'Botão Substituir (⌥⌘F ou Ctrl+U)', 181: 'Botão Corrigir indentação (Ctrl+G)', 182: 'Botão Imprimir (⌘P)', 183: 'Botão Perfil (F7)',
  184: 'Botão Ativa/Desativa Aleatório', 185: 'Botão Mostra a pilha de ativação dos procedimentos e funções (Ctrl+F3)',
  186: 'Mostra uma calculadora prática', 187: 'Mostra um calendário do ano atual', 188: 'Botão Temas: escolhe as cores da tela (claras ou escuras)',
  189: 'Botão Assistente de IA: explica o código e dá dicas (⌘I)', 190: 'Botão Ajuda on-line (F1)', 191: 'Sair do MisterALG',
  192: 'Botão Novo (Ctrl+N)', 193: 'Botão Abrir (Ctrl+A)', 194: 'Botão Salvar (Ctrl+S)', 195: 'Botão Cortar (Ctrl+X)', 196: 'Botão Copiar (Ctrl+C)',
  197: 'Botão Colar (Ctrl+V)', 198: 'Botão Desfazer (Ctrl+Z)', 199: 'Botão Refazer (Shift+Ctrl+Z)', 200: 'Botão Localizar (Ctrl+L)',
  201: 'Botão Substituir (Ctrl+U)', 202: 'Botão Imprimir (Ctrl+P)', 203: 'Botão Assistente de IA: explica o código e dá dicas (Ctrl+I)',

  // ---- mensagens da barra de status e da execução ----
  210: 'MENSAGEM: Executando o algoritmo...', 211: 'MENSAGEM: Digite o valor e tecle <Enter> (Esc termina a execução)', 212: 'Executando',
  213: 'Compilando', 214: 'Preparando', 215: 'MENSAGEM: Digite no console e tecle <Enter> para enviar ao programa (Esc para)',
  216: 'MENSAGEM: Lendo o programa em C#…', 217: 'MENSAGEM: Iniciando o Python…', 218: 'Preparando o passo a passo…',
  219: 'MENSAGEM: Analisando o programa para o passo a passo…', 220: 'MENSAGEM: Pronto! * Este algoritmo está salvo *',
  221: 'MENSAGEM: Exportar para Pascal só vale para algoritmos em Portugol.', 222: 'MENSAGEM: Pausado na linha {0} — F8 executa a linha, F9 continua, Ctrl+F2 para',
  223: 'MENSAGEM: Compilando com o clang…', 224: 'MENSAGEM: Compilando com o clang… (o passo a passo do C/C++ ainda vai chegar; o programa roda direto)',
  225: 'MENSAGEM: Página gerada pelo PHP em {0} ms — ela se atualiza sozinha quando você edita (F9 executa de novo)',
  226: 'MENSAGEM: Programa Pascal gravado em {0}', 227: 'MENSAGEM: Tecle <<ESC>> para fechar a janela do programa!',
  228: 'Início da execução', 229: '>>> Fim da execução do programa !', 230: 'Fim da execução.', 231: '*** Execução terminada por erro.',
  232: '*** Execução terminada pelo usuário.', 233: 'O programa já foi terminado!!!', 234: 'Cronômetro iniciado.', 235: 'O cronômetro não foi iniciado.',
  236: 'Compilando o programa em C…', 237: 'Compilando o programa em C++…', 238: 'Erro em tempo de execução: {0}',
  239: '(o programa terminou com o código {0})', 240: 'Função usada mas nunca escrita: {0}', 241: 'O programa não compilou.',
  242: 'O F9 roda o programa de verdade (rápido). Para ver a memória, os ponteiros, os objetos e cada linha, use o passo a passo (F8).',
  243: 'O programa tem um erro de escrita: confira ponto e vírgula, parênteses, chaves e aspas na linha marcada (ou na de cima).',
  244: 'O passo a passo do C usa uma biblioteca própria, menor que a de verdade. Rode com F9: ele usa o compilador completo, com toda a biblioteca padrão.',
  245: 'O passo a passo do C++ usa uma biblioteca própria, menor que a de verdade. Rode com F9: ele usa o compilador completo, com toda a biblioteca padrão.',

  // ---- painéis de memória ----
  250: 'Memória do programa: pilha, heap e globais (setas = ponteiros)', 251: 'Pilha de chamadas e objetos (setas = referências)',
  252: 'Sem valor ainda: em C ela teria "lixo" (o que estava na memória antes)', 253: 'sem variáveis', 254: 'devolvido com free()',
  255: 'Pilha (uma caixa por chamada de função)', 256: 'o programa ainda não começou', 257: 'Heap (memória do malloc)',
  258: 'nenhum bloco: o programa ainda não chamou malloc', 259: 'Microtarefas (Promises: passam na frente)', 260: 'Fila de tarefas (callbacks prontos)',
  261: 'Web APIs (temporizadores esperando)', 262: 'Objetos (as setas saem das referências)', 263: 'Pilha de chamadas',
  264: 'Laço de eventos (relógio virtual: {0} ms)', 265: '{0} bytes (tipo ainda desconhecido)',

  // ---- erros do C/C++ explicados ----
  270: 'Esse nome não foi declarado. Confira a grafia (maiúsculas contam) e se a variável foi declarada antes de ser usada.',
  271: 'Função desconhecida: falta o #include da biblioteca dela, o nome está errado, ou ela foi escrita depois do main sem protótipo.',
  272: 'Biblioteca não encontrada. Confira o nome no #include (por exemplo, <stdio.h> ou <iostream>).', 273: 'Algo foi declarado duas vezes com o mesmo nome.',
  274: 'Os argumentos não combinam com nenhuma versão dessa função: confira a quantidade e os tipos.',
  275: 'Essa operação não vale para esses tipos (por exemplo, somar um texto com um número).',
  276: 'Tipos incompatíveis: confira se não faltou ou sobrou um & ou * (no scanf, as variáveis levam &).',
  277: 'O programa compilou, mas parou no meio da execução. A causa mais comum é um ponteiro inválido, um índice fora do vetor ou uma divisão por zero.',
  278: 'O programa chama uma função que não existe aqui: confira o nome, escreva a função, ou ela é de uma biblioteca que o MisterALG ainda não tem.',

  // ---- aviso de erro e janelas ----
  280: 'O MisterALG encontrou o seguinte problema em seu algoritmo :', 281: 'O MisterALG encontrou o seguinte problema em seu algoritmo, na linha {0} :',
  282: 'Conteúdo da linha:', 283: 'Explicação:', 284: 'Não há explicação disponível para este problema.', 285: '✨ Perguntar à IA', 286: 'Aviso',
  287: 'Toda variável precisa ser declarada na seção "var" antes de ser usada. Verifique a grafia do nome.',
  288: 'O valor tem um tipo diferente do tipo da variável. Use numpcarac() ou caracpnum() para converter números e textos.',
  289: 'Use uma expressão inteira como índice (por exemplo v[i] ou v[i \\ 2]); a divisão "/" sempre dá real.',
  290: 'Todo "se" precisa de "entao" na mesma linha da condição.', 291: 'Digite um número. O separador decimal é o ponto (3.5), não a vírgula.',
  292: 'Divisão por zero, ou potência impossível (ex.: número negativo elevado a expoente fracionário).',
  293: 'O índice está fora da faixa declarada para o vetor. Confira os limites em "vetor[inicio..fim]".',
  294: 'Função', 295: 'Procedimento', 296: 'O algoritmo não está sendo executado', 297: 'Pilha de Ativação', 298: 'Perfil de execução',
  299: 'O algoritmo ainda não foi executado.', 300: 'Linha', 301: 'Vezes', 302: 'OK', 303: 'Sim', 304: 'Não', 305: 'Salvar', 306: 'Aceito',
  307: 'Não aceito', 308: 'Excluir', 309: 'Enviar', 310: 'Terminar', 311: 'Falha!', 312: 'Copiar', 313: 'Código',
  314: 'O algoritmo [{0}] foi modificado. Deseja salvá-lo ?',
  315: 'O MisterALG não foi terminado corretamente da última vez que foi executado. Deseja recuperar o algoritmo que estava sendo editado?',

  // ---- configurações ----
  320: 'Opções de configuração do ambiente', 321: 'Editor', 322: 'Personalizar', 323: 'Listas', 324: 'Cores', 325: 'Fonte:', 326: 'Tamanho:',
  327: 'Tema (cores da tela):', 328: 'Largura da Tabulação (colunas):', 329: 'Disciplina:', 330: 'Professor(a):', 331: 'Entidade (escola/faculdade):',
  332: 'Esses dados entram no cabeçalho do "Novo" algoritmo e na abreviatura "#".', 333: 'Listas:', 334: 'Itens (um por linha):',
  335: 'Com "aleatorio on", o comando "lista <nome>" faz o leia de caractere sortear um item da lista.', 336: 'Clique de novo para excluir a lista {0}.',
  337: 'Cores do código para o tema escolhido na aba Editor. Cada tema guarda as suas.', 338: 'Comandos (escreva, se, para...)',
  339: 'Estrutura (algoritmo, var, inicio...)', 340: 'Tipos (inteiro, real...)', 341: 'Variáveis e nomes', 342: 'Textos e números', 343: 'Comentários',
  344: 'Programa gerado para o Free Pascal. Comandos sem equivalente aparecem como comentário.', 345: 'Salvar .pas…',
  346: '◀ Anterior', 347: 'Próxima ▶', 348: 'Mostrar uma dica ao abrir o MisterALG', 349: 'Calendário de {0}',
  350: 'Antes de usar o MisterALG, leia os Termos de Uso e a Política de Privacidade:', 351: 'Termos de Uso e Política de Privacidade',
  352: 'Interpretador, editor e visualizador de algoritmos em Portugol para macOS.',
  353: 'Os programas .alg feitos no VisuAlg do Windows abrem e rodam aqui, e os salvos aqui continuam abrindo lá.',
  354: 'Software livre sob a Licença MIT. Código-fonte: github.com/victinjr199xs-cyber/MisterALG',

  // ---- localizar / substituir ----
  360: 'Procurar por:', 361: 'Substituir por :', 362: 'Opções:', 363: 'Direção:', 364: 'Coincidir maiúsc./minusc.', 365: 'Só o texto selecionado',
  366: 'Expressão Regular', 367: 'para Trás', 368: 'para Frente', 369: 'Confirmar a substituição', 370: 'Localizar', 371: 'Substituir',
  372: 'Substituir tudo',

  // ---- assistente de IA ----
  380: '✨ Assistente de IA', 381: 'Pergunte sobre o seu algoritmo… (Enter envia)', 382: 'Corrigir indentação', 383: 'Explicar o código',
  384: 'Me dá uma dica', 385: 'Por que deu erro?', 386: 'Sugerir testes', 387: 'Uma IA para tirar dúvidas enquanto você programa.',
  388: 'Ela explica o código, aponta o motivo de um erro e dá dicas sem entregar a resposta (modo dica).',
  389: 'Funciona com Claude, ChatGPT/Codex, DeepSeek, Gemini e outros, usando a sua chave de API. Com o Ollama, a IA roda no seu computador e nada sai dele.',
  390: 'Vem desligado. O código só é enviado ao provedor quando você faz uma pergunta.', 391: '(sem resposta)', 392: '(resposta interrompida)',
  393: 'Endereço da API:', 394: 'Chave de API:', 395: '•••••••• (guardada; deixe em branco para manter)', 396: 'Ativar o Assistente de IA',
  397: 'Modo dica: explica e dá pistas, sem entregar a resposta (recomendado para aulas)', 398: 'Modo livre: pode mostrar o código corrigido',
  399: 'Privacidade: o código aberto, o último erro e a sua pergunta vão direto do seu computador para o provedor escolhido, só quando você pergunta. A chave fica guardada criptografada neste computador. O provedor pode cobrar pelo uso da chave.',
  400: 'Perguntar à IA', 401: 'Provedor:', 402: 'Modelo:', 403: 'Onde conseguir a chave: {0}',

  // ---- dicas do dia ----
  410: 'O MisterALG corrige a indentação do seu algoritmo sozinho: tecle **Ctrl+G**.',
  411: 'Digite **dcn**, **dcc** ou **dcl** e tecle **Ctrl+Espaço** para declarar variáveis numéricas, de caractere ou lógicas mais rápido.',
  412: 'Digite **#** e tecle **Ctrl+Espaço** para inserir o cabeçalho com disciplina, professor e data. Os dados vêm de Configurações → Personalizar.',
  413: 'Tecle **Ctrl+J** para ver a lista de comandos e funções do Portugol, com a forma de usar cada um.',
  414: 'Clique na margem à esquerda de uma linha (ou tecle **F5**) para marcar um ponto de parada. Com **F9**, a execução para ali.',
  415: 'Com **F8** o algoritmo roda uma linha por vez, e a grade mostra em destaque as variáveis que acabaram de mudar.',
  416: 'Em funções recursivas, abra a **Pilha de ativação** (**Ctrl+F3**) durante o passo a passo para ver cada chamada.',
  417: 'O **Perfil** (**F7**) mostra quantas vezes cada linha rodou. Ótimo para entender laços aninhados.',
  418: 'Cansado de digitar os valores do **leia**? Ligue o botão da varinha: os números passam a ser sorteados entre "De" e "Até".',
  419: 'Com **aleatorio on**, o comando **lista MESES** faz o leia de caractere sortear um mês. Crie suas listas em Configurações → Listas.',
  420: 'Programando à noite? Clique no botão de **temas** da barra e escolha um tema escuro, como o Meia-noite ou o Drácula.',
  421: 'Cada tema pode ter suas próprias cores de código: Configurações → **Cores**.',
  422: 'Use **escreval(x:8:2)** para mostrar um número com 8 posições e 2 casas decimais.',
  423: 'O separador decimal do Portugol é o ponto: digite **3.5**, não 3,5.',
  424: 'Use **\\** para a divisão inteira e **%** (ou **mod**) para o resto. A barra **/** sempre dá um resultado real.',
  425: 'Quer ver o algoritmo em Pascal? Use **Exportar para → a Linguagem Pascal**.',
  426: 'Selecione um trecho e use **Gravar bloco** (**Ctrl+W**) para guardá-lo. Depois, **Inserir bloco** (**Ctrl+R**) o traz de volta em outro algoritmo.',
  427: 'Se o MisterALG fechar de repente, na próxima vez ele oferece recuperar o algoritmo que estava sendo editado.',

  // ---- janelas do sistema ----
  430: 'Abrir algoritmo', 431: 'Gravar bloco de algoritmo', 432: 'Inserir bloco de algoritmo', 433: 'Exportar para a linguagem Pascal',

  // ---- meses e dias ----
  440: 'Janeiro', 441: 'Fevereiro', 442: 'Março', 443: 'Abril', 444: 'Maio', 445: 'Junho', 446: 'Julho', 447: 'Agosto', 448: 'Setembro',
  449: 'Outubro', 450: 'Novembro', 451: 'Dezembro', 452: 'Dom', 453: 'Seg', 454: 'Ter', 455: 'Qua', 456: 'Qui', 457: 'Sex', 458: 'Sáb',
}
