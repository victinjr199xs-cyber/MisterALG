// node --test app/src/main/compilador.test.mjs — só a parte que não precisa do clang.
// (O worker importa @yowasp/clang no topo; aqui testamos a função pura isolada do arquivo.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// prefixoDeIncludes é pura; carregamos só o texto dela para não subir o worker (que precisa do workerData).
const fonte = readFileSync(new URL('./compilador.js', import.meta.url), 'utf8')
const corpo = /export function prefixoDeIncludes\(fonte\) \{[\s\S]*?\n\}/.exec(fonte)[0].replace('export ', '')
const prefixoDeIncludes = new Function(`${corpo}; return prefixoDeIncludes`)()

test('pega só os #include <...> do começo, pulando comentários e linhas vazias', () => {
  const programa = '// meu programa\n/* várias\n linhas */\n#include <iostream>\n\n#  include <vector>\nusing namespace std;\n#include <string>\nint main() {}\n'
  assert.equal(prefixoDeIncludes(programa), '#include <iostream>\n#include <vector>')
})

test('para no primeiro #define ou #include com aspas (o PCH não pode mudar o programa)', () => {
  assert.equal(prefixoDeIncludes('#define _USE_MATH_DEFINES\n#include <cmath>\n'), '')
  assert.equal(prefixoDeIncludes('#include <cstdio>\n#include "meu.h"\n#include <vector>\n'), '#include <cstdio>')
})
