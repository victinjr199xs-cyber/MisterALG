// Teste de fumaça das linguagens além do Portugol, no app de verdade (JavaScript, TypeScript, Python, PHP, C#).
// Uso: electron app/out/main/index.js --remote-debugging-port=9333  (com MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9333 scripts/fumaca-linguagens.mjs

function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, digitar, tecla, erros }) => {
  const M = 'window.__misteralg'
  const ate = async (expr, tentativas = 120, ms = 250) => {
    for (let i = 0; i < tentativas; i += 1) {
      if (await avaliar(expr)) return true
      await esperar(ms)
    }
    return false
  }
  const console_ = () => avaliar('document.querySelector("#console-tela").textContent')
  const mensagem = () => avaliar(`document.querySelector('#st-mensagem').textContent`)
  // A linha em que o programa está pausado, lida da caixa da chamada atual na tela de objetos.
  const linhaAtual = () => avaliar(`Number(/linha (\\d+)/.exec(document.querySelector('.mo-atual .mo-cabecalho')?.textContent ?? '')?.[1] ?? 0)`)
  const naLinha = (n) => ate(`Number(/linha (\\d+)/.exec(document.querySelector('.mo-atual .mo-cabecalho')?.textContent ?? '')?.[1] ?? 0) === ${n}`, 60)
  const passo = () => avaliar(`void ${M}.comandos.passo()`)
  const novo = async (linguagem, texto) => {
    await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false`)
    await avaliar(`${M}.comandos.novo(${JSON.stringify(linguagem)})`)
    await avaliar(`${M}.editor.definirTexto(${JSON.stringify(texto)})`)
  }

  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  conferir('IDE carregada', await ate('!!window.__misteralg', 40, 500), true)
  await avaliar(`document.querySelector('.inicio-fechar')?.click()`)

  // ---- JavaScript: F9 e depois o passo a passo (F8) de ponta a ponta --------------------------
  await novo('javascript', 'function dobro(n) {\n  return n * 2\n}\nconst lista = [1, 2]\nconst outra = lista\nconsole.log(dobro(lista.length))\n')
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('JS: F9 roda tudo', await ate(`document.querySelector('#console-tela').textContent.includes('4')`), true)
  await avaliar(`${M}.execucao.restaurar()`)

  await avaliar(`void ${M}.comandos.passo()`)
  conferir('JS: F8 pausa na linha 4 (a função só é declarada)', await naLinha(4), true)
  conferir('JS: tela de objetos aberta', await avaliar(`!!document.querySelector('.memoria-objetos:not([hidden])')`), true)
  await passo()
  await esperar(300)
  await passo()
  await esperar(300)
  conferir('JS: objeto e referências na tela', await avaliar(`document.querySelectorAll('.mo-objeto').length`) >= 1, true)
  conferir('JS: setas desenhadas', await avaliar(`document.querySelectorAll('.mo-seta').length`) >= 1, true)
  for (let i = 0; i < 12 && !(await avaliar(`${M}.execucao.emExecucao() === false`)); i += 1) {
    await passo()
    await esperar(250)
  }
  conferir('JS: F8 até o fim', (await console_()).includes('4'), true)

  // ---- TypeScript ---------------------------------------------------------------------------
  await novo('typescript', 'const n: number = 20\nconst m: number = n + 1\nconsole.log(m)\n')
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('TS: F9', await ate(`document.querySelector('#console-tela').textContent.includes('21')`), true)
  await avaliar(`${M}.execucao.restaurar()`)

  // ---- Python: carrega o Pyodide, passo a passo, input() e erro ------------------------------
  await novo('python', 'def soma(a, b):\n    return a + b\n\nx = [1, 2]\ny = x\nnome = input("Nome? ")\nprint("oi", nome, soma(2, 3))\nz = 1 / 0\n')
  await avaliar(`void ${M}.comandos.passo()`)
  conferir('Python: F8 pausa na linha 1', await naLinha(1), true)
  for (let i = 0; i < 4; i += 1) { await passo(); await esperar(300) } // def, x, y, input
  conferir('Python: input() pede a entrada', await ate(`!!document.querySelector('.console-entrada')`, 40), true)
  conferir('Python: prompt no console', (await console_()).includes('Nome? '), true)
  await avaliar(`document.querySelector('.console-entrada').focus()`)
  await digitar('Ana')
  await tecla('Enter')
  conferir('Python: pausa depois do input (linha 7)', await naLinha(7), true)
  conferir('Python: x e y apontam para o mesmo objeto', await avaliar(`document.querySelectorAll('.mo-ref[data-ref="1"]').length`) >= 2, true)
  conferir('Python: setas', await avaliar(`document.querySelectorAll('.mo-seta').length`) >= 2, true)
  await passo() // a linha 7 chama soma(): o passo a passo entra na função
  conferir('Python: entrou em soma (linha 2, duas caixas na pilha)', (await naLinha(2)) && (await avaliar(`document.querySelectorAll('.mo-quadro').length`)) === 2, true)
  await passo()
  conferir('Python: voltou para a linha 8', await naLinha(8), true)
  await ate(`document.querySelector('#console-tela').textContent.includes('oi Ana 5')`, 40)
  conferir('Python: print com função', (await console_()).includes('oi Ana 5'), true)
  await passo()
  conferir('Python: erro mostra o aviso (linha 8)', await ate(`/ZeroDivisionError/.test(document.querySelector('dialog[open]')?.innerText ?? '')`, 40), true)
  await avaliar(`document.querySelector('dialog[open]')?.close()`)

  // F9 sem passo a passo: roda direto e a saída vem inteira
  await novo('python', 'for i in range(3):\n    print(i)\n')
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('Python: F9', await ate(`document.querySelector('#console-tela').textContent.includes('Fim da execução')`, 80), true)
  conferir('Python: saída do F9', (await console_()).startsWith('0\n1\n2\n'), true)

  // Parar um laço infinito
  await novo('python', 'while True:\n    pass\n')
  await avaliar(`void ${M}.comandos.executar()`)
  await esperar(1500)
  conferir('Python: laço infinito em execução', await avaliar(`${M}.execucao.emExecucao()`), true)
  await avaliar(`${M}.comandos.parar()`)
  conferir('Python: Ctrl+F2 para o laço', await ate(`${M}.execucao.emExecucao() === false`, 20), true)
  await avaliar(`${M}.execucao.restaurar()`)

  // ---- PHP: a página gerada ao vivo (servidor de desenvolvimento dentro do app) ---------------
  await novo('php', '<h1>Olá, <?= strtoupper("php") ?>!</h1>\n<?php for ($i = 1; $i <= 3; $i++) echo "<p>$i</p>"; ?>\n')
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('PHP: página aberta', await ate(`!!document.querySelector('#previa:not([hidden])') && document.querySelector('#previa-info').textContent.includes('HTTP 200')`, 80), true)
  await avaliar(`document.querySelector('.previa-aba[data-modo="html"]').click()`)
  conferir('PHP: HTML gerado', await ate(`document.querySelector('#previa-html').textContent.includes('<h1>Olá, PHP!</h1>')`, 40), true)
  conferir('PHP: laço executado', (await avaliar(`document.querySelector('#previa-html').textContent`)).includes('<p>3</p>'), true)
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify('<h2>Mudou</h2>\n')})`)
  conferir('PHP: a página acompanha a edição sozinha', await ate(`document.querySelector('#previa-html').textContent.includes('<h2>Mudou</h2>')`, 60), true)
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify('<p>antes</p>\n<?php\necho 1 / 0;\n')})`)
  await avaliar(`void ${M}.comandos.executar()`)
  conferir('PHP: erro fatal abre o aviso com a linha', await ate(`/divisão por zero/.test(document.querySelector('dialog[open]')?.innerText ?? '')`, 60), true)
  conferir('PHP: lista de avisos na página', await avaliar(`document.querySelectorAll('.previa-aviso').length`) >= 1, true)
  await avaliar(`document.querySelector('dialog[open]')?.close()`)
  await avaliar(`${M}.execucao.restaurar()`)
  const proprios = erros.filter((e) => !/Autofill|DevTools/.test(e))
  conferir('sem erros no console da página', proprios, [])
}
