// Teste de fumaça da disposição moderna (Configurações > Editor > Disposição da tela) no app de verdade:
// prévia/Cancelar/OK, trilho de linguagens, recentes e exemplos, cabeçalho da página, abas Terminal/Problemas,
// memória, divisor, coluna que recolhe em janela estreita, nada com tamanho zero e a volta à clássica.
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
  const recarregar = async () => { await avaliar('location.reload(); 1'); await esperar(1500); await pronta() }
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
  const doc = (campo) => avaliar(`${M}.doc.${campo}`)

  await pronta()
  // Quem instala agora começa na disposição moderna com o tema Híbrido claro (pasta de dados nova = sem preferências gravadas).
  conferir('padrão novo: disposição moderna', await disp(), 'moderna')
  conferir('padrão novo: tema Híbrido claro', await avaliar(`document.documentElement.dataset.tema`), 'hibrido-claro')
  conferir('padrão novo: trilho visível', await visivel('#trilho'), true)
  await classico() // o resto da fumaça parte do visual clássico, como antes
  await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false; ${M}.comandos.tema('hibrido-claro')`)

  // ---- clássica por padrão: nada da moderna aparece -------------------------------------------
  conferir('começa na clássica', await disp(), null)
  conferir('sem trilho na clássica', await avaliar(`!document.querySelector('.trilho')`), true)
  conferir('avatar na barra (clássica)', await avaliar(`!!document.querySelector('#barra [data-id="conta"]')`), true)

  // ---- prévia, Cancelar e OK nas Configurações ----------------------------------------------------
  await abrir('editor')
  await mudar('#cfg-disposicao', 'moderna')
  conferir('prévia moderna', await disp(), 'moderna')
  conferir('trilho visível na prévia', await visivel('#trilho'), true)
  await botaoDoDialogo('Cancelar')
  await fechado()
  conferir('Cancelar volta à clássica', await disp(), null)
  conferir('trilho some', await visivel('#trilho'), false)
  conferir('avatar voltou à barra', await avaliar(`!!document.querySelector('#barra [data-id="conta"]')`), true)
  conferir('nada gravado ao cancelar', await avaliar(`window.misteralg.prefs.ler().then(p => p.disposicao)`), 'classica')
  await abrir('editor')
  await mudar('#cfg-disposicao', 'moderna')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('OK grava moderna', await avaliar(`window.misteralg.prefs.ler().then(p => p.disposicao)`), 'moderna')
  await recarregar()
  conferir('moderna persiste', await disp(), 'moderna')

  // ---- trilho de linguagens --------------------------------------------------------------------------
  conferir('uma linguagem por botão', await avaliar(`[...document.querySelectorAll('.trilho-lang')].map(b => b.dataset.lang)`), LINGUAGENS)
  conferir('botões com aria-label', await avaliar(`[...document.querySelectorAll('.trilho-lang')].every(b => b.getAttribute('aria-label'))`), true)
  conferir('portugol marcado', await avaliar(`document.querySelector('.trilho-lang[aria-current="true"]')?.dataset.lang`), 'portugol')
  conferir('avatar no trilho', await avaliar(`!!document.querySelector('.trilho [data-id="conta"]')`), true)
  conferir('barra no topo (sem lateral)', await avaliar(`!document.body.classList.contains('barra-lateral')`), true)
  await avaliar(`document.querySelector('.trilho-lang[data-lang="python"]').click()`)
  await esperar(500)
  conferir('clicar em Python cria documento Python', await doc('linguagem'), 'python')
  conferir('pílula acompanha', await avaliar(`document.querySelector('.trilho-lang[aria-current="true"]')?.dataset.lang`), 'python')
  conferir('título da página', await q('.cab-titulo', 'e.textContent'), 'semnome.py')
  conferir('propriedade Linguagem', await q('.cab-prop b', 'e.textContent'), 'Python')
  await avaliar(`document.querySelector('.trilho-lang[data-lang="portugol"]').click()`)
  await esperar(500)
  conferir('volta ao Portugol', await doc('linguagem'), 'portugol')
  // se há texto modificado o fluxo normal pergunta antes de descartar (diálogo nativo): o teste não deixa modificado
  conferir('estado Salvo', await avaliar(`document.querySelectorAll('.cab-prop b')[1].textContent`), 'Salvo')
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)}); ${M}.doc.modificado = false; 1`)

  // ---- exemplos e recentes ------------------------------------------------------------------------
  const exemplos = await avaliar(`[...document.querySelectorAll('.canais-lista')[1].querySelectorAll('.canal')].map(b => b.textContent)`)
  console.log('exemplos do Portugol:', exemplos.join(', '))
  conferir('exemplos listados', exemplos.length >= 5, true)
  conferir('recentes vazios no começo', await avaliar(`document.querySelectorAll('.canais-lista')[0].querySelectorAll('.canal').length`), 0)
  await avaliar(`[...document.querySelectorAll('.canais-lista')[1].querySelectorAll('.canal')].find(b => b.textContent === 'media_notas.alg').click()`)
  await esperar(800)
  conferir('exemplo abriu', await doc('nome'), 'media_notas')
  conferir('título mostra o exemplo', await q('.cab-titulo', 'e.textContent'), 'media_notas.alg')
  conferir('exemplo atual destacado', await avaliar(`document.querySelectorAll('.canais-lista')[1].querySelector('.canal[aria-current="true"]')?.textContent`), 'media_notas.alg')
  conferir('editor tem o exemplo', await avaliar(`${M}.editor.texto().includes('media')`), true)
  // recente: abre um arquivo de verdade pelo fluxo normal (o mesmo do menu Arquivo)
  const arquivo = (await import('node:path')).resolve('exemplos/tabuada.alg')
  await avaliar(`${M}.comandos['abrir-recente'](${JSON.stringify(arquivo)})`)
  await esperar(1000)
  conferir('recente listado', await avaliar(`[...document.querySelectorAll('.canais-lista')[0].querySelectorAll('.canal')].map(b => b.textContent)`), ['tabuada.alg'])
  conferir('recente atual destacado', await avaliar(`document.querySelector('.canais-lista .canal[aria-current="true"]')?.textContent`), 'tabuada.alg')
  await avaliar(`[...document.querySelectorAll('.canais-lista')[1].querySelectorAll('.canal')].find(b => b.textContent === 'media_notas.alg').click()`)
  await esperar(800)

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
  await avaliar(`${M}.execucao.restaurar(); ${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)}); ${M}.doc.modificado = false; document.querySelector('#aba-terminal').click(); 1`)

  // ---- divisor (teclado) salva a altura ---------------------------------------------------------------
  const alt0 = await q('.moldura-visualizacao', 'e.getBoundingClientRect().height')
  await avaliar(`document.querySelector('#divisor').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))`)
  await esperar(600)
  const alt1 = await q('.moldura-visualizacao', 'e.getBoundingClientRect().height')
  conferir('divisor aumenta o painel', alt1 > alt0, true)
  conferir('altura gravada nas prefs', await avaliar(`window.misteralg.prefs.ler().then(p => p.alturaPainel > 0)`), true)

  // ---- coluna de arquivos: botão e recolhimento automático -------------------------------------------
  conferir('canais abertos', await visivel('#canais'), true)
  await avaliar(`document.querySelector('.cab-alternar').click()`)
  conferir('botão recolhe', await visivel('#canais'), false)
  conferir('aria-expanded', await q('.cab-alternar', 'e.getAttribute("aria-expanded")'), 'false')
  await avaliar(`document.querySelector('.cab-alternar').click()`)
  conferir('botão reabre', await visivel('#canais'), true)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1200, height: 700, deviceScaleFactor: 1, mobile: false })
  await esperar(500)
  conferir('abaixo de 1280px recolhe sozinha', await visivel('#canais'), false)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false })
  await esperar(500)
  conferir('em 1366 a coluna volta', await visivel('#canais'), true)

  // ---- nada cortado nem com tamanho zero (1366x768) --------------------------------------------------
  const medir = () => avaliar(`(() => {
    const ruins = []
    for (const s of ['.trilho', '.trilho-lang', '.barra', '#canais', '#cab-pagina', '.moldura-editor', '#divisor', '#abas-inferior', '.moldura-visualizacao', '.moldura-variaveis', '.status']) {
      const e = document.querySelector(s); if (!e) { ruins.push(s + ' ausente'); continue }
      const r = e.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) ruins.push(s + ' zero ' + Math.round(r.width) + 'x' + Math.round(r.height))
      if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) ruins.push(s + ' fora da janela')
    }
    const lista = document.querySelector('.trilho-lista'); const ult = document.querySelector('.trilho-lang[data-lang="sql"]')
    if (lista.scrollHeight > lista.clientHeight + 1) ruins.push('trilho rola (cabe?)')
    if (document.documentElement.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight + 1) ruins.push('página rola')
    const ed = document.querySelector('.moldura-editor').getBoundingClientRect()
    if (ed.height < 150) ruins.push('editor baixo demais: ' + Math.round(ed.height))
    return ruins
  })()`)
  conferir('1366x768 sem cortes', await medir(), [])

  if (pasta) {
    await avaliar(`${M}.execucao.restaurar(); 1`)
    await avaliar(`[...document.querySelectorAll('.canais-lista')[1].querySelectorAll('.canal')].find(b => b.textContent === 'media_notas.alg').click()`)
    await esperar(800)
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

  // ---- volta à clássica pelas Configurações (o avatar volta à barra) -------------------------------------
  await abrir('editor')
  await mudar('#cfg-disposicao', 'classica')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('voltou à clássica', await disp(), null)
  conferir('trilho escondido', await visivel('.trilho'), false)
  conferir('cabeçalho escondido', await visivel('.cab-pagina'), false)
  conferir('avatar de volta à barra', await avaliar(`!!document.querySelector('#barra [data-id="conta"]')`), true)
  conferir('moldura do editor visível', await visivel('.moldura-editor'), true)
  await gravar({ tema: 'classico', disposicao: 'classica' })
  await recarregar()
  conferir('clássica persiste', await disp(), null)
  console.log('Fumaça da disposição: tudo certo.')
}
