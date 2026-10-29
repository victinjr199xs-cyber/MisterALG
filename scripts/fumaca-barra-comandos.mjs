// Teste de fumaça do menu "/" do editor (Portugol): "/" numa linha vazia abre, "enq" filtra, Enter insere enquanto…fimenquanto,
// "a / b" no meio da linha não abre, Esc fecha e mantém a "/".
// Uso: node scripts/cdp.mjs <porta> scripts/fumaca-barra-comandos.mjs   (PRINTS_SLASH=<pasta> salva prints do menu aberto)

import { mkdirSync } from 'node:fs'

const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? 'ok' : 'FALHOU'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, tecla, digitar, foto, erros }) => {
  for (let i = 0; i < 40; i += 1) {
    if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break
    await esperar(500)
  }
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  await esperar(400)

  const pasta = process.env.PRINTS_SLASH
  if (pasta) mkdirSync(pasta, { recursive: true })
  const menu = () => avaliar(`!!document.querySelector('.barra-menu [role="option"]')`)
  const itens = () => avaliar(`document.querySelectorAll('.barra-menu [role="option"]').length`)
  const texto = () => avaliar(`document.querySelector('.cm-content').innerText`)
  const focar = () => avaliar(`document.querySelector('.cm-content').focus()`)

  // editor vazio, em Portugol
  await avaliar(`window.misteralg.prefs.gravar({ tema: 'hibrido-claro', menuBarra: true }).then(() => document.documentElement.dataset.tema = 'hibrido-claro')`)
  await focar()
  await tecla('a', ['Control'], 'KeyA')
  await tecla('Delete')
  await digitar('/')
  await esperar(300)
  conferir('"/" numa linha vazia abre o menu', await menu(), true)
  const total = await itens()
  conferir('Portugol traz os 12 blocos', total, 12)
  conferir('o conteúdo do editor ganhou a aria-activedescendant válida', await avaliar(`!!document.getElementById(document.querySelector('.cm-content').getAttribute('aria-activedescendant'))`), true)
  conferir('listbox + option', await avaliar(`document.querySelector('.barra-menu [role="listbox"] [role="option"][aria-selected="true"]') !== null`), true)
  if (pasta) await foto(`${pasta}/menu-hibrido-claro.png`)

  await digitar('enq')
  await esperar(300)
  conferir('"enq" filtra para 1 bloco', await itens(), 1)
  conferir('e é o enquanto', await avaliar(`document.querySelector('.barra-menu .barra-nome').textContent.startsWith('enquanto')`), true)
  await tecla('Enter')
  await esperar(300)
  conferir('Enter fecha o menu', await menu(), false)
  const apos = await texto()
  conferir('Enter insere enquanto…fimenquanto', /enquanto\s+faca\s+fimenquanto/.test(apos) && !apos.includes('/'), true)

  // divisão no meio da linha não abre
  await tecla('End', ['Control'], 'End')
  await tecla('Enter')
  await digitar('x <- a / b')
  await esperar(300)
  conferir('"a / b" no meio da linha não abre', await menu(), false)

  // Esc fecha e mantém a "/"
  await tecla('Enter')
  await digitar('/')
  await esperar(300)
  conferir('abre de novo em outra linha', await menu(), true)
  await tecla('Escape')
  await esperar(200)
  conferir('Esc fecha', await menu(), false)
  conferir('Esc mantém a "/" digitada', (await texto()).trimEnd().endsWith('/'), true)

  // noite: print com outro tema
  if (pasta) {
    await avaliar(`window.misteralg.prefs.gravar({ tema: 'noite' }).then(() => document.documentElement.dataset.tema = 'noite')`)
    await esperar(300)
    await focar()
    await tecla('Backspace')
    await digitar('/')
    await esperar(300)
    await foto(`${pasta}/menu-noite.png`)
    await tecla('Escape')
  }

  conferir('sem erros no console', erros, [])
}
