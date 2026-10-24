// Passo a passo do C# (F8): a sessão que conduz a MaquinaCS, no mesmo formato das outras linguagens
// (continuar, passo, parar, fornecerEntrada, pontos de parada).

import { ErroCS, ExcecaoCS, descreverExcecao } from './erros.js'
import { fotografar } from './fotografia.js'
import { MaquinaCS } from './montar.js'
import { SaidaDoPrograma } from './biblioteca/sistema.js'

export { PRELUDIO } from './preludio.js'
export { fotografar } from './fotografia.js'
export { MaquinaCS } from './montar.js'
export { ErroCS, ExcecaoCS } from './erros.js'

const FATIA = 20000
const FATIA_MS = 16 // linhas pesadas (laços curtos que fazem muito) também devolvem a vez para a tela
const agora = () => globalThis.performance?.now() ?? Date.now()
const imediato = globalThis.setImmediate ?? ((f) => setTimeout(f, 0))

/** Converte o que deu errado (do programa ou do interpretador) em { mensagem, explicacao, linha }. */
export function descreverErro(m, e0) {
  const e = m ? m.converterErroInterno(e0) : e0
  if (e instanceof ErroCS) return { mensagem: e.mensagem, explicacao: e.explicacao, linha: e.linha }
  if (e instanceof ExcecaoCS) {
    const d = descreverExcecao(m, e.valor)
    return { ...d, linha: e.valor.linha ?? e.linha }
  }
  return { mensagem: `erro interno do interpretador de C#: ${e?.message ?? e}`, explicacao: 'Isto não é um erro do seu programa: é um defeito do MisterALG. Se puder, conte qual código causou.', linha: m?.linhaAtual ?? 0 }
}

export class SessaoCS {
  /**
   * @param ast a árvore do programa (analisar.js) e preludioAst a do prelúdio
   * @param op modo 'continuo'|'passo'|'timer', timerMs, breakpoints, entrada[], semAtrasos, fatias,
   *           aleatorio (semente), agora(), e os eventos onOutput(texto), onStep({linha}), onMemory(foto),
   *           onWaitInput(), onColor(cor, 'FRENTE'|'FUNDO'), onEnd(status, erro, codigo)
   */
  constructor(ast, preludioAst, op = {}) {
    this.op = op
    this.estado = 'pronto'
    this.modo = op.modo ?? 'continuo'
    this.timerMs = op.timerMs ?? 500
    this.breakpoints = new Set(op.breakpoints ?? [])
    this.entradas = [...(op.entrada ?? [])]
    this.buffer = ''
    this.linhaAtual = 0
    this.pararNaProxima = false
    this.pedidoParada = false
    this.rodando = false
    try {
      this.maq = new MaquinaCS(ast, preludioAst, {
        saida: (t) => { this.buffer += t },
        aleatorio: op.aleatorio,
        agora: op.agora,
        cor: op.onColor,
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
    this.finalizar('parado')
  }

  fornecerEntrada(texto) {
    if (this.estado === 'aguardando') {
      this.estado = 'rodando'
      this.pendente = { texto }
      this.rodar()
    } else if (texto !== null) this.entradas.push(texto)
  }

  descarregar() {
    if (!this.buffer) return
    const t = this.buffer
    this.buffer = ''
    this.op.onOutput?.(t)
  }

  foto() { return this.maq ? fotografar(this.maq) : null }

  /** A pilha de chamadas para a janela "Pilha de ativação". */
  pilha() { return this.maq ? this.maq.pilha.map((q) => ({ nome: q.nome, linha: q.linha })) : [] }

  rodar() {
    if (this.rodando || this.terminado) return
    if (this.erroInicial) return this.finalizar('erro', this.erroInicial)
    this.rodando = true
    this.estado = 'rodando'
    let envio
    let temEnvio = false
    if (this.pendente) {
      envio = this.pendente.texto
      temEnvio = true
      this.pendente = undefined
    }
    let nestaFatia = 0
    const inicioFatia = agora()
    try {
      for (;;) {
        const r = temEnvio ? this.gen.next(envio) : this.gen.next()
        temEnvio = false
        if (r.done) {
          this.rodando = false
          return this.finalizar('terminado', undefined, r.value)
        }
        const ev = r.value
        if (ev.tipo === 'linha') {
          this.linhaAtual = ev.linha
          if (this.pedidoParada) {
            this.rodando = false
            return this.finalizar('parado')
          }
          if (this.pararNaProxima || this.breakpoints.has(ev.linha)) return this.pausar(ev)
          if (this.modo === 'timer' && !this.op.semAtrasos) {
            this.mostrar(ev)
            this.rodando = false
            this.agendado = setTimeout(() => this.rodar(), this.timerMs)
            return undefined
          }
          nestaFatia += 1
          if ((nestaFatia >= FATIA || (nestaFatia % 256 === 0 && agora() - inicioFatia > FATIA_MS)) && this.op.fatias !== false) {
            this.descarregar()
            this.rodando = false
            this.agendado = imediato(() => this.rodar())
            return undefined
          }
        } else if (ev.tipo === 'entrada') {
          if (this.entradas.length) {
            envio = this.entradas.shift()
            temEnvio = true
            if (envio !== null && this.op.eco !== false) this.buffer += `${envio}\n` // eco, como no terminal
            continue
          }
          this.descarregar()
          this.rodando = false
          this.estado = 'aguardando'
          this.op.onStep?.({ linha: this.linhaAtual })
          this.op.onMemory?.(this.foto())
          this.op.onWaitInput?.()
          return undefined
        }
      }
    } catch (e) {
      this.rodando = false
      if (e instanceof SaidaDoPrograma) return this.finalizar('terminado', undefined, e.codigo)
      return this.finalizar('erro', e)
    }
  }

  mostrar(ev) {
    this.descarregar()
    this.op.onStep?.({ linha: ev.linha })
    this.op.onMemory?.(this.foto())
  }

  pausar(ev) {
    this.rodando = false
    this.pararNaProxima = false
    this.estado = 'pausado'
    this.mostrar(ev)
  }

  finalizar(status, e, codigo) {
    if (this.terminado) return
    this.descarregar()
    this.estado = status
    const erro = e ? descreverErro(this.maq, e) : undefined
    if (this.maq && status !== 'terminado') this.op.onMemory?.(this.foto())
    this.op.onEnd?.(status, erro, codigo)
  }
}

/** Atalho para testes: roda até o fim e devolve a saída. */
export function rodarCS(ast, preludioAst, opcoes = {}) {
  return new Promise((resolve) => {
    let saida = ''
    const sessao = new SessaoCS(ast, preludioAst, {
      semAtrasos: true,
      fatias: false,
      ...opcoes,
      onOutput: (t) => { saida += t },
      onWaitInput: () => resolve({ saida, status: 'aguardando', sessao }),
      onEnd: (status, erro, codigo) => resolve({ saida, status, erro, codigo, sessao }),
    })
    sessao.continuar()
  })
}
