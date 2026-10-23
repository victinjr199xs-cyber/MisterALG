// A página ao vivo do PHP: um iframe (com sandbox) que abre o mini servidor do app (main/previa.js),
// a aba "HTML gerado", e a lista de avisos e erros do PHP, já em português.

const api = window.misteralg

export function criarPrevia({ aoFechar, aoIrParaLinha }) {
  const raiz = document.getElementById('previa')
  const quadro = document.getElementById('previa-quadro')
  const html = document.getElementById('previa-html')
  const avisos = document.getElementById('previa-avisos')
  const info = document.getElementById('previa-info')
  const abas = [...raiz.querySelectorAll('.previa-aba')]
  let url = null
  let modo = 'pagina'

  async function atualizarHtml() {
    const r = await api.php.ultima()
    html.textContent = r ? r.texto : ''
  }

  function escolherModo(novo) {
    modo = novo
    for (const a of abas) a.setAttribute('aria-pressed', String(a.dataset.modo === novo))
    quadro.hidden = novo !== 'pagina'
    html.hidden = novo !== 'html'
    if (novo === 'html') atualizarHtml()
  }
  for (const a of abas) a.addEventListener('click', () => escolherModo(a.dataset.modo))
  document.getElementById('previa-atualizar').addEventListener('click', () => recarregar())
  document.getElementById('previa-fechar').addEventListener('click', () => aoFechar())

  function recarregar() {
    if (url) quadro.src = url // atribuir o mesmo endereço navega de novo
  }

  api.php.aoResponder((r) => {
    info.textContent = `${r.arquivo} · HTTP ${r.status} · ${r.ms} ms · ${r.bytes} bytes`
    avisos.replaceChildren()
    for (const d of r.diagnosticos) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = `previa-aviso previa-${d.nivel}`
      item.title = d.explicacao
      item.textContent = `${d.rotulo}${d.principal ? ` — linha ${d.linha}` : ` — ${d.arquivo.split('/').pop()}, linha ${d.linha}`}: ${d.mensagem}`
      if (d.principal) item.addEventListener('click', () => aoIrParaLinha(d.linha))
      avisos.append(item)
    }
    avisos.hidden = r.diagnosticos.length === 0
    if (modo === 'html') atualizarHtml()
  })

  return {
    get visivel() { return !raiz.hidden },
    /** Mostra a página (e a recarrega). */
    mostrar(novaUrl) {
      const jaAberta = !raiz.hidden
      url = novaUrl
      raiz.hidden = false
      if (!jaAberta) escolherModo('pagina') // ao atualizar, fica na aba em que o aluno está
      recarregar()
    },
    recarregar,
    esconder() {
      raiz.hidden = true
      quadro.removeAttribute('src')
      url = null
    },
  }
}
