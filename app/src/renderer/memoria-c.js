// Tela de memória do passo a passo do C (F8): a pilha (uma caixa por chamada de
// função), o heap (blocos do malloc) e as globais, com uma seta saindo de cada
// ponteiro até o lugar para onde ele aponta. Fica no lugar da grade de variáveis.

import { descrever, hex, tipoDoBloco } from '@misteralg/interpretador-c'

const SVG = 'http://www.w3.org/2000/svg'

const el = (tag, classe, texto) => {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

/** Um valor descrito (descrever.js) vira elementos, cada um com o seu endereço em data-endereco. */
function valorEmElementos(d) {
  if (d.forma === 'vetor') {
    const caixa = el('span', 'mc-vetor')
    caixa.dataset.endereco = d.endereco
    for (const item of d.itens) {
      const celula = el('span', 'mc-celula')
      celula.append(el('span', 'mc-indice', item.rotulo.slice(1, -1)), valorEmElementos(item))
      caixa.append(celula)
    }
    if (d.total > d.itens.length) caixa.append(el('span', 'mc-mais', `… +${d.total - d.itens.length}`))
    if (d.texto) caixa.append(el('span', 'mc-texto', d.texto))
    return caixa
  }
  if (d.forma === 'registro') {
    const caixa = el('span', 'mc-registro')
    caixa.dataset.endereco = d.endereco
    for (const campo of d.campos) {
      const c = el('span', 'mc-campo')
      c.append(el('span', 'mc-rotulo', campo.rotulo), valorEmElementos(campo))
      caixa.append(c)
    }
    if (d.texto) caixa.append(el('span', 'mc-texto', d.texto))
    return caixa
  }
  if (d.forma === 'ponteiro') {
    const p = el('span', `mc-ponteiro${d.lixo ? ' mc-lixo' : ''}`)
    p.dataset.endereco = d.endereco
    p.title = `${d.tipo} = ${d.texto}`
    if (d.alvo) {
      p.dataset.alvo = d.alvo
      p.append(el('span', 'mc-bolinha', '●'), el('span', 'mc-destino', d.destino))
    } else p.append(el('span', null, d.texto))
    return p
  }
  const v = el('span', `mc-valor${d.lixo ? ' mc-lixo' : ''}`, d.texto)
  v.dataset.endereco = d.endereco
  if (d.lixo) v.title = 'Sem valor ainda: em C ela teria "lixo" (o que estava na memória antes)'
  return v
}

function linhaDeVariavel(nome, tipo, d, endereco) {
  const linha = el('div', 'mc-variavel')
  linha.append(el('span', 'mc-nome', nome), el('span', 'mc-tipo', tipo), el('span', 'mc-conteudo'), el('span', 'mc-endereco', hex(endereco)))
  linha.children[2].append(valorEmElementos(d))
  return linha
}

export function criarMemoriaC(rolagem) {
  const raiz = el('div', 'memoria-c')
  raiz.hidden = true
  const conteudo = el('div', 'mc-conteudo-geral')
  const svg = document.createElementNS(SVG, 'svg')
  svg.classList.add('mc-setas')
  svg.innerHTML = '<defs><marker id="mc-ponta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>'
  raiz.append(conteudo, svg)
  rolagem.append(raiz)
  let anteriores = new Map()

  function desenharSetas() {
    for (const velha of svg.querySelectorAll('path.mc-seta')) velha.remove()
    if (raiz.hidden) return
    const base = raiz.getBoundingClientRect()
    svg.setAttribute('width', raiz.scrollWidth)
    svg.setAttribute('height', raiz.scrollHeight)
    for (const p of raiz.querySelectorAll('.mc-ponteiro[data-alvo]')) {
      const alvos = raiz.querySelectorAll(`[data-endereco="${p.dataset.alvo}"]`)
      const alvo = alvos[alvos.length - 1] // o mais de dentro (a célula, não o vetor inteiro)
      if (!alvo || alvo === p) continue
      const bolinha = p.querySelector('.mc-bolinha') ?? p
      const a = bolinha.getBoundingClientRect()
      const b = alvo.getBoundingClientRect()
      const x1 = a.left + a.width / 2 - base.left
      const y1 = a.top + a.height / 2 - base.top
      const x2 = b.left - base.left - 2
      const y2 = b.top + b.height / 2 - base.top
      const curva = Math.max(30, Math.abs(y2 - y1) / 2)
      const caminho = document.createElementNS(SVG, 'path')
      caminho.classList.add('mc-seta')
      caminho.setAttribute('d', `M${x1},${y1} C${x1 + curva},${y1} ${x2 - curva},${y2} ${x2},${y2}`)
      caminho.setAttribute('marker-end', 'url(#mc-ponta)')
      svg.append(caminho)
    }
  }
  new ResizeObserver(desenharSetas).observe(raiz)

  function secao(titulo, filhos, vazio) {
    const s = el('section', 'mc-secao')
    s.append(el('h3', 'mc-titulo', titulo))
    if (filhos.length) s.append(...filhos)
    else s.append(el('div', 'mc-vazio', vazio))
    return s
  }

  return {
    /** Mostra a memória da máquina como está agora (depois de cada passo). */
    mostrar(maq) {
      raiz.hidden = false
      const foto = maq.instantaneo()
      const quadros = [...foto.quadros].reverse().map((q, i) => {
        const caixa = el('div', `mc-quadro${i === 0 ? ' mc-atual' : ''}`)
        caixa.append(el('div', 'mc-cabecalho', `${q.funcao}()  ·  linha ${q.linha}`))
        for (const v of q.variaveis) caixa.append(linhaDeVariavel(v.nome, v.tipoTexto, descrever(maq, v.endereco, v.tipo), v.endereco))
        if (!q.variaveis.length) caixa.append(el('div', 'mc-vazio', 'sem variáveis'))
        return caixa
      })
      const heap = foto.heap.map((b) => {
        const bloco = maq.mem.heap.find((x) => x.inicio === b.endereco)
        const tipo = tipoDoBloco(bloco)
        const d = tipo ? descrever(maq, b.endereco, tipo) : { forma: 'valor', texto: `${b.tamanho} bytes (tipo ainda desconhecido)`, endereco: b.endereco }
        return linhaDeVariavel(`bloco #${b.numero}`, tipo ? tipo.nome : `${b.tamanho} bytes`, d, b.endereco)
      })
      for (const b of foto.liberados.slice(-4)) {
        const linha = linhaDeVariavel(`bloco #${b.numero}`, 'liberado', { forma: 'valor', texto: 'devolvido com free()', endereco: b.endereco }, b.endereco)
        linha.classList.add('mc-liberado')
        heap.push(linha)
      }
      const globais = foto.globais.map((g) => linhaDeVariavel(g.local ? `${g.nome} (static)` : g.nome, g.tipoTexto, descrever(maq, g.endereco, g.tipo), g.endereco))
      conteudo.replaceChildren(
        secao('Pilha (uma caixa por chamada de função)', quadros, 'o programa ainda não começou'),
        secao('Heap (memória do malloc)', heap, 'nenhum bloco: o programa ainda não chamou malloc'),
        ...(globais.length ? [secao('Globais', globais)] : []),
      )
      // Destaca o que mudou desde o último passo, como a grade do Portugol.
      const atuais = new Map()
      for (const e of conteudo.querySelectorAll('.mc-valor, .mc-ponteiro')) {
        const chave = e.dataset.endereco
        atuais.set(chave, e.textContent)
        if (anteriores.size && anteriores.has(chave) && anteriores.get(chave) !== e.textContent) e.classList.add('mc-mudou')
      }
      anteriores = atuais
      requestAnimationFrame(desenharSetas)
    },
    esconder() {
      raiz.hidden = true
      anteriores = new Map()
      conteudo.replaceChildren()
      desenharSetas()
    },
    get visivel() { return !raiz.hidden },
  }
}
