// Passo a passo do C (F8): a sessão que conduz a MaquinaC, no mesmo formato da
// Sessao do Portugol (continuar, passo, parar, fornecerEntrada, pontos de parada).

import { ErroC, EXPLICACOES } from './erros.js'
import { MaquinaC, SaidaDoPrograma } from './maquina.js'

export { CABECALHOS_C } from './cabecalhos.js'
export { CABECALHOS_CPP } from './cabecalhos-cpp.js'
export { ErroC, EXPLICACOES } from './erros.js'
export { MaquinaC } from './maquina.js'
export { descrever, nomeAmigavel, nomeDoEndereco, tipoDoBloco } from './descrever.js'
export { hex } from './memoria.js'

const FATIA = 20000
const imediato = globalThis.setImmediate ?? ((f) => setTimeout(f, 0))

export class SessaoC {
  /**
   * @param ast árvore do clang (objeto ou texto JSON)
   * @param fonte o programa
   * @param op modo 'continuo'|'passo'|'timer', timerMs, breakpoints, entrada[], semAtrasos, maxLinhas,
   *           e os eventos onOutput(texto), onStep({linha}), onMemory(maquina), onWaitInput(), onEnd(status, erro, codigo)
   */
  constructor(ast, fonte, op = {}) {
    this.op = op
    this.estado = 'pronto'
    this.modo = op.modo ?? 'continuo'
    this.timerMs = op.timerMs ?? 500
    this.breakpoints = new Set(op.breakpoints ?? [])
    this.entradas = [...(op.entrada ?? [])]
    this.decodificador = new TextDecoder()
    this.buffer = ''
    this.linhasExecutadas = 0
    this.linhaAtual = 0
    this.pararNaProxima = false
    this.pedidoParada = false
    this.rodando = false
    this.pendente = undefined
    try {
      this.maq = new MaquinaC(typeof ast === 'string' ? JSON.parse(ast) : ast, fonte, {
        saida: (bin) => {
          const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
          this.buffer += this.decodificador.decode(bytes, { stream: true })
        },
        aleatorio: op.aleatorio,
        agora: op.agora,
        cpp: op.cpp,
      })
      this.maq.preparar()
      this.gen = this.maq.executar()
    } catch (e) {
      this.erroInicial = e
    }
  }

  get terminado() { return ['terminado', 'erro', 'parado', 'limite'].includes(this.estado) }

  continuar() {
    if (this.terminado || this.estado === 'aguardando') return
    this.pararNaProxima = this.modo === 'passo'
    this.rodar()
  }

  passo() {
    if (this.terminado || this.estado === 'aguardando') return
    this.pararNaProxima = true
    this.rodar()
  }

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

  fornecerEntrada(texto) {
    if (this.estado === 'aguardando') {
      this.estado = 'rodando'
      this.pendente = texto
      this.rodar()
    } else if (texto !== null) this.entradas.push(texto)
  }

  /** Pilha de ativação no formato da do Portugol (Ctrl+F3). */
  pilha() {
    return (this.maq?.pilha ?? []).map((q) => (q.funcao === 'main'
      ? { tipo: 'Corpo Principal do Programa' }
      : { tipo: 'Funcao', nome: q.funcao, assinatura: '', linhaChamada: q.linhaDaChamada }))
  }

  descarregar() {
    if (!this.buffer) return
    const t = this.buffer
    this.buffer = ''
    this.op.onOutput?.(t)
  }

  rodar() {
    if (this.rodando || this.terminado) return
    if (this.erroInicial) return this.finalizar('erro', this.erroInicial)
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
          return this.finalizar('terminado', undefined, r.value)
        }
        const ev = r.value
        if (!ev) continue // linha de dentro de um cabeçalho: não pausa
        if (ev.tipo === 'linha') {
          this.linhaAtual = ev.linha
          this.linhasExecutadas += 1
          if (this.pedidoParada) {
            this.rodando = false
            this.gen.return()
            return this.finalizar('parado')
          }
          if (this.op.maxLinhas && this.linhasExecutadas > this.op.maxLinhas) {
            this.rodando = false
            this.gen.return()
            return this.finalizar('limite')
          }
          if (this.pararNaProxima || this.breakpoints.has(ev.linha)) return this.pausar(ev.linha)
          if (this.modo === 'timer' && !this.op.semAtrasos) {
            this.mostrar(ev.linha)
            this.rodando = false
            this.agendado = setTimeout(() => this.rodar(), this.timerMs)
            return undefined
          }
          nestaFatia += 1
          if (nestaFatia >= FATIA && this.op.fatias !== false) {
            this.descarregar()
            this.rodando = false
            this.agendado = imediato(() => this.rodar())
            return undefined
          }
        } else if (ev.tipo === 'entrada') {
          if (this.entradas.length) {
            envio = this.entradas.shift()
            continue
          }
          this.descarregar()
          this.rodando = false
          this.estado = 'aguardando'
          this.op.onStep?.({ linha: this.linhaAtual })
          this.op.onMemory?.(this.maq)
          this.op.onWaitInput?.()
          return undefined
        }
      }
    } catch (e) {
      this.rodando = false
      if (e instanceof SaidaDoPrograma) return this.finalizar('terminado', undefined, e.codigo)
      if (e instanceof RangeError && /call stack/i.test(e.message)) {
        return this.finalizar('erro', new ErroC('a pilha de chamadas estourou (recursão infinita?)', 0, EXPLICACOES.pilha))
      }
      return this.finalizar('erro', e)
    }
  }

  mostrar(linha) {
    this.descarregar()
    this.op.onStep?.({ linha })
    this.op.onMemory?.(this.maq)
  }

  pausar(linha) {
    this.rodando = false
    this.pararNaProxima = false
    this.estado = 'pausado'
    this.mostrar(linha)
  }

  finalizar(status, e, codigo) {
    if (this.terminado) return
    this.buffer += this.decodificador.decode()
    this.descarregar()
    this.estado = status
    let erro
    if (e) {
      erro = e instanceof ErroC ? e : new ErroC(`erro interno do passo a passo: ${e.message}`)
      if (!(e instanceof ErroC)) erro.interno = e
      if (!erro.linha) erro.linha = this.maq?.linhaAtual ?? 0
    }
    if (this.maq) this.op.onMemory?.(this.maq)
    this.op.onEnd?.(status, erro, codigo)
  }
}

/** Atalho para testes: roda até o fim e devolve a saída. */
export function rodarC(ast, fonte, opcoes = {}) {
  return new Promise((resolve) => {
    let saida = ''
    const sessao = new SessaoC(ast, fonte, {
      semAtrasos: true,
      fatias: false,
      maxLinhas: 5_000_000,
      ...opcoes,
      onOutput: (t) => { saida += t },
      onWaitInput: () => resolve({ saida, status: 'aguardando', sessao }),
      onEnd: (status, erro, codigo) => resolve({ saida, status, erro, codigo, sessao }),
    })
    sessao.continuar()
  })
}
