// Capturas da disposição moderna com a barra lateral (híbrido claro e terminal, 1920x1080 e 1366x768, 3 abas).
// Uso: node scripts/cdp.mjs <porta> scripts/prints-barra-moderna.mjs   (PRINTS=<pasta>, padrão D:/temp/prints-barra-moderna)
import { mkdirSync } from 'node:fs'

export default async ({ avaliar, esperar, foto, tecla, cdp }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS ?? 'D:/temp/prints-barra-moderna'
  mkdirSync(pasta, { recursive: true })
  for (let i = 0; i < 40; i += 1) {
    if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break
    await esperar(500)
  }
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  await avaliar(`window.misteralg.prefs.gravar({ posicaoBarra: 'lateral', conta: { nome: 'Maria da Silva' } }).then(() => 1)`)
  await cdp('Page.reload', {})
  await esperar(3000)
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  for (const n of [4, 1, 0]) { // Python, C# e Portugol (ativa: o tema escolhido aparece inteiro; as de código usam o modo escuro): 3 guias
    await avaliar(`document.querySelector('.aba-nova').click()`)
    await esperar(300)
    await avaliar(`document.querySelectorAll('.menu-nova-item')[${n}].click()`)
    await esperar(500)
    await avaliar(`${M}.editor.definirTexto('x = 1'); ${M}.doc.modificado = false; 1`) // não é mais o esqueleto: a próxima guia é nova
  }
  for (const tema of ['hibrido-claro', 'terminal']) {
    await avaliar(`${M}.comandos.tema('${tema}')`)
    await esperar(800)
    console.log('tema', tema, '->', await avaliar(`document.documentElement.dataset.tema`))
    for (const [w, h] of [[1920, 1080], [1366, 768]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
      await esperar(600)
      await foto(`${pasta}/${tema}-${w}.png`)
      if (w === 1366) {
        await avaliar(`document.querySelector('[data-id="mais"]').click()`)
        await esperar(400)
        await foto(`${pasta}/${tema}-${w}-painel.png`)
        await tecla('Escape')
      } else {
        await avaliar(`document.querySelector('[data-id="temas"]').click()`)
        await esperar(400)
        await foto(`${pasta}/${tema}-${w}-temas.png`)
        await tecla('Escape')
        await avaliar(`document.body.click(); 1`)
      }
    }
  }
  await cdp('Emulation.clearDeviceMetricsOverride', {})
  console.log('prints prontos')
}
