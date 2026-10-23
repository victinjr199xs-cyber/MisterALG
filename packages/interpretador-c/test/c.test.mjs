// Passo a passo do C: cada programa é compilado pelo clang (só a árvore) e executado pela MaquinaC.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { astDe, rodar } from './ajudante.mjs'
import { SessaoC, descrever, nomeDoEndereco } from '../src/index.js'

test('olá mundo com acento', async () => {
  const r = await rodar('#include <stdio.h>\nint main(void) {\n  printf("Olá, mundo!\\n");\n  return 0;\n}\n')
  assert.equal(r.status, 'terminado')
  assert.equal(r.saida, 'Olá, mundo!\n')
})

test('scanf, laços, vetores e média', async () => {
  const r = await rodar(`#include <stdio.h>
int main(void) {
  int n, v[10], soma = 0;
  scanf("%d", &n);
  for (int i = 0; i < n; i++) { scanf("%d", &v[i]); soma += v[i]; }
  double media = (double)soma / n;
  printf("soma=%d media=%.2f maior=", soma, media);
  int maior = v[0];
  int i = 1;
  while (i < n) { if (v[i] > maior) maior = v[i]; i++; }
  printf("%d\\n", maior);
  return 0;
}`, ['4', '7 2 9', '1'])
  assert.equal(r.saida, 'soma=19 media=4.75 maior=9\n')
})

test('struct, typedef, ponteiros, malloc e free', async () => {
  const r = await rodar(`#include <stdio.h>
#include <stdlib.h>
typedef struct { char nome[20]; int idade; } Pessoa;
struct No { int valor; struct No *prox; };
int main(void) {
  Pessoa p = {"Ana", 20};
  Pessoa *q = &p;
  q->idade += 1;
  struct No *lista = NULL;
  for (int i = 1; i <= 3; i++) {
    struct No *novo = malloc(sizeof(struct No));
    novo->valor = i * 10;
    novo->prox = lista;
    lista = novo;
  }
  printf("%s tem %d anos;", p.nome, p.idade);
  while (lista != NULL) { struct No *x = lista; printf(" %d", x->valor); lista = lista->prox; free(x); }
  printf("\\n");
  return 0;
}`)
  assert.equal(r.status, 'terminado', r.erro?.mensagem)
  assert.equal(r.saida, 'Ana tem 21 anos; 30 20 10\n')
})

test('textos: strcpy, strcat, strlen, strcmp, sprintf, toupper', async () => {
  const r = await rodar(`#include <stdio.h>
#include <string.h>
#include <ctype.h>
int main(void) {
  char a[30], b[30];
  strcpy(a, "bom");
  strcat(a, " dia");
  sprintf(b, "%s(%zu)", a, strlen(a));
  for (int i = 0; b[i]; i++) b[i] = toupper(b[i]);
  printf("%s %d %d\\n", b, strcmp("abc", "abd") < 0, strcmp(a, "bom dia"));
  char nome[20];
  scanf("%s", nome);
  printf("[%5s|%-5s]\\n", nome, nome);
  return 0;
}`, ['Bia'])
  assert.equal(r.saida, 'BOM DIA(7) 1 0\n[  Bia|Bia  ]\n')
})

test('recursão, switch, do-while, ternário, ++ e --, aritmética de ponteiros, matriz', async () => {
  const r = await rodar(`#include <stdio.h>
long long fat(int n) { return n <= 1 ? 1 : n * fat(n - 1); }
int main(void) {
  int m[2][3] = {{1, 2, 3}, {4, 5, 6}};
  int s = 0;
  for (int i = 0; i < 2; i++) for (int j = 0; j < 3; j++) { if (j == 1) continue; s += m[i][j]; }
  int v[] = {5, 6, 7}, *p = v;
  p++;
  int x = *p-- + *(p + 2);
  int k = 0;
  do { k += 2; } while (k < 7);
  switch (k) { case 8: printf("oito "); case 9: printf("nove "); break; default: printf("outro "); }
  printf("%d %d %d %lld %d\\n", s, x, k, fat(20), 7 / 2 + 7 % 3);
  return 0;
}`)
  assert.equal(r.saida, 'oito nove 14 13 8 2432902008176640000 4\n')
})

test('static, globais, enum, sizeof, unsigned, char e %g', async () => {
  const r = await rodar(`#include <stdio.h>
enum Cor { VERMELHO, VERDE = 5, AZUL };
int contador(void) { static int c = 0; return ++c; }
int total = 100;
int main(void) {
  contador(); contador();
  unsigned int u = 0; u--;
  char c = 'A' + 2;
  float f = 1.0f / 3;
  printf("%d %d %d %u %c %zu %zu %.3f %g %g\\n", contador(), AZUL, total + VERDE, u, c, sizeof(int), sizeof(double), f, 0.0001, 123456789.0);
  return 0;
}`)
  assert.equal(r.saida, '3 6 105 4294967295 C 4 8 0.333 0.0001 1.23457e+08\n')
})

test('qsort com comparador e ponteiro de função', async () => {
  const r = await rodar(`#include <stdio.h>
#include <stdlib.h>
int cmp(const void *a, const void *b) { return *(const int *)a - *(const int *)b; }
int dobro(int x) { return 2 * x; }
int main(void) {
  int v[5] = {4, 1, 5, 2, 3};
  qsort(v, 5, sizeof(int), cmp);
  int (*f)(int) = dobro;
  for (int i = 0; i < 5; i++) printf("%d ", f(v[i]));
  printf("\\n");
  return 0;
}`)
  assert.equal(r.saida, '2 4 6 8 10 \n')
})

test('erros que o passo a passo aponta (com a linha)', async () => {
  const casos = [
    ['int main(void) {\n  int v[3];\n  v[3] = 1;\n  return 0;\n}', 3, /índice 3 fora dos limites do vetor v \(ele tem 3 elementos/],
    ['#include <stddef.h>\nint main(void) {\n  int *p = NULL;\n  *p = 1;\n  return 0;\n}', 4, /NULL/],
    ['#include <stdlib.h>\nint main(void) {\n  int *p = malloc(4);\n  free(p);\n  *p = 1;\n  return 0;\n}', 5, /liberada com free/],
    ['#include <stdlib.h>\nint main(void) {\n  int *p = malloc(4);\n  free(p);\n  free(p);\n  return 0;\n}', 5, /duas vezes/],
    ['int main(void) {\n  int a = 1, b = 0;\n  return a / b;\n}', 3, /divisão inteira por zero/],
    ['int f(int n) { return f(n + 1); }\nint main(void) {\n  return f(0);\n}', 1, /recursão/],
    ['#include <stdlib.h>\nint main(void) {\n  int *v = malloc(3 * sizeof(int));\n  v[3] = 7;\n  return 0;\n}', 4, /além do fim de/],
  ]
  for (const [fonte, linha, padrao] of casos) {
    const r = await rodar(fonte)
    assert.equal(r.status, 'erro', fonte)
    assert.match(r.erro.mensagem, padrao, fonte)
    assert.equal(r.erro.linha, linha, `${fonte}\n→ ${r.erro.mensagem}`)
    assert.ok(r.erro.explicacao, fonte)
  }
})

test('passo a passo: linhas, pausa e memória com ponteiro desenhável', async () => {
  const fonte = `#include <stdlib.h>
int main(void) {
  int v[3] = {1, 2, 3};
  int *p = &v[1];
  int *h = malloc(2 * sizeof(int));
  h[0] = 9;
  return 0;
}`
  const ast = await astDe(fonte)
  const linhas = []
  await new Promise((resolve) => {
    let maq
    const s = new SessaoC(ast, fonte, {
      modo: 'passo',
      onStep: ({ linha }) => linhas.push(linha),
      onMemory: (m) => { maq = m },
      onEnd: resolve,
    })
    const passo = () => {
      if (s.terminado) return
      if (linhas.at(-1) === 7) {
        const q = maq.instantaneo().quadros[0]
        const p = q.variaveis.find((v) => v.nome === 'p')
        const d = descrever(maq, p.endereco, p.tipo)
        assert.equal(d.forma, 'ponteiro')
        assert.equal(d.destino, 'v[1]')
        const h = q.variaveis.find((v) => v.nome === 'h')
        assert.equal(nomeDoEndereco(maq, descrever(maq, h.endereco, h.tipo).alvo), 'bloco #1[0]')
        const v = descrever(maq, q.variaveis[0].endereco, q.variaveis[0].tipo)
        assert.deepEqual(v.itens.map((i) => i.texto), ['1', '2', '3'])
        const heap = maq.instantaneo().heap
        assert.equal(heap.length, 1)
      }
      setImmediate(() => { s.passo(); passo() })
    }
    s.passo()
    passo()
  })
  assert.deepEqual(linhas, [2, 3, 4, 5, 6, 7])
})
