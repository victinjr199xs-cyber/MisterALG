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

export function criarMemoriaBanco(pai) {
  const container = el('div', { className: 'mb-banco' })
  pai.append(container)
  let anterior = null // Map tabela → Map chave → JSON da linha

  function mostrar(tabelas) {
    const atual = new Map()
    const blocos = tabelas.map((t) => {
      const linhasAntes = anterior?.get(t.nome)
      const mapa = new Map()
      const cabeca = el('tr', {}, ...t.colunas.map((c) => el('th', { title: `${c.nome}: ${c.tipo}` },
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
      const nova = anterior && !anterior.has(t.nome)
      return el('section', { className: `mb-tabela${nova ? ' mb-tabela-nova' : ''}` },
        el('header', {}, el('b', { textContent: t.nome }), el('span', { textContent: `${t.total} ${t.total === 1 ? 'row' : 'rows'}${t.total > t.linhas.length ? ` (showing ${t.linhas.length})` : ''}` })),
        el('div', { className: 'mb-rolagem' }, el('table', {}, el('thead', {}, cabeca), el('tbody', {}, ...corpo, ...apagadas))),
        t.colunas.length && !t.linhas.length && !apagadas.length ? el('p', { className: 'mb-vazia', textContent: 'empty table' }) : null)
    })
    anterior = atual
    container.replaceChildren(...(blocos.length ? blocos : [el('p', { className: 'mb-vazio', textContent: 'No tables yet. Run a CREATE TABLE to see it here.' })]))
    container.querySelector('.mb-nova, .mb-alterada, .mb-apagada, .mb-tabela-nova')?.scrollIntoView({ block: 'nearest' })
  }

  return {
    container,
    mostrar,
    limpar() {
      anterior = null
      container.replaceChildren(el('p', { className: 'mb-vazio', textContent: 'Starting PostgreSQL…' }))
    },
  }
}
