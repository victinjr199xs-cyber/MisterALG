// Compila programas C com o clang (WebAssembly) e devolve a árvore, como o app faz.
import { runClang } from '@yowasp/clang'
import { ARGUMENTOS_AST_C, CABECALHOS_C } from '../src/cabecalhos.js'
import { ARGUMENTOS_AST_CPP, cabecalhosCppPara } from '../src/cabecalhos-cpp.js'
import { rodarC } from '../src/index.js'

export async function astDe(fonte, cpp = false) {
  let saida = ''
  let erros = ''
  const d1 = new TextDecoder()
  const d2 = new TextDecoder()
  try {
    const arquivos = cpp ? { 'programa.cpp': fonte, mini: cabecalhosCppPara(fonte) } : { 'programa.c': fonte, mini: CABECALHOS_C }
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
