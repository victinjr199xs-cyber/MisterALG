// API pública do interpretador (contrato em docs/ARQUITETURA.md §3.1).

import { ErroVisualg, TEXTOS } from './erros.js'
import { Maquina, Parada } from './maquina.js'
import { analisar } from './parser.js'

export { analisar } from './parser.js'
export { tokenizar } from './lexer.js'
export { gerarPascal } from './pascal.js'
export { gerarC, gerarJava } from './exportar.js'
export { decodificar } from './codificacao.js'
export { ErroVisualg, MENSAGENS, TEXTOS, CABECALHO_ERRO } from './erros.js'
export { FUNCOES, PALAVRAS_CHAVE, REALCE, normalizar } from './palavras.js'

const FATIA = 20000 // linhas por fatia antes de devolver o controle ao event loop
const imediato = globalThis.setImmediate ?? ((f) => setTimeout(f, 0))

/** Analisa e prepara (declarações, tipos); devolve o erro ou null. */
export function verificar(fonte) {
  try {
    new Maquina(analisar(fonte)).preparar()
    return null
  } catch (e) {
    if (e instanceof ErroVisualg) return e
    throw e
  }
}

/** Cria uma sessão de execução. Nada roda até continuar() ou passo(). */
export function executar(fonte, opcoes = {}) {
  return new Sessao(fonte, opcoes)
}

export class Sessao {
  /**
   * opcoes: entrada[], rng, relogio {agora()}, arquivos {ler, anexar},
   * modo 'continuo'|'passo'|'timer', timerMs, breakpoints (Iterable<linha>),
   * maxLinhas, semAtrasos, listas [{nome, itens[]}], e os eventos onOutput, onStep, onVariables, onStack,
   * onWaitInput, onColor, onProfile, onEnd.
   */
  constructor(fonte, opcoes = {}) {
    this.fonte = fonte
    this.op = opcoes
    this.estado = 'pronto'
    this.entradas = [...(opcoes.entrada ?? [])]
    this.breakpoints = new Set(opcoes.breakpoints ?? [])
    this.modo = opcoes.modo ?? 'continuo'
    this.timerMs = opcoes.timerMs ?? 500
    this.buffer = ''
    this.linhasExecutadas = 0
    this.linhaAtual = 0
    this.maq = null
    this.gen = null
    this.rodando = false
    this.pararNaProxima = false
    this.pedidoParada = false
    this.pendente = undefined
    this.agendado = null
  }

  get terminado() {
    return ['terminado', 'erro', 'parado', 'limite'].includes(this.estado)
  }

  iniciar() {
    if (this.gen) return true
    try {
      const prog = analisar(this.fonte)
      this.maq = new Maquina(prog, {
        rng: this.op.rng,
        relogio: this.op.relogio,
        arquivos: this.op.arquivos,
        aleatorio: this.op.aleatorio,
        listas: this.op.listas,
        io: {
          saida: (t) => { this.buffer += t },
          limpar: () => { this.buffer += '\f' },
          cor: (cor, posicao) => {
            this.descarregar()
            this.op.onColor?.(cor, posicao)
          },
        },
      })
      this.maq.preparar()
      this.gen = this.maq.executar()
      this.linhaAtual = prog.linhaInicio
      return true
    } catch (e) {
      this.finalizar('erro', e)
      return false
    }
  }

  /** F9: roda até o fim, um ponto de parada, um leia ou uma pausa. */
  continuar() {
    if (this.terminado || this.estado === 'aguardando') return
    this.pararNaProxima = this.modo === 'passo'
    this.rodar()
  }

  /** F8: executa a linha atual e pausa na próxima. */
  passo() {
    if (this.terminado || this.estado === 'aguardando') return
    this.pararNaProxima = true
    this.rodar()
  }

  /** Ctrl+F2 (ou Esc no leia). */
  parar() {
    if (this.terminado) return
    if (this.rodando) {
      this.pedidoParada = true
      return
    }
    clearTimeout(this.agendado)
    this.gen?.return?.()
    this.finalizar('parado')
  }

  /** Texto digitado para o leia (null = Esc). */
  fornecerEntrada(texto) {
    if (this.estado === 'aguardando') {
      this.estado = 'rodando'
      this.pendente = texto === null ? null : String(texto)
      this.rodar()
    } else if (texto !== null) {
      this.entradas.push(String(texto))
    }
  }

  alternarBreakpoint(linha, ligado) {
    if (ligado) this.breakpoints.add(linha)
    else this.breakpoints.delete(linha)
  }

  inspecionar() {
    return this.maq ? this.maq.quadro() : { globais: [], locais: [] }
  }

  pilha() {
    return this.maq ? this.maq.pilha() : []
  }

  descarregar() {
    if (!this.buffer) return
    const texto = this.buffer
    this.buffer = ''
    this.op.onOutput?.(texto)
  }

  rodar() {
    if (this.rodando || this.terminado) return
    if (!this.iniciar()) return
    this.rodando = true
    this.estado = 'rodando'
    let envio = this.pendente
    this.pendente = undefined
    let nestaFatia = 0

    try {
      for (;;) {
        const r = this.gen.next(envio)
        envio = undefined
        if (r.done) {
          this.rodando = false
          this.finalizar('terminado')
          return
        }
        const ev = r.value

        if (ev.tipo === 'linha') {
          this.linhaAtual = ev.linha
          this.linhasExecutadas += 1
          if (this.pedidoParada) {
            this.rodando = false
            this.gen.return()
            this.finalizar('parado')
            return
          }
          if (this.op.maxLinhas && this.linhasExecutadas > this.op.maxLinhas) {
            this.rodando = false
            this.gen.return()
            this.finalizar('limite')
            return
          }
          if (this.pararNaProxima || this.breakpoints.has(ev.linha)) {
            this.pausar(ev.linha)
            return
          }
          const atraso = this.op.semAtrasos ? null : (this.modo === 'timer' ? this.timerMs : this.maq.timerMs)
          if (atraso) {
            this.mostrarPosicao(ev.linha)
            this.rodando = false
            this.agendado = setTimeout(() => this.rodar(), atraso)
            return
          }
          nestaFatia += 1
          if (nestaFatia >= FATIA && this.op.fatias !== false) {
            this.descarregar()
            this.rodando = false
            this.agendado = imediato(() => this.rodar())
            return
          }
        } else if (ev.tipo === 'leia') {
          if (this.entradas.length > 0) {
            envio = this.entradas.shift()
            continue
          }
          this.descarregar()
          this.rodando = false
          this.estado = 'aguardando'
          this.op.onStep?.({ linha: this.linhaAtual })
          this.op.onWaitInput?.({ descricao: ev.descricao, tipo: ev.tipoVariavel })
          return
        } else if (ev.tipo === 'pausa') {
          this.pausar(ev.linha)
          return
        }
      }
    } catch (e) {
      this.rodando = false
      this.finalizar(e instanceof Parada ? 'parado' : 'erro', e instanceof Parada ? undefined : e)
    }
  }

  mostrarPosicao(linha) {
    this.descarregar()
    this.op.onStep?.({ linha })
    this.op.onVariables?.(this.inspecionar())
    this.op.onStack?.(this.pilha())
  }

  pausar(linha) {
    this.rodando = false
    this.pararNaProxima = false
    this.estado = 'pausado'
    this.mostrarPosicao(linha)
  }

  finalizar(status, e) {
    if (this.terminado) return
    this.descarregar()
    this.estado = status
    let erroFinal
    if (e) {
      erroFinal = e instanceof ErroVisualg
        ? e
        : Object.assign(new ErroVisualg(28, this.linhaAtual), { mensagem: `Erro interno: ${e.message}`, interno: e })
    }
    if (this.maq) {
      this.op.onVariables?.(this.inspecionar())
      if (this.maq.pedirPerfil || this.op.perfil) this.op.onProfile?.(this.maq.relatorioPerfil())
    }
    this.op.onEnd?.(status, erroFinal)
  }
}

/**
 * Atalho para testes: roda até o fim (ou até faltar entrada) e devolve a saída.
 * @returns {Promise<{saida:string, status:string, erro?:ErroVisualg, sessao:Sessao}>}
 */
export function rodar(fonte, opcoes = {}) {
  return new Promise((resolve) => {
    let saida = ''
    const sessao = executar(fonte, {
      semAtrasos: true,
      maxLinhas: 5_000_000,
      ...opcoes,
      entrada: opcoes.entradas ?? opcoes.entrada ?? [],
      onOutput: (t) => { saida += t },
      onWaitInput: () => {
        sessao.estado = 'aguardando-sem-entrada'
        resolve({ saida, status: 'aguardando', sessao })
      },
      onStep: () => {
        if (sessao.estado === 'pausado') queueMicrotask(() => sessao.continuar())
      },
      onEnd: (status, erro) => resolve({ saida, status, erro, sessao }),
    })
    sessao.continuar()
  })
}

export { TEXTOS as textos }
