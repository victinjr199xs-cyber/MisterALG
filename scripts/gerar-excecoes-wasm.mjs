// Gera app/src/main/excecoes-wasm.js: a parte de exceções da libc++abi (cxa_exception,
// cxa_personality) + o Unwind-wasm do libunwind, compiladas com -fwasm-exceptions pelo
// mesmo clang em WebAssembly do app. O sysroot do @yowasp/clang vem sem essa parte, e
// sem ela try/catch/throw não ligam no F9.
//
// Uso: node scripts/gerar-excecoes-wasm.mjs [pasta-do-llvm-project]
// Sem pasta, baixa só libcxxabi, libunwind e libcxx/src/include da tag do LLVM abaixo
// (git sparse) numa pasta temporária. Rode de novo ao trocar a versão do @yowasp/clang.

import { runClang, runLLVM } from '@yowasp/clang'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TAG = 'llvmorg-22.1.0' // a mesma versão do clang do @yowasp/clang (22.x)
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

let llvm = process.argv[2]
if (!llvm) {
  llvm = join(mkdtempSync(join(tmpdir(), 'misteralg-llvm-')), 'llvm-project')
  execFileSync('git', ['clone', '--depth', '1', '--branch', TAG, '--filter=blob:none', '--sparse', 'https://github.com/llvm/llvm-project.git', llvm], { stdio: 'inherit' })
  execFileSync('git', ['-C', llvm, 'sparse-checkout', 'set', 'libcxxabi/src', 'libcxxabi/include', 'libunwind/src', 'libunwind/include', 'libcxx/src/include'], { stdio: 'inherit' })
}
if (!existsSync(join(llvm, 'libcxxabi/src/cxa_exception.cpp'))) throw new Error(`não achei o llvm-project em ${llvm}`)

function arvore(dir) {
  const t = {}
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) t[nome] = arvore(p)
    else if (/\.(h|hpp|c|cpp|inc|def)$/.test(nome)) t[nome] = readFileSync(p, 'utf8')
  }
  return t
}

const fontes = {
  libcxxabi: { src: arvore(join(llvm, 'libcxxabi/src')), include: arvore(join(llvm, 'libcxxabi/include')) },
  libunwind: { src: arvore(join(llvm, 'libunwind/src')), include: arvore(join(llvm, 'libunwind/include')) },
  libcxx: { src: { include: arvore(join(llvm, 'libcxx/src/include')) } },
  // A "tag" de exceção do C++ no WebAssembly: quem lança e quem captura só a declaram; alguém precisa defini-la.
  'tag.S': '  .globl __cpp_exception\n  .tagtype __cpp_exception i32\n__cpp_exception:\n',
}
const comuns = ['-c', '-O2', '-DNDEBUG', '-fwasm-exceptions', '-fno-color-diagnostics', '-I', 'libcxxabi/include', '-I', 'libcxx/src', '-I', 'libunwind/include']
const LIBCXXABI = ['-std=c++20', '-D_LIBCXXABI_BUILDING_LIBRARY', '-D_LIBCPP_BUILDING_LIBRARY', '-DLIBCXXABI_USE_LLVM_UNWINDER']
const unidades = [
  ['clang++', 'libcxxabi/src/cxa_exception.cpp', LIBCXXABI],
  ['clang++', 'libcxxabi/src/cxa_personality.cpp', LIBCXXABI],
  ['clang', 'libunwind/src/Unwind-wasm.c', ['-std=c11', '-D_LIBUNWIND_HIDE_SYMBOLS']],
  ['clang', 'tag.S', []],
]

const objetos = {}
for (const [cc, arquivo, extras] of unidades) {
  const saida = arquivo.split('/').pop().replace(/\.\w+$/, '.o')
  let erros = ''
  const d = new TextDecoder()
  try {
    const r = await runClang([cc, ...comuns, ...extras, arquivo, '-o', saida], fontes, {
      stderr: (b) => { if (b) erros += d.decode(b, { stream: true }) },
      fetchProgress: () => {},
    })
    objetos[saida] = r[saida]
  } catch {
    throw new Error(`${arquivo} não compilou:\n${erros}`)
  }
}
const r = await runLLVM(['ar', 'rcs', 'libexcecoes.a', ...Object.keys(objetos)], objetos)
const base64 = Buffer.from(r['libexcecoes.a']).toString('base64')
writeFileSync(join(RAIZ, 'app/src/main/excecoes-wasm.js'), `// Gerado por scripts/gerar-excecoes-wasm.mjs a partir do LLVM ${TAG} (libcxxabi e libunwind,
// licença Apache 2.0 com exceção LLVM). Não edite: rode o script de novo.
export const LIB_EXCECOES = '${base64}'
`)
console.log(`app/src/main/excecoes-wasm.js: libexcecoes.a com ${r['libexcecoes.a'].length} bytes`)
