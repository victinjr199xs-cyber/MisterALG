// Testes com os exemplos próprios do MisterALG (pasta exemplos/), que vão no
// repositório público. Saídas conferidas à mão.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decodificar, rodar } from '../packages/interpreter/src/index.js'

const fonte = (nome) => decodificar(readFileSync(new URL(`../exemplos/${nome}`, import.meta.url)))

const CASOS = [
  {
    arquivo: 'media_notas.alg',
    entradas: ['Ana', '8', '6.5'],
    saida: 'Nome do aluno: Ana\nPrimeira nota: 8\nSegunda nota: 6.5\nMédia de Ana:   7.3\nSituação: APROVADO\n',
  },
  {
    arquivo: 'media_notas.alg',
    entradas: ['Bia', '4', '3'],
    saida: 'Nome do aluno: Bia\nPrimeira nota: 4\nSegunda nota: 3\nMédia de Bia:   3.5\nSituação: REPROVADO\n',
  },
  {
    arquivo: 'tabuada.alg',
    entradas: ['7'],
    saida: 'Tabuada de qual número? 7\n' + Array.from({ length: 10 }, (_, i) =>
      `  7 x${String(i + 1).padStart(3)} =${String(7 * (i + 1)).padStart(4)}\n`).join(''),
  },
  { arquivo: 'fatorial_recursivo.alg', entradas: ['6'], saida: 'Calcular o fatorial de: 6\n 6! = 720\n' },
  { arquivo: 'ordena_vetor.alg', entradas: [], saida: 'Ordenado: 3 7 11 19 25 42\n' },
  {
    arquivo: 'cadastro_registro.alg',
    entradas: ['Caneta', '2.5', '10', 'Caderno', '15', '4', 'Lápis', '1.2', '5'],
    saida: 'Produto  1\n  nome: Caneta\n  preço: 2.5\n  estoque: 10\n'
      + 'Produto  2\n  nome: Caderno\n  preço: 15\n  estoque: 4\n'
      + 'Produto  3\n  nome: Lápis\n  preço: 1.2\n  estoque: 5\n'
      + 'Valor total em estoque: R$     91.00\n',
  },
]

for (const c of CASOS) {
  test(`${c.arquivo} ${JSON.stringify(c.entradas)}`, async () => {
    const r = await rodar(fonte(c.arquivo), { entradas: c.entradas })
    assert.notEqual(r.status, 'erro', r.erro?.mensagem)
    assert.equal(r.saida, c.saida)
  })
}

test('adivinhe_numero.alg: com sorteio fixo, acerta na terceira', async () => {
  // rng = 0.5 → randi(50) = 25 → secreto = 26
  const r = await rodar(fonte('adivinhe_numero.alg'), { entradas: ['10', '40', '26'], rng: () => 0.5 })
  assert.equal(r.saida,
    'Seu palpite (1 a 50): 10\nÉ maior.\nSeu palpite (1 a 50): 40\nÉ menor.\nSeu palpite (1 a 50): 26\nAcertou em  3 tentativa(s)!\n')
})
