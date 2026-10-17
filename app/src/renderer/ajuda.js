// Ajuda embutida (texto próprio do MisterALG): a tela, a linguagem e a referência.

import { el, janela } from './dialogos.js'

const html = (texto) => {
  const d = document.createElement('div')
  d.className = 'ajuda'
  // Conteúdo estático escrito aqui mesmo (sem entrada do usuário).
  d.innerHTML = texto
  return d
}

const TELA = `
<h3>A tela</h3>
<p>À esquerda fica a <b>Área dos algoritmos</b> (o editor). À direita, em cima, as <b>variáveis de memória</b>
(escopo, nome, tipo e valor, atualizadas a cada passo); embaixo, a <b>Área de visualização dos resultados</b>,
coberta pelo <b>console</b> enquanto o programa roda. Na barra de status: linha:coluna, estado
(Modificado, Executando…), dica de teclado e a mensagem do item sob o mouse.</p>
<h3>Atalhos</h3>
<table>
<tr><th>Tecla</th><th>Ação</th></tr>
<tr><td>F9</td><td>Executar (ou continuar depois de uma pausa)</td></tr>
<tr><td>F8</td><td>Passo a passo (executa a linha em azul e para na próxima)</td></tr>
<tr><td>Shift+F9</td><td>Executar com tempo (intervalo escolhido na barra)</td></tr>
<tr><td>Ctrl+F2</td><td>Parar</td></tr>
<tr><td>F5 / clique na margem</td><td>Liga/desliga ponto de parada na linha</td></tr>
<tr><td>Ctrl+F5</td><td>Desmarca todos os pontos de parada</td></tr>
<tr><td>F7</td><td>Perfil (quantas vezes cada linha rodou)</td></tr>
<tr><td>Ctrl+F3</td><td>Pilha de ativação (procedimentos e funções em andamento)</td></tr>
<tr><td>⌘F ou Ctrl+L</td><td>Localizar</td></tr>
<tr><td>F3 / F4 (ou ⌘G / ⇧⌘G)</td><td>Localizar o próximo / o anterior</td></tr>
<tr><td>⌥⌘F ou Ctrl+U</td><td>Substituir</td></tr>
<tr><td>Ctrl+G</td><td>Corrigir indentação</td></tr>
<tr><td>Ctrl+Espaço (ou ⌥Espaço)</td><td>Auto-digitação: digite uma abreviatura (ex.: <code>see</code>, <code>par</code>, <code>dci</code>, <code>!</code>) e tecle</td></tr>
<tr><td>Ctrl+J</td><td>Lista de comandos e funções</td></tr>
<tr><td>Esc</td><td>Durante um <code>leia</code>, termina o programa; depois do fim, fecha o console</td></tr>
</table>
<p>No Mac as teclas F podem precisar da tecla <b>fn</b> (ou ative "Usar F1, F2 etc. como teclas de função padrão" nos Ajustes do Sistema › Teclado).</p>`

const LINGUAGEM = `
<h3>Estrutura</h3>
<pre>algoritmo "nome"
var
   nota1, nota2 : real
   nome : caractere
inicio
   leia(nome)
   escreval("Olá, ", nome)
fimalgoritmo</pre>
<p>Um comando por linha; maiúsculas e minúsculas tanto faz; acentos opcionais nas palavras-chave
(<code>então</code> = <code>entao</code>). Comentários com <code>//</code>.</p>
<h3>Tipos</h3>
<p><code>inteiro</code>, <code>real</code> (ou <code>numerico</code>), <code>caractere</code> (ou <code>caracter</code>, <code>literal</code>),
<code>logico</code> (<code>verdadeiro</code>/<code>falso</code>), vetores <code>vetor[1..10] de real</code>,
matrizes <code>vetor[1..3,1..3] de inteiro</code>, constantes (<code>const MAX = 10</code>) e registros:</p>
<pre>tipo
   aluno = registro
      nome : caractere
      nota : real
   fimregistro</pre>
<h3>Comandos</h3>
<pre>x &lt;- 10                        // ou x := 10
escreva("x = ", x)             // escreval pula linha; x:6:2 formata
leia(a, b)
se cond entao ... senao ... fimse
escolha op
caso 1, 2
   ...
caso 3 ate 5
   ...
outrocaso
   ...
fimescolha
para i de 1 ate 10 passo 2 faca ... fimpara
enquanto cond faca ... fimenquanto
repita ... ate cond             // ou repita ... fimrepita
interrompa                      // sai do laço</pre>
<h3>Procedimentos e funções</h3>
<pre>procedimento troca(var a, b : inteiro)
var t : inteiro
inicio
   t &lt;- a
   a &lt;- b
   b &lt;- t
fimprocedimento

funcao dobro(x : real) : real
inicio
   retorne x * 2
fimfuncao</pre>
<h3>Operadores</h3>
<p><code>+ - * /</code>, <code>\\</code> ou <code>div</code> (divisão inteira), <code>mod</code> ou <code>%</code> (resto), <code>^</code> (potência),
<code>= &lt;&gt; &lt; &gt; &lt;= &gt;=</code>, <code>e ou nao xou</code>. Textos se juntam com <code>+</code>.</p>
<h3>Comandos especiais</h3>
<p><code>aleatorio [on | off | min, max [, casas]]</code>, <code>timer on | off | ms</code>, <code>eco on | off</code>,
<code>cronometro on | off</code>, <code>pausa</code>, <code>debug condição</code>, <code>limpatela</code>,
<code>mudacor("amarelo", "frente")</code>, <code>arquivo "dados.txt"</code> (na seção de declarações).</p>`

const REFERENCIA = `
<h3>Funções pré-definidas</h3>
<table>
<tr><th>Função</th><th>Retorna</th></tr>
<tr><td>abs(x)</td><td>valor absoluto</td></tr>
<tr><td>arccos(x), arcsen(x), arctan(x)</td><td>ângulo em radianos</td></tr>
<tr><td>sen(x), cos(x), tan(x), cotan(x)</td><td>funções trigonométricas (radianos)</td></tr>
<tr><td>grauprad(g), radpgrau(r)</td><td>converte graus ↔ radianos</td></tr>
<tr><td>exp(base, expoente)</td><td>potência (base elevado ao expoente)</td></tr>
<tr><td>int(x)</td><td>parte inteira</td></tr>
<tr><td>log(x), logn(x)</td><td>logaritmo na base 10 / neperiano</td></tr>
<tr><td>quad(x), raizq(x)</td><td>quadrado / raiz quadrada</td></tr>
<tr><td>pi</td><td>3.14159265358979…</td></tr>
<tr><td>rand, randi(n)</td><td>real em [0,1) / inteiro em [0,n)</td></tr>
<tr><td>asc(s), carac(n)</td><td>código do caractere / caractere do código</td></tr>
<tr><td>caracpnum(s), numpcarac(n)</td><td>texto → número / número → texto</td></tr>
<tr><td>compr(s)</td><td>quantidade de caracteres</td></tr>
<tr><td>copia(s, p, n)</td><td>n caracteres a partir da posição p (começa em 1)</td></tr>
<tr><td>maiusc(s), minusc(s)</td><td>maiúsculas / minúsculas</td></tr>
<tr><td>pos(sub, s)</td><td>posição de sub dentro de s (0 se não houver)</td></tr>
</table>`

const PAGINAS = { tela: ['A Tela do MisterALG', TELA], linguagem: ['A Linguagem (Portugol)', LINGUAGEM], referencia: ['Referência da Linguagem', REFERENCIA] }

export function abrirAjuda(pagina) {
  const [titulo, conteudo] = PAGINAS[pagina] ?? PAGINAS.tela
  return janela({ titulo, corpo: el('div', {}, html(conteudo)), largura: '800px' })
}
