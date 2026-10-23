// Teste de fumaça da IDE empacotada (usado no CI do Linux com xvfb).
// Uso: node scripts/cdp.mjs <porta> scripts/fumaca-ide.mjs
// Falha (exceção → código de saída ≠ 0) se a IDE não se comportar como esperado.

const PROGRAMA = `algoritmo "fumaca"
var
   i, soma : inteiro
   nome : caractere
procedimento dobra(var x : inteiro)
inicio
   x <- x * 2
fimprocedimento
inicio
   escreva("Seu nome: ")
   leia(nome)
   para i de 1 ate 5 faca
      soma <- soma + i
   fimpara
   dobra(soma)
   escreval("Olá, ", nome, "! Soma dobrada =", soma)
fimalgoritmo
`
const PROGRAMA_C = '#include <stdio.h>\nint main(void) {\n    int x;\n    printf("Valor: ");\n    scanf("%d", &x);\n    printf("Dobro = %d\\n", 2 * x);\n    return 0;\n}\n'
const PROGRAMA_CPP = '#include <iostream>\n#include <stdexcept>\nint dividir(int a, int b) { if (b == 0) throw std::runtime_error("zero"); return a / b; }\nint main() {\n    try { std::cout << dividir(1, 0); } catch (const std::exception &e) { std::cout << "pegou: " << e.what() << std::endl; }\n}\n'
const ESPERADO = 'Seu nome: Linux\nOlá, Linux! Soma dobrada = 30\n\n>>> Fim da execução do programa !'

function conferir(nome, obtido, esperado) {
  const ok = obtido === esperado
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, digitar, tecla }) => {
  // A IDE pode estar parada na tela de termos (primeira abertura).
  for (let i = 0; i < 40; i += 1) {
    const pronto = await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)
    if (pronto) break
    await esperar(500)
  }
  const termos = await avaliar(`document.querySelector('dialog[open] .janela-titulo')?.textContent ?? ''`)
  console.log('tela inicial:', termos || '(IDE direto)')
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  conferir('IDE carregada', await avaliar('!!window.__misteralg'), true)
  // Primeira abertura: a tela inicial aparece com as 8 linguagens; Fechar volta para a IDE.
  conferir('tela inicial', await avaliar(`document.querySelectorAll('.tela-inicial .inicio-linguagem').length`), 8)
  await avaliar(`document.querySelector('.inicio-fechar').click()`)
  conferir('tela inicial fechada', await avaliar(`!!document.querySelector('.tela-inicial')`), false)

  const M = 'window.__misteralg'
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)})`)
  await avaliar(`void ${M}.comandos.executar()`)
  for (let i = 0; i < 20 && !(await avaliar(`!!document.querySelector('.console-entrada')`)); i += 1) await esperar(250)
  conferir('leia esperando entrada', await avaliar(`!!document.querySelector('.console-entrada')`), true)
  await avaliar(`document.querySelector('.console-entrada').focus()`)
  await digitar('Linux')
  await tecla('Enter')
  await esperar(800)
  conferir('saída do console', await avaliar('document.querySelector("#console-tela").textContent'), ESPERADO)
  conferir('grade de variáveis', await avaliar(`[...document.querySelectorAll('#variaveis tbody tr td:nth-child(4)')].map(t => t.textContent).join(',')`), '6,30,"Linux"')

  // Erro de execução: diálogo Aviso com a linha certa.
  await avaliar(`${M}.execucao.restaurar(); ${M}.editor.definirTexto('algoritmo "e"\\nvar\\n v: vetor[1..3] de inteiro\\ninicio\\n v[4] <- 1\\nfimalgoritmo\\n')`)
  await avaliar(`void ${M}.comandos.executar()`)
  await esperar(500)
  const aviso = await avaliar(`document.querySelector('dialog[open]')?.innerText ?? ''`)
  conferir('aviso de erro na linha 5', /na linha 5 :/.test(aviso) && /Índice fora dos limites/.test(aviso), true)
  await avaliar(`document.querySelector('dialog[open]')?.close()`)

  // C: o clang em WebAssembly (resources/clang), o worker e o executor (app.asar.unpacked)
  // só existem no app empacotado; aqui eles compilam e rodam um programa de verdade.
  await avaliar(`${M}.doc.modificado = false`) // senão a caixa nativa "Deseja salvá-lo?" trava o teste
  await avaliar(`${M}.comandos.novo('c')`)
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA_C)})`)
  await avaliar(`void ${M}.comandos.executar()`)
  const temTexto = (t) => avaliar(`document.querySelector('#console-tela').textContent.includes(${JSON.stringify(t)})`)
  for (let i = 0; i < 240 && !(await temTexto('Valor: ')); i += 1) await esperar(500)
  conferir('C compilou e pediu a entrada', await temTexto('Valor: '), true)
  await avaliar(`document.querySelector('.console-entrada').focus()`)
  await digitar('21')
  await tecla('Enter')
  for (let i = 0; i < 240 && !(await temTexto('Fim da execução')); i += 1) await esperar(250) // PC lento/CI: o processo pode demorar a sair
  conferir('saída do C', await avaliar('document.querySelector("#console-tela").textContent'), 'Valor: 21\nDobro = 42\n\n>>> Fim da execução do programa !')

  // C++ com try/catch: liga a libexcecoes.a embutida no worker (exceções do WebAssembly).
  await avaliar(`${M}.doc.modificado = false`)
  await avaliar(`${M}.comandos.novo('cpp')`)
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA_CPP)})`)
  await avaliar(`void ${M}.comandos.executar()`)
  for (let i = 0; i < 360 && !(await temTexto('Fim da execução')); i += 1) await esperar(500)
  conferir('saída do C++ com exceção', await avaliar('document.querySelector("#console-tela").textContent'), 'pegou: zero\n\n>>> Fim da execução do programa !')
  console.log('Fumaça da IDE: tudo certo.')
}
