import Parser from 'web-tree-sitter'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
await Parser.init({ locateFile: () => req.resolve('web-tree-sitter/tree-sitter.wasm') })
const lang = await Parser.Language.load(req.resolve('tree-sitter-wasms/out/tree-sitter-c_sharp.wasm'))
const nomes = new Set()
for (let i = 0; i < lang.nodeTypeCount; i += 1) nomes.add(lang.nodeTypeForId(i))
console.log('tipos na gramática:', nomes.size)
const usados = new Map()
const pasta = new URL('../src/', import.meta.url)
const arquivos = [...readdirSync(pasta).filter((f) => f.endsWith('.js')).map((f) => `${pasta.pathname.slice(1)}${f}`)]
for (const f of arquivos) {
  const t = readFileSync(f, 'utf8')
  for (const m of t.matchAll(/(?:case|\.t ===|\.t !==|x\.t ===|x\.t !==) '([a-z_]+)'/g)) usados.set(m[1], (usados.get(m[1]) ?? 0) + 1)
  for (const m of t.matchAll(/'([a-z]+(?:_[a-z]+)+)'/g)) usados.set(m[1], (usados.get(m[1]) ?? 0) + 1)
}
const faltam = [...usados.keys()].filter((n) => !nomes.has(n) && /_(declaration|statement|expression|pattern|clause|literal|list|operator|section|label|type|specifier|initializer|name|designation|access|element|binding|creation|arm|body|filter|modifier|variable|parameter|argument|constraint)$/.test(n))
console.log('usados que NÃO existem na gramática:', faltam.join(', '))
console.log('\ntipos da gramática com "expression":', [...nomes].filter((n) => /expression/.test(n) && !n.startsWith('_')).join(', '))
console.log('\ntipos com "pattern|clause|statement":', [...nomes].filter((n) => /pattern|clause|statement|designation|label|section/.test(n) && !n.startsWith('_')).join(', '))
