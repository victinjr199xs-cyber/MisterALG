// Cabeçalhos mínimos do C++ para o passo a passo. string e vector são classes de
// verdade na memória (ponteiro para os dados no heap, tamanho e capacidade), para o
// aluno ver como elas funcionam por dentro; os métodos são feitos em biblioteca-cpp.js.

import { CABECALHOS_C } from './cabecalhos.js'

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
namespace std {
class string {
  char *__dados;
  size_t __tamanho;
  size_t __capacidade;
public:
  static const size_t npos = (size_t)-1;
  string();
  string(const char *s);
  string(const string &s);
  string(size_t n, char c);
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
  char &at(size_t i);
  char &front();
  char &back();
  const char *c_str() const;
  void push_back(char c);
  void pop_back();
  string substr(size_t pos, size_t n = npos) const;
  size_t find(const string &s, size_t pos = 0) const;
  size_t find(char c, size_t pos = 0) const;
  int compare(const string &s) const;
  string &append(const string &s);
  string &insert(size_t pos, const string &s);
  string &erase(size_t pos, size_t n = npos);
  char *begin();
  char *end();
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
string to_string(int v);
string to_string(long long v);
string to_string(double v);
int stoi(const string &s);
double stod(const string &s);
}
`

const IOSTREAM = `#pragma once
#include <string>
namespace std {
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
  explicit operator bool() const;
  bool operator!() const;
  istream &ignore(long n = 1, int ate = -1);
  int get();
  bool eof() const;
  bool fail() const;
  void clear();
};
extern ostream cout;
extern ostream cerr;
extern istream cin;
ostream &endl(ostream &o);
ostream &fixed(ostream &o);
ostream &defaultfloat(ostream &o);
istream &getline(istream &is, string &s);
istream &ws(istream &is);
__setprecision setprecision(int n);
__setw setw(int n);
__setfill setfill(char c);
}
`

const VECTOR = `#pragma once
#include <stddef.h>
#include <initializer_list>
namespace std {
template <class T> class vector {
  T *__dados;
  size_t __tamanho;
  size_t __capacidade;
public:
  vector();
  vector(size_t n);
  vector(size_t n, const T &valor);
  vector(initializer_list<T> lista);
  vector(const vector &outro);
  ~vector();
  vector &operator=(const vector &outro);
  void push_back(const T &x);
  void pop_back();
  size_t size() const;
  bool empty() const;
  void clear();
  void resize(size_t n);
  T &operator[](size_t i);
  T &at(size_t i);
  T &front();
  T &back();
  T *begin();
  T *end();
  T *data();
  void insert(T *pos, const T &x);
  void erase(T *pos);
};
}
`

const ALGORITHM = `#pragma once
namespace std {
template <class T> void swap(T &a, T &b);
template <class T> const T &max(const T &a, const T &b);
template <class T> const T &min(const T &a, const T &b);
template <class I> void sort(I inicio, I fim);
template <class I, class C> void sort(I inicio, I fim, C comparar);
template <class I> void reverse(I inicio, I fim);
template <class I, class T> I find(I inicio, I fim, const T &valor);
template <class I, class T> long count(I inicio, I fim, const T &valor);
template <class I> I max_element(I inicio, I fim);
template <class I> I min_element(I inicio, I fim);
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
  algorithm: ALGORITHM,
  exception: EXCEPTION,
  stdexcept: STDEXCEPT,
  utility: '#pragma once\n#include <algorithm>\n',
  cstddef: '#pragma once\n#include <stddef.h>\nnamespace std { using ::size_t; }\n',
  climits: '#pragma once\n#include <limits.h>\n',
  cstdint: '#pragma once\n#include <stdint.h>\n',
  ...Object.fromEntries(Object.entries(NOMES_C).map(([c, nomes]) => [c, envolver(c.slice(1), nomes)])),
}
