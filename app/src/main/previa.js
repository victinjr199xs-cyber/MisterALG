// A página ao vivo do PHP: um mini servidor de desenvolvimento dentro do app. O iframe da IDE abre
// misteralg-previa://pagina/<arquivo>; cada requisição (a página, um link, um formulário) é executada
// pelo PHP na hora. O programa do editor vale no lugar do arquivo aberto; os outros arquivos vêm da pasta
// dele (include, css, imagens), só para leitura.

import { protocol } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import { executar } from './php.js'

export const ESQUEMA = 'misteralg-previa'

// Antes do app ficar pronto: o esquema precisa ser "standard" para ter caminho e query como uma URL de verdade.
export const registrarEsquema = () => protocol.registerSchemesAsPrivileged([{ scheme: ESQUEMA, privileges: { standard: true, secure: true } }])

// A página roda isolada (iframe com sandbox): scripts e estilos dela valem, o resto da IDE não é alcançável.
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline' https: misteralg-previa:; img-src data: https: misteralg-previa:; font-src data: https: misteralg-previa:; media-src data: https: misteralg-previa:; form-action misteralg-previa:; base-uri 'self'"

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

let pagina = null // { fonte, nome, diretorio }
let ultima = null // a última resposta da página principal, para a visão "HTML gerado"
let aoResposta = () => {}

/** Define o programa que a página mostra. @returns a URL que o iframe deve abrir. */
export function definirPagina(p) {
  pagina = { fonte: String(p.fonte ?? ''), nome: String(p.nome || 'index.php').replace(/[\\/]/g, '_'), diretorio: p.diretorio || null }
  return `${ESQUEMA}://pagina/${encodeURIComponent(pagina.nome)}`
}

export const ultimaResposta = () => ultima

const resposta = (corpo, status, tipo) => new Response(corpo, { status, headers: { 'content-type': tipo, 'content-security-policy': CSP, 'cache-control': 'no-store' } })
const naoAchei = (caminho) => resposta(`<p style="font:16px sans-serif">Não achei <b>${caminho.replace(/[<>&]/g, '')}</b> na pasta do programa.</p>`, 404, 'text/html; charset=utf-8')

/** Resolve o caminho da URL dentro da pasta do programa, sem deixar sair dela. */
function dentroDaPasta(caminho) {
  if (!pagina?.diretorio) return null
  const base = resolve(pagina.diretorio)
  const alvo = resolve(join(base, caminho))
  return alvo === base || alvo.startsWith(base + sep) ? alvo : null
}

async function manipular(req) {
  if (!pagina) return naoAchei('nenhum programa')
  const url = new URL(req.url)
  const caminho = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  const principal = caminho === '' || caminho === pagina.nome

  let pedidoPHP = null
  if (principal) pedidoPHP = { fonte: pagina.fonte, nome: pagina.nome }
  else {
    let alvo = dentroDaPasta(caminho)
    if (!alvo) return naoAchei(caminho)
    let info = await stat(alvo).catch(() => null)
    if (info?.isDirectory()) {
      for (const indice of ['index.php', 'index.html']) {
        const candidato = join(alvo, indice)
        if (await stat(candidato).then((s) => s.isFile()).catch(() => false)) {
          alvo = candidato
          info = await stat(alvo)
          break
        }
      }
    }
    if (!info?.isFile()) return naoAchei(caminho)
    if (extname(alvo).toLowerCase() !== '.php') {
      return resposta(await readFile(alvo), 200, MIME[extname(alvo).toLowerCase()] ?? 'application/octet-stream')
    }
    pedidoPHP = { arquivo: relative(resolve(pagina.diretorio), alvo).split(sep).join('/') }
  }

  const cabecalhos = {}
  for (const [k, v] of req.headers) if (!['host', 'content-length', 'connection', 'origin', 'referer'].includes(k)) cabecalhos[k] = v
  const comCorpo = req.method !== 'GET' && req.method !== 'HEAD'
  const inicio = Date.now()
  const r = await executar({
    ...pedidoPHP,
    nome: pagina.nome,
    diretorio: pagina.diretorio,
    metodo: req.method,
    url: `/${caminho || pagina.nome}${url.search}`,
    cabecalhos,
    corpo: comCorpo ? Buffer.from(await req.arrayBuffer()).toString('base64') : undefined,
  })
  const corpo = Buffer.from(r.corpo, 'base64')
  if (principal || pedidoPHP.arquivo) {
    ultima = { texto: corpo.toString('utf8').slice(0, 2_000_000), status: r.status, diagnosticos: r.diagnosticos, ms: Date.now() - inicio, bytes: corpo.length, arquivo: pedidoPHP.arquivo ?? pagina.nome }
    aoResposta(ultima)
  }
  const cab = new Headers()
  for (const [k, v] of Object.entries(r.cabecalhos)) if (!['content-length', 'transfer-encoding', 'content-encoding', 'set-cookie'].includes(k)) cab.set(k, v)
  cab.set('content-security-policy', CSP)
  cab.set('cache-control', 'no-store')
  return new Response(r.status === 204 || r.status === 304 ? null : corpo, { status: r.status, headers: cab })
}

/** Liga o esquema ao PHP (depois do app pronto). `quandoRespondeu(ultima)` avisa a IDE a cada página principal. */
export function iniciarPrevia(quandoRespondeu) {
  aoResposta = quandoRespondeu
  protocol.handle(ESQUEMA, manipular)
}
