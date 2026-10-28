// Funções da biblioteca padrão no passo a passo. Cada uma é um gerador
// *(maquina, args, chamada) → valor, onde args são {valor, tipo} já convertidos
// pelo clang para os tipos dos parâmetros. Textos são "binários" (1 caractere = 1 byte).

import { ErroC, EXPLICACOES } from './erros.js'
import { escanear, formatar } from './formatos.js'
import { DOUBLE, INT, ponteiro } from './tipos.js'

const v = (args, i) => args[i]?.valor
const n = (args, i) => Number(args[i]?.valor)

/** Leitor de um texto que já está na memória (sscanf). */
const leitorDeTexto = (texto) => {
  let i = 0
  return {
    * espiar() { return i < texto.length ? texto.charCodeAt(i) : -1 },
    avancar() { i += 1 },
  }
}

/** Grava o valor lido pelo scanf no endereço passado, conforme o tipo do ponteiro. */
function gravadorDeScanf(m, args, primeiro) {
  return (indice, valor, conv) => {
    const arg = args[primeiro + indice]
    if (!arg) throw new ErroC('o scanf pede mais variáveis do que as que foram passadas')
    const destino = Number(arg.valor)
    if (destino === 0) throw new ErroC('o scanf recebeu um ponteiro NULL', 0, EXPLICACOES.nulo)
    if (conv === 's' || conv === '[') return m.mem.gravarCadeia(destino, valor)
    if (conv === 'c') return m.mem.gravarCadeia(destino, valor, false)
    const alvo = arg.tipo?.k === 'ptr' && arg.tipo.alvo.k !== 'void' ? arg.tipo.alvo : (typeof valor === 'bigint' ? INT : DOUBLE)
    m.mem.escrever(alvo, destino, m.converter(valor, typeof valor === 'bigint' ? { k: 'int', tamanho: 8, sinal: true } : DOUBLE, alvo))
  }
}

const matematica = (f) => function* (m, args) { return f(...args.map((a) => Number(a.valor))) }

function* comparar(m, a, b, limite = Infinity) {
  for (let i = 0; i < limite; i += 1) {
    m.mem.verificar(a + i, 1)
    m.mem.verificar(b + i, 1)
    const x = m.mem.bytes[a + i]
    const y = m.mem.bytes[b + i]
    if (x !== y) return x < y ? -1 : 1
    if (x === 0) return 0
  }
  return 0
}

export const BIBLIOTECA = {
  // ---- stdio ---------------------------------------------------------------------
  * printf(m, args) {
    const s = formatar(m.cadeia(v(args, 0)), args.slice(1), (e, p) => m.cadeia(e, p))
    m.saida(s)
    return s.length
  },
  * fprintf(m, args) {
    const s = formatar(m.cadeia(v(args, 1)), args.slice(2), (e, p) => m.cadeia(e, p))
    m.saida(s)
    return s.length
  },
  * sprintf(m, args) {
    const s = formatar(m.cadeia(v(args, 1)), args.slice(2), (e, p) => m.cadeia(e, p))
    m.mem.gravarCadeia(n(args, 0), s)
    return s.length
  },
  * snprintf(m, args) {
    const s = formatar(m.cadeia(v(args, 2)), args.slice(3), (e, p) => m.cadeia(e, p))
    const limite = n(args, 1)
    if (limite > 0) m.mem.gravarCadeia(n(args, 0), s.slice(0, limite - 1))
    return s.length
  },
  * puts(m, args) {
    m.saida(`${m.cadeia(v(args, 0))}\n`)
    return 1
  },
  * fputs(m, args) {
    m.saida(m.cadeia(v(args, 0)))
    return 1
  },
  * putchar(m, args) {
    m.saida(String.fromCharCode(n(args, 0) & 0xff))
    return n(args, 0) & 0xff
  },
  * fputc(m, args) { return yield* BIBLIOTECA.putchar(m, args) },
  * putc(m, args) { return yield* BIBLIOTECA.putchar(m, args) },
  * scanf(m, args) {
    return yield* escanear(m.leitor, m.cadeia(v(args, 0)), gravadorDeScanf(m, args, 1))
  },
  * sscanf(m, args) {
    return yield* escanear(leitorDeTexto(m.cadeia(v(args, 0))), m.cadeia(v(args, 1)), gravadorDeScanf(m, args, 2))
  },
  * getchar(m) {
    const c = yield* m.leitor.espiar()
    if (c !== -1) m.leitor.avancar()
    return c
  },
  * getc(m) { return yield* BIBLIOTECA.getchar(m) },
  * fgetc(m) { return yield* BIBLIOTECA.getchar(m) },
  * fgets(m, args) {
    const destino = n(args, 0)
    const max = n(args, 1)
    let texto = ''
    while (texto.length < max - 1) {
      const c = yield* m.leitor.espiar()
      if (c === -1) break
      m.leitor.avancar()
      texto += String.fromCharCode(c)
      if (c === 10) break
    }
    if (!texto) return 0
    m.mem.gravarCadeia(destino, texto)
    return destino
  },
  * gets(m, args) {
    let texto = ''
    for (;;) {
      const c = yield* m.leitor.espiar()
      if (c === -1) break
      m.leitor.avancar()
      if (c === 10) break
      texto += String.fromCharCode(c)
    }
    m.mem.gravarCadeia(n(args, 0), texto)
    return n(args, 0)
  },
  * fflush(m, args) {
    // fflush(stdin) não é C padrão, mas é muito usado para descartar o Enter que sobrou.
    if (n(args, 0) === m.arquivo('stdin')) m.leitor.descartarPendente()
    return 0
  },
  * feof(m) { return m.fimDaEntrada ? 1 : 0 },
  * ferror() { return 0 },
  * clearerr(m) { m.fimDaEntrada = false; return undefined },
  * setbuf() { return undefined },
  * perror(m, args) {
    m.saida(`${m.cadeia(v(args, 0))}: erro\n`)
    return undefined
  },

  // ---- stdlib -------------------------------------------------------------------
  * malloc(m, args) { return m.mem.malloc(n(args, 0)) },
  * calloc(m, args) { return m.mem.malloc(n(args, 0) * n(args, 1), true) },
  * realloc(m, args) {
    const antigo = n(args, 0)
    const tamanho = n(args, 1)
    if (antigo === 0) return m.mem.malloc(tamanho)
    const bloco = m.mem.blocoDoHeap(antigo)
    if (!bloco) { m.mem.free(antigo); return 0 } // dá a mensagem certa (não veio do malloc / já liberado)
    const novo = m.mem.malloc(tamanho, false, { tipoElem: bloco.tipoElem })
    if (novo) {
      m.mem.copiar(novo, antigo, Math.min(tamanho, bloco.tamanho))
      m.mem.free(antigo)
    }
    return novo
  },
  * free(m, args) {
    m.mem.free(n(args, 0))
    return undefined
  },
  * exit(m, args) { throw m.saidaDoPrograma(n(args, 0)) },
  * abort(m) { throw new ErroC('o programa chamou abort()') },
  * __misteralg_assert(m, args) {
    if (!n(args, 0)) throw new ErroC(`assert falhou: ${m.cadeia(v(args, 1))}`, 0, 'O assert confere uma condição que deveria ser sempre verdadeira; ela foi falsa nesta linha.')
    return undefined
  },
  * abs(m, args) { return Math.abs(n(args, 0)) | 0 },
  * labs(m, args) { return Math.abs(n(args, 0)) | 0 },
  * llabs(m, args) { const x = BigInt(v(args, 0)); return x < 0n ? -x : x },
  * atoi(m, args) { return Number.parseInt(m.cadeia(v(args, 0)).trim(), 10) | 0 || 0 },
  * atol(m, args) { return Number.parseInt(m.cadeia(v(args, 0)).trim(), 10) | 0 || 0 },
  * atof(m, args) { return Number.parseFloat(m.cadeia(v(args, 0)).trim()) || 0 },
  * strtol(m, args) {
    const texto = m.cadeia(v(args, 0))
    const base = n(args, 2) || 10
    const casou = /^\s*[+-]?[0-9a-zA-Z]*/.exec(texto)[0]
    const valor = Number.parseInt(casou, base)
    if (n(args, 1)) m.mem.escrever(ponteiro(ponteiro(INT)), n(args, 1), n(args, 0) + casou.length)
    return Number.isNaN(valor) ? 0 : valor | 0
  },
  * strtod(m, args) {
    const texto = m.cadeia(v(args, 0))
    const casou = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(texto)?.[0] ?? ''
    if (n(args, 1)) m.mem.escrever(ponteiro(ponteiro(INT)), n(args, 1), n(args, 0) + casou.length)
    return Number.parseFloat(casou) || 0
  },
  * rand(m) { return m.aleatorio() },
  * srand(m, args) {
    m.semearAleatorio(n(args, 0))
    return undefined
  },
  * system(m, args) {
    const comando = m.cadeia(v(args, 0)).trim().toLowerCase()
    if (comando === 'cls' || comando === 'clear') m.saida('\f')
    else if (comando === 'pause') {
      m.leitor.descartarPendente()
      m.saida('Pressione Enter para continuar. . . ')
      for (let c = yield* m.leitor.espiar(); c !== -1; c = yield* m.leitor.espiar()) {
        m.leitor.avancar()
        if (c === 10) break
      }
    }
    return 0
  },
  * qsort(m, args) {
    const base = n(args, 0)
    const quantidade = n(args, 1)
    const tamanho = n(args, 2)
    const comparador = n(args, 3)
    const itens = []
    for (let i = 0; i < quantidade; i += 1) itens.push(m.mem.lerBytes(base + i * tamanho, tamanho))
    // Ordenação por inserção chamando o comparador do aluno (ele roda no passo a passo também).
    const tmpA = m.rascunho(tamanho)
    const tmpB = m.rascunho(tamanho)
    for (let i = 1; i < itens.length; i += 1) {
      const atual = itens[i]
      let j = i - 1
      for (; j >= 0; j -= 1) {
        m.mem.gravarBytes(tmpA, itens[j])
        m.mem.gravarBytes(tmpB, atual)
        const r = yield* m.chamarPorEndereco(comparador, [tmpA, tmpB])
        if (Number(r) <= 0) break
        itens[j + 1] = itens[j]
      }
      itens[j + 1] = atual
    }
    itens.forEach((item, i) => m.mem.gravarBytes(base + i * tamanho, item))
    return undefined
  },

  // ---- string.h -----------------------------------------------------------------
  * strlen(m, args) { return m.cadeia(v(args, 0)).length },
  * strcpy(m, args) {
    m.mem.gravarCadeia(n(args, 0), m.cadeia(v(args, 1)))
    return n(args, 0)
  },
  * strncpy(m, args) {
    const s = m.cadeia(v(args, 1)).slice(0, n(args, 2))
    m.mem.gravarCadeia(n(args, 0), s, false)
    if (s.length < n(args, 2)) m.mem.preencher(n(args, 0) + s.length, 0, n(args, 2) - s.length)
    return n(args, 0)
  },
  * strcat(m, args) {
    const destino = m.cadeia(v(args, 0))
    m.mem.gravarCadeia(n(args, 0) + destino.length, m.cadeia(v(args, 1)))
    return n(args, 0)
  },
  * strncat(m, args) {
    const destino = m.cadeia(v(args, 0))
    m.mem.gravarCadeia(n(args, 0) + destino.length, m.cadeia(v(args, 1)).slice(0, n(args, 2)))
    return n(args, 0)
  },
  * strcmp(m, args) { return yield* comparar(m, n(args, 0), n(args, 1)) },
  * strncmp(m, args) { return yield* comparar(m, n(args, 0), n(args, 1), n(args, 2)) },
  * strchr(m, args) {
    const s = m.cadeia(v(args, 0))
    const c = n(args, 1) & 0xff
    const i = c === 0 ? s.length : s.indexOf(String.fromCharCode(c))
    return i < 0 ? 0 : n(args, 0) + i
  },
  * strrchr(m, args) {
    const s = m.cadeia(v(args, 0))
    const c = n(args, 1) & 0xff
    const i = c === 0 ? s.length : s.lastIndexOf(String.fromCharCode(c))
    return i < 0 ? 0 : n(args, 0) + i
  },
  * strcspn(m, args) {
    const s = m.cadeia(v(args, 0))
    const rej = m.cadeia(v(args, 1))
    let i = 0
    while (i < s.length && !rej.includes(s[i])) i += 1
    return i
  },
  * strspn(m, args) {
    const s = m.cadeia(v(args, 0))
    const ac = m.cadeia(v(args, 1))
    let i = 0
    while (i < s.length && ac.includes(s[i])) i += 1
    return i
  },
  * strstr(m, args) {
    const i = m.cadeia(v(args, 0)).indexOf(m.cadeia(v(args, 1)))
    return i < 0 ? 0 : n(args, 0) + i
  },
  * strtok(m, args) {
    const separadores = m.cadeia(v(args, 1))
    let inicio = n(args, 0) || m.estadoStrtok
    if (!inicio) return 0
    while (m.mem.bytes[inicio] && separadores.includes(String.fromCharCode(m.mem.bytes[inicio]))) inicio += 1
    if (!m.mem.bytes[inicio]) { m.estadoStrtok = 0; return 0 }
    let fim = inicio
    while (m.mem.bytes[fim] && !separadores.includes(String.fromCharCode(m.mem.bytes[fim]))) fim += 1
    if (m.mem.bytes[fim]) {
      m.mem.preencher(fim, 0, 1)
      m.estadoStrtok = fim + 1
    } else m.estadoStrtok = 0
    return inicio
  },
  * strdup(m, args) {
    const s = m.cadeia(v(args, 0))
    const novo = m.mem.malloc(s.length + 1)
    if (novo) m.mem.gravarCadeia(novo, s)
    return novo
  },
  * memset(m, args) {
    m.mem.preencher(n(args, 0), n(args, 1), n(args, 2))
    return n(args, 0)
  },
  * memcpy(m, args) {
    m.mem.copiar(n(args, 0), n(args, 1), n(args, 2))
    return n(args, 0)
  },
  * memmove(m, args) {
    m.mem.copiar(n(args, 0), n(args, 1), n(args, 2))
    return n(args, 0)
  },
  * memcmp(m, args) {
    const a = m.mem.lerBytes(n(args, 0), n(args, 2)).bytes
    const b = m.mem.lerBytes(n(args, 1), n(args, 2)).bytes
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
    return 0
  },

  // ---- ctype.h ------------------------------------------------------------------
  * isdigit(m, args) { return /[0-9]/.test(String.fromCharCode(n(args, 0))) ? 1 : 0 },
  * isalpha(m, args) { return /[A-Za-z]/.test(String.fromCharCode(n(args, 0))) ? 1 : 0 },
  * isalnum(m, args) { return /[A-Za-z0-9]/.test(String.fromCharCode(n(args, 0))) ? 1 : 0 },
  * isspace(m, args) { const c = n(args, 0); return c === 32 || (c >= 9 && c <= 13) ? 1 : 0 },
  * isupper(m, args) { return /[A-Z]/.test(String.fromCharCode(n(args, 0))) ? 1 : 0 },
  * islower(m, args) { return /[a-z]/.test(String.fromCharCode(n(args, 0))) ? 1 : 0 },
  * ispunct(m, args) { const c = n(args, 0); return c > 32 && c < 127 && !/[A-Za-z0-9]/.test(String.fromCharCode(c)) ? 1 : 0 },
  * isxdigit(m, args) { return /[0-9A-Fa-f]/.test(String.fromCharCode(n(args, 0))) ? 1 : 0 },
  * isprint(m, args) { const c = n(args, 0); return c >= 32 && c < 127 ? 1 : 0 },
  * toupper(m, args) { const c = n(args, 0); return c >= 97 && c <= 122 ? c - 32 : c },
  * tolower(m, args) { const c = n(args, 0); return c >= 65 && c <= 90 ? c + 32 : c },

  // ---- time.h, locale.h, conio.h, windows.h ---------------------------------------
  * time(m, args) {
    const agora = BigInt(Math.floor(m.agora() / 1000))
    if (n(args, 0)) m.mem.escrever({ k: 'int', tamanho: 8, sinal: true }, n(args, 0), agora)
    return agora
  },
  * clock(m) { return Math.floor((m.agora() - m.inicio) * 1000) },
  * difftime(m, args) { return Number(v(args, 0)) - Number(v(args, 1)) },
  * setlocale(m) { return m.textoFixo('C') },
  * getch(m) {
    m.leitor.descartarPendente()
    const c = yield* BIBLIOTECA.getchar(m)
    if (c !== 10 && c !== -1) m.leitor.descartarLinha()
    return c
  },
  * getche(m) { return yield* BIBLIOTECA.getch(m) },
  * kbhit(m) { return m.leitor.pendente() ? 1 : 0 },
  * clrscr(m) { m.saida('\f'); return undefined },
  * Sleep() { return undefined },
  * SetConsoleOutputCP() { return 1 },
  * SetConsoleCP() { return 1 },
}

// math.h: as versões com f (sqrtf...) fazem a mesma conta; o clang já converte para float.
const MATEMATICA = {
  sqrt: Math.sqrt, fabs: Math.abs, floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc,
  round: (x) => (x < 0 ? -Math.round(-x) : Math.round(x)),
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  exp: Math.exp, log: Math.log, log10: Math.log10, log2: Math.log2, cbrt: Math.cbrt,
  pow: Math.pow, atan2: Math.atan2, fmod: (x, y) => x % y, hypot: Math.hypot, fmin: Math.min, fmax: Math.max,
}
for (const [nome, f] of Object.entries(MATEMATICA)) {
  BIBLIOTECA[nome] = matematica(f)
  BIBLIOTECA[`${nome}f`] = matematica((...a) => Math.fround(f(...a)))
}
