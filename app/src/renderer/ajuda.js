// Ajuda embutida (texto próprio do MisterALG): a tela, a linguagem e a referência.
// Os textos em português são as chaves de tradução (compartilhado/traducoes); **negrito** e `código` são marcas dentro delas.

import { el, janela } from './dialogos.js'

const escapar = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
/** Texto com **negrito** e `código` em HTML (o texto vem daqui mesmo e é escapado antes). */
const marcado = (s) => escapar(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>')

const TELA = [
  ['h3', 'A tela'],
  ['p', 'À esquerda fica a **Área dos algoritmos** (o editor). À direita, em cima, as **variáveis de memória** (escopo, nome, tipo e valor, atualizadas a cada passo); embaixo, a **Área de visualização dos resultados**, coberta pelo **console** enquanto o programa roda. Na barra de status: linha:coluna, estado (Modificado, Executando…), dica de teclado e a mensagem do item sob o mouse.'],
  ['h3', 'Atalhos'],
  ['tabela', ['Tecla', 'Ação'], [
    ['F9', 'Executar (ou continuar depois de uma pausa)'],
    ['F8', 'Passo a passo (executa a linha em azul e para na próxima)'],
    ['Shift+F9', 'Executar com tempo (intervalo escolhido na barra)'],
    ['Ctrl+F2', 'Parar'],
    ['F5 / clique na margem', 'Liga/desliga ponto de parada na linha'],
    ['Ctrl+F5', 'Desmarca todos os pontos de parada'],
    ['F7', 'Perfil (quantas vezes cada linha rodou)'],
    ['Ctrl+F3', 'Pilha de ativação (procedimentos e funções em andamento)'],
    ['⌘F ou Ctrl+L', 'Localizar'],
    ['F3 / F4 (ou ⌘G / ⇧⌘G)', 'Localizar o próximo / o anterior'],
    ['⌥⌘F ou Ctrl+U', 'Substituir'],
    ['Ctrl+G', 'Corrigir indentação'],
    ['Ctrl+Espaço (ou ⌥Espaço)', 'Auto-digitação: digite uma abreviatura (ex.: `see`, `par`, `dci`, `!`) e tecle'],
    ['Ctrl+J', 'Lista de comandos e funções'],
    ['Esc', 'Durante um `leia`, termina o programa; depois do fim, fecha o console'],
  ]],
  ['p', 'No Mac as teclas F podem precisar da tecla **fn** (ou ative "Usar F1, F2 etc. como teclas de função padrão" nos Ajustes do Sistema › Teclado).'],
]

// Blocos de código em Portugol: ficam como estão (é a própria linguagem).
const LINGUAGEM = [
  ['h3', 'Estrutura'],
  ['pre', `algoritmo "nome"
var
   nota1, nota2 : real
   nome : caractere
inicio
   leia(nome)
   escreval("Olá, ", nome)
fimalgoritmo`],
  ['p', 'Um comando por linha; maiúsculas e minúsculas tanto faz; acentos opcionais nas palavras-chave (`então` = `entao`). Comentários com `//`.'],
  ['h3', 'Tipos'],
  ['p', '`inteiro`, `real` (ou `numerico`), `caractere` (ou `caracter`, `literal`), `logico` (`verdadeiro`/`falso`), vetores `vetor[1..10] de real`, matrizes `vetor[1..3,1..3] de inteiro`, constantes (`const MAX = 10`) e registros:'],
  ['pre', `tipo
   aluno = registro
      nome : caractere
      nota : real
   fimregistro`],
  ['h3', 'Comandos'],
  ['pre', `x <- 10                        // ou x := 10
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
interrompa                      // sai do laço`],
  ['h3', 'Procedimentos e funções'],
  ['pre', `procedimento troca(var a, b : inteiro)
var t : inteiro
inicio
   t <- a
   a <- b
   b <- t
fimprocedimento

funcao dobro(x : real) : real
inicio
   retorne x * 2
fimfuncao`],
  ['h3', 'Operadores'],
  ['p', '`+ - * /`, `\\` ou `div` (divisão inteira), `mod` ou `%` (resto), `^` (potência), `= <> < > <= >=`, `e ou nao xou`. Textos se juntam com `+`.'],
  ['h3', 'Comandos especiais'],
  ['p', '`aleatorio [on | off | min, max [, casas]]`, `timer on | off | ms`, `eco on | off`, `cronometro on | off`, `pausa`, `debug condição`, `limpatela`, `mudacor("amarelo", "frente")`, `arquivo "dados.txt"` ', '(na seção de declarações).'],
]

const REFERENCIA = [
  ['h3', 'Funções pré-definidas'],
  ['tabela', ['Função', 'Retorna'], [
    ['abs(x)', 'valor absoluto'],
    ['arccos(x), arcsen(x), arctan(x)', 'ângulo em radianos'],
    ['sen(x), cos(x), tan(x), cotan(x)', 'funções trigonométricas (radianos)'],
    ['grauprad(g), radpgrau(r)', 'converte graus ↔ radianos'],
    ['exp(base, expoente)', 'potência (base elevado ao expoente)'],
    ['int(x)', 'parte inteira'],
    ['log(x), logn(x)', 'logaritmo na base 10 / neperiano'],
    ['quad(x), raizq(x)', 'quadrado / raiz quadrada'],
    ['pi', '3.14159265358979…'],
    ['rand, randi(n)', 'real em [0,1) / inteiro em [0,n)'],
    ['asc(s), carac(n)', 'código do caractere / caractere do código'],
    ['caracpnum(s), numpcarac(n)', 'texto → número / número → texto'],
    ['compr(s)', 'quantidade de caracteres'],
    ['copia(s, p, n)', 'n caracteres a partir da posição p (começa em 1)'],
    ['maiusc(s), minusc(s)', 'maiúsculas / minúsculas'],
    ['pos(sub, s)', 'posição de sub dentro de s (0 se não houver)'],
  ]],
]

const PAGINAS = { tela: ['A Tela do MisterALG', TELA], linguagem: ['A Linguagem (Portugol)', LINGUAGEM], referencia: ['Referência da Linguagem', REFERENCIA] }

/** Monta a página da ajuda; `t` traduz cada texto em português (idioma escolhido). */
function pagina(blocos, t) {
  const raiz = el('div', { className: 'ajuda' })
  const html = (tag, texto) => { const e = document.createElement(tag); e.innerHTML = texto; return e } // texto escapado em marcado()
  for (const [tipo, a, b] of blocos) {
    if (tipo === 'h3') raiz.append(el('h3', { textContent: t(a) }))
    else if (tipo === 'pre') raiz.append(el('pre', { textContent: a }))
    else if (tipo === 'p') raiz.append(html('p', marcado(t(a)) + (b ? ` ${marcado(t(b))}` : '')))
    else if (tipo === 'tabela') {
      const linhas = b.map(([c1, c2]) => {
        const tr = document.createElement('tr')
        tr.append(html('td', marcado(t(c1))), html('td', marcado(t(c2))))
        return tr
      })
      raiz.append(el('table', {}, el('tbody', {}, el('tr', {}, ...a.map((c) => el('th', { textContent: t(c) }))), ...linhas)))
    }
  }
  return raiz
}

export function abrirAjuda(pagina_, t = (x) => x) {
  const [titulo, blocos] = PAGINAS[pagina_] ?? PAGINAS.tela
  return janela({ titulo: t(titulo), corpo: pagina(blocos, t), largura: '800px' })
}
