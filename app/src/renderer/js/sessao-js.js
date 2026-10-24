// A sessão de JavaScript/TypeScript roda num Worker (trabalhador-js.js), isolada do DOM e da ponte
// window.misteralg. Esta classe a expõe com as mesmas propriedades que a execucao.js usa nas outras
// linguagens (modo, breakpoints, pararNaProxima...) e espelha o estado que o Worker informa.

const FINAIS = ['terminado', 'erro', 'parado', 'limite']
const ESPERA_PARAR_MS = 3000

export class SessaoJSProxy {
  constructor(fonte, opcoes = {}) {
    const { onOutput, onStep, onMemory, onWaitInput, onEnd, ...config } = opcoes
    this.ops = { onOutput, onStep, onMemory, onWaitInput, onEnd }
    this._estado = 'pronto'
    this._modo = config.modo ?? 'continuo'
    this._pararNaProxima = false
    this._breakpoints = new Set(config.breakpoints ?? [])
    this.worker = new Worker(new URL('./trabalhador-js.js', import.meta.url), { type: 'module' })
    this.worker.onmessage = ({ data }) => this.receber(data)
    this.worker.onerror = (e) => {
      e.preventDefault?.()
      this.encerrar('erro', { mensagem: `o passo a passo não conseguiu rodar o programa: ${e.message ?? 'falha no Worker'}`, linha: 0 })
    }
    this.worker.postMessage({ tipo: 'iniciar', fonte, opcoes: { ...config, breakpoints: [...this._breakpoints] } })
  }

  get terminado() { return FINAIS.includes(this._estado) }
  get estado() { return this._estado }
  get modo() { return this._modo }
  set modo(v) { this._modo = v; this.worker.postMessage({ tipo: 'modo', valor: v }) }
  get pararNaProxima() { return this._pararNaProxima }
  set pararNaProxima(v) { this._pararNaProxima = v; this.worker.postMessage({ tipo: 'pararNaProxima', valor: v }) }
  get breakpoints() { return this._breakpoints }
  set breakpoints(v) { this._breakpoints = v; this.worker.postMessage({ tipo: 'breakpoints', valor: [...v] }) }

  pilha() { return this._pilha ?? [] }

  receber(m) {
    if (this.terminado) return
    // O estado final só vale dentro de encerrar(): senão o 'fim' chegaria com a sessão já "terminada" e o onEnd não rodaria.
    if (m.estado && !FINAIS.includes(m.estado)) this._estado = m.estado
    if (m.tipo === 'saida') this.ops.onOutput?.(m.texto)
    else if (m.tipo === 'passo') this.ops.onStep?.(m.passo)
    else if (m.tipo === 'memoria') {
      this._pilha = m.pilha
      this.ops.onMemory?.(m.foto)
    }
    else if (m.tipo === 'entrada') this.ops.onWaitInput?.()
    else if (m.tipo === 'fim') this.encerrar(m.status, m.erro)
  }

  encerrar(status, erro) {
    if (this.terminado) return
    this._estado = status
    clearTimeout(this.limite)
    this.worker.terminate()
    this.ops.onEnd?.(status, erro)
  }

  rodar(tipo) {
    if (this.terminado) return
    this._estado = 'rodando'
    this.worker.postMessage({ tipo })
  }

  continuar() { if (this._estado !== 'aguardando') this.rodar('continuar') }
  passo() { if (this._estado !== 'aguardando') this.rodar('passo') }

  parar() {
    if (this.terminado) return
    this.worker.postMessage({ tipo: 'parar' })
    // Um laço que não devolve o controle ao Worker não ouve o pedido: encerra à força.
    clearTimeout(this.limite)
    this.limite = setTimeout(() => this.encerrar('parado'), ESPERA_PARAR_MS)
  }

  fornecerEntrada(texto) {
    if (this.terminado) return
    if (this._estado === 'aguardando') this._estado = 'rodando'
    this.worker.postMessage({ tipo: 'entrada', texto })
  }
}
