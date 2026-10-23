// O processo que executa o PHP (php-wasm) e responde a "requisições" como um servidor de desenvolvimento:
//   entra pelo stdin (uma linha de JSON por mensagem):
//     { c: 'executar', id, fonte?, arquivo?, nome, diretorio?, metodo, url, cabecalhos?, corpo? }
//        fonte    = o programa do editor (roda no lugar de <nome>); arquivo = outro .php da pasta (relativo a ela)
//        url      = o caminho com a query (?x=1), corpo = o corpo da requisição em base64
//   sai pelo stdout:
//     { tipo: 'pronto' }
//     { tipo: 'resposta', id, status, cabecalhos, corpo (base64), diagnosticos, erro? }
// Um laço infinito fica aqui, longe da IDE: o MisterALG mata este processo se a resposta demorar.
// Uso: node rodar.mjs <url do @php-wasm/node/index.js>

import { writeSync } from 'node:fs'
import { lerDiagnosticos } from './erros.js'

const ARQ_FONTE = '/tmp/script/'
const TEMPO_MAXIMO = 8 // segundos (max_execution_time do PHP)

function escreverTudo(texto) {
  const buf = Buffer.from(texto)
  for (let i = 0; i < buf.length;) {
    try {
      i += writeSync(1, buf, i)
    } catch (e) {
      if (e.code !== 'EAGAIN') throw e
    }
  }
}

export async function main({ phpUrl, entrada = process.stdin, emitir = (ev) => escreverTudo(`${JSON.stringify(ev)}\n`), sair = (c) => process.exit(c) }) {
  const { loadNodeRuntime, createNodeFsMountHandler } = await import(/* @vite-ignore */ phpUrl)
  const { PHP, setPhpIniEntries } = await import(/* @vite-ignore */ new URL('../universal/index.js', phpUrl).href)
  const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }))
  php.mkdir('/www')
  php.mkdir(ARQ_FONTE.slice(0, -1))
  await setPhpIniEntries(php, { display_errors: '1', error_reporting: '32767', max_execution_time: String(TEMPO_MAXIMO) }) // E_ALL
  php.chdir('/www')
  let montado = null
  let desmontar = null

  async function executar(p) {
    if ((p.diretorio ?? null) !== montado) {
      if (desmontar) await desmontar()
      desmontar = p.diretorio ? await php.mount('/www', createNodeFsMountHandler(p.diretorio)) : null
      montado = p.diretorio ?? null
    }
    let scriptPath
    if (p.fonte !== undefined) {
      scriptPath = `${ARQ_FONTE}${p.nome}`
      php.writeFile(scriptPath, p.fonte)
    } else scriptPath = `/www/${p.arquivo}`

    let r
    try {
      r = await php.run({
        scriptPath,
        relativeUri: p.url,
        method: p.metodo ?? 'GET',
        headers: p.cabecalhos ?? {},
        body: p.corpo ? new Uint8Array(Buffer.from(p.corpo, 'base64')) : undefined,
      })
    } catch (e) {
      if (!e.response) throw e // o PHP terminou com erro fatal: a resposta (com o que já foi escrito) vem junto
      r = e.response
    }
    const diagnosticos = lerDiagnosticos(r.errors).map((d) => ({
      ...d,
      principal: d.arquivo === scriptPath, // o programa em si, não um include
    }))
    const cabecalhos = {}
    for (const [k, v] of Object.entries(r.headers ?? {})) cabecalhos[k] = Array.isArray(v) ? v.join(', ') : String(v)
    emitir({
      tipo: 'resposta',
      id: p.id,
      status: r.httpStatusCode ?? 200,
      cabecalhos,
      corpo: Buffer.from(r.bytes ?? r.text ?? '').toString('base64'),
      diagnosticos,
    })
  }

  // As mensagens chegam em ordem e são atendidas uma de cada vez (um PHP só).
  let resto = ''
  let fila = Promise.resolve()
  entrada.setEncoding('utf8')
  entrada.on('data', (d) => {
    resto += d
    for (let i = resto.indexOf('\n'); i >= 0; i = resto.indexOf('\n')) {
      const msg = JSON.parse(resto.slice(0, i))
      resto = resto.slice(i + 1)
      if (msg.c !== 'executar') continue
      fila = fila.then(() => executar(msg)).catch((e) => {
        emitir({
          tipo: 'resposta',
          id: msg.id,
          status: 500,
          cabecalhos: { 'content-type': 'text/plain; charset=utf-8' },
          corpo: Buffer.from(`O PHP não conseguiu executar o programa: ${e?.message ?? e}`).toString('base64'),
          diagnosticos: [],
        })
      })
    }
  })
  entrada.on('end', () => sair(0))
  emitir({ tipo: 'pronto' })
}
