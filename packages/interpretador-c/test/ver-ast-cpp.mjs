// Mostra a árvore C++ de um programa (só os tipos de nó do main e de uma classe), para estudo.
import { runClang } from '@yowasp/clang'
import { readFileSync } from 'node:fs'
import { ARGUMENTOS_AST_CPP, CABECALHOS_CPP } from '../src/cabecalhos-cpp.js'

const fonte = readFileSync(process.argv[2], 'utf8')
let json = ''
let erros = ''
const d = new TextDecoder()
const d2 = new TextDecoder()
try {
  await runClang(ARGUMENTOS_AST_CPP, { 'programa.cpp': fonte, mini: CABECALHOS_CPP }, {
    stdout: (b) => { if (b) json += d.decode(b, { stream: true }) },
    stderr: (b) => { if (b) erros += d2.decode(b, { stream: true }) },
    fetchProgress: () => {},
  })
} catch {
  console.log('ERROS:', erros)
  process.exit(1)
}
console.log('tamanho', json.length, erros)
const ast = JSON.parse(json)
const resumo = (n, nivel = 0) => {
  if (!n || typeof n !== 'object' || nivel > 14) return ''
  const extra = ['name', 'opcode', 'castKind', 'valueCategory', 'isArrow'].filter((k) => n[k] !== undefined).map((k) => `${k}=${JSON.stringify(n[k])}`).join(' ')
  const tipo = n.type?.qualType ? ` : ${n.type.qualType}` : ''
  const ref = n.referencedDecl ? ` -> ${n.referencedDecl.kind} ${n.referencedDecl.name}` : n.referencedMemberDecl ? ` -> membro ${n.referencedMemberDecl}` : ''
  const ctor = n.ctorType ? ` ctor=${n.ctorType.qualType}` : ''
  let s = `${'  '.repeat(nivel)}${n.kind} ${extra}${tipo}${ref}${ctor}\n`
  for (const f of n.inner ?? []) s += resumo(f, nivel + 1)
  return s
}
for (const n of ast.inner) {
  if (n.loc?.includedFrom || n.isImplicit) continue
  console.log(resumo(n))
}
