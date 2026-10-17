// Liga a Sessao do interpretador à IDE: console MS-DOS, grade de variáveis,
// realce da linha em execução, passo a passo, timer, breakpoints e avisos.

import { TEXTOS, executar } from '@misteralg/interpreter'
import * as dialogos from './dialogos.js'

/** Itens do "Intervalo do timer" (cboInterval do VisuAlg) → milissegundos. */
export const INTERVALOS = [
  ['0,01s', 10], ['0,05s', 50], ['0,1 s', 100], ['0,2 s', 200], ['0,33s', 330], ['0,45s', 450], ['0,65s', 650],
  ['0,85s', 850], ['1,00 s', 1000], ['1,50 s', 1500], ['2,00 s', 2000], ['3,10 s', 3100], ['5,20 s', 5200],
]

const CORES = {
  BRANCO: '#ffffff', AMARELO: '#ffff00', VERMELHO: '#ff3030', VERDE: '#00e000',
  ROXO: '#c040ff', AZUL: '#4060ff', PRETO: '#000000',
}

/**
 * @param op { editor, status: {estado(t), mensagem(t)}, configuracao: () => ({ timerMs, aleatorio, arquivos }), aoMudarEstado(emExecucao) }
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

  const emExecucao = () => !!sessao && !sessao.terminado

  // ---- console ------------------------------------------------------------

  function escrever(texto) {
    const partes = texto.split('\f')
    partes.forEach((parte, i) => {
      if (i > 0) tela.replaceChildren()
      if (!parte) return
      const ultimo = tela.lastElementChild
      if (ultimo && ultimo.tagName === 'SPAN' && ultimo.dataset.cor === corTexto) ultimo.append(parte)
      else {
        const span = document.createElement('span')
        span.dataset.cor = corTexto
        span.style.color = corTexto
        span.textContent = parte
        tela.append(span)
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
      dialogos.aviso(erro, editor.textoDaLinha(erro.linha)).then(() => editor.focar())
    }
  }

  function novaSessao(modo) {
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

  /** F9 (continuo), F8 (passo) ou Shift+F9 (timer). */
  function iniciar(modo) {
    modoAtual = modo
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
    if (emExecucao()) sessao.parar()
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
      if (emExecucao()) sessao.breakpoints = new Set(linhas)
    },
    restaurar() {
      if (emExecucao()) sessao.parar()
      consoleEl.hidden = true
      corpoGrade.replaceChildren()
      visualizacao.textContent = ''
      editor.realcarExecucao(null)
      editor.realcarErro(null)
      status.mensagem('')
    },
    mostrarPilha: () => dialogos.pilha(emExecucao() ? sessao.pilha() : []),
    mostrarPerfil: () => dialogos.perfil(linhasDoPerfil, ultimoPerfil),
  }
}
