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
      container.querySelector('.mjs-quadros').innerHTML = ''
      container.querySelector('.mjs-lista').innerHTML = ''
      container.querySelector('.mjs-lista-micro').innerHTML = ''
      container.querySelector('.mjs-lista-tarefas').innerHTML = ''
      return
    }

    // Pilha de chamadas
    const pilhaHtml = foto.quadros.map((q, i) => `
      <div class="mjs-quadro ${i === foto.quadros.length - 1 ? 'ativo' : ''}">
        <div class="mjs-nome">${q.nome}</div>
        <div class="mjs-vars">
          ${q.variaveis.map(v => `<div class="mjs-var">
            <span class="mjs-nome-var">${v.nome}</span>: <span class="mjs-valor">${formatarValor(v.valor)}</span>
          </div>`).join('')}
        </div>
      </div>
    `).join('')
    container.querySelector('.mjs-quadros').innerHTML = pilhaHtml

    // Objetos
    const objetosHtml = foto.objetos.map(obj => `
      <div class="mjs-objeto">
        <div class="mjs-rotulo">#${obj.id} ${obj.rotulo}</div>
        <div class="mjs-itens">
          ${obj.itens.slice(0, 8).map(item => `<div class="mjs-item">
            ${item.chave}: ${formatarValor(item.valor)}
          </div>`).join('')}
          ${obj.itens.length > 8 ? `<div class="mjs-mais">... +${obj.itens.length - 8} mais</div>` : ''}
        </div>
      </div>
    `).join('')
    container.querySelector('.mjs-lista').innerHTML = objetosHtml || '<div class="mjs-vazio">nenhum objeto</div>'

    // Filas
    const { microtarefas = [], tarefas = [] } = foto.filas || {}
    const microHtml = microtarefas.length > 0 ? microtarefas.map(t => `<div class="mjs-fila-item">${t}</div>`).join('') : '<div class="mjs-vazio">vazia</div>'
    const tarefasHtml = tarefas.length > 0 ? tarefas.map(t => `<div class="mjs-fila-item">${t}</div>`).join('') : '<div class="mjs-vazio">vazia</div>'
    container.querySelector('.mjs-lista-micro').innerHTML = microHtml
    container.querySelector('.mjs-lista-tarefas').innerHTML = tarefasHtml
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
