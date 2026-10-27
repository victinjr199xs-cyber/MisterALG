// O roteiro do tutorial: os passos de cada linguagem, os textos (todos traduzíveis), o primeiro
// programa (que roda e não quebra com as traduções) e a posição do balão.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LINGUAGENS, passosDoPasseio, passosDoPrograma, posicaoDoBalao, primeiroPrograma } from './tutorial-passos.js'
import CHAVES from '../compartilhado/traducoes/chaves.js'
import { IDIOMAS, tradutor } from '../compartilhado/idiomas.js'
import { rodar } from '../../../packages/interpreter/src/index.js'

const todos = (l) => [...passosDoPasseio(l), ...passosDoPrograma(l)]
const textos = new Set(Object.values(CHAVES))

test('cada linguagem tem passeio e primeiro programa, e todo texto está em chaves.js', () => {
  for (const l of LINGUAGENS) {
    const passos = todos(l)
    assert.ok(passos.length >= 10, l)
    assert.equal(passos.filter((p) => p.acao === 'programa').length, 1, `${l}: um passo que escreve o programa`)
    for (const p of passos) assert.ok(textos.has(p.texto), `${l}: sem tradução: ${p.texto}`)
    assert.ok(primeiroPrograma(l).trim().length > 20, l)
  }
})

test('o PHP não tem F8 nem painel de memória; o SQL não pede digitação; os outros esperam F9, a entrada e o F8', () => {
  const php = todos('php')
  assert.ok(!php.some((p) => p.alvo === '.moldura-variaveis' || p.espera === 'pausa'))
  assert.ok(php.some((p) => p.espera === 'pagina'))
  const sql = passosDoPrograma('sql')
  assert.ok(!sql.some((p) => /digite/i.test(p.texto)))
  assert.deepEqual(sql.filter((p) => p.espera).map((p) => p.espera), ['fim', 'pausa', 'fim'])
  for (const l of ['portugol', 'c', 'cpp', 'csharp', 'javascript', 'typescript', 'python']) {
    assert.deepEqual(passosDoPrograma(l).filter((p) => p.espera).map((p) => p.espera), ['inicio', 'fim', 'pausa', 'fim'], l)
  }
  // C e C++ avisam que compilar e preparar o passo a passo demora
  assert.match(passosDoPrograma('cpp').find((p) => p.espera === 'inicio').texto, /compilado/)
})

test('as frases traduzidas do programa não quebram as strings do código', () => {
  for (const { id } of IDIOMAS) {
    const t = tradutor(id)
    for (const l of LINGUAGENS) {
      const fonte = primeiroPrograma(l, t)
      for (const linha of fonte.split('\n')) {
        assert.equal((linha.match(/"/g) ?? []).length % 2, 0, `${id} ${l}: ${linha}`)
      }
      if (l !== 'portugol' && l !== 'sql' && id !== 'pt') assert.ok(fonte.includes(t('Olá')), `${id} ${l}`)
    }
  }
  assert.ok(primeiroPrograma('portugol', tradutor('en')).includes('Qual é o seu nome?'), 'o Portugol continua em português')
})

test('o primeiro programa em Portugol roda: pergunta, cumprimenta e conta até 3', async () => {
  const r = await rodar(primeiroPrograma('portugol'), { entradas: ['Ana'] })
  assert.equal(r.status, 'terminado', r.erro?.mensagem)
  assert.match(r.saida, /Olá, Ana!/)
  assert.match(r.saida, /Contando:\s+3/)
})

test('o balão fica dentro da janela, ao lado do alvo, e vai para o outro lado em RTL', () => {
  const janela = { w: 1000, h: 700 }
  const balao = { w: 340, h: 160 }
  const dentro = (p) => p.x >= 0 && p.y >= 0 && p.x + balao.w <= janela.w && p.y + balao.h <= janela.h
  // sem alvo: no centro
  assert.deepEqual(posicaoDoBalao(null, balao, janela), { x: 330, y: 270, lado: 'centro' })
  // um botão da barra: embaixo dele
  const botao = { x: 100, y: 4, w: 24, h: 24 }
  const p = posicaoDoBalao(botao, balao, janela)
  assert.equal(p.lado, 'baixo')
  assert.ok(p.y >= botao.y + botao.h && dentro(p))
  // a coluna da direita inteira: não cabe em cima nem embaixo, vai para o lado de onde se começa a ler
  const coluna = { x: 600, y: 30, w: 400, h: 640 }
  assert.equal(posicaoDoBalao(coluna, balao, janela).lado, 'antes')
  const editor = { x: 0, y: 30, w: 600, h: 640 }
  assert.equal(posicaoDoBalao(editor, balao, janela).lado, 'depois')
  assert.equal(posicaoDoBalao(editor, balao, janela, { rtl: true }).lado, 'antes') // em RTL o "depois" é a esquerda, que não cabe
  // passos de ação: no canto de baixo do lado do editor
  const canto = posicaoDoBalao(coluna, balao, janela, { canto: true })
  assert.deepEqual([canto.x, canto.lado], [12, 'canto'])
  assert.equal(posicaoDoBalao(coluna, balao, janela, { canto: true, rtl: true }).x, 1000 - 12 - 340)
  // janela pequena e alvos em qualquer lugar: o balão nunca sai
  for (let i = 0; i < 300; i += 1) {
    const j = { w: 360 + (i * 37) % 900, h: 200 + (i * 53) % 700 }
    const b = { w: Math.min(340, j.w - 24), h: 150 }
    const a = { x: (i * 71) % j.w, y: (i * 29) % j.h, w: 10 + (i * 13) % 500, h: 10 + (i * 17) % 400 }
    const q = posicaoDoBalao(a, b, j, { rtl: i % 2 === 0, canto: i % 5 === 0 })
    assert.ok(q.x >= 0 && q.y >= 0 && q.x + b.w <= j.w && q.y + b.h <= j.h, JSON.stringify({ j, a, q }))
  }
})
