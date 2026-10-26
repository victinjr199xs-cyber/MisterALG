// A biblioteca padrão do C++ para o passo a passo, escrita em C++ de verdade. O passo a
// passo executa este código como executa o do aluno (só não pausa nas linhas daqui), e
// assim um map aparece na tela de memória como a árvore que ele é, com os nós no heap;
// uma list, como os nós ligados; um shared_ptr, com o contador de referências.
//
// É um C++ simples de propósito (sem type_traits nem SFINAE elaborado): o que importa
// é dar a mesma saída do g++. Por isso sort, as funções de heap (priority_queue) e o
// unordered_map seguem os algoritmos da libstdc++ — mesmo empate, mesma ordem.
// Nenhum contêiner guarda ponteiro para si mesmo: o vector pode mudá-los de lugar.

// Ponto de partida comum: comparadores, swap, move e reverse_iterator.
const BASE = String.raw`#pragma once
#include <stddef.h>
#include <initializer_list>
inline void *operator new(size_t, void *p) noexcept { return p; }
namespace std {
typedef int ptrdiff_t;
// O vector é feito em JavaScript e copia os elementos com o construtor de cópia deles; mas o clang só escreve o
// corpo de um construtor de um template se alguém o usa. O ~vector "usa" a cópia e (quando existe) o construtor
// padrão num if (false): nada roda, mas os corpos passam a existir.
template <class T> auto __exigir_padrao(T *p, int) -> decltype(new (p) T(), void()) { new (p) T(); }
template <class T> void __exigir_padrao(T *, long) {}
template <class T> T &move(T &x) { return x; }
template <class T> T &forward(T &x) { return x; }
template <class T> void swap(T &a, T &b) { T t = a; a = b; b = t; }
template <class T, size_t N> void swap(T (&a)[N], T (&b)[N]) { for (size_t i = 0; i < N; i++) swap(a[i], b[i]); }
template <class I> void iter_swap(I a, I b) { swap(*a, *b); }
template <class T = void> struct less { bool operator()(const T &a, const T &b) const { return a < b; } };
template <class T = void> struct greater { bool operator()(const T &a, const T &b) const { return a > b; } };
template <class T = void> struct less_equal { bool operator()(const T &a, const T &b) const { return a <= b; } };
template <class T = void> struct greater_equal { bool operator()(const T &a, const T &b) const { return a >= b; } };
template <class T = void> struct equal_to { bool operator()(const T &a, const T &b) const { return a == b; } };
template <class T = void> struct not_equal_to { bool operator()(const T &a, const T &b) const { return a != b; } };
template <class T = void> struct plus { T operator()(const T &a, const T &b) const { return a + b; } };
template <class T = void> struct minus { T operator()(const T &a, const T &b) const { return a - b; } };
template <class T = void> struct multiplies { T operator()(const T &a, const T &b) const { return a * b; } };
template <class T = void> struct divides { T operator()(const T &a, const T &b) const { return a / b; } };
template <class T = void> struct modulus { T operator()(const T &a, const T &b) const { return a % b; } };
template <> struct less<void> { template <class A, class B> bool operator()(const A &a, const B &b) const { return a < b; } };
template <> struct greater<void> { template <class A, class B> bool operator()(const A &a, const B &b) const { return a > b; } };
template <> struct equal_to<void> { template <class A, class B> bool operator()(const A &a, const B &b) const { return a == b; } };
struct __igual { template <class A, class B> bool operator()(const A &a, const B &b) const { return a == b; } };
// a chave de um elemento: o first num map, o próprio elemento num set
struct __chave_do_par { enum { primeiro = 1 }; template <class P> static const auto &de(const P &p) { return p.first; } };
struct __chave_propria { enum { primeiro = 0 }; template <class X> static const X &de(const X &x) { return x; } };

template <class I> struct reverse_iterator {
  I __base;
  reverse_iterator() : __base() {}
  explicit reverse_iterator(I b) : __base(b) {}
  template <class J> reverse_iterator(const reverse_iterator<J> &o) : __base(o.__base) {}
  I base() const { return __base; }
  auto &operator*() const { I t = __base; --t; return *t; }
  auto operator->() const { I t = __base; --t; return &*t; }
  reverse_iterator &operator++() { --__base; return *this; }
  reverse_iterator operator++(int) { reverse_iterator t = *this; --__base; return t; }
  reverse_iterator &operator--() { ++__base; return *this; }
  reverse_iterator operator--(int) { reverse_iterator t = *this; ++__base; return t; }
  reverse_iterator operator+(long n) const { return reverse_iterator(__base - n); }
  reverse_iterator operator-(long n) const { return reverse_iterator(__base + n); }
  reverse_iterator &operator+=(long n) { __base -= n; return *this; }
  reverse_iterator &operator-=(long n) { __base += n; return *this; }
  auto &operator[](long n) const { return *(*this + n); }
};
template <class I> bool operator==(const reverse_iterator<I> &a, const reverse_iterator<I> &b) { return a.__base == b.__base; }
template <class I> bool operator!=(const reverse_iterator<I> &a, const reverse_iterator<I> &b) { return a.__base != b.__base; }
template <class I> bool operator<(const reverse_iterator<I> &a, const reverse_iterator<I> &b) { return b.__base < a.__base; }
template <class I> long operator-(const reverse_iterator<I> &a, const reverse_iterator<I> &b) { return b.__base - a.__base; }

template <class C> struct back_insert_iterator {
  C *__c;
  explicit back_insert_iterator(C &c) : __c(&c) {}
  template <class V> back_insert_iterator &operator=(const V &v) { __c->push_back(v); return *this; }
  back_insert_iterator &operator*() { return *this; }
  back_insert_iterator &operator++() { return *this; }
  back_insert_iterator &operator++(int) { return *this; }
};
template <class C> back_insert_iterator<C> back_inserter(C &c) { return back_insert_iterator<C>(c); }
template <class C> struct front_insert_iterator {
  C *__c;
  explicit front_insert_iterator(C &c) : __c(&c) {}
  template <class V> front_insert_iterator &operator=(const V &v) { __c->push_front(v); return *this; }
  front_insert_iterator &operator*() { return *this; }
  front_insert_iterator &operator++() { return *this; }
  front_insert_iterator &operator++(int) { return *this; }
};
template <class C> front_insert_iterator<C> front_inserter(C &c) { return front_insert_iterator<C>(c); }
template <class I> long distance(I a, I b) { long n = 0; for (; a != b; ++a) n++; return n; }
template <class T> long distance(T *a, T *b) { return b - a; }
template <class I> void advance(I &i, long n) { if (n > 0) for (; n > 0; n--) ++i; else for (; n < 0; n++) --i; }
template <class T> void advance(T *&i, long n) { i += n; }
template <class I> I next(I i, long n = 1) { advance(i, n); return i; }
template <class I> I prev(I i, long n = 1) { advance(i, -n); return i; }
// begin(v), end(v), size(v)... livres (o .begin() de dentro da biblioteca não precisa delas)
// @se! begin end rbegin rend size
template <class C> auto begin(C &c) { return c.begin(); }
template <class C> auto end(C &c) { return c.end(); }
template <class T, size_t N> T *begin(T (&v)[N]) { return v; }
template <class T, size_t N> T *end(T (&v)[N]) { return v + N; }
template <class C> auto rbegin(C &c) { return c.rbegin(); }
template <class C> auto rend(C &c) { return c.rend(); }
template <class C> auto size(const C &c) { return c.size(); }
template <class T, size_t N> size_t size(T (&)[N]) { return N; }
// @fim
}
`

const UTILITY = String.raw`#pragma once
#include <__base>
namespace std {
template <class A, class B> struct pair {
  A first;
  B second;
  pair() : first(), second() {}
  pair(const A &a, const B &b) : first(a), second(b) {}
  template <class C, class D> pair(const pair<C, D> &p) : first(p.first), second(p.second) {}
  template <class C, class D> pair &operator=(const pair<C, D> &p) { first = p.first; second = p.second; return *this; }
};
template <class A, class B> pair<A, B> make_pair(A a, B b) { return pair<A, B>(a, b); }
template <class A, class B> bool operator==(const pair<A, B> &x, const pair<A, B> &y) { return x.first == y.first && x.second == y.second; }
template <class A, class B> bool operator!=(const pair<A, B> &x, const pair<A, B> &y) { return !(x == y); }
template <class A, class B> bool operator<(const pair<A, B> &x, const pair<A, B> &y) { return x.first < y.first || (!(y.first < x.first) && x.second < y.second); }
template <class A, class B> bool operator>(const pair<A, B> &x, const pair<A, B> &y) { return y < x; }
template <class A, class B> bool operator<=(const pair<A, B> &x, const pair<A, B> &y) { return !(y < x); }
template <class A, class B> bool operator>=(const pair<A, B> &x, const pair<A, B> &y) { return !(x < y); }
}
`

const TUPLE = String.raw`#pragma once
#include <utility>
namespace std {
template <class... T> struct tuple;
template <> struct tuple<> {
  tuple() {}
  template <class... U> tuple(const tuple<U...> &) {}
};
template <class H, class... T> struct tuple<H, T...> : tuple<T...> {
  H __cabeca;
  tuple() : tuple<T...>(), __cabeca() {}
  tuple(const H &h, const T &...t) : tuple<T...>(t...), __cabeca(h) {}
  template <class... U> tuple(const tuple<U...> &o) : tuple<T...>(o.__resto()), __cabeca(o.__cabeca) {}
  template <class A, class B> tuple(const pair<A, B> &p) : tuple<T...>(p.second), __cabeca(p.first) {}
  tuple &operator=(const tuple &o) { __cabeca = o.__cabeca; __resto() = o.__resto(); return *this; }
  template <class... U> tuple &operator=(const tuple<U...> &o) { __cabeca = o.__cabeca; __resto() = o.__resto(); return *this; }
  template <class A, class B> tuple &operator=(const pair<A, B> &p) { __cabeca = p.first; __resto().__cabeca = p.second; return *this; }
  tuple<T...> &__resto() { return *this; }
  const tuple<T...> &__resto() const { return *this; }
};
template <class... T> tuple<T...> make_tuple(T... t) { return tuple<T...>(t...); }
template <class... T> tuple<T &...> tie(T &...t) { return tuple<T &...>(t...); }
template <size_t I, class H, class... T> auto &get(tuple<H, T...> &t) {
  if constexpr (I == 0) return t.__cabeca;
  else return get<I - 1>(t.__resto());
}
template <size_t I, class H, class... T> const auto &get(const tuple<H, T...> &t) {
  if constexpr (I == 0) return t.__cabeca;
  else return get<I - 1>(t.__resto());
}
template <size_t I, class A, class B> auto &get(pair<A, B> &p) {
  if constexpr (I == 0) return p.first;
  else return p.second;
}
struct __ignorar { template <class T> const __ignorar &operator=(const T &) const { return *this; } };
const __ignorar ignore;
template <class... T> bool operator==(const tuple<T...> &a, const tuple<T...> &b) { return __tupla_igual(a, b); }
inline bool __tupla_igual(const tuple<> &, const tuple<> &) { return true; }
template <class H, class... T> bool __tupla_igual(const tuple<H, T...> &a, const tuple<H, T...> &b) { return a.__cabeca == b.__cabeca && __tupla_igual(a.__resto(), b.__resto()); }
inline bool __tupla_menor(const tuple<> &, const tuple<> &) { return false; }
template <class H, class... T> bool __tupla_menor(const tuple<H, T...> &a, const tuple<H, T...> &b) {
  if (a.__cabeca < b.__cabeca) return true;
  if (b.__cabeca < a.__cabeca) return false;
  return __tupla_menor(a.__resto(), b.__resto());
}
template <class... T> bool operator<(const tuple<T...> &a, const tuple<T...> &b) { return __tupla_menor(a, b); }
template <class... T> bool operator>(const tuple<T...> &a, const tuple<T...> &b) { return __tupla_menor(b, a); }
template <class... T> bool operator!=(const tuple<T...> &a, const tuple<T...> &b) { return !(a == b); }
}
`

const FUNCTIONAL = String.raw`#pragma once
#include <__base>
namespace std {
// function: guarda qualquer coisa que se chama (função, lambda, objeto) num objeto do heap.
template <class S> struct __invocavel;
template <class R, class... A> struct __invocavel<R(A...)> {
  virtual ~__invocavel() {}
  virtual R chamar(A... a) = 0;
  virtual __invocavel *copiar() const = 0;
};
template <class F, class S> struct __guardado;
template <class F, class R, class... A> struct __guardado<F, R(A...)> : __invocavel<R(A...)> {
  F f;
  __guardado(const F &g) : f(g) {}
  R chamar(A... a) override { return f(a...); }
  __invocavel<R(A...)> *copiar() const override { return new __guardado(f); }
};
template <class S> class function;
template <class R, class... A> class function<R(A...)> {
public:
  __invocavel<R(A...)> *__alvo;
  function() : __alvo(nullptr) {}
  function(decltype(nullptr)) : __alvo(nullptr) {}
  template <class F> function(F f) : __alvo(new __guardado<F, R(A...)>(f)) {}
  function(const function &o) : __alvo(o.__alvo ? o.__alvo->copiar() : nullptr) {}
  ~function() { delete __alvo; }
  function &operator=(const function &o) {
    if (this != &o) {
      __invocavel<R(A...)> *velho = __alvo;
      __alvo = o.__alvo ? o.__alvo->copiar() : nullptr;
      delete velho;
    }
    return *this;
  }
  template <class F> function &operator=(F f) { function g(f); *this = g; return *this; }
  R operator()(A... a) const {
    if (!__alvo) throw __chamada_vazia();
    return __alvo->chamar(a...);
  }
  explicit operator bool() const { return __alvo != nullptr; }
  struct __chamada_vazia {};
};
template <class R, class... A> bool operator==(const function<R(A...)> &f, decltype(nullptr)) { return !f; }
template <class R, class... A> bool operator!=(const function<R(A...)> &f, decltype(nullptr)) { return !!f; }
template <class T> struct hash;
}
`

// A árvore AVL por trás de map, set, multimap e multiset (a libstdc++ usa uma rubro-negra:
// a ordem dos elementos é a mesma, só o formato da árvore muda).
const ARVORE = String.raw`#pragma once
#include <utility>
#include <stdexcept>
namespace std {
template <class V> struct __no_arvore {
  V valor;
  __no_arvore *esq;
  __no_arvore *dir;
  __no_arvore *pai;
  int altura;
  __no_arvore(const V &v) : valor(v), esq(nullptr), dir(nullptr), pai(nullptr), altura(1) {}
};
// Andar, procurar, ligar e desligar os nós (com o rebalanceamento) é feito em JavaScript (biblioteca-cpp.js):
// o JSON da árvore do clang fica bem menor, e o passo a passo, mais rápido. Os nós (new, cópia, delete) ficam aqui.
template <class V> __no_arvore<V> *__minimo_js(__no_arvore<V> *n) { return n; }
template <class V> __no_arvore<V> *__maximo_js(__no_arvore<V> *n) { return n; }
template <class V> __no_arvore<V> *__seguinte_js(__no_arvore<V> *n) { return n; }
template <class V> __no_arvore<V> *__antecessor_js(__no_arvore<V> *n) { return n; }
// primeiro: a chave é o first do valor (map); superior: upper_bound em vez de lower_bound
template <class V, class K, class C> __no_arvore<V> *__limite_js(__no_arvore<V> *raiz, const K &k, const C &comp, int primeiro, int superior) { return raiz; }
template <class V, class C> void __ligar_js(__no_arvore<V> **raiz, __no_arvore<V> *novo, const C &comp, int primeiro) {}
template <class V> void __desligar_js(__no_arvore<V> **raiz, __no_arvore<V> *no) {}
template <class V> struct __it_arvore {
  __no_arvore<V> *__no;
  __no_arvore<V> *const *__raiz;
  __it_arvore() : __no(nullptr), __raiz(nullptr) {}
  __it_arvore(__no_arvore<V> *n, __no_arvore<V> *const *r) : __no(n), __raiz(r) {}
  V &operator*() const { return __no->valor; }
  V *operator->() const { return &__no->valor; }
  __it_arvore &operator++() { __no = __seguinte_js(__no); return *this; }
  __it_arvore operator++(int) { __it_arvore t = *this; __no = __seguinte_js(__no); return t; }
  __it_arvore &operator--() { __no = __no ? __antecessor_js(__no) : __maximo_js(*__raiz); return *this; }
  __it_arvore operator--(int) { __it_arvore t = *this; --*this; return t; }
};
template <class V> bool operator==(const __it_arvore<V> &a, const __it_arvore<V> &b) { return a.__no == b.__no; }
template <class V> bool operator!=(const __it_arvore<V> &a, const __it_arvore<V> &b) { return a.__no != b.__no; }


template <class K, class V, class Chave, class C, bool MULTI> class __arvore {
public:
  __no_arvore<V> *__raiz;
  size_t __tamanho;
  C __comp;
  __arvore() : __raiz(nullptr), __tamanho(0), __comp() {}
  __arvore(const __arvore &o) : __raiz(__copiar(o.__raiz, nullptr)), __tamanho(o.__tamanho), __comp(o.__comp) {}
  ~__arvore() { __liberar(__raiz); }
  __arvore &operator=(const __arvore &o) {
    if (this != &o) {
      __liberar(__raiz);
      __raiz = __copiar(o.__raiz, nullptr);
      __tamanho = o.__tamanho;
    }
    return *this;
  }
  static __no_arvore<V> *__copiar(__no_arvore<V> *n, __no_arvore<V> *pai) {
    if (!n) return nullptr;
    __no_arvore<V> *c = new __no_arvore<V>(n->valor);
    c->altura = n->altura;
    c->pai = pai;
    c->esq = __copiar(n->esq, c);
    c->dir = __copiar(n->dir, c);
    return c;
  }
  static void __liberar(__no_arvore<V> *n) {
    if (!n) return;
    __liberar(n->esq);
    __liberar(n->dir);
    delete n;
  }
  size_t size() const { return __tamanho; }
  bool empty() const { return __tamanho == 0; }
  void clear() { __liberar(__raiz); __raiz = nullptr; __tamanho = 0; }
  __it_arvore<V> begin() const { return __it_arvore<V>(__minimo_js(__raiz), &__raiz); }
  __it_arvore<V> end() const { return __it_arvore<V>(nullptr, &__raiz); }
  reverse_iterator<__it_arvore<V>> rbegin() const { return reverse_iterator<__it_arvore<V>>(end()); } // @se rbegin rend
  reverse_iterator<__it_arvore<V>> rend() const { return reverse_iterator<__it_arvore<V>>(begin()); } // @se rbegin rend
  pair<__it_arvore<V>, bool> __inserir(const V &v) {
    if (false) __comp(Chave::de(v), Chave::de(v));
    if (!MULTI) {
      __no_arvore<V> *ja = __achar(Chave::de(v));
      if (ja) return pair<__it_arvore<V>, bool>(__it_arvore<V>(ja, &__raiz), false);
    }
    __no_arvore<V> *novo = new __no_arvore<V>(v);
    __ligar_js(&__raiz, novo, __comp, Chave::primeiro);
    __tamanho++;
    return pair<__it_arvore<V>, bool>(__it_arvore<V>(novo, &__raiz), true);
  }
  __no_arvore<V> *__limite_inferior(const K &k) const { if (false) __comp(k, k); return __limite_js(__raiz, k, __comp, Chave::primeiro, 0); }
  __no_arvore<V> *__limite_superior(const K &k) const { if (false) __comp(k, k); return __limite_js(__raiz, k, __comp, Chave::primeiro, 1); }
  __no_arvore<V> *__achar(const K &k) const {
    __no_arvore<V> *n = __limite_inferior(k);
    return n && !__comp(k, Chave::de(n->valor)) ? n : nullptr;
  }
  void __apagar_no(__no_arvore<V> *z) {
    __desligar_js(&__raiz, z);
    delete z;
    __tamanho--;
  }
  __it_arvore<V> find(const K &k) const { return __it_arvore<V>(__achar(k), &__raiz); }
  size_t count(const K &k) const {
    size_t n = 0;
    for (__no_arvore<V> *p = __limite_inferior(k); p && !__comp(k, Chave::de(p->valor)); p = __seguinte_js(p)) n++;
    return n;
  }
  bool contains(const K &k) const { return __achar(k) != nullptr; }
  __it_arvore<V> lower_bound(const K &k) const { return __it_arvore<V>(__limite_inferior(k), &__raiz); }
  __it_arvore<V> upper_bound(const K &k) const { return __it_arvore<V>(__limite_superior(k), &__raiz); }
  pair<__it_arvore<V>, __it_arvore<V>> equal_range(const K &k) const { return pair<__it_arvore<V>, __it_arvore<V>>(lower_bound(k), upper_bound(k)); }
  __it_arvore<V> erase(__it_arvore<V> it) {
    __no_arvore<V> *prox = __seguinte_js(it.__no);
    __apagar_no(it.__no);
    return __it_arvore<V>(prox, &__raiz);
  }
  __it_arvore<V> erase(__it_arvore<V> a, __it_arvore<V> b) {
    while (a != b) a = erase(a);
    return b;
  }
  size_t erase(const K &k) {
    size_t n = 0;
    for (__no_arvore<V> *p = __achar(k); p; p = __achar(k)) {
      __apagar_no(p);
      n++;
    }
    return n;
  }
};
}
`

const MAP = String.raw`#pragma once
#include <__arvore>
namespace std {
template <class K, class T, class C = less<K>> class map : public __arvore<K, pair<const K, T>, __chave_do_par, C, false> {
public:
  typedef __it_arvore<pair<const K, T>> iterator;
  typedef __it_arvore<pair<const K, T>> const_iterator;
  typedef ::std::reverse_iterator<__it_arvore<pair<const K, T>>> reverse_iterator; // @se rbegin rend reverse_iterator
  typedef ::std::reverse_iterator<__it_arvore<pair<const K, T>>> const_reverse_iterator; // @se rbegin rend reverse_iterator
  typedef pair<const K, T> value_type;
  typedef K key_type;
  typedef T mapped_type;
  map() {}
  explicit map(const C &c) { this->__comp = c; }
  map(initializer_list<pair<const K, T>> l) { for (const pair<const K, T> *p = l.begin(); p != l.end(); ++p) this->__inserir(*p); }
  template <class I> map(I a, I b) { for (; a != b; ++a) this->__inserir(*a); }
  T &operator[](const K &k) {
    __no_arvore<pair<const K, T>> *n = this->__achar(k);
    if (!n) n = this->__inserir(pair<const K, T>(k, T())).first.__no;
    return n->valor.second;
  }
  T &at(const K &k) const {
    __no_arvore<pair<const K, T>> *n = this->__achar(k);
    if (!n) throw out_of_range("map::at");
    return n->valor.second;
  }
  pair<__it_arvore<pair<const K, T>>, bool> insert(const pair<const K, T> &v) { return this->__inserir(v); }
  template <class I> void insert(I a, I b) { for (; a != b; ++a) this->__inserir(*a); }
  template <class... A> pair<__it_arvore<pair<const K, T>>, bool> emplace(const A &...a) { return this->__inserir(pair<const K, T>(a...)); }
  pair<__it_arvore<pair<const K, T>>, bool> insert_or_assign(const K &k, const T &v) {
    pair<__it_arvore<pair<const K, T>>, bool> r = this->__inserir(pair<const K, T>(k, v));
    if (!r.second) r.first.__no->valor.second = v;
    return r;
  }
};
template <class K, class T, class C = less<K>> class multimap : public __arvore<K, pair<const K, T>, __chave_do_par, C, true> {
public:
  typedef __it_arvore<pair<const K, T>> iterator;
  typedef __it_arvore<pair<const K, T>> const_iterator;
  typedef pair<const K, T> value_type;
  multimap() {}
  multimap(initializer_list<pair<const K, T>> l) { for (const pair<const K, T> *p = l.begin(); p != l.end(); ++p) this->__inserir(*p); }
  __it_arvore<pair<const K, T>> insert(const pair<const K, T> &v) { return this->__inserir(v).first; }
  template <class... A> __it_arvore<pair<const K, T>> emplace(const A &...a) { return this->__inserir(pair<const K, T>(a...)).first; }
};
template <class K, class T, class C> bool operator==(const map<K, T, C> &a, const map<K, T, C> &b) {
  if (a.size() != b.size()) return false;
  for (__it_arvore<pair<const K, T>> i = a.begin(), j = b.begin(); i != a.end(); ++i, ++j) if (!(*i == *j)) return false;
  return true;
}
}
`

const SET = String.raw`#pragma once
#include <__arvore>
namespace std {
template <class K, class C = less<K>> class set : public __arvore<K, K, __chave_propria, C, false> {
public:
  typedef __it_arvore<K> iterator;
  typedef __it_arvore<K> const_iterator;
  typedef ::std::reverse_iterator<__it_arvore<K>> reverse_iterator; // @se rbegin rend reverse_iterator
  typedef K value_type;
  typedef K key_type;
  set() {}
  explicit set(const C &c) { this->__comp = c; }
  set(initializer_list<K> l) { for (const K *p = l.begin(); p != l.end(); ++p) this->__inserir(*p); }
  template <class I> set(I a, I b) { for (; a != b; ++a) this->__inserir(*a); }
  pair<__it_arvore<K>, bool> insert(const K &v) { return this->__inserir(v); }
  template <class I> void insert(I a, I b) { for (; a != b; ++a) this->__inserir(*a); }
  pair<__it_arvore<K>, bool> emplace(const K &v) { return this->__inserir(v); }
};
template <class K, class C = less<K>> class multiset : public __arvore<K, K, __chave_propria, C, true> {
public:
  typedef __it_arvore<K> iterator;
  typedef __it_arvore<K> const_iterator;
  typedef K value_type;
  multiset() {}
  multiset(initializer_list<K> l) { for (const K *p = l.begin(); p != l.end(); ++p) this->__inserir(*p); }
  template <class I> multiset(I a, I b) { for (; a != b; ++a) this->__inserir(*a); }
  __it_arvore<K> insert(const K &v) { return this->__inserir(v).first; }
  __it_arvore<K> emplace(const K &v) { return this->__inserir(v).first; }
};
template <class K, class C> bool operator==(const set<K, C> &a, const set<K, C> &b) {
  if (a.size() != b.size()) return false;
  for (__it_arvore<K> i = a.begin(), j = b.begin(); i != a.end(); ++i, ++j) if (!(*i == *j)) return false;
  return true;
}
}
`

// unordered_*: a tabela de dispersão da libstdc++ (uma lista ligada só, com os baldes apontando para o nó
// de antes do primeiro de cada balde; tamanhos primos), para percorrer na mesma ordem do g++.
const HASH = String.raw`#pragma once
#include <utility>
#include <string>
#include <stdexcept>
namespace std {
// a função de dispersão de textos da libstdc++ (_Hash_bytes, MurmurHash2 de 64 bits) e a lista de primos dela
unsigned long long __hash_bytes(const void *p, size_t n);
unsigned long long __proximo_primo(unsigned long long n);
template <class T> struct hash {
  unsigned long long operator()(const T &v) const { return (unsigned long long)v; }
};
template <> struct hash<string> {
  unsigned long long operator()(const string &s) const { return __hash_bytes(s.c_str(), s.size()); }
};
template <> struct hash<double> {
  unsigned long long operator()(const double &d) const { return d == 0.0 ? 0 : __hash_bytes(&d, sizeof(double)); }
};
template <> struct hash<float> {
  unsigned long long operator()(const float &d) const { return d == 0.0f ? 0 : __hash_bytes(&d, sizeof(float)); }
};
template <class V> struct __no_hash {
  __no_hash *prox; // primeiro campo: o "nó de antes do primeiro" é o próprio campo __primeiro da tabela
  unsigned long long codigo;
  V valor;
  __no_hash(const V &v) : prox(nullptr), codigo(0), valor(v) {}
};
template <class V> struct __it_hash {
  __no_hash<V> *__no;
  __it_hash() : __no(nullptr) {}
  explicit __it_hash(__no_hash<V> *n) : __no(n) {}
  V &operator*() const { return __no->valor; }
  V *operator->() const { return &__no->valor; }
  __it_hash &operator++() { __no = __no->prox; return *this; }
  __it_hash operator++(int) { __it_hash t = *this; __no = __no->prox; return t; }
};
template <class V> bool operator==(const __it_hash<V> &a, const __it_hash<V> &b) { return a.__no == b.__no; }
template <class V> bool operator!=(const __it_hash<V> &a, const __it_hash<V> &b) { return a.__no != b.__no; }

// Procurar no balde, crescer (rehash), ligar e desligar os nós é feito em JavaScript (biblioteca-cpp.js), com as
// mesmas regras da libstdc++; os nós (new, delete) e a função de dispersão (__h) ficam aqui.
template <class T, class K, class E> void *__antes_de_js(const T *t, const K &k, unsigned long long codigo, const E &igual, int primeiro) { return nullptr; }
template <class T> void __crescer_js(T *t) {}
template <class T> void __reservar_js(T *t, unsigned long long n) {}
template <class T> void __limpar_baldes_js(T *t) {}
template <class T, class N> void __ligar_hash_js(T *t, N *no, N *antes) {}
template <class T, class N> void __desligar_hash_js(T *t, N *no) {}
template <class K, class V, class Chave, class H, bool MULTI> class __tabela {
public:
  __no_hash<V> **__baldes;   // cada balde aponta para o nó ANTES do primeiro dele (ou para __antes)
  unsigned long long __num_baldes;
  __no_hash<V> *__primeiro;  // a lista inteira; "__antes" é o endereço deste campo visto como nó
  size_t __tamanho;
  unsigned long long __proximo_aumento;
  H __h;
  __tabela() : __baldes(nullptr), __num_baldes(1), __primeiro(nullptr), __tamanho(0), __proximo_aumento(0), __h() {}
  __tabela(const __tabela &o) : __baldes(nullptr), __num_baldes(1), __primeiro(nullptr), __tamanho(0), __proximo_aumento(0), __h() { __copiar_de(o); }
  ~__tabela() { clear(); delete[] __baldes; }
  __tabela &operator=(const __tabela &o) {
    if (this != &o) { clear(); __copiar_de(o); }
    return *this;
  }
  void __copiar_de(const __tabela &o) {
    // insere na ordem inversa da lista dela: cada nó novo entra no começo do balde, e a ordem fica igual
    size_t n = o.__tamanho;
    if (!n) return;
    __no_hash<V> **nos = new __no_hash<V> *[n];
    size_t i = 0;
    for (__no_hash<V> *p = o.__primeiro; p; p = p->prox) nos[i++] = p;
    for (size_t j = n; j > 0; j--) __inserir(nos[j - 1]->valor);
    delete[] nos;
  }
  size_t size() const { return __tamanho; }
  bool empty() const { return __tamanho == 0; }
  size_t bucket_count() const { return (size_t)__num_baldes; }
  void clear() {
    __no_hash<V> *p = __primeiro;
    while (p) { __no_hash<V> *q = p->prox; delete p; p = q; }
    __primeiro = nullptr;
    __tamanho = 0;
    __limpar_baldes_js(this);
  }
  __it_hash<V> begin() const { return __it_hash<V>(__primeiro); }
  __it_hash<V> end() const { return __it_hash<V>(nullptr); }
  // o nó antes do primeiro igual a k no balde dele (ou nulo)
  __no_hash<V> *__antes_de(const K &k, unsigned long long codigo) const {
    equal_to<> igual;
    if (false) igual(k, k);
    return (__no_hash<V> *)__antes_de_js(this, k, codigo, igual, Chave::primeiro);
  }
  __no_hash<V> *__achar(const K &k) const {
    __no_hash<V> *antes = __antes_de(k, __h(k));
    return antes ? antes->prox : nullptr;
  }
  pair<__it_hash<V>, bool> __inserir(const V &v) {
    unsigned long long codigo = __h(Chave::de(v));
    if (!MULTI) {
      __no_hash<V> *ja = __antes_de(Chave::de(v), codigo);
      if (ja) return pair<__it_hash<V>, bool>(__it_hash<V>(ja->prox), false);
    }
    __crescer_js(this);
    __no_hash<V> *no = new __no_hash<V>(v);
    no->codigo = codigo;
    // multi: logo antes do primeiro igual, se houver (como na libstdc++)
    __ligar_hash_js(this, no, MULTI ? __antes_de(Chave::de(v), codigo) : (__no_hash<V> *)nullptr);
    __tamanho++;
    return pair<__it_hash<V>, bool>(__it_hash<V>(no), true);
  }
  void __apagar_no(__no_hash<V> *no) {
    __desligar_hash_js(this, no);
    delete no;
    __tamanho--;
  }
  __it_hash<V> find(const K &k) const { return __it_hash<V>(__achar(k)); }
  size_t count(const K &k) const {
    size_t n = 0;
    for (__no_hash<V> *p = __achar(k); p && Chave::de(p->valor) == k; p = p->prox) n++;
    return n;
  }
  bool contains(const K &k) const { return __achar(k) != nullptr; }
  size_t erase(const K &k) {
    size_t n = 0;
    for (__no_hash<V> *p = __achar(k); p; p = __achar(k)) { __apagar_no(p); n++; }
    return n;
  }
  __it_hash<V> erase(__it_hash<V> it) {
    __no_hash<V> *prox = it.__no->prox;
    __apagar_no(it.__no);
    return __it_hash<V>(prox);
  }
  void reserve(size_t n) { __reservar_js(this, n); }
};
}
`

const UNORDERED_MAP = String.raw`#pragma once
#include <__hash>
namespace std {
template <class K, class T, class H = hash<K>> class unordered_map : public __tabela<K, pair<const K, T>, __chave_do_par, H, false> {
public:
  typedef __it_hash<pair<const K, T>> iterator;
  typedef __it_hash<pair<const K, T>> const_iterator;
  typedef pair<const K, T> value_type;
  unordered_map() {}
  unordered_map(initializer_list<pair<const K, T>> l) { for (const pair<const K, T> *p = l.begin(); p != l.end(); ++p) this->__inserir(*p); }
  T &operator[](const K &k) {
    __no_hash<pair<const K, T>> *n = this->__achar(k);
    if (!n) n = this->__inserir(pair<const K, T>(k, T())).first.__no;
    return n->valor.second;
  }
  T &at(const K &k) const {
    __no_hash<pair<const K, T>> *n = this->__achar(k);
    if (!n) throw out_of_range("unordered_map::at");
    return n->valor.second;
  }
  pair<__it_hash<pair<const K, T>>, bool> insert(const pair<const K, T> &v) { return this->__inserir(v); }
  template <class... A> pair<__it_hash<pair<const K, T>>, bool> emplace(const A &...a) { return this->__inserir(pair<const K, T>(a...)); }
};
template <class K, class T, class H = hash<K>> class unordered_multimap : public __tabela<K, pair<const K, T>, __chave_do_par, H, true> {
public:
  typedef __it_hash<pair<const K, T>> iterator;
  __it_hash<pair<const K, T>> insert(const pair<const K, T> &v) { return this->__inserir(v).first; }
};
}
`

const UNORDERED_SET = String.raw`#pragma once
#include <__hash>
namespace std {
template <class K, class H = hash<K>> class unordered_set : public __tabela<K, K, __chave_propria, H, false> {
public:
  typedef __it_hash<K> iterator;
  typedef __it_hash<K> const_iterator;
  typedef K value_type;
  unordered_set() {}
  unordered_set(initializer_list<K> l) { for (const K *p = l.begin(); p != l.end(); ++p) this->__inserir(*p); }
  template <class I> unordered_set(I a, I b) { for (; a != b; ++a) this->__inserir(*a); }
  pair<__it_hash<K>, bool> insert(const K &v) { return this->__inserir(v); }
  pair<__it_hash<K>, bool> emplace(const K &v) { return this->__inserir(v); }
};
template <class K, class H = hash<K>> class unordered_multiset : public __tabela<K, K, __chave_propria, H, true> {
public:
  typedef __it_hash<K> iterator;
  unordered_multiset() {}
  unordered_multiset(initializer_list<K> l) { for (const K *p = l.begin(); p != l.end(); ++p) this->__inserir(*p); }
  __it_hash<K> insert(const K &v) { return this->__inserir(v).first; }
};
}
`

const LIST = String.raw`#pragma once
#include <__base>
namespace std {
struct __elo_lista {
  __elo_lista *prox;
  __elo_lista *ant;
};
template <class T> struct __no_lista : __elo_lista {
  T valor;
  __no_lista(const T &v) : valor(v) {}
};
template <class T> struct __it_lista {
  __elo_lista *__no;
  __it_lista() : __no(nullptr) {}
  explicit __it_lista(__elo_lista *n) : __no(n) {}
  T &operator*() const { return static_cast<__no_lista<T> *>(__no)->valor; }
  T *operator->() const { return &static_cast<__no_lista<T> *>(__no)->valor; }
  __it_lista &operator++() { __no = __no->prox; return *this; }
  __it_lista operator++(int) { __it_lista t = *this; __no = __no->prox; return t; }
  __it_lista &operator--() { __no = __no->ant; return *this; }
  __it_lista operator--(int) { __it_lista t = *this; __no = __no->ant; return t; }
};
template <class T> bool operator==(const __it_lista<T> &a, const __it_lista<T> &b) { return a.__no == b.__no; }
template <class T> bool operator!=(const __it_lista<T> &a, const __it_lista<T> &b) { return a.__no != b.__no; }

// Lista duplamente ligada com um nó sentinela (no heap: a list pode mudar de lugar dentro de um vector).
template <class T> class list {
public:
  __elo_lista *__sentinela;
  size_t __tamanho;
  typedef __it_lista<T> iterator;
  typedef __it_lista<T> const_iterator;
  typedef ::std::reverse_iterator<__it_lista<T>> reverse_iterator; // @se rbegin rend reverse_iterator
  typedef T value_type;
  list() : __sentinela(__nova_sentinela()), __tamanho(0) {}
  list(size_t n, const T &v = T()) : __sentinela(__nova_sentinela()), __tamanho(0) { for (size_t i = 0; i < n; i++) push_back(v); }
  list(initializer_list<T> l) : __sentinela(__nova_sentinela()), __tamanho(0) { for (const T *p = l.begin(); p != l.end(); ++p) push_back(*p); }
  list(const list &o) : __sentinela(__nova_sentinela()), __tamanho(0) { for (__it_lista<T> i = o.begin(); i != o.end(); ++i) push_back(*i); }
  ~list() { clear(); delete __sentinela; }
  list &operator=(const list &o) {
    if (this != &o) { clear(); for (__it_lista<T> i = o.begin(); i != o.end(); ++i) push_back(*i); }
    return *this;
  }
  static __elo_lista *__nova_sentinela() {
    __elo_lista *s = new __elo_lista;
    s->prox = s;
    s->ant = s;
    return s;
  }
  __it_lista<T> begin() const { return __it_lista<T>(__sentinela->prox); }
  __it_lista<T> end() const { return __it_lista<T>(__sentinela); }
  reverse_iterator rbegin() const { return reverse_iterator(end()); } // @se rbegin rend
  reverse_iterator rend() const { return reverse_iterator(begin()); } // @se rbegin rend
  size_t size() const { return __tamanho; }
  bool empty() const { return __tamanho == 0; }
  T &front() const { return static_cast<__no_lista<T> *>(__sentinela->prox)->valor; }
  T &back() const { return static_cast<__no_lista<T> *>(__sentinela->ant)->valor; }
  __it_lista<T> insert(__it_lista<T> pos, const T &v) {
    __no_lista<T> *n = new __no_lista<T>(v);
    __elo_lista *depois = pos.__no;
    n->prox = depois;
    n->ant = depois->ant;
    depois->ant->prox = n;
    depois->ant = n;
    __tamanho++;
    return __it_lista<T>(n);
  }
  __it_lista<T> erase(__it_lista<T> pos) {
    __elo_lista *n = pos.__no;
    __elo_lista *prox = n->prox;
    n->ant->prox = prox;
    prox->ant = n->ant;
    delete static_cast<__no_lista<T> *>(n);
    __tamanho--;
    return __it_lista<T>(prox);
  }
  __it_lista<T> erase(__it_lista<T> a, __it_lista<T> b) { while (a != b) a = erase(a); return b; }
  void push_back(const T &v) { insert(end(), v); }
  void push_front(const T &v) { insert(begin(), v); }
  template <class... A> void emplace_back(const A &...a) { insert(end(), T(a...)); }
  template <class... A> void emplace_front(const A &...a) { insert(begin(), T(a...)); }
  void pop_back() { erase(__it_lista<T>(__sentinela->ant)); }
  void pop_front() { erase(begin()); }
  void clear() { while (__tamanho) pop_front(); }
  void remove(const T &v) {
    for (__it_lista<T> i = begin(); i != end();) {
      if (*i == v) i = erase(i);
      else ++i;
    }
  }
  template <class P> void remove_if(P p) {
    for (__it_lista<T> i = begin(); i != end();) {
      if (p(*i)) i = erase(i);
      else ++i;
    }
  }
  void reverse() {
    __elo_lista *n = __sentinela;
    do {
      __elo_lista *t = n->prox;
      n->prox = n->ant;
      n->ant = t;
      n = t;
    } while (n != __sentinela);
  }
  void __ligar_antes(__elo_lista *pos, __elo_lista *n) {
    n->ant->prox = n->prox;
    n->prox->ant = n->ant;
    n->prox = pos;
    n->ant = pos->ant;
    pos->ant->prox = n;
    pos->ant = n;
  }
  // ordenação por inserção movendo os nós: estável, como a do g++
  template <class C> void sort(C comp) {
    if (__tamanho < 2) return;
    __elo_lista *i = __sentinela->prox->prox;
    while (i != __sentinela) {
      __elo_lista *prox = i->prox;
      __elo_lista *j = i->ant;
      while (j != __sentinela && comp(static_cast<__no_lista<T> *>(i)->valor, static_cast<__no_lista<T> *>(j)->valor)) j = j->ant;
      if (j->prox != i) __ligar_antes(j->prox, i);
      i = prox;
    }
  }
  void sort() { sort(less<T>()); }
  void unique() {
    if (__tamanho < 2) return;
    __it_lista<T> i = begin();
    __it_lista<T> j = i;
    for (++j; j != end();) {
      if (*i == *j) j = erase(j);
      else { i = j; ++j; }
    }
  }
  void merge(list &o) {
    __it_lista<T> i = begin();
    while (!o.empty()) {
      while (i != end() && !(o.front() < *i)) ++i;
      insert(i, o.front());
      o.pop_front();
    }
  }
  void splice(__it_lista<T> pos, list &o) {
    while (!o.empty()) { insert(pos, o.front()); o.pop_front(); }
  }
  void resize(size_t n, const T &v = T()) {
    while (__tamanho > n) pop_back();
    while (__tamanho < n) push_back(v);
  }
};
}
`

const DEQUE = String.raw`#pragma once
#include <__base>
#include <stdexcept>
namespace std {
template <class T> class deque;
template <class T> struct __it_deque {
  deque<T> *__d;
  long __i;
  __it_deque() : __d(nullptr), __i(0) {}
  __it_deque(deque<T> *d, long i) : __d(d), __i(i) {}
  T &operator*() const { return (*__d)[__i]; }
  T *operator->() const { return &(*__d)[__i]; }
  T &operator[](long n) const { return (*__d)[__i + n]; }
  __it_deque &operator++() { ++__i; return *this; }
  __it_deque operator++(int) { __it_deque t = *this; ++__i; return t; }
  __it_deque &operator--() { --__i; return *this; }
  __it_deque operator--(int) { __it_deque t = *this; --__i; return t; }
  __it_deque &operator+=(long n) { __i += n; return *this; }
  __it_deque &operator-=(long n) { __i -= n; return *this; }
  __it_deque operator+(long n) const { return __it_deque(__d, __i + n); }
  __it_deque operator-(long n) const { return __it_deque(__d, __i - n); }
  long operator-(const __it_deque &o) const { return __i - o.__i; }
  bool operator==(const __it_deque &o) const { return __i == o.__i; }
  bool operator!=(const __it_deque &o) const { return __i != o.__i; }
  bool operator<(const __it_deque &o) const { return __i < o.__i; }
  bool operator>(const __it_deque &o) const { return __i > o.__i; }
  bool operator<=(const __it_deque &o) const { return __i <= o.__i; }
  bool operator>=(const __it_deque &o) const { return __i >= o.__i; }
};

// Um vetor circular: os elementos vão de __inicio, dando a volta no fim do bloco.
template <class T> class deque {
public:
  T *__dados;
  size_t __inicio;
  size_t __tamanho;
  size_t __capacidade;
  typedef __it_deque<T> iterator;
  typedef __it_deque<T> const_iterator;
  typedef ::std::reverse_iterator<__it_deque<T>> reverse_iterator; // @se rbegin rend reverse_iterator
  typedef T value_type;
  deque() : __dados(nullptr), __inicio(0), __tamanho(0), __capacidade(0) {}
  deque(size_t n, const T &v = T()) : __dados(nullptr), __inicio(0), __tamanho(0), __capacidade(0) { for (size_t i = 0; i < n; i++) push_back(v); }
  deque(initializer_list<T> l) : __dados(nullptr), __inicio(0), __tamanho(0), __capacidade(0) { for (const T *p = l.begin(); p != l.end(); ++p) push_back(*p); }
  deque(const deque &o) : __dados(nullptr), __inicio(0), __tamanho(0), __capacidade(0) { for (size_t i = 0; i < o.__tamanho; i++) push_back(o[i]); }
  ~deque() { delete[] __dados; }
  deque &operator=(const deque &o) {
    if (this != &o) { clear(); for (size_t i = 0; i < o.__tamanho; i++) push_back(o[i]); }
    return *this;
  }
  void __crescer() {
    size_t nova = __capacidade ? __capacidade * 2 : 8;
    T *d = new T[nova];
    for (size_t i = 0; i < __tamanho; i++) d[i] = (*this)[i];
    delete[] __dados;
    __dados = d;
    __capacidade = nova;
    __inicio = 0;
  }
  T &operator[](size_t i) const { return __dados[(__inicio + i) % __capacidade]; }
  T &at(size_t i) const {
    if (i >= __tamanho) throw out_of_range("deque::at");
    return (*this)[i];
  }
  size_t size() const { return __tamanho; }
  bool empty() const { return __tamanho == 0; }
  T &front() const { return (*this)[0]; }
  T &back() const { return (*this)[__tamanho - 1]; }
  void push_back(const T &v) {
    if (__tamanho == __capacidade) __crescer();
    __dados[(__inicio + __tamanho) % __capacidade] = v;
    __tamanho++;
  }
  void push_front(const T &v) {
    if (__tamanho == __capacidade) __crescer();
    __inicio = (__inicio + __capacidade - 1) % __capacidade;
    __dados[__inicio] = v;
    __tamanho++;
  }
  template <class... A> void emplace_back(const A &...a) { push_back(T(a...)); }
  template <class... A> void emplace_front(const A &...a) { push_front(T(a...)); }
  void pop_back() { __dados[(__inicio + __tamanho - 1) % __capacidade] = T(); __tamanho--; }
  void pop_front() {
    __dados[__inicio] = T();
    __inicio = (__inicio + 1) % __capacidade;
    __tamanho--;
  }
  void clear() { while (__tamanho) pop_back(); }
  __it_deque<T> begin() const { return __it_deque<T>((deque *)this, 0); }
  __it_deque<T> end() const { return __it_deque<T>((deque *)this, (long)__tamanho); }
  reverse_iterator rbegin() const { return reverse_iterator(end()); } // @se rbegin rend
  reverse_iterator rend() const { return reverse_iterator(begin()); } // @se rbegin rend
  void resize(size_t n, const T &v = T()) {
    while (__tamanho > n) pop_back();
    while (__tamanho < n) push_back(v);
  }
  __it_deque<T> erase(__it_deque<T> pos) {
    for (size_t i = pos.__i; i + 1 < __tamanho; i++) (*this)[i] = (*this)[i + 1];
    pop_back();
    return pos;
  }
  __it_deque<T> insert(__it_deque<T> pos, const T &v) {
    push_back(v);
    for (size_t i = __tamanho - 1; i > (size_t)pos.__i; i--) swap((*this)[i], (*this)[i - 1]);
    return pos;
  }
};
}
`

const QUEUE = String.raw`#pragma once
#include <deque>
#include <vector>
#include <algorithm>
namespace std {
template <class T, class C = deque<T>> class queue {
public:
  C c;
  queue() : c() {}
  void push(const T &v) { c.push_back(v); }
  template <class... A> void emplace(const A &...a) { c.push_back(T(a...)); }
  void pop() { c.pop_front(); }
  T &front() { return c.front(); }
  T &back() { return c.back(); }
  size_t size() const { return c.size(); }
  bool empty() const { return c.empty(); }
};
template <class T, class C = vector<T>, class Comp = less<T>> class priority_queue {
public:
  C c;
  Comp comp;
  priority_queue() : c(), comp() {}
  explicit priority_queue(const Comp &f) : c(), comp(f) {}
  template <class I> priority_queue(I a, I b) : c(), comp() { for (; a != b; ++a) c.push_back(*a); make_heap(c.begin(), c.end(), comp); }
  void push(const T &v) { c.push_back(v); push_heap(c.begin(), c.end(), comp); }
  template <class... A> void emplace(const A &...a) { push(T(a...)); }
  void pop() { pop_heap(c.begin(), c.end(), comp); c.pop_back(); }
  const T &top() const { return c.front(); }
  size_t size() const { return c.size(); }
  bool empty() const { return c.empty(); }
};
}
`

const STACK = String.raw`#pragma once
#include <deque>
namespace std {
template <class T, class C = deque<T>> class stack {
public:
  C c;
  stack() : c() {}
  void push(const T &v) { c.push_back(v); }
  template <class... A> void emplace(const A &...a) { c.push_back(T(a...)); }
  void pop() { c.pop_back(); }
  T &top() { return c.back(); }
  size_t size() const { return c.size(); }
  bool empty() const { return c.empty(); }
};
}
`

const ARRAY = String.raw`#pragma once
#include <__base>
#include <stdexcept>
namespace std {
template <class T, size_t N> struct array {
  T __v[N];
  T &operator[](size_t i) { return __v[i]; }
  const T &operator[](size_t i) const { return __v[i]; }
  T &at(size_t i) {
    if (i >= N) throw out_of_range("array::at");
    return __v[i];
  }
  size_t size() const { return N; }
  bool empty() const { return N == 0; }
  T *begin() { return __v; }
  T *end() { return __v + N; }
  const T *begin() const { return __v; }
  const T *end() const { return __v + N; }
  reverse_iterator<T *> rbegin() { return reverse_iterator<T *>(__v + N); } // @se rbegin rend
  reverse_iterator<T *> rend() { return reverse_iterator<T *>(__v); } // @se rbegin rend
  T &front() { return __v[0]; }
  T &back() { return __v[N - 1]; }
  T *data() { return __v; }
  void fill(const T &x) { for (size_t i = 0; i < N; i++) __v[i] = x; }
};
}
`

const MEMORY = String.raw`#pragma once
#include <__base>
namespace std {
template <class T> class unique_ptr {
public:
  T *__p;
  unique_ptr() : __p(nullptr) {}
  unique_ptr(decltype(nullptr)) : __p(nullptr) {}
  explicit unique_ptr(T *p) : __p(p) {}
  // Sem "&&" no passo a passo: copiar um unique_ptr (o que só acontece com std::move) transfere o objeto.
  unique_ptr(const unique_ptr &o) : __p(o.__p) { const_cast<unique_ptr &>(o).__p = nullptr; }
  template <class U> unique_ptr(const unique_ptr<U> &o) : __p(o.__p) { const_cast<unique_ptr<U> &>(o).__p = nullptr; }
  ~unique_ptr() { delete __p; }
  unique_ptr &operator=(const unique_ptr &o) {
    if (this != &o) {
      T *velho = __p;
      __p = o.__p;
      const_cast<unique_ptr &>(o).__p = nullptr;
      delete velho;
    }
    return *this;
  }
  unique_ptr &operator=(decltype(nullptr)) { reset(); return *this; }
  T &operator*() const { return *__p; }
  T *operator->() const { return __p; }
  T *get() const { return __p; }
  T *release() { T *p = __p; __p = nullptr; return p; }
  void reset(T *p = nullptr) { T *velho = __p; __p = p; delete velho; }
  explicit operator bool() const { return __p != nullptr; }
};
template <class T> class unique_ptr<T[]> {
public:
  T *__p;
  unique_ptr() : __p(nullptr) {}
  explicit unique_ptr(T *p) : __p(p) {}
  unique_ptr(const unique_ptr &o) : __p(o.__p) { const_cast<unique_ptr &>(o).__p = nullptr; }
  ~unique_ptr() { delete[] __p; }
  unique_ptr &operator=(const unique_ptr &o) {
    if (this != &o) { delete[] __p; __p = o.__p; const_cast<unique_ptr &>(o).__p = nullptr; }
    return *this;
  }
  T &operator[](size_t i) const { return __p[i]; }
  T *get() const { return __p; }
  void reset(T *p = nullptr) { T *velho = __p; __p = p; delete[] velho; }
  explicit operator bool() const { return __p != nullptr; }
};
template <class T, class... A> unique_ptr<T> make_unique(const A &...a) { return unique_ptr<T>(new T(a...)); }
template <class T> bool operator==(const unique_ptr<T> &p, decltype(nullptr)) { return p.__p == nullptr; }
template <class T> bool operator!=(const unique_ptr<T> &p, decltype(nullptr)) { return p.__p != nullptr; }

// shared_ptr: o contador fica num bloco próprio do heap, dividido por todas as cópias.
template <class T> class shared_ptr {
public:
  T *__p;
  long *__contagem;
  shared_ptr() : __p(nullptr), __contagem(nullptr) {}
  shared_ptr(decltype(nullptr)) : __p(nullptr), __contagem(nullptr) {}
  explicit shared_ptr(T *p) : __p(p), __contagem(new long(1)) {}
  shared_ptr(const shared_ptr &o) : __p(o.__p), __contagem(o.__contagem) { if (__contagem) ++*__contagem; }
  template <class U> shared_ptr(const shared_ptr<U> &o) : __p(o.__p), __contagem(o.__contagem) { if (__contagem) ++*__contagem; }
  ~shared_ptr() { __soltar(); }
  void __soltar() {
    if (__contagem && --*__contagem == 0) {
      delete __p;
      delete __contagem;
    }
    __p = nullptr;
    __contagem = nullptr;
  }
  shared_ptr &operator=(const shared_ptr &o) {
    if (__contagem != o.__contagem) {
      if (o.__contagem) ++*o.__contagem;
      T *p = o.__p;
      long *c = o.__contagem;
      __soltar();
      __p = p;
      __contagem = c;
    }
    return *this;
  }
  T &operator*() const { return *__p; }
  T *operator->() const { return __p; }
  T *get() const { return __p; }
  long use_count() const { return __contagem ? *__contagem : 0; }
  void reset() { __soltar(); }
  void reset(T *p) { __soltar(); __p = p; __contagem = new long(1); }
  explicit operator bool() const { return __p != nullptr; }
};
template <class T, class... A> shared_ptr<T> make_shared(const A &...a) { return shared_ptr<T>(new T(a...)); }
template <class T> bool operator==(const shared_ptr<T> &p, decltype(nullptr)) { return p.__p == nullptr; }
template <class T> bool operator!=(const shared_ptr<T> &p, decltype(nullptr)) { return p.__p != nullptr; }
template <class T, class U> bool operator==(const shared_ptr<T> &a, const shared_ptr<U> &b) { return a.__p == b.__p; }
}
`

const NUMERIC = String.raw`#pragma once
#include <__base>
namespace std {
template <class I, class T> T accumulate(I a, I b, T v) { for (; a != b; ++a) v = v + *a; return v; }
template <class I, class T, class F> T accumulate(I a, I b, T v, F f) { for (; a != b; ++a) v = f(v, *a); return v; }
template <class I, class T> void iota(I a, I b, T v) { for (; a != b; ++a, ++v) *a = v; }
template <class I, class O> O partial_sum(I a, I b, O d) {
  if (a == b) return d;
  auto s = *a;
  *d = s;
  for (++a, ++d; a != b; ++a, ++d) { s = s + *a; *d = s; }
  return d;
}
template <class I, class J, class T> T inner_product(I a, I b, J c, T v) { for (; a != b; ++a, ++c) v = v + *a * *c; return v; }
template <class I, class O> O adjacent_difference(I a, I b, O d) {
  if (a == b) return d;
  auto ant = *a;
  *d = ant;
  for (++a, ++d; a != b; ++a, ++d) { auto x = *a; *d = x - ant; ant = x; }
  return d;
}
template <class M, class N> M gcd(M a, N b) {
  if (a < 0) a = -a;
  if (b < 0) b = -b;
  while (b != 0) { M t = a % b; a = b; b = t; }
  return a;
}
template <class M, class N> M lcm(M a, N b) {
  if (a == 0 || b == 0) return 0;
  M g = gcd(a, b);
  M r = a / g * b;
  return r < 0 ? -r : r;
}
}
`

// algorithm: sort e as funções de heap seguem a libstdc++ passo a passo, para empates saírem na mesma ordem.
const ALGORITHM = String.raw`#pragma once
#include <utility>
namespace std {
template <class T> const T &max(const T &a, const T &b) { return a < b ? b : a; }
template <class T> const T &min(const T &a, const T &b) { return b < a ? b : a; }
template <class T, class C> const T &max(const T &a, const T &b, C comp) { return comp(a, b) ? b : a; }
template <class T, class C> const T &min(const T &a, const T &b, C comp) { return comp(b, a) ? b : a; }
template <class T> T max(initializer_list<T> l) {
  const T *p = l.begin();
  T m = *p;
  for (++p; p != l.end(); ++p) if (m < *p) m = *p;
  return m;
}
template <class T> T min(initializer_list<T> l) {
  const T *p = l.begin();
  T m = *p;
  for (++p; p != l.end(); ++p) if (*p < m) m = *p;
  return m;
}
template <class T> pair<T, T> minmax(const T &a, const T &b) { return b < a ? pair<T, T>(b, a) : pair<T, T>(a, b); }
template <class T> T clamp(const T &v, const T &lo, const T &hi) { return v < lo ? lo : hi < v ? hi : v; }
template <class T> T abs(T x) { return x < 0 ? -x : x; }
template <class T> T __gcd(T a, T b) { while (b != 0) { T t = a % b; a = b; b = t; } return a; }

template <class I, class C> I max_element(I a, I b, C comp) {
  if (a == b) return b;
  I m = a;
  for (++a; a != b; ++a) if (comp(*m, *a)) m = a;
  return m;
}
template <class I> I max_element(I a, I b) { return max_element(a, b, less<>()); }
template <class I, class C> I min_element(I a, I b, C comp) {
  if (a == b) return b;
  I m = a;
  for (++a; a != b; ++a) if (comp(*a, *m)) m = a;
  return m;
}
template <class I> I min_element(I a, I b) { return min_element(a, b, less<>()); }
template <class I, class T> I find(I a, I b, const T &v) { for (; a != b; ++a) if (*a == v) return a; return b; }
template <class I, class P> I find_if(I a, I b, P p) { for (; a != b; ++a) if (p(*a)) return a; return b; }
template <class I, class P> I find_if_not(I a, I b, P p) { for (; a != b; ++a) if (!p(*a)) return a; return b; }
template <class I, class T> long count(I a, I b, const T &v) { long n = 0; for (; a != b; ++a) if (*a == v) n++; return n; }
template <class I, class P> long count_if(I a, I b, P p) { long n = 0; for (; a != b; ++a) if (p(*a)) n++; return n; }
template <class I, class F> F for_each(I a, I b, F f) { for (; a != b; ++a) f(*a); return f; }
template <class I, class P> bool all_of(I a, I b, P p) { for (; a != b; ++a) if (!p(*a)) return false; return true; }
template <class I, class P> bool any_of(I a, I b, P p) { for (; a != b; ++a) if (p(*a)) return true; return false; }
template <class I, class P> bool none_of(I a, I b, P p) { for (; a != b; ++a) if (p(*a)) return false; return true; }
template <class I, class O, class F> O transform(I a, I b, O d, F f) { for (; a != b; ++a, ++d) *d = f(*a); return d; }
template <class I, class J, class O, class F> O transform(I a, I b, J c, O d, F f) { for (; a != b; ++a, ++c, ++d) *d = f(*a, *c); return d; }
template <class I, class O> O copy(I a, I b, O d) { for (; a != b; ++a, ++d) *d = *a; return d; }
template <class I, class O, class P> O copy_if(I a, I b, O d, P p) { for (; a != b; ++a) if (p(*a)) { *d = *a; ++d; } return d; }
template <class I, class N, class O> O copy_n(I a, N n, O d) { for (; n > 0; --n, ++a, ++d) *d = *a; return d; }
template <class I, class O> O copy_backward(I a, I b, O d) { while (a != b) *--d = *--b; return d; }
template <class I, class T> void fill(I a, I b, const T &v) { for (; a != b; ++a) *a = v; }
template <class I, class N, class T> I fill_n(I a, N n, const T &v) { for (; n > 0; --n, ++a) *a = v; return a; }
template <class I, class T> void replace(I a, I b, const T &velho, const T &novo) { for (; a != b; ++a) if (*a == velho) *a = novo; }
template <class I, class P, class T> void replace_if(I a, I b, P p, const T &novo) { for (; a != b; ++a) if (p(*a)) *a = novo; }
template <class I, class T> I remove(I a, I b, const T &v) {
  I d = find(a, b, v);
  if (d == b) return b;
  for (I i = d; ++i != b;) if (!(*i == v)) { *d = *i; ++d; }
  return d;
}
template <class I, class P> I remove_if(I a, I b, P p) {
  I d = find_if(a, b, p);
  if (d == b) return b;
  for (I i = d; ++i != b;) if (!p(*i)) { *d = *i; ++d; }
  return d;
}
template <class I, class P> I unique(I a, I b, P p) {
  if (a == b) return b;
  I d = a;
  while (++a != b) if (!p(*d, *a)) { ++d; if (d != a) *d = *a; }
  return ++d;
}
template <class I> I unique(I a, I b) { return unique(a, b, __igual()); }
template <class I> void reverse(I a, I b) {
  while (a != b && a != --b) { iter_swap(a, b); ++a; }
}
template <class I, class O> O reverse_copy(I a, I b, O d) { while (a != b) { --b; *d = *b; ++d; } return d; }
template <class I> void rotate(I a, I m, I b) {
  reverse(a, m);
  reverse(m, b);
  reverse(a, b);
}
template <class I, class J> bool equal(I a, I b, J c) { for (; a != b; ++a, ++c) if (!(*a == *c)) return false; return true; }
template <class I, class J> bool lexicographical_compare(I a, I b, J c, J d) {
  for (; a != b && c != d; ++a, ++c) {
    if (*a < *c) return true;
    if (*c < *a) return false;
  }
  return a == b && c != d;
}
template <class I, class J> I search(I a, I b, J c, J d) {
  for (;; ++a) {
    I i = a;
    for (J j = c;; ++i, ++j) {
      if (j == d) return a;
      if (i == b) return b;
      if (!(*i == *j)) break;
    }
  }
}

// ---- busca binária ----
template <class I, class T, class C> I lower_bound(I a, I b, const T &v, C comp) {
  long n = distance(a, b);
  while (n > 0) {
    long meio = n / 2;
    I m = a;
    advance(m, meio);
    if (comp(*m, v)) { a = ++m; n -= meio + 1; }
    else n = meio;
  }
  return a;
}
template <class I, class T> I lower_bound(I a, I b, const T &v) { return lower_bound(a, b, v, less<>()); }
template <class I, class T, class C> I upper_bound(I a, I b, const T &v, C comp) {
  long n = distance(a, b);
  while (n > 0) {
    long meio = n / 2;
    I m = a;
    advance(m, meio);
    if (!comp(v, *m)) { a = ++m; n -= meio + 1; }
    else n = meio;
  }
  return a;
}
template <class I, class T> I upper_bound(I a, I b, const T &v) { return upper_bound(a, b, v, less<>()); }
template <class I, class T> bool binary_search(I a, I b, const T &v) { I i = lower_bound(a, b, v); return i != b && !(v < *i); }
template <class I, class T, class C> bool binary_search(I a, I b, const T &v, C comp) { I i = lower_bound(a, b, v, comp); return i != b && !comp(v, *i); }
template <class I, class T> pair<I, I> equal_range(I a, I b, const T &v) { return pair<I, I>(lower_bound(a, b, v), upper_bound(a, b, v)); }

// ---- sort e heap ----
// Rodam em JavaScript (biblioteca-cpp.js), com os algoritmos da libstdc++. Aqui fica só a casca: o "if (false)"
// faz o clang escrever o operator() do comparador (que o JavaScript chama), sem escrever um introsort inteiro
// para cada comparador — o que deixava o JSON da árvore enorme e lento. (As funções "_js" têm corpo vazio só
// para o clang aceitar: o passo a passo chama a versão em JavaScript.)
template <class I, class C> void __ordenar_js(I a, I b, C &comp) {}
template <class I, class C> void __ordenar_estavel_js(I a, I b, C &comp) {}
template <class I, class C> void __empurrar_heap_js(I a, I b, C &comp) {}
template <class I, class C> void __tirar_heap_js(I a, I b, C &comp) {}
template <class I, class C> void __fazer_heap_js(I a, I b, C &comp) {}
template <class I, class C> void __ordenar_heap_js(I a, I b, C &comp) {}
template <class I, class C> void sort(I a, I b, C comp) { if (false) comp(*a, *b); __ordenar_js(a, b, comp); }
template <class I> void sort(I a, I b) { less<> c; if (false) c(*a, *b); __ordenar_js(a, b, c); }
template <class I, class C> void stable_sort(I a, I b, C comp) { if (false) comp(*a, *b); __ordenar_estavel_js(a, b, comp); }
template <class I> void stable_sort(I a, I b) { less<> c; if (false) c(*a, *b); __ordenar_estavel_js(a, b, c); }
template <class I, class C> void push_heap(I a, I b, C comp) { if (false) comp(*a, *b); __empurrar_heap_js(a, b, comp); }
template <class I> void push_heap(I a, I b) { less<> c; if (false) c(*a, *b); __empurrar_heap_js(a, b, c); }
template <class I, class C> void pop_heap(I a, I b, C comp) { if (false) comp(*a, *b); __tirar_heap_js(a, b, comp); }
template <class I> void pop_heap(I a, I b) { less<> c; if (false) c(*a, *b); __tirar_heap_js(a, b, c); }
template <class I, class C> void make_heap(I a, I b, C comp) { if (false) comp(*a, *b); __fazer_heap_js(a, b, comp); }
template <class I> void make_heap(I a, I b) { less<> c; if (false) c(*a, *b); __fazer_heap_js(a, b, c); }
template <class I, class C> void sort_heap(I a, I b, C comp) { if (false) comp(*a, *b); __ordenar_heap_js(a, b, comp); }
template <class I> void sort_heap(I a, I b) { less<> c; if (false) c(*a, *b); __ordenar_heap_js(a, b, c); }
template <class I, class C> void __ordenar_parcial_js(I a, I m, I b, C &comp) {}
template <class I, class C> void partial_sort(I a, I m, I b, C comp) { if (false) comp(*a, *b); __ordenar_parcial_js(a, m, b, comp); }
template <class I> void partial_sort(I a, I m, I b) { less<> c; if (false) c(*a, *b); __ordenar_parcial_js(a, m, b, c); }
template <class I, class C> void nth_element(I a, I n, I b, C comp) { sort(a, b, comp); }
template <class I> void nth_element(I a, I n, I b) { sort(a, b, less<>()); }
template <class I, class C> bool is_sorted(I a, I b, C comp) {
  if (a == b) return true;
  for (I p = a, i = ++a; i != b; ++i, ++p) if (comp(*i, *p)) return false;
  return true;
}
template <class I> bool is_sorted(I a, I b) { return is_sorted(a, b, less<>()); }

// ---- permutações ----
template <class I, class C> bool next_permutation(I a, I b, C comp) {
  if (a == b) return false;
  I i = b;
  if (a == --i) return false;
  for (;;) {
    I ii = i;
    --i;
    if (comp(*i, *ii)) {
      I j = b;
      while (!comp(*i, *--j)) {}
      iter_swap(i, j);
      reverse(ii, b);
      return true;
    }
    if (i == a) {
      reverse(a, b);
      return false;
    }
  }
}
template <class I> bool next_permutation(I a, I b) { return next_permutation(a, b, less<>()); }
template <class I, class C> bool prev_permutation(I a, I b, C comp) {
  if (a == b) return false;
  I i = b;
  if (a == --i) return false;
  for (;;) {
    I ii = i;
    --i;
    if (comp(*ii, *i)) {
      I j = b;
      while (!comp(*--j, *i)) {}
      iter_swap(i, j);
      reverse(ii, b);
      return true;
    }
    if (i == a) {
      reverse(a, b);
      return false;
    }
  }
}
template <class I> bool prev_permutation(I a, I b) { return prev_permutation(a, b, less<>()); }
}
`

const LIMITS = String.raw`#pragma once
namespace std {
template <class T> struct numeric_limits {
  static const bool is_specialized = false;
};
template <> struct numeric_limits<int> {
  static int max() { return 2147483647; }
  static int min() { return -2147483647 - 1; }
  static int lowest() { return -2147483647 - 1; }
  static const bool is_signed = true;
  static const int digits10 = 9;
};
template <> struct numeric_limits<unsigned int> {
  static unsigned int max() { return 4294967295u; }
  static unsigned int min() { return 0; }
  static unsigned int lowest() { return 0; }
};
template <> struct numeric_limits<long> {
  static long max() { return 2147483647L; }
  static long min() { return -2147483647L - 1; }
  static long lowest() { return -2147483647L - 1; }
};
template <> struct numeric_limits<unsigned long> {
  static unsigned long max() { return 4294967295UL; }
  static unsigned long min() { return 0; }
};
template <> struct numeric_limits<long long> {
  static long long max() { return 9223372036854775807LL; }
  static long long min() { return -9223372036854775807LL - 1; }
  static long long lowest() { return -9223372036854775807LL - 1; }
};
template <> struct numeric_limits<unsigned long long> {
  static unsigned long long max() { return 18446744073709551615ULL; }
  static unsigned long long min() { return 0; }
};
template <> struct numeric_limits<short> {
  static short max() { return 32767; }
  static short min() { return -32768; }
};
template <> struct numeric_limits<unsigned short> {
  static unsigned short max() { return 65535; }
  static unsigned short min() { return 0; }
};
template <> struct numeric_limits<char> {
  static char max() { return 127; }
  static char min() { return -128; }
};
template <> struct numeric_limits<unsigned char> {
  static unsigned char max() { return 255; }
  static unsigned char min() { return 0; }
};
template <> struct numeric_limits<bool> {
  static bool max() { return true; }
  static bool min() { return false; }
};
template <> struct numeric_limits<double> {
  static double max() { return 1.7976931348623157e308; }
  static double min() { return 2.2250738585072014e-308; }
  static double lowest() { return -1.7976931348623157e308; }
  static double epsilon() { return 2.220446049250313e-16; }
  static double infinity() { double x = 1e300; return x * x; }
  static const int digits10 = 15;
};
template <> struct numeric_limits<float> {
  static float max() { return 3.40282347e38f; }
  static float min() { return 1.17549435e-38f; }
  static float lowest() { return -3.40282347e38f; }
  static float epsilon() { return 1.19209290e-7f; }
  static float infinity() { float x = 1e30f; return x * x * x; }
  static const int digits10 = 6;
};
}
`

const SSTREAM = String.raw`#pragma once
#include <iostream>
namespace std {
// O texto da stringstream é uma string de verdade (aparece na memória); os operadores são os de istream e ostream.
class stringstream : public istream, public ostream {
public:
  string __texto;
  size_t __posicao;
  stringstream();
  stringstream(const string &s);
  stringstream(const stringstream &o);
  ~stringstream();
  string str() const;
  void str(const string &s);
};
typedef stringstream istringstream;
typedef stringstream ostringstream;
}
`

const CASSERT = String.raw`#pragma once
#include <assert.h>
`

/** Os cabeçalhos da STL; `bits/stdc++.h` inclui todos (com os do C e o iostream). */
export const CABECALHOS_STL = {
  __base: BASE,
  utility: UTILITY,
  tuple: TUPLE,
  functional: FUNCTIONAL,
  __arvore: ARVORE,
  map: MAP,
  set: SET,
  __hash: HASH,
  unordered_map: UNORDERED_MAP,
  unordered_set: UNORDERED_SET,
  list: LIST,
  deque: DEQUE,
  queue: QUEUE,
  stack: STACK,
  array: ARRAY,
  memory: MEMORY,
  numeric: NUMERIC,
  algorithm: ALGORITHM,
  limits: LIMITS,
  sstream: SSTREAM,
}

export const TODOS_OS_CABECALHOS = ['cstdio', 'cstdlib', 'cstring', 'cmath', 'cctype', 'ctime', 'climits', 'cstdint', 'cstddef',
  'iostream', 'iomanip', 'sstream', 'string', 'vector', 'algorithm', 'numeric', 'utility', 'tuple', 'functional', 'map', 'set',
  'unordered_map', 'unordered_set', 'list', 'deque', 'queue', 'stack', 'array', 'memory', 'limits', 'exception', 'stdexcept']
export { CASSERT }
