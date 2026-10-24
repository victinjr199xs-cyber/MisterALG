// C# 11: `>>>` e textos cru ("""): a reescrita antes da leitura não pode mexer nas linhas do programa.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rodar } from './ajudante.mjs'

test('erro em tempo de execução depois de um texto cru aponta a linha certa', async () => {
  const r = await rodar(['using System;', 'class P {', '  static void Main() {', '    var s = $"""', '      a {1 + 1}', '      b', '      """;', '    int z = 0;', '    Console.WriteLine(s + (10 >>> 1) + 1 / z);', '  }', '}'].join('\n'))
  assert.equal(r.status, 'erro')
  assert.equal(r.sessao.linhaAtual, 9)
  assert.equal(r.saida, '')
})

test('erro de escrita depois de um texto cru aponta a linha certa', async () => {
  const r = await rodar(['class P {', '  static void Main() {', '    var s = """', '      x', '      """;', '    int y = ;', '  }', '}'].join('\n'))
  assert.equal(r.status, 'sintaxe')
  assert.equal(r.erros[0].linha, 6)
})

test('>>> com genéricos fechando junto no mesmo comando', async () => {
  const r = await rodar('using System;\nusing System.Collections.Generic;\nclass P { static void Main() { var l = new List<List<List<int>>>(); int a = -8; Console.WriteLine(l.Count + " " + (a >>> 30)); } }')
  assert.equal(r.saida, '0 3\n')
})
