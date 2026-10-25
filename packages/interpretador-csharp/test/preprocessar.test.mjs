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

test('padrão de lista e "abc"u8 não mudam as linhas: erro depois aponta a linha certa', async () => {
  const r = await rodar(['using System;', 'class P {', '  static void Main() {', '    int[] a = { 1, 2, 3 };', '    var b = "abc"u8;', '    if (a is [.., var u] && a is [1, .. var m])', '      Console.WriteLine(u + m.Length + b.Length);', '    int z = 0;', '    Console.WriteLine(1 / z);', '  }', '}'].join('\n'))
  assert.equal(r.status, 'erro')
  assert.equal(r.sessao.linhaAtual, 9)
  assert.equal(r.saida, '8\n')
})

test('erro de escrita depois de padrão de lista aponta a linha certa', async () => {
  const r = await rodar(['class P {', '  static void Main() {', '    int[] a = { 1 };', '    var t = a is [.., var u];', '    int y = ;', '  }', '}'].join('\n'))
  assert.equal(r.status, 'sintaxe')
  assert.equal(r.erros[0].linha, 5)
})

// O dotnet recusa u8 em texto interpolado com "CS1002: ; esperado" na coluna do u8 ($"a{x}"u8 → (2,58); com $""" → (2,62), de 1).
test('$"..."u8 é erro de escrita na coluna do u8, como no dotnet', async () => {
  for (const [lit, col] of [['$"a{x}"u8', 57], ['$"""a{x}"""u8', 61]]) {
    const r = await rodar(`using System;\nclass P { static void Main() { int x = 1; var b = ${lit}; Console.WriteLine(b.Length); } }`)
    assert.equal(r.status, 'sintaxe')
    assert.deepEqual([r.erros[0].linha, r.erros[0].coluna], [2, col])
  }
})

test('u8 em texto cru e fatia com subpadrão não mudam as linhas', async () => {
  const r = await rodar(['using System;', 'class P {', '  static void Main() {', '    var b = """', '      oi', '      """u8;', '    int[] a = { 1, 2, 3 };', '    Console.WriteLine(b.Length + " " + (a is [1, .. [2, 3] t] ? t.Length : 0));', '    int z = 0;', '    Console.WriteLine(1 / z);', '  }', '}'].join('\n'))
  assert.equal(r.status, 'erro')
  assert.equal(r.sessao.linhaAtual, 10)
  assert.equal(r.saida, '2 2\n')
})

test('>>> com genéricos fechando junto no mesmo comando', async () => {
  const r = await rodar('using System;\nusing System.Collections.Generic;\nclass P { static void Main() { var l = new List<List<List<int>>>(); int a = -8; Console.WriteLine(l.Count + " " + (a >>> 30)); } }')
  assert.equal(r.saida, '0 3\n')
})
