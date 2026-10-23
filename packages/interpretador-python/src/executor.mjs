// O processo que roda um programa Python (Pyodide) e conversa com o MisterALG por linhas de JSON:
//   entra pelo stdin:  { passo, breakpoints, fonte } (a primeira), depois { c: 'passo'|'continuar', bps }
//                      ou { c: 'entrada', texto } ou { c: 'fim-entrada' };
//   sai pelo stdout:   { tipo: 'pronto'|'inicio'|'saida'|'pausa'|'entrada'|'fim', ... }.
// Um laço infinito ou um travamento ficam aqui, longe da IDE: parar é matar este processo.
// Uso: node rodar-python.mjs <url do pyodide.mjs>

import { readSync, writeSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { traduzirErro } from './erros.js'
import { PREPARO } from './python-codigo.js'

const LIMITE_SAIDA = 4_000_000 // caracteres; passou disso, o resto é descartado (o aluno pode parar com Ctrl+F2)

const espera = new Int32Array(new SharedArrayBuffer(4))
const dormir = (ms) => Atomics.wait(espera, 0, 0, ms)

function escreverTudo(fd, texto) {
  const buf = Buffer.from(texto)
  for (let i = 0; i < buf.length;) {
    try {
      i += writeSync(fd, buf, i)
    } catch (e) {
      if (e.code !== 'EAGAIN') throw e
      dormir(5)
    }
  }
}

/** Lê uma linha do stdin, esperando (bloqueia o processo de propósito). null = o MisterALG fechou o pipe. */
export function criarLeitor(fd = 0) {
  const decodificador = new TextDecoder()
  const buf = Buffer.alloc(65536)
  let acumulado = ''
  return () => {
    for (;;) {
      const i = acumulado.indexOf('\n')
      if (i >= 0) {
        const linha = acumulado.slice(0, i)
        acumulado = acumulado.slice(i + 1)
        return linha.replace(/\r$/, '')
      }
      let n
      try {
        n = readSync(fd, buf, 0, buf.length, null)
      } catch (e) {
        if (e.code === 'EAGAIN') {
          dormir(10)
          continue
        }
        if (e.code === 'EOF' || e.code === 'EPIPE') return null
        throw e
      }
      if (n === 0) return null
      acumulado += decodificador.decode(buf.subarray(0, n), { stream: true })
    }
  }
}

export async function main({ pyodideUrl, ler = criarLeitor(), emitir = (ev) => escreverTudo(1, `${JSON.stringify(ev)}\n`), sair = (codigo) => process.exit(codigo) }) {
  const lerComando = () => {
    const linha = ler()
    return linha === null ? null : JSON.parse(linha)
  }

  const m = await import(/* @vite-ignore */ pyodideUrl)
  const indexURL = fileURLToPath(new URL('.', pyodideUrl))
  const py = await m.loadPyodide({ indexURL })
  py.runPython(PREPARO)

  // ---- saída: junta pedaços pequenos (um print por linha) para não inundar o pipe ----
  const decodificador = new TextDecoder()
  let pendente = ''
  let ultimoEnvio = Date.now()
  let total = 0
  let avisou = false
  const despejar = () => {
    if (!pendente) return
    emitir({ tipo: 'saida', texto: pendente })
    pendente = ''
    ultimoEnvio = Date.now()
  }
  const acrescentar = (texto) => {
    total += texto.length
    if (total > LIMITE_SAIDA) {
      if (!avisou) {
        avisou = true
        pendente += '\n[saída grande demais: o resto foi descartado — pare o programa com Ctrl+F2]\n'
      }
    } else pendente += texto
    if (pendente.length > 4096 || Date.now() - ultimoEnvio > 40) despejar()
  }
  const escritor = { isatty: true, write: (b) => { acrescentar(decodificador.decode(b, { stream: true })); return b.length } }
  py.setStdout(escritor)
  py.setStderr(escritor)

  // ---- entrada: input() bloqueia até o MisterALG mandar a linha digitada ----
  py.setStdin({
    stdin: () => {
      despejar()
      emitir({ tipo: 'entrada' })
      const cmd = lerComando()
      if (!cmd || cmd.c !== 'entrada') {
        emitir({ tipo: 'fim', estado: 'parado' })
        sair(0)
      }
      return cmd.texto
    },
  })

  // ---- pausa do passo a passo: manda a foto da memória e espera o próximo comando ----
  const pausar = (linha, foto) => {
    despejar()
    emitir({ tipo: 'pausa', linha, foto: JSON.parse(foto) })
    const cmd = lerComando()
    if (!cmd || (cmd.c !== 'passo' && cmd.c !== 'continuar')) sair(0)
    return JSON.stringify({ c: cmd.c, bps: cmd.bps ?? [] })
  }

  emitir({ tipo: 'pronto' }) // carregado: quem precisa do Python agora não espera mais
  const pedido = lerComando()
  if (!pedido) return sair(0)
  emitir({ tipo: 'inicio' })

  let erro = null
  try {
    const resultado = py.globals.get('__misteralg_rodar')(pedido.fonte, !!pedido.passo, JSON.stringify(pedido.breakpoints ?? []), pausar)
    if (resultado) erro = JSON.parse(resultado)
  } catch (e) {
    erro = { tipo: 'Error', mensagem: String(e?.message ?? e).trim().split('\n').pop(), linha: 0 }
  }
  despejar()
  if (!erro) {
    emitir({ tipo: 'fim', estado: 'terminado' })
  } else {
    if (erro.texto) emitir({ tipo: 'saida', texto: `${erro.texto.endsWith('\n') ? '' : '\n'}${erro.texto}`, erro: true })
    const t = traduzirErro(erro.tipo, erro.mensagem)
    emitir({ tipo: 'fim', estado: 'erro', erro: { mensagem: t.mensagem, explicacao: t.explicacao, linha: erro.linha } })
  }
  sair(0)
}
