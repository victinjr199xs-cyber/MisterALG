// Fumaça da tela inicial: abre a página inicial em cada tema, confere os elementos e tira prints (PRINTS_INICIO=<pasta>).
// Uso: node scripts/cdp.mjs <porta> scripts/fumaca-inicio.mjs

import { mkdirSync } from 'node:fs'

const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? 'ok' : 'FALHOU'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, foto, erros }) => {
  for (let i = 0; i < 40; i += 1) {
    if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break
    await esperar(500)
  }
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  const pasta = process.env.PRINTS_INICIO
  if (pasta) mkdirSync(pasta, { recursive: true })
  for (const tema of ['hibrido-claro', 'noite', 'papel', 'classico']) {
    await avaliar(`window.misteralg.prefs.gravar({ tema: '${tema}', mru: ['C:\\\\x\\\\media_notas.alg', 'C:\\\\x\\\\ola.py'] }).then(() => window.misteralg.janela.pagina({ pagina: 'inicio' })).then(() => 1)`)
    for (let i = 0; i < 40 && !(await avaliar(`!!document.querySelector('.tela-inicial .inicio-linguagem')`)); i += 1) await esperar(250)
    await esperar(1200)
    conferir(`${tema}: tema aplicado`, await avaliar('document.documentElement.dataset.tema'), tema)
    conferir(`${tema}: 9 cartões de linguagem`, await avaliar(`document.querySelectorAll('.inicio-linguagem').length`), 9)
    conferir(`${tema}: recentes`, await avaliar(`document.querySelectorAll('.inicio-link').length`), 2)
    conferir(`${tema}: opções do rodapé`, await avaliar(`document.querySelectorAll('.inicio-opcao input').length`), 3)
    if (pasta) await foto(`${pasta}/inicio-${tema}.png`)
  }
  conferir('sem erros no console', erros, [])
}
