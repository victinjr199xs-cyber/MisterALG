// O roteiro do tutorial (renderer/tutorial.js): o passeio pela tela e o primeiro programa em cada
// linguagem. Aqui não há DOM: os textos estão em português (as chaves de compartilhado/traducoes) e
// tutorial.js traduz na hora de mostrar. Também fica aqui a conta de onde o balão cabe na tela.
//
// Cada passo: { alvo (seletor CSS ou null = centro), texto, espera?, acao?, leve? }
//   espera: o evento da execução (execucao.js → aoEvento) que faz o passo avançar sozinho:
//           'inicio' (o programa começou), 'pausa' (o passo a passo parou numa linha),
//           'fim' (o programa terminou) ou 'pagina' (o PHP mostrou a página).
//   acao:   'programa' — o botão principal escreve o primeiro programa no editor.
//   leve:   o resto da tela fica só um pouco mais escuro e o balão vai para o canto de baixo do editor
//           (o aluno precisa ver a linha da vez, a memória e o console enquanto age).

export const LINGUAGENS = ['portugol', 'c', 'cpp', 'csharp', 'javascript', 'typescript', 'python', 'php', 'sql']

const NOME = {
  portugol: 'Portugol', c: 'C', cpp: 'C++', csharp: 'C#', javascript: 'JavaScript',
  typescript: 'TypeScript', python: 'Python', php: 'PHP', sql: 'SQL',
}
export const nomeDaLinguagem = (linguagem) => NOME[linguagem] ?? NOME.portugol

const MEMORIA = {
  portugol: 'Aqui aparecem as variáveis e o valor de cada uma. A que acabou de mudar fica destacada.',
  c: 'No passo a passo, aqui aparece a memória: a pilha, o heap e as globais, com setas mostrando para onde cada ponteiro aponta.',
  objetos: 'No passo a passo, aqui aparecem a pilha de chamadas e os objetos, com setas ligando as referências.',
  sql: 'Aqui aparecem as tabelas do banco de dados, mudando a cada comando.',
}
const textoDaMemoria = (l) => MEMORIA[l] ?? (l === 'cpp' ? MEMORIA.c : MEMORIA.objetos)

/** O passeio pela tela, adaptado à linguagem (o PHP não tem passo a passo nem painel de memória). */
export function passosDoPasseio(linguagem) {
  const php = linguagem === 'php'
  const sql = linguagem === 'sql'
  return [
    { alvo: null, texto: 'Bem-vindo ao MisterALG! Em poucos minutos você conhece a tela e roda o seu primeiro programa.' },
    { alvo: '.moldura-editor', texto: 'Este é o editor: aqui você escreve o programa. As cores mostram comandos, textos e números.' },
    { alvo: '[data-id="executar"]', texto: php ? 'F9 gera a página do PHP e mostra o resultado.' : 'F9 executa o programa inteiro.' },
    php
      ? { alvo: '[data-id="passo"]', texto: 'No PHP não há passo a passo: a página fica aberta e se atualiza sozinha enquanto você escreve.' }
      : { alvo: '[data-id="passo"]', texto: sql ? 'F8 executa um comando de cada vez, para você ver as tabelas mudando.' : 'F8 executa uma linha de cada vez: é o passo a passo. Cada F8 avança uma linha.' },
    ...(php ? [] : [{ alvo: '[data-id="breakpoint"]', texto: 'F5 marca um ponto de parada na linha do cursor: o F9 roda até ali e pausa.' }]),
    ...(php ? [] : [{ alvo: '.moldura-variaveis', texto: textoDaMemoria(linguagem) }]),
    {
      alvo: '.moldura-visualizacao',
      texto: php
        ? 'Aqui aparece a página gerada pelo PHP, ao vivo.'
        : sql
          ? 'Aqui aparece o resultado de cada comando.'
          : 'Aqui fica o console: o que o programa escreve aparece aqui, e é aqui que você digita quando ele pede um valor.',
    },
    { alvo: '[data-id="assistente"]', texto: 'O assistente de IA explica o código e os erros. Ele é ativado em Manutenção > Configurar o assistente de IA.' },
    { alvo: '[data-id="ajuda-tela"]', texto: 'F1 abre a ajuda. Este tutorial fica no menu Ajuda, para quando você quiser rever.' },
  ]
}

/** O primeiro programa: pergunta o nome, cumprimenta e conta até 3 (no PHP, uma página; no SQL, uma tabela). */
export function primeiroPrograma(linguagem, t = (s) => s) {
  // Os textos que o programa escreve vão traduzidos, mas sem nada que quebre a string do código.
  const s = (texto) => t(texto).replace(/["\\%$`{}]/g, '')
  const pergunta = s('Qual é o seu nome?')
  const ola = s('Olá')
  const contando = s('Contando')
  switch (linguagem) {
    case 'c':
      return `#include <stdio.h>

int main(void) {
    char nome[50];
    printf("${pergunta} ");
    scanf("%49s", nome);
    printf("${ola}, %s!\\n", nome);
    for (int i = 1; i <= 3; i++) {
        printf("${contando}: %d\\n", i);
    }
    return 0;
}
`
    case 'cpp':
      return `#include <iostream>
#include <string>
using namespace std;

int main() {
    string nome;
    cout << "${pergunta} ";
    cin >> nome;
    cout << "${ola}, " << nome << "!" << endl;
    for (int i = 1; i <= 3; i++) {
        cout << "${contando}: " << i << endl;
    }
    return 0;
}
`
    case 'csharp':
      return `using System;

class Program
{
    static void Main()
    {
        Console.Write("${pergunta} ");
        string nome = Console.ReadLine();
        Console.WriteLine("${ola}, " + nome + "!");
        for (int i = 1; i <= 3; i++)
        {
            Console.WriteLine("${contando}: " + i);
        }
    }
}
`
    case 'javascript':
      return `const nome = prompt("${pergunta}")
console.log("${ola}, " + nome + "!")
for (let i = 1; i <= 3; i++) {
  console.log("${contando}: " + i)
}
`
    case 'typescript':
      return `const nome: string = prompt("${pergunta}") ?? ""
console.log("${ola}, " + nome + "!")
for (let i: number = 1; i <= 3; i++) {
  console.log("${contando}: " + i)
}
`
    case 'python':
      return `nome = input("${pergunta} ")
print("${ola}, " + nome + "!")
for i in range(1, 4):
    print("${contando}:", i)
`
    case 'php':
      return `<?php $nome = "Ana"; ?>
<h1>${ola}, <?= $nome ?>!</h1>
<ul>
<?php for ($i = 1; $i <= 3; $i++): ?>
  <li>${contando}: <?= $i ?></li>
<?php endfor; ?>
</ul>
`
    case 'sql':
      return `CREATE TABLE aluno (
  id   SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  nota NUMERIC(4, 1)
);

INSERT INTO aluno (nome, nota) VALUES
  ('Ana', 9.5),
  ('Bruno', 7.0),
  ('Carla', 8.2);

SELECT nome, nota FROM aluno WHERE nota >= 8 ORDER BY nota DESC;
`
    default: // Portugol: a própria linguagem é em português
      return `algoritmo "primeiro"
var
   nome: caractere
   i: inteiro
inicio
   escreva("Qual é o seu nome? ")
   leia(nome)
   escreval("Olá, ", nome, "!")
   para i de 1 ate 3 faca
      escreval("Contando: ", i)
   fimpara
fimalgoritmo
`
  }
}

/** A segunda parte: escrever o programa, rodar com F9 e depois com F8, esperando o aluno em cada ação. */
export function passosDoPrograma(linguagem) {
  const inicio = { alvo: '.moldura-editor', acao: 'programa', texto: 'Agora o seu primeiro programa em {0}. Clique em "Escrever o programa" e ele aparece no editor (se o programa atual não estiver salvo, o MisterALG pergunta antes).' }
  const fim = { alvo: null, texto: 'Pronto! Você já sabe escrever, executar e acompanhar um programa. Bons estudos!' }
  if (linguagem === 'php') {
    return [
      inicio,
      { alvo: '.moldura-editor', texto: 'O PHP mistura HTML com código: o que está entre <?php e ?> roda no servidor e vira parte da página.' },
      { alvo: '[data-id="executar"]', espera: 'pagina', texto: 'Aperte F9 (ou clique aqui) para ver a página.' },
      { alvo: '.moldura-editor', espera: 'pagina', leve: true, texto: 'Agora troque "Ana" pelo seu nome no editor: a página se atualiza sozinha.' },
      fim,
    ]
  }
  if (linguagem === 'sql') {
    return [
      inicio,
      { alvo: '.moldura-editor', texto: 'O script cria uma tabela, coloca três alunos nela e procura as notas maiores ou iguais a 8.' },
      { alvo: '[data-id="executar"]', espera: 'fim', texto: 'Aperte F9 (ou clique aqui) para executar o script inteiro.' },
      { alvo: '.moldura-visualizacao', texto: 'O resultado do SELECT apareceu aqui.' },
      { alvo: '[data-id="passo"]', espera: 'pausa', texto: 'Agora aperte F8 para executar um comando de cada vez.' },
      { alvo: '.moldura-variaveis', espera: 'fim', leve: true, texto: 'Continue apertando F8 e veja a tabela aparecer e ganhar as linhas. O comando da vez fica destacado no editor.' },
      fim,
    ]
  }
  const compilado = linguagem === 'c' || linguagem === 'cpp'
  return [
    inicio,
    { alvo: '.moldura-editor', texto: 'O programa pergunta o seu nome, cumprimenta você e conta de 1 até 3.' },
    { alvo: '[data-id="executar"]', espera: 'inicio', texto: compilado ? 'Aperte F9 (ou clique aqui) para executar. Primeiro o programa é compilado, o que leva alguns segundos.' : 'Aperte F9 (ou clique aqui) para executar.' },
    { alvo: '.moldura-visualizacao', espera: 'fim', leve: true, texto: 'O programa está esperando: digite o seu nome no console e tecle Enter.' },
    { alvo: '.moldura-visualizacao', texto: 'Funcionou! Tudo o que o programa escreveu ficou no console.' },
    { alvo: '[data-id="passo"]', espera: 'pausa', texto: compilado ? 'Agora aperte F8 para ver o mesmo programa linha por linha. A preparação do passo a passo leva alguns segundos.' : 'Agora aperte F8 para ver o mesmo programa linha por linha.' },
    { alvo: '.moldura-variaveis', espera: 'fim', leve: true, texto: 'A linha destacada no editor é a próxima a executar. Continue apertando F8 e veja a memória mudar; quando o programa pedir o nome, digite no console.' },
    fim,
  ]
}

/**
 * Onde o balão fica: ao lado do alvo, do lado que couber (embaixo, em cima, depois do lado
 * de leitura e do outro), sem sair da janela. Sem alvo, no centro.
 * @returns {{ x: number, y: number, lado: 'baixo'|'cima'|'depois'|'antes'|'centro'|'canto' }}
 */
export function posicaoDoBalao(alvo, balao, janela, { margem = 12, rtl = false, canto = false, rodape = 24 } = {}) {
  const limitar = (v, min, max) => Math.max(min, Math.min(v, Math.max(min, max)))
  const xLivre = (x) => limitar(x, margem, janela.w - balao.w - margem)
  const yLivre = (y) => limitar(y, margem, janela.h - balao.h - margem)
  // No canto de baixo do lado do editor (o começo da linha de leitura), acima da barra de status.
  if (canto) return { x: xLivre(rtl ? janela.w - balao.w - margem : margem), y: yLivre(janela.h - balao.h - margem - rodape), lado: 'canto' }
  if (!alvo) return { x: xLivre((janela.w - balao.w) / 2), y: yLivre((janela.h - balao.h) / 2), lado: 'centro' }
  const centroX = alvo.x + alvo.w / 2 - balao.w / 2
  const centroY = alvo.y + alvo.h / 2 - balao.h / 2
  const direita = { x: alvo.x + alvo.w + margem, cabe: alvo.x + alvo.w + margem + balao.w <= janela.w - margem }
  const esquerda = { x: alvo.x - margem - balao.w, cabe: alvo.x - margem - balao.w >= margem }
  const [depois, antes] = rtl ? [esquerda, direita] : [direita, esquerda]
  const opcoes = [
    { lado: 'baixo', cabe: alvo.y + alvo.h + margem + balao.h <= janela.h - margem, x: centroX, y: alvo.y + alvo.h + margem },
    { lado: 'cima', cabe: alvo.y - margem - balao.h >= margem, x: centroX, y: alvo.y - margem - balao.h },
    { lado: 'depois', cabe: depois.cabe, x: depois.x, y: centroY },
    { lado: 'antes', cabe: antes.cabe, x: antes.x, y: centroY },
  ]
  // Alvo grande (o editor, a coluna da direita): o balão fica por cima dele, no canto de baixo.
  const escolhida = opcoes.find((o) => o.cabe) ?? { lado: 'centro', x: centroX, y: alvo.y + alvo.h - balao.h - margem }
  return { x: xLivre(escolhida.x), y: yLivre(escolhida.y), lado: escolhida.lado }
}
