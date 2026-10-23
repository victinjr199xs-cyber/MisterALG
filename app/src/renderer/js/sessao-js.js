// A sessão de JavaScript/TypeScript roda aqui no renderer; esta classe só a expõe com as mesmas
// propriedades que a execucao.js usa nas outras linguagens (modo, breakpoints, pararNaProxima...).

import { SessaoJS } from '@misteralg/interpretador-js'

export class SessaoJSProxy {
  constructor(fonte, opcoes = {}) {
    this.sessao = new SessaoJS(fonte, opcoes)
  }

  get terminado() { return this.sessao.terminado }
  get estado() { return this.sessao.estado }
  get modo() { return this.sessao.modo }
  set modo(v) { this.sessao.modo = v }
  get pararNaProxima() { return this.sessao.pararNaProxima }
  set pararNaProxima(v) { this.sessao.pararNaProxima = v }
  get breakpoints() { return this.sessao.breakpoints }
  set breakpoints(v) { this.sessao.breakpoints = v }

  continuar() { this.sessao.continuar() }
  passo() { this.sessao.passo() }
  parar() { this.sessao.parar() }
  fornecerEntrada(texto) { this.sessao.fornecerEntrada(texto) }
}
