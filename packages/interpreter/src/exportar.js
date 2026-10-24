// Exportadores "Exportar para > a Linguagem C / C++" e "... Java". Reaproveitam
// de pascal.js a inferência de tipos e o percurso da AST (GeradorPascal) e só
// trocam a sintaxe gerada. Comandos sem equivalente viram comentários.

import { analisar } from './parser.js'
import { GeradorPascal, extrairComentarios } from './pascal.js'

const INDENT = '  '

// Palavras reservadas (C e Java) e nomes que o código gerado usa.
const RESERVADAS = new Set(`
auto break case char const continue default do double else enum extern float for goto if inline int long
register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while
main printf scanf fgets puts putchar getchar abs fabs pow sqrt sin cos tan asin acos atan exp log log10 floor
ceil round rand srand time atoi atof strlen strcpy strcmp strcat strstr memcpy memset malloc free exit stdin
stdout stderr NULL EOF size_t FILE index div toupper tolower
abstract assert boolean byte catch class extends final finally implements import instanceof interface native
new package private protected public strictfp super synchronized this throw throws transient try true false
null var record String Math System Scanner Locale Arrays Object Integer Double Character Boolean List Map Set
args length
`.trim().split(/\s+/))

const ESC = { '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t' }
const texto = (s) => `"${s.replace(/[\\"\n\r\t]/g, (m) => ESC[m])}"`

/** Nome do Portugol → identificador C/Java válido (sem acento, sem reservada). */
function identificador(v) {
  let s = v.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9_]/g, '_')
  if (!/^[A-Za-z_]/.test(s)) s = '_' + s
  if (RESERVADAS.has(s) || /^mister/i.test(s)) s += '_'
  return s
}

const REL = { '=': '==', '<>': '!=', '<': '<', '>': '>', '<=': '<=', '>=': '>=' }
const PI = '3.14159265358979323846'

class GeradorCJ extends GeradorPascal {
  constructor(prog, comentarios, java) {
    super(prog, comentarios)
    this.java = java
    this.boxGlobal = new Set()
    this.boxLocal = new Set()
    this.tmp = 0
  }

  // ---- tipos ---------------------------------------------------------------------

  limite(no) {
    if (no.e === 'num') return String(no.v)
    if (no.e === 'id') return identificador(no.v)
    return '-' + this.limite(no.a)
  }

  tam([lo, hi]) {
    if (lo.e === 'num' && hi.e === 'num') return String(hi.v - lo.v + 1)
    return `${this.limite(hi)} - (${this.limite(lo)}) + 1`
  }

  baseC(t) {
    return { I: 'int', R: 'double', L: 'int' }[t.k] ?? identificador(t.v)
  }

  declC(t, nome) {
    if (t.k === 'V') {
      const d = t.dims.map((x) => `[${this.tam(x)}]`).join('')
      return t.elem.k === 'C' ? `char ${nome}${d}[256]` : `${this.baseC(t.elem)} ${nome}${d}`
    }
    return t.k === 'C' ? `char ${nome}[256]` : `${this.baseC(t)} ${nome}`
  }

  baseJ(t) {
    return { I: 'int', R: 'double', L: 'boolean', C: 'String' }[t.k] ?? identificador(t.v)
  }

  tipoJ(t) {
    return t.k === 'V' ? this.baseJ(t.elem) + '[]'.repeat(t.dims.length) : this.baseJ(t)
  }

  iniJ(t) {
    if (t.k === 'V') {
      const novo = `new ${this.baseJ(t.elem)}${t.dims.map((x) => `[${this.tam(x)}]`).join('')}`
      if (t.elem.k !== 'C' && t.elem.k !== 'G') return novo
      this.auxiliares.add('preencher')
      return `misterPreencher(${novo}, () -> ${t.elem.k === 'C' ? '""' : `new ${this.baseJ(t.elem)}()`})`
    }
    return { I: '0', R: '0.0', L: 'false', C: '""' }[t.k] ?? `new ${this.baseJ(t)}()`
  }

  /** Tipos passados por referência como ponteiro (C) ou caixa de 1 posição (Java). */
  refEscalar(t) {
    return (this.java ? ['I', 'R', 'L', 'C'] : ['I', 'R', 'L', 'G']).includes(t.k)
  }

  paramRef(n) {
    const par = this.subAtual?.params.find((p) => p.n === n)
    return Boolean(par?.porRef && this.refEscalar(this.resolver(par.tipo)))
  }

  /** Java: a variável é uma caixa (vetor de 1 posição) para poder ser passada por referência. */
  caixa(n) {
    if (this.paramRef(n)) return true
    return this.locais?.has(n) ? this.boxLocal.has(n) : this.boxGlobal.has(n)
  }

  /** Nomes de variáveis usadas como argumento de parâmetro escalar por referência. */
  caixasDe(arvore) {
    const nomes = new Set()
    this.percorrer(arvore, (no) => {
      const sub = (no.s === 'chamada' || no.e === 'call') && this.subs.get(no.n)
      if (sub) {
        ;(no.args ?? []).forEach((a, i) => {
          const par = sub.params[i]
          if (par?.porRef && this.refEscalar(this.resolver(par.tipo)) && a.e === 'id') nomes.add(a.n)
        })
      }
      return false
    })
    return nomes
  }

  nomesLocais(s) {
    return new Set([...s.params.map((x) => x.n), ...s.vars.flatMap((d) => d.nomes.map((x) => x.n))])
  }

  // ---- expressões ----------------------------------------------------------------

  inteiro(no) {
    const s = this.expr(no)
    return this.tipoDe(no).k === 'R' ? `(int)(${s})` : s
  }

  expr(no) {
    const J = this.java
    switch (no.e) {
      case 'num': return String(no.v)
      case 'str': return texto(no.v)
      case 'log': return J ? String(no.v) : no.v ? '1' : '0'
      case 'id': {
        if (this.procurarVar(no.n)) {
          const nome = identificador(no.v)
          if (J) return this.caixa(no.n) ? `${nome}[0]` : nome
          return this.paramRef(no.n) ? `(*${nome})` : nome
        }
        if (this.subs.has(no.n)) return `${identificador(no.v)}()`
        return this.embutida(no, [])
      }
      case 'call': {
        if (this.subs.has(no.n)) return `${identificador(no.v)}(${this.argumentos(this.subs.get(no.n), no.args)})`
        return this.embutida(no, no.args)
      }
      case 'idx': {
        const base = this.tipoDe(no.base)
        const dims = base.k === 'V' ? base.dims : []
        const indices = no.indices.map((i, k) => {
          const lo = dims[k]?.[0]
          return `[${lo && !(lo.e === 'num' && lo.v === 0) ? `${this.inteiro(i)} - ${this.limite(lo)}` : this.inteiro(i)}]`
        })
        return this.expr(no.base) + indices.join('')
      }
      case 'campo': {
        if (!J && no.base.e === 'id' && this.paramRef(no.base.n)) return `${identificador(no.base.v)}->${identificador(no.v)}`
        return `${this.expr(no.base)}.${identificador(no.v)}`
      }
      case 'un': {
        const a = this.operando(no.a)
        if (no.op === 'NAO') return `!${a}`
        if (no.op !== '-') return a
        return no.a.e === 'un' ? `-(${a})` : `-${a}`
      }
      case 'bin': return this.binario(no)
      default: return '0'
    }
  }

  binario(no) {
    const J = this.java
    const { op } = no
    const ta = this.tipoDe(no.a).k
    const tb = this.tipoDe(no.b).k
    const a = this.operando(no.a)
    const b = this.operando(no.b)
    if (REL[op]) {
      // O VisuAlg compara textos sem diferenciar maiúsculas.
      if (ta === 'C' && tb === 'C') {
        if (J) return `${a}.compareToIgnoreCase(${this.expr(no.b)}) ${REL[op]} 0`
        this.auxiliares.add('cmp')
        return `mister_cmp(${this.expr(no.a)}, ${this.expr(no.b)}) ${REL[op]} 0`
      }
      return `${a} ${REL[op]} ${b}`
    }
    switch (op) {
      case 'E': return `${a} && ${b}`
      case 'OU': return `${a} || ${b}`
      case 'XOU': return J ? `${a} ^ ${b}` : `!${a} != !${b}`
      case '\\':
      case '%': {
        const x = ta === 'R' ? `(int)(${this.expr(no.a)})` : a
        const y = tb === 'R' ? `(int)(${this.expr(no.b)})` : b
        return `${x} ${op === '\\' ? '/' : '%'} ${y}`
      }
      case '/': return ta === 'I' && tb === 'I' ? `(double)${a} / ${b}` : `${a} / ${b}`
      case '^': {
        const s = `${J ? 'Math.pow' : 'pow'}(${this.expr(no.a)}, ${this.expr(no.b)})`
        if (this.tipoDe(no).k !== 'I') return s
        return J ? `(int) Math.round(${s})` : `(int)round(${s})`
      }
      default:
        if (op === '+' && !J && this.tipoDe(no).k === 'C') {
          this.auxiliares.add('cat')
          return `mister_cat(${this.expr(no.a)}, ${this.expr(no.b)})`
        }
        return `${a} ${op} ${b}`
    }
  }

  /** Java: `gravar` recebe as caixas temporárias de elementos/campos, para gravar de volta depois da chamada. */
  argumentos(sub, args, gravar) {
    return args.map((a, i) => {
      const par = sub.params[i]
      if (!par) return this.expr(a)
      const tipo = this.resolver(par.tipo)
      if (!par.porRef) return this.copiaJ(this.convertida(a, tipo), tipo)
      if (!this.refEscalar(tipo)) return this.expr(a)
      if (!this.java) return `&${this.expr(a)}`
      if (a.e === 'id' && this.caixa(a.n)) return identificador(a.v)
      gravar ??= this.pend
      // fora de comando simples (ex.: condição de laço) o elemento/campo por referência não grava de volta.
      if (!gravar) return `new ${this.baseJ(tipo)}[]{${this.expr(a)}}`
      const t = `misterRef${++this.tmp}`
      gravar.push({ t, tipo: this.baseJ(tipo), alvo: this.expr(a) })
      return t
    }).join(', ')
  }

  /** Java: vetores e registros têm semântica de valor, então atribuição e passagem por valor copiam. */
  copiaJ(s, tipo) {
    if (!this.java || (tipo.k !== 'V' && tipo.k !== 'G')) return s
    this.auxiliares.add('clonar')
    return `misterClonar(${s})`
  }

  /** Funções pré-definidas do VisuAlg → equivalentes de C / Java. */
  embutida(no, args) {
    const J = this.java
    const x = args.map((a) => this.expr(a))
    const o = (i) => this.operando(args[i])
    const n = (i) => this.inteiro(args[i])
    const aux = (nome, s) => {
      this.auxiliares.add(nome)
      return s
    }
    const f = (c, j) => `${J ? `Math.${j ?? c}` : c}(${x[0]})`
    switch (no.n) {
      case 'ABS': return J ? f('', 'abs') : this.tipoDe(args[0]).k === 'I' ? `abs(${x[0]})` : `fabs(${x[0]})`
      case 'ARCCOS': return f('acos')
      case 'ARCSEN': return f('asin')
      case 'ARCTAN': return f('atan')
      case 'ASC': return J ? `(int) (${x[0]} + "\\0").charAt(0)` : `((unsigned char)${o(0)}[0])`
      case 'CARAC': return J ? `String.valueOf((char) (${n(0)}))` : aux('carac', `mister_carac(${n(0)})`)
      case 'CARACPNUM': return J ? `Double.parseDouble(${o(0)}.trim())` : `atof(${x[0]})`
      case 'COMPR': return J ? `${o(0)}.length()` : `(int)strlen(${x[0]})`
      case 'COPIA': return J ? aux('copia', `misterCopia(${x[0]}, ${n(1)}, ${n(2)})`) : aux('copia', `mister_copia(${x[0]}, ${n(1)}, ${n(2)})`)
      case 'COS': return f('cos')
      case 'COTAN': return `(1.0 / ${J ? 'Math.tan' : 'tan'}(${x[0]}))`
      case 'EXP': return `${J ? 'Math.pow' : 'pow'}(${x[0]}, ${x[1]})`
      case 'GRAUPRAD': return J ? `Math.toRadians(${x[0]})` : `(${x[0]} * ${PI} / 180)`
      case 'INT': return `(int)(${x[0]})`
      case 'LOG': return f('log10')
      case 'LOGN': return f('log')
      case 'MAIUSC': return J ? `${o(0)}.toUpperCase()` : aux('maiusc', `mister_maiusc(${x[0]})`)
      case 'MINUSC': return J ? `${o(0)}.toLowerCase()` : aux('minusc', `mister_minusc(${x[0]})`)
      case 'NUMPCARAC':
        if (this.tipoDe(args[0]).k === 'I') return J ? `String.valueOf(${x[0]})` : aux('int', `mister_int(${x[0]})`)
        return J ? aux('real', `misterReal(${x[0]})`) : aux('real', `mister_real(${x[0]})`)
      case 'PI': return J ? 'Math.PI' : PI
      case 'POS': return J ? `(${o(1)}.indexOf(${x[0]}) + 1)` : aux('pos', `mister_pos(${x[0]}, ${x[1]})`)
      case 'QUAD': return `${this.tipoDe(args[0]).k === 'I' ? '(int)' : ''}${J ? 'Math.pow' : 'pow'}(${x[0]}, 2)`
      case 'RADPGRAU': return J ? `Math.toDegrees(${x[0]})` : `(${x[0]} * 180 / ${PI})`
      case 'RAIZQ': return f('sqrt')
      case 'RAND':
        this.usaRandom = true
        return J ? 'Math.random()' : '((double)rand() / RAND_MAX)'
      case 'RANDI':
        this.usaRandom = true
        return J ? `(int) (Math.random() * (${n(0)}))` : `(rand() % (${n(0)}))`
      case 'SEN': return f('sin', 'sin')
      case 'TAN': return f('tan')
      default:
        return args.length ? `${identificador(no.v)}(${x.join(', ')})` : identificador(no.v)
    }
  }

  // ---- comandos ------------------------------------------------------------------

  sair() {
    return this.subAtual || this.java ? 'return;' : 'return 0;'
  }

  termina(cmds) {
    const u = cmds.at(-1)
    return u?.s === 'retorne' || Boolean(u?.s === 'se' && u.senao && this.termina(u.entao) && this.termina(u.senao))
  }

  /** Java: em comandos simples, elementos/campos passados por referência a funções são gravados de volta depois. */
  comando(c, nivel) {
    const anterior = this.pend
    this.pend = this.java && ['atrib', 'escreva', 'retorne'].includes(c.s) ? [] : undefined
    const linhas = this.comandoBase(c, nivel)
    const gravar = this.pend
    this.pend = anterior
    if (!gravar?.length) return linhas
    const p = INDENT.repeat(nivel)
    const q = p + INDENT
    const ret = c.s === 'retorne' && linhas[0].match(/^(\s*)return (.*);$/)
    const corpo = ret ? [`${q}var misterRet${++this.tmp} = ${ret[2]};`] : linhas.map((l) => INDENT + l)
    const fim = ret ? [`${q}return misterRet${this.tmp};`] : []
    return [`${p}{`, ...gravar.map((x) => `${q}${x.tipo}[] ${x.t} = {${x.alvo}};`), ...corpo, ...gravar.map((x) => `${q}${x.alvo} = ${x.t}[0];`), ...fim, `${p}}`]
  }

  comandoBase(c, nivel) {
    const p = INDENT.repeat(nivel)
    const J = this.java
    switch (c.s) {
      case 'atrib': {
        const destino = this.tipoDe(c.alvo)
        if (!J && destino.k === 'C') return [`${p}strcpy(${this.expr(c.alvo)}, ${this.expr(c.expr)});`]
        return [`${p}${this.expr(c.alvo)} = ${this.copiaJ(this.convertida(c.expr, destino), destino)};`]
      }
      case 'escreva': return this.escreva(c, p)
      case 'leia': return this.leia(c, p)
      case 'se': {
        const linhas = [`${p}if (${this.expr(c.cond)}) {`, ...this.bloco(c.entao, nivel + 1)]
        if (c.senao) linhas.push(`${p}} else {`, ...this.bloco(c.senao, nivel + 1))
        linhas.push(`${p}}`)
        return linhas
      }
      case 'escolha': return this.escolha(c, nivel)
      case 'para': return this.para(c, nivel)
      case 'enquanto': {
        this.lacos += 1
        const linhas = [`${p}while (${this.expr(c.cond)}) {`, ...this.bloco(c.corpo, nivel + 1), `${p}}`]
        this.lacos -= 1
        return linhas
      }
      case 'repita': {
        this.lacos += 1
        const linhas = [`${p}do {`, ...this.bloco(c.corpo, nivel + 1), `${p}} while (!(${c.cond ? this.expr(c.cond) : J ? 'false' : '0'}));`]
        this.lacos -= 1
        return linhas
      }
      case 'interrompa': return [this.lacos > 0 ? `${p}break;` : `${p}${this.sair()}`]
      case 'retorne': {
        if (this.subAtual?.tipo === 'funcao' && c.expr) {
          const destino = this.resolver(this.subAtual.retorno)
          let v = this.convertida(c.expr, destino)
          if (!J && destino.k === 'C') v = this.auxiliares.add('str') && `mister_str(${v})`
          return [`${p}return ${v};`]
        }
        return [`${p}${this.sair()}`]
      }
      case 'chamada': {
        const sub = this.subs.get(c.n)
        if (!sub) return [`${p}${this.embutida(c, c.args)};`]
        const gravar = J ? [] : undefined
        const chamada = `${identificador(c.v)}(${this.argumentos(sub, c.args, gravar)});`
        if (!gravar?.length) return [`${p}${chamada}`]
        const q = p + INDENT
        return [`${p}{`, ...gravar.map((x) => `${q}${x.tipo}[] ${x.t} = {${x.alvo}};`), `${q}${chamada}`, ...gravar.map((x) => `${q}${x.alvo} = ${x.t}[0];`), `${p}}`]
      }
      case 'mensagem': return this.escreva({ novaLinha: true, itens: [{ expr: c.expr }] }, p, true)
      default: return [`${p}// MisterALG: comando ${c.s} não tem equivalente em ${J ? 'Java' : 'C'}`]
    }
  }

  /** Um item do escreva descrito sem sintaxe (espaço antes de números, como no VisuAlg). */
  descrever(item, mensagem) {
    const e = item.expr
    const t = this.tipoDe(e).k
    const s = this.expr(e)
    const w = item.largura ? this.inteiro(item.largura) : null
    const d = item.decimais ? this.inteiro(item.decimais) : null
    const espaco = !w && !mensagem
    if (w && d && (t === 'I' || t === 'R')) return { tipo: 'f', codigo: t === 'I' ? `(double)(${s})` : s, w, d }
    if (t === 'I') return { tipo: 'd', codigo: s, w, espaco }
    if (t === 'R') {
      this.auxiliares.add('real')
      return { tipo: 's', codigo: this.java ? `misterReal(${s})` : `mister_real(${s})`, w, espaco }
    }
    if (t === 'L') return { tipo: 's', codigo: `(${s} ? "VERDADEIRO" : "FALSO")`, w, espaco }
    if (e.e === 'str' && !w) return { lit: e.v }
    return { tipo: 's', codigo: s, w }
  }

  escreva(c, p, mensagem = false) {
    const itens = c.itens.map((i) => this.descrever(i, mensagem))
    if (this.java) {
      const partes = []
      const lit = (s) => {
        if (partes.at(-1)?.lit !== undefined) partes.at(-1).lit += s
        else partes.push({ lit: s })
      }
      for (const it of itens) {
        if ('lit' in it) lit(it.lit)
        else {
          if (it.espaco) lit(' ')
          partes.push({ cod: this.formatoJava(it) })
        }
      }
      const cmd = c.novaLinha ? 'println' : 'print'
      if (!partes.length) return [`${p}System.out.${cmd}(${c.novaLinha ? '' : '""'});`]
      const cods = partes.map((x) => x.cod ?? texto(x.lit))
      if (partes[0].cod !== undefined) cods.unshift('""')
      return [`${p}System.out.${cmd}(${cods.join(' + ')});`]
    }
    let fmt = ''
    const args = []
    for (const it of itens) {
      if ('lit' in it) fmt += it.lit.replace(/%/g, '%%')
      else {
        if (it.espaco) fmt += ' '
        if (it.tipo === 'f') {
          fmt += '%*.*f'
          args.push(it.w, it.d)
        } else {
          fmt += `%${it.w ? '*' : ''}${it.tipo}`
          if (it.w) args.push(it.w)
        }
        args.push(it.codigo)
      }
    }
    if (c.novaLinha) fmt += '\n'
    if (!fmt) return []
    return [`${p}printf(${[texto(fmt), ...args].join(', ')});`]
  }

  formatoJava(it) {
    const larg = (v) => (/^\d+$/.test(v) ? v : `" + (${v}) + "`)
    if (it.tipo === 'f') return `String.format(Locale.ROOT, "%${larg(it.w)}.${larg(it.d)}f", ${it.codigo})`
    if (!it.w) return it.codigo
    return `String.format("%${larg(it.w)}${it.tipo === 'd' ? 'd' : 's'}", ${it.codigo})`
  }

  leia(c, p) {
    const J = this.java
    const linhas = []
    if (c.mensagem) linhas.push(...this.escreva({ itens: [{ expr: { e: 'str', v: c.mensagem.v } }] }, p, true))
    if (!c.alvos.length) {
      this.auxiliares.add('ler')
      linhas.push(J ? `${p}misterLerTexto();` : `${p}mister_ler();`)
    }
    for (const alvo of c.alvos) {
      const t = this.tipoDe(alvo).k
      const a = this.expr(alvo)
      this.auxiliares.add('ler')
      if (J) {
        this.auxiliares.add('ler' + t)
        linhas.push(`${p}${a} = misterLer${{ I: 'Int', R: 'Real', L: 'Logico', C: 'Texto' }[t]}();`)
      } else {
        linhas.push(`${p}mister_ler();`)
        linhas.push(`${p}${{
          I: `${a} = atoi(mister_linha);`,
          R: `${a} = atof(mister_linha);`,
          L: `${a} = (mister_linha[0] == 'V' || mister_linha[0] == 'v');`,
          C: `strcpy(${a}, mister_linha);`,
        }[t] ?? `${a} = atoi(mister_linha);`}`)
      }
    }
    return linhas
  }

  // O escolha vira if encadeado (o VisuAlg usa o primeiro caso que casar).
  escolha(c, nivel) {
    const p = INDENT.repeat(nivel)
    const alvo = c.expr
    const teste = (i) => {
      const cmp = (op, b) => this.expr({ e: 'bin', op, a: alvo, b, linha: c.linha })
      return i.b ? `${cmp('>=', i.a)} && ${cmp('<=', i.b)}` : cmp('=', i.a)
    }
    const linhas = []
    c.casos.forEach((caso, k) => {
      linhas.push(...this.comentariosAte(caso.linha - 1, nivel))
      const cond = caso.itens.map((i) => (caso.itens.length > 1 ? `(${teste(i)})` : teste(i))).join(' || ')
      linhas.push(`${p}${k === 0 ? '' : '} else '}if (${cond}) {`, ...this.bloco(caso.corpo, nivel + 1))
    })
    if (c.outro) linhas.push(c.casos.length ? `${p}} else {` : `${p}{`, ...this.bloco(c.outro, nivel + 1))
    if (linhas.length) linhas.push(`${p}}`)
    return linhas
  }

  para(c, nivel) {
    const p = INDENT.repeat(nivel)
    const v = this.expr({ e: 'id', n: c.variavel.n, v: c.variavel.v })
    const tipoVar = this.procurarVar(c.variavel.n)?.k
    let passo = 1
    if (c.passo) {
      const lit = c.passo.e === 'num' ? c.passo : c.passo.e === 'un' && c.passo.a.e === 'num' ? c.passo.a : null
      passo = lit && lit.t === 'I' ? (c.passo.e === 'un' && c.passo.op === '-' ? -lit.v : lit.v) : null
    }
    // O VisuAlg avalia o limite e o passo uma vez só, antes do laço.
    const antes = []
    const temp = (base, no) => {
      this.tmp += 1
      const nome = `mister${base}${this.tmp}`
      const real = this.tipoDe(no).k === 'R'
      antes.push(`${real ? 'double' : 'int'} ${nome} = ${this.expr(no)};`)
      return nome
    }
    const fim = this.constanteNoLaco(c.fim) ? this.expr(c.fim) : temp('Fim', c.fim)
    const ini = tipoVar === 'I' ? this.inteiro(c.inicio) : this.expr(c.inicio)
    let cond
    let inc
    if (passo === null) {
      const s = this.constanteNoLaco(c.passo) ? this.expr(c.passo) : temp('Passo', c.passo)
      cond = `(${s} > 0 ? ${v} <= ${fim} : ${v} >= ${fim})`
      inc = `${v} += ${s}`
    } else {
      cond = `${v} ${passo > 0 ? '<=' : '>='} ${fim}`
      inc = passo === 1 ? `${v}++` : passo === -1 ? `${v}--` : passo > 0 ? `${v} += ${passo}` : `${v} -= ${-passo}`
    }
    const q = antes.length ? nivel + 1 : nivel
    const pq = INDENT.repeat(q)
    this.lacos += 1
    const laco = [`${pq}for (${v} = ${ini}; ${cond}; ${inc}) {`, ...this.bloco(c.corpo, q + 1), `${pq}}`]
    this.lacos -= 1
    return antes.length ? [`${p}{`, ...antes.map((l) => pq + l), ...laco, `${p}}`] : laco
  }

  // ---- declarações ---------------------------------------------------------------

  declarar(decls, mapa, nivel, caixas, estatico = '') {
    const p = INDENT.repeat(nivel)
    const linhas = []
    for (const d of decls) {
      linhas.push(...this.comentariosAte(d.linha - 1, nivel))
      const tipo = this.resolver(d.tipo)
      for (const nome of d.nomes) {
        mapa.set(nome.n, tipo)
        const id = identificador(nome.v)
        if (this.java) {
          const caixa = caixas.has(nome.n)
          linhas.push(`${p}${estatico}${this.tipoJ(tipo)}${caixa ? '[]' : ''} ${id} = ${caixa ? `{${this.iniJ(tipo)}}` : this.iniJ(tipo)};`)
        } else {
          linhas.push(`${p}${this.declC(tipo, id)} = ${['I', 'R', 'L'].includes(tipo.k) ? '0' : '{0}'};`)
        }
      }
    }
    return linhas
  }

  tipoRetorno(t) {
    if (this.java) return this.tipoJ(t)
    return t.k === 'C' ? 'char *' : this.baseC(t)
  }

  cabecalhoSub(s) {
    const J = this.java
    const params = s.params.map((par) => {
      const tipo = this.resolver(par.tipo)
      const n = identificador(par.v)
      const ref = par.porRef && this.refEscalar(tipo)
      if (J) return ref ? `${this.tipoJ(tipo)}[] ${n}` : `${this.tipoJ(tipo)} ${this.boxLocal.has(par.n) ? n + '_v' : n}`
      if (ref) return `${this.baseC(tipo)} *${n}`
      if (tipo.k === 'C') return par.porRef ? `char *${n}` : `const char *${n}_v`
      return this.declC(tipo, n)
    })
    const ret = s.tipo === 'funcao' ? this.tipoRetorno(this.resolver(s.retorno)) : 'void'
    return `${J ? 'static ' : ''}${ret} ${identificador(s.v)}(${params.join(', ') || (J ? '' : 'void')})`
  }

  subprograma(s) {
    const J = this.java
    this.subAtual = s
    this.locais = new Map()
    this.lacos = 0
    const nomes = this.nomesLocais(s)
    this.boxLocal = J ? new Set([...this.caixasDe(s.corpo)].filter((n) => nomes.has(n))) : new Set()
    for (const par of s.params) this.locais.set(par.n, this.resolver(par.tipo))
    const linhas = [...this.comentariosAte(s.linha - 1, 0), `${this.cabecalhoSub(s)} {`]
    for (const par of s.params) {
      if (!J && !par.porRef && this.resolver(par.tipo).k === 'C') {
        const n = identificador(par.v)
        linhas.push(`${INDENT}char ${n}[1024];`, `${INDENT}snprintf(${n}, sizeof ${n}, "%s", ${n}_v);`)
      }
      if (J &&!par.porRef && this.boxLocal.has(par.n)) {
        const n = identificador(par.v)
        linhas.push(`${INDENT}${this.tipoJ(this.resolver(par.tipo))}[] ${n} = {${n}_v};`)
      }
    }
    linhas.push(...this.declarar(s.vars, this.locais, 1, this.boxLocal))
    linhas.push(...this.bloco(s.corpo, 1))
    linhas.push(...this.comentariosAte(s.linhaFim, 1))
    if (s.tipo === 'funcao' && !this.termina(s.corpo)) {
      const r = this.resolver(s.retorno)
      linhas.push(`${INDENT}return ${r.k === 'C' ? '""' : r.k === 'L' ? (J ? 'false' : '0') : '0'};`)
    }
    linhas.push('}', '')
    this.subAtual = null
    this.locais = null
    this.boxLocal = new Set()
    return linhas
  }

  // ---- programa ------------------------------------------------------------------

  gerar() {
    const { prog } = this
    const J = this.java
    const antesAlgoritmo = this.comentariosAte(Math.min(
      prog.linhaInicio,
      ...[...prog.consts, ...prog.tipos, ...prog.vars, ...prog.subs].map((d) => d.linha),
    ) - 1, 0)

    const consts = []
    for (const c of prog.consts) {
      consts.push(...this.comentariosAte(c.linha - 1, 0))
      const tipo = this.tipoDe(c.expr)
      const id = identificador(c.v)
      consts.push(J ? `static final ${this.tipoJ(tipo)} ${id} = ${this.expr(c.expr)};` : `#define ${id} (${this.expr(c.expr)})`)
      this.consts.set(c.n, tipo)
    }

    const registros = []
    for (const t of prog.tipos) {
      const campos = new Map()
      const linhas = []
      for (const d of t.campos) {
        const tipo = this.resolver(d.tipo)
        for (const nome of d.nomes) {
          campos.set(nome.n, tipo)
          const id = identificador(nome.v)
          linhas.push(`${INDENT}${J ? `${this.tipoJ(tipo)} ${id} = ${this.iniJ(tipo)}` : this.declC(tipo, id)};`)
        }
      }
      this.registros.set(t.n, { nome: t.v, campos })
      const nome = identificador(t.v)
      registros.push(...this.comentariosAte(t.linha - 1, 0), ...(J ? [`static class ${nome} {`, ...linhas, '}'] : ['typedef struct {', ...linhas, `} ${nome};`]), '')
    }

    for (const s of prog.subs) this.subs.set(s.n, s)
    if (J) {
      this.boxGlobal = this.caixasDe(prog.corpo)
      for (const s of prog.subs) {
        const nomes = this.nomesLocais(s)
        for (const n of this.caixasDe(s.corpo)) if (!nomes.has(n)) this.boxGlobal.add(n)
      }
    }
    const globais = this.declarar(prog.vars, this.globais, 0, this.boxGlobal, 'static ')
    const prototipos = J ? [] : prog.subs.map((s) => `${this.cabecalhoSub(s)};`)
    const subs = prog.subs.flatMap((s) => this.subprograma(s))

    this.subAtual = null
    this.locais = null
    this.lacos = 0
    const corpo = this.bloco(prog.corpo, 1)
    corpo.push(...this.comentariosAte(prog.linhaFim, 1))

    const rotulo = `"${prog.nome.replace(/[*/\r\n]/g, '')}"`
    const notas = []
    if (prog.dos) notas.push(`// MisterALG: comando dos não tem equivalente em ${J ? 'Java' : 'C'}`)
    if (prog.arquivo) notas.push(`// MisterALG: comando arquivo "${prog.arquivo.nome.replace(/[\r\n]/g, '')}" não tem equivalente (as leituras usam o teclado)`)
    const aux = this.textoAuxiliares()
    const main = J
      ? ['public static void main(String[] args) {', ...corpo, '}']
      : ['int main(void) {', ...(this.usaRandom ? [`${INDENT}srand((unsigned)time(NULL));`] : []), ...corpo, `${INDENT}return 0;`, '}']

    if (J) {
      const membros = [...consts, ...(consts.length ? [''] : []), ...registros, ...aux, ...globais, ...(globais.length ? [''] : []), ...subs, ...main]
      return [
        `// Programa gerado pelo MisterALG a partir do algoritmo ${rotulo} (Portugol / VisuAlg).`,
        `// Compile e execute: javac ${this.nomeClasse()}.java && java ${this.nomeClasse()}`,
        '',
        'import java.util.*;',
        '',
        ...(antesAlgoritmo.length ? [...antesAlgoritmo, ''] : []),
        ...notas,
        `public class ${this.nomeClasse()} {`,
        ...membros.map((l) => (l ? INDENT + l : l)),
        '}',
        '',
      ].join('\n')
    }
    return [
      `/* Programa gerado pelo MisterALG a partir do algoritmo ${rotulo} (Portugol / VisuAlg).`,
      '   Compile com: gcc arquivo.c -o programa -lm */',
      '',
      '#include <stdio.h>',
      '#include <stdlib.h>',
      '#include <string.h>',
      '#include <ctype.h>',
      '#include <math.h>',
      ...(this.usaRandom ? ['#include <time.h>'] : []),
      '',
      ...(antesAlgoritmo.length ? [...antesAlgoritmo, ''] : []),
      ...notas,
      ...consts,
      ...(consts.length ? [''] : []),
      ...registros,
      ...aux,
      ...globais,
      ...(globais.length ? [''] : []),
      ...prototipos,
      ...(prototipos.length ? [''] : []),
      ...subs,
      ...main,
      '',
    ].join('\n')
  }

  nomeClasse() {
    let s = identificador(this.prog.nome || 'semnome')
    s = s[0].toUpperCase() + s.slice(1)
    return RESERVADAS.has(s) ? s + '_' : s
  }

  textoAuxiliares() {
    const tem = (...ns) => ns.some((n) => this.auxiliares.has(n))
    const l = []
    if (this.java) {
      if (tem('ler')) {
        l.push('static final Scanner teclado = new Scanner(System.in);', '',
          'static String misterLerTexto() {', `${INDENT}return teclado.hasNextLine() ? teclado.nextLine() : "";`, '}', '')
      }
      if (tem('lerI')) l.push('static int misterLerInt() {', `${INDENT}return Integer.parseInt(misterLerTexto().trim());`, '}', '')
      if (tem('lerR')) l.push('static double misterLerReal() {', `${INDENT}return Double.parseDouble(misterLerTexto().trim().replace(',', '.'));`, '}', '')
      if (tem('lerL')) l.push('static boolean misterLerLogico() {', `${INDENT}return misterLerTexto().trim().toUpperCase().startsWith("V");`, '}', '')
      if (tem('real')) {
        l.push('// Real como o escreva do VisuAlg: até 10 casas, sem zeros à direita.', 'static String misterReal(double x) {',
          `${INDENT}String s = String.format(Locale.ROOT, "%.10f", x).replaceAll("0+$", "").replaceAll("\\\\.$", "");`,
          `${INDENT}return s.equals("-0") ? "0" : s;`, '}', '')
      }
      if (tem('copia')) {
        l.push('static String misterCopia(String s, int i, int n) {', `${INDENT}if (i < 1 || n < 1 || i > s.length()) return "";`,
          `${INDENT}return s.substring(i - 1, Math.min(s.length(), i - 1 + n));`, '}', '')
      }
      if (tem('clonar')) {
        const R = 'java.lang.reflect.Array'
        l.push('@SuppressWarnings("unchecked")', 'static <T> T misterClonar(T o) {',
          `${INDENT}if (o == null || o instanceof String || o instanceof Number || o instanceof Boolean) return o;`,
          `${INDENT}Class<?> c = o.getClass();`, `${INDENT}try {`,
          `${INDENT}${INDENT}if (c.isArray()) {`, `${INDENT}${INDENT}${INDENT}int n = ${R}.getLength(o);`,
          `${INDENT}${INDENT}${INDENT}Object r = ${R}.newInstance(c.getComponentType(), n);`,
          `${INDENT}${INDENT}${INDENT}for (int k = 0; k < n; k++) ${R}.set(r, k, misterClonar(${R}.get(o, k)));`,
          `${INDENT}${INDENT}${INDENT}return (T) r;`, `${INDENT}${INDENT}}`,
          `${INDENT}${INDENT}Object r = c.getDeclaredConstructor().newInstance();`,
          `${INDENT}${INDENT}for (java.lang.reflect.Field f : c.getDeclaredFields()) f.set(r, misterClonar(f.get(o)));`,
          `${INDENT}${INDENT}return (T) r;`, `${INDENT}} catch (Exception e) {`, `${INDENT}${INDENT}throw new RuntimeException(e);`, `${INDENT}}`, '}', '')
      }
      if (tem('preencher')) {
        l.push('static <T> T misterPreencher(T a, java.util.function.Supplier<?> f) {', `${INDENT}Object[] v = (Object[]) a;`,
          `${INDENT}for (int k = 0; k < v.length; k++) {`, `${INDENT}${INDENT}if (v[k] instanceof Object[]) misterPreencher(v[k], f);`,
          `${INDENT}${INDENT}else v[k] = f.get();`, `${INDENT}}`, `${INDENT}return a;`, '}', '')
      }
      return l
    }
    const strings = tem('cat', 'copia', 'maiusc', 'minusc', 'carac', 'real', 'int', 'str')
    if (strings) {
      l.push('static char *mister_buf(void) {', `${INDENT}static char b[16][1024];`, `${INDENT}static int k;`, `${INDENT}return b[k++ & 15];`, '}', '')
    }
    if (tem('str', 'maiusc', 'minusc')) {
      l.push('static char *mister_str(const char *a) {', `${INDENT}char *r = mister_buf();`, `${INDENT}snprintf(r, 1024, "%s", a);`, `${INDENT}return r;`, '}', '')
    }
    if (tem('cat')) {
      l.push('static char *mister_cat(const char *a, const char *b) {', `${INDENT}char *r = mister_buf();`, `${INDENT}snprintf(r, 1024, "%s%s", a, b);`, `${INDENT}return r;`, '}', '')
    }
    if (tem('copia')) {
      l.push('static char *mister_copia(const char *s, int i, int n) {', `${INDENT}char *r = mister_buf();`, `${INDENT}int t = (int)strlen(s);`,
        `${INDENT}if (i < 1 || n < 1 || i > t) { r[0] = 0; return r; }`, `${INDENT}if (n > t - i + 1) n = t - i + 1;`,
        `${INDENT}memcpy(r, s + i - 1, n);`, `${INDENT}r[n] = 0;`, `${INDENT}return r;`, '}', '')
    }
    for (const [nome, fn] of [['maiusc', 'toupper'], ['minusc', 'tolower']]) {
      if (tem(nome)) {
        l.push(`static char *mister_${nome}(const char *a) {`, `${INDENT}char *r = mister_str(a);`,
          `${INDENT}for (char *q = r; *q; q++) *q = (char)${fn}((unsigned char)*q);`, `${INDENT}return r;`, '}', '')
      }
    }
    if (tem('carac')) l.push('static char *mister_carac(int c) {', `${INDENT}char *r = mister_buf();`, `${INDENT}r[0] = (char)c;`, `${INDENT}r[1] = 0;`, `${INDENT}return r;`, '}', '')
    if (tem('int')) l.push('static char *mister_int(int x) {', `${INDENT}char *r = mister_buf();`, `${INDENT}snprintf(r, 1024, "%d", x);`, `${INDENT}return r;`, '}', '')
    if (tem('real')) {
      l.push('/* Real como o escreva do VisuAlg: até 10 casas, sem zeros à direita. */', 'static char *mister_real(double x) {',
        `${INDENT}char *r = mister_buf();`, `${INDENT}snprintf(r, 1024, "%.10f", x);`, `${INDENT}char *q = r + strlen(r) - 1;`,
        `${INDENT}while (*q == '0') *q-- = 0;`, `${INDENT}if (*q == '.') *q = 0;`, `${INDENT}if (!strcmp(r, "-0")) strcpy(r, "0");`, `${INDENT}return r;`, '}', '')
    }
    if (tem('pos')) l.push('static int mister_pos(const char *s, const char *t) {', `${INDENT}const char *q = strstr(t, s);`, `${INDENT}return q ? (int)(q - t) + 1 : 0;`, '}', '')
    if (tem('cmp')) {
      l.push('/* Compara textos sem diferenciar maiúsculas, como o VisuAlg. */', 'static int mister_cmp(const char *a, const char *b) {',
        `${INDENT}while (*a && tolower((unsigned char)*a) == tolower((unsigned char)*b)) { a++; b++; }`,
        `${INDENT}return tolower((unsigned char)*a) - tolower((unsigned char)*b);`, '}', '')
    }
    if (tem('ler')) {
      l.push('static char mister_linha[1024];', '', 'static void mister_ler(void) {',
        `${INDENT}if (!fgets(mister_linha, sizeof mister_linha, stdin)) mister_linha[0] = 0;`,
        `${INDENT}mister_linha[strcspn(mister_linha, "\\r\\n")] = 0;`, '}', '')
    }
    return l
  }
}

/** Gera o programa C equivalente. @throws ErroVisualg se houver erro de sintaxe */
export function gerarC(fonte) {
  return { codigo: new GeradorCJ(analisar(fonte), extrairComentarios(fonte), false).gerar() }
}

/** Gera o programa Java equivalente (classe pública `classe`, arquivo classe.java). */
export function gerarJava(fonte) {
  const g = new GeradorCJ(analisar(fonte), extrairComentarios(fonte), true)
  return { codigo: g.gerar(), classe: g.nomeClasse() }
}
