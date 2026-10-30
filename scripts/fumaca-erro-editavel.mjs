// Fumaça do aviso de erro editável: erro na linha 3 → diálogo com o campo editável → Corrigir e executar roda sem erro,
// Ctrl+Z restaura, "Corrigir" só troca a linha, Enter e Esc.
// Uso: electron app/out/main/index.js --remote-debugging-port=9358 (MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9358 scripts/fumaca-erro-editavel.mjs   (PRINTS_ERRO=<pasta> tira capturas)

import { mkdirSync } from 'node:fs'

const OK = (nome, v) => { console.log(`${v ? '✔' : '✖'} ${nome}`); if (!v) throw new Error(nome) }
const ERRADO = 'algoritmo "t"\nvar\n  x: inteirro\ninicio\n  x <- 5\n  escreval("x = ", x)\nfimalgoritmo\n'

export default async ({ avaliar, esperar, foto, tecla, cdp, digitar }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS_ERRO
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
  const dialogo = () => ate(`!!document.querySelector('dialog[open] .aviso-linha')`, 60)
  const semDialogo = () => ate(`!document.querySelector('dialog[open]')`, 40)
  const linha3 = () => avaliar(`${M}.editor.textoDaLinha(3)`)
  const botoes = () => avaliar(`[...document.querySelectorAll('dialog[open] .janela-acoes button')].map(b => [b.textContent, b.disabled])`)
  const clicar = (texto) => avaliar(`[...document.querySelectorAll('dialog[open] .janela-acoes button')].find(b => b.textContent === ${JSON.stringify(texto)}).click()`)
  const digitarNoCampo = async (texto) => {
    await avaliar(`document.querySelector('dialog[open] .aviso-linha').focus(); document.querySelector('dialog[open] .aviso-linha').select(); 1`)
    await digitar(texto)
  }
  const carregar = (t) => avaliar(`${M}.editor.definirTexto(${JSON.stringify(t)}); 1`)

  await pronta()
  // O console do Portugol no painel (o padrão é a janela do VisuAlg).
  await avaliar(`window.misteralg.prefs.gravar({ consolePortugol: 'moderno' }).then(() => 1)`)
  await cdp('Page.reload', {})
  await esperar(2500)
  await pronta()

  // ---- F9: erro na linha 3, campo editável ---------------------------------------------------------------------
  await carregar(ERRADO)
  await avaliar(`void ${M}.comandos.executar()`)
  OK('diálogo do aviso abriu', await dialogo())
  OK('aviso na linha 3', /na linha 3/.test(await avaliar(`document.querySelector('dialog[open] .janela-corpo').textContent`)))
  OK('campo editável, sem a indentação', await avaliar(`(() => { const c = document.querySelector('dialog[open] .aviso-linha'); return !c.readOnly && c.value === 'x: inteirro' })()`))
  OK('campo com foco e texto selecionado', await ate(`(() => { const c = document.querySelector('dialog[open] .aviso-linha'); return document.activeElement === c && c.selectionStart === 0 && c.selectionEnd === c.value.length })()`))
  OK('Corrigir e Corrigir e executar desabilitados enquanto igual', JSON.stringify(await botoes()) === JSON.stringify([['Terminar', false], ['Corrigir', true], ['Corrigir e executar', true]]))
  await digitarNoCampo('x: inteiro')
  OK('botões habilitam ao editar', JSON.stringify(await botoes()) === JSON.stringify([['Terminar', false], ['Corrigir', false], ['Corrigir e executar', false]]))
  if (pasta) {
    await avaliar(`${M}.comandos.tema('hibrido-claro'); 1`)
    await esperar(400)
    await foto(`${pasta}/erro-editavel-hibrido-claro.png`)
    await avaliar(`${M}.comandos.tema('hibrido-escuro'); 1`)
    await esperar(400)
    await foto(`${pasta}/erro-editavel-escuro.png`)
    await avaliar(`${M}.comandos.tema('hibrido-claro'); 1`)
  }
  // voltar ao texto original desabilita de novo
  await digitarNoCampo('x: inteirro')
  OK('igual ao original: desabilitados', (await botoes()).slice(1).every(([, d]) => d))
  await digitarNoCampo('x: inteiro')

  // ---- Enter = Corrigir e executar -----------------------------------------------------------------------------
  await tecla('Enter')
  OK('diálogo fechou', await semDialogo())
  OK('linha 3 trocada com a indentação original', await ate(`${M}.editor.textoDaLinha(3) === '  x: inteiro'`))
  OK('rodou de novo e sem erro', await ate(`document.querySelector('#console-tela').textContent.includes('x =  5') || document.querySelector('#console-tela').textContent.includes('x = 5')`, 60))
  await ate(`!${M}.execucao.emExecucao()`)
  OK('sem novo aviso', !(await avaliar(`!!document.querySelector('dialog[open]')`)))

  // ---- Ctrl+Z restaura numa única transação ------------------------------------------------------------------------
  await avaliar(`${M}.editor.focar(); 1`)
  await tecla('z', ['Control'])
  await esperar(300)
  OK('Ctrl+Z restaura a linha', (await linha3()) === '  x: inteirro')

  // ---- Corrigir: só troca a linha, sem executar ------------------------------------------------------------------------
  await avaliar(`void ${M}.comandos.executar()`)
  OK('novo aviso', await dialogo())
  await digitarNoCampo('x: inteiro')
  await clicar('Corrigir')
  OK('fechou', await semDialogo())
  await esperar(500)
  OK('linha trocada', (await linha3()) === '  x: inteiro')
  OK('não executou', !(await avaliar(`${M}.execucao.emExecucao()`)) && (await avaliar(`document.querySelector('#console-tela').textContent`)).includes('Dobro') === false)
  OK('cursor na linha 3', (await avaliar(`${M}.editor.linhaDoCursor()`)) === 3)
  await avaliar(`${M}.editor.focar(); 1`)
  await tecla('z', ['Control'])
  await esperar(300)
  OK('Ctrl+Z desfaz o Corrigir', (await linha3()) === '  x: inteirro')

  // ---- Esc = Terminar; Enter sem mudança = Terminar ----------------------------------------------------------------------
  await avaliar(`void ${M}.comandos.executar()`)
  OK('aviso (Esc)', await dialogo())
  await tecla('Escape')
  OK('Esc fecha sem mudar', await semDialogo() && (await linha3()) === '  x: inteirro')
  await avaliar(`void ${M}.comandos.executar()`)
  OK('aviso (Enter sem mudança)', await dialogo())
  await tecla('Enter')
  OK('Enter sem mudança termina', await semDialogo() && (await linha3()) === '  x: inteirro')

  // ---- passo a passo: "Corrigir e executar" roda de novo do mesmo jeito (F8) ----------------------------------------------
  await avaliar(`void ${M}.comandos.passo()`)
  OK('aviso (F8)', await dialogo())
  await digitarNoCampo('x: inteiro')
  await clicar('Corrigir e executar')
  OK('F8 de novo: pausou na primeira linha', await ate(`${M}.execucao.console.estado === 'pausado'`, 60))
  await avaliar(`${M}.execucao.parar(); 1`)
  console.log('Fumaça do aviso editável: tudo certo.')
}
