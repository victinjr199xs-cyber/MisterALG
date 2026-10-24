// A tela do banco de dados (SQL): cada tabela com as colunas, as chaves (🔑 primária, → estrangeira) e as
// linhas. A cada comando, as linhas novas aparecem em verde, as alteradas em amarelo e as apagadas riscadas.

const el = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos.filter((f) => f !== null && f !== undefined))
  return e
}

/** A identidade de uma linha: a chave primária, se houver; senão a linha inteira. */
const chaveDaLinha = (tabela, linha) => {
  const pk = tabela.colunas.map((c, i) => (c.chave ? i : -1)).filter((i) => i >= 0)
  return JSON.stringify(pk.length ? pk.map((i) => linha[i]) : linha)
}

const SVG = 'http://www.w3.org/2000/svg'

export function criarMemoriaBanco(pai) {
  const container = el('div', { className: 'mb-banco' })
  pai.append(container)
  const svg = document.createElementNS(SVG, 'svg')
  svg.classList.add('mb-setas')
  svg.innerHTML = '<defs><marker id="mb-ponta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>'
  let relacoes = [] // { de: [tabela, coluna], para: [tabela, coluna] }

  const celula = (tabela, coluna) => [...container.querySelectorAll('th[data-tab]')].find((th) => th.dataset.tab === tabela && th.dataset.col === coluna)

  function desenharSetas() {
    for (const velha of svg.querySelectorAll('path.mb-seta')) velha.remove()
    if (container.hidden || !container.offsetParent) return
    const base = container.getBoundingClientRect()
    svg.setAttribute('width', container.scrollWidth)
    svg.setAttribute('height', container.scrollHeight)
    for (const { de, para } of relacoes) {
      const origem = celula(...de)
      const alvo = celula(...para)
      if (!origem || !alvo) continue
      const a = origem.getBoundingClientRect()
      const b = alvo.getBoundingClientRect()
      // As setas saem e chegam pela borda direita das tabelas, para não cobrir o texto das colunas vizinhas.
      const x1 = origem.closest('.mb-tabela').getBoundingClientRect().right - base.left
      const y1 = a.top + a.height / 2 - base.top
      const x2 = alvo.closest('.mb-tabela').getBoundingClientRect().right - base.left
      const y2 = b.top + b.height / 2 - base.top
      const curva = 36 + Math.abs(y2 - y1) / 8
      const caminho = document.createElementNS(SVG, 'path')
      caminho.classList.add('mb-seta')
      caminho.setAttribute('d', `M${x1},${y1} C${x1 + curva},${y1} ${x2 + curva},${y2} ${x2},${y2}`)
      caminho.setAttribute('marker-end', 'url(#mb-ponta)')
      svg.append(caminho)
    }
  }
  new ResizeObserver(desenharSetas).observe(container)
  container.addEventListener('scroll', desenharSetas, true)
  let anterior = null // Map tabela → Map chave → JSON da linha

  function mostrar(tabelas) {
    const atual = new Map()
    const blocos = tabelas.map((t) => {
      const linhasAntes = anterior?.get(t.nome)
      const mapa = new Map()
      const cabeca = el('tr', {}, ...t.colunas.map((c) => el('th', { title: `${c.nome}: ${c.tipo}`, className: c.referencia ? 'mb-fk-col' : '' },
        c.chave ? el('span', { className: 'mb-pk', textContent: '🔑 ' }) : null,
        c.nome,
        c.referencia ? el('small', { className: 'mb-fk', textContent: ` → ${c.referencia.tabela}.${c.referencia.coluna}` }) : null)))
      const corpo = t.linhas.map((l) => {
        const k = chaveDaLinha(t, l)
        const json = JSON.stringify(l)
        mapa.set(k, json)
        const tr = el('tr', {}, ...l.map((v) => el('td', { className: v === null ? 'mb-nulo' : '', textContent: v === null ? 'NULL' : v })))
        if (anterior && !linhasAntes?.has(k)) tr.className = 'mb-nova'
        else if (linhasAntes && linhasAntes.get(k) !== json) tr.className = 'mb-alterada'
        return tr
      })
      // Só dá para saber que sumiu se a tabela inteira cabia na tela da vez anterior.
      const apagadas = linhasAntes && t.total <= t.linhas.length
        ? [...linhasAntes].filter(([k]) => !mapa.has(k)).map(([, json]) => el('tr', { className: 'mb-apagada' }, ...JSON.parse(json).map((v) => el('td', { textContent: v === null ? 'NULL' : v }))))
        : []
      atual.set(t.nome, mapa)
      cabeca.childNodes.forEach((th, i) => Object.assign(th.dataset, { tab: t.nome, col: t.colunas[i].nome }))
      const nova = anterior && !anterior.has(t.nome)
      return el('section', { className: `mb-tabela${nova ? ' mb-tabela-nova' : ''}` },
        el('header', {}, el('b', { textContent: t.nome }), el('span', { textContent: `${t.total} ${t.total === 1 ? 'row' : 'rows'}${t.total > t.linhas.length ? ` (showing ${t.linhas.length})` : ''}` })),
        el('div', { className: 'mb-rolagem' }, el('table', {}, el('thead', {}, cabeca), el('tbody', {}, ...corpo, ...apagadas))),
        t.colunas.length && !t.linhas.length && !apagadas.length ? el('p', { className: 'mb-vazia', textContent: 'empty table' }) : null)
    })
    anterior = atual
    relacoes = tabelas.flatMap((t) => (t.estrangeiras ?? []).flatMap((f) => f.colunas.map((c, i) => ({ de: [t.nome, c], para: [f.tabela, f.referencias[i]] }))))
    container.replaceChildren(...(blocos.length ? blocos : [el('p', { className: 'mb-vazio', textContent: 'No tables yet. Run a CREATE TABLE to see it here.' })]), svg)
    desenharSetas()
    requestAnimationFrame(desenharSetas)
    container.querySelector('.mb-nova, .mb-alterada, .mb-apagada, .mb-tabela-nova')?.scrollIntoView({ block: 'nearest' })
  }

  return {
    container,
    mostrar,
    limpar() {
      anterior = null
      relacoes = []
      container.replaceChildren(svg, el('p', { className: 'mb-vazio', textContent: 'Starting PostgreSQL…' }))
    },
  }
}
