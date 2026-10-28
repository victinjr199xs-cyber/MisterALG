// Compila programas C com o clang (WebAssembly) e devolve a árvore, como o app faz.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runClang } from '@yowasp/clang'
import { ARGUMENTOS_AST_C, CABECALHOS_C } from '../src/cabecalhos.js'
import { ARGUMENTOS_AST_CPP, cabecalhosCppPara } from '../src/cabecalhos-cpp.js'
import { rodarC } from '../src/index.js'

// O clang wasm recarrega ~100 MB a cada chamada (9 a 100 s por programa) e a suite compila centenas deles (nao e
// travamento, so lentidao): a saida fica em cache em disco, indexada pelo hash dos argumentos, cabecalhos e fonte.
const DIR_CACHE = process.env.MISTERALG_AST_CACHE || join(tmpdir(), 'misteralg-ast-cache')

export async function astDe(fonte, cpp = false) {
  const arquivos = cpp ? { 'programa.cpp': fonte, mini: cabecalhosCppPara(fonte) } : { 'programa.c': fonte, mini: CABECALHOS_C }
  const chave = createHash('sha256').update(JSON.stringify([cpp ? ARGUMENTOS_AST_CPP : ARGUMENTOS_AST_C, arquivos])).digest('hex')
  const arq = join(DIR_CACHE, chave + '.txt')
  try { return readFileSync(arq, 'utf8') } catch {}
  const saida = await compilarAst(fonte, cpp, arquivos)
  try { mkdirSync(DIR_CACHE, { recursive: true }); writeFileSync(arq, saida) } catch {}
  return saida
}

async function compilarAst(fonte, cpp, arquivos) {
  let saida = ''
  let erros = ''
  const d1 = new TextDecoder()
  const d2 = new TextDecoder()
  try {
    await runClang(cpp ? ARGUMENTOS_AST_CPP : ARGUMENTOS_AST_C, arquivos, {
      stdout: (b) => { if (b) saida += d1.decode(b, { stream: true }) },
      stderr: (b) => { if (b) erros += d2.decode(b, { stream: true }) },
      fetchProgress: () => {},
    })
  } catch (e) {
    throw new Error(`não compilou:\n${erros || e.message}`)
  }
  return saida
}

export async function rodar(fonte, entrada = [], opcoes = {}) {
  return rodarC(await astDe(fonte), fonte, { entrada, ...opcoes })
}

export async function rodarCpp(fonte, entrada = [], opcoes = {}) {
  return rodarC(await astDe(fonte, true), fonte, { entrada, cpp: true, ...opcoes })
}
