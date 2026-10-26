// Passo a passo do C++: classes, string, vector, cout/cin, referências, herança e virtual.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rodarCpp } from './ajudante.mjs'

// Terminou bem e sem sobrar nada no heap: se sobrar, algum destrutor ou temporário está errado.
const ok = (r) => {
  assert.equal(r.status, 'terminado', `${r.erro?.mensagem}\n${r.erro?.interno?.stack ?? ''}`)
  const sobra = r.sessao.maq.mem.heap
  assert.equal(sobra.length, 0, `vazou: ${sobra.map((b) => `bloco #${b.numero} (${b.tamanho} bytes)`).join(', ')}`)
}

test('cout, cin, string e vector', async () => {
  const r = await rodarCpp(`#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main() {
    string nome;
    int n;
    cout << "Nome: ";
    cin >> nome >> n;
    vector<int> v;
    for (int i = 1; i <= n; i++) v.push_back(i * i);
    int soma = 0;
    for (int x : v) soma += x;
    string msg = "Oi, " + nome + "!";
    msg += " Soma=";
    cout << msg << soma << " tamanho=" << v.size() << " ultimo=" << v.back() << endl;
    return 0;
}`, ['Bia 4'])
  ok(r)
  assert.equal(r.saida, 'Nome: Oi, Bia! Soma=30 tamanho=4 ultimo=16\n')
})

test('classe com construtor, métodos, const e referência', async () => {
  const r = await rodarCpp(`#include <iostream>
#include <string>
using namespace std;
class Conta {
    string dono;
    double saldo;
public:
    Conta(string d, double s) : dono(d), saldo(s) {}
    void depositar(double v) { saldo += v; }
    bool sacar(double v);
    double getSaldo() const { return saldo; }
    string getDono() const { return dono; }
};
bool Conta::sacar(double v) {
    if (v > saldo) return false;
    saldo -= v;
    return true;
}
void dobra(int &x) { x *= 2; }
int main() {
    Conta c("Ana", 100);
    c.depositar(50);
    bool ok = c.sacar(500);
    c.sacar(30);
    int k = 21;
    dobra(k);
    int &r = k;
    r++;
    cout << c.getDono() << " " << c.getSaldo() << " " << ok << " " << k << endl;
    return 0;
}`)
  ok(r)
  assert.equal(r.saida, 'Ana 120 0 43\n')
})

test('herança, virtual, new/delete e destrutores', async () => {
  const r = await rodarCpp(`#include <iostream>
#include <string>
using namespace std;
class Animal {
protected:
    string nome;
public:
    Animal(string n) : nome(n) { cout << "+" << nome << " "; }
    virtual ~Animal() { cout << "-" << nome << " "; }
    virtual string som() const { return "..."; }
    void falar() const { cout << nome << ":" << som() << " "; }
};
class Cao : public Animal {
public:
    Cao(string n) : Animal(n) {}
    string som() const override { return "au"; }
};
int main() {
    Animal *a = new Cao("Rex");
    a->falar();
    delete a;
    {
        Cao b("Bob");
        b.falar();
    }
    cout << "fim" << endl;
    return 0;
}`)
  ok(r)
  assert.equal(r.saida, '+Rex Rex:au -Rex +Bob Bob:au -Bob fim\n')
})

test('vector de string, sort, swap, max e setprecision', async () => {
  const r = await rodarCpp(`#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
bool maior(int a, int b) { return a > b; }
int main() {
    vector<string> nomes = {"Caio", "Ana", "Bia"};
    sort(nomes.begin(), nomes.end());
    vector<int> v = {4, 9, 1, 7};
    sort(v.begin(), v.end(), maior);
    int a = 3, b = 8;
    swap(a, b);
    for (const string &s : nomes) cout << s << ",";
    for (int x : v) cout << x << " ";
    cout << a << b << max(a, b) << " " << fixed << setprecision(2) << 10.0 / 3 << endl;
    return 0;
}`)
  ok(r)
  assert.equal(r.saida, 'Ana,Bia,Caio,9 7 4 1 838 3.33\n')
})

test('getline e while (cin >> x)', async () => {
  const r = await rodarCpp(`#include <iostream>
#include <string>
using namespace std;
int main() {
    string linha;
    getline(cin, linha);
    int x, soma = 0;
    while (cin >> x) soma += x;
    cout << "[" << linha << "] " << soma << endl;
    return 0;
}`, ['bom dia, mundo', '1 2', '3', null]) // null = fim da entrada (Esc no console)
  ok(r)
  assert.equal(r.saida, '[bom dia, mundo] 6\n')
})

test('try/catch: throw de classe e de valor, catch pela base, destrutores no caminho, throw; e at()', async () => {
  const r = await rodarCpp(`#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;
struct Recurso {
    string nome;
    Recurso(string n) : nome(n) {}
    ~Recurso() { cout << "~" << nome << " "; }
};
double dividir(int a, int b) {
    Recurso r("div");
    if (b == 0) throw runtime_error("divisão por zero");
    return (double)a / b;
}
void relanca() {
    try { throw 42; } catch (int x) { cout << "int " << x << " "; throw; }
}
int main() {
    try {
        cout << dividir(6, 3) << " ";
        cout << dividir(1, 0) << " ";
    } catch (const exception &e) {
        cout << "pegou: " << e.what() << " ";
    }
    try { relanca(); } catch (...) { cout << "de novo "; }
    vector<int> v(2);
    try { v.at(5) = 1; } catch (const out_of_range &e) { cout << "fora "; }
    cout << "fim" << endl;
    return 0;
}`)
  ok(r)
  assert.equal(r.saida, '~div 2 ~div pegou: divisão por zero int 42 de novo fora fim\n')
})

test('exceção não tratada vira erro com o what() e a linha do throw', async () => {
  const r = await rodarCpp(`#include <stdexcept>
int main() {
    int x = 1;
    if (x) throw std::invalid_argument("x inválido");
    return 0;
}`)
  assert.equal(r.status, 'erro')
  assert.match(r.erro.mensagem, /exceção não tratada: x inválido/)
  assert.equal(r.erro.linha, 4)
})

test('erros do C++ no passo a passo', async () => {
  const r = await rodarCpp(`#include <vector>
int main() {
    std::vector<int> v(3);
    v[3] = 1;
    return 0;
}`)
  assert.equal(r.status, 'erro')
  assert.match(r.erro.mensagem, /índice 3 fora do vector \(ele tem 3 elementos/)
  assert.equal(r.erro.linha, 4)
})

test('membros static de mesmo nome em classes diferentes são variáveis diferentes', async () => {
  const r = await rodarCpp(`#include <iostream>
using namespace std;
struct A { static int n; static const int primeiro = 1; };
struct B { static int n; static const int primeiro = 2; };
int A::n = 10;
int B::n = 20;
extern int g;
int g = 5;
int main() { A::n++; cout << A::n << " " << B::n << " " << A::primeiro << B::primeiro << " " << g << endl; }`)
  ok(r)
  assert.equal(r.saida, '11 20 12 5\n')
})
