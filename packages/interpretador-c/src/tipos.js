// Tipos do C a partir do texto que o clang põe em "qualType" ("int *[3]",
// "struct Ponto", "const char *", "void *(*)(int)"), com tamanhos e alinhamentos
// do wasm32 (o mesmo alvo do F9): int e long têm 4 bytes, ponteiros também.

import { ErroC } from './erros.js'

const inteiro = (nome, tamanho, sinal) => ({ k: 'int', nome, tamanho, alinhamento: tamanho, sinal })
const real = (nome, tamanho, alinhamento = tamanho) => ({ k: 'real', nome, tamanho, alinhamento })

export const VOID = { k: 'void', nome: 'void', tamanho: 1, alinhamento: 1 }
export const BOOL = { k: 'int', nome: '_Bool', tamanho: 1, alinhamento: 1, sinal: false, bool: true }
export const INT = inteiro('int', 4, true)
export const UINT = inteiro('unsigned int', 4, false)
export const CHAR = inteiro('char', 1, true)
export const LONG_LONG = inteiro('long long', 8, true)
export const DOUBLE = real('double', 8)
export const SIZE_T = inteiro('unsigned long', 4, false)

// Palavras do tipo básico, já normalizadas (sem const/volatile e em ordem fixa).
const BASICOS = new Map([
  ['void', VOID],
  ['_Bool', BOOL], ['bool', BOOL],
  ['char', CHAR], ['signed char', inteiro('signed char', 1, true)], ['unsigned char', inteiro('unsigned char', 1, false)],
  ['short', inteiro('short', 2, true)], ['unsigned short', inteiro('unsigned short', 2, false)],
  ['int', INT], ['unsigned int', UINT],
  ['long', inteiro('long', 4, true)], ['unsigned long', SIZE_T],
  ['long long', LONG_LONG], ['unsigned long long', inteiro('unsigned long long', 8, false)],
  ['float', real('float', 4)], ['double', DOUBLE], ['long double', real('long double', 16, 16)],
  // Tipos que o próprio clang define (o resultado do sizeof vira __size_t).
  ['__size_t', SIZE_T], ['__ptrdiff_t', inteiro('long', 4, true)], ['__int128', inteiro('__int128', 16, true)],
  ['char16_t', inteiro('char16_t', 2, false)], ['char32_t', inteiro('char32_t', 4, false)], ['wchar_t', inteiro('wchar_t', 4, true)],
])

const QUALIFICADORES = new Set(['const', 'volatile', 'restrict', '__restrict', 'static', 'extern', 'register', 'inline', 'signed'])

/** Pega o nome canônico de um tipo básico a partir das palavras ("long unsigned int" → "unsigned long"). */
function normalizarBasico(palavras) {
  const semSinal = palavras.includes('unsigned')
  const resto = palavras.filter((p) => p !== 'unsigned' && p !== 'signed')
  const longs = resto.filter((p) => p === 'long').length
  let base
  if (resto.includes('char')) base = palavras.includes('signed') ? 'signed char' : 'char'
  else if (resto.includes('short')) base = 'short'
  else if (resto.includes('double')) base = longs ? 'long double' : 'double'
  else if (longs === 2) base = 'long long'
  else if (longs === 1) base = 'long'
  else if (resto.length === 0 || resto.includes('int')) base = 'int'
  else base = resto.join(' ')
  if (semSinal && base !== 'signed char') base = base === 'char' ? 'unsigned char' : `unsigned ${base}`
  return base
}

const ehBasica = (p) => ['void', '_Bool', 'bool', 'char', 'short', 'int', 'long', 'float', 'double', 'unsigned', 'signed'].includes(p)

export const ponteiro = (alvo) => ({ k: 'ptr', alvo, tamanho: 4, alinhamento: 4, nome: `${alvo.nome} *` })
export const vetor = (elem, n) => ({ k: 'array', elem, n, get tamanho() { return n === null ? 0 : n * tamanhoDe(elem) }, get alinhamento() { return alinhamentoDe(elem) }, nome: `${elem.nome}[${n ?? ''}]` })
const funcao = (ret, params, variadica) => ({ k: 'func', ret, params, variadica, tamanho: 1, alinhamento: 1, nome: `${ret.nome} (${params.map((p) => p.nome).join(', ')})` })
const referencia = (alvo) => ({ k: 'ref', alvo, tamanho: 4, alinhamento: 4, nome: `${alvo.nome} &` })

export function tamanhoDe(t) {
  if (t.k === 'struct') return layout(t).tamanho
  return t.tamanho
}
export function alinhamentoDe(t) {
  if (t.k === 'struct') return layout(t).alinhamento
  return t.alinhamento
}

/** Campos de uma struct/union com o deslocamento de cada um (calculado uma vez). */
export function layout(t) {
  if (t.calculado) return t.calculado
  if (!t.decl) throw new ErroC(`o tipo "${t.nome}" é usado antes de ser definido`)
  t.calculado = { tamanho: 0, alinhamento: 1, campos: [] } // contra recursão (struct com ponteiro para ela mesma)
  let deslocamento = 0
  let alinhamento = 1
  const campos = []
  // C++: a classe polimórfica mais de base guarda no começo o tipo dinâmico do objeto (o "vptr");
  // depois vêm as classes base, cada uma como um pedaço do objeto.
  if (t.decl.vptr) {
    campos.push({ nome: '__vptr', tipo: INT, deslocamento: 0, oculto: true })
    deslocamento = 4
    alinhamento = 4
  }
  for (const textoBase of t.decl.bases ?? []) {
    const tipo = t.tipos.de(textoBase)
    const a = alinhamentoDe(tipo)
    alinhamento = Math.max(alinhamento, a)
    deslocamento = alinhar(deslocamento, a)
    campos.push({ nome: tipo.rotulo, tipo, deslocamento, base: true })
    deslocamento += tamanhoDe(tipo)
  }
  for (const c of t.decl.campos) {
    const tipo = t.tipos.de(c.tipo)
    const a = alinhamentoDe(tipo)
    alinhamento = Math.max(alinhamento, a)
    if (t.uniao) campos.push({ nome: c.nome, tipo, deslocamento: 0 })
    else {
      deslocamento = alinhar(deslocamento, a)
      campos.push({ nome: c.nome, tipo, deslocamento })
      deslocamento += tamanhoDe(tipo)
    }
  }
  const tamanho = t.uniao ? Math.max(0, ...campos.map((c) => tamanhoDe(c.tipo))) : Math.max(deslocamento, t.decl.cpp ? 1 : 0)
  t.calculado = { tamanho: alinhar(tamanho, alinhamento), alinhamento, campos }
  return t.calculado
}

export const alinhar = (n, a) => Math.ceil(n / a) * a

export const ehInteiro = (t) => t.k === 'int' || t.k === 'enum'
export const ehReal = (t) => t.k === 'real'
export const ehAritmetico = (t) => ehInteiro(t) || ehReal(t)
export const ehEscalar = (t) => ehAritmetico(t) || t.k === 'ptr'
export const ehAgregado = (t) => t.k === 'struct' || t.k === 'array'

// ---- leitor de tipos ---------------------------------------------------------------

const ANONIMO = /\((?:unnamed|anonymous) (struct|union|enum|class) at [^)]*?:(\d+):(\d+)\)/g

/** "std::vector<std::string>" → "vector<string>"; "nullptr_t" vira ponteiro. */
export const normalizarNomeCpp = (texto) => texto.replace(/\bstd::/g, '').replace(/\bdecltype\(nullptr\)|\bnullptr_t\b/g, 'void *')

/** Chave de uma especialização ("vector", ["int"]) → "vector<int>", igual à que o leitor de tipos monta. */
export function chaveDeTemplate(nome, argumentos) {
  const canonico = (texto) => (normalizarNomeCpp(texto).match(/::|\.\.\.|&&|[A-Za-z_]\w*|\d+|[*&()[\],<>]/g) ?? [])
    .reduce((s, f) => s + (/^\w/.test(f) && /\w$/.test(s) ? ' ' : '') + f, '')
  return `${nome}<${argumentos.map(canonico).join(',')}>`
}

export class Tipos {
  /**
   * @param registros Map nome → { campos: [{nome, tipo}], uniao } (structs/unions)
   * @param apelidos Map nome do typedef → texto do tipo
   */
  constructor(registros = new Map(), apelidos = new Map()) {
    this.registros = registros
    this.apelidos = apelidos
    this.cache = new Map()
    this.structs = new Map()
  }

  /** Tipo a partir do objeto "type" do clang ({qualType, desugaredQualType}) ou do texto. */
  de(tipo) {
    const texto = typeof tipo === 'string' ? tipo : (tipo.qualType ?? tipo.desugaredQualType)
    let t = this.cache.get(texto)
    if (!t) {
      t = this.ler(texto)
      this.cache.set(texto, t)
    }
    return t
  }

  struct(nome, uniao) {
    let t = this.structs.get(nome)
    if (!t) {
      t = {
        k: 'struct', rotulo: nome, uniao, tipos: this,
        get decl() { return this.tipos.registros.get(nome) },
        // No C++ a classe se chama só pelo nome (Cao); no C, "struct Ponto".
        get nome() { return this.decl?.cpp ? nome : `${uniao ? 'union' : 'struct'} ${nome}` },
      }
      this.structs.set(nome, t)
    }
    return t
  }

  ler(texto) {
    const fichas = normalizarNomeCpp(texto.replace(ANONIMO, (_m, _tipo, l, c) => `__anon_${l}_${c}`))
      .match(/::|\.\.\.|&&|[A-Za-z_][\w]*|\d+|[*&()[\],<>]/g) ?? []
    let i = 0
    const ver = () => fichas[i]
    // "<" ... ">" de um template, como texto canônico ("<int>", "<vector<int>>", "<unsigned int>").
    this.argumentosDeTemplate = () => {
      let profundidade = 0
      let s = ''
      do {
        const f = fichas[i++]
        if (f === undefined) break
        if (f === '<') profundidade += 1
        else if (f === '>') profundidade -= 1
        if (/^\w/.test(f) && /\w$/.test(s)) s += ' '
        s += f
      } while (profundidade > 0)
      return s
    }
    const comer = (f) => {
      if (fichas[i] !== f) throw new ErroC(`tipo que o passo a passo não entende: ${texto}`)
      i += 1
    }

    const base = () => {
      const palavras = []
      let tag = null
      for (;;) {
        const f = ver()
        if (f === undefined) break
        if (QUALIFICADORES.has(f) && f !== 'signed') { i += 1; continue }
        if (['struct', 'union', 'enum', 'class'].includes(f)) {
          i += 1
          tag = { tipo: f, nome: fichas[i] }
          i += 1
          continue
        }
        if (ehBasica(f)) { palavras.push(f); i += 1; continue }
        if (/^[A-Za-z_]/.test(f) && !palavras.length && !tag) {
          // Nome do C++: pode ter "::" e argumentos de template ("vector<int>", "Pilha<string>::No").
          let nome = f
          i += 1
          for (;;) {
            if (fichas[i] === '<') nome += this.argumentosDeTemplate()
            else if (fichas[i] === '::' && /^[A-Za-z_]/.test(fichas[i + 1] ?? '')) { nome = fichas[i + 1]; i += 2 }
            else break
          }
          tag = { tipo: this.registros.has(nome) || nome.includes('<') ? 'struct' : 'apelido', nome }
          continue
        }
        break
      }
      if (tag?.tipo === 'enum') return { ...INT, nome: `enum ${tag.nome}`, k: 'int' }
      if (tag?.tipo === 'struct' || tag?.tipo === 'class' || tag?.tipo === 'union') return this.struct(tag.nome, tag.tipo === 'union')
      if (tag?.tipo === 'apelido') {
        const basico = BASICOS.get(tag.nome)
        if (basico) return basico
        const alvo = this.apelidos.get(tag.nome)
        if (alvo === undefined) return this.struct(tag.nome, false) // classe só declarada (ou definida depois)
        return this.de(alvo) // o mesmo objeto: tipos iguais continuam iguais (===)
      }
      const nome = normalizarBasico(palavras)
      const t = BASICOS.get(nome)
      if (!t) throw new ErroC(`tipo que o passo a passo não entende: ${texto}`)
      return t
    }

    const parametros = () => {
      const lista = []
      let variadica = false
      if (ver() === ')') return { lista, variadica }
      for (;;) {
        if (ver() === '...') { i += 1; variadica = true; break }
        const b = base() // antes do declarador: em f()(x) o JS avalia f() primeiro
        const t = declarador()(b)
        if (!(t.k === 'void' && lista.length === 0 && ver() === ')')) lista.push(t.k === 'array' ? ponteiro(t.elem) : t)
        if (ver() !== ',') break
        i += 1
      }
      return { lista, variadica }
    }

    // Declarador abstrato: "*", "[3]", "(*)[3]", "(int, char *)"... devolve a função que monta o tipo.
    const declarador = () => {
      const prefixos = []
      while (ver() === '*' || ver() === '&' || ver() === '&&') {
        prefixos.push(fichas[i])
        i += 1
        while (QUALIFICADORES.has(ver())) i += 1
      }
      let interno = (t) => t
      if (ver() === '(' && ['*', '&', '&&', '(', '['].includes(fichas[i + 1])) {
        i += 1
        interno = declarador()
        comer(')')
      }
      const sufixos = []
      while (ver() === '[' || ver() === '(') {
        if (ver() === '[') {
          i += 1
          let n = null
          if (/^\d+$/.test(ver())) { n = Number(ver()); i += 1 }
          comer(']')
          sufixos.push((t) => vetor(t, n))
        } else {
          i += 1
          const { lista, variadica } = parametros()
          comer(')')
          while (['const', 'noexcept', 'volatile', 'override', 'final'].includes(ver())) i += 1 // métodos: "double () const"
          sufixos.push((t) => funcao(t, lista, variadica))
        }
      }
      return (t) => {
        for (const p of prefixos) t = p === '*' ? ponteiro(t) : referencia(t)
        for (let j = sufixos.length - 1; j >= 0; j -= 1) t = sufixos[j](t)
        return interno(t)
      }
    }

    const b = base()
    return declarador()(b)
  }
}
