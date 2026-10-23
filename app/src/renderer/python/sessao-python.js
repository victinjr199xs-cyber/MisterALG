// A sessão de Python: fala com o processo do Pyodide (main/programas.js) e expõe as mesmas
// propriedades que a execucao.js usa nas outras linguagens (estado, modo, passo, continuar, parar...).
//
// estado: 'iniciando' → 'rodando' ⇄ 'pausado' | 'aguardando' (input) → 'terminado' | 'erro' | 'parado'

const api = window.misteralg

export class SessaoPython {
  constructor(fonte, op = {}) {
    this.op = op
    this.id = crypto.randomUUID()
    this.estado = 'iniciando'
    this.modo = op.modo ?? 'continuo'
    this.timerMs = op.timerMs ?? 500
    this.breakpoints = new Set(op.breakpoints ?? [])
    this.pararNaProxima = false // o Python só pausa nas linhas que ele mesmo vê; ver main/programas.js
    this.descarregar = api.programa.aoEvento((id, ev) => id === this.id && this.aoEvento(ev))
    api.programa.iniciar({
      id: this.id,
      linguagem: 'python',
      fonte,
      passo: this.modo !== 'continuo',
      breakpoints: [...this.breakpoints],
    })
  }

  get terminado() { return ['terminado', 'erro', 'parado'].includes(this.estado) }

  aoEvento(ev) {
    if (this.terminado) return
    switch (ev.tipo) {
      case 'inicio':
        this.estado = 'rodando'
        this.op.onStart?.()
        break
      case 'saida':
        this.op.onOutput?.(ev.texto, ev.erro)
        break
      case 'pausa':
        this.estado = 'pausado'
        this.op.onStep?.({ linha: ev.linha })
        this.op.onMemory?.(ev.foto)
        if (this.modo === 'timer') this.agendado = setTimeout(() => this.passo(), this.timerMs)
        break
      case 'entrada':
        this.estado = 'aguardando'
        this.op.onWaitInput?.()
        break
      case 'fim':
        this.finalizar(ev.estado, ev.erro)
        break
    }
  }

  enviar(c) {
    clearTimeout(this.agendado)
    this.estado = 'rodando'
    api.programa.comando(this.id, { c, bps: [...this.breakpoints] })
  }

  passo() {
    if (this.estado === 'pausado') this.enviar('passo')
  }

  continuar() {
    if (this.estado === 'pausado') this.enviar('continuar')
  }

  fornecerEntrada(texto) {
    if (this.estado !== 'aguardando') return
    this.estado = 'rodando'
    api.programa.comando(this.id, texto === null ? { c: 'fim-entrada' } : { c: 'entrada', texto })
  }

  parar() {
    if (this.terminado) return
    api.programa.parar(this.id)
    this.finalizar('parado')
  }

  finalizar(estado, erro) {
    if (this.terminado) return
    clearTimeout(this.agendado)
    this.estado = estado
    this.descarregar()
    this.op.onEnd?.(estado, erro)
  }
}
