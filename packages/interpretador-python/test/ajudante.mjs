// Roda um programa Python no processo do executor (o mesmo que o MisterALG usa) e junta os eventos.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RODAR = fileURLToPath(new URL('../src/rodar.mjs', import.meta.url))

/**
 * @param fonte o programa
 * @param op passo (pausa na 1ª linha), breakpoints[], entradas[] (respostas do input()),
 *           aoPausa(ev, i) → comando { c: 'passo'|'continuar' } (padrão: passo)
 * @returns { saida, erroSaida, pausas: [{ linha, foto }], fim: { estado, erro? } }
 */
export function rodar(fonte, { passo = false, breakpoints = [], entradas = [], aoPausa } = {}) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, ['--no-warnings', RODAR], { stdio: ['pipe', 'pipe', 'inherit'] })
    const r = { saida: '', erroSaida: '', pausas: [], fim: null }
    const fila = [...entradas]
    let resto = ''
    const enviar = (o) => filho.stdin.write(`${JSON.stringify(o)}\n`)
    filho.stdout.on('data', (d) => {
      resto += d
      for (let i = resto.indexOf('\n'); i >= 0; i = resto.indexOf('\n')) {
        const ev = JSON.parse(resto.slice(0, i))
        resto = resto.slice(i + 1)
        if (ev.tipo === 'pronto') enviar({ fonte, passo, breakpoints })
        else if (ev.tipo === 'saida') (ev.erro ? (r.erroSaida += ev.texto) : (r.saida += ev.texto))
        else if (ev.tipo === 'pausa') {
          r.pausas.push({ linha: ev.linha, foto: ev.foto })
          enviar({ ...(aoPausa?.(ev, r.pausas.length - 1) ?? { c: 'passo' }), bps: breakpoints })
        } else if (ev.tipo === 'entrada') enviar(fila.length ? { c: 'entrada', texto: fila.shift() } : { c: 'fim-entrada' })
        else if (ev.tipo === 'fim') r.fim = { estado: ev.estado, erro: ev.erro }
      }
    })
    filho.on('error', reject)
    filho.on('close', () => resolve(r))
  })
}
