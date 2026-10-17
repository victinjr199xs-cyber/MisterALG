// Teste de fumaça dos temas: troca para cada tema e confere as cores de sintaxe
// do editor de verdade (cor computada dos spans do CodeMirror).
// Uso: node scripts/cdp.mjs <porta> scripts/fumaca-temas.mjs
// Falha (exceção → código de saída ≠ 0) se:
//  - duas categorias de sintaxe tiverem cores iguais ou quase (já aconteceu no Terminal);
//  - variável ou palavra-chave tiverem contraste WCAG < 4,5 contra o fundo do editor;
//  - o fundo do editor se repetir entre temas (tema não aplicado);
//  - aparecer erro no console da página.

import { TEMAS } from '../app/src/compartilhado/temas.js'

const PROGRAMA = `algoritmo "cores"
// comentario
var
   x : inteiro
inicio
   x <- 42
   se x > 1 entao
      escreva("oi")
   fimse
fimalgoritmo
`
// categoria → texto exato do span que a representa
const TOKENS = {
  comentario: '// comentario',
  literal: '"oi"',
  chave: 'escreva',
  especial: 'algoritmo',
  tipo: 'inteiro',
  variavel: 'x',
}
const DISTANCIA_MINIMA = 60
const CONTRASTE_MINIMO = 4.5

const rgb = (css) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const luminancia = (c) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (l1 + 0.05) / (l2 + 0.05)
}
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

// Roda na página: cor de cada token e fundo efetivo do editor.
const LER_CORES = `(() => {
  const tokens = ${JSON.stringify(TOKENS)}
  const spans = [...document.querySelectorAll('.cm-content .cm-line span')]
  const cores = {}
  for (const [cat, texto] of Object.entries(tokens)) {
    const s = spans.find((e) => e.textContent === texto && e.children.length === 0)
    cores[cat] = s ? getComputedStyle(s).color : null
  }
  let el = document.querySelector('.cm-content') ?? document.querySelector('.cm-editor')
  let fundo = 'rgba(0, 0, 0, 0)'
  while (el) {
    const f = getComputedStyle(el).backgroundColor
    if (f && f !== 'transparent' && !/rgba\\(.*, 0\\)$/.test(f)) { fundo = f; break }
    el = el.parentElement
  }
  return { tema: document.documentElement.dataset.tema, cores, fundo }
})()`

export default async ({ avaliar, esperar, erros }) => {
  // A IDE pode estar parada na tela de termos (primeira abertura).
  for (let i = 0; i < 40; i += 1) {
    if (await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)) break
    await esperar(500)
  }
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  if (!(await avaliar('!!window.__misteralg'))) throw new Error('IDE não carregou')

  const M = 'window.__misteralg'
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)})`)
  await esperar(300)

  const falhas = []
  const fundos = new Map()
  const cats = Object.keys(TOKENS)
  for (const tema of TEMAS) {
    await avaliar(`${M}.comandos.tema(${JSON.stringify(tema.id)})`)
    await esperar(250)
    const r = await avaliar(LER_CORES)
    const linha = [`${tema.id.padEnd(11)}`]
    if (r.tema !== tema.id) falhas.push(`${tema.id}: data-tema ficou "${r.tema}"`)
    const fundo = rgb(r.fundo)
    linha.push(`fundo ${hex(fundo)}`)
    if (fundos.has(hex(fundo))) falhas.push(`${tema.id}: fundo do editor igual ao do tema ${fundos.get(hex(fundo))}`)
    fundos.set(hex(fundo), tema.id)
    const cores = {}
    for (const c of cats) {
      if (!r.cores[c]) {
        falhas.push(`${tema.id}: não achei o span de ${c} (${TOKENS[c]})`)
        continue
      }
      cores[c] = rgb(r.cores[c])
      linha.push(`${c} ${hex(cores[c])} (${contraste(cores[c], fundo).toFixed(1)}:1)`)
    }
    for (let i = 0; i < cats.length; i += 1) {
      for (let j = i + 1; j < cats.length; j += 1) {
        const [a, b] = [cats[i], cats[j]]
        if (!cores[a] || !cores[b]) continue
        const d = distancia(cores[a], cores[b])
        if (d < DISTANCIA_MINIMA) falhas.push(`${tema.id}: ${a} ${hex(cores[a])} e ${b} ${hex(cores[b])} parecidas demais (distância ${d.toFixed(0)})`)
      }
    }
    for (const c of ['variavel', 'chave']) {
      if (!cores[c]) continue
      const k = contraste(cores[c], fundo)
      if (k < CONTRASTE_MINIMO) falhas.push(`${tema.id}: contraste de ${c} ${k.toFixed(2)}:1 < ${CONTRASTE_MINIMO}`)
    }
    console.log(linha.join(' | '))
  }
  // Volta ao tema clássico para não deixar a preferência alterada.
  await avaliar(`${M}.comandos.tema('classico')`)

  if (erros.length) falhas.push(`erros no console: ${erros.join(' / ')}`)
  if (falhas.length) throw new Error('Fumaça dos temas falhou:\n' + falhas.join('\n'))
  console.log('Fumaça dos temas: tudo certo.')
}
