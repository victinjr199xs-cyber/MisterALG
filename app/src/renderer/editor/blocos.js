// Blocos do menu "/" por linguagem. Os modelos do Portugol vêm da mesma tabela da auto-digitação (modelos.js);
// nas outras linguagens ficam os equivalentes dos trechos que o Ctrl+J já sugere. `|` = onde o cursor fica, `\t` = um recuo.
// `desc` é a chave (texto em português) de tradução; `busca` reúne o nome e os apelidos usados na filtragem.

import { MODELOS } from './modelos.js'

const D = {
  se: 'Condição: executa um bloco se algo for verdadeiro',
  senao: 'Condição com alternativa: um bloco ou o outro',
  escolha: 'Escolhe entre vários casos de um valor',
  enquanto: 'Laço: repete enquanto a condição valer',
  para: 'Laço contado: de um valor até outro',
  repita: 'Laço que executa o bloco pelo menos uma vez',
  procedimento: 'Bloco reutilizável que não devolve valor',
  funcao: 'Bloco reutilizável que devolve um valor',
  escreva: 'Mostra um texto ou valor na tela',
  escreval: 'Mostra na tela e pula para a linha seguinte',
  leia: 'Lê o valor que a pessoa digitar',
  vetor: 'Declara uma lista de valores numerada',
  erro: 'Tenta executar e trata a falha, se houver',
}

const b = (id, icone, nome, desc, modelo, extra = '') => ({ id, icone, nome, desc, modelo, busca: `${nome} ${extra}` })

const PORTUGOL = [
  b('se', 'se', 'se … fimse', D.se, MODELOS.see, 'se entao fimse if'),
  b('senao', 'se/', 'se … senao … fimse', D.senao, MODELOS.ses, 'se senao entao fimse if else'),
  b('escolha', '◇', 'escolha … fimescolha', D.escolha, MODELOS.esco, 'escolha caso outrocaso fimescolha switch'),
  b('enquanto', '∞', 'enquanto … fimenquanto', D.enquanto, MODELOS.enq, 'enquanto faca fimenquanto while'),
  b('para', '1→n', 'para … fimpara', D.para, MODELOS.par, 'para de ate faca fimpara for'),
  b('repita', '↻', 'repita … ate', D.repita, MODELOS.rep, 'repita ate do while'),
  b('procedimento', 'proc', 'procedimento', D.procedimento, MODELOS.pro, 'procedimento fimprocedimento'),
  b('funcao', 'f(x)', 'funcao', D.funcao, MODELOS.fun, 'funcao fimfuncao retorne function'),
  b('escreva', '“ ”', 'escreva', D.escreva, 'escreva(|)', 'escreva mostrar imprimir print'),
  b('escreval', '“ ”↵', 'escreval', D.escreval, 'escreval(|)', 'escreval mostrar imprimir println'),
  b('leia', '⌨', 'leia', D.leia, 'leia(|)', 'leia ler input'),
  b('vetor', '[ ]', 'vetor', D.vetor, 'vetor[1..|] de inteiro', 'vetor lista array'),
]

const C = [
  b('if', 'se', 'if', D.se, 'if (|) {\n\t\n}', 'if se condicao'),
  b('ifelse', 'se/', 'if … else', D.senao, 'if (|) {\n\t\n} else {\n\t\n}', 'if else se senao'),
  b('switch', '◇', 'switch', D.escolha, 'switch (|) {\n\tcase 1:\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}', 'switch case escolha'),
  b('while', '∞', 'while', D.enquanto, 'while (|) {\n\t\n}', 'while enquanto'),
  b('do', '↻', 'do … while', D.repita, 'do {\n\t|\n} while ();', 'do while repita'),
  b('for', '1→n', 'for', D.para, 'for (int i = 0; i < |; i++) {\n\t\n}', 'for para'),
  b('funcao', 'f(x)', 'função', D.funcao, 'int nome(|) {\n\t\n\treturn 0;\n}', 'funcao function int nome return'),
  b('vazia', 'proc', 'função void', D.procedimento, 'void nome(|) {\n\t\n}', 'procedimento void funcao'),
  b('printf', '“ ”', 'printf', D.escreva, 'printf("|\\n");', 'printf escreva mostrar imprimir'),
  b('scanf', '⌨', 'scanf', D.leia, 'scanf("%d", &|);', 'scanf leia ler'),
  b('vetor', '[ ]', 'vetor', D.vetor, 'int v[|];', 'vetor array lista'),
]

const CPP = [
  ...C.filter((x) => x.id !== 'printf' && x.id !== 'scanf'),
  b('cout', '“ ”', 'cout', D.escreva, 'cout << | << endl;', 'cout escreva mostrar imprimir print'),
  b('cin', '⌨', 'cin', D.leia, 'cin >> |;', 'cin leia ler input'),
  b('vector', '[ ]', 'vector', D.vetor, 'vector<int> |;', 'vector vetor array lista'),
]

const PYTHON = [
  b('if', 'se', 'if', D.se, 'if |:\n\t', 'if se condicao'),
  b('ifelse', 'se/', 'if … else', D.senao, 'if |:\n\t\nelse:\n\t', 'if else se senao'),
  b('while', '∞', 'while', D.enquanto, 'while |:\n\t', 'while enquanto'),
  b('for', '1→n', 'for', D.para, 'for i in range(|):\n\t', 'for para range'),
  b('def', 'f(x)', 'def', D.funcao, 'def nome(|):\n\treturn', 'def funcao function return'),
  b('try', '⚠', 'try … except', D.erro, 'try:\n\t|\nexcept Exception as erro:\n\t', 'try except erro'),
  b('print', '“ ”', 'print', D.escreva, 'print(|)', 'print escreva mostrar imprimir'),
  b('input', '⌨', 'input', D.leia, 'input(|)', 'input leia ler'),
  b('lista', '[ ]', 'lista', D.vetor, 'lista = [|]', 'lista vetor array list'),
]

const JS = [
  b('if', 'se', 'if', D.se, 'if (|) {\n\t\n}', 'if se condicao'),
  b('ifelse', 'se/', 'if … else', D.senao, 'if (|) {\n\t\n} else {\n\t\n}', 'if else se senao'),
  b('switch', '◇', 'switch', D.escolha, 'switch (|) {\n\tcase 1:\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}', 'switch case escolha'),
  b('while', '∞', 'while', D.enquanto, 'while (|) {\n\t\n}', 'while enquanto'),
  b('do', '↻', 'do … while', D.repita, 'do {\n\t|\n} while ();', 'do while repita'),
  b('for', '1→n', 'for', D.para, 'for (let i = 0; i < |; i++) {\n\t\n}', 'for para'),
  b('function', 'f(x)', 'function', D.funcao, 'function nome(|) {\n\t\n}', 'function funcao return'),
  b('try', '⚠', 'try … catch', D.erro, 'try {\n\t|\n} catch (erro) {\n\t\n}', 'try catch erro'),
  b('log', '“ ”', 'console.log', D.escreva, 'console.log(|)', 'console log escreva mostrar imprimir print'),
  b('array', '[ ]', 'array', D.vetor, 'const lista = [|]', 'array vetor lista'),
]

/** Blocos de cada linguagem; linguagem sem blocos (C#, PHP, SQL) não abre o menu. */
export const BLOCOS = { portugol: PORTUGOL, c: C, cpp: CPP, python: PYTHON, javascript: JS, typescript: JS }
