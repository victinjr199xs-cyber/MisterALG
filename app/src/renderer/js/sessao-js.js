import { SessaoJS } from '@misteralg/interpretador-js'

export class SessaoJSProxy {
  constructor(fonte, opcoes = {}) {
    this.sessao = new SessaoJS(fonte, {
      typescript: opcoes.typescript,
      modo: opcoes.modo,
      timerMs: opcoes.timerMs,
      breakpoints: opcoes.breakpoints,
      entrada: opcoes.entrada,
      onOutput: opcoes.onOutput,
      onStep: opcoes.onStep,
      onMemory: opcoes.onMemory,
      onWaitInput: opcoes.onWaitInput,
      onEnd: opcoes.onEnd,
    })
  }

  get terminado() { return this.sessao.terminado }
  get estado() { return this.sessao.estado }

  continuar() { this.sessao.continuar() }
  passo() { this.sessao.passo() }
  parar() { this.sessao.parar() }
  fornecerEntrada(texto) { this.sessao.fornecerEntrada(texto) }
}
