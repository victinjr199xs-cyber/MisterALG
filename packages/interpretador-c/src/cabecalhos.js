// Cabeçalhos mínimos para o passo a passo (F8). O clang analisa o programa com eles
// (-nostdinc) em vez dos da biblioteca de verdade: a árvore fica pequena, e cada função
// declarada aqui tem uma versão em biblioteca.js. Se o programa usar algo que não está
// aqui, o clang acusa, e a IDE sugere rodar com F9 (que tem a biblioteca completa).

/** Argumentos do clang para gerar a árvore do passo a passo (os mesmos no app e nos testes). */
export const ARGUMENTOS_AST_C = [
  'clang', '-fsyntax-only', '-nostdinc', '-isystem', 'mini', '-std=gnu17', '-fno-color-diagnostics',
  '-Xclang', '-ast-dump=json', 'programa.c',
]

const STDDEF = `#pragma once
typedef unsigned long size_t;
typedef long ptrdiff_t;
#define NULL ((void*)0)
#define offsetof(t, m) __builtin_offsetof(t, m)
`

export const CABECALHOS_C = {
  'stddef.h': STDDEF,
  'stdio.h': `#pragma once
#include <stddef.h>
typedef struct FILE FILE;
extern FILE *stdin, *stdout, *stderr;
#define EOF (-1)
int printf(const char *formato, ...);
int scanf(const char *formato, ...);
int puts(const char *texto);
int putchar(int c);
int getchar(void);
char *fgets(char *texto, int tamanho, FILE *arquivo);
char *gets(char *texto);
int fputs(const char *texto, FILE *arquivo);
int fputc(int c, FILE *arquivo);
int putc(int c, FILE *arquivo);
int getc(FILE *arquivo);
int fgetc(FILE *arquivo);
int fprintf(FILE *arquivo, const char *formato, ...);
int sprintf(char *destino, const char *formato, ...);
int snprintf(char *destino, size_t tamanho, const char *formato, ...);
int sscanf(const char *texto, const char *formato, ...);
int fflush(FILE *arquivo);
int feof(FILE *arquivo);
int ferror(FILE *arquivo);
void clearerr(FILE *arquivo);
void setbuf(FILE *arquivo, char *buffer);
void perror(const char *texto);
`,
  'stdlib.h': `#pragma once
#include <stddef.h>
#define RAND_MAX 2147483647
#define EXIT_SUCCESS 0
#define EXIT_FAILURE 1
void *malloc(size_t tamanho);
void *calloc(size_t quantidade, size_t tamanho);
void *realloc(void *ponteiro, size_t tamanho);
void free(void *ponteiro);
void exit(int codigo);
void abort(void);
int abs(int x);
long labs(long x);
long long llabs(long long x);
int atoi(const char *texto);
long atol(const char *texto);
double atof(const char *texto);
long strtol(const char *texto, char **fim, int base);
double strtod(const char *texto, char **fim);
int rand(void);
void srand(unsigned int semente);
int system(const char *comando);
void qsort(void *base, size_t quantidade, size_t tamanho, int (*comparar)(const void *, const void *));
`,
  'string.h': `#pragma once
#include <stddef.h>
size_t strlen(const char *s);
char *strcpy(char *destino, const char *origem);
char *strncpy(char *destino, const char *origem, size_t n);
char *strcat(char *destino, const char *origem);
char *strncat(char *destino, const char *origem, size_t n);
int strcmp(const char *a, const char *b);
int strncmp(const char *a, const char *b, size_t n);
char *strchr(const char *s, int c);
char *strrchr(const char *s, int c);
char *strstr(const char *s, const char *procurado);
size_t strcspn(const char *s, const char *rejeitados);
size_t strspn(const char *s, const char *aceitos);
char *strtok(char *s, const char *separadores);
char *strdup(const char *s);
void *memset(void *destino, int valor, size_t n);
void *memcpy(void *destino, const void *origem, size_t n);
void *memmove(void *destino, const void *origem, size_t n);
int memcmp(const void *a, const void *b, size_t n);
`,
  'math.h': `#pragma once
#define M_PI 3.14159265358979323846
#define M_E 2.7182818284590452354
#define INFINITY (__builtin_inff())
#define NAN (__builtin_nanf(""))
${['sqrt', 'fabs', 'floor', 'ceil', 'round', 'trunc', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'log', 'log10', 'log2', 'cbrt']
    .map((f) => `double ${f}(double x);\nfloat ${f}f(float x);`).join('\n')}
${['pow', 'atan2', 'fmod', 'hypot', 'fmin', 'fmax'].map((f) => `double ${f}(double x, double y);\nfloat ${f}f(float x, float y);`).join('\n')}
`,
  'ctype.h': `#pragma once
${['isdigit', 'isalpha', 'isalnum', 'isspace', 'isupper', 'islower', 'ispunct', 'isxdigit', 'isprint', 'toupper', 'tolower']
    .map((f) => `int ${f}(int c);`).join('\n')}
`,
  'stdbool.h': '#pragma once\n#define bool _Bool\n#define true 1\n#define false 0\n',
  'limits.h': `#pragma once
#define CHAR_BIT 8
#define SCHAR_MIN (-128)
#define SCHAR_MAX 127
#define UCHAR_MAX 255
#define CHAR_MIN SCHAR_MIN
#define CHAR_MAX SCHAR_MAX
#define SHRT_MIN (-32768)
#define SHRT_MAX 32767
#define USHRT_MAX 65535
#define INT_MIN (-2147483647-1)
#define INT_MAX 2147483647
#define UINT_MAX 4294967295U
#define LONG_MIN (-2147483647L-1)
#define LONG_MAX 2147483647L
#define ULONG_MAX 4294967295UL
#define LLONG_MIN (-9223372036854775807LL-1)
#define LLONG_MAX 9223372036854775807LL
#define ULLONG_MAX 18446744073709551615ULL
`,
  'float.h': '#pragma once\n#define FLT_MAX 3.40282347e+38F\n#define DBL_MAX 1.7976931348623157e+308\n#define FLT_EPSILON 1.19209290e-7F\n#define DBL_EPSILON 2.2204460492503131e-16\n',
  'time.h': `#pragma once
#include <stddef.h>
typedef long long time_t;
typedef long clock_t;
#define CLOCKS_PER_SEC 1000000
time_t time(time_t *t);
clock_t clock(void);
double difftime(time_t fim, time_t inicio);
`,
  'stdint.h': `#pragma once
typedef signed char int8_t;
typedef short int16_t;
typedef int int32_t;
typedef long long int64_t;
typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned int uint32_t;
typedef unsigned long long uint64_t;
`,
  'locale.h': '#pragma once\n#define LC_ALL 6\n#define LC_CTYPE 0\nchar *setlocale(int categoria, const char *local);\n',
  'conio.h': '#pragma once\nint getch(void);\nint getche(void);\nint kbhit(void);\nvoid clrscr(void);\n',
  'windows.h': '#pragma once\n#define CP_UTF8 65001\nvoid Sleep(unsigned long ms);\nint SetConsoleOutputCP(unsigned int cp);\nint SetConsoleCP(unsigned int cp);\n',
  'assert.h': '#pragma once\nvoid __misteralg_assert(int ok, const char *expressao);\n#define assert(e) __misteralg_assert(!!(e), #e)\n',
  'stdarg.h': '#pragma once\n', // funções variádicas do aluno ainda não entram no passo a passo
}
