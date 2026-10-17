// Janelas auxiliares da IDE, no estilo dos formulários do VisuAlg.

const raiz = () => document.getElementById('dialogos')

/** Cria um <dialog> modal com título, corpo (Node) e botões. Resolve com o valor do botão. */
export function janela({ titulo, corpo, botoes = [{ valor: 'ok', texto: 'Fechar', principal: true }], largura }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog')
    d.className = 'janela'
    if (largura) d.style.width = largura
    const h = document.createElement('h2')
    h.className = 'janela-titulo'
    h.textContent = titulo
    const c = document.createElement('div')
    c.className = 'janela-corpo'
    c.append(corpo)
    const acoes = document.createElement('div')
    acoes.className = 'janela-acoes'
    for (const b of botoes) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `acao${b.principal ? ' principal' : ''}`
      btn.textContent = b.texto
      btn.addEventListener('click', () => d.close(b.valor))
      acoes.append(btn)
    }
    d.append(h, c, acoes)
    d.addEventListener('close', () => {
      d.remove()
      resolve(d.returnValue || 'cancelar')
    })
    raiz().append(d)
    d.showModal()
    const foco = d.querySelector('[autofocus]') ?? acoes.querySelector('.principal')
    foco?.focus()
  })
}

const el = (tag, props = {}, ...filhos) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...filhos.filter((f) => f !== null && f !== undefined))
  return e
}

// ---- Aviso (erro de análise ou de execução) -----------------------------------

const EXPLICACOES = {
  11: 'Toda variável precisa ser declarada na seção "var" antes de ser usada. Verifique a grafia do nome.',
  27: 'O valor tem um tipo diferente do tipo da variável. Use numpcarac() ou caracpnum() para converter números e textos.',
  43: 'Use uma expressão inteira como índice (por exemplo v[i] ou v[i \\ 2]); a divisão "/" sempre dá real.',
  46: 'Todo "se" precisa de "entao" na mesma linha da condição.',
  49: 'Digite um número. O separador decimal é o ponto (3.5), não a vírgula.',
  52: 'Divisão por zero, ou potência impossível (ex.: número negativo elevado a expoente fracionário).',
  100: 'O índice está fora da faixa declarada para o vetor. Confira os limites em "vetor[inicio..fim]".',
}

export function aviso(erro, textoLinha) {
  const corpo = el('div', {},
    el('div', { textContent: `O MisterALG encontrou o seguinte problema em seu algoritmo, na linha ${erro.linha} :` }),
    el('div', { className: 'aviso-mensagem', textContent: erro.mensagem }),
    el('label', { textContent: 'Conteúdo da linha:' }),
    el('input', { className: 'aviso-linha', value: textoLinha, readOnly: true }),
    el('label', { textContent: 'Explicação:' }),
    el('div', { className: 'aviso-explicacao', textContent: EXPLICACOES[erro.codigo] ?? 'Não há explicação disponível para este problema.' }),
  )
  return janela({ titulo: 'Aviso', corpo, botoes: [{ valor: 'ok', texto: 'Terminar', principal: true }], largura: '560px' })
}

// ---- Pilha de ativação (Ctrl+F3) e Perfil (F7) ----------------------------------

export function pilha(frames) {
  const corpo = frames.length
    ? el('div', { className: 'rolagem-dialogo' },
        el('table', { className: 'tabela-dialogo' },
          el('tbody', {}, ...frames.map((f) => el('tr', {}, el('td', {
            textContent: f.tipo === 'Corpo Principal do Programa'
              ? 'Corpo Principal do Programa'
              : `${f.tipo === 'Funcao' ? 'Função' : 'Procedimento'} : ${f.nome}(${f.assinatura ?? ''}) ; Retorno na linha ${f.linhaChamada}`,
          })))))
      )
    : el('p', { textContent: 'O algoritmo não está sendo executado' })
  return janela({ titulo: 'Pilha de Ativação', corpo, largura: '620px' })
}

export function perfil(linhas, contagem) {
  if (!contagem) return janela({ titulo: 'Perfil de execução', corpo: el('p', { textContent: 'O algoritmo ainda não foi executado.' }) })
  const mapa = new Map(contagem.map((c) => [c.linha, c.vezes]))
  const corpo = el('div', { className: 'rolagem-dialogo' },
    el('table', { className: 'tabela-dialogo' },
      el('thead', {}, el('tr', {}, el('th', { textContent: 'Linha' }), el('th', { textContent: 'Código' }), el('th', { textContent: 'Vezes' }))),
      el('tbody', {}, ...linhas.map((codigo, i) => el('tr', {},
        el('td', { textContent: String(i + 1).padStart(4) }),
        el('td', { textContent: codigo }),
        el('td', { textContent: String(mapa.get(i + 1) ?? 0).padStart(6) }),
      ))),
    ),
  )
  return janela({ titulo: 'Perfil de execução', corpo, largura: '640px' })
}

// ---- Configurações ------------------------------------------------------------

/** @param aoPrever(idTema) aplica o tema enquanto o usuário escolhe; quem chama desfaz se cancelar */
export async function configuracoes(prefs, { temas = [], aoPrever } = {}) {
  const fontes = [
    'Menlo', 'Monaco', 'SF Mono', 'Consolas', 'Lucida Console', 'DejaVu Sans Mono', 'Liberation Mono',
    'Ubuntu Mono', 'Noto Sans Mono', 'Courier New', 'Courier',
  ]
  const sel = (opcoes, atual) => el('select', {}, ...opcoes.map((o) => el('option', { value: String(o), textContent: String(o), selected: String(o) === String(atual) })))
  const fonte = sel(fontes.includes(prefs.fonte) ? fontes : [prefs.fonte, ...fontes], prefs.fonte)
  const tamanho = sel([10, 11, 12, 13, 14, 16, 18, 20], prefs.tamanho)
  const tab = sel([2, 3, 4, 5, 6, 7, 8], prefs.tabulacao)
  const disciplina = el('input', { value: prefs.disciplina })
  const professor = el('input', { value: prefs.professor })
  const entidade = el('input', { value: prefs.entidade })
  const tema = el('select', {}, ...temas.map((t) => el('option', { value: t.id, textContent: t.nome, selected: t.id === prefs.tema })))
  tema.addEventListener('change', () => aoPrever?.(tema.value))

  const abaEditor = el('div', { className: 'aba-conteudo' },
    el('label', { textContent: 'Tema (cores da tela):' }), tema,
    el('label', { textContent: 'Fonte:' }), fonte,
    el('label', { textContent: 'Tamanho:' }), tamanho,
    el('label', { textContent: 'Largura da Tabulação (colunas):' }), tab,
  )
  const abaPessoal = el('div', { className: 'aba-conteudo', hidden: true },
    el('label', { textContent: 'Disciplina:' }), disciplina,
    el('label', { textContent: 'Professor(a):' }), professor,
    el('label', { textContent: 'Entidade (escola/faculdade):' }), entidade,
    el('p', { textContent: 'Esses dados entram no cabeçalho do "Novo" algoritmo e na abreviatura "#".' }),
  )
  const btEditor = el('button', { type: 'button', textContent: 'Editor' })
  const btPessoal = el('button', { type: 'button', textContent: 'Personalizar' })
  const mostrar = (editor) => {
    abaEditor.hidden = !editor
    abaPessoal.hidden = editor
    btEditor.setAttribute('aria-selected', String(editor))
    btPessoal.setAttribute('aria-selected', String(!editor))
  }
  btEditor.addEventListener('click', () => mostrar(true))
  btPessoal.addEventListener('click', () => mostrar(false))
  mostrar(true)

  const r = await janela({
    titulo: 'Opções de configuração do ambiente',
    corpo: el('div', {}, el('div', { className: 'abas' }, btEditor, btPessoal), abaEditor, abaPessoal),
    botoes: [{ valor: 'cancelar', texto: 'Cancelar' }, { valor: 'ok', texto: 'OK', principal: true }],
    largura: '520px',
  })
  if (r !== 'ok') return null
  return {
    tema: tema.value,
    fonte: fonte.value,
    tamanho: Number(tamanho.value),
    tabulacao: Number(tab.value),
    disciplina: disciplina.value,
    professor: professor.value,
    entidade: entidade.value,
  }
}

// ---- Calculadora e Calendário (Manutenção) --------------------------------------

export function calculadora() {
  const visor = el('output', { textContent: '0' })
  let atual = '0'
  let acumulado = null
  let operacao = null
  let novo = true
  const mostrar = (v) => { visor.textContent = String(v) }
  const calcular = () => {
    const b = Number(atual)
    if (acumulado === null || !operacao) return b
    if (operacao === '/' && b === 0) return 'Divisão por zero'
    return { '+': acumulado + b, '-': acumulado - b, '*': acumulado * b, '/': acumulado / b }[operacao]
  }
  const tecla = (t) => {
    if (/\d/.test(t)) {
      atual = novo || atual === '0' ? t : atual + t
      novo = false
      mostrar(atual)
    } else if (t === '.') {
      if (novo) atual = '0'
      if (!atual.includes('.')) atual += '.'
      novo = false
      mostrar(atual)
    } else if (t === 'C') {
      atual = '0'; acumulado = null; operacao = null; novo = true
      mostrar(atual)
    } else if (t === '=') {
      const r = calcular()
      mostrar(r)
      atual = typeof r === 'number' ? String(Number(r.toFixed(10))) : '0'
      acumulado = null; operacao = null; novo = true
      if (typeof r === 'number') mostrar(atual)
    } else {
      const r = calcular()
      acumulado = typeof r === 'number' ? r : 0
      operacao = t
      novo = true
      mostrar(Number(acumulado.toFixed(10)))
    }
  }
  const teclas = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C']
  const grade = el('div', { className: 'calculadora' }, visor,
    ...teclas.map((t) => {
      const b = el('button', { type: 'button', textContent: t })
      b.addEventListener('click', () => tecla(t))
      return b
    }))
  return janela({ titulo: 'A calculadora', corpo: grade })
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function calendario(hoje = new Date()) {
  const ano = hoje.getFullYear()
  const meses = MESES.map((nome, m) => {
    const linhas = []
    let semana = []
    const primeiro = new Date(ano, m, 1).getDay()
    const dias = new Date(ano, m + 1, 0).getDate()
    for (let i = 0; i < primeiro; i += 1) semana.push(el('td'))
    for (let d = 1; d <= dias; d += 1) {
      const ehHoje = m === hoje.getMonth() && d === hoje.getDate()
      const domingo = (primeiro + d - 1) % 7 === 0
      semana.push(el('td', { textContent: String(d), className: [ehHoje && 'hoje', domingo && 'domingo'].filter(Boolean).join(' ') }))
      if (semana.length === 7) {
        linhas.push(el('tr', {}, ...semana))
        semana = []
      }
    }
    if (semana.length) linhas.push(el('tr', {}, ...semana))
    return el('div', { className: 'mes' }, el('h4', { textContent: nome }),
      el('table', {}, el('thead', {}, el('tr', {}, ...['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => el('th', { textContent: d })))), el('tbody', {}, ...linhas)))
  })
  return janela({ titulo: `Calendário de ${ano}`, corpo: el('div', { className: 'calendario' }, ...meses), largura: '760px' })
}

// ---- Termos de uso e privacidade ----------------------------------------------------

/** Mostra os termos. Com `exigirAceite`, resolve true só se a pessoa clicar "Aceito". */
export async function termos(texto, exigirAceite = false) {
  const corpo = el('div', {},
    exigirAceite ? el('p', { textContent: 'Antes de usar o MisterALG, leia os Termos de Uso e a Política de Privacidade:' }) : null,
    el('div', { className: 'termos', textContent: texto, tabIndex: 0 }),
  )
  const botoes = exigirAceite
    ? [{ valor: 'recusar', texto: 'Não aceito' }, { valor: 'aceitar', texto: 'Aceito', principal: true }]
    : [{ valor: 'ok', texto: 'Fechar', principal: true }]
  const r = await janela({ titulo: 'Termos de Uso e Política de Privacidade', corpo, botoes, largura: '720px' })
  return r === 'aceitar'
}

// ---- Sobre ------------------------------------------------------------------------

export function sobre(versao) {
  const corpo = el('div', { className: 'ajuda' },
    el('h3', { textContent: `MisterALG ${versao}` }),
    el('p', { textContent: 'Interpretador, editor e visualizador de algoritmos em Portugol para macOS.' }),
    el('p', { textContent: 'Inspirado no VisuAlg e compatível com a versão 3.0.7. O VisuAlg foi criado pelo Prof. Cláudio Morgado de Souza (até a versão 2.5) e continuado pelo Prof. Antonio Carlos Nicolodi (versão 3.0). Todo o crédito pela ideia é deles. O MisterALG é uma recriação independente: não contém código do original.' }),
    el('p', { textContent: 'Os programas .alg feitos no VisuAlg do Windows abrem e rodam aqui, e os salvos aqui continuam abrindo lá.' }),
    el('p', { textContent: 'Software livre sob a Licença MIT. Código-fonte: github.com/victinjr199xs-cyber/MisterALG' }),
  )
  return janela({
    titulo: 'Sobre o MisterALG',
    corpo,
    botoes: [{ valor: 'github', texto: 'Abrir no GitHub' }, { valor: 'ok', texto: 'Fechar', principal: true }],
    largura: '540px',
  }).then((r) => {
    if (r === 'github') window.misteralg.abrirExterno('https://github.com/victinjr199xs-cyber/MisterALG')
  })
}

export { el }
