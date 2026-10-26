// A STL do passo a passo (cabecalhos-stl.js): lambdas, contêineres, o que aparece na
// tela de memória, o passo a passo dentro de uma lambda e os cabeçalhos sob medida.
// (A saída dos programas é conferida com o g++ em diferencial/corpus-stl*.cpp.txt.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { astDe, rodarCpp } from './ajudante.mjs'
import { SessaoC, descrever, nomeAmigavel } from '../src/index.js'
import { cabecalhosCppPara } from '../src/cabecalhos-cpp.js'
import { itensDoCabecalho } from '../src/sob-medida.js'

const ok = (r) => {
  assert.equal(r.status, 'terminado', `${r.erro?.mensagem}\n${r.erro?.interno?.stack ?? ''}`)
  const sobra = r.sessao.maq.mem.heap
  assert.equal(sobra.length, 0, `vazou: ${sobra.map((b) => `bloco #${b.numero} (${b.tamanho} bytes)`).join(', ')}`)
}

test('contêineres devolvem toda a memória do heap (destrutores, cópias e apagar no meio)', async () => {
  const r = await rodarCpp(`#include <bits/stdc++.h>
using namespace std;
struct No { string nome; vector<int> v; };
int main() {
    map<string, vector<int>> m;
    m["a"].push_back(1);
    m["b"] = {2, 3};
    auto copia = m;
    copia.erase("a");
    set<string> s = {"x", "y", "z"};
    s.erase(s.find("y"));
    unordered_map<string, int> u;
    for (int i = 0; i < 30; i++) u[to_string(i)] = i;
    u.erase("7");
    list<No> l;
    l.push_back({"um", {1}});
    l.push_front({"zero", {}});
    l.pop_back();
    deque<string> d(3, "abc");
    d.push_front("x");
    priority_queue<pair<int, string>> pq;
    pq.push({1, "a"});
    pq.push({2, "b"});
    pq.pop();
    shared_ptr<No> p = make_shared<No>();
    shared_ptr<No> q = p;
    unique_ptr<int[]> arr(new int[5]);
    function<int(int)> f = [s](int x) { return x + (int)s.size(); };
    vector<function<int(int)>> fs = {f, f};
    cout << m.size() << copia.size() << s.size() << u.size() << l.size() << d.size() << pq.size() << p.use_count() << fs[1](1) << endl;
    return 0;
}`)
  ok(r)
  assert.equal(r.saida, '2122914123\n')
})

test('a tela de memória mostra o conteúdo dos contêineres e nomes que o aluno entende', async () => {
  const fonte = `#include <map>
#include <vector>
#include <string>
#include <list>
using namespace std;
int main() {
    map<string, int> m = {{"ana", 3}, {"bia", 1}};
    vector<pair<int, char>> v = {{1, 'x'}};
    list<int> l = {7, 8};
    auto f = [&m](int x) { return x + (int)m.size(); };
    return f(0);
}`
  const ast = await astDe(fonte, true)
  const visto = await new Promise((resolve) => {
    const s = new SessaoC(ast, fonte, {
      cpp: true, semAtrasos: true, fatias: false, breakpoints: [11],
      onMemory: (maq) => {
        if (s.estado !== 'pausado') return
        const vars = Object.fromEntries(maq.pilha[0].variaveis.map((v) => [v.nome, { d: descrever(maq, v.endereco, v.tipo), t: nomeAmigavel(v.tipoTexto) }]))
        resolve(vars)
        s.parar()
      },
      onEnd: () => resolve(null),
    })
    s.continuar()
  })
  assert.equal(visto.m.d.texto, '{"ana": 3, "bia": 1}')
  assert.equal(visto.v.d.texto, '[(1, x)]')
  assert.equal(visto.l.d.texto, '[7, 8]')
  assert.equal(visto.f.t, 'lambda da linha 10')
  assert.equal(nomeAmigavel('__no_arvore<pair<const string,int>>'), 'nó<pair<const string,int>>')
})

test('o passo a passo para nas linhas da lambda do aluno, e nunca dentro da biblioteca', async () => {
  const fonte = `#include <vector>
#include <algorithm>
using namespace std;
int main() {
    vector<int> v = {3, 1, 2};
    sort(v.begin(), v.end(), [](int a, int b) {
        return a > b;
    });
    return v[0];
}`
  const ast = await astDe(fonte, true)
  const linhas = await new Promise((resolve) => {
    const vistas = []
    const s = new SessaoC(ast, fonte, {
      cpp: true, modo: 'passo', semAtrasos: true, fatias: false,
      onStep: ({ linha }) => { vistas.push(linha); queueMicrotask(() => s.passo()) },
      onEnd: (status, erro, codigo) => resolve({ vistas, status, codigo }),
    })
    s.continuar()
  })
  assert.equal(linhas.status, 'terminado')
  assert.equal(linhas.codigo, 3)
  assert.ok(linhas.vistas.includes(7), 'parou no corpo da lambda')
  assert.ok(linhas.vistas.every((l) => l >= 1 && l <= 10), `linhas: ${linhas.vistas.join(',')}`)
})

test('exceção da biblioteca dentro de try com um temporário na expressão', async () => {
  const r = await rodarCpp(`#include <iostream>
#include <string>
#include <stdexcept>
using namespace std;
int main() {
    try {
        int n = stoi(string("abc") + "!");
        cout << n;
    } catch (const invalid_argument &e) {
        cout << "nao e numero" << endl;
    }
    return 0;
}`)
  ok(r)
  assert.equal(r.saida, 'nao e numero\n')
})

test('cabeçalhos sob medida: só o que o programa usa, e o resto continua compilando', () => {
  const h = cabecalhosCppPara('#include <algorithm>\nint main() { int v[3]; std::sort(v, v + 3); }\n')
  const nomes = itensDoCabecalho(h.algorithm).map((i) => i.nome)
  assert.ok(nomes.includes('sort') && nomes.includes('__ordenar_js'))
  assert.ok(!nomes.includes('next_permutation') && !nomes.includes('lower_bound'))
  // o <bits/stdc++.h> só traz os contêineres que aparecem no programa
  const bits = cabecalhosCppPara('#include <bits/stdc++.h>\nint main() { std::map<int, int> m; }\n').bits['stdc++.h']
  assert.match(bits, /#include <map>/)
  assert.doesNotMatch(bits, /#include <(unordered_map|list|deque|tuple)>/)
  // v.begin() não puxa o begin() livre (marcado com @se!); begin(v) puxa
  assert.doesNotMatch(cabecalhosCppPara('#include <vector>\nint main() { std::vector<int> v; v.begin(); }\n').__base, /auto begin\(C &c\)/)
  assert.match(cabecalhosCppPara('#include <vector>\nint main() { std::vector<int> v; begin(v); }\n').__base, /auto begin\(C &c\)/)
})

test('set com lambda ou ponteiro de função como comparador (o operator= da lambda usa o this normal)', async () => {
  const r = await rodarCpp(`#include <set>
#include <iostream>
using namespace std;
bool maior(int a, int b) { return a > b; }
int main() {
    auto cmp = [](int a, int b) { return a % 7 < b % 7; };
    set<int, decltype(cmp)> s(cmp);
    for (int i = 0; i < 20; i++) s.insert(i);
    set<int, bool (*)(int, int)> p(maior);
    for (int i : {5, 1, 9}) p.insert(i);
    for (int x : s) cout << x;
    cout << ' ';
    for (int x : p) cout << x;
    cout << endl;
}`)
  ok(r)
  assert.equal(r.saida, '0123456 951\n')
})

test('inserir num set desce a árvore uma vez só (o comparador do aluno não roda em dobro)', async () => {
  const r = await rodarCpp(`#include <set>
#include <iostream>
using namespace std;
int chamadas = 0;
struct Conta { bool operator()(int a, int b) const { chamadas++; return a < b; } };
int main() {
    set<int, Conta> s;
    for (int i = 0; i < 64; i++) s.insert(i);
    int antes = chamadas;
    s.insert(10);
    cout << (chamadas - antes <= 8) << ' ' << s.size() << endl;
}`)
  ok(r)
  assert.equal(r.saida, '1 64\n')
})
