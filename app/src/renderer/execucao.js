// Liga a Sessao do interpretador à IDE: console MS-DOS, grade de variáveis,
// realce da linha em execução, passo a passo, timer, breakpoints e avisos.

import { TEXTOS, executar } from '@misteralg/interpreter'
import { SessaoC } from '@misteralg/interpretador-c'
import { SessaoJSProxy } from './js/sessao-js.js'
import { criarMemoriaJS } from './js/memoria-js.js'
import * as dialogos from './dialogos.js'
import { criarMemoriaC } from './memoria-c.js'

/** Itens do "Intervalo do timer" (cboInterval do VisuAlg) → milissegundos. */
export const INTERVALOS = [
  ['0,01s', 10], ['0,05s', 50], ['0,1 s', 100], ['0,2 s', 200], ['0,33s', 330], ['0,45s', 450], ['0,65s', 650],
  ['0,85s', 850], ['1,00 s', 1000], ['1,50 s', 1500], ['2,00 s', 2000], ['3,10 s', 3100], ['5,20 s', 5200],
]

const CORES = {
  BRANCO: '#ffffff', AMARELO: '#ffff00', VERMELHO: '#ff3030', VERDE: '#00e000',
  ROXO: '#c040ff', AZUL: '#4060ff', PRETO: '#000000',
}

const api = window.misteralg

// ---- mensagens do clang em português ----------------------------------------------

/** "programa.c:5:3: error: x" → "linha 5, coluna 3: erro: x" (o resto da mensagem fica em inglês). */
const traduzirMensagens = (texto) => texto
  .replace(/programa\.(?:c|cpp):(\d+):(\d+): /g, 'linha $1, coluna $2: ')
  .replace(/\b(?:fatal error|error): /g, 'erro: ')
  .replace(/\bwarning: /g, 'aviso: ')
  .replace(/\bnote: /g, 'nota: ')
  .replace(/^\d+ (?:warnings?|errors?)(?: and \d+ (?:warnings?|errors?))? generated\.\n?/gm, '')

// Os erros que mais aparecem para quem está começando, explicados como no VisuAlg.
const EXPLICACOES_C = [
  [/expected ';'/, 'Faltou o ponto e vírgula (;) no fim do comando. Ele costuma faltar na linha de cima da que foi marcada.'],
  [/use of undeclared identifier/, 'Esse nome não foi declarado. Confira a grafia (maiúsculas contam) e se a variável foi declarada antes de ser usada.'],
  [/call to undeclared function|implicit declaration of function/, 'Função desconhecida: falta o #include da biblioteca dela, o nome está errado, ou ela foi escrita depois do main sem protótipo.'],
  [/expected '\}'/, 'Falta fechar uma chave }. Conte as chaves abertas e fechadas.'],
  [/expected '\)'/, 'Falta fechar um parêntese ).'],
  [/file not found/, 'Biblioteca não encontrada. Confira o nome no #include (por exemplo, <stdio.h> ou <iostream>).'],
  [/redefinition of/, 'Algo foi declarado duas vezes com o mesmo nome.'],
  [/no matching function for call/, 'Os argumentos não combinam com nenhuma versão dessa função: confira a quantidade e os tipos.'],
  [/invalid operands to binary expression/, 'Essa operação não vale para esses tipos (por exemplo, somar um texto com um número).'],
  [/incompatible (?:pointer|integer) (?:types|to pointer)/, 'Tipos incompatíveis: confira se não faltou ou sobrou um & ou * (no scanf, as variáveis levam &).'],
]
const EXPLICACAO_EXECUCAO = 'O programa compilou, mas parou no meio da execução. A causa mais comum é um ponteiro inválido, um índice fora do vetor ou uma divisão por zero.'

function primeiroErro(texto) {
  const m = /programa\.(?:c|cpp):(\d+):\d+: (?:fatal )?error: (.*)/.exec(texto)
  if (m) return { linha: Number(m[1]), mensagem: m[2], explicacao: EXPLICACOES_C.find(([re]) => re.test(m[2]))?.[1] }
  const ligador = /undefined symbol: (\S+)/.exec(texto)
  if (ligador) {
    return {
      linha: 0,
      mensagem: `Função usada mas nunca escrita: ${ligador[1]}`,
      explicacao: 'O programa chama uma função que não existe aqui: confira o nome, escreva a função, ou ela é de uma biblioteca que o MisterALG ainda não tem.',
    }
  }
  return { linha: 0, mensagem: texto.trim().split('\n')[0] || 'O programa não compilou.' }
}

/**
 * @param op { editor, status: {estado(t), mensagem(t)}, configuracao: () => ({ timerMs, aleatorio, arquivos }), aoMudarEstado(emExecucao), linguagem: () => id }
 */
export function criarExecucao(op) {
  const { editor, status } = op
  const consoleEl = document.getElementById('console')
  const tela = document.getElementById('console-tela')
  const visualizacao = document.getElementById('visualizacao')
  const corpoGrade = document.querySelector('#variaveis tbody')

  let sessao = null
  let corTexto = CORES.BRANCO
  let ultimoPerfil = null
  let linhasDoPerfil = []
  let valoresAnteriores = new Map()
  let modoAtual = 'continuo'

  let processo = null // C/C++ compilado (F9), ou a preparação do passo a passo: { id, rodando, terminado }

  const emExecucao = () => (!!sessao && !sessao.terminado) || (!!processo && !processo.terminado)

  // Passo a passo do C: a tela de memória toma o lugar da grade de variáveis.
  const memoriaC = criarMemoriaC(document.querySelector('.moldura-variaveis .grade-rolagem'))
  const molduraVariaveis = document.querySelector('.moldura-variaveis')
  const legendaVariaveis = molduraVariaveis.querySelector('.legenda')
  const legendaOriginal = legendaVariaveis.textContent
  let containerMemoriaJS = null
  let mostrarMemoriaJS = null

  function mostrarMemoria(sim, tipo = 'c') {
    document.getElementById('variaveis').hidden = sim
    if (tipo === 'c') {
      if (containerMemoriaJS) containerMemoriaJS.hidden = true
      legendaVariaveis.textContent = sim ? 'Memória do programa: pilha, heap e globais (setas = ponteiros)' : legendaOriginal
      if (sim) molduraVariaveis.querySelector('.grade-rolagem').appendChild(memoriaC.container)
      if (!sim) memoriaC.esconder()
    } else {
      if (!containerMemoriaJS) {
        const r = criarMemoriaJS()
        containerMemoriaJS = r.container
        mostrarMemoriaJS = r.mostrarFoto
      }
      if (memoriaC.container.parentNode) memoriaC.container.remove()
      legendaVariaveis.textContent = sim ? 'Pilha de chamadas, objetos e event loop' : legendaOriginal
      containerMemoriaJS.hidden = !sim
      if (sim && !containerMemoriaJS.parentNode) molduraVariaveis.querySelector('.grade-rolagem').appendChild(containerMemoriaJS)
    }
  }

  // ---- console ------------------------------------------------------------

  // A saída entra antes do campo de digitação, se houver (no C/C++ ele fica aberto o tempo todo).
  function escrever(texto) {
    const campo = tela.querySelector('.console-entrada')
    const partes = texto.split('\f')
    partes.forEach((parte, i) => {
      if (i > 0) {
        tela.replaceChildren(...(campo ? [campo] : []))
        campo?.focus()
      }
      if (!parte) return
      const ultimo = campo ? campo.previousElementSibling : tela.lastElementChild
      if (ultimo && ultimo.tagName === 'SPAN' && ultimo.dataset.cor === corTexto) ultimo.append(parte)
      else {
        const span = document.createElement('span')
        span.dataset.cor = corTexto
        span.style.color = corTexto
        span.textContent = parte
        tela.insertBefore(span, campo)
      }
    })
    tela.scrollTop = tela.scrollHeight
  }

  function mudarCor(cor, posicao) {
    const valor = CORES[cor] ?? CORES.BRANCO
    if (posicao === 'FRENTE') corTexto = valor
    else tela.style.background = valor
  }

  function pedirEntrada() {
    const campo = document.createElement('input')
    campo.className = 'console-entrada'
    campo.setAttribute('aria-label', 'Entrada de dados do leia')
    campo.style.color = corTexto
    campo.size = 1
    campo.addEventListener('input', () => { campo.size = Math.max(1, campo.value.length + 1) })
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const valor = campo.value
        campo.remove()
        status.mensagem(' MENSAGEM: Executando o algoritmo...')
        if (sessao instanceof SessaoC) escrever(`${valor}\n`) // no C, o eco é do terminal (o Portugol escreve ele mesmo)
        sessao?.fornecerEntrada(valor)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        campo.remove()
        sessao?.fornecerEntrada(null)
      }
    })
    tela.append(campo)
    tela.scrollTop = tela.scrollHeight
    campo.focus()
    status.mensagem(' MENSAGEM: Digite o valor e tecle <Enter> (Esc termina a execução)')
  }

  function abrirConsole() {
    tela.replaceChildren()
    tela.style.background = ''
    corTexto = CORES.BRANCO
    consoleEl.hidden = false
  }

  function fecharConsole() {
    if (consoleEl.hidden) return
    visualizacao.textContent = tela.textContent
    consoleEl.hidden = true
    editor.focar()
  }

  // ---- grade de variáveis -----------------------------------------------------

  function mostrarVariaveis({ globais, locais }) {
    const linhas = [...globais, ...locais]
    const novos = new Map()
    let primeiraModificada = null
    const frag = document.createDocumentFragment()
    for (const v of linhas) {
      const chave = `${v.escopo}|${v.nome}`
      novos.set(chave, v.valor)
      const tr = document.createElement('tr')
      const mudou = valoresAnteriores.size > 0 && valoresAnteriores.get(chave) !== v.valor
      if (mudou) {
        tr.className = 'modificada'
        primeiraModificada ??= tr
      }
      for (const texto of [v.escopo, v.nome, v.tipo, v.valor]) {
        const td = document.createElement('td')
        td.textContent = texto
        tr.append(td)
      }
      frag.append(tr)
    }
    valoresAnteriores = novos
    corpoGrade.replaceChildren(frag)
    if (primeiraModificada && modoAtual !== 'continuo') primeiraModificada.scrollIntoView({ block: 'nearest' })
  }

  // ---- ciclo de execução ----------------------------------------------------------

  function terminou(estadoFinal, erro) {
    editor.realcarExecucao(null)
    editor.somenteLeitura(false)
    tela.querySelector('.console-entrada')?.remove()
    const quebra = tela.textContent.endsWith('\n') || tela.textContent === '' ? '' : '\n'
    if (estadoFinal === 'terminado') escrever(`${quebra}\n${TEXTOS.fimPrograma}`)
    else if (estadoFinal === 'parado') escrever(`${quebra}${TEXTOS.terminadoUsuario}`)
    else if (estadoFinal === 'erro') escrever(`${quebra}${TEXTOS.terminadoErro}`)
    status.estado()
    status.mensagem(TEXTOS.rodapeConsole)
    op.aoMudarEstado(false)
    if (estadoFinal === 'erro' && erro) {
      editor.realcarErro(erro.linha)
      op.aoErro?.(erro)
      dialogos.aviso(erro, editor.textoDaLinha(erro.linha), op.iaAtiva?.()).then((r) => (r === 'ia' ? op.aoPedirIA() : editor.focar()))
    }
  }

  function novaSessao(modo) {
    mostrarMemoriaC(false)
    const config = op.configuracao()
    const fonte = editor.texto()
    linhasDoPerfil = fonte.split('\n')
    valoresAnteriores = new Map()
    corpoGrade.replaceChildren()
    visualizacao.textContent = ''
    abrirConsole()
    editor.realcarErro(null)
    editor.somenteLeitura(true)
    status.estado(' Executando ')
    status.mensagem(` MENSAGEM: ${TEXTOS.inicio}`)
    op.aoMudarEstado(true)

    sessao = executar(fonte, {
      modo,
      timerMs: config.timerMs,
      breakpoints: editor.breakpoints(),
      aleatorio: config.aleatorio,
      listas: config.listas,
      arquivos: config.arquivos,
      perfil: true,
      onOutput: escrever,
      onStep: ({ linha }) => {
        editor.realcarExecucao(linha)
        if (sessao?.estado === 'pausado') {
          status.mensagem(` MENSAGEM: Pausado na linha ${linha} — F8 executa a linha, F9 continua, Ctrl+F2 para`)
        }
      },
      onVariables: mostrarVariaveis,
      onWaitInput: pedirEntrada,
      onColor: mudarCor,
      onProfile: (p) => { ultimoPerfil = p },
      onEnd: terminou,
    })
  }

  // ---- C e C++: compilados pelo clang (main/clang.js) e rodando num processo à parte ----

  function avisoNaGrade(texto) {
    const td = Object.assign(document.createElement('td'), { colSpan: 4, className: 'grade-aviso', textContent: texto })
    const tr = document.createElement('tr')
    tr.append(td)
    corpoGrade.replaceChildren(tr)
  }

  /** Campo de digitação que fica aberto enquanto o programa roda, como num terminal. */
  function entradaContinua(id) {
    const campo = document.createElement('input')
    campo.className = 'console-entrada'
    campo.setAttribute('aria-label', 'Entrada do programa')
    campo.size = 1
    campo.addEventListener('input', () => { campo.size = Math.max(1, campo.value.length + 1) })
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const linha = `${campo.value}\n`
        campo.value = ''
        campo.size = 1
        escrever(linha) // eco do que foi digitado, como no terminal
        api.clang.entrada({ id, texto: linha })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        parar()
      }
    })
    tela.append(campo)
    campo.focus()
  }

  api.clang.aoEvento((id, ev) => {
    if (processo?.id !== id || processo.terminado) return
    if (ev.tipo === 'saida' || ev.tipo === 'erro') escrever(ev.texto)
    else if (ev.tipo === 'fim') {
      processo.terminado = true
      if (ev.erroExecucao) {
        terminou('erro', { linha: 0, mensagem: `Erro em tempo de execução: ${ev.erroExecucao}`, explicacao: EXPLICACAO_EXECUCAO })
      } else if (ev.parado) terminou('parado')
      else {
        if (ev.codigo) escrever(`${tela.textContent.endsWith('\n') ? '' : '\n'}(o programa terminou com o código ${ev.codigo})\n`)
        terminou('terminado')
      }
    }
  })

  async function iniciarCompilado(linguagem, modo) {
    const id = crypto.randomUUID()
    processo = { id, rodando: false, terminado: false }
    mostrarMemoriaC(false)
    avisoNaGrade('O F9 roda o programa de verdade (rápido). Para ver a memória, os ponteiros, os objetos e cada linha, use o passo a passo (F8).')
    visualizacao.textContent = ''
    abrirConsole()
    editor.realcarErro(null)
    editor.somenteLeitura(true)
    op.aoMudarEstado(true)
    status.estado(' Compilando ')
    status.mensagem(` MENSAGEM: Compilando com o clang…${modo === 'continuo' ? '' : ' (o passo a passo do C/C++ ainda vai chegar; o programa roda direto)'}`)
    corTexto = CORES.AMARELO
    escrever(`Compilando o programa em ${linguagem === 'cpp' ? 'C++' : 'C'}…\n`)
    corTexto = CORES.BRANCO

    const r = await api.clang.executar({ id, linguagem, fonte: editor.texto() })
    if (processo?.id !== id || processo.terminado || r.cancelado) return // parado durante a compilação
    tela.replaceChildren()
    if (r.erros !== undefined) {
      processo.terminado = true
      corTexto = CORES.VERMELHO
      escrever(traduzirMensagens(r.erros))
      corTexto = CORES.BRANCO
      terminou('erro', primeiroErro(r.erros))
      return
    }
    if (r.avisos?.trim()) {
      corTexto = CORES.AMARELO
      escrever(`${traduzirMensagens(r.avisos)}\n`)
      corTexto = CORES.BRANCO
    }
    processo.rodando = true
    status.estado(' Executando ')
    status.mensagem(' MENSAGEM: Digite no console e tecle <Enter> para enviar ao programa (Esc para)')
    entradaContinua(id)
  }

  /** F8 (ou F9 com pontos de parada) em JavaScript: executa o código instrumentado linha a linha. */
  function iniciarPassoJS(modo, linguagem) {
    const fonte = editor.texto()
    tela.replaceChildren()
    abrirConsole()
    editor.realcarErro(null)
    editor.somenteLeitura(true)
    op.aoMudarEstado(true)
    mostrarMemoria(true, 'js')
    const config = op.configuracao()
    sessao = new SessaoJSProxy(fonte, {
      typescript: linguagem === 'typescript',
      modo,
      timerMs: config.timerMs,
      breakpoints: editor.breakpoints(),
      onOutput: escrever,
      onStep: ({ linha }) => {
        editor.realcarExecucao(linha)
        if (sessao?.estado === 'pausado') status.mensagem(` MENSAGEM: Pausado na linha ${linha} — F8 executa a linha, F9 continua, Ctrl+F2 para`)
      },
      onMemory: mostrarMemoriaJS,
      onWaitInput: () => pedirEntrada(),
      onEnd: (estado, erro) => terminou(estado === 'parado' ? 'parado' : estado, erro),
    })
    status.estado(' Executando ')
    if (modo === 'passo') sessao.passo()
    else sessao.continuar()
  }

  /** F8 (ou F9 com pontos de parada) no C: o clang gera a árvore e a SessaoC a executa linha a linha. */
  async function iniciarPassoC(modo, linguagem) {
    const fonte = editor.texto()
    const pedido = { id: 'arvore', rodando: false, terminado: false }
    processo = pedido
    avisoNaGrade('Preparando o passo a passo…')
    visualizacao.textContent = ''
    abrirConsole()
    editor.realcarErro(null)
    editor.somenteLeitura(true)
    op.aoMudarEstado(true)
    status.estado(' Preparando ')
    status.mensagem(' MENSAGEM: Analisando o programa para o passo a passo…')
    const cancelado = () => processo !== pedido || pedido.terminado
    const r = await api.clang.arvore({ fonte, linguagem })
    if (cancelado()) return
    if (r.erros !== undefined) {
      // O programa está errado, ou usa algo que o passo a passo ainda não conhece? O compilador de verdade decide.
      const real = await api.clang.verificar({ linguagem, fonte })
      if (cancelado()) return
      pedido.terminado = true
      if (real.erros !== undefined) {
        corTexto = CORES.VERMELHO
        escrever(traduzirMensagens(real.erros))
        corTexto = CORES.BRANCO
        return terminou('erro', primeiroErro(real.erros))
      }
      const motivo = /'([^']+)' file not found/.exec(r.erros)?.[1] ?? /undeclared (?:function|identifier) '([^']+)'/.exec(r.erros)?.[1]
      return terminou('erro', {
        linha: primeiroErro(r.erros).linha,
        mensagem: `O passo a passo ainda não conhece ${motivo ? `"${motivo}"` : 'uma parte deste programa'}.`,
        explicacao: `O passo a passo do ${linguagem === 'cpp' ? 'C++' : 'C'} usa uma biblioteca própria, menor que a de verdade. Rode com F9: ele usa o compilador completo, com toda a biblioteca padrão.`,
      })
    }
    pedido.terminado = true
    processo = null
    tela.replaceChildren()
    mostrarMemoriaC(true)
    const config = op.configuracao()
    sessao = new SessaoC(r.ast, fonte, {
      cpp: linguagem === 'cpp',
      modo,
      timerMs: config.timerMs,
      breakpoints: editor.breakpoints(),
      onOutput: escrever,
      onStep: ({ linha }) => {
        editor.realcarExecucao(linha)
        if (sessao?.estado === 'pausado') status.mensagem(` MENSAGEM: Pausado na linha ${linha} — F8 executa a linha, F9 continua, Ctrl+F2 para`)
      },
      onMemory: (maq) => memoriaC.mostrar(maq),
      onWaitInput: () => pedirEntrada(),
      onEnd: (estado, erro) => terminou(estado === 'limite' ? 'parado' : estado, erro),
    })
    status.estado(' Executando ')
    if (modo === 'passo') sessao.passo()
    else sessao.continuar()
  }

  function pararCompilado() {
    api.clang.parar(processo.id)
    if (!processo.rodando) {
      processo.terminado = true
      terminou('parado')
    }
  }

  /** F9 (continuo), F8 (passo) ou Shift+F9 (timer). */
  function iniciar(modo) {
    modoAtual = modo
    const linguagem = op.linguagem?.() ?? 'portugol'
    // JS/TS: sempre passo a passo (não há F9 compilado)
    if ((linguagem === 'javascript' || linguagem === 'typescript') && !(sessao instanceof SessaoJSProxy && !sessao.terminado)) {
      if (emExecucao()) return
      iniciarPassoJS(modo, linguagem)
      return
    }
    // C/C++ parado no meio do passo a passo segue pelo caminho de baixo (a SessaoC é igual à do Portugol).
    if (linguagem !== 'portugol' && !(sessao instanceof SessaoC && !sessao.terminado)) {
      if (emExecucao()) return
      // F9 sem pontos de parada roda o programa compilado de verdade; F8, Shift+F9 ou pontos de parada usam o passo a passo.
      if (modo !== 'continuo' || editor.breakpoints().size) iniciarPassoC(modo, linguagem)
      else iniciarCompilado(linguagem, modo)
      return
    }
    if (emExecucao()) {
      if (sessao.estado === 'pausado') {
        sessao.modo = modo
        editor.realcarExecucao(null)
        if (modo === 'passo') sessao.passo()
        else sessao.continuar()
      } else if (sessao.estado === 'rodando') {
        sessao.modo = modo
        if (modo === 'passo') sessao.pararNaProxima = true
      }
      return
    }
    novaSessao(modo)
    if (modo === 'passo') sessao.passo()
    else sessao.continuar()
  }

  function parar() {
    if (processo && !processo.terminado) pararCompilado()
    else if (emExecucao()) sessao.parar()
    else status.mensagem(` MENSAGEM: ${TEXTOS.jaTerminado}`)
  }

  return {
    iniciar,
    parar,
    emExecucao,
    fecharConsole,
    /** Esc: fecha o console depois que o programa termina. */
    teclaEsc() {
      if (!emExecucao() && !consoleEl.hidden) {
        fecharConsole()
        status.mensagem('')
        return true
      }
      return false
    },
    atualizarBreakpoints(linhas) {
      if (sessao && !sessao.terminado) sessao.breakpoints = new Set(linhas)
    },
    restaurar() {
      if (emExecucao()) parar()
      consoleEl.hidden = true
      mostrarMemoriaC(false)
      corpoGrade.replaceChildren()
      visualizacao.textContent = ''
      editor.realcarExecucao(null)
      editor.realcarErro(null)
      status.mensagem('')
    },
    mostrarPilha: () => dialogos.pilha(sessao && !sessao.terminado ? sessao.pilha() : []),
    mostrarPerfil: () => dialogos.perfil(linhasDoPerfil, ultimoPerfil),
  }
}
