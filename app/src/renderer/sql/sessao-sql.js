// SQL: o script é dividido em comandos e cada um vai para o PostgreSQL (PGlite, main/sql.js) na sua vez.
// O F8 pára ANTES de cada comando (a linha marcada é a que vai rodar); a tela do banco mostra o que mudou.
// Mesma interface das outras sessões: estado, modo, pararNaProxima, breakpoints, passo(), continuar(), parar().

import { descreverErroSQL, dividirComandos, resultadoPsql } from '@misteralg/interpretador-sql'

const api = window.misteralg
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

export class SessaoSQL {
  /** @param op { modo, timerMs, breakpoints, onStart, onOutput(texto, tipo), onStep({linha}), onBanco(tabelas), onEnd(estado, erro) } */
  constructor(fonte, op) {
    this.op = op
    this.comandos = dividirComandos(fonte)
    this.i = 0
    this.modo = op.modo ?? 'continuo'
    this.timerMs = op.timerMs ?? 500
    this.breakpoints = new Set(op.breakpoints ?? [])
    this.pararNaProxima = false
    this.estado = 'pronto'
    this.terminado = false
    this.rodando = false
    this.iniciado = false
    this.retomou = false // acabou de sair de uma pausa: roda o comando marcado antes de parar de novo
  }

  passo() {
    this.modo = 'passo'
    this.retomar()
  }

  continuar() {
    if (this.modo === 'passo') this.modo = 'continuo'
    this.retomar()
  }

  retomar() {
    if (this.estado === 'pausado') this.retomou = true
    void this.rodar()
  }

  parar() {
    if (this.terminado) return
    api.sql.parar()
    this.fim('parado')
  }

  deveParar(c) {
    return this.modo === 'passo' || this.pararNaProxima || this.breakpoints.has(c.linha)
  }

  async rodar() {
    if (this.rodando || this.terminado) return
    this.rodando = true
    this.estado = 'rodando'
    try {
      if (!this.iniciado) {
        this.iniciado = true
        const r = await api.sql.comando({ c: 'reiniciar' })
        if (this.terminado) return
        if (r?.erro) return this.fim('erro', { linha: 0, mensagem: r.erro.mensagem })
        this.op.onStart?.()
        await this.mostrarBanco()
        if (!this.comandos.length) this.op.onOutput('(nenhum comando SQL no editor)\n', 'info')
      }
      while (this.i < this.comandos.length) {
        const c = this.comandos[this.i]
        if (!this.retomou && this.deveParar(c)) {
          this.estado = 'pausado'
          this.pararNaProxima = false
          this.op.onStep({ linha: c.linha })
          return
        }
        this.retomou = false
        this.op.onStep({ linha: c.linha })
        this.op.onOutput(`=> ${c.sql.split('\n')[0]}${c.sql.includes('\n') ? ' …' : ''}\n`, 'comando')
        const r = await api.sql.comando({ c: 'executar', sql: c.sql })
        if (this.terminado) return
        this.i += 1
        if (r.erro) {
          if (r.erro.parado) return // o Parar matou o banco no meio do comando
          this.op.onOutput(`ERROR:  ${r.erro.mensagem}\n${r.erro.dica ? `HINT:  ${r.erro.dica}\n` : ''}\n`, 'erro')
          await this.mostrarBanco()
          return this.fim('erro', descreverErroSQL(r.erro, c))
        }
        this.op.onOutput(`${resultadoPsql(c.sql, r.campos, r.linhas, r.afetadas)}\n\n`, 'resultado')
        if (this.modo !== 'continuo') await this.mostrarBanco()
        if (this.modo === 'timer') await esperar(this.timerMs)
      }
      await this.mostrarBanco()
      this.fim('terminado')
    } finally {
      this.rodando = false
    }
  }

  async mostrarBanco() {
    const r = await api.sql.comando({ c: 'banco' })
    if (!this.terminado && r?.tabelas) this.op.onBanco?.(r.tabelas)
  }

  fim(estado, erro) {
    if (this.terminado) return
    this.terminado = true
    this.estado = 'terminado'
    this.op.onEnd(estado, erro)
  }
}
