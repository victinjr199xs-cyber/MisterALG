// Processo à parte que roda um programa C/C++ já compilado (WebAssembly + WASI).
// A entrada e a saída padrão são os pipes que o MisterALG lê e escreve; um laço
// infinito ou um travamento ficam aqui, longe da IDE. Uso: rodar-wasm.js <programa.wasm>

import { readFileSync } from 'node:fs'
import { WASI } from 'node:wasi'

const MARCA_ERRO = '\u0001MISTERALG-ERRO:' // o mesmo texto em main/clang.js

const EXPLICACOES = [
  [/memory access out of bounds|out of bounds memory access/i, 'acesso à memória fora dos limites (ponteiro inválido ou NULL, ou índice fora do vetor)'],
  [/divide by zero/i, 'divisão inteira por zero'],
  [/integer overflow/i, 'estouro de inteiro numa divisão'],
  [/unreachable/i, 'o programa abortou (abort, assert, ou uma exceção que nenhum catch tratou)'],
  [/call stack|stack size/i, 'a pilha de chamadas estourou (recursão infinita?)'],
]

{
  const wasi = new WASI({ version: 'preview1', args: ['programa'], env: { LANG: 'C.UTF-8' }, returnOnExit: true })
  try {
    const modulo = await WebAssembly.compile(readFileSync(process.argv[2]))
    process.exitCode = wasi.start(await WebAssembly.instantiate(modulo, wasi.getImportObject()))
  } catch (e) {
    const motivo = EXPLICACOES.find(([re]) => re.test(e.message))?.[1] ?? e.message
    process.stderr.write(`${MARCA_ERRO}${motivo}\n`)
    process.exitCode = 101
  }
}
