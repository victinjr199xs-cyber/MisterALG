// Tela de memória do passo a passo de JavaScript, TypeScript e Python: a pilha de chamadas à esquerda
// (uma caixa por chamada, com as variáveis), os objetos à direita e uma seta de cada referência até o
// objeto para onde ela aponta. No JavaScript, também as filas do laço de eventos.
//
// Formato da foto (o mesmo nas duas linguagens):
//   quadros: [{ nome, linha, variaveis: [{ nome, tipoDeclarado?, valor }] }]   (o último é a chamada atual)
//   objetos: [{ id, tipo, rotulo, total?, itens: [{ chave, valor }] }]
//   filas?:  { relogio, webApis: [{ descricao, faltam }], tarefas: [texto], microtarefas: [texto] }
//   valor:   { texto, tipo }  (número, texto, None...)   ou   { ref, tipo }  (aponta para objetos[ref])

const SVG = 'http://www.w3.org/2000/svg'

const el = (tag, classe, texto) => {
  const e = document.createElement(tag)
  if (classe) e.className = classe
  if (texto !== undefined) e.textContent = texto
  return e
}

function chip(valor) {
  if (valor.ref !== undefined) {
    const c = el('span', 'mo-ref')
    c.dataset.ref = valor.ref
    c.title = `${valor.tipo} — #${valor.ref}`
    c.append(el('span', 'mo-bolinha', '●'), el('span', 'mo-numero', `#${valor.ref}`))
    return c
  }
  const c = el('span', `mo-valor mo-t-${(valor.tipo ?? '').replace(/\W/g, '')}`, valor.texto)
  c.title = valor.tipo ?? ''
  return c
}

function linha(chave, valor, extra) {
  const l = el('div', 'mo-linha')
  l.append(el('span', 'mo-chave', chave))
  if (extra) l.append(el('span', 'mo-tipo', extra))
  l.append(chip(valor))
  return l
}

function secao(titulo, filhos, vazio) {
  const s = el('section', 'mo-secao')
  s.append(el('h3', 'mo-titulo', titulo))
  if (filhos.length) s.append(...filhos)
  else s.append(el('div', 'mo-vazio', vazio))
  return s
}

export function criarMemoriaObjetos(rolagem) {
  const raiz = el('div', 'memoria-objetos')
  raiz.hidden = true
  const conteudo = el('div', 'mo-conteudo')
  const svg = document.createElementNS(SVG, 'svg')
  svg.classList.add('mo-setas')
  svg.innerHTML = '<defs><marker id="mo-ponta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>'
  raiz.append(conteudo, svg)
  rolagem.append(raiz)
  let anteriores = new Map()

  function desenharSetas() {
    for (const velha of svg.querySelectorAll('path.mo-seta')) velha.remove()
    if (raiz.hidden) return
    const base = raiz.getBoundingClientRect()
    svg.setAttribute('width', raiz.scrollWidth)
    svg.setAttribute('height', raiz.scrollHeight)
    for (const origem of raiz.querySelectorAll('.mo-ref')) {
      const alvo = raiz.querySelector(`.mo-objeto[data-id="${origem.dataset.ref}"]`)
      if (!alvo) continue
      const a = (origem.querySelector('.mo-bolinha') ?? origem).getBoundingClientRect()
      const b = alvo.getBoundingClientRect()
      const x1 = a.left + a.width / 2 - base.left + raiz.scrollLeft
      const y1 = a.top + a.height / 2 - base.top + raiz.scrollTop
      const x2 = b.left - base.left + raiz.scrollLeft - 2
      const y2 = Math.min(b.top + 14, b.bottom - 4) - base.top + raiz.scrollTop
      const curva = Math.max(30, Math.abs(x2 - x1) / 2)
      const caminho = document.createElementNS(SVG, 'path')
      caminho.classList.add('mo-seta')
      caminho.setAttribute('d', `M${x1},${y1} C${x1 + curva},${y1} ${x2 - curva},${y2} ${x2},${y2}`)
      caminho.setAttribute('marker-end', 'url(#mo-ponta)')
      svg.append(caminho)
    }
  }
  new ResizeObserver(desenharSetas).observe(raiz)
  raiz.addEventListener('scroll', desenharSetas)

  function quadros(foto) {
    return [...foto.quadros].reverse().map((q, i) => {
      const caixa = el('div', `mo-quadro${i === 0 ? ' mo-atual' : ''}`)
      caixa.append(el('div', 'mo-cabecalho', q.global ? q.nome : `${q.nome}${q.nome.startsWith('(') ? '' : '()'}  ·  linha ${q.linha}`))
      for (const v of q.variaveis) caixa.append(linha(v.nome, v.valor, v.tipoDeclarado))
      if (!q.variaveis.length) caixa.append(el('div', 'mo-vazio', 'sem variáveis'))
      return caixa
    })
  }

  function objetos(foto) {
    return foto.objetos.map((o) => {
      const caixa = el('div', 'mo-objeto')
      caixa.dataset.id = o.id
      const cab = el('div', 'mo-cabecalho')
      cab.append(el('span', 'mo-id', `#${o.id}`), ` ${o.rotulo}`)
      caixa.append(cab)
      for (const item of o.itens) caixa.append(linha(item.chave, item.valor))
      const total = o.total ?? o.itens.length
      if (total > o.itens.length) caixa.append(el('div', 'mo-vazio', `… +${total - o.itens.length}`))
      else if (!o.itens.length) caixa.append(el('div', 'mo-vazio', 'vazio'))
      return caixa
    })
  }

  function filas(f) {
    const lista = (itens, vazio) => (itens.length ? itens.map((t) => el('div', 'mo-fila-item', t)) : [el('div', 'mo-vazio', vazio)])
    const s = el('section', 'mo-secao mo-filas')
    s.append(el('h3', 'mo-titulo', `Laço de eventos (relógio virtual: ${f.relogio} ms)`))
    for (const [rotulo, itens, vazio] of [
      ['Microtarefas (Promises: passam na frente)', f.microtarefas, 'vazia'],
      ['Fila de tarefas (callbacks prontos)', f.tarefas, 'vazia'],
      ['Web APIs (temporizadores esperando)', f.webApis.map((w) => `${w.descricao} — falta${w.faltam === 1 ? '' : 'm'} ${w.faltam} ms`), 'nenhuma'],
    ]) {
      const bloco = el('div', 'mo-fila')
      bloco.append(el('h4', 'mo-subtitulo', rotulo), ...lista(itens, vazio))
      s.append(bloco)
    }
    return s
  }

  return {
    container: raiz,
    /** Mostra a memória como está agora (depois de cada passo). Sem foto: limpa a tela. */
    mostrarFoto(foto) {
      if (!foto) {
        anteriores = new Map()
        conteudo.replaceChildren()
        desenharSetas()
        return
      }
      const colunas = el('div', 'mo-colunas')
      colunas.append(
        secao('Pilha de chamadas', quadros(foto), 'o programa ainda não começou'),
        secao('Objetos (as setas saem das referências)', objetos(foto), 'nenhum objeto ainda'),
      )
      conteudo.replaceChildren(colunas, ...(foto.filas ? [filas(foto.filas)] : []))
      // Destaca o que mudou desde o último passo, como a grade do Portugol.
      const atuais = new Map()
      for (const quadro of conteudo.querySelectorAll('.mo-quadro, .mo-objeto')) {
        const dono = quadro.dataset.id ? `#${quadro.dataset.id}` : quadro.firstChild.textContent.replace(/\s+·.*$/, '')
        for (const l of quadro.querySelectorAll('.mo-linha')) {
          const chave = `${dono}|${l.firstChild.textContent}`
          const texto = l.lastChild.textContent
          atuais.set(chave, texto)
          if (anteriores.size && anteriores.has(chave) && anteriores.get(chave) !== texto) l.lastChild.classList.add('mo-mudou')
        }
      }
      anteriores = atuais
      requestAnimationFrame(desenharSetas)
    },
  }
}
