// Liga a Sessao do interpretador à IDE: console MS-DOS, grade de variáveis,
// realce da linha em execução, passo a passo, timer, breakpoints e avisos.

import { TEXTOS, executar } from '@misteralg/interpreter'
import { SessaoC } from '@misteralg/interpretador-c'
import { SessaoJSProxy } from './js/sessao-js.js'
import { criarMemoriaObjetos } from './memoria-objetos.js'
import { SessaoCS } from '@misteralg/interpretador-csharp'
import { SessaoPython } from './python/sessao-python.js'
import { criarPrevia } from './previa.js'
import * as dialogos from './dialogos.js'
import { tradutor } from '../compartilhado/idiomas.js'
import { criarMemoriaC } from './memoria-c.js'
import { criarMemoriaBanco } from './memoria-banco.js'
import { SessaoSQL } from './sql/sessao-sql.js'
import { criarConsole } from './console.js'
import { consoleVisualg, dividirLinhas } from './console-logica.js'
import { linhaCorrigida } from './aviso-logica.js'

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
  const t = (...a) => tradutor(op.idioma?.() ?? 'pt')(...a)
  // Atalhos com o foco na janela própria do console (lá não há menu): F9, F8, Shift+F9, Ctrl+F2 e Esc.
  function teclaDaJanela(e) {
    const id = api.plataforma !== 'darwin' && ({ F9: e.shiftKey ? 'timer' : 'executar', F8: 'passo' }[e.key] ?? (e.key === 'F2' && e.ctrlKey ? 'parar' : null))
    if (id) {
      e.preventDefault()
      op.rodar?.(id)
    } else if (e.key === 'Escape' && teclaEscape()) e.preventDefault()
  }
  const cons = criarConsole({
    el: consoleEl,
    tela,
    t,
    idioma: () => op.idioma?.() ?? 'pt',
    pref: () => op.consoleEmJanela?.(),
    visualg: () => consoleVisualg(op.consolePortugol?.(), op.linguagem?.() ?? 'portugol', op.emTutorial?.()),
    plataforma: api.plataforma,
    api,
    programa: () => op.programa?.() ?? { nome: t('sem nome'), linguagem: op.linguagem?.() ?? 'portugol' },
    rodar: (id) => op.rodar?.(id),
    aoParar: () => parar(),
    aoFechar: () => fecharConsole(),
    aoIrParaLinha: (n) => { editor.irParaLinha(n); window.focus() },
    aoTecla: teclaDaJanela,
    emTutorial: () => op.emTutorial?.(),
  })
  const corpoGrade = document.querySelector('#variaveis tbody')

  let sessao = null
  let corTexto = CORES.BRANCO
  let ultimoPerfil = null
  let linhasDoPerfil = []
  let valoresAnteriores = new Map()
  let modoAtual = 'continuo'

  let processo = null // C/C++ compilado (F9), ou a preparação do passo a passo: { id, rodando, terminado }

  const emExecucao = () => (!!sessao && !sessao.terminado) || (!!processo && !processo.terminado)

  // Quem acompanha a execução de fora (o tutorial): 'inicio', 'pausa' { linha }, 'fim' { estado } e 'pagina' (PHP).
  const ouvintes = new Set()
  const avisar = (tipo, dados = {}) => { for (const f of ouvintes) f(tipo, dados) }
  const comecou = () => {
    op.aoMudarEstado(true)
    avisar('inicio')
  }

  // Passo a passo do C: a tela de memória toma o lugar da grade de variáveis.
  const memoriaC = criarMemoriaC(document.querySelector('.moldura-variaveis .grade-rolagem'))
  const molduraVariaveis = document.querySelector('.moldura-variaveis')
  const legendaVariaveis = molduraVariaveis.querySelector('.legenda')
  const legendaOriginal = legendaVariaveis.textContent
  // JS e Python usam a mesma tela de objetos (pilha de chamadas, objetos ligados por setas e, no JS, as filas).
  let memoriaObjetos = null
  const LEGENDAS = {
    c: 'Memória do programa: pilha, heap e globais (setas = ponteiros)',
    objetos: 'Pilha de chamadas e objetos (setas = referências)',
  }
  const LEGENDAS_EN = { c: 'Memory: stack, heap and globals', objetos: 'Call stack and objects', banco: 'Database' }
  let memoriaBanco = null // SQL: as tabelas do banco no lugar da grade

  /** qual: 'c', 'objetos', 'banco' ou null (a grade de variáveis do Portugol). */
  function mostrarPainel(qual) {
    document.getElementById('variaveis').hidden = qual !== null
    const ingles = document.body.classList.contains('modo-codigo')
    legendaVariaveis.textContent = (ingles ? LEGENDAS_EN : LEGENDAS)[qual] ?? (ingles ? 'Variables' : legendaOriginal)
    if (qual !== 'c') memoriaC.esconder()
    if (qual === 'objetos') {
      memoriaObjetos ??= criarMemoriaObjetos(molduraVariaveis.querySelector('.grade-rolagem'))
      memoriaObjetos.mostrarFoto(null)
      memoriaObjetos.container.hidden = false
    } else if (memoriaObjetos) {
      memoriaObjetos.container.hidden = true
    }
    if (qual === 'banco') {
      memoriaBanco ??= criarMemoriaBanco(molduraVariaveis.querySelector('.grade-rolagem'))
      memoriaBanco.limpar()
      memoriaBanco.container.hidden = false
    } else if (memoriaBanco) {
      memoriaBanco.container.hidden = true
    }
  }
  const mostrarMemoriaC = (sim) => mostrarPainel(sim ? 'c' : null)
  const mostrarMemoriaObjetos = (foto) => memoriaObjetos?.mostrarFoto(foto)

  // ---- console ------------------------------------------------------------

  // A saída entra antes do campo de digitação, se houver (no C/C++ ele fica aberto o tempo todo).
  // Limite por execução: um laço infinito de escreva não pode travar a janela enchendo o DOM.
  const LIMITE_SAIDA = 500_000
  let emitidos = 0
  let cortou = false
  function escrever(texto) {
    emitidos += texto.length
    if (emitidos > LIMITE_SAIDA) {
      if (cortou) return
      cortou = true
      const cor = corTexto
      corTexto = CORES.AMARELO
      escreverBruto(`\n${t('… saída cortada (mais de 500 mil caracteres)')}\n`)
      corTexto = cor
      return
    }
    cons.contar(texto)
    escreverBruto(texto)
  }
  /** Erros em vermelho: "linha N" (Portugol, clang, C#, traceback do Python) vira link para a linha do editor. */
  function anexar(span, parte) {
    if (!span.classList.contains('saida-erro')) return span.append(parte)
    for (const p of dividirLinhas(parte)) span.append(p.linha ? cons.linkLinha(p) : p.texto)
  }
  function escreverBruto(texto) {
    const campo = tela.querySelector('.console-entrada')
    const partes = texto.split('\f')
    partes.forEach((parte, i) => {
      if (i > 0) {
        tela.replaceChildren(...(campo ? [campo] : []))
        campo?.focus()
      }
      if (!parte) return
      const ultimo = campo ? campo.previousElementSibling : tela.lastElementChild
      if (ultimo && ultimo.tagName === 'SPAN' && ultimo.dataset.cor === corTexto) anexar(ultimo, parte)
      else {
        const span = document.createElement('span')
        span.dataset.cor = corTexto
        if (corTexto !== CORES.BRANCO) span.style.color = corTexto // o branco padrão é a cor do tema do console
        // classe semântica; vermelho = erro, amarelo = aviso
        if (corTexto === CORES.VERMELHO) span.className = 'saida-erro'
        else if (corTexto === CORES.AMARELO) span.className = 'saida-aviso'
        anexar(span, parte)
        tela.insertBefore(span, campo)
      }
    })
    tela.scrollTop = tela.scrollHeight
  }

  function mudarCor(cor, posicao) {
    const valor = CORES[cor] ?? (/^#[0-9a-f]{6}$/i.test(cor) ? cor : CORES.BRANCO)
    if (posicao === 'FRENTE') corTexto = valor
    else tela.style.background = valor
  }

  /** O campo cresce com o texto; ↑/↓ percorrem o que foi digitado antes nesta sessão do app. */
  function ligarCampo(campo) {
    campo.size = 1
    campo.autocomplete = 'off'
    campo.spellcheck = false
    const ajustar = () => { campo.size = Math.max(1, campo.value.length + 1) }
    campo.addEventListener('input', ajustar)
    campo.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const valor = e.key === 'ArrowUp' ? cons.historico.anterior(campo.value) : cons.historico.proximo()
      if (valor === null) return
      campo.value = valor
      ajustar()
      campo.setSelectionRange(valor.length, valor.length)
    })
  }

  function pedirEntrada() {
    const campo = document.createElement('input')
    campo.className = 'console-entrada'
    campo.setAttribute('aria-label', 'Entrada de dados do leia')
    if (corTexto !== CORES.BRANCO) campo.style.color = corTexto
    ligarCampo(campo)
    cons.estadoAtual('aguardando')
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const valor = campo.value
        cons.historico.adicionar(valor)
        cons.estadoAtual('rodando')
        campo.remove()
        status.mensagem(' MENSAGEM: Executando o algoritmo...')
        // Fora do Portugol, o eco é do terminal (o Portugol escreve ele mesmo).
        if (sessao instanceof SessaoC || sessao instanceof SessaoJSProxy || sessao instanceof SessaoPython || sessao instanceof SessaoCS) escrever(`${valor}\n`)
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
    emitidos = 0
    cortou = false
    tela.replaceChildren()
    tela.style.background = ''
    corTexto = CORES.BRANCO
    consoleEl.hidden = false
    cons.comecar() // cabeçalho, relógio e, se for o caso, a janela própria
  }

  function fecharConsole() {
    if (consoleEl.hidden) return
    visualizacao.textContent = tela.textContent
    consoleEl.hidden = true
    cons.aoEsconder()
    window.focus()
    editor.focar()
  }

  // ---- grade de variáveis -----------------------------------------------------

  function categoriaTipo(tipo) {
    const t = String(tipo ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (t.startsWith('vetor') || t.includes('[')) return 'vetor'
    if (/^(inteiro|int|long)\b/.test(t)) return 'inteiro'
    if (/^(real|double|float)\b/.test(t)) return 'real'
    if (/^(caractere|char|string|str)\b/.test(t)) return 'caractere'
    if (/^(logico|bool|boolean)\b/.test(t)) return 'logico'
    return 'outro'
  }

  // Vetores em caixinhas (valor + índice) na disposição moderna e nos temas novos; no clássico ficam as linhas do VisuAlg.
  const TEMAS_NOVOS = new Set(['noite', 'papel', 'hibrido-claro', 'hibrido-escuro'])
  const MAX_CAIXAS = 20
  const agruparVetores = () => document.documentElement.dataset.disposicao === 'moderna' || TEMAS_NOVOS.has(document.documentElement.dataset.tema)

  /** Linha única de um vetor de uma dimensão: o interpretador manda um elemento por linha (V[1], V[2]...); a matriz (V[1,2]) continua em texto. */
  function linhaDeVetor(g, mudouItem) {
    const tr = document.createElement('tr')
    tr.className = 'vetor-linha'
    const mudados = g.itens.filter((it) => mudouItem(it))
    if (mudados.length > 1) tr.classList.add('modificada')
    const caixas = document.createElement('div')
    caixas.className = 'caixinhas'
    for (const it of g.itens.slice(0, MAX_CAIXAS)) {
      const c = document.createElement('span')
      c.className = 'caixa'
      if (mudados.length === 1 && mudados[0] === it) c.classList.add('mudou')
      c.append(Object.assign(document.createElement('b'), { textContent: it.valor }), Object.assign(document.createElement('i'), { textContent: it.indice }))
      caixas.append(c)
    }
    if (g.itens.length > MAX_CAIXAS) caixas.append(Object.assign(document.createElement('span'), { className: 'caixas-mais', textContent: `…+${g.itens.length - MAX_CAIXAS}` }))
    // O painel da memória é estreito: o vetor vira um cartão de largura total (escopo, nome e tipo em cima; caixinhas embaixo).
    const nome = `${g.base}[${g.itens[0].indice}..${g.itens.at(-1).indice}]`
    const pilula = Object.assign(document.createElement('span'), { className: 'pilula-tipo', textContent: 'vetor' })
    pilula.dataset.tipo = 'vetor'
    const cab = document.createElement('div')
    cab.className = 'vetor-cab'
    cab.append(Object.assign(document.createElement('span'), { className: 'vetor-escopo', textContent: g.escopo }), Object.assign(document.createElement('b'), { textContent: nome }), pilula)
    const td = Object.assign(document.createElement('td'), { colSpan: 4 })
    td.append(cab, caixas)
    tr.append(td)
    return tr
  }

  function mostrarVariaveis({ globais, locais }) {
    const linhas = [...globais, ...locais]
    const novos = new Map()
    let primeiraModificada = null
    const frag = document.createDocumentFragment()
    const agrupar = agruparVetores()
    const mudouChave = (chave, valor) => valoresAnteriores.size > 0 && valoresAnteriores.get(chave) !== valor
    const entradas = []
    for (const v of linhas) {
      const chave = `${v.escopo}|${v.nome}`
      novos.set(chave, v.valor)
      const m = agrupar ? /^(.+)\[([^\],]+)\]$/.exec(v.nome) : null
      if (!m) { entradas.push({ v, chave }); continue }
      const item = { indice: m[2], valor: v.valor, chave }
      const ant = entradas.at(-1)
      if (ant?.grupo && ant.escopo === v.escopo && ant.base === m[1]) ant.itens.push(item)
      else entradas.push({ grupo: true, escopo: v.escopo, base: m[1], tipo: v.tipo, itens: [item] })
    }
    for (const e of entradas) {
      if (e.grupo) {
        const tr = linhaDeVetor(e, (it) => mudouChave(it.chave, it.valor))
        primeiraModificada ??= tr.classList.contains('modificada') ? tr : tr.querySelector('.mudou')
        frag.append(tr)
        continue
      }
      const { v, chave } = e
      const tr = document.createElement('tr')
      const mudou = mudouChave(chave, v.valor)
      if (mudou) {
        tr.className = 'modificada'
        primeiraModificada ??= tr
      }
      for (const [i, texto] of [v.escopo, v.nome, v.tipo, v.valor].entries()) {
        const td = document.createElement('td')
        if (i === 2) {
          const pilula = document.createElement('span')
          pilula.className = 'pilula-tipo'
          pilula.dataset.tipo = categoriaTipo(texto)
          pilula.textContent = texto
          td.append(pilula)
        } else td.textContent = texto
        tr.append(td)
      }
      frag.append(tr)
    }
    valoresAnteriores = novos
    corpoGrade.replaceChildren(frag)
    if (primeiraModificada && modoAtual !== 'continuo') primeiraModificada.scrollIntoView({ block: 'nearest' })
  }

  // ---- ciclo de execução ----------------------------------------------------------

  /** Resumo do erro no console, com "Erro na linha N" clicável (se a saída ainda não mostrou os erros em vermelho). */
  function resumoDoErro(erro) {
    const span = document.createElement('span')
    span.className = 'saida-erro'
    span.dataset.cor = CORES.VERMELHO
    if (erro.linha > 0) span.append(cons.linkLinha({ texto: t('Erro na linha {0}', erro.linha), linha: erro.linha }), ': ')
    span.append(`${erro.mensagem}\n`)
    tela.append(span)
  }

  function terminou(estadoFinal, erro, codigo = 0) {
    editor.realcarExecucao(null)
    editor.somenteLeitura(false)
    tela.querySelector('.console-entrada')?.remove()
    const quebra = tela.textContent.endsWith('\n') || tela.textContent === '' ? '' : '\n'
    // Nas linguagens de programação (modo-codigo, main.js) o terminal fala inglês, como os de verdade.
    const ingles = document.body.classList.contains('modo-codigo')
    cons.estadoAtual({ terminado: 'finalizado', erro: 'erro' }[estadoFinal] ?? 'parado', { codigo: estadoFinal === 'erro' ? 1 : codigo, linha: erro?.linha })
    if (quebra) escreverBruto(quebra)
    if (cons.visualg) {
      // Como no VisuAlg: texto simples, uma linha em branco e as duas mensagens finais.
      corTexto = CORES.BRANCO
      const fim = { erro: t(TEXTOS.terminadoErro), parado: t(TEXTOS.terminadoUsuario) }[estadoFinal] ?? t('*** Fim da execução.')
      escreverBruto(`\n${fim}\n${t('*** Feche esta janela para retornar ao MisterALG.')}\n`)
    } else {
      if (estadoFinal === 'erro' && erro && !tela.querySelector('.saida-erro')) resumoDoErro(erro)
      if (estadoFinal === 'terminado') cons.sistema(ingles ? `Process finished with exit code ${codigo}` : TEXTOS.fimPrograma, 'ok')
      else if (estadoFinal === 'parado') cons.sistema(ingles ? 'Process stopped by the user' : TEXTOS.terminadoUsuario)
      else if (estadoFinal === 'erro') cons.sistema(ingles ? 'Process finished with exit code 1' : TEXTOS.terminadoErro, 'erro')
    }
    status.estado()
    status.mensagem(TEXTOS.rodapeConsole)
    op.aoMudarEstado(false)
    avisar('fim', { estado: estadoFinal })
    if (estadoFinal === 'erro' && erro) {
      editor.realcarErro(erro.linha)
      op.aoErro?.(erro)
      mostrarAviso(erro)
    }
  }

  /** O aviso do erro: a linha pode ser corrigida ali mesmo e o programa roda de novo do mesmo jeito (F9, F8 ou timer). */
  function mostrarAviso(erro) {
    const modo = modoAtual
    const original = editor.textoDaLinha(erro.linha)
    if (cons.emJanela) window.focus() // o console do VisuAlg é uma janela à parte: o aviso aparece aqui
    dialogos.aviso(erro, original, op.iaAtiva?.(), erro.linha >= 1 && erro.linha <= editor.texto().split('\n').length).then(({ acao, texto }) => {
      if (acao === 'ia') return op.aoPedirIA()
      if (acao === 'corrigir' || acao === 'executar') {
        editor.substituirLinha(erro.linha, linhaCorrigida(original, texto))
        editor.realcarErro(null)
        if (acao === 'executar') iniciar(modo)
        return
      }
      editor.focar()
    })
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
    comecou()

    sessao = executar(fonte, {
      modo,
      timerMs: config.timerMs,
      breakpoints: editor.breakpoints(),
      aleatorio: config.aleatorio,
      listas: config.listas,
      arquivos: config.arquivos,
      perfil: true,
      onOutput: escrever,
      onStep: aoPassar,
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
    ligarCampo(campo)
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        cons.historico.adicionar(campo.value)
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
        terminou('terminado', null, ev.codigo ?? 0)
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
    comecou()
    cons.estadoAtual('compilando')
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
    cons.estadoAtual('rodando')
    status.estado(' Executando ')
    status.mensagem(' MENSAGEM: Digite no console e tecle <Enter> para enviar ao programa (Esc para)')
    entradaContinua(id)
  }

  // ---- JavaScript, TypeScript e Python: passo a passo com a tela de objetos ------------------

  /** Console limpo, editor travado e a tela de objetos no lugar da grade de variáveis. */
  function prepararPassoAPasso() {
    tela.replaceChildren()
    visualizacao.textContent = ''
    abrirConsole()
    editor.realcarErro(null)
    editor.somenteLeitura(true)
    comecou()
    mostrarPainel('objetos')
  }

  function aoPassar({ linha }) {
    editor.realcarExecucao(linha)
    if (sessao?.estado === 'pausado') {
      cons.estadoAtual('pausado')
      status.mensagem(` MENSAGEM: Pausado na linha ${linha} — F8 executa a linha, F9 continua, Ctrl+F2 para`)
      avisar('pausa', { linha })
    }
  }

  /** O JavaScript roda aqui mesmo, instrumentado (packages/interpretador-js): cada linha é um ponto de pausa. */
  function iniciarJS(modo, linguagem) {
    prepararPassoAPasso()
    sessao = new SessaoJSProxy(editor.texto(), {
      typescript: linguagem === 'typescript',
      modo,
      timerMs: op.configuracao().timerMs,
      breakpoints: editor.breakpoints(),
      onOutput: escrever,
      onStep: aoPassar,
      onMemory: mostrarMemoriaObjetos,
      onWaitInput: () => pedirEntrada(),
      onEnd: terminou,
    })
    status.estado(' Executando ')
    if (modo === 'passo') sessao.passo()
    else sessao.continuar()
  }

  // ---- C#: o tree-sitter lê o programa no processo principal; o interpretador roda aqui ---------------

  let preludioCS = null

  async function iniciarCSharp(modo) {
    prepararPassoAPasso()
    const analise = { id: 'analise-cs', rodando: false, terminado: false, analise: true } // F8/F9 repetidos e o Parar já valem
    processo = analise
    status.estado(' Preparando ')
    status.mensagem(' MENSAGEM: Lendo o programa em C#…')
    const r = await api.csharp.analisar({ fonte: editor.texto() })
    if (processo !== analise || analise.terminado) return
    processo = null
    if (r.erros) {
      corTexto = CORES.VERMELHO
      escrever(r.erros.map((e) => `programa.cs(${e.linha},${e.coluna + 1}): erro: ${e.mensagem}\n`).join(''))
      corTexto = CORES.BRANCO
      const e = r.erros[0]
      terminou('erro', { linha: e.linha, mensagem: e.mensagem, explicacao: 'O programa tem um erro de escrita: confira ponto e vírgula, parênteses, chaves e aspas na linha marcada (ou na de cima).' })
      return
    }
    preludioCS ??= (await api.csharp.preludio()).ast
    sessao = new SessaoCS(r.ast, preludioCS, {
      modo,
      timerMs: op.configuracao().timerMs,
      breakpoints: editor.breakpoints(),
      onOutput: escrever,
      onStep: aoPassar,
      onMemory: mostrarMemoriaObjetos,
      onWaitInput: () => pedirEntrada(),
      onColor: mudarCor,
      onEnd: terminou,
    })
    status.estado(' Executando ')
    status.mensagem(` MENSAGEM: ${TEXTOS.inicio}`)
    if (modo === 'passo') sessao.passo()
    else sessao.continuar()
  }

  // ---- PHP: a página gerada, ao vivo ---------------------------------------------------------------
  // Não há "execução" com passos: o PHP responde a cada requisição da página (main/previa.js) e o editor
  // continua livre — ao editar, a página se atualiza sozinha.

  const previa = criarPrevia({
    aoFechar: () => { fecharPrevia(); editor.focar() },
    aoIrParaLinha: (linha) => editor.realcarErro(linha),
  })
  let pedidoManualPHP = false
  let relogioPrevia = null
  let pedidosPHP = 0 // cada geração da página do PHP; a que chega atrasada (de um pedido antigo) é ignorada
  /** Fecha a página do PHP e esquece as atualizações que ainda iam chegar. */
  function fecharPrevia() {
    clearTimeout(relogioPrevia)
    pedidosPHP += 1
    previa.esconder()
  }

  api.php.aoResponder((r) => {
    const erro = r.diagnosticos.find((d) => d.principal && (d.nivel === 'fatal' || d.nivel === 'parse'))
    editor.realcarErro(erro ? erro.linha : null)
    status.mensagem(erro
      ? ` MENSAGEM: ${erro.rotulo} na linha ${erro.linha}: ${erro.mensagem}`
      : ` MENSAGEM: Página gerada pelo PHP em ${r.ms} ms — ela se atualiza sozinha quando você edita (F9 executa de novo)`)
    if (erro && pedidoManualPHP) {
      pedidoManualPHP = false
      const e = { linha: erro.linha, mensagem: `${erro.rotulo}: ${erro.mensagem}`, explicacao: erro.explicacao }
      op.aoErro?.(e)
      mostrarAviso(e)
    }
    if (!erro) pedidoManualPHP = false
  })

  async function iniciarPHP() {
    pedidoManualPHP = true
    await mostrarPaginaPHP()
  }

  async function mostrarPaginaPHP() {
    const { nome, diretorio } = op.paginaPHP?.() ?? {}
    const pedido = ++pedidosPHP
    consoleEl.hidden = true
    cons.aoEsconder()
    mostrarMemoriaC(false)
    status.estado(' PHP ')
    const { url } = await api.php.definir({ fonte: editor.texto(), nome, diretorio })
    // (o aluno trocou de documento ou fechou a página enquanto o PHP gerava: não reabre)
    if (pedido === pedidosPHP) {
      previa.mostrar(url)
      avisar('pagina')
    }
  }

  /** Chamado a cada edição: se a página está aberta, ela acompanha o que se escreve. */
  function aoEditar() {
    if (!previa.visivel || op.linguagem?.() !== 'php') return
    clearTimeout(relogioPrevia)
    // confere de novo na hora: o aluno pode ter fechado a página ou trocado de documento nesses 700 ms
    relogioPrevia = setTimeout(() => { if (previa.visivel && op.linguagem?.() === 'php') mostrarPaginaPHP() }, 700)
  }

  /** O Python (Pyodide) roda num processo à parte (main/programas.js), que pausa a cada linha. */
  function iniciarPython(modo) {
    prepararPassoAPasso()
    status.estado(' Preparando ')
    status.mensagem(' MENSAGEM: Iniciando o Python…')
    sessao = new SessaoPython(editor.texto(), {
      modo,
      timerMs: op.configuracao().timerMs,
      breakpoints: editor.breakpoints(),
      onStart: () => {
        status.estado(' Executando ')
        status.mensagem(` MENSAGEM: ${TEXTOS.inicio}`)
      },
      onOutput: (texto, erro) => { // o traceback do Python vem em vermelho
        if (erro) corTexto = CORES.VERMELHO
        escrever(texto)
        corTexto = CORES.BRANCO
      },
      onStep: aoPassar,
      onMemory: mostrarMemoriaObjetos,
      onWaitInput: () => pedirEntrada(),
      onEnd: terminou,
    })
  }

  /** SQL: um comando de cada vez no PostgreSQL (PGlite); a tela do banco mostra as tabelas mudando. */
  function iniciarSQL(modo) {
    tela.replaceChildren()
    visualizacao.textContent = ''
    abrirConsole()
    editor.realcarErro(null)
    editor.somenteLeitura(true)
    comecou()
    mostrarPainel('banco')
    status.estado(' Preparando ')
    status.mensagem(' MENSAGEM: Iniciando o PostgreSQL…')
    const CORES_SQL = { comando: '#8b93a1', erro: CORES.VERMELHO, info: CORES.AMARELO }
    sessao = new SessaoSQL(editor.texto(), {
      modo,
      timerMs: op.configuracao().timerMs,
      breakpoints: editor.breakpoints(),
      onStart: () => status.estado(' Executando '),
      onOutput: (texto, tipo) => {
        corTexto = CORES_SQL[tipo] ?? CORES.BRANCO
        escrever(texto)
        corTexto = CORES.BRANCO
      },
      onStep: aoPassar,
      onBanco: (tabelas) => memoriaBanco?.mostrar(tabelas),
      onEnd: terminou,
    })
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
    comecou()
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
      onStep: aoPassar,
      onMemory: (maq) => memoriaC.mostrar(maq),
      onWaitInput: () => pedirEntrada(),
      onEnd: (estado, erro, codigo) => terminou(estado === 'limite' ? 'parado' : estado, erro, codigo),
    })
    status.estado(' Executando ')
    if (modo === 'passo') sessao.passo()
    else sessao.continuar()
  }

  function pararCompilado() {
    if (!processo.analise) api.clang.parar(processo.id) // a análise do C# não é um processo
    processo.terminado = true
    if (processo.analise) {
      terminou('parado')
      return
    }
    // Termina já: esperar o evento "fim" do processo deixava o F8 seguinte sem efeito por alguns instantes.
    processo.terminado = true
    terminou('parado')
  }

  /** F9 (continuo), F8 (passo) ou Shift+F9 (timer). */
  function iniciar(modo) {
    modoAtual = modo
    // Já tem um programa em andamento: F8/F9/Shift+F9 só retomam a sessão pausada (qualquer linguagem).
    if (emExecucao()) return retomar(modo)
    const linguagem = op.linguagem?.() ?? 'portugol'
    if (linguagem === 'javascript' || linguagem === 'typescript') return iniciarJS(modo, linguagem)
    if (linguagem === 'python') return iniciarPython(modo)
    if (linguagem === 'csharp') return iniciarCSharp(modo)
    if (linguagem === 'php') return iniciarPHP()
    if (linguagem === 'sql') return iniciarSQL(modo)
    if (linguagem !== 'portugol') {
      // F9 sem pontos de parada roda o programa compilado de verdade; F8, Shift+F9 ou pontos de parada usam o passo a passo.
      if (modo !== 'continuo' || editor.breakpoints().size) iniciarPassoC(modo, linguagem)
      else iniciarCompilado(linguagem, modo)
      return
    }
    novaSessao(modo)
    if (modo === 'passo') sessao.passo()
    else sessao.continuar()
  }

  function retomar(modo) {
    if (!sessao || sessao.terminado) return // compilando, ou rodando um programa compilado (F9 do C/C++)
    if (sessao.estado === 'pausado') {
      sessao.modo = modo
      cons.estadoAtual('rodando')
      editor.realcarExecucao(null)
      if (modo === 'passo') sessao.passo()
      else sessao.continuar()
    } else if (sessao.estado === 'rodando') {
      sessao.modo = modo
      if (modo === 'passo') sessao.pararNaProxima = true
    }
  }

  function parar() {
    if (processo && !processo.terminado) pararCompilado()
    else if (emExecucao()) sessao.parar()
    else status.mensagem(` MENSAGEM: ${TEXTOS.jaTerminado}`)
  }

  /** Esc: fecha a página do PHP ou o console (depois que o programa termina). Devolve true se tratou a tecla. */
  function teclaEscape() {
    if (previa.visivel) {
      fecharPrevia()
      status.estado()
      status.mensagem('')
      return true
    }
    if (emExecucao() && cons.visualg) { // no console do VisuAlg, Esc interrompe o programa
      parar()
      return true
    }
    if (!emExecucao() && !consoleEl.hidden) {
      fecharConsole()
      status.mensagem('')
      return true
    }
    return false
  }

  return {
    iniciar,
    parar,
    /** Acompanha a execução (o tutorial); devolve a função que para de acompanhar. */
    aoEvento(fn) {
      ouvintes.add(fn)
      return () => ouvintes.delete(fn)
    },
    emExecucao,
    fecharConsole,
    /** Esc: fecha o console depois que o programa termina. */
    aoEditar,
    teclaEsc: teclaEscape,
    /** O console moderno (janela própria, estado) para quem precisa mexer nele de fora: testes e comandos. */
    console: cons,
    atualizarBreakpoints(linhas) {
      if (sessao && !sessao.terminado) sessao.breakpoints = new Set(linhas)
    },
    restaurar() {
      if (emExecucao()) parar()
      consoleEl.hidden = true
      cons.aoEsconder()
      fecharPrevia()
      mostrarMemoriaC(false)
      corpoGrade.replaceChildren()
      visualizacao.textContent = ''
      editor.realcarExecucao(null)
      editor.realcarErro(null)
      status.mensagem('')
    },
    mostrarPilha: () => dialogos.pilha(sessao && !sessao.terminado && sessao.pilha ? sessao.pilha() : []),
    mostrarPerfil: () => dialogos.perfil(linhasDoPerfil, ultimoPerfil),
  }
}
