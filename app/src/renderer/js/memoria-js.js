export function criarMemoriaJS() {
  const container = document.createElement('div')
  container.className = 'memoria-js'
  container.innerHTML = `
    <div class="mjs-pilha">
      <h3>Pilha de Chamadas</h3>
      <div class="mjs-quadros"></div>
    </div>
    <div class="mjs-objetos">
      <h3>Objetos</h3>
      <div class="mjs-lista"></div>
    </div>
    <div class="mjs-filas">
      <h3>Event Loop</h3>
      <div class="mjs-microtarefas">
        <h4>Microtarefas</h4>
        <div class="mjs-lista-micro"></div>
      </div>
      <div class="mjs-tarefas">
        <h4>Fila de Tarefas</h4>
        <div class="mjs-lista-tarefas"></div>
      </div>
    </div>
  `

  const mostrarFoto = (foto) => {
    if (!foto) {
      container.querySelector('.mjs-quadros').textContent = ''
      container.querySelector('.mjs-lista').textContent = ''
      container.querySelector('.mjs-lista-micro').textContent = ''
      container.querySelector('.mjs-lista-tarefas').textContent = ''
      return
    }

    // Pilha de chamadas
    const pilhaEl = container.querySelector('.mjs-quadros')
    pilhaEl.replaceChildren()
    foto.quadros.forEach((q, i) => {
      const quadroEl = document.createElement('div')
      quadroEl.className = `mjs-quadro ${i === foto.quadros.length - 1 ? 'ativo' : ''}`

      const nomeEl = document.createElement('div')
      nomeEl.className = 'mjs-nome'
      nomeEl.textContent = q.nome
      quadroEl.append(nomeEl)

      const varsEl = document.createElement('div')
      varsEl.className = 'mjs-vars'
      q.variaveis.forEach(v => {
        const varEl = document.createElement('div')
        varEl.className = 'mjs-var'

        const nomeVarEl = document.createElement('span')
        nomeVarEl.className = 'mjs-nome-var'
        nomeVarEl.textContent = v.nome
        varEl.append(nomeVarEl)

        varEl.append(': ')

        const valorEl = document.createElement('span')
        valorEl.className = 'mjs-valor'
        valorEl.innerHTML = formatarValor(v.valor)
        varEl.append(valorEl)

        varsEl.append(varEl)
      })
      quadroEl.append(varsEl)
      pilhaEl.append(quadroEl)
    })

    // Objetos
    const objetosEl = container.querySelector('.mjs-lista')
    objetosEl.replaceChildren()
    if (foto.objetos.length === 0) {
      const vazio = document.createElement('div')
      vazio.className = 'mjs-vazio'
      vazio.textContent = 'nenhum objeto'
      objetosEl.append(vazio)
    } else {
      foto.objetos.forEach(obj => {
        const objEl = document.createElement('div')
        objEl.className = 'mjs-objeto'

        const rotuloEl = document.createElement('div')
        rotuloEl.className = 'mjs-rotulo'
        rotuloEl.textContent = `#${obj.id} ${obj.rotulo}`
        objEl.append(rotuloEl)

        const itensEl = document.createElement('div')
        itensEl.className = 'mjs-itens'
        obj.itens.slice(0, 8).forEach(item => {
          const itemEl = document.createElement('div')
          itemEl.className = 'mjs-item'

          const chaveEl = document.createElement('span')
          chaveEl.textContent = item.chave + ': '
          itemEl.append(chaveEl)

          const valorEl = document.createElement('span')
          valorEl.innerHTML = formatarValor(item.valor)
          itemEl.append(valorEl)

          itensEl.append(itemEl)
        })
        if (obj.itens.length > 8) {
          const maisEl = document.createElement('div')
          maisEl.className = 'mjs-mais'
          maisEl.textContent = `... +${obj.itens.length - 8} mais`
          itensEl.append(maisEl)
        }
        objEl.append(itensEl)
        objetosEl.append(objEl)
      })
    }

    // Filas
    const { microtarefas = [], tarefas = [] } = foto.filas || {}
    const microEl = container.querySelector('.mjs-lista-micro')
    const tarefasEl = container.querySelector('.mjs-lista-tarefas')

    microEl.replaceChildren()
    if (microtarefas.length === 0) {
      const vazio = document.createElement('div')
      vazio.className = 'mjs-vazio'
      vazio.textContent = 'vazia'
      microEl.append(vazio)
    } else {
      microtarefas.forEach(t => {
        const itemEl = document.createElement('div')
        itemEl.className = 'mjs-fila-item'
        itemEl.textContent = t
        microEl.append(itemEl)
      })
    }

    tarefasEl.replaceChildren()
    if (tarefas.length === 0) {
      const vazio = document.createElement('div')
      vazio.className = 'mjs-vazio'
      vazio.textContent = 'vazia'
      tarefasEl.append(vazio)
    } else {
      tarefas.forEach(t => {
        const itemEl = document.createElement('div')
        itemEl.className = 'mjs-fila-item'
        itemEl.textContent = t
        tarefasEl.append(itemEl)
      })
    }
  }

  return { container, mostrarFoto }
}

function formatarValor(v) {
  if (v === null || v === undefined) return String(v)
  if (typeof v === 'object') {
    if (v.ref) return `<span class="mjs-ref">#${v.ref}</span>`
    if (v.tipo === 'function') return v.texto
    return `${v.tipo === 'array' ? `[${v.total || 0}]` : v.texto}`
  }
  return String(v)
}
