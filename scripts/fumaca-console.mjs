// Fumaça do console moderno: selo de estado, leia com histórico, copiar, limpar, erro clicável e janela própria.
// Uso: electron app/out/main/index.js --remote-debugging-port=9352 (MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9352 scripts/fumaca-console.mjs   (PRINTS_CONSOLE=<pasta> tira capturas)

import { mkdirSync, writeFileSync } from 'node:fs'

function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}
const OK = (nome, v) => { console.log(`${v ? '✔' : '✖'} ${nome}`); if (!v) throw new Error(nome) }
const LEIA = 'algoritmo "t"\nvar\n  n: inteiro\ninicio\n  escreval("Digite:")\n  leia(n)\n  escreval("Dobro: ", n * 2)\nfimalgoritmo\n'
const ERRO = 'algoritmo "t"\nvar\n  a: inteiro\ninicio\n  a <- 1 / 0\nfimalgoritmo\n'

export default async ({ avaliar, esperar, foto, tecla, cdp }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS_CONSOLE
  if (pasta) mkdirSync(pasta, { recursive: true })
  const pronta = async () => {
    for (let i = 0; i < 40; i += 1) {
      try { if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break } catch { /* recarregando */ }
      await esperar(500)
    }
    try { await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`) } catch {}
    for (let i = 0; i < 40; i += 1) { try { if (await avaliar('!!window.__misteralg')) break } catch {} await esperar(500) }
    await esperar(600)
  }
  const gravar = async (p) => { await avaliar(`window.misteralg.prefs.gravar(${JSON.stringify(p)}).then(() => 1)`); await esperar(1000) }
  const recarregar = async () => { await avaliar(`window.__misteralg.doc.modificado = false; window.misteralg.recuperacao.limpar().then(() => 1)`); await cdp('Page.reload', {}); await esperar(3000); await pronta(); await esperar(1500); await pronta() }
  const alvos = async () => (await (await fetch(`http://127.0.0.1:${process.env.PORTA_CDP ?? 9352}/json`)).json()).filter((t) => t.type === 'page' && !t.url.startsWith('data:'))
  const fotoFilha = async (arquivo) => {
    const filha = (await alvos()).find((t) => t.url === 'about:blank')
    if (!filha) return
    const ws = new WebSocket(filha.webSocketDebuggerUrl)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    ws.send(JSON.stringify({ id: 1, method: 'Page.bringToFront' }))
    await esperar(400)
    ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }))
    const msg = await new Promise((r) => ws.addEventListener('message', (m) => { const j = JSON.parse(m.data); if (j.id === 2) r(j) }))
    writeFileSync(arquivo, Buffer.from(msg.result.data, 'base64'))
    ws.close()
  }
  const carregar = (texto) => avaliar(`${M}.editor.definirTexto(${JSON.stringify(texto)}); 1`)
  const selo = () => avaliar(`window.__misteralg.execucao.console.el.querySelector('.console-selo').textContent`)
  const esperarSelo = async (re) => { for (let i = 0; i < 60; i += 1) { const s = await selo(); if (re.test(s ?? '')) return s; await esperar(200) } return selo() }
  // Com o console na janela filha, o teclado vai pelo CDP dela.
  const noFilha = () => avaliar(`window.__misteralg.execucao.console.emJanela`)
  const enviarFilha = async (method, params) => {
    const filha = (await alvos()).find((t) => t.url === 'about:blank')
    const ws = new WebSocket(filha.webSocketDebuggerUrl)
    await new Promise((r) => ws.addEventListener('open', r, { once: true }))
    ws.send(JSON.stringify({ id: 1, method, params }))
    await new Promise((r) => ws.addEventListener('message', (m) => { if (JSON.parse(m.data).id === 1) r() }))
    ws.close()
  }
  const dig = async (texto) => {
    await avaliar(`window.__misteralg.execucao.console.el.querySelector('.console-entrada')?.focus(); 1`)
    if (await noFilha()) await enviarFilha('Input.insertText', { text: texto })
    else await cdp('Input.insertText', { text: texto })
  }
  const teclaDe = async (key) => {
    if (!(await noFilha())) return tecla(key)
    const vk = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40 }[key]
    const base = { key, code: key, windowsVirtualKeyCode: vk }
    await enviarFilha('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
    await enviarFilha('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  }
  const doConsole = (js) => avaliar(`(() => { const c = window.__misteralg.execucao.console.el; const d = c.ownerDocument; return (${js})(c, d) })()`)

  await pronta()
  for (const [disposicao, janela] of [['moderna', false], ['classica', false], ['classica', true]]) {
    console.log(`--- ${disposicao}, janela=${janela}`)
    await gravar({ disposicao, tema: disposicao === 'moderna' ? 'hibrido-escuro' : 'classico', consoleEmJanela: janela })
    await recarregar()
    await carregar(LEIA)
    await avaliar(`${M}.comandos.executar(); 1`)
    OK('selo Aguardando entrada', /Aguardando/.test(await esperarSelo(/Aguardando/)))
    OK('Limpar desabilitado no leia', await doConsole((c) => c.querySelector('[data-acao=limpar]').disabled))
    if (janela) {
      await esperar(1000)
      console.log('prefs', JSON.stringify(await avaliar(`window.misteralg.prefs.ler().then(p => [p.consoleEmJanela, p.disposicao])`)), 'tut', await avaliar(`!!window.__misteralg.tutorial`));
      console.log('emJanela', await avaliar(`window.__misteralg.execucao.console.emJanela`))
      const lista = await alvos()
      OK('segunda janela existe', lista.length >= 2)
      OK('console está na janela filha', await avaliar(`${M}.execucao.console.emJanela`))
      OK('console fora do documento principal', await avaliar(`window.__misteralg.execucao.console.el.ownerDocument !== document`))
    }
    if (pasta) await (janela ? fotoFilha : foto)(`${pasta}/${disposicao}-${janela ? 'janela' : 'painel'}-aguardando.png`)
    await dig('21')
    await teclaDe('Enter')
    const fim = await esperarSelo(/Finalizado/)
    OK(`selo Finalizado (${fim})`, /Finalizado em .* · código 0/.test(fim))
    console.log(JSON.stringify(await doConsole((c) => c.querySelector('.console-tela').textContent)))
    OK('saída tem Dobro: 42', await doConsole((c) => /Dobro:\s+42/.test(c.querySelector('.console-tela').textContent)))
    OK('rodapé com linhas', await doConsole((c) => /linhas?/.test(c.querySelector('.console-rodape').textContent)))
    if (pasta) await (janela ? fotoFilha : foto)(`${pasta}/${disposicao}-${janela ? 'janela' : 'painel'}-finalizado.png`)
    // copiar
    await doConsole((c) => c.querySelector('[data-acao=copiar]').click())
    await esperar(400)
    const copiado = await avaliar(`navigator.clipboard.readText().catch(() => null)`)
    if (copiado == null) console.log('- clipboard.readText indisponível: conferência pulada')
    else OK('texto copiado', /Dobro:\s+42/.test(copiado))
    // histórico ↑ numa segunda execução (botão Executar de novo)
    await doConsole((c) => c.querySelector('[data-acao=reexecutar]').click())
    await esperarSelo(/Aguardando/)
    await avaliar(`window.__misteralg.execucao.console.el.querySelector('.console-entrada')?.focus(); 1`)
    await teclaDe('ArrowUp')
    conferir('↑ traz a entrada anterior', await avaliar(`window.__misteralg.execucao.console.el.querySelector('.console-entrada')?.value`), '21')
    await teclaDe('ArrowDown')
    conferir('↓ volta ao vazio', await avaliar(`window.__misteralg.execucao.console.el.querySelector('.console-entrada')?.value`), '')
    await teclaDe('Escape')
    await esperarSelo(/Interrompido/)
    conferir('selo Interrompido', await selo(), 'Interrompido')
    // limpar
    await doConsole((c) => c.querySelector('[data-acao=limpar]').click())
    OK('limpar esvazia a saída', await doConsole((c) => !c.querySelector('.console-tela').textContent.includes('Digite')))
    // erro clicável
    await carregar(ERRO)
    await avaliar(`${M}.comandos.executar(); 1`)
    const e = await esperarSelo(/Erro/)
    OK(`selo de erro (${e})`, /Erro na linha 5/.test(e))
    await avaliar(`document.querySelector('dialog[open] button')?.click(); 1`)
    await esperar(300)
    await doConsole((c) => c.querySelector('.console-selo').click())
    await esperar(300)
    conferir('clicar no selo vai para a linha 5', await avaliar(`${M}.editor.linhaDoCursor()`), 5)
    await avaliar(`${M}.execucao.teclaEsc(); 1`)
    await esperar(500)
    OK('console some do painel/fecha a janela', (await alvos()).length === 1)
    // destacar e recolocar manualmente (só no painel)
    if (!janela) {
      await carregar(LEIA)
      await avaliar(`${M}.comandos.executar(); 1`)
      await esperarSelo(/Aguardando/)
      await avaliar(`${M}.execucao.console.destacar(); 1`)
      await esperar(1500)
      OK('destacar abre segunda janela', (await alvos()).length >= 2)
      OK('console na janela filha', await avaliar(`${M}.execucao.console.emJanela`))
      OK('console fora do documento principal', await avaliar(`window.__misteralg.execucao.console.el.ownerDocument !== document`))
      if (pasta) {
        const filha = (await alvos()).find((t) => !t.url.includes('index.html')) ?? (await alvos())[1]
        const ws = new WebSocket(filha.webSocketDebuggerUrl)
        await new Promise((r) => ws.addEventListener('open', r, { once: true }))
        ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }))
        const msg = await new Promise((r) => ws.addEventListener('message', (m) => { const j = JSON.parse(m.data); if (j.id === 1) r(j) }))
        writeFileSync(`${pasta}/${disposicao}-janela-destacada.png`, Buffer.from(msg.result.data, 'base64'))
        ws.close()
      }
      await avaliar(`${M}.execucao.console.recolocar(); 1`)
      await esperar(1000)
      OK('recolocar volta ao painel', await avaliar(`!${M}.execucao.console.emJanela && window.__misteralg.execucao.console.el.ownerDocument === document`))
      OK('programa continua aguardando', /Aguardando/.test(await selo()))
      await avaliar(`${M}.execucao.parar(); 1`)
      await esperar(400)
    }
  }
}
