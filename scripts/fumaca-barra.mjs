// Teste de fumaça da barra de ferramentas e da conta (Configurações > Barra / Conta) no app de verdade:
// trocar para lateral e voltar, Cancelar desfaz a prévia, ocultar um botão (e o essencial que não sai),
// nome da conta virando iniciais no avatar. Tira capturas da barra no topo e na lateral, em um tema claro
// e em um escuro, em PRINTS_BARRA (padrão D:/temp/prints-barra).
// Uso: electron app/out/main/index.js --remote-debugging-port=9335  (com MISTERALG_DADOS=<pasta vazia>)
//      node scripts/cdp.mjs 9335 scripts/fumaca-barra.mjs

import { mkdirSync } from 'node:fs'

function conferir(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, foto }) => {
  const M = 'window.__misteralg'
  const pasta = process.env.PRINTS_BARRA ?? 'D:/temp/prints-barra'
  mkdirSync(pasta, { recursive: true })

  for (let i = 0; i < 40; i += 1) {
    if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break
    await esperar(500)
  }
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)

  const visivel = (id) => avaliar(`(() => { const r = document.querySelector('[data-id="${id}"]').getBoundingClientRect(); return r.width > 0 && r.height > 0 })()`)
  const lateral = () => avaliar(`document.body.classList.contains('barra-lateral')`)
  const abrir = async (aba) => {
    await avaliar(`void ${M}.comandos.configuracoes('${aba}')`)
    for (let i = 0; i < 20 && !(await avaliar(`!!document.querySelector('dialog[open] .abas')`)); i += 1) await esperar(100)
  }
  const botaoDoDialogo = (texto) => avaliar(`[...document.querySelectorAll('dialog[open] .janela-acoes button')].find(b => b.textContent === ${JSON.stringify(texto)}).click()`)
  const mudar = (seletor, valor) => avaliar(`(() => { const e = document.querySelector('dialog[open] ${seletor}'); e.value = ${JSON.stringify(valor)}; e.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  const prefs = (campo) => avaliar(`window.misteralg.prefs.ler().then(p => p.${campo})`)
  const fechado = async () => { for (let i = 0; i < 20 && (await avaliar(`!!document.querySelector('#dialogos dialog')`)); i += 1) await esperar(100) }

  // padrão: topo, como sempre foi
  conferir('começa no topo', await lateral(), false)
  conferir('aria-orientation horizontal', await avaliar(`document.querySelector('#barra').getAttribute('aria-orientation')`), 'horizontal')
  conferir('executar visível', await visivel('executar'), true)
  conferir('avatar na barra', await avaliar(`!!document.querySelector('#barra [data-id="conta"] .avatar-disco svg')`), true)
  await foto(`${pasta}/classico-topo.png`)

  // lateral: a prévia aparece na hora; Cancelar desfaz
  await abrir('barra')
  await mudar('#cfg-posicao-barra', 'lateral')
  conferir('prévia lateral', await lateral(), true)
  await botaoDoDialogo('Cancelar')
  await fechado()
  conferir('Cancelar volta ao topo', await lateral(), false)
  conferir('nada gravado ao cancelar', await prefs('posicaoBarra'), 'topo')

  // lateral de verdade
  await abrir('barra')
  await mudar('#cfg-posicao-barra', 'lateral')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('lateral aplicada', await lateral(), true)
  conferir('lateral gravada', await prefs('posicaoBarra'), 'lateral')
  conferir('aria-orientation vertical', await avaliar(`document.querySelector('#barra').getAttribute('aria-orientation')`), 'vertical')
  conferir('executar visível na lateral', await visivel('executar'), true)
  conferir('barra à esquerda e main à direita', await avaliar(`document.querySelector('#barra').getBoundingClientRect().right <= document.querySelector('main').getBoundingClientRect().left + 1`), true)
  conferir('campos do timer escondidos na lateral', await avaliar(`getComputedStyle(document.querySelector('.campo-barra')).display`), 'none')
  await foto(`${pasta}/classico-lateral.png`)

  // ocultar um botão (copiar) com a barra lateral; o essencial (executar) não pode sair
  await abrir('barra')
  conferir('essencial desabilitado', await avaliar(`document.querySelector('dialog[open] input[data-botao="executar"]').disabled`), true)
  await avaliar(`(() => { const c = document.querySelector('dialog[open] input[data-botao="copiar"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  conferir('prévia: copiar some', await visivel('copiar'), false)
  await botaoDoDialogo('OK')
  await fechado()
  conferir('copiar oculto gravado', await prefs('botoesOcultos'), ['copiar'])
  conferir('copiar continua oculto', await visivel('copiar'), false)
  conferir('cortar continua visível', await visivel('cortar'), true)
  conferir('comando copiar continua existindo', await avaliar(`typeof ${M}.comandos.copiar`), 'function')

  // restaurar o padrão e voltar ao topo
  await abrir('barra')
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Restaurar barra padrão').click()`)
  conferir('restaurar: topo na prévia', await lateral(), false)
  await botaoDoDialogo('OK')
  await fechado()
  conferir('voltou ao topo', await prefs('posicaoBarra'), 'topo')
  conferir('nada oculto', await prefs('botoesOcultos'), [])
  conferir('copiar volta', await visivel('copiar'), true)

  // nome da conta -> iniciais no avatar
  await abrir('conta')
  await avaliar(`(() => { const e = document.querySelector('#cfg-nome-conta'); e.value = 'Maria da Silva'; e.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  conferir('prévia das iniciais no diálogo', await avaliar(`document.querySelector('dialog[open] .conta-previa .avatar-disco').textContent`), 'MS')
  await botaoDoDialogo('OK')
  await fechado()
  conferir('nome gravado', await prefs('conta.nome'), 'Maria da Silva')
  conferir('iniciais no avatar da barra', await avaliar(`document.querySelector('[data-id="conta"] .avatar-disco').textContent`), 'MS')
  conferir('aria-label do avatar', await avaliar(`document.querySelector('[data-id="conta"]').getAttribute('aria-label')`), 'Conta de Maria da Silva')
  conferir('clicar no avatar abre Configurações > Conta', await avaliar(`(() => { document.querySelector('[data-id="conta"]').click(); return true })()`), true)
  await esperar(300)
  conferir('aba Conta aberta', await avaliar(`document.querySelector('dialog[open] .abas [aria-selected="true"]').textContent`), 'Conta')
  await botaoDoDialogo('Cancelar')
  await fechado()

  // capturas: tema claro (clássico) e escuro, topo e lateral, já com o nome
  for (const [tema, nome] of [['classico', 'classico'], ['escuro', 'escuro']]) {
    await avaliar(`void ${M}.comandos.tema('${tema}')`)
    await esperar(300)
    for (const pos of ['topo', 'lateral']) {
      await avaliar(`window.misteralg.prefs.gravar({ posicaoBarra: '${pos}' }).then(p => { document.body.classList.toggle('barra-lateral', p.posicaoBarra === 'lateral') })`)
      await esperar(300)
      await foto(`${pasta}/${nome}-${pos}-nome.png`)
    }
  }
  await avaliar(`window.misteralg.prefs.gravar({ posicaoBarra: 'topo' })`)
  await avaliar(`void ${M}.comandos.tema('classico')`)
  await avaliar(`document.body.classList.remove('barra-lateral')`)
}
