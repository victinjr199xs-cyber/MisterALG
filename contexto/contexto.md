# Contexto: MisterALG (sessão na nuvem, 26 a 28/10/2026)

Este arquivo resume o que foi feito numa sessão do Claude Code na nuvem, para continuar o trabalho no Claude Code local.

## Repositório e branch

- Repositório: `victinjr199xs-cyber/MisterALG`
- Branch com todo o trabalho: `claude/funny-goldberg-jc7n6l`. Último commit: `7f38f9a`. Já está no GitHub, e não há nada pendente sem commit.
- A `main` continua em `7be13ac` (v1.10.2). **Nada desta branch foi para a `main` e não há PR aberto.**
- Versão em `app/package.json`: `1.10.2`. Ainda não foi aumentada.
- **Commit `8548ca3` do PC local** (JS/C# e corpus do F9): ficou fora desta branch. É preciso juntar à mão.

## O que foi feito nesta sessão

### 1. C++ no passo a passo (F8) com lambdas e STL

- **Interpretador:** `packages/interpretador-c/src/`, nos arquivos `maquina.js`, `cpp.js`, `tipos.js`, `memoria.js`, `biblioteca-cpp.js`, `descrever.js` e `index.js`.
  - Lambdas: captura por valor, por referência, `[n = 0]`, `this`, `auto` nos parâmetros e `mutable`.
  - Contêineres: `map`, `set`, `multimap`, `multiset`, `unordered_map`, `unordered_set`, `list`, `deque`, `queue`, `priority_queue`, `stack` e `array`.
  - Utilitários: `pair`, `tuple`, `function`, `unique_ptr`, `shared_ptr`, `stringstream`, `<numeric>` e quase todo o `<algorithm>`.
- **STL dos cabeçalhos:** `cabecalhos-stl.js` e `cabecalhos-cpp.js` trazem a STL escrita em C++ de verdade. Ela roda como o código do aluno, mas o passo a passo nunca para nas linhas dela.
- **Cabeçalhos sob medida:** `sob-medida.js` monta, para cada programa, cabeçalhos só com o que ele usa, porque a árvore em JSON do clang é lenta.
- **Saída igual à do g++:** `sort`, `priority_queue` e a ordem do `unordered_map` seguem a libstdc++. Os programas de conferência ficam em `packages/interpretador-c/test/diferencial/corpus-stl*.cpp.txt`.
- **Tela de memória:** mostra o conteúdo de cada contêiner e nomes legíveis para os tipos internos (`nó<...>`, `lambda da linha N`).

### 2. Desempenho do C++

- **Cabeçalhos pré-compilados (PCH):** `scripts/gerar-pch.mjs` gera os de `<iostream>` e `<bits/stdc++.h>` no build, em `app/build/pch/`, que vai como `extraResources` no `electron-builder.json5`. Os scripts `dist` rodam esse gerador.
- **Árvores do F8:** são feitas num worker próprio (`app/src/main/clang.js`, `compilador.js`). Assim o F9 não espera a árvore ficar pronta.

### 3. Correção na prévia do PHP

O timer de atualização automática disparava depois de trocar de documento. Foi corrigido com `fecharPrevia()` e um contador `pedidosPHP` em `app/src/renderer/execucao.js` (commit `2163619`).

### 4. Abrir quando o computador ligar, e fechar ou deixar em segundo plano

- **`app/src/main/sistema.js`:**
  - Windows e Mac usam `app.setLoginItemSettings` (`name: 'MisterALG'`, argumento `--ao-ligar`).
  - Linux usa `~/.config/autostart/misteralg.desktop`.
  - O caminho registrado é o de `PORTABLE_EXECUTABLE_FILE` ou `APPIMAGE`, e só depois o de `execPath`.
  - O ícone da bandeja (`Tray`) tem o menu "Abrir o MisterALG" e "Sair do MisterALG".
  - Nada disso roda em desenvolvimento nem com `MISTERALG_DADOS` (`podeConfigurar`).
- **`app/src/main/autostart.js`:** só as partes que não precisam do Electron, com os testes em `autostart.test.mjs`. Usa `path.posix`, porque no Windows o teste falhava com `\`.
- **`app/src/main/index.js`:**
  - O X da janela chama `aoClicarEmFechar()`, que mostra um diálogo nativo com "Deixar em segundo plano", "Fechar o MisterALG" ou "Cancelar", mais a caixa "Não perguntar de novo".
  - Os outros caminhos de saída fecham direto:
    - `before-quit` e `session-end` marcam `saindoDoApp`, e aí sai sem perguntar;
    - com `MISTERALG_DADOS` (testes), também sai direto.
  - `second-instance` e `activate` trazem a janela de volta.
  - Ao abrir, se `abrirAoLigar` estiver ligado, grava a entrada de novo (o caminho do executável pode ter mudado).
  - `prefs:ler` sincroniza com o estado real do sistema.
- **Preferências novas** em `preferencias.js`: `abrirAoLigar: false` e `aoFechar: 'perguntar' | 'fechar' | 'segundoPlano'`.
- **Interface:**
  - caixa "Abrir quando o computador ligar" na tela inicial (`renderer/inicio.js`);
  - aba "Sistema" em Configurações (`renderer/dialogos.js`).
- **Empacotamento:**
  - `electron-builder.json5` copia `build/icon.png` para `resources/icone.png`, usado pela bandeja;
  - `app/build/installer.nsh` tem `customUnInstall`, que apaga a chave `HKCU\...\Run\MisterALG`.
- **Traduções:** chaves 1100 a 1109.

### 5. Tutorial (feito por um agente e juntado com merge `29903c3`)

- **Código:**
  - `app/src/renderer/tutorial.js`: a sobreposição com recorte e o balão.
  - `tutorial-passos.js`: o roteiro de cada linguagem, os programas de exemplo e a posição do balão, sem DOM.
  - `tutorial-passos.test.mjs` e `scripts/fumaca-tutorial.mjs`.
- **Onde aparece:** é oferecido uma vez na primeira abertura da IDE (pref `tutorialVisto`, que fica marcada mesmo com "Agora não"). Fica também em Ajuda > "Tutorial do MisterALG" (`main/menu.js`).
- **Passeio:** 9 balões (editor, F9, F8, F5, memória, console, assistente, F1), com o texto de cada linguagem. No PHP não há F5 nem memória.
- **Primeiro programa:** usa o fluxo normal de "Novo" e espera o aluno agir: F9, digitar o nome no console, F8 até o fim. No PHP espera a página ao vivo; no SQL é F8 um comando por vez. Os passos que esperam têm o botão "Pular esta parte".
- **Integração:** `execucao.js` ganhou `execucao.aoEvento`, que avisa quando o programa começa, pausa, termina ou quando a página do PHP aparece.
- **Ordem das janelas:** na abertura em que o tutorial é oferecido, a dica do dia não aparece, e os termos de uso vêm antes da oferta.
- **Traduções:** chaves 1200 a 1249.

## Convenções do projeto

- Interface em português do Brasil. O texto em português é a chave da tradução.
  - `app/src/compartilhado/traducoes/chaves.js` numera os textos, de 1 a 1249 (as próximas livres são 1110 a 1199 e 1250 em diante). Nunca reaproveite um número.
  - Os 17 idiomas (en es fr de it nl pl tr ru uk ar hi id vi ja ko zh) precisam traduzir todas as chaves.
  - O teste `idiomas.test.mjs` exige isso, junto com o `{0}`.
- Commits em português.
- Testes:
  - `npm test` na raiz: 400 testes, todos passando.
  - `npm run build`: compila o app.
- Fumaça no Electron (Linux, com xvfb):
  ```bash
  MISTERALG_DADOS=$(mktemp -d) xvfb-run -a node_modules/electron/dist/electron app/out/main/index.js --remote-debugging-port=9333 --no-sandbox --disable-gpu &
  node scripts/cdp.mjs 9333 scripts/fumaca-linguagens.mjs     # 63 verificações
  node scripts/cdp.mjs 9333 scripts/fumaca-tutorial.mjs       # 38 verificações
  ```
  O `cdp.mjs` não sai sozinho.
- **CI:** `.github/workflows/pacotes.yml` (workflow_dispatch) gera os instaladores de Windows, Mac e Linux como artefatos. Só cria a release com uma tag `v*`.

## Estado dos instaladores

A execução [40526675867](https://github.com/victinjr199xs-cyber/MisterALG/actions/runs/40526675867) passou nos 3 sistemas, no commit `7f38f9a`. Os artefatos ficam disponíveis até 25/01/2027:

- **MisterALG-windows:** instalador NSIS e versão portátil.
- **MisterALG-dmg:** instalador do Mac.
- **MisterALG-linux:** AppImage, `.deb` e `.tar.gz`. Também passou no teste do Ubuntu com AppArmor e o sandbox ligado.

## Pendências e próximos passos

1. **Testar no Windows de verdade:**
   - a pergunta do X (fechar ou segundo plano) e o ícone na bandeja;
   - "Abrir quando o computador ligar" (reiniciar o PC);
   - a oferta do tutorial na primeira abertura;
   - desinstalar remove a entrada de inicialização.

   Nada disso foi testado fora do Linux. O diálogo nativo do X também não foi testado de forma automática.
2. **Testar no Mac:** a bandeja, a inicialização junto com o sistema, e o ícone do Dock trazendo a janela de volta.
3. **Juntar o commit `8548ca3`** do PC (JS/C#, corpus do F9) com esta branch.
4. **Lançar a versão:**
   - aumentar a versão (por exemplo, 1.11.0) em `app/package.json`;
   - trocar "## [Não lançado]" no `CHANGELOG.md` pela versão;
   - fazer o merge na `main`;
   - criar a tag `v1.11.0`.

   Só a tag faz o CI publicar a release, e só então o atualizador do app oferece a versão nova aos alunos.
5. **Limite conhecido:** o primeiro F8 em C++ ficou mais lento que antes da STL, mesmo com o PCH e o worker.
