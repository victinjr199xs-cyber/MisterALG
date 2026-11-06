// Fumaça do console do Portugol "igual ao VisuAlg": janela própria (outro alvo em /json) com o título do VisuAlg,
// fundo preto, texto cinza, sem cabeçalho nem rodapé, `leia` no fluxo do texto, mensagens finais, fechar e Esc.
// Uso: electron app/out/main/index.js --remote-debugging-port=9358 (MISTERALG_DADOS=<pasta vazia>)
//      PORTA_CDP=9358 node scripts/cdp.mjs 9358 scripts/fumaca-console-visualg.mjs   (PRINTS_VISUALG=<pasta> tira capturas)

import { mkdirSync, writeFileSync } from 'node:fs'

const OK = (nome, v) => { console.log(`${v ? '✔' : '✖'} ${nome}`); if (!v) throw new Error(nome) }
const LEIA = 'algoritmo "t"\nvar\n  n: inteiro\ninicio\n  escreval("Digite:")\n  leia(n)\n  escreval("Dobro: ", n * 2)\nfimalgoritmo\n'
const ERRO = 'algoritmo "t"\nvar\n  a: inteiro\ninicio\n  escreval("antes")\n  a <- 1 / 0\nfimalgoritmo\n'
const TITULO = 'Console simulando o modo texto do MS-DOS'

export default async ({ avaliar, esperar, foto, tecla, cdp }) => {
  const M = 'window.__misteralg'
  const porta = process.env.PORTA_CDP ?? 9358
  const pasta = process.env.PRINTS_VISUALG
  if (pasta) mkdirSync(pasta, { recursive: true })
  const pronta = async () => {
    for (let i = 0; i < 40; i += 1) {
      try { if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break } catch { /* recarregando */ }
      await esperar(500)
    }
    try { await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`) } catch { /* sem termos */ }
    for (let i = 0; i < 40; i += 1) { try { if (await avaliar('!!window.__misteralg')) break } catch { /* recarregando */ } await esperar(500) }
    await esperar(600)
  }
  const ate = async (js, n = 40) => { for (let i = 0; i < n; i += 1) { if (await avaliar(js)) return true; await esperar(150) } return false }
  const alvos = async () => (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).filter((t) => t.type === 'page' && !t.url.startsWith('data:'))
  const filhaInfo = async () => (await alvos()).find((t) => t.url === 'about:blank')
  // Comando CDP na janela do console (cada chamada abre e fecha o socket).
  const naFilha = async (method, params = {}) => {
    const filha = await filhaInfo()
    if (!filha) throw new Error('sem janela do console')
    const ws = new WebSocket(filha.webSocketDebuggerUrl)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    ws.send(JSON.stringify({ id: 1, method, params }))
    // (a tecla pode fechar a janela antes da resposta: o fechamento do socket também encerra a espera)
    const msg = await new Promise((r) => {
      ws.addEventListener('message', (m) => { const j = JSON.parse(m.data); if (j.id === 1) r(j) })
      ws.addEventListener('close', () => r({}))
      setTimeout(() => r({}), 8000)
    })
    ws.close()
    return msg.result
  }
  const naJanela = async (expr) => (await naFilha('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value
  const teclaFilha = async (key) => {
    const vk = { Enter: 13, Escape: 27 }[key]
    const base = { key, code: key, windowsVirtualKeyCode: vk }
    await naFilha('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
    await naFilha('Input.dispatchKeyEvent', { type: 'keyUp', ...base }).catch(() => {}) // a tecla pode ter fechado a janela
  }
  const fotoFilha = async (arquivo) => {
    if (!pasta) return
    await naFilha('Page.bringToFront')
    await esperar(500)
    writeFileSync(arquivo, Buffer.from((await naFilha('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  }
  const texto = () => naJanela(`document.querySelector('#console-tela').textContent`)
  const carregar = (t) => avaliar(`${M}.editor.definirTexto(${JSON.stringify(t)}); 1`)
  const recarregar = async () => { await avaliar(`${M}.doc.modificado = false; window.misteralg.recuperacao.limpar().then(() => 1)`); await cdp('Page.reload', {}); await esperar(3000); await pronta(); await esperar(1500); await pronta() }
  const emExecucao = () => avaliar(`${M}.execucao.emExecucao()`)

  await pronta()
  OK('padrão: console do Portugol igual ao VisuAlg', (await avaliar(`window.misteralg.prefs.ler().then(p => p.consolePortugol)`)) === 'visualg')

  // ---- executar (F9): janela própria no estilo VisuAlg, esperando o leia ------------------------------------
  await carregar(LEIA)
  await avaliar(`void ${M}.comandos.executar()`)
  OK('abriu outro alvo em /json', await (async () => { for (let i = 0; i < 30; i += 1) { if (await filhaInfo()) return true; await esperar(200) } return false })())
  OK('título da janela do VisuAlg', (await filhaInfo()).title === TITULO)
  OK('esperando a entrada', await ate(`!!${M}.execucao.console.el.querySelector('.console-entrada')`))
  await esperar(500)
  const visual = JSON.parse(await naJanela(`JSON.stringify((() => {
    const c = document.querySelector('#console'); const tela = c.querySelector('.console-tela'); const cs = getComputedStyle(tela)
    return { estilo: c.dataset.estilo, cab: getComputedStyle(c.querySelector('.console-cab')).display, rod: getComputedStyle(c.querySelector('.console-rodape')).display,
      fundo: cs.backgroundColor, cor: cs.color, fonte: cs.fontFamily, tam: cs.fontSize, caret: getComputedStyle(c.querySelector('.console-entrada')).caretShape,
      noFluxo: c.querySelector('.console-entrada').parentNode === tela, doc: document.title }
  })())`))
  console.log(JSON.stringify(visual))
  OK('estilo visualg', visual.estilo === 'visualg')
  OK('sem cabeçalho nem rodapé', visual.cab === 'none' && visual.rod === 'none')
  OK('fundo preto e texto #C0C0C0', visual.fundo === 'rgb(0, 0, 0)' && visual.cor === 'rgb(192, 192, 192)')
  OK('fonte de console 14px', /Consolas|Lucida Console/.test(visual.fonte) && visual.tam === '14px')
  OK('cursor sublinhado no leia, dentro do fluxo do texto', visual.caret === 'underscore' && visual.noFluxo)
  OK('escreval apareceu', /Digite:/.test(await texto()))
  await fotoFilha(`${pasta}/visualg-aguardando.png`)
  await naFilha('Input.insertText', { text: '21' })
  await teclaFilha('Enter')
  OK('programa terminou', await ate(`!${M}.execucao.emExecucao()`))
  await esperar(300)
  const final = await texto()
  console.log(JSON.stringify(final))
  OK('saída do programa', /Dobro:\s+42/.test(final))
  OK('mensagens finais do VisuAlg (linha em branco, fim, feche)', final.endsWith('\n\n*** Fim da execução.\n*** Feche esta janela para retornar ao MisterALG.\n'))
  OK('sem selo nem botões do console moderno', await naJanela(`getComputedStyle(document.querySelector('.console-cab')).display === 'none' && !document.querySelector('.saida-sistema')`))
  await fotoFilha(`${pasta}/visualg-finalizado.png`)

  // ---- fechar no fim: a janela some e o foco volta ao editor ---------------------------------------------------
  await teclaFilha('Escape')
  OK('Esc no fim fecha a janela', await ate(`true`) && await (async () => { for (let i = 0; i < 20; i += 1) { if (!(await filhaInfo())) return true; await esperar(200) } return false })())
  OK('console escondido e foco no editor', await avaliar(`document.querySelector('#console').hidden && !!document.activeElement.closest('.cm-editor')`))

  // ---- fechar a janela durante a execução interrompe o programa ---------------------------------------------------
  await avaliar(`void ${M}.comandos.executar()`)
  OK('esperando de novo', await ate(`!!${M}.execucao.console.el.querySelector('.console-entrada')`))
  await naFilha('Runtime.evaluate', { expression: 'window.close()' })
  OK('fechar a janela interrompeu o programa', await ate(`!${M}.execucao.emExecucao()`, 40))
  OK('janela fechada e console escondido', !(await filhaInfo()) && await avaliar(`document.querySelector('#console').hidden`))

  // ---- Esc interrompe: no leia e no passo a passo (F8) -----------------------------------------------------------
  await avaliar(`void ${M}.comandos.executar()`)
  await ate(`!!${M}.execucao.console.el.querySelector('.console-entrada')`)
  await naFilha('Runtime.evaluate', { expression: `document.querySelector('.console-entrada').focus()` })
  await teclaFilha('Escape')
  OK('Esc no leia interrompe', await ate(`!${M}.execucao.emExecucao()`))
  OK('mensagem de interrupção', /Execução terminada pelo usuário\./.test(await texto()))
  await teclaFilha('Escape')
  await esperar(800)
  await avaliar(`void ${M}.comandos.passo()`)
  OK('F8 também abre a janela do VisuAlg', await (async () => { for (let i = 0; i < 30; i += 1) { if (await filhaInfo()) return true; await esperar(200) } return false })())
  OK('F8 pausou na primeira linha', await ate(`${M}.execucao.console.estado === 'pausado'`))
  OK('memória atualiza na IDE durante o F8', await avaliar(`document.querySelectorAll('#variaveis tbody tr').length >= 1`))
  await teclaFilha('Escape')
  OK('Esc interrompe o passo a passo', await ate(`!${M}.execucao.emExecucao()`))
  await teclaFilha('Escape')
  await esperar(800)

  // ---- erro de execução: texto simples no console e o aviso editável na IDE ----------------------------------------
  await carregar(ERRO)
  await avaliar(`void ${M}.comandos.executar()`)
  OK('aviso do erro apareceu na IDE', await ate(`!!document.querySelector('dialog[open] .aviso-linha')`, 60))
  const tela = await texto()
  console.log(JSON.stringify(tela))
  OK('erro como no VisuAlg (texto simples)', /antes\n\n\*\*\* Execução terminada por erro\.\n\*\*\* Feche esta janela/.test(tela) && !(await naJanela(`!!document.querySelector('.saida-erro')`)))
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Terminar').click()`)
  await esperar(400)
  await teclaFilha('Escape')
  await esperar(800)

  // ---- tutorial e preferência "Moderno": console no painel ---------------------------------------------------------
  await avaliar(`window.misteralg.prefs.gravar({ consolePortugol: 'moderno' }).then(() => 1)`)
  await esperar(800)
  await recarregar()
  await carregar(LEIA)
  await avaliar(`void ${M}.comandos.executar()`)
  OK('moderno: console no painel', await ate(`!!document.querySelector('#console-tela .console-entrada')`))
  OK('moderno: sem janela própria', !(await filhaInfo()))
  OK('moderno: cabeçalho visível', await avaliar(`getComputedStyle(document.querySelector('.console-cab')).display !== 'none'`))
  await avaliar(`${M}.execucao.parar()`)
  await esperar(500)
  await avaliar(`window.misteralg.prefs.gravar({ consolePortugol: 'visualg' }).then(() => 1)`)
  console.log('Fumaça do console estilo VisuAlg: tudo certo.')
}
