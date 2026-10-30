// Teste de fumaça do Assistente de IA em pop-up e da memória em grade (estilo VisuAlg), no app de verdade.
// Com PRINTS_IA=<pasta> também tira as capturas (hibrido-claro, terminal e classico).
// Uso: electron app/out/main/index.js --remote-debugging-port=9364 (MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9364 scripts/fumaca-assistente-memoria.mjs

import { mkdirSync } from 'node:fs'

function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}
const PROGRAMA = 'algoritmo "t"\nvar\n  n: inteiro\n  v: vetor[1..5] de inteiro\n  m: vetor[1..2,1..3] de inteiro\n  i: inteiro\ninicio\n  n <- 5\n  para i de 1 ate 3 faca\n    v[i] <- i * 10\n    m[1,i] <- i\n  fimpara\n  escreval(v[1])\nfimalgoritmo\n'

export default async ({ avaliar, esperar, foto, tecla, cdp }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS_IA
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
  const tema = async (p) => {
    await avaliar(`window.misteralg.prefs.gravar(${JSON.stringify(p)}).then(() => 1)`)
    await esperar(800)
    await cdp('Page.reload', {})
    await esperar(2500)
    await pronta()
  }
  const popup = () => avaliar(`(() => { const e = document.querySelector('.assistente-popup'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, W: innerWidth, H: innerHeight, foco: e.contains(document.activeElement), fundo: !!document.querySelector('dialog[open]') } })()`)

  async function rodada(nome, prefs, verificar) {
    await tema(prefs)
    // ---- assistente em pop-up ----
    await avaliar(`void ${M}.comandos.assistente()`)
    await esperar(600)
    const p = await popup()
    conferir(`${nome}: pop-up aberto`, !!p, true)
    conferir(`${nome}: canto inferior direito`, p.x + p.w / 2 > p.W / 2 && p.y + p.h / 2 > p.H / 2, true)
    conferir(`${nome}: não cobre a janela toda`, p.w < p.W * 0.6 && p.h < p.H * 0.9, true)
    conferir(`${nome}: cabe na janela`, p.x >= 0 && p.y >= 0 && p.x + p.w <= p.W + 1 && p.y + p.h <= p.H + 1, true)
    conferir(`${nome}: foco dentro do pop-up`, p.foco, true)
    conferir(`${nome}: sem diálogo modal`, p.fundo, false)
    if (pasta) await foto(`${pasta}/assistente-${nome}.png`)
    // maximizar e restaurar
    await avaliar(`document.querySelector('.assistente-popup .assistente-topo-botao[aria-label="Maximizar"]').click()`)
    await esperar(200)
    const g = await popup()
    conferir(`${nome}: maximizado ~80%`, Math.abs(g.w / g.W - 0.8) < 0.03, true)
    await avaliar(`document.querySelector('.assistente-popup .assistente-topo-botao[aria-label="Restaurar"]').click()`)
    await esperar(200)
    conferir(`${nome}: restaurado`, Math.round((await popup()).w), Math.round(p.w))
    await tecla('Escape')
    await esperar(300)
    conferir(`${nome}: Esc fecha`, await popup(), null)

    // ---- memória em grade ----
    await avaliar(`${M}.execucao.restaurar(); ${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)}); ${M}.doc.modificado = false; ${M}.editor.focar(); 1`)
    conferir(`${nome}: estado vazio`, await avaliar(`document.querySelectorAll('#variaveis tbody tr.memoria-vazia').length`), 1)
    for (let i = 0; i < 9; i += 1) { await avaliar(`void ${M}.comandos.passo()`); await esperar(450) }
    const bordas = await avaliar(`[...document.querySelectorAll('#variaveis th, #variaveis tbody tr:not(.memoria-vazia) td')].filter(c => parseFloat(getComputedStyle(c).borderTopWidth) > 0 && parseFloat(getComputedStyle(c).borderLeftWidth) > 0).length`)
    const total = await avaliar(`document.querySelectorAll('#variaveis th, #variaveis tbody tr:not(.memoria-vazia) td').length`)
    conferir(`${nome}: todas as células com borda`, bordas === total && total > 4, true)
    conferir(`${nome}: linha modificada marcada`, await avaliar(`document.querySelectorAll('#variaveis tr.modificada, #variaveis .caixa.mudou, #variaveis td.mudou').length >= 1`), true)
    verificar && (await verificar())
    if (pasta) await foto(`${pasta}/memoria-${nome}.png`)
    await avaliar(`${M}.comandos.parar()`)
  }

  await pronta()
  const celulas = async () => {
    conferir('células do vetor', await avaliar(`document.querySelectorAll('#variaveis .caixa').length >= 3`), true)
    conferir('células da matriz', await avaliar(`document.querySelectorAll('#variaveis table.matriz td').length`), 6)
  }
  await rodada('hibrido-claro', { tema: 'hibrido-claro', disposicao: 'moderna' }, celulas)
  await rodada('terminal', { tema: 'terminal', disposicao: 'moderna' }, celulas)
  await rodada('classico', { tema: 'classico', disposicao: 'classica', consolePortugol: 'moderno' }, null)
  await tema({ tema: 'hibrido-claro', disposicao: 'moderna' })
}
