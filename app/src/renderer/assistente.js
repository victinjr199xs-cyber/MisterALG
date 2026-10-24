// Painel do Assistente de IA: perguntas sobre o algoritmo aberto, com a resposta
// chegando aos poucos. Quem fala com a IA é o main (main/ia.js); aqui fica só a conversa.

import { PROVEDORES, provedorPorId } from '../compartilhado/ia.js'
import { el, janela } from './dialogos.js'

const api = window.misteralg

const ACOES = [
  ['Explicar o código', 'Explique, passo a passo, o que este algoritmo faz.'],
  ['Me dá uma dica', 'Estou travado neste algoritmo. Me dê uma dica do próximo passo, sem entregar a resposta.'],
  ['Por que deu erro?', 'Por que aconteceu o último erro e como eu descubro onde está o problema?'],
  ['Casos de teste', 'Sugira valores de entrada para testar este algoritmo, incluindo casos-limite, e o resultado esperado de cada um.'],
]

/** O que vai junto com cada pergunta: o código numerado, o último erro e o fim da saída. */
function contextoTexto({ linguagem = 'Portugol (VisuAlg)', codigo, erro, saida }) {
  const numerado = codigo.split('\n').map((l, i) => `${String(i + 1).padStart(3)}| ${l}`).join('\n')
  let s = `Linguagem: ${linguagem}\nAlgoritmo aberto no editor:\n\`\`\`\n${numerado}\n\`\`\``
  if (erro) s += `\n\nÚltimo erro: linha ${erro.linha}: ${erro.mensagem}`
  if (saida?.trim()) s += `\n\nSaída da última execução (final):\n\`\`\`\n${saida.slice(-1500)}\n\`\`\``
  return s
}

// Markdown bem simples (blocos ```, `código` e **negrito**), montado em nós DOM: o
// texto da IA nunca vira HTML.
function trechos(texto) {
  return texto.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/).filter(Boolean).map((t) => {
    if (t.startsWith('`')) return el('code', { textContent: t.slice(1, -1) })
    if (t.startsWith('**')) return el('b', { textContent: t.slice(2, -2) })
    return t
  })
}
function renderizar(destino, texto) {
  const partes = texto.split(/```[^\n]*\n?/)
  destino.replaceChildren(...partes.flatMap((p, i) => (i % 2
    ? [el('pre', {}, el('code', { textContent: p.replace(/\n$/, '') }))]
    : p.split(/\n{2,}/).filter((par) => par.trim()).map((par) => el('p', {}, ...trechos(par.trim()))))))
}

/**
 * @param op {{ prefs: () => object, gravarPrefs: (parcial) => Promise<object>, contexto: () => {codigo, erro, saida}, aoMudar?: (aberto) => void }}
 */
export function criarAssistente(op) {
  const historico = [] // { role, content } — a pergunta sem o contexto, para a conversa não crescer à toa
  let enviando = null // id da pergunta em andamento
  let bolhaAtual = null
  let textoAtual = ''

  const conversa = el('div', { className: 'assistente-conversa', ariaLive: 'polite' })
  const entrada = el('textarea', { className: 'assistente-entrada', rows: 2, placeholder: 'Pergunte sobre o seu algoritmo… (Enter envia)' })
  const enviar = el('button', { type: 'button', className: 'assistente-enviar', textContent: 'Enviar' })
  const subtitulo = el('span', { className: 'assistente-sub' })
  const botaoAcao = (rotulo, pergunta) => {
    const b = el('button', { type: 'button', className: 'assistente-acao', textContent: rotulo })
    b.addEventListener('click', () => perguntar(pergunta, rotulo))
    return b
  }
  const botaoTopo = (texto, titulo, aoClicar) => {
    const b = el('button', { type: 'button', className: 'assistente-topo-botao', textContent: texto, title: titulo })
    b.setAttribute('aria-label', titulo)
    b.addEventListener('click', aoClicar)
    return b
  }
  const acoes = el('div', { className: 'assistente-acoes' }, ...ACOES.map(([r, p]) => botaoAcao(r, p)))

  const painel = el('section', { className: 'moldura assistente', hidden: true, ariaLabel: 'Assistente de IA' },
    el('header', { className: 'assistente-topo' },
      el('h2', { className: 'legenda' }, '✨ ', el('span', { textContent: 'Assistente de IA' })),
      subtitulo,
      botaoTopo('⟲', 'Nova conversa', () => novaConversa()),
      botaoTopo('⚙', 'Configurar o assistente', () => configurar()),
      botaoTopo('×', 'Fechar o assistente', () => fechar()),
    ),
    conversa,
    acoes,
    el('div', { className: 'assistente-rodape' }, entrada, enviar),
  )
  document.getElementById('area').append(painel)

  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      enviar.click()
    }
  })
  enviar.addEventListener('click', () => {
    if (enviando) return api.ia.cancelar(enviando)
    const texto = entrada.value.trim()
    if (texto) {
      entrada.value = ''
      perguntar(texto)
    }
  })

  api.ia.aoReceber((id, pedaco) => {
    if (id !== enviando || !bolhaAtual) return
    textoAtual += pedaco
    renderizar(bolhaAtual, textoAtual)
    conversa.scrollTop = conversa.scrollHeight
  })

  const config = () => op.prefs().ia ?? {}

  /** Mostra o estado (provedor e modo) ou o convite para configurar. */
  async function atualizar() {
    const c = config()
    const p = provedorPorId(c.provedor)
    const chaves = await api.ia.chaves()
    const pronto = c.ativo && (!p.chave || chaves[p.id])
    subtitulo.textContent = pronto ? `${p.nome.replace(/ \(.*/, '')} · modo ${c.modo === 'livre' ? 'livre' : 'dica'}` : ''
    for (const b of [...acoes.children, entrada, enviar]) b.disabled = !pronto
    if (!pronto && !historico.length) {
      const ativar = el('button', { type: 'button', className: 'assistente-ativar', textContent: 'Ativar e configurar' })
      ativar.addEventListener('click', () => configurar())
      conversa.replaceChildren(el('div', { className: 'assistente-convite' },
        el('p', {}, el('b', { textContent: 'Uma IA para tirar dúvidas enquanto você programa.' })),
        el('p', { textContent: 'Ela explica o código, aponta o motivo de um erro e dá dicas sem entregar a resposta (modo dica).' }),
        el('p', { textContent: 'Funciona com Claude, ChatGPT/Codex, DeepSeek, Gemini e outros, usando a sua chave de API. Com o Ollama, a IA roda no seu computador e nada sai dele.' }),
        el('p', { className: 'assistente-nota', textContent: 'Vem desligado. O código só é enviado ao provedor quando você faz uma pergunta.' }),
        ativar,
      ))
    } else if (pronto && conversa.querySelector('.assistente-convite')) {
      conversa.replaceChildren()
    }
    return pronto
  }

  function bolha(classe, texto) {
    const b = el('div', { className: `assistente-msg ${classe}` })
    if (texto) renderizar(b, texto)
    conversa.append(b)
    conversa.scrollTop = conversa.scrollHeight
    return b
  }

  function emAndamento(sim) {
    painel.classList.toggle('enviando', sim)
    enviar.textContent = sim ? 'Parar' : 'Enviar'
    for (const b of acoes.children) b.disabled = sim
  }

  async function perguntar(pergunta, rotulo = pergunta) {
    if (enviando) return
    abrir()
    if (!(await atualizar())) return
    conversa.querySelector('.assistente-convite')?.remove()
    bolha('usuario', rotulo)
    historico.push({ role: 'user', content: pergunta })
    const mensagens = historico.map((m, i) => (i === historico.length - 1
      ? { role: 'user', content: `${contextoTexto(op.contexto())}\n\nPergunta: ${pergunta}` }
      : m))

    enviando = crypto.randomUUID()
    textoAtual = ''
    bolhaAtual = bolha('ia pensando')
    bolhaAtual.textContent = 'Pensando…'
    emAndamento(true)
    const r = await api.ia.perguntar({ id: enviando, mensagens })
    const b = bolhaAtual
    enviando = null
    bolhaAtual = null
    emAndamento(false)
    b.classList.remove('pensando')

    if (r.texto !== undefined) {
      renderizar(b, r.texto || '(sem resposta)')
      historico.push({ role: 'assistant', content: r.texto || '(sem resposta)' })
    } else if (r.cancelado && textoAtual) {
      historico.push({ role: 'assistant', content: textoAtual })
      b.append(el('p', { className: 'assistente-nota', textContent: '(resposta interrompida)' }))
    } else {
      historico.pop() // a conversa precisa alternar pergunta/resposta
      if (r.cancelado) b.remove()
      else {
        b.classList.add('erro')
        b.textContent = r.erro
      }
    }
    conversa.scrollTop = conversa.scrollHeight
  }

  function novaConversa() {
    if (enviando) api.ia.cancelar(enviando)
    historico.length = 0
    conversa.replaceChildren()
    atualizar()
  }

  async function configurar() {
    const c = config()
    const modelos = { ...c.modelos }
    const urls = { ...c.urls }
    const chavesNovas = {}
    let chaves = await api.ia.chaves()

    const ativo = el('input', { type: 'checkbox', checked: !!c.ativo })
    const provedor = el('select', {}, ...PROVEDORES.map((p) => el('option', { value: p.id, textContent: p.nome, selected: p.id === provedorPorId(c.provedor).id })))
    const modelo = el('input', { type: 'text' })
    const url = el('input', { type: 'text' })
    const chave = el('input', { type: 'password', autocomplete: 'off', spellcheck: false })
    const apagar = el('button', { type: 'button', className: 'acao', textContent: 'Apagar chave' })
    const site = el('button', { type: 'button', className: 'link-botao' })
    const linhaUrl = el('div', {}, el('label', { textContent: 'Endereço da API:' }), url)
    const linhaChave = el('div', {}, el('label', { textContent: 'Chave de API:' }), el('div', { className: 'linhas-2' }, chave, apagar), site)
    const modoDica = el('input', { type: 'radio', name: 'modo-ia', checked: c.modo !== 'livre' })
    const modoLivre = el('input', { type: 'radio', name: 'modo-ia', checked: c.modo === 'livre' })

    let atual = provedorPorId(c.provedor)
    const guardarCampos = () => {
      modelos[atual.id] = modelo.value.trim()
      urls[atual.id] = url.value.trim()
      if (chave.value.trim()) chavesNovas[atual.id] = chave.value.trim()
    }
    const mostrarCampos = () => {
      atual = provedorPorId(provedor.value)
      modelo.value = modelos[atual.id] || atual.modelo
      modelo.placeholder = atual.modelo || 'nome do modelo'
      url.value = urls[atual.id] || atual.url || ''
      url.placeholder = 'https://…/v1'
      linhaUrl.hidden = !(atual.id === 'ollama' || atual.id === 'outro')
      linhaChave.hidden = !atual.chave
      chave.value = chavesNovas[atual.id] ?? ''
      chave.placeholder = chaves[atual.id] ? '•••••••• (guardada; deixe em branco para manter)' : 'cole aqui a sua chave'
      apagar.hidden = !chaves[atual.id]
      site.hidden = !atual.site
      site.textContent = atual.site ? `Onde conseguir a chave: ${atual.site.replace('https://', '')}` : ''
    }
    provedor.addEventListener('change', () => { guardarCampos(); mostrarCampos() })
    site.addEventListener('click', () => api.abrirExterno(atual.site))
    apagar.addEventListener('click', async () => {
      chaves = await api.ia.gravarChave({ provedor: atual.id, chave: '' })
      delete chavesNovas[atual.id]
      mostrarCampos()
    })
    mostrarCampos()

    const corpo = el('div', { className: 'config-ia' },
      el('label', { className: 'config-ia-ativo' }, ativo, ' Ativar o Assistente de IA'),
      el('label', { textContent: 'Provedor:' }), provedor,
      el('label', { textContent: 'Modelo:' }), modelo,
      linhaUrl,
      linhaChave,
      el('fieldset', {},
        el('legend', { textContent: 'Como a IA ajuda' }),
        el('label', {}, modoDica, ' Modo dica: explica e dá pistas, sem entregar a resposta (recomendado para aulas)'),
        el('label', {}, modoLivre, ' Modo livre: pode mostrar o código corrigido'),
      ),
      el('p', { className: 'nota', textContent: 'Privacidade: o código aberto, o último erro e a sua pergunta vão direto do seu computador para o provedor escolhido, só quando você pergunta. A chave fica guardada criptografada neste computador. O provedor pode cobrar pelo uso da chave.' }),
    )
    const r = await janela({
      titulo: 'Assistente de IA',
      corpo,
      botoes: [{ valor: 'cancelar', texto: 'Cancelar' }, { valor: 'salvar', texto: 'Salvar', principal: true }],
      largura: '560px',
    })
    if (r !== 'salvar') return
    guardarCampos()
    for (const [p, k] of Object.entries(chavesNovas)) await api.ia.gravarChave({ provedor: p, chave: k })
    await op.gravarPrefs({ ia: { ativo: ativo.checked, provedor: atual.id, modelos, urls, modo: modoLivre.checked ? 'livre' : 'dica' } })
    if (aberto()) await atualizar()
  }

  const aberto = () => !painel.hidden

  function abrir() {
    if (aberto()) return
    painel.hidden = false
    painel.parentElement.classList.add('com-assistente')
    op.aoMudar?.(true)
    atualizar()
  }

  function fechar() {
    painel.hidden = true
    painel.parentElement.classList.remove('com-assistente')
    op.aoMudar?.(false)
  }

  return {
    abrir,
    fechar,
    aberto,
    configurar,
    alternar: () => (aberto() ? fechar() : abrir()),
    /** Botão "Perguntar à IA" do aviso de erro. */
    explicarErro: () => perguntar(ACOES[2][1], ACOES[2][0]),
  }
}
