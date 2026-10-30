// Teste de fumaça da disposição moderna (Configurações > Editor > Disposição da tela) no app de verdade:
// prévia/Cancelar/OK, faixa de guias (abas), relógio de projetos anteriores (recentes e exemplos), cabeçalho da página, abas Terminal/Problemas,
// memória, divisor, nada com tamanho zero e a volta à clássica.
// Com PRINTS_DISPOSICAO=<pasta> também tira as capturas (4 temas + 1366x768).
// Uso: electron app/out/main/index.js --remote-debugging-port=9347 (MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9347 scripts/fumaca-disposicao.mjs

import { mkdirSync } from 'node:fs'

function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}
const PROGRAMA = 'algoritmo "t"\nvar\n  a, b: inteiro\ninicio\n  a <- 3\n  b <- a * 2\n  escreval("Resultado: ", b)\nfimalgoritmo\n'
const LINGUAGENS = ['portugol', 'csharp', 'javascript', 'typescript', 'python', 'c', 'cpp', 'php', 'sql']

export default async ({ avaliar, esperar, foto, tecla, cdp, classico }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS_DISPOSICAO
  if (pasta) mkdirSync(pasta, { recursive: true })

  const pronta = async () => {
    for (let i = 0; i < 40; i += 1) {
      if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break
      await esperar(500)
    }
    await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
    for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
    await esperar(400)
  }
  const recarregar = async () => { await cdp('Page.reload', {}); await esperar(2500); await pronta() }
  const gravar = async (p) => { await avaliar(`window.misteralg.prefs.gravar(${JSON.stringify(p)}).then(() => 1)`); await esperar(1000) }
  const abrir = async (aba) => {
    await avaliar(`void ${M}.comandos.configuracoes('${aba}')`)
    for (let i = 0; i < 20 && !(await avaliar(`!!document.querySelector('dialog[open] .abas')`)); i += 1) await esperar(100)
  }
  const botaoDoDialogo = (texto) => avaliar(`[...document.querySelectorAll('dialog[open] .janela-acoes button')].find(b => b.textContent === ${JSON.stringify(texto)}).click()`)
  const mudar = (seletor, valor) => avaliar(`(() => { const e = document.querySelector('dialog[open] ${seletor}'); e.value = ${JSON.stringify(valor)}; e.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  const fechado = async () => { for (let i = 0; i < 20 && (await avaliar(`!!document.querySelector('#dialogos dialog')`)); i += 1) await esperar(100) }
  const disp = () => avaliar(`document.documentElement.dataset.disposicao ?? null`)
  const q = (sel, js) => avaliar(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? (${js}) : null })()`)
  const visivel = (sel) => q(sel, `(() => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' })()`)
  const relogio = async () => {
    await avaliar(`document.querySelector('.aba-historico').click()`)
    for (let i = 0; i < 30 && !(await avaliar(`!!document.querySelector('#historico .historico-corpo section')`)); i += 1) await esperar(100)
  }
  const itensRelogio = (secao) => avaliar(`[...document.querySelectorAll('#historico section')[${secao}].querySelectorAll('.historico-item')].map(b => b.querySelector('.historico-nome').textContent)`)
  const abrirDoRelogio = async (secao, nome) => {
    await relogio()
    await avaliar(`[...document.querySelectorAll('#historico section')[${secao}].querySelectorAll('.historico-item')].find(b => b.querySelector('.historico-nome').textContent === ${JSON.stringify(nome)}).click()`)
    await esperar(800)
  }
  const doc = (campo) => avaliar(`${M}.doc.${campo}`)

  await pronta()
  // Quem instala agora começa na disposição moderna com o tema Híbrido claro (pasta de dados nova = sem preferências gravadas).
  conferir('padrão novo: disposição moderna', await disp(), 'moderna')
  conferir('padrão novo: tema Híbrido claro', await avaliar(`document.documentElement.dataset.tema`), 'hibrido-claro')
  conferir('padrão novo: faixa de guias visível', await visivel('#faixa-abas'), true)
  await classico() // o resto da fumaça parte do visual clássico, como antes
  await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false; ${M}.comandos.tema('hibrido-claro')`)

  // ---- clássica por padrão: nada da moderna aparece -------------------------------------------
  conferir('começa na clássica', await disp(), null)
  conferir('sem faixa de guias na clássica', await avaliar(`!document.querySelector('.faixa-abas')`), true)
  conferir('avatar na barra (clássica)', await avaliar(`!!document.querySelector('#barra [data-id="conta"]')`), true)

  // ---- prévia, Cancelar e OK nas Configurações ----------------------------------------------------
  await abrir('editor')
  await mudar('#cfg-disposicao', 'moderna')
  conferir('prévia moderna', await disp(), 'moderna')
  conferir('faixa visível na prévia', await visivel('#faixa-abas'), true)
  await botaoDoDialogo('Cancelar')
  await fechado()
  conferir('Cancelar volta à clássica', await disp(), null)
  conferir('faixa some', await visivel('#faixa-abas'), false)
  conferir('avatar voltou à barra', await avaliar(`!!document.querySelector('#barra [data-id="conta"]')`), true)
  conferir('nada gravado ao cancelar', await avaliar(`window.misteralg.prefs.ler().then(p => p.disposicao)`), 'classica')
  await abrir('editor')
  await mudar('#cfg-disposicao', 'moderna')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('OK grava moderna', await avaliar(`window.misteralg.prefs.ler().then(p => p.disposicao)`), 'moderna')
  await recarregar()
  conferir('moderna persiste', await disp(), 'moderna')

  // ---- faixa de guias --------------------------------------------------------------------------------
  conferir('sem trilho nem coluna de arquivos', await avaliar(`!document.querySelector('#trilho, #canais, .cab-alternar')`), true)
  conferir('uma guia, do Portugol', await avaliar(`[...document.querySelectorAll('.aba-doc')].map(b => b.querySelector('.aba-sigla').textContent).join()`), 'Pt')
  conferir('avatar na faixa', await avaliar(`!!document.querySelector('#faixa-abas [data-id="conta"]')`), true)
  conferir('barra no topo (sem lateral)', await avaliar(`!document.body.classList.contains('barra-lateral')`), true)
  await avaliar(`document.querySelector('.aba-nova').click()`)
  await esperar(300)
  conferir('o + abre o menu de linguagens', await avaliar(`[...document.querySelectorAll('.menu-nova-item')].map(b => b.querySelector('.menu-nova-nome').textContent).join(' ')`), 'Portugol C# JavaScript TypeScript Python C C++ PHP SQL')
  await avaliar(`[...document.querySelectorAll('.menu-nova-item')].find(b => b.textContent.includes('Python')).click()`)
  await esperar(500)
  conferir('Python no lugar da guia vazia', await doc('linguagem'), 'python')
  conferir('título da página', await q('.cab-titulo', 'e.textContent'), 'semnome.py')
  conferir('propriedade Linguagem', await q('.cab-prop b', 'e.textContent'), 'Python')
  await avaliar(`${M}.editor.definirTexto('x = 1'); ${M}.doc.modificado = false; 1`) // não é mais o esqueleto: a próxima guia é nova
  await avaliar(`document.querySelector('.aba-nova').click()`)
  await avaliar(`[...document.querySelectorAll('.menu-nova-item')].find(b => b.textContent.includes('Portugol')).click()`)
  await esperar(500)
  conferir('volta ao Portugol (guia nova)', await doc('linguagem'), 'portugol')
  // se há texto modificado o fluxo normal pergunta antes de descartar (diálogo nativo): o teste não deixa modificado
  conferir('estado Salvo', await avaliar(`document.querySelectorAll('.cab-prop b')[1].textContent`), 'Salvo')
  conferir('duas guias', await avaliar(`document.querySelectorAll('.aba-doc').length`), 2)
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)}); ${M}.doc.modificado = false; 1`)

  // ---- exemplos e recentes ------------------------------------------------------------------------
  await relogio()
  conferir('relógio aberto (aria-expanded)', await q('.aba-historico', 'e.getAttribute("aria-expanded")'), 'true')
  conferir('painel é um diálogo', await q('#historico', 'e.getAttribute("role")'), 'dialog')
  const exemplos = await itensRelogio(1)
  console.log('exemplos do Portugol:', exemplos.join(', '))
  conferir('exemplos listados', exemplos.length >= 5, true)
  conferir('recentes vazios no começo', await itensRelogio(0), [])
  await avaliar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  conferir('Esc fecha o relógio', await avaliar(`!document.querySelector('#historico')`), true)
  await abrirDoRelogio(1, 'media_notas.alg')
  conferir('exemplo abriu', await doc('nome'), 'media_notas')
  conferir('título mostra o exemplo', await q('.cab-titulo', 'e.textContent'), 'media_notas.alg')
  conferir('editor tem o exemplo', await avaliar(`${M}.editor.texto().includes('media')`), true)
  const guias = await avaliar(`document.querySelectorAll('.aba-doc').length`)
  await abrirDoRelogio(1, 'media_notas.alg')
  conferir('o mesmo exemplo só ativa a guia', await avaliar(`document.querySelectorAll('.aba-doc').length`), guias)
  // recente: abre um arquivo de verdade pelo fluxo normal (o mesmo do menu Arquivo)
  const arquivo = (await import('node:path')).resolve('exemplos/tabuada.alg')
  await avaliar(`${M}.comandos['abrir-recente'](${JSON.stringify(arquivo)})`)
  await esperar(1000)
  await relogio()
  conferir('recente listado', await itensRelogio(0), ['tabuada.alg'])
  await avaliar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await abrirDoRelogio(1, 'media_notas.alg')

  // ---- F9 escreve no terminal, dentro da aba ---------------------------------------------------------
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)}); ${M}.doc.modificado = false; 1`)
  await avaliar(`document.querySelector('#aba-problemas').click()`)
  conferir('aba Problemas selecionada', await avaliar(`document.querySelector('#aba-problemas').getAttribute('aria-selected')`), 'true')
  conferir('painel Problemas visível', await visivel('#problemas'), true)
  conferir('terminal escondido na outra aba', await visivel('.moldura-visualizacao'), false)
  conferir('estado vazio amigável', await q('#problemas', 'e.textContent'), 'Nenhum problema ✨')
  await avaliar(`${M}.editor.focar()`)
  await avaliar(`void ${M}.comandos.executar()`) // F9 é atalho do menu nativo: o teste chama o mesmo comando
  await esperar(1500)
  conferir('F9 volta para a aba Terminal', await avaliar(`document.querySelector('#aba-terminal').getAttribute('aria-selected')`), 'true')
  conferir('F9 escreveu no terminal', await avaliar(`document.querySelector('#console-tela').textContent.includes('Resultado:  6')`), true)
  conferir('terminal visível dentro da aba', await visivel('.moldura-visualizacao #console-tela'), true)
  conferir('abas com roles', await avaliar(`[document.querySelector('#abas-inferior').getAttribute('role'), ...[...document.querySelectorAll('.aba-inferior')].map(b => b.getAttribute('role')), document.querySelector('#problemas').getAttribute('role'), document.querySelector('.moldura-visualizacao').getAttribute('role')].join()`), 'tablist,tab,tab,tabpanel,tabpanel')

  // ---- F8 passo a passo: memória aparece com contador ------------------------------------------------
  await avaliar(`${M}.execucao.restaurar(); ${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)}); ${M}.doc.modificado = false; 1`)
  await avaliar(`${M}.editor.focar()`)
  for (let i = 0; i < 4; i += 1) { await avaliar(`void ${M}.comandos.passo()`); await esperar(500) }
  const linhasMem = await avaliar(`document.querySelectorAll('#variaveis tbody tr').length`)
  conferir('memória com variáveis em F8', linhasMem >= 2, true)
  conferir('memória visível', await visivel('.moldura-variaveis'), true)
  conferir('contador da memória', await q('.mem-contador', 'e.textContent'), String(linhasMem))
  await avaliar(`${M}.comandos.parar()`)
  await esperar(500)

  // ---- problemas: erro de execução aparece na aba ---------------------------------------------------
  await avaliar(`${M}.execucao.restaurar(); ${M}.editor.definirTexto('algoritmo "e"\\nvar\\n  v: vetor[1..2] de inteiro\\ninicio\\n  v[5] <- 1\\nfimalgoritmo\\n'); ${M}.doc.modificado = false; 1`)
  await avaliar(`void ${M}.comandos.executar()`)
  for (let i = 0; i < 20 && !(await avaliar(`!!document.querySelector('dialog[open]')`)); i += 1) await esperar(250)
  await avaliar(`document.querySelector('dialog[open]')?.close('cancelar')`)
  await esperar(500)
  conferir('selo de problema na aba', await q('.aba-selo', '!e.hidden'), true)
  await avaliar(`document.querySelector('#aba-problemas').click()`)
  conferir('problema mostra a linha', await avaliar(`/\\d/.test(document.querySelector('#problemas .problema b')?.textContent ?? '')`), true)
  console.log('problema:', await q('#problemas', 'e.textContent'))
  await avaliar(`${M}.editor.irParaLinha(1); document.querySelector('#problemas .problema').click()`)
  await esperar(300)
  conferir('clicar no problema leva o cursor à linha 5', await avaliar(`${M}.editor.linhaDoCursor()`), 5)
  await avaliar(`${M}.execucao.restaurar(); ${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)}); ${M}.doc.modificado = false; document.querySelector('#aba-terminal').click(); 1`)

  // ---- altura padrão do painel inferior (sem altura salva): ~32% da área central ------------------------
  conferir('sem altura salva ainda', await avaliar(`window.misteralg.prefs.ler().then(p => p.alturaPainel)`), 0)
  const proporcao = await avaliar(`(() => { const m = document.querySelector('main'); return document.querySelector('.moldura-visualizacao').getBoundingClientRect().height / m.clientHeight })()`)
  console.log('proporção do painel inferior:', proporcao.toFixed(3))
  conferir('painel inferior ~32% da área central', proporcao > 0.28 && proporcao < 0.36, true)
  conferir('editor com pelo menos 200px', await q('.moldura-editor', 'e.getBoundingClientRect().height >= 200'), true)

  // ---- barra numa linha só, com o painel "⋯" abrindo para baixo -----------------------------------------
  const linhasDaBarra = () => avaliar(`new Set([...document.querySelectorAll('#barra .botao')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().top))).size`)
  conferir('barra em uma linha só', await linhasDaBarra(), 1)
  conferir('barra só com os principais (sem Cortar)', await avaliar(`!!document.querySelector('#barra [data-id="cortar"]')`), false)
  await avaliar(`document.querySelector('[data-id="mais"]').click()`)
  await esperar(300)
  conferir('painel ⋯ aberto', await visivel('#barra-mais'), true)
  conferir('painel abre logo abaixo do botão', await avaliar(`(() => { const p = document.querySelector('#barra-mais').getBoundingClientRect(); const b = document.querySelector('[data-id="mais"]').getBoundingClientRect(); return p.top >= b.bottom - 1 && p.top - b.bottom < 16 && p.left >= 0 && p.right <= innerWidth })()`), true)
  conferir('Cortar dentro do painel', await avaliar(`!!document.querySelector('#barra-mais [data-id="cortar"]')`), true)
  await avaliar(`document.querySelector('[data-id="mais"]').click()`)
  await esperar(200)
  conferir('painel ⋯ fecha', await visivel('#barra-mais'), false)

  // ---- guias: siglas ------------------------------------------------------------------------------------
  conferir('siglas das guias', await avaliar(`[...document.querySelectorAll('.aba-doc .aba-sigla')].map(b => b.textContent).slice(0, 2).join(' ')`), 'Py Pt')
  conferir('abas com roles', await avaliar(`[document.querySelector('#abas-doc').getAttribute('role'), document.querySelector('.aba-doc').getAttribute('role'), document.querySelector('.aba-doc[aria-selected="true"]').getAttribute('aria-controls')].join()`), 'tablist,tab,editor-painel')

  // ---- F8 com vetor: "Passo N" e caixinhas na memória ------------------------------------------------------
  await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false; 1`)
  await abrirDoRelogio(1, 'ordena_vetor.alg')
  await avaliar(`${M}.doc.modificado = false; ${M}.editor.focar()`)
  conferir('Passo N escondido antes do F8', await visivel('.cab-passo'), false)
  for (let i = 0; i < 12; i += 1) { await avaliar(`void ${M}.comandos.passo()`); await esperar(450) }
  conferir('Passo N visível no F8', await visivel('.cab-passo'), true)
  console.log('trilha:', await q('.cab-passo', 'e.textContent'))
  conferir('Passo conta os passos', await avaliar(`/^Passo \\d+$/.test(document.querySelector('.cab-passo-texto').textContent)`), true)
  conferir('vetor em caixinhas', await avaliar(`document.querySelectorAll('#variaveis .caixa').length > 0`), true)
  conferir('caixinhas têm índice', await avaliar(`document.querySelector('#variaveis .caixa i').textContent`), '1')
  console.log('vetor:', await avaliar(`[...document.querySelectorAll('#variaveis tr.vetor-linha')].map(t => t.querySelector('.vetor-cab b').textContent + ' = ' + [...t.querySelectorAll('.caixa b')].map(b => b.textContent).join(',')).join(' | ')`))
  await avaliar(`${M}.comandos.parar(); 1`)
  await esperar(600)
  conferir('Passo N some ao terminar', await visivel('.cab-passo'), false)
  await avaliar(`${M}.execucao.restaurar(); 1`)

  // ---- divisor (teclado) salva a altura ---------------------------------------------------------------
  const alt0 = await q('.moldura-visualizacao', 'e.getBoundingClientRect().height')
  await avaliar(`document.querySelector('#divisor').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))`)
  await esperar(600)
  const alt1 = await q('.moldura-visualizacao', 'e.getBoundingClientRect().height')
  conferir('divisor aumenta o painel', alt1 > alt0, true)
  conferir('altura gravada nas prefs', await avaliar(`window.misteralg.prefs.ler().then(p => p.alturaPainel > 0)`), true)

  // ---- coluna de arquivos removida: o editor ocupa a largura toda -------------------------------------
  conferir('editor com a largura toda (menos a memória)', await avaliar(`(() => { const m = document.querySelector('main').getBoundingClientRect(); const e = document.querySelector('.moldura-editor').getBoundingClientRect(); return e.left < 40 && m.right - e.right < 340 })()`), true)

  // ---- nada cortado nem com tamanho zero (1366x768) --------------------------------------------------
  const medir = () => avaliar(`(() => {
    const ruins = []
    for (const s of ['#faixa-abas', '.aba-doc', '.barra', '#cab-pagina', '.moldura-editor', '#divisor', '#abas-inferior', '.moldura-visualizacao', '.moldura-variaveis', '.status']) {
      const e = document.querySelector(s); if (!e) { ruins.push(s + ' ausente'); continue }
      const r = e.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) ruins.push(s + ' zero ' + Math.round(r.width) + 'x' + Math.round(r.height))
      if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) ruins.push(s + ' fora da janela')
    }
    if (document.documentElement.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight + 1) ruins.push('página rola')
    const ed = document.querySelector('.moldura-editor').getBoundingClientRect()
    if (ed.height < 150) ruins.push('editor baixo demais: ' + Math.round(ed.height))
    return ruins
  })()`)
  conferir('1366x768 sem cortes', await medir(), [])

  if (pasta) {
    await avaliar(`${M}.execucao.restaurar(); 1`)
    await abrirDoRelogio(1, 'media_notas.alg')
    for (const [tema, nome] of [['hibrido-claro', 'hibrido-claro'], ['hibrido-escuro', 'hibrido-escuro'], ['noite', 'noite'], ['papel', 'papel']]) {
      await avaliar(`${M}.comandos.tema('${tema}')`)
      await avaliar(`${M}.execucao.restaurar(); 1`)
      await esperar(300)
      await avaliar(`${M}.editor.focar()`)
      for (let i = 0; i < 6; i += 1) { await avaliar(`void ${M}.comandos.passo()`); await esperar(450) }
      await esperar(500)
      await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
      await esperar(500)
      await foto(`${pasta}/moderna-${nome}.png`)
      if (tema === 'hibrido-claro') {
        await cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false })
        await esperar(500)
        await foto(`${pasta}/moderna-1366x768.png`)
        conferir('1366x768 com programa rodando sem cortes', await medir(), [])
      }
      await cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false })
      await avaliar(`${M}.comandos.parar(); 1`)
    }
    await avaliar(`${M}.comandos.tema('hibrido-claro')`)
  }
  await cdp('Emulation.clearDeviceMetricsOverride', {})

  // ---- barra de ferramentas na lateral também na moderna ------------------------------------------------
  const lateral = () => avaliar(`document.body.classList.contains('barra-lateral')`)
  const caixa = (sel) => avaliar(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] })()`)
  const dentro = (sel) => avaliar(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 })()`)
  const medirLateral = () => avaliar(`(() => {
    const ruins = []
    const b = document.querySelector('#barra').getBoundingClientRect()
    if (!(b.height > b.width)) ruins.push('barra não é vertical')
    const f = document.querySelector('#faixa-abas').getBoundingClientRect()
    if (document.documentElement.dir !== 'rtl' ? f.left < b.right - 1 : f.right > b.left + 1) ruins.push('faixa de abas sobrepõe a barra')
    const conta = document.querySelector('[data-id="conta"]')
    if (conta.parentElement.id !== 'barra') ruins.push('avatar fora da barra')
    if (document.querySelector('#faixa-abas [data-id="conta"]')) ruins.push('avatar ainda na faixa')
    const l = document.querySelector('.barra-lista')
    if (l.scrollHeight > l.clientHeight) ruins.push('lista principal rola')
    const c = conta.getBoundingClientRect(), m = document.querySelector('[data-id="mais"]').getBoundingClientRect()
    if (c.top < m.bottom - 1) ruins.push('avatar sobrepõe o ⋯')
    if (c.bottom > b.bottom + 1) ruins.push('avatar cortado')
    for (const s of ['#barra', '#faixa-abas', '.aba-doc', '#cab-pagina', '.moldura-editor', '#divisor', '#abas-inferior', '.moldura-visualizacao', '.moldura-variaveis', '.status']) {
      const r = document.querySelector(s).getBoundingClientRect()
      if (r.width < 4 || r.height < 4) ruins.push(s + ' zero')
      if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) ruins.push(s + ' fora')
    }
    for (const bt of document.querySelectorAll('#barra .barra-lista .botao:not([hidden])')) {
      const r = bt.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.right > b.right + 1 || r.left < b.left - 1) ruins.push('botão ' + bt.dataset.id + ' ruim')
    }
    if (document.documentElement.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight + 1) ruins.push('página rola')
    return ruins
  })()`)
  await abrir('barra')
  await mudar('#cfg-posicao-barra', 'lateral')
  conferir('prévia lateral na moderna', await lateral(), true)
  conferir('prévia: avatar já na barra', await avaliar(`document.querySelector('[data-id="conta"]').parentElement.id`), 'barra')
  await botaoDoDialogo('Cancelar')
  await fechado()
  conferir('Cancelar desfaz a lateral', await lateral(), false)
  conferir('Cancelar: avatar volta à faixa', await avaliar(`document.querySelector('[data-id="conta"]').parentElement.className.includes('fim') || !!document.querySelector('#faixa-abas [data-id="conta"]')`), true)
  await abrir('barra')
  await mudar('#cfg-posicao-barra', 'lateral')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('moderna + lateral aplicada', [await disp(), await lateral()], ['moderna', true])
  conferir('moderna + lateral sem problemas', await medirLateral(), [])
  await avaliar(`for (const n of ['a', 'b']) ${M}.comandos.novo?.(); 1`)
  await esperar(400)
  conferir('várias abas: lateral continua limpa', await medirLateral(), [])
  const sobrepos = await avaliar(`(() => { const b = document.querySelector('#barra').getBoundingClientRect(); const ed = document.querySelector('.moldura-editor').getBoundingClientRect(); const m = document.querySelector('.moldura-variaveis').getBoundingClientRect(); return ed.left >= b.right && m.right <= innerWidth + 1 })()`)
  conferir('editor e memória à direita da barra', sobrepos, true)
  // painel ⋯ ao lado da barra
  await avaliar(`document.querySelector('[data-id="mais"]').click()`)
  await esperar(300)
  conferir('painel ⋯ aberto (lateral moderna)', await visivel('#barra-mais'), true)
  conferir('painel ⋯ dentro da janela', await dentro('#barra-mais'), true)
  conferir('painel ao lado da barra', await avaliar(`document.querySelector('#barra-mais').getBoundingClientRect().left >= document.querySelector('#barra').getBoundingClientRect().right - 1`), true)
  await esperar(100)
  if (pasta) await foto(`${pasta}/moderna-lateral-painel.png`)
  await tecla('Escape')
  conferir('Esc fecha o painel', await visivel('#barra-mais'), false)
  await avaliar(`document.querySelector('[data-id="mais"]').click()`)
  await avaliar(`document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`)
  conferir('clique fora fecha o painel', await visivel('#barra-mais'), false)
  // menu de temas
  const temaId = await avaliar(`(document.querySelector('#barra .barra-lista [data-id="temas"]') ? '#barra .barra-lista' : '#barra-mais') + ' [data-id="temas"]'`)
  console.log('botão de temas em', temaId)
  if (temaId.startsWith('#barra-mais')) await avaliar(`document.querySelector('[data-id="mais"]').click()`)
  await avaliar(`document.querySelector(${JSON.stringify(temaId)}).click()`)
  await esperar(300)
  const menuT = await avaliar(`(() => { const m = document.querySelector('.menu-temas'); if (!m) return null; const r = m.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight })()`)
  conferir('menu de temas dentro da janela', menuT, true)
  if (pasta) await foto(`${pasta}/moderna-lateral-temas.png`)
  await tecla('Escape')
  await avaliar(`document.body.click(); 1`)
  await esperar(200)
  // tooltips e ocultos
  conferir('botões da barra têm dica', await avaliar(`[...document.querySelectorAll('#barra .botao')].every((b) => b.title && b.getAttribute('aria-label'))`), true)
  // 1366x768 e 1920x1080
  for (const [w, hh] of [[1366, 768], [1920, 1080]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: hh, deviceScaleFactor: 1, mobile: false })
    await esperar(500)
    conferir(`lateral ${w}x${hh} sem cortes`, await medirLateral(), [])
    if (pasta) await foto(`${pasta}/moderna-lateral-${w}.png`)
    await avaliar(`document.querySelector('[data-id="mais"]').click()`)
    await esperar(300)
    conferir(`painel ⋯ ${w}x${hh} dentro da janela`, await dentro('#barra-mais'), true)
    await tecla('Escape')
  }
  await cdp('Emulation.clearDeviceMetricsOverride', {})
  // RTL (árabe)
  await gravar({ idioma: 'ar' })
  await recarregar()
  conferir('RTL: barra à direita do conteúdo', await avaliar(`document.documentElement.dir === 'rtl' && document.querySelector('#barra').getBoundingClientRect().left >= document.querySelector('main').getBoundingClientRect().right - 1`), true)
  conferir('RTL: sem problemas', await medirLateral(), [])
  await avaliar(`document.querySelector('[data-id="mais"]').click()`)
  await esperar(300)
  conferir('RTL: painel ⋯ dentro e ao lado', await avaliar(`(() => { const p = document.querySelector('#barra-mais').getBoundingClientRect(); const b = document.querySelector('#barra').getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth && p.right <= b.left + 1 })()`), true)
  await tecla('Escape')
  await gravar({ idioma: 'pt-BR' })
  await recarregar()
  // moderna -> clássica -> moderna com a barra lateral ligada
  await abrir('editor')
  await mudar('#cfg-disposicao', 'classica')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('clássica + lateral', [await disp(), await lateral(), await avaliar(`document.querySelector('[data-id="conta"]').parentElement.id`)], [null, true, 'barra'])
  await abrir('editor')
  await mudar('#cfg-disposicao', 'moderna')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('moderna + lateral de volta', await medirLateral(), [])
  // voltar para o topo restaura a faixa
  await abrir('barra')
  await mudar('#cfg-posicao-barra', 'topo')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('topo restaurado', [await lateral(), await avaliar(`!!document.querySelector('#faixa-abas [data-id="conta"]')`), await medir()], [false, true, []])

  // ---- volta à clássica pelas Configurações (o avatar volta à barra) -------------------------------------
  await abrir('editor')
  await mudar('#cfg-disposicao', 'classica')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('voltou à clássica', await disp(), null)
  conferir('faixa de guias escondida', await visivel('.faixa-abas'), false)
  conferir('cabeçalho escondido', await visivel('.cab-pagina'), false)
  conferir('avatar de volta à barra', await avaliar(`!!document.querySelector('#barra [data-id="conta"]')`), true)
  conferir('moldura do editor visível', await visivel('.moldura-editor'), true)
  await gravar({ tema: 'classico', disposicao: 'classica', consolePortugol: 'moderno' })
  await recarregar()
  conferir('clássica persiste', await disp(), null)
  console.log('Fumaça da disposição: tudo certo.')
}
