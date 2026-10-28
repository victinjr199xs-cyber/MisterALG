// Barra de ferramentas e conta do aluno: lógica pura (botões ocultos, iniciais, foto, contraste dos ícones).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BARRA, ESSENCIAIS, idsOcultaveis, itensVisiveis } from './barra.js'
import { iniciais, recorteQuadrado, validarFoto } from './conta.js'
import { TEMAS } from './temas.js'

const luz = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

test('ícones: acentos de todos os temas têm contraste >= 3:1 com a janela', () => {
  for (const t of TEMAS) {
    for (const [nome, cor] of Object.entries(t.icones)) assert.ok(contraste(cor, t.fundo) >= 3, `${t.id}.${nome} ${cor} sobre ${t.fundo}: ${contraste(cor, t.fundo).toFixed(2)}`)
  }
})

test('barra: nada oculto mostra tudo, menos separadores nas pontas', () => {
  const ver = itensVisiveis([])
  assert.equal(ver.length, BARRA.length)
  BARRA.forEach((item, n) => assert.equal(ver[n], true, String(item)))
})

test('barra: essenciais e ids desconhecidos não saem', () => {
  assert.deepEqual(idsOcultaveis(['executar', 'xis', 'copiar', 'novo']), ['copiar'])
  assert.deepEqual(idsOcultaveis(null), [])
  for (const id of ESSENCIAIS) assert.ok(BARRA.some((i) => i[0] === id), id)
  const ver = itensVisiveis(['executar'])
  assert.equal(ver[BARRA.findIndex((i) => i[0] === 'executar')], true)
})

test('barra: ocultar um botão tira o resto do grupo e não deixa separador sobrando', () => {
  const grupo = ['cortar', 'copiar', 'colar']
  const ver = itensVisiveis(grupo)
  assert.equal(ver[BARRA.findIndex((i) => i[0] === 'copiar')], false)
  // nenhum separador visível na ponta nem dois seguidos
  const mostrados = BARRA.filter((_, n) => ver[n])
  assert.notEqual(mostrados[0], '|')
  assert.notEqual(mostrados.at(-1), '|')
  mostrados.forEach((x, n) => assert.ok(!(x === '|' && mostrados[n + 1] === '|')))
})

test('barra: timer e aleatório levam seus campos junto', () => {
  const ver = itensVisiveis(['timer', 'aleatorio'])
  assert.equal(ver[BARRA.indexOf('intervalo')], false)
  assert.equal(ver[BARRA.indexOf('faixa')], false)
  assert.equal(itensVisiveis([])[BARRA.indexOf('faixa')], true)
})

test('barra: grupo inteiro oculto some com o separador', () => {
  const grupoBlocos = ['gravar-bloco', 'inserir-bloco', 'desfazer', 'refazer']
  const ver = itensVisiveis(grupoBlocos)
  const antes = BARRA.findIndex((i) => i[0] === 'colar')
  const depois = BARRA.findIndex((i) => i[0] === 'localizar')
  const entre = ver.slice(antes + 1, depois).filter(Boolean).length
  assert.equal(entre, 1) // um só separador entre colar e localizar
})

test('conta: iniciais do nome', () => {
  assert.equal(iniciais('Maria da Silva'), 'MS')
  assert.equal(iniciais('  ana '), 'A')
  assert.equal(iniciais('joão-pedro'), 'JP')
  assert.equal(iniciais('Élida'), 'É')
  assert.equal(iniciais('李小龙'), '李')
  assert.equal(iniciais(''), '')
  assert.equal(iniciais(null), '')
  assert.equal(iniciais('!!!'), '')
})

test('conta: valida o arquivo da foto', () => {
  assert.deepEqual(validarFoto({ extensao: '.PNG', tamanho: 1000 }), { ok: true })
  assert.deepEqual(validarFoto({ extensao: 'webp', tamanho: 5 * 1024 * 1024 }), { ok: true })
  assert.equal(validarFoto({ extensao: 'svg', tamanho: 10 }).motivo, 'tipo')
  assert.equal(validarFoto({ extensao: 'gif', tamanho: 10 }).motivo, 'tipo')
  assert.equal(validarFoto({ extensao: 'jpg', tamanho: 5 * 1024 * 1024 + 1 }).motivo, 'tamanho')
  assert.equal(validarFoto({ extensao: 'jpg', tamanho: 0 }).motivo, 'tamanho')
})

test('conta: recorte quadrado ao centro', () => {
  assert.deepEqual(recorteQuadrado(400, 200), { x: 100, y: 0, width: 200, height: 200 })
  assert.deepEqual(recorteQuadrado(100, 300), { x: 0, y: 100, width: 100, height: 100 })
})
