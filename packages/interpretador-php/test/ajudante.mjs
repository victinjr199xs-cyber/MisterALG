// Sobe o processo do PHP (o mesmo que o MisterALG usa) e responde a requisições, uma de cada vez.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RODAR = fileURLToPath(new URL('../src/rodar.mjs', import.meta.url))

export function iniciarServidor() {
  const filho = spawn(process.execPath, ['--no-warnings', RODAR], { stdio: ['pipe', 'pipe', 'inherit'] })
  const esperando = new Map()
  let pronto
  const prontoP = new Promise((r) => { pronto = r })
  let resto = ''
  let proximo = 0
  filho.stdout.on('data', (d) => {
    resto += d
    for (let i = resto.indexOf('\n'); i >= 0; i = resto.indexOf('\n')) {
      const ev = JSON.parse(resto.slice(0, i))
      resto = resto.slice(i + 1)
      if (ev.tipo === 'pronto') pronto()
      else if (ev.tipo === 'resposta') esperando.get(ev.id)?.(ev)
    }
  })
  return {
    /** @returns { status, cabecalhos, texto, diagnosticos } */
    async pedir(pedido) {
      await prontoP
      const id = ++proximo
      const r = await new Promise((resolve) => {
        esperando.set(id, resolve)
        filho.stdin.write(`${JSON.stringify({ c: 'executar', id, nome: 'index.php', metodo: 'GET', url: '/index.php', ...pedido })}\n`)
      })
      return { ...r, texto: Buffer.from(r.corpo, 'base64').toString('utf8') }
    },
    parar: () => filho.kill(),
  }
}
