// Cabeçalhos mínimos do C++ para o passo a passo. string e vector são classes de
// verdade na memória (ponteiro para os dados no heap, tamanho e capacidade), para o
// aluno ver como elas funcionam por dentro; os métodos são feitos em biblioteca-cpp.js.

import { CABECALHOS_C } from './cabecalhos.js'
import { CABECALHOS_STL, CASSERT, TODOS_OS_CABECALHOS } from './cabecalhos-stl.js'
import { cabecalhosSobMedida } from './sob-medida.js'

export const ARGUMENTOS_AST_CPP = [
  'clang++', '-fsyntax-only', '-nostdinc', '-nostdinc++', '-isystem', 'mini', '-std=c++20', '-fexceptions', '-fcxx-exceptions',
  '-fno-color-diagnostics', '-Xclang', '-ast-dump=json', 'programa.cpp',
]

// Funções do C que o <cxxx> correspondente põe também em std:: (std::sqrt, std::printf...).
const NOMES_C = {
  cmath: ['sqrt', 'fabs', 'floor', 'ceil', 'round', 'trunc', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'log', 'log10', 'log2', 'cbrt', 'pow', 'atan2', 'fmod', 'hypot', 'fmin', 'fmax'],
  cstdlib: ['malloc', 'calloc', 'realloc', 'free', 'exit', 'abs', 'atoi', 'atof', 'rand', 'srand', 'system', 'qsort'],
  cstring: ['strlen', 'strcpy', 'strncpy', 'strcat', 'strcmp', 'strncmp', 'strchr', 'strstr', 'memset', 'memcpy'],
  cstdio: ['printf', 'scanf', 'puts', 'putchar', 'getchar', 'fgets', 'sprintf'],
  cctype: ['isdigit', 'isalpha', 'isalnum', 'isspace', 'isupper', 'islower', 'toupper', 'tolower'],
  ctime: ['time', 'clock'],
}
const envolver = (c, nomes) => `#pragma once\n#include <${c}.h>\nnamespace std {\n${nomes.map((n) => `using ::${n};`).join('\n')}\n}\n`

const INITIALIZER_LIST = `#pragma once
#include <stddef.h>
namespace std {
template <class E> class initializer_list {
  const E *__inicio;
  size_t __tamanho;
public:
  initializer_list();
  size_t size() const;
  const E *begin() const;
  const E *end() const;
};
}
`

const STRING = `#pragma once
#include <stddef.h>
#include <initializer_list>
#include <__base>
namespace std {
class string {
  char *__dados = nullptr;
  size_t __tamanho = 0;
  size_t __capacidade = 0;
public:
  static const size_t npos = (size_t)-1;
  string();
  string(const char *s);
  string(const string &s);
  string(size_t n, char c);
  string(const string &s, size_t pos, size_t n = npos) { *this = s.substr(pos, n); } // @se substr string
  template <class I, class = decltype(*I())> string(I a, I b) { for (; a != b; ++a) push_back(*a); }
  ~string();
  string &operator=(const string &s);
  string &operator=(const char *s);
  string &operator=(char c);
  string &operator+=(const string &s);
  string &operator+=(const char *s);
  string &operator+=(char c);
  size_t size() const;
  size_t length() const;
  bool empty() const;
  void clear();
  char &operator[](size_t i);
  const char &operator[](size_t i) const;
  char &at(size_t i);
  char &front();
  char &back();
  const char *c_str() const;
  const char *data() const; // @se data
  void push_back(char c);
  void pop_back();
  string substr(size_t pos, size_t n = npos) const;
  size_t find(const string &s, size_t pos = 0) const;
  size_t find(char c, size_t pos = 0) const;
  size_t rfind(const string &s, size_t pos = npos) const; // @se rfind
  size_t rfind(char c, size_t pos = npos) const; // @se rfind
  size_t find_first_of(const string &s, size_t pos = 0) const; // @se find_first_of
  size_t find_last_of(const string &s, size_t pos = npos) const; // @se find_last_of
  size_t find_first_not_of(const string &s, size_t pos = 0) const; // @se find_first_not_of
  size_t find_last_not_of(const string &s, size_t pos = npos) const; // @se find_last_not_of
  string &replace(size_t pos, size_t n, const string &s); // @se replace
  void resize(size_t n, char c = 0); // @se resize
  void swap(string &s); // @se swap
  string &assign(const string &s); // @se assign
  void reserve(size_t n) {}
  int compare(const string &s) const; // @se compare
  string &append(const string &s); // @se append
  string &insert(size_t pos, const string &s); // @se insert
  string &erase(size_t pos, size_t n = npos); // @se erase
  char *begin();
  char *end();
  const char *begin() const;
  const char *end() const;
  reverse_iterator<char *> rbegin() { return reverse_iterator<char *>(end()); } // @se rbegin rend
  reverse_iterator<char *> rend() { return reverse_iterator<char *>(begin()); } // @se rbegin rend
};
string operator+(const string &a, const string &b);
string operator+(const string &a, const char *b);
string operator+(const char *a, const string &b);
string operator+(const string &a, char b);
string operator+(char a, const string &b);
bool operator==(const string &a, const string &b);
bool operator==(const string &a, const char *b);
bool operator!=(const string &a, const string &b);
bool operator!=(const string &a, const char *b);
bool operator<(const string &a, const string &b);
bool operator>(const string &a, const string &b);
bool operator<=(const string &a, const string &b);
bool operator>=(const string &a, const string &b);
// @se to_string
string to_string(int v);
string to_string(unsigned int v);
string to_string(long v);
string to_string(long long v);
string to_string(unsigned long long v);
string to_string(double v);
// @fim
int stoi(const string &s); // @se stoi
long stol(const string &s); // @se stol
long long stoll(const string &s); // @se stoll
double stod(const string &s); // @se stod
float stof(const string &s); // @se stof
inline void swap(string &a, string &b) { a.swap(b); } // @se swap
}
`

const IOSTREAM = `#pragma once
#include <string>
namespace std {
typedef long long streamsize;
struct __setprecision { int n; };
struct __setw { int n; };
struct __setfill { char c; };
class ostream {
  int __id;
public:
  ostream &operator<<(int v);
  ostream &operator<<(unsigned int v);
  ostream &operator<<(long v);
  ostream &operator<<(unsigned long v);
  ostream &operator<<(long long v);
  ostream &operator<<(unsigned long long v);
  ostream &operator<<(double v);
  ostream &operator<<(float v);
  ostream &operator<<(bool v);
  ostream &operator<<(char c);
  ostream &operator<<(const char *s);
  ostream &operator<<(const void *p);
  ostream &operator<<(const string &s);
  ostream &operator<<(ostream &(*manipulador)(ostream &));
  ostream &operator<<(__setprecision p);
  ostream &operator<<(__setw p);
  ostream &operator<<(__setfill p);
  ostream &flush();
  ostream &put(char c); // @se put
  int precision(int n); // @se precision
  int precision() const; // @se precision
  int width(int n); // @se width
  char fill(char c); // @se fill
};
class istream {
  int __id;
public:
  istream &operator>>(int &v);
  istream &operator>>(unsigned int &v);
  istream &operator>>(long &v);
  istream &operator>>(long long &v);
  istream &operator>>(double &v);
  istream &operator>>(float &v);
  istream &operator>>(char &c);
  istream &operator>>(bool &b);
  istream &operator>>(string &s);
  istream &operator>>(char *s);
  istream &operator>>(unsigned long long &v);
  istream &operator>>(short &v);
  istream &operator>>(istream &(*manipulador)(istream &));
  explicit operator bool() const;
  bool operator!() const;
  istream &ignore(streamsize n = 1, int ate = -1);
  int get();
  istream &get(char &c);
  int peek();
  bool good() const;
  bool eof() const;
  bool fail() const;
  void clear();
};
extern ostream cout;
extern ostream cerr;
extern istream cin;
ostream &endl(ostream &o);
ostream &flush(ostream &o);
ostream &fixed(ostream &o);
ostream &scientific(ostream &o);
ostream &defaultfloat(ostream &o);
ostream &left(ostream &o);
ostream &right(ostream &o);
ostream &internal(ostream &o);
ostream &boolalpha(ostream &o);
ostream &noboolalpha(ostream &o);
ostream &showpoint(ostream &o);
ostream &noshowpoint(ostream &o);
ostream &showpos(ostream &o);
ostream &noshowpos(ostream &o);
ostream &uppercase(ostream &o);
ostream &nouppercase(ostream &o);
ostream &hex(ostream &o);
ostream &dec(ostream &o);
ostream &oct(ostream &o);
istream &getline(istream &is, string &s);
istream &getline(istream &is, string &s, char fim);
istream &ws(istream &is);
__setprecision setprecision(int n);
__setw setw(int n);
__setfill setfill(char c);
}
`

const VECTOR = `#pragma once
#include <stddef.h>
#include <initializer_list>
#include <__base>
namespace std {
template <class T> class vector {
  T *__dados = nullptr;
  size_t __tamanho = 0;
  size_t __capacidade = 0;
public:
  typedef T *iterator; // @se iterator
  typedef const T *const_iterator; // @se const_iterator
  typedef T value_type; // @se value_type
  vector();
  vector(size_t n);
  vector(size_t n, const T &valor);
  vector(initializer_list<T> lista);
  vector(const vector &outro);
  ~vector() {
    if (false) {
      __exigir_copia(__dados, 0);
      __exigir_padrao(__dados, 0);
      __exigir_atribuicao(__dados, 0);
    }
    __destruir();
  }
  void __destruir();
  vector &operator=(const vector &outro);
  template <class I, class = decltype(*I())> vector(I a, I b) { for (; a != b; ++a) push_back(*a); }
  template <class... A> void emplace_back(const A &...a) { push_back(T(a...)); } // @se emplace_back
  void push_back(const T &x);
  void pop_back(); // @se pop_back
  size_t size() const;
  bool empty() const;
  void clear();
  void resize(size_t n); // @se resize
  size_t capacity() const; // @se capacity
  void reserve(size_t n) {} // @se reserve
  void shrink_to_fit() {} // @se shrink_to_fit
  T &operator[](size_t i);
  const T &operator[](size_t i) const;
  T &at(size_t i); // @se at
  const T &at(size_t i) const; // @se at
  T &front(); // @se front
  T &back(); // @se back
  const T &front() const; // @se front
  const T &back() const; // @se back
  T *begin();
  T *end();
  const T *begin() const;
  const T *end() const;
  const T *cbegin() const; // @se cbegin cend
  const T *cend() const; // @se cbegin cend
  reverse_iterator<T *> rbegin() { return reverse_iterator<T *>(end()); } // @se rbegin rend
  reverse_iterator<T *> rend() { return reverse_iterator<T *>(begin()); } // @se rbegin rend
  T *data(); // @se data
  T *insert(T *pos, const T &x); // @se insert
  T *erase(T *pos); // @se erase
  T *erase(T *a, T *b) { size_t i = a - begin(), n = b - a; for (size_t k = 0; k < n; k++) erase(begin() + i); return begin() + i; } // @se erase
  void assign(size_t n, const T &v) { clear(); for (size_t i = 0; i < n; i++) push_back(v); } // @se assign
  void swap(vector &o) { vector t = o; o = *this; *this = t; } // @se swap
};
// comparações: os elementos são comparados em JavaScript (com o == e o < deles, que o "if (false)" faz existir)
template <class I, class C> bool __iguais_js(I a, I b, I c, I d, C &comp) { return false; }
template <class I, class C> bool __menor_lexico_js(I a, I b, I c, I d, C &comp) { return false; }
template <class T> bool operator==(const vector<T> &a, const vector<T> &b) { equal_to<> c; if (false) c(*a.begin(), *b.begin()); return __iguais_js(a.begin(), a.end(), b.begin(), b.end(), c); }
template <class T> bool operator!=(const vector<T> &a, const vector<T> &b) { return !(a == b); }
template <class T> bool operator<(const vector<T> &a, const vector<T> &b) { less<> c; if (false) c(*a.begin(), *b.begin()); return __menor_lexico_js(a.begin(), a.end(), b.begin(), b.end(), c); }
template <class T> bool operator>(const vector<T> &a, const vector<T> &b) { return b < a; }
template <class T> bool operator<=(const vector<T> &a, const vector<T> &b) { return !(b < a); }
template <class T> bool operator>=(const vector<T> &a, const vector<T> &b) { return !(a < b); }
template <class T> void swap(vector<T> &a, vector<T> &b) { a.swap(b); } // @se swap
}
`


// As exceções da biblioteca são C++ de verdade (com corpo): o passo a passo executa como código do aluno.
const EXCEPTION = `#pragma once
namespace std {
class exception {
public:
  exception() {}
  virtual ~exception() {}
  virtual const char *what() const { return "std::exception"; }
};
class bad_alloc : public exception {
public:
  const char *what() const override { return "std::bad_alloc"; }
};
}
`
const STDEXCEPT = `#pragma once
#include <exception>
#include <string>
namespace std {
${[['logic_error', 'exception'], ['runtime_error', 'exception'], ['invalid_argument', 'logic_error'], ['out_of_range', 'logic_error'],
    ['length_error', 'logic_error'], ['domain_error', 'logic_error'], ['range_error', 'runtime_error'], ['overflow_error', 'runtime_error'],
    ['underflow_error', 'runtime_error']].map(([c, base]) => (base === 'exception'
    ? `class ${c} : public exception {
  string __mensagem;
public:
  ${c}(const string &m) : __mensagem(m) {}
  ${c}(const char *m) : __mensagem(m) {}
  const char *what() const override { return __mensagem.c_str(); }
};`
    : `class ${c} : public ${base} {
public:
  ${c}(const string &m) : ${base}(m) {}
  ${c}(const char *m) : ${base}(m) {}
};`)).join('\n')}
}
`

export const CABECALHOS_CPP = {
  ...CABECALHOS_C,
  initializer_list: INITIALIZER_LIST,
  string: STRING,
  iostream: IOSTREAM,
  iomanip: '#pragma once\n#include <iostream>\n',
  vector: VECTOR,
  exception: EXCEPTION,
  stdexcept: STDEXCEPT,
  ...CABECALHOS_STL,
  cassert: CASSERT,
  // (uma pasta é um objeto, para o clang do WebAssembly)
  bits: { 'stdc++.h': `#pragma once\n${TODOS_OS_CABECALHOS.map((c) => `#include <${c}>`).join('\n')}\n` },
  cstddef: '#pragma once\n#include <stddef.h>\nnamespace std { using ::size_t; }\n',
  climits: '#pragma once\n#include <limits.h>\n',
  cstdint: '#pragma once\n#include <stdint.h>\n',
  ...Object.fromEntries(Object.entries(NOMES_C).map(([c, nomes]) => [c, envolver(c.slice(1), nomes)])),
}

// O que pode perder as funções e classes que o programa não usa (ver sob-medida.js).
const PODAVEIS = ['__base', 'utility', 'algorithm', 'numeric', 'tuple', 'functional', 'memory', 'limits']

// <bits/stdc++.h>: os cabeçalhos leves sempre; os outros, se algum dos nomes deles aparece no programa.
const SEMPRE_NO_BITS = ['cstdio', 'cstdlib', 'cstring', 'cmath', 'cctype', 'ctime', 'climits', 'cstdint', 'cstddef',
  'iostream', 'iomanip', 'string', 'vector', 'algorithm', 'utility']
const NOMES_NO_BITS = {
  numeric: ['accumulate', 'iota', 'gcd', 'lcm', 'partial_sum', 'inner_product', 'adjacent_difference'],
  sstream: ['stringstream', 'istringstream', 'ostringstream'],
  tuple: ['tuple', 'tie', 'make_tuple', 'get'],
  functional: ['function', 'hash'],
  map: ['map', 'multimap'],
  set: ['set', 'multiset'],
  unordered_map: ['unordered_map', 'unordered_multimap'],
  unordered_set: ['unordered_set', 'unordered_multiset'],
  list: ['list'],
  deque: ['deque'],
  queue: ['queue', 'priority_queue'],
  stack: ['stack'],
  array: ['array'],
  memory: ['unique_ptr', 'shared_ptr', 'make_unique', 'make_shared'],
  limits: ['numeric_limits', 'streamsize'],
  stdexcept: ['exception', 'logic_error', 'runtime_error', 'invalid_argument', 'out_of_range', 'length_error', 'domain_error',
    'range_error', 'overflow_error', 'underflow_error', 'what'],
}

/** Os cabeçalhos do C++ só com o que este programa usa (o JSON do clang fica menor e sai mais rápido). */
export function cabecalhosCppPara(fonte) {
  return cabecalhosSobMedida(fonte, CABECALHOS_CPP, PODAVEIS, (usados) => [
    ...SEMPRE_NO_BITS, ...Object.keys(NOMES_NO_BITS).filter((c) => NOMES_NO_BITS[c].some((n) => usados.has(n))),
  ].filter((c) => TODOS_OS_CABECALHOS.includes(c)))
}
