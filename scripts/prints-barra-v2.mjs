// Capturas da barra lateral em duas alturas: node scripts/cdp.mjs <porta> scripts/prints-barra-v2.mjs
export default async ({ avaliar, esperar, foto }) => {
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  if (process.env.LARG) await avaliar(`resizeTo(${process.env.LARG}, ${process.env.ALT})`)
  await esperar(500)
  await avaliar(`document.body.classList.add('barra-lateral')`)
  for (const [nome, tema] of [['classico', null], ['escuro', 'escuro']]) {
    if (tema) await avaliar(`void window.__misteralg.comandos?.tema?.('${tema}')`)
    await esperar(300)
    console.log(nome, await avaliar(`(() => { const l = document.querySelector('.barra-lista'); const a = document.querySelector('[data-id="conta"]').getBoundingClientRect(); return JSON.stringify({ rolagem: l.scrollHeight > l.clientHeight, listaFim: Math.round(l.getBoundingClientRect().bottom), avatarTopo: Math.round(a.top), viewport: innerHeight }) })()`))
    await foto(`D:/temp/prints-barra/v2-${nome}-${await avaliar('innerHeight')}.png`)
  }
}
