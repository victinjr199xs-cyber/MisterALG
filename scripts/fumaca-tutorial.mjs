// Teste de fumaça do tutorial (Ajuda > Tutorial do MisterALG) no app de verdade: o passeio pela tela,
// o primeiro programa em Portugol e em C++ até o fim (F9, digitar o nome, F8 até o fim), o Esc no meio
// e o balão dentro da janela em RTL com um tema escuro.
// Uso: electron app/out/main/index.js --remote-debugging-port=9340  (com MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9340 scripts/fumaca-tutorial.mjs

function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, digitar, tecla }) => {
  const M = 'window.__misteralg'
  const ate = async (expr, tentativas = 120, ms = 250) => {
    for (let i = 0; i < tentativas; i += 1) {
      if (await avaliar(expr)) return true
      await esperar(ms)
    }
    return false
  }
  const tutorial = () => avaliar(`(() => { const t = ${M}.tutorial; return t && { passo: t.passo, total: t.total, esperando: t.esperando, texto: document.querySelector('.tutorial-texto').textContent } })()`)
  const clicarProximo = () => avaliar(`document.querySelector('.tutorial-acoes .acao:last-child').click()`)
  // O recorte em volta do alvo e o balão inteiro dentro da janela.
  const noLugar = () => avaliar(`(() => {
    const b = document.querySelector('.tutorial-balao').getBoundingClientRect()
    const dentro = b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight
    const raiz = document.querySelector('.tutorial')
    if (raiz.classList.contains('sem-alvo')) return dentro
    const r = document.querySelector('.tutorial-recorte').getBoundingClientRect()
    return dentro && r.width > 10 && r.height > 10
  })()`)
  // O balão e o recorte têm transição: espera até 3 s para assentarem antes de reclamar.
  const noLugarAte = async () => {
    for (let i = 0; i < 12; i += 1) {
      if (await noLugar()) return true
      await esperar(250)
    }
    return false
  }
  const digitarNome = async (nome) => {
    await avaliar(`document.querySelector('.console-entrada').focus()`)
    await digitar(nome)
    await tecla('Enter')
  }
  const novo = async (linguagem) => {
    await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false`)
    await avaliar(`${M}.comandos.novo(${JSON.stringify(linguagem)})`)
    await avaliar(`${M}.doc.modificado = false`)
  }
  /** Passa o passeio até o passo que escreve o programa, conferindo cada balão. */
  const passeio = async (rotulo) => {
    let vistos = 0
    for (let i = 0; i < 20; i += 1) {
      const t = await tutorial()
      if (await avaliar(`document.querySelector('.tutorial-acoes .acao:last-child').textContent`) === 'Escrever o programa') break
      if (!(await noLugarAte())) throw new Error(`${rotulo}: balão fora do lugar no passo ${t.passo + 1}: ${t.texto}`)
      vistos += 1
      await clicarProximo()
      await esperar(120)
    }
    return vistos
  }
  /** Espera o tutorial chegar a um passo que espera esse evento (ou que não espera nada, com null). */
  const ateEsperar = (evento, tentativas = 240) => ate(`${M}.tutorial?.esperando === ${JSON.stringify(evento)}`, tentativas, 500)

  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  conferir('IDE carregada', await ate('!!window.__misteralg', 40, 500), true)

  // ---- Portugol: do começo ao fim ----------------------------------------------------------------
  await novo('portugol')
  await avaliar(`${M}.comandos.tutorial()`) // o mesmo comando do menu Ajuda > Tutorial do MisterALG
  conferir('Portugol: tutorial aberto no passo 1', (await tutorial())?.passo, 0)
  conferir('Portugol: boas-vindas', (await tutorial()).texto.startsWith('Bem-vindo ao MisterALG'), true)
  conferir('Portugol: contador', await avaliar(`document.querySelector('.tutorial-contador').textContent`), `Passo 1 de ${(await tutorial()).total}`)
  await avaliar(`${M}.comandos.tutorial()`)
  conferir('Portugol: abrir de novo não duplica', await avaliar(`document.querySelectorAll('.tutorial').length`), 1)
  conferir('Portugol: passeio de 9 balões, todos no lugar', await passeio('Portugol'), 9)
  // voltar e avançar pelo teclado (setas) com o foco no balão
  await avaliar(`document.querySelector('.tutorial-acoes .acao:first-child').click()`)
  conferir('Portugol: Voltar', (await tutorial()).passo, 8)
  await avaliar(`document.querySelector('.tutorial-acoes .acao:last-child').focus()`)
  await tecla('ArrowRight')
  conferir('Portugol: seta para a direita avança', (await tutorial()).passo, 9)

  await clicarProximo() // Escrever o programa
  conferir('Portugol: programa no editor', await ate(`${M}.editor.texto().includes('leia(nome)')`, 20), true)
  conferir('Portugol: avançou depois de escrever', (await tutorial()).passo, 10)
  await clicarProximo()
  conferir('Portugol: espera o F9', (await tutorial()).esperando, 'inicio')
  conferir('Portugol: botão vira "Pular esta parte"', await avaliar(`document.querySelector('.tutorial-acoes .acao:last-child').textContent`), 'Pular esta parte')
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('Portugol: F9 avançou para "digite o seu nome"', await ateEsperar('fim', 40), true)
  conferir('Portugol: pediu a entrada', await ate(`!!document.querySelector('.console-entrada')`, 40), true)
  conferir('Portugol: balão no lugar durante a execução', await noLugar(), true)
  await digitarNome('Ana')
  conferir('Portugol: terminou e avançou', await ate(`${M}.tutorial?.esperando === null && document.querySelector('.tutorial-texto').textContent.startsWith('Funcionou')`, 40), true)
  conferir('Portugol: saída', (await avaliar(`document.querySelector('#console-tela').textContent`)).includes('Olá, Ana!'), true)
  await clicarProximo()
  conferir('Portugol: espera o F8', (await tutorial()).esperando, 'pausa')
  await avaliar(`void ${M}.comandos.passo()`)
  conferir('Portugol: F8 pausou e avançou', await ateEsperar('fim', 40), true)
  for (let i = 0; i < 60 && (await avaliar(`${M}.tutorial?.esperando`)) === 'fim'; i += 1) {
    if (await avaliar(`!!document.querySelector('.console-entrada')`)) await digitarNome('Bia')
    else await avaliar(`void ${M}.comandos.passo()`)
    await esperar(150)
  }
  conferir('Portugol: F8 até o fim chega na conclusão', (await tutorial()).texto.startsWith('Pronto!'), true)
  conferir('Portugol: memória mostrou a variável', await avaliar(`document.querySelector('#variaveis tbody').textContent.includes('Bia')`), true)
  await clicarProximo() // Concluir
  conferir('Portugol: Concluir fecha', await avaliar(`!document.querySelector('.tutorial') && ${M}.tutorial === null`), true)

  // ---- Esc no meio: fecha e a IDE continua inteira ----------------------------------------------
  await avaliar(`${M}.comandos.tutorial()`)
  await clicarProximo()
  await tecla('Escape')
  conferir('Esc fecha o tutorial', await avaliar(`!document.querySelector('.tutorial') && ${M}.tutorial === null`), true)
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('IDE funciona depois do Esc', await ate(`!!document.querySelector('.console-entrada')`, 40), true)
  await avaliar(`${M}.execucao.parar(); ${M}.execucao.restaurar()`)

  // ---- RTL e tema escuro: o balão continua dentro da janela -----------------------------------------
  await avaliar(`document.documentElement.dir = 'rtl'; document.documentElement.dataset.tema = 'dracula'`)
  await avaliar(`${M}.comandos.tutorial()`)
  for (let i = 0; i < 9; i += 1) {
    if (!(await noLugarAte())) throw new Error(`RTL: balão fora do lugar no passo ${i + 1}`)
    await clicarProximo()
    await esperar(100)
  }
  conferir('RTL + tema escuro: balões no lugar', true, true)
  await tecla('Escape')
  await avaliar(`document.documentElement.dir = 'ltr'; document.documentElement.dataset.tema = 'classico'`)

  // ---- C++: compila no F9, passo a passo no F8 ------------------------------------------------------
  await novo('cpp')
  await avaliar(`${M}.comandos.tutorial()`)
  conferir('C++: passeio de 9 balões', await passeio('C++'), 9)
  conferir('C++: o texto fala da linguagem', (await tutorial()).texto.includes('C++'), true)
  await clicarProximo() // Escrever o programa
  conferir('C++: programa no editor', await ate(`${M}.editor.texto().includes('cin >> nome')`, 20), true)
  conferir('C++: linguagem do documento', await avaliar(`${M}.doc.linguagem`), 'cpp')
  await clicarProximo()
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('C++: F9 começou', await ateEsperar('fim', 40), true)
  conferir('C++: compilou e pediu a entrada', await ate(`!!document.querySelector('.console-entrada') && document.querySelector('#st-estado').textContent.includes('Executando')`, 240, 500), true)
  await digitarNome('Caio')
  conferir('C++: terminou e avançou', await ate(`${M}.tutorial?.esperando === null && document.querySelector('.tutorial-texto').textContent.startsWith('Funcionou')`, 120, 500), true)
  conferir('C++: saída', (await avaliar(`document.querySelector('#console-tela').textContent`)).includes('Olá, Caio!'), true)
  await clicarProximo()
  await avaliar(`void ${M}.comandos.passo()`)
  conferir('C++: F8 pausou e avançou', await ateEsperar('fim', 240), true)
  conferir('C++: tela de memória do C++', await avaliar(`!!document.querySelector('.memoria-c:not([hidden])')`), true)
  for (let i = 0; i < 120 && (await avaliar(`${M}.tutorial?.esperando`)) === 'fim'; i += 1) {
    if (await avaliar(`!!document.querySelector('.console-entrada')`)) await digitarNome('Duda')
    else await avaliar(`void ${M}.comandos.passo()`)
    await esperar(200)
  }
  conferir('C++: F8 até o fim chega na conclusão', (await tutorial())?.texto.startsWith('Pronto!'), true)
  conferir('C++: saída do passo a passo', (await avaliar(`document.querySelector('#console-tela').textContent`)).includes('Olá, Duda!'), true)
  await clicarProximo()
  conferir('C++: Concluir fecha', await avaliar(`!document.querySelector('.tutorial')`), true)
  console.log('FIM DA FUMAÇA DO TUTORIAL')
}
