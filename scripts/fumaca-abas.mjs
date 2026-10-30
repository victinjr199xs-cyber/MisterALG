// Fumaça das guias (abas) de documentos da disposição moderna, no app de verdade.
// Precisa de MISTERALG_DADOS=<pasta vazia> e MISTERALG_DIALOGO_AUTO=1 (responde "Não" ao "Deseja salvá-lo?" e "Sim" ao recuperar,
// registrando os pedidos em window.__dialogosPedidos). Com PRINTS_ABAS=<pasta> também tira os prints.
// Uso: electron app/out/main/index.js --remote-debugging-port=9356   (ou MisterALG.exe empacotado)
//      node scripts/cdp.mjs 9356 scripts/fumaca-abas.mjs

import { mkdirSync } from 'node:fs'

function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, foto, cdp }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS_ABAS
  if (pasta) mkdirSync(pasta, { recursive: true })
  const pronta = async () => {
    for (let i = 0; i < 40; i += 1) {
      try {
        if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break
      } catch { /* recarregando */ }
      await esperar(500)
    }
    await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
    for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
    await esperar(500)
  }
  const ate = async (js, n = 40) => { for (let i = 0; i < n; i += 1) { if (await avaliar(js)) return true; await esperar(150) } return false }
  const nAbas = () => avaliar(`document.querySelectorAll('.aba-doc').length`)
  const siglas = () => avaliar(`[...document.querySelectorAll('.aba-doc .aba-sigla')].map(b => b.textContent).join(' ')`)
  const ativa = () => avaliar(`document.querySelector('.aba-doc[aria-selected="true"] .aba-sigla')?.textContent`)
  const doc = (campo) => avaliar(`${M}.doc.${campo}`)
  const novaAba = async (nome) => {
    await avaliar(`document.querySelector('.aba-nova').click()`)
    await avaliar(`[...document.querySelectorAll('.menu-nova-item')].find(b => b.querySelector('.menu-nova-nome').textContent === ${JSON.stringify(nome)}).click()`)
    await esperar(500)
  }
  const digitar = (texto) => avaliar(`${M}.editor.view.dispatch({ changes: { from: 0, insert: ${JSON.stringify(texto)} } }); 1`)
  const tecla = (key, extra = {}) => avaliar(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true, ...${JSON.stringify(extra)} })); 1`)
  const relogio = async () => {
    await avaliar(`document.querySelector('.aba-historico').click()`)
    await ate(`!!document.querySelector('#historico .historico-corpo section')`)
  }
  const itensRelogio = (secao) => avaliar(`[...document.querySelectorAll('#historico section')[${secao}].querySelectorAll('.historico-item')].map(b => b.querySelector('.historico-nome').textContent)`)
  const abrirDoRelogio = async (secao, nome) => {
    await relogio()
    await avaliar(`[...document.querySelectorAll('#historico section')[${secao}].querySelectorAll('.historico-item')].find(b => b.querySelector('.historico-nome').textContent === ${JSON.stringify(nome)}).click()`)
    await esperar(800)
  }
  const dialogos = () => avaliar(`(window.__dialogosPedidos ?? []).length`)

  await pronta()
  // O console do Portugol no painel (o padrão é a janela do VisuAlg): grava e recarrega.
  await avaliar(`window.misteralg.prefs.gravar({ consolePortugol: 'moderno' }).then(() => 1)`)
  await cdp('Page.reload', {})
  await esperar(2500)
  await pronta()
  conferir('moderna por padrão', await avaliar(`document.documentElement.dataset.disposicao`), 'moderna')
  conferir('começa com uma guia', await nAbas(), 1)
  conferir('sem trilho nem coluna de arquivos', await avaliar(`!document.querySelector('#trilho, #canais')`), true)

  // ---- "+" -> Python (reaproveita a guia vazia), "+" -> C (guia nova) -------------------------------
  await avaliar(`document.querySelector('.aba-nova').click()`)
  conferir('+ com aria-haspopup', await avaliar(`document.querySelector('.aba-nova').getAttribute('aria-haspopup')`), 'menu')
  conferir('menu aberto (aria-expanded)', await avaliar(`document.querySelector('.aba-nova').getAttribute('aria-expanded')`), 'true')
  conferir('role menu', await avaliar(`document.querySelector('.menu-nova').getAttribute('role')`), 'menu')
  conferir('9 linguagens com nome e extensão', await avaliar(`[...document.querySelectorAll('.menu-nova-item')].map(b => b.querySelector('.menu-nova-nome').textContent + b.querySelector('.menu-nova-ext').textContent).join(' ')`),
    'Portugol.alg C#.cs JavaScript.js TypeScript.ts Python.py C.c C++.cpp PHP.php SQL.sql')
  conferir('foco no menu', await avaliar(`document.activeElement.classList.contains('menu-nova-item')`), true)
  await tecla('ArrowDown')
  conferir('seta para baixo move o foco', await avaliar(`document.activeElement.querySelector('.menu-nova-nome').textContent`), 'C#')
  await tecla('Escape')
  conferir('Esc fecha o menu', await avaliar(`!document.querySelector('.menu-nova') && document.querySelector('.aba-nova').getAttribute('aria-expanded') === 'false'`), true)
  await avaliar(`document.querySelector('.aba-nova').click()`)
  await avaliar(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`)
  conferir('clique fora fecha o menu', await avaliar(`!document.querySelector('.menu-nova')`), true)
  await novaAba('Python')
  conferir('Python reaproveitou a guia vazia', [await nAbas(), await doc('linguagem')], [1, 'python'])
  await digitar('# aluno\n')
  conferir('modificado vira ●', await avaliar(`document.querySelector('.aba-doc').dataset.modificado`), 'true')
  await novaAba('C')
  conferir('C abriu outra guia', [await nAbas(), await siglas(), await doc('linguagem')], [2, 'Py C', 'c'])
  conferir('a guia nova está ativa', await ativa(), 'C')
  await digitar('/* aluno */\n')

  // ---- alternar com clique e Ctrl+Tab; cada guia guarda o seu texto ----------------------------------
  await avaliar(`document.querySelectorAll('.aba-doc')[0].click()`)
  await esperar(300)
  conferir('clique ativa Python', [await ativa(), await doc('linguagem'), await avaliar(`${M}.editor.texto().startsWith('# aluno')`)], ['Py', 'python', true])
  await tecla('Tab', { ctrlKey: true })
  await esperar(300)
  conferir('Ctrl+Tab vai para C', [await ativa(), await avaliar(`${M}.editor.texto().startsWith('/* aluno */')`)], ['C', true])
  await tecla('Tab', { ctrlKey: true })
  conferir('Ctrl+Tab dá a volta', await ativa(), 'Py')
  await tecla('Tab', { ctrlKey: true, shiftKey: true })
  conferir('Ctrl+Shift+Tab volta', await ativa(), 'C')
  conferir('título da janela / página acompanha', await avaliar(`document.querySelector('.cab-titulo').textContent`), 'semnome.c')
  conferir('aria da guia ativa', await avaliar(`(() => { const a = document.querySelector('.aba-doc[aria-selected="true"]'); return a.getAttribute('role') + ',' + a.getAttribute('aria-controls') + ',' + document.getElementById('editor-painel').getAttribute('role') })()`), 'tab,editor-painel,tabpanel')

  // ---- reordenar arrastando ------------------------------------------------------------------------------
  await avaliar(`(() => {
    const [a, b] = document.querySelectorAll('.aba-doc'); const dt = new DataTransfer()
    a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    b.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    b.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    return 1 })()`)
  await esperar(300)
  conferir('arrastar reordena', await siglas(), 'C Py')
  conferir('a ativa continua a mesma', await ativa(), 'C')

  // ---- fechar guia modificada pergunta ------------------------------------------------------------------
  const antes = await dialogos()
  await avaliar(`document.querySelector('.aba-doc[aria-selected="true"] .aba-x').click()`) // fecha C
  await ate(`document.querySelectorAll('.aba-doc').length === 1`)
  conferir('fechar guia modificada pediu o diálogo', (await dialogos()) - antes, 1)
  conferir('sobra a Python, ativa', [await siglas(), await ativa()], ['Py', 'Py'])
  conferir('texto da Python intacto', await avaliar(`${M}.editor.texto().startsWith('# aluno')`), true)

  // ---- exemplo duas vezes ativa a mesma guia; recentes/exemplos pelo relógio ------------------------------
  await avaliar(`${M}.doc.modificado = false; 1`)
  await relogio()
  conferir('relógio: botão com aria', await avaliar(`['aria-haspopup', 'aria-expanded'].map(a => document.querySelector('.aba-historico').getAttribute(a)).join()`), 'dialog,true')
  const exemplos = await itensRelogio(1)
  console.log('exemplos do Python:', exemplos.join(', '))
  conferir('exemplos da linguagem da guia ativa', exemplos.length >= 1, true)
  await tecla('Escape')
  await abrirDoRelogio(1, exemplos[0])
  const n1 = await nAbas()
  conferir('exemplo abriu', await doc('nome'), exemplos[0].replace(/\.[^.]+$/, ''))
  await abrirDoRelogio(1, exemplos[0])
  conferir('abrir de novo só ativa a mesma guia', await nAbas(), n1)

  // ---- F9 numa guia e tentativa de trocar durante a execução ----------------------------------------------
  await novaAba('Portugol')
  await avaliar(`${M}.editor.definirTexto('algoritmo "e"\\nvar\\n  x: inteiro\\ninicio\\n  leia(x)\\nfimalgoritmo\\n'); 1`)
  const nAntes = await nAbas()
  await avaliar(`void ${M}.comandos.executar()`)
  await ate(`${M}.execucao.emExecucao()`)
  conferir('programa esperando entrada', await avaliar(`${M}.execucao.emExecucao()`), true)
  await avaliar(`document.querySelectorAll('.aba-doc')[0].click()`)
  await esperar(300)
  conferir('trocar de guia é bloqueado', await ativa(), 'Pt')
  conferir('aviso na barra de status', await avaliar(`document.querySelector('#st-mensagem').textContent`), ' MENSAGEM: Pare o programa antes de trocar de aba')
  await tecla('Tab', { ctrlKey: true })
  conferir('Ctrl+Tab também', await ativa(), 'Pt')
  const dlg = await dialogos()
  await avaliar(`document.querySelector('.aba-doc[aria-selected="true"] .aba-x').click()`)
  await esperar(300)
  conferir('fechar durante a execução é bloqueado', [await nAbas(), (await dialogos()) - dlg], [nAntes, 0])
  await avaliar(`${M}.comandos.parar(); 1`)
  await ate(`!${M}.execucao.emExecucao()`)
  await avaliar(`document.querySelectorAll('.aba-doc')[0].click()`)
  await esperar(300)
  conferir('parou: trocar volta a valer', await ativa(), 'Py')

  // ---- paleta: comandos de guias ---------------------------------------------------------------------------
  await avaliar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`)
  await ate(`document.querySelectorAll('.paleta-item').length > 0`)
  await avaliar(`(() => { const c = document.querySelector('.paleta-campo'); c.value = 'aba'; c.dispatchEvent(new Event('input')); return 1 })()`)
  const itensPaleta = await avaliar(`[...document.querySelectorAll('.paleta-item .paleta-rotulo')].map(e => e.textContent)`)
  console.log('paleta (aba):', itensPaleta.join(' | '))
  conferir('paleta: Nova aba, Fechar aba e Aba: …', ['Nova aba', 'Fechar aba'].every((x) => itensPaleta.includes(x)) && itensPaleta.some((x) => x.startsWith('Aba: ')), true)
  await avaliar(`document.querySelector('.paleta-campo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`)

  // ---- Ctrl+W (Fechar aba) até a última: nasce uma vazia ---------------------------------------------------
  for (let i = 0; i < 12 && (await nAbas()) > 1; i += 1) { await avaliar(`void ${M}.comandos['fechar-aba']()`); await esperar(350) }
  conferir('só uma guia', await nAbas(), 1)
  await avaliar(`void ${M}.comandos['fechar-aba']()`)
  await esperar(500)
  conferir('fechar a última deixa uma guia nova vazia', [await nAbas(), await avaliar(`${M}.doc.modificado`), await avaliar(`${M}.doc.caminho`)], [1, false, null])

  // ---- prints (3 guias: Portugol modificado, Python, C) ---------------------------------------------------
  if (pasta) {
    await avaliar(`${M}.comandos.tema('hibrido-claro').then(() => 1)`)
    await avaliar(`${M}.editor.definirTexto('algoritmo "soma"\\nvar\\n  a, b: inteiro\\ninicio\\n  a <- 2\\n  b <- a + 3\\n  escreval(b)\\nfimalgoritmo\\n'); 1`)
    await digitar('// aula 1\n')
    await novaAba('Python')
    await avaliar(`${M}.editor.definirTexto('nome = input("Nome: ")\\nprint("Olá,", nome)\\n'); 1`)
    await novaAba('C')
    await avaliar(`${M}.editor.definirTexto('#include <stdio.h>\\n\\nint main(void) {\\n    printf("Oi!\\\\n");\\n    return 0;\\n}\\n'); 1`)
    await avaliar(`document.querySelectorAll('.aba-doc')[1].click()`)
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false })
    await esperar(600)
    for (const tema of ['hibrido-claro', 'escuro']) {
      await avaliar(`${M}.comandos.tema('${tema}').then(() => 1)`)
      await avaliar(`document.querySelectorAll('.aba-doc')[${tema === 'escuro' ? 1 : 0}].click()`) // as linguagens de código usam a IDE escura; o Portugol mostra o tema claro
      await esperar(300)
      await esperar(400)
      await foto(`${pasta}/abas-${tema}.png`)
      await avaliar(`document.querySelector('.aba-nova').click()`)
      await esperar(300)
      await foto(`${pasta}/abas-${tema}-mais.png`)
      await tecla('Escape')
      if (tema === 'hibrido-claro') {
        await relogio()
        await esperar(300)
        await foto(`${pasta}/abas-relogio.png`)
        await tecla('Escape')
      }
    }
    await avaliar(`${M}.comandos.tema('hibrido-claro').then(() => 1)`)
    await cdp('Emulation.clearDeviceMetricsOverride', {})
  }

  // ---- recuperação após queda: duas guias modificadas ---------------------------------------------------
  if (!pasta) {
    await novaAba('Python')
    await avaliar(`${M}.editor.definirTexto('print("um")'); 1`)
    await digitar('# 1\n')
    await novaAba('C')
    await digitar('/* 2 */\n')
  }
  await avaliar(`${M}.gravarRecuperacao(); 1`)
  const salvo = await avaliar(`window.misteralg.recuperacao.ler()`)
  conferir('arquivo de recuperação: várias guias', [salvo.abas.length >= 2, salvo.abas.every((a) => a.texto && a.linguagem && 'caminho' in a)], [true, true])
  const total = salvo.abas.length
  await cdp('Page.reload', {})
  await esperar(2500)
  await pronta()
  await ate(`${M}.abas.length === ${total}`, 40)
  conferir('recuperou todas as guias', await avaliar(`${M}.abas.length`), total)
  conferir('recuperadas aparecem como modificadas', await avaliar(`${M}.abas.every((a) => a.modificado || a === ${M}.abaAtiva && ${M}.doc.modificado)`), true)
  const textos = await avaliar(`${M}.abas.map((a) => a === ${M}.abaAtiva ? ${M}.editor.texto() : a.estado.doc.toString())`)
  conferir('texto recuperado', salvo.abas.map((a) => a.texto).every((x) => textos.includes(x)), true)

  // ---- formato antigo de recuperação (um documento só) ---------------------------------------------------
  await avaliar(`window.misteralg.recuperacao.gravar({ texto: 'print("antigo")', caminho: null, nome: 'semnome', codificacao: 'utf-8', linguagem: 'python' }).then(() => 1)`)
  await cdp('Page.reload', {})
  await esperar(2500)
  await pronta()
  await ate(`${M}.editor.texto().includes('antigo')`, 40)
  conferir('formato antigo ainda é recuperado', [await avaliar(`${M}.editor.texto()`), await doc('linguagem'), await nAbas()], ['print("antigo")', 'python', 1])

  // ---- clássica: sem faixa; Novo/Abrir substituem o documento -----------------------------------------------
  await avaliar(`window.misteralg.prefs.gravar({ disposicao: 'classica', consolePortugol: 'moderno' }).then(() => 1)`)
  await esperar(1000)
  await cdp('Page.reload', {})
  await esperar(2500)
  await pronta()
  await ate(`!!document.querySelector('#editor')`)
  conferir('clássica: sem faixa de guias', await avaliar(`!document.querySelector('.faixa-abas')`), true)
  await digitar('x\n')
  const d0 = await dialogos()
  await avaliar(`${M}.comandos.novo('c').then(() => 1)`)
  conferir('clássica: Novo pergunta e substitui o documento', [(await dialogos()) - d0,await doc('linguagem'), await avaliar(`${M}.abas.length`)], [1, 'c', 1])
  console.log('Fumaça das guias: tudo certo.')
}
