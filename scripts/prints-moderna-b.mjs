// Capturas da disposição moderna com um VETOR (ordena_vetor.alg) em F8: memória em caixinhas, "Passo N" e terminal com saída.
// Hibrido claro e Noite, em 1920x1080 e 1366x768 -> <pasta>/b-<tema>-<largura>.png (pasta = PRINTS_DISPOSICAO).
// Uso: electron app/out/main/index.js --remote-debugging-port=9350 (MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9350 scripts/prints-moderna-b.mjs

import { mkdirSync } from 'node:fs'

export default async ({ avaliar, esperar, foto, cdp }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS_DISPOSICAO ?? 'D:/temp/prints-disposicao'
  mkdirSync(pasta, { recursive: true })
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  await esperar(500)
  await avaliar(`window.misteralg.prefs.gravar({ disposicao: 'moderna' }).then(() => 1)`)
  for (const tema of ['hibrido-claro', 'noite']) {
    for (const [larg, alt] of [[1920, 1080], [1366, 768]]) {
      await avaliar(`${M}.comandos.tema('${tema}')`)
      await cdp('Emulation.setDeviceMetricsOverride', { width: larg, height: alt, deviceScaleFactor: 1, mobile: false })
      await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false; 1`)
      await avaliar(`[...document.querySelectorAll('.canais-lista')[1].querySelectorAll('.canal')].find(b => b.textContent === 'ordena_vetor.alg').click()`)
      await esperar(800)
      await avaliar(`${M}.doc.modificado = false; ${M}.editor.focar()`)
      for (let i = 0; i < 400; i += 1) {
        await avaliar(`void ${M}.comandos.passo()`)
        await esperar(60)
        if (await avaliar(`document.querySelector('#console-tela').textContent.includes('Ordenado:')`)) break
      }
      for (let i = 0; i < 4; i += 1) { await avaliar(`void ${M}.comandos.passo()`); await esperar(150) }
      await esperar(600)
      await foto(`${pasta}/b-${tema}-${larg}.png`)
      console.log(`b-${tema}-${larg}.png`, await avaliar(`document.querySelector('.cab-passo-texto')?.textContent`))
      await avaliar(`${M}.comandos.parar(); 1`)
      await esperar(400)
    }
  }
  await cdp('Emulation.clearDeviceMetricsOverride', {})
}
