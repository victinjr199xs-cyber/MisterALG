// Teste de fumaça da paleta de comandos (Ctrl+K): abre, filtra "tema", escolhe Noite, confere data-tema; abre de novo e Esc fecha.
// Uso: node scripts/cdp.mjs <porta> scripts/fumaca-paleta.mjs   (PRINTS_PALETA=<pasta> salva um print da paleta aberta)

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
  await avaliar(`window.misteralg.prefs.gravar({ tema: 'hibrido-escuro' }).then(() => document.documentElement.dataset.tema = 'hibrido-escuro')`)

  const aberta = () => avaliar(`!!document.querySelector('.paleta[role="dialog"]')`)
  const opcoes = () => avaliar(`document.querySelectorAll('.paleta [role="option"]').length`)
  const aguardarOpcoes = async () => { for (let i = 0; i < 30 && !(await opcoes()); i += 1) await esperar(100) }

  await tecla('k', ['Control'], 'KeyK')
  await esperar(300)
  conferir('Ctrl+K abre a paleta', await aberta(), true)
  await aguardarOpcoes()
  conferir('campo é combobox com foco', await avaliar(`document.activeElement.getAttribute('role') + '|' + document.activeElement.classList.contains('paleta-campo')`), 'combobox|true')
  conferir('lista tem aria-activedescendant válido', await avaliar(`!!document.getElementById(document.activeElement.getAttribute('aria-activedescendant'))`), true)
  const total = await opcoes()
  const pasta = process.env.PRINTS_PALETA
  if (pasta) { mkdirSync(pasta, { recursive: true }); await foto(`${pasta}/paleta-hibrido-escuro.png`) }

  await digitar('tema')
  await esperar(300)
  const filtradas = await opcoes()
  conferir('"tema" filtra a lista', filtradas > 0 && filtradas < total, true)
  conferir('todas as opções filtradas são temas', await avaliar(`[...document.querySelectorAll('.paleta [role="option"] .paleta-rotulo')].every((e) => /tema/i.test(e.textContent))`), true)

  await digitar(' noite')
  await esperar(300)
  conferir('busca sem acento/caixa acha Noite', await avaliar(`document.querySelector('.paleta [role="option"][aria-selected="true"] .paleta-rotulo')?.textContent.includes('Noite')`), true)
  await tecla('Enter')
  await esperar(600)
  conferir('Enter fecha a paleta', await aberta(), false)
  conferir('tema aplicado', await avaliar(`document.documentElement.dataset.tema`), 'noite')

  await tecla('k', ['Control'], 'KeyK')
  await esperar(300)
  conferir('abre de novo', await aberta(), true)
  await tecla('Tab')
  conferir('Tab não tira o foco do campo', await avaliar(`document.activeElement.classList.contains('paleta-campo')`), true)
  await tecla('Escape')
  await esperar(300)
  conferir('Esc fecha', await aberta(), false)

  await tecla('p', ['Control', 'Shift'], 'KeyP')
  await esperar(300)
  conferir('Ctrl+Shift+P também abre', await aberta(), true)
  await tecla('Escape')

  conferir('sem erros no console', erros, [])
}
