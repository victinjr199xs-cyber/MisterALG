// Exportador "Exportar para > a Linguagem Pascal" (o "Gerar Pascal" do
// VisuAlg). Percorre a AST de parser.js e gera um programa Free Pascal
// ({$mode objfpc}{$H+}) com a mesma semântica sempre que possível.
// Comandos sem equivalente viram comentários { MisterALG: ... }.

import { analisar } from './parser.js'

const INDENT = '  '

// Palavras reservadas do Pascal e nomes que o código gerado usa: um nome do
// programa que coincida com algum deles ganha o sufixo "_".
const RESERVADAS = new Set(`
and array as asm begin case class const constructor destructor div do downto else end except exports
file finalization finally for function goto if implementation in inherited initialization inline
interface is label library mod nil not object of on operator or out packed procedure program property
raise record repeat resourcestring self set shl shr string then threadvar to try type unit until uses
var while with xor absolute abstract false true result exit break continue halt write writeln read
readln length copy pos ord chr trunc round sqrt sqr abs power random randomize ln log10 sin cos tan
cotan arctan arccos arcsin pi inttostr floattostr comparetext degtorad radtodeg integer double
boolean real char byte word longint int64 frac exp str val uppercase lowercase upcase default sizeof
fillchar system sysutils math formatfloat booltostr high low inc dec succ pred odd specialize generic
dispose new objpas tformatsettings defaultformatsettings ansistring shortstring
misterfmtreal misterlerlogico mistercaracpnum trim strtofloat
`.trim().split(/\s+/))

const TIPO_PASCAL = { I: 'Integer', R: 'Double', C: 'String', L: 'Boolean' }

// Tipo devolvido pelas funções pré-definidas (null = depende do argumento).
const RETORNO_EMBUTIDA = {
  ABS: null, QUAD: null,
  INT: 'I', ASC: 'I', COMPR: 'I', POS: 'I', RANDI: 'I',
  CARAC: 'C', COPIA: 'C', MAIUSC: 'C', MINUSC: 'C', NUMPCARAC: 'C',
}

const SEM_EQUIVALENTE = new Set(['aleatorio', 'timer', 'eco', 'cronometro', 'pausa', 'limpatela', 'perfil', 'debug', 'mudacor', 'lista'])

/** Nome do Portugol → identificador Pascal válido (sem acento, sem reservada). */
function identificador(v) {
  let s = v.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9_]/g, '_')
  if (!/^[A-Za-z_]/.test(s)) s = '_' + s
  // misterfimN / misterpassoN: temporários dos laços para.
  if (RESERVADAS.has(s.toLowerCase()) || /^mister(fim|passo)\d+$/i.test(s)) s += '_'
  return s
}

const textoPascal = (s) => `'${s.replace(/'/g, "''")}'`

/** Comentários `//` do fonte, por linha (o lexer os descarta). */
export function extrairComentarios(fonte) {
  const mapa = new Map()
  String(fonte).replace(/\r\n?/g, '\n').split('\n').forEach((texto, i) => {
    let dentro = false
    for (let j = 0; j < texto.length; j += 1) {
      if (texto[j] === '"') dentro = !dentro
      else if (!dentro && texto[j] === '/' && texto[j + 1] === '/') {
        mapa.set(i + 1, { texto: texto.slice(j + 2).trimEnd(), sozinho: texto.slice(0, j).trim() === '' })
        break
      }
    }
  })
  return mapa
}

/**
 * Gera o programa Pascal equivalente.
 * @returns {{ codigo: string }}
 * @throws ErroVisualg se o programa tiver erro de sintaxe
 */
export function gerarPascal(fonte) {
  const prog = analisar(fonte)
  return { codigo: new GeradorPascal(prog, extrairComentarios(fonte)).gerar() }
}

export class GeradorPascal {
  constructor(prog, comentarios) {
    this.prog = prog
    this.comentarios = comentarios
    this.linhasComentadas = new Set()
    this.usaMath = false
    this.usaRandom = false
    this.auxiliares = new Set()
    this.registros = new Map() // n → { nome, campos: Map(n → tipo resolvido) }
    this.consts = new Map() // n → tipo resolvido
    this.globais = new Map() // n → tipo resolvido
    this.subs = new Map()
    this.locais = null
    this.subAtual = null
    this.lacos = 0
    this.tiposVetor = new Map() // assinatura → nome
    this.declTipos = []
    this.temporarios = [] // declarações dos temporários do subprograma atual
    this.contTemp = 0
    this.corpoAtual = null
  }

  // ---- comentários -----------------------------------------------------------

  /** Devolve as linhas `// ...` dos comentários até a linha `ate`. */
  comentariosAte(ate, nivel) {
    const saida = []
    for (const [linha, c] of [...this.comentarios].sort((a, b) => a[0] - b[0])) {
      if (linha > ate) break
      if (this.linhasComentadas.has(linha)) continue
      this.linhasComentadas.add(linha)
      saida.push(INDENT.repeat(nivel) + '//' + c.texto)
    }
    return saida
  }

  // ---- tipos -------------------------------------------------------------------

  resolver(t) {
    if (t.k === 'basico') return { k: { INTEIRO: 'I', REAL: 'R', CARACTERE: 'C', LOGICO: 'L' }[t.nome] }
    if (t.k === 'nome') return { k: 'G', n: t.n, v: t.v }
    return { k: 'V', dims: t.dims, elem: this.resolver(t.elem) }
  }

  limite(no) {
    if (no.e === 'num') return String(no.v)
    if (no.e === 'id') return identificador(no.v)
    return '-' + this.limite(no.a)
  }

  /** Nome Pascal de um tipo; vetores ganham um tipo nomeado (TVetorN). */
  nomeTipo(tipo) {
    if (tipo.k === 'G') return identificador(tipo.v)
    if (tipo.k !== 'V') return TIPO_PASCAL[tipo.k]
    const faixas = tipo.dims.map(([lo, hi]) => `${this.limite(lo)}..${this.limite(hi)}`).join(', ')
    const elem = this.nomeTipo(tipo.elem)
    const assinatura = `array[${faixas}] of ${elem}`
    if (!this.tiposVetor.has(assinatura)) {
      const nome = `TVetor${this.tiposVetor.size + 1}`
      this.tiposVetor.set(assinatura, nome)
      this.declTipos.push(`${INDENT}${nome} = ${assinatura};`)
    }
    return this.tiposVetor.get(assinatura)
  }

  procurarVar(n) {
    return this.locais?.get(n) ?? this.globais.get(n) ?? this.consts.get(n)
  }

  /** Tipo resolvido de uma expressão ('I','R','C','L', vetor ou registro). */
  tipoDe(no) {
    switch (no.e) {
      case 'num': return { k: no.t }
      case 'str': return { k: 'C' }
      case 'log': return { k: 'L' }
      case 'id':
      case 'call': {
        if (no.e === 'id') {
          const t = this.procurarVar(no.n)
          if (t) return t
        }
        const sub = this.subs.get(no.n)
        if (sub) return sub.retorno ? this.resolver(sub.retorno) : { k: 'L' }
        if (no.n in RETORNO_EMBUTIDA) {
          const r = RETORNO_EMBUTIDA[no.n]
          if (r) return { k: r }
          return { k: no.args?.[0] && this.tipoDe(no.args[0]).k === 'I' ? 'I' : 'R' }
        }
        return { k: 'R' }
      }
      case 'idx': {
        const base = this.tipoDe(no.base)
        return base.k === 'V' ? base.elem : { k: 'I' }
      }
      case 'campo': {
        const base = this.tipoDe(no.base)
        return this.registros.get(base.n)?.campos.get(no.n) ?? { k: 'I' }
      }
      case 'un':
        return no.op === 'NAO' ? { k: 'L' } : this.tipoDe(no.a)
      case 'bin': {
        if (['E', 'OU', 'XOU', '=', '<>', '<', '>', '<=', '>='].includes(no.op)) return { k: 'L' }
        if (no.op === '/') return { k: 'R' }
        if (no.op === '\\' || no.op === '%') return { k: 'I' }
        const a = this.tipoDe(no.a).k
        const b = this.tipoDe(no.b).k
        if (a === 'C' || b === 'C') return { k: 'C' }
        if (no.op === '^') return { k: a === 'I' && b === 'I' && !this.negativo(no.b) ? 'I' : 'R' }
        return { k: a === 'I' && b === 'I' ? 'I' : 'R' }
      }
      default: return { k: 'I' }
    }
  }

  negativo(no) {
    return no.e === 'un' && no.op === '-'
  }

  // ---- expressões ----------------------------------------------------------------

  /** Expressão já convertida para inteiro (Trunc se for real). */
  inteiro(no) {
    const s = this.expr(no)
    return this.tipoDe(no).k === 'R' ? `Trunc(${s})` : s
  }

  /** Expressão convertida para caber num destino do tipo `destino`. */
  convertida(no, destino) {
    if (destino.k === 'I') return this.inteiro(no)
    return this.expr(no)
  }

  /** Operando de um operador binário: entre parênteses se também for binário. */
  operando(no) {
    const s = this.expr(no)
    return no.e === 'bin' ? `(${s})` : s
  }

  expr(no) {
    switch (no.e) {
      case 'num': return String(no.v)
      case 'str': return textoPascal(no.v)
      case 'log': return no.v ? 'True' : 'False'
      case 'id': {
        if (this.procurarVar(no.n)) return identificador(no.v)
        if (this.subs.has(no.n)) return `${identificador(no.v)}()`
        return this.embutida(no, [])
      }
      case 'call': {
        if (this.subs.has(no.n)) return `${identificador(no.v)}(${this.argumentos(this.subs.get(no.n), no.args)})`
        return this.embutida(no, no.args)
      }
      case 'idx': return `${this.expr(no.base)}[${no.indices.map((i) => this.inteiro(i)).join(', ')}]`
      case 'campo': return `${this.expr(no.base)}.${identificador(no.v)}`
      case 'un': {
        const a = this.operando(no.a)
        if (no.op === 'NAO') return no.a.e === 'un' ? `not (${a})` : `not ${a}`
        if (no.op !== '-') return a
        return no.a.e === 'un' ? `-(${a})` : `-${a}`
      }
      case 'bin': return this.binario(no)
      default: return '0'
    }
  }

  binario(no) {
    const { op } = no
    const ta = this.tipoDe(no.a).k
    const tb = this.tipoDe(no.b).k
    const a = this.operando(no.a)
    const b = this.operando(no.b)
    const relacional = { '=': '=', '<>': '<>', '<': '<', '>': '>', '<=': '<=', '>=': '>=' }[op]
    if (relacional) {
      // O VisuAlg compara textos sem diferenciar maiúsculas (só ASCII).
      if (ta === 'C' && tb === 'C') return `CompareText(${this.expr(no.a)}, ${this.expr(no.b)}) ${relacional} 0`
      return `${a} ${relacional} ${b}`
    }
    switch (op) {
      case 'E': return `${a} and ${b}`
      case 'OU': return `${a} or ${b}`
      case 'XOU': return `${a} xor ${b}`
      case '\\':
      case '%': {
        const x = ta === 'R' ? `Trunc(${this.expr(no.a)})` : a
        const y = tb === 'R' ? `Trunc(${this.expr(no.b)})` : b
        return `${x} ${op === '\\' ? 'div' : 'mod'} ${y}`
      }
      case '^': {
        this.usaMath = true
        const s = `Power(${this.expr(no.a)}, ${this.expr(no.b)})`
        return this.tipoDe(no).k === 'I' ? `Round(${s})` : s
      }
      default: return `${a} ${op} ${b}`
    }
  }

  argumentos(sub, args) {
    return args.map((a, i) => {
      const p = sub.params[i]
      return p && !p.porRef ? this.convertida(a, this.resolver(p.tipo)) : this.expr(a)
    }).join(', ')
  }

  /** Funções pré-definidas do VisuAlg → equivalentes do Free Pascal. */
  embutida(no, args) {
    const x = args.map((a) => this.expr(a))
    const n = (i) => this.inteiro(args[i])
    const math = (s) => {
      this.usaMath = true
      return s
    }
    switch (no.n) {
      case 'ABS': return `Abs(${x[0]})`
      case 'ARCCOS': return math(`ArcCos(${x[0]})`)
      case 'ARCSEN': return math(`ArcSin(${x[0]})`)
      case 'ARCTAN': return `ArcTan(${x[0]})`
      case 'ASC': return `Ord((${x[0]} + #0)[1])`
      case 'CARAC': return `Chr(${n(0)})`
      case 'CARACPNUM':
        this.auxiliares.add('caracpnum')
        return `MisterCaracPNum(${x[0]})`
      case 'COMPR': return `Length(${x[0]})`
      case 'COPIA': return `Copy(${x[0]}, ${n(1)}, ${n(2)})`
      case 'COS': return `Cos(${x[0]})`
      case 'COTAN': return math(`Cotan(${x[0]})`)
      case 'EXP': return math(`Power(${x[0]}, ${x[1]})`)
      case 'GRAUPRAD': return math(`DegToRad(${x[0]})`)
      case 'INT': return `Trunc(${x[0]})`
      case 'LOG': return math(`Log10(${x[0]})`)
      case 'LOGN': return `Ln(${x[0]})`
      case 'MAIUSC': return `UpperCase(${x[0]})`
      case 'MINUSC': return `LowerCase(${x[0]})`
      case 'NUMPCARAC':
        if (this.tipoDe(args[0]).k === 'I') return `IntToStr(${x[0]})`
        this.auxiliares.add('fmtreal')
        return `MisterFmtReal(${x[0]})`
      case 'PI': return 'Pi'
      case 'POS': return `Pos(${x[0]}, ${x[1]})`
      case 'QUAD': return `Sqr(${x[0]})`
      case 'RADPGRAU': return math(`RadToDeg(${x[0]})`)
      case 'RAIZQ': return `Sqrt(${x[0]})`
      case 'RAND':
        this.usaRandom = true
        return 'Random'
      case 'RANDI':
        this.usaRandom = true
        return `Random(${n(0)})`
      case 'SEN': return `Sin(${x[0]})`
      case 'TAN': return math(`Tan(${x[0]})`)
      default:
        // Nome desconhecido: mantém como chamada (o compilador apontará).
        return args.length ? `${identificador(no.v)}(${x.join(', ')})` : identificador(no.v)
    }
  }

  // ---- comandos ------------------------------------------------------------------

  bloco(cmds, nivel) {
    const saida = []
    for (const c of cmds) {
      saida.push(...this.comentariosAte(c.linha - 1, nivel))
      const linhas = this.comando(c, nivel)
      // Comentário no fim da mesma linha do comando.
      const fimLinha = this.comentarios.get(c.linha)
      if (fimLinha && !this.linhasComentadas.has(c.linha) && linhas.length) {
        this.linhasComentadas.add(c.linha)
        linhas[0] += ' //' + fimLinha.texto
      }
      saida.push(...linhas)
    }
    return saida
  }

  /** Bloco begin..end (ou comando único) depois de then/else/do. */
  corpo(cmds, nivel) {
    const p = INDENT.repeat(nivel)
    return [`${p}begin`, ...this.bloco(cmds, nivel + 1), `${p}end`]
  }

  semEquivalente(nome, nivel) {
    return [`${INDENT.repeat(nivel)}{ MisterALG: comando ${nome} não tem equivalente em Pascal }`]
  }

  comando(c, nivel) {
    const p = INDENT.repeat(nivel)
    switch (c.s) {
      case 'atrib': {
        const destino = this.tipoDe(c.alvo)
        return [`${p}${this.expr(c.alvo)} := ${this.convertida(c.expr, destino)};`]
      }
      case 'escreva': return this.escreva(c, p)
      case 'leia': return this.leia(c, p)
      case 'se': {
        const linhas = [`${p}if ${this.expr(c.cond)} then`, ...this.corpo(c.entao, nivel)]
        if (c.senao) {
          linhas.push(...this.comentariosAte(c.linhaSenao - 1, nivel + 1))
          linhas.push(`${p}else`, ...this.corpo(c.senao, nivel))
        }
        linhas[linhas.length - 1] += ';'
        return linhas
      }
      case 'escolha': return this.escolha(c, nivel)
      case 'para': return this.para(c, nivel)
      case 'enquanto': {
        this.lacos += 1
        const linhas = [`${p}while ${this.expr(c.cond)} do`, ...this.corpo(c.corpo, nivel)]
        this.lacos -= 1
        linhas[linhas.length - 1] += ';'
        return linhas
      }
      case 'repita': {
        this.lacos += 1
        const linhas = [`${p}repeat`, ...this.bloco(c.corpo, nivel + 1)]
        this.lacos -= 1
        linhas.push(`${p}until ${c.cond ? this.expr(c.cond) : 'False'};`)
        return linhas
      }
      case 'interrompa':
        // Fora de laço o VisuAlg encerra o subprograma (ou o programa).
        return [this.lacos > 0 ? `${p}Break;` : `${p}Exit;`]
      case 'retorne': {
        if (this.subAtual?.tipo === 'funcao' && c.expr) {
          const destino = this.resolver(this.subAtual.retorno)
          return [`${p}Result := ${this.convertida(c.expr, destino)};`, `${p}Exit;`]
        }
        return [`${p}Exit;`]
      }
      case 'chamada': {
        const sub = this.subs.get(c.n)
        if (sub) return [`${p}${identificador(c.v)}${sub.params.length || c.args.length ? `(${this.argumentos(sub, c.args)})` : ''};`]
        return [`${p}${this.embutida(c, c.args)};`]
      }
      case 'mensagem': {
        const linhas = this.escreva({ novaLinha: true, itens: [{ expr: c.expr }] }, p, true)
        return linhas
      }
      default:
        if (SEM_EQUIVALENTE.has(c.s)) return this.semEquivalente(c.s, nivel)
        return this.semEquivalente(c.s, nivel)
    }
  }

  /** Um item do escreva com a formatação do VisuAlg (espaço antes de números). */
  itemEscreva(item, mensagem) {
    const t = this.tipoDe(item.expr).k
    const s = this.expr(item.expr)
    if (item.largura) {
      const w = this.inteiro(item.largura)
      if (item.decimais && (t === 'I' || t === 'R')) {
        const valor = t === 'I' ? `(${s}) * 1.0` : s
        return [`${valor}:${w}:${this.inteiro(item.decimais)}`]
      }
      if (t === 'R') {
        this.auxiliares.add('fmtreal')
        return [`MisterFmtReal(${s}):${w}`]
      }
      if (t === 'L') return [`BoolToStr(${s}, 'VERDADEIRO', 'FALSO'):${w}`]
      return [`${s}:${w}`]
    }
    const espaco = mensagem ? [] : ["' '"]
    if (t === 'C') return [s]
    if (t === 'R') {
      this.auxiliares.add('fmtreal')
      return [...espaco, `MisterFmtReal(${s})`]
    }
    if (t === 'L') return [...espaco, `BoolToStr(${s}, 'VERDADEIRO', 'FALSO')`]
    return [...espaco, s]
  }

  escreva(c, p, mensagem = false) {
    // Junta o espaço antes de números ao texto literal anterior, se houver.
    const partes = []
    for (const parte of c.itens.flatMap((i) => this.itemEscreva(i, mensagem))) {
      const anterior = partes[partes.length - 1]
      if (parte === "' '" && anterior && /^'([^']|'')*'$/.test(anterior)) partes[partes.length - 1] = anterior.slice(0, -1) + " '"
      else partes.push(parte)
    }
    const cmd = c.novaLinha ? 'writeln' : 'write'
    if (!partes.length) return [c.novaLinha ? `${p}writeln;` : `${p}write('');`]
    return [`${p}${cmd}(${partes.join(', ')});`]
  }

  leia(c, p) {
    const linhas = []
    if (c.mensagem) linhas.push(`${p}write(${textoPascal(c.mensagem.v)});`)
    if (!c.alvos.length) linhas.push(`${p}readln;`)
    for (const alvo of c.alvos) {
      const t = this.tipoDe(alvo).k
      if (t === 'L') {
        this.auxiliares.add('lerlogico')
        linhas.push(`${p}${this.expr(alvo)} := MisterLerLogico;`)
      } else {
        linhas.push(`${p}readln(${this.expr(alvo)});`)
      }
    }
    return linhas
  }

  /** Rótulo constante ordinal válido num `case` do Pascal? */
  rotuloOrdinal(no) {
    if (no.e === 'num') return no.t === 'I'
    if (no.e === 'un' && no.op === '-') return this.rotuloOrdinal(no.a)
    if (no.e === 'id') return this.consts.get(no.n)?.k === 'I' && !this.locais?.has(no.n)
    return false
  }

  escolha(c, nivel) {
    const p = INDENT.repeat(nivel)
    const t = this.tipoDe(c.expr).k
    // Rótulos repetidos ou faixas sobrepostas: o FPC recusa ("Duplicate case
    // label"), mas o VisuAlg usa o primeiro caso que casar; vira if encadeado.
    const usaCase = t === 'I' && c.casos.every((caso) => caso.itens.every((i) => this.rotuloOrdinal(i.a) && (!i.b || this.rotuloOrdinal(i.b))))
      && !this.rotulosSobrepostos(c.casos)
    const linhas = []
    if (usaCase) {
      linhas.push(`${p}case ${this.expr(c.expr)} of`)
      for (const caso of c.casos) {
        linhas.push(...this.comentariosAte(caso.linha - 1, nivel + 1))
        const rotulos = caso.itens.map((i) => (i.b ? `${this.expr(i.a)}..${this.expr(i.b)}` : this.expr(i.a))).join(', ')
        linhas.push(`${INDENT.repeat(nivel + 1)}${rotulos}:`, ...this.corpo(caso.corpo, nivel + 2))
        linhas[linhas.length - 1] += ';'
      }
      if (c.outro) {
        linhas.push(`${p}else`, ...this.bloco(c.outro, nivel + 1))
      }
      linhas.push(`${p}end;`)
      return linhas
    }
    // Textos, reais ou rótulos não constantes: if encadeado.
    const alvo = c.expr
    const teste = (i) => {
      const cmp = (op, b) => this.expr({ e: 'bin', op, a: alvo, b, linha: c.linha })
      return i.b ? `(${cmp('>=', i.a)}) and (${cmp('<=', i.b)})` : cmp('=', i.a)
    }
    c.casos.forEach((caso, k) => {
      linhas.push(...this.comentariosAte(caso.linha - 1, nivel))
      const cond = caso.itens.map((i) => (caso.itens.length > 1 ? `(${teste(i)})` : teste(i))).join(' or ')
      linhas.push(`${p}${k === 0 ? '' : 'else '}if ${cond} then`, ...this.corpo(caso.corpo, nivel))
    })
    if (c.outro) {
      if (c.casos.length) linhas.push(`${p}else`, ...this.corpo(c.outro, nivel))
      else linhas.push(...this.corpo(c.outro, nivel))
    }
    if (linhas.length) linhas[linhas.length - 1] += ';'
    return linhas
  }

  /** Valor inteiro constante de um rótulo do escolha (null se não souber). */
  valorRotulo(no) {
    if (no.e === 'num') return no.t === 'I' ? no.v : null
    if (no.e === 'un' && no.op === '-') {
      const v = this.valorRotulo(no.a)
      return v === null ? null : -v
    }
    if (no.e === 'id') {
      const c = this.prog.consts.find((k) => k.n === no.n)
      return c ? this.valorRotulo(c.expr) : null
    }
    return null
  }

  /** Rótulos do escolha repetidos ou sobrepostos (o case do Pascal recusa)? */
  rotulosSobrepostos(casos) {
    const faixas = []
    for (const caso of casos) {
      for (const i of caso.itens) {
        const a = this.valorRotulo(i.a)
        const b = i.b ? this.valorRotulo(i.b) : a
        if (a === null || b === null) return true
        if (a > b) continue // faixa vazia: nunca casa
        if (faixas.some(([x, y]) => a <= y && x <= b)) return true
        faixas.push([a, b])
      }
    }
    return false
  }

  /** Percorre todos os nós (comandos e expressões) de uma árvore. */
  percorrer(no, visita) {
    if (!no || typeof no !== 'object') return false
    if (Array.isArray(no)) return no.some((x) => this.percorrer(x, visita))
    if (visita(no)) return true
    return Object.values(no).some((v) => v && typeof v === 'object' && this.percorrer(v, visita))
  }

  /** O subprograma (ou outro que ele chame) usa a variável global n? */
  usaGlobal(sub, n, vistos = new Set()) {
    if (vistos.has(sub.n)) return false
    vistos.add(sub.n)
    if (sub.params.some((par) => par.n === n) || sub.vars.some((d) => d.nomes.some((x) => x.n === n))) return false
    return this.percorrer(sub.corpo, (no) => {
      if (no.e === 'id' && no.n === n) return true
      if (no.s === 'para' && no.variavel.n === n) return true
      const outro = (no.s === 'chamada' || no.e === 'call' || no.e === 'id') && this.subs.get(no.n)
      return Boolean(outro) && this.usaGlobal(outro, n, vistos)
    })
  }

  /**
   * O corpo altera a variável (atribuição, leia, parâmetro var em comando ou
   * em expressão, ou subprograma que mexa na variável global)?
   */
  alteraVariavel(cmds, n) {
    const ehAlvo = (no) => {
      while (no.e === 'idx' || no.e === 'campo') no = no.base
      return no.e === 'id' && no.n === n
    }
    const global = !this.locais?.has(n)
    return this.percorrer(cmds, (c) => {
      if (c.s === 'atrib' && ehAlvo(c.alvo)) return true
      if (c.s === 'leia' && c.alvos.some(ehAlvo)) return true
      if (c.s === 'para' && c.variavel.n === n) return true
      if (c.s === 'chamada' || c.e === 'call' || c.e === 'id') {
        const sub = this.subs.get(c.n)
        if (!sub || (c.e === 'id' && this.procurarVar(c.n))) return false
        if ((c.args ?? []).some((a, i) => sub.params[i]?.porRef && ehAlvo(a))) return true
        if (global && this.usaGlobal(sub, n)) return true
      }
      return false
    })
  }

  /**
   * A variável é usada fora deste laço (no mesmo subprograma, ou em qualquer
   * subprograma se for global)? Depois de um for o Pascal a deixa indefinida,
   * enquanto no VisuAlg ela fica com fim+passo.
   */
  usadaForaDoLaco(laco, n) {
    // Pula o próprio laço e a variável de controle de outros laços (que só a atribuem).
    const pula = (no) => {
      if (!no || typeof no !== 'object') return false
      if (no === laco) return false
      if (Array.isArray(no)) return no.some(pula)
      if (no.s === 'para' && no.variavel.n === n) {
        return [no.inicio, no.fim, no.passo, no.corpo].some(pula)
      }
      if (no.e === 'id' && no.n === n) return true
      return Object.values(no).some((v) => v && typeof v === 'object' && pula(v))
    }
    if (pula(this.corpoAtual)) return true
    if (this.locais?.has(n)) return false
    return this.prog.subs.some((s) => s !== this.subAtual && this.usaGlobal(s, n))
  }

  /** Expressão que não muda durante o laço (literal ou constante)? */
  constanteNoLaco(no) {
    if (no.e === 'num') return true
    if (no.e === 'un' && no.op === '-') return this.constanteNoLaco(no.a)
    return no.e === 'id' && this.consts.has(no.n) && !this.procurarVarLocal(no.n)
  }

  procurarVarLocal(n) {
    return this.locais?.has(n) || this.globais.has(n)
  }

  /** Nova variável temporária do laço para (declarada no subprograma atual). */
  temporario(base, tipo) {
    this.contTemp += 1
    const nome = `Mister${base}${this.contTemp}`
    this.temporarios.push(`${nome}: ${TIPO_PASCAL[tipo]};`)
    return nome
  }

  para(c, nivel) {
    const p = INDENT.repeat(nivel)
    const v = identificador(c.variavel.v)
    const tipoVar = this.procurarVar(c.variavel.n)?.k
    let passo = 1
    if (c.passo) {
      const lit = c.passo.e === 'num' ? c.passo : c.passo.e === 'un' && c.passo.a.e === 'num' ? c.passo.a : null
      passo = lit && lit.t === 'I' ? (c.passo.e === 'un' && c.passo.op === '-' ? -lit.v : lit.v) : null
    }
    // for do Pascal exige variável local ordinal (parâmetro var não serve),
    // passo ±1, limite inteiro (o VisuAlg compara com o valor real), corpo que
    // não a altere e que ela não seja usada depois (o for a deixa indefinida).
    const n = c.variavel.n
    const local = !this.subAtual || (this.locais.has(n) && !this.subAtual.params.some((par) => par.n === n && par.porRef))
    const usaFor = (passo === 1 || passo === -1) && tipoVar === 'I' && local
      && this.tipoDe(c.fim).k === 'I' && !this.alteraVariavel(c.corpo, n) && !this.usadaForaDoLaco(c, n)
    this.lacos += 1
    let linhas
    if (usaFor) {
      linhas = [`${p}for ${v} := ${this.inteiro(c.inicio)} ${passo === 1 ? 'to' : 'downto'} ${this.expr(c.fim)} do`, ...this.corpo(c.corpo, nivel)]
      linhas[linhas.length - 1] += ';'
    } else {
      // O VisuAlg avalia o limite e o passo uma vez só, antes do laço.
      const antes = []
      let fim = this.expr(c.fim)
      if (!this.constanteNoLaco(c.fim)) {
        const tmp = this.temporario('Fim', this.tipoDe(c.fim).k === 'R' ? 'R' : 'I')
        antes.push(`${p}${tmp} := ${fim};`)
        fim = tmp
      }
      const ini = tipoVar === 'I' ? this.inteiro(c.inicio) : this.expr(c.inicio)
      let cond
      let incremento
      if (passo === null) {
        const tipoPasso = this.tipoDe(c.passo).k === 'R' ? 'R' : 'I'
        let s = this.expr(c.passo)
        if (!this.constanteNoLaco(c.passo)) {
          const tmp = this.temporario('Passo', tipoPasso)
          antes.push(`${p}${tmp} := ${s};`)
          s = tmp
        }
        cond = `((${s} > 0) and (${v} <= ${fim})) or ((${s} < 0) and (${v} >= ${fim}))`
        incremento = `${v} := ${v} + ${tipoVar === 'I' && tipoPasso === 'R' ? `Trunc(${s})` : s};`
      } else {
        cond = `${v} ${passo > 0 ? '<=' : '>='} ${fim}`
        incremento = passo > 0 ? `${v} := ${v} + ${passo};` : `${v} := ${v} - ${-passo};`
      }
      linhas = [
        ...antes,
        `${p}${v} := ${ini};`,
        `${p}while ${cond} do`,
        `${p}begin`,
        ...this.bloco(c.corpo, nivel + 1),
        `${p}${INDENT}${incremento}`,
        `${p}end;`,
      ]
    }
    this.lacos -= 1
    return linhas
  }

  // ---- declarações ---------------------------------------------------------------

  declaracoes(decls, mapa, nivel) {
    const linhas = []
    for (const d of decls) {
      linhas.push(...this.comentariosAte(d.linha - 1, nivel))
      const tipo = this.resolver(d.tipo)
      for (const nome of d.nomes) mapa.set(nome.n, tipo)
      linhas.push(`${INDENT.repeat(nivel)}${d.nomes.map((x) => identificador(x.v)).join(', ')}: ${this.nomeTipo(tipo)};`)
    }
    return linhas
  }

  /** Valores iniciais das variáveis locais (no VisuAlg começam zeradas). */
  inicializacoes(decls, nivel) {
    const p = INDENT.repeat(nivel)
    const linhas = []
    for (const d of decls) {
      const tipo = this.resolver(d.tipo)
      for (const nome of d.nomes) {
        const v = identificador(nome.v)
        if (tipo.k === 'I' || tipo.k === 'R') linhas.push(`${p}${v} := 0;`)
        else if (tipo.k === 'L') linhas.push(`${p}${v} := False;`)
        else if (tipo.k === 'C') linhas.push(`${p}${v} := '';`)
        else linhas.push(`${p}FillChar(${v}, SizeOf(${v}), 0);`)
      }
    }
    return linhas
  }

  cabecalhoSub(s) {
    const params = s.params.map((par) => `${par.porRef ? 'var ' : ''}${identificador(par.v)}: ${this.nomeTipo(this.resolver(par.tipo))}`).join('; ')
    const lista = params ? `(${params})` : ''
    if (s.tipo === 'funcao') return `function ${identificador(s.v)}${lista}: ${this.nomeTipo(this.resolver(s.retorno))};`
    return `procedure ${identificador(s.v)}${lista};`
  }

  subprograma(s) {
    this.subAtual = s
    this.locais = new Map()
    this.lacos = 0
    for (const par of s.params) this.locais.set(par.n, this.resolver(par.tipo))
    const linhas = [...this.comentariosAte(s.linha - 1, 0), this.cabecalhoSub(s)]
    const decls = this.declaracoes(s.vars, this.locais, 1)
    // O corpo é gerado antes para conhecer os temporários dos laços.
    this.corpoAtual = s.corpo
    this.temporarios = []
    const corpo = this.bloco(s.corpo, 1)
    decls.push(...this.temporarios.map((d) => INDENT + d))
    if (decls.length) linhas.push('var', ...decls)
    linhas.push('begin')
    if (s.tipo === 'funcao') {
      const r = this.resolver(s.retorno)
      if (r.k === 'I' || r.k === 'R') linhas.push(`${INDENT}Result := 0;`)
      else if (r.k === 'L') linhas.push(`${INDENT}Result := False;`)
      else if (r.k === 'C') linhas.push(`${INDENT}Result := '';`)
    }
    linhas.push(...this.inicializacoes(s.vars, 1))
    linhas.push(...corpo)
    linhas.push(...this.comentariosAte(s.linhaFim, 1))
    linhas.push('end;', '')
    this.subAtual = null
    this.locais = null
    return linhas
  }

  /** Subprogramas chamados antes de sua definição precisam de `forward`. */
  precisamForward() {
    const ordem = new Map(this.prog.subs.map((s, i) => [s.n, i]))
    const precisam = new Set()
    const visitarExpr = (no, i) => {
      if (!no || typeof no !== 'object') return
      if ((no.e === 'call' || no.e === 'id') && ordem.get(no.n) > i) precisam.add(no.n)
      for (const v of Object.values(no)) {
        if (Array.isArray(v)) v.forEach((x) => visitarExpr(x, i))
        else if (v && typeof v === 'object') visitarExpr(v, i)
      }
    }
    this.prog.subs.forEach((s, i) => {
      const varrer = (no) => {
        if (!no || typeof no !== 'object') return
        if (no.s === 'chamada' && ordem.get(no.n) > i) precisam.add(no.n)
        if (no.e) return visitarExpr(no, i)
        for (const v of Object.values(no)) {
          if (Array.isArray(v)) v.forEach(varrer)
          else if (v && typeof v === 'object') varrer(v)
        }
      }
      s.corpo.forEach(varrer)
    })
    return this.prog.subs.filter((s) => precisam.has(s.n))
  }

  // ---- programa ------------------------------------------------------------------

  gerar() {
    const { prog } = this
    const cabecalho = [
      '{ Programa gerado pelo MisterALG a partir do algoritmo',
      `  "${prog.nome.replace(/[{}]/g, '')}" (Portugol / VisuAlg).`,
      '  Compile com o Free Pascal: fpc arquivo.pas }',
      '',
    ]
    // Comentários do início (antes da primeira declaração) vão para o topo.
    const primeira = Math.min(
      prog.linhaInicio,
      ...[...prog.consts, ...prog.tipos, ...prog.vars, ...prog.subs].map((d) => d.linha),
    )
    const antesAlgoritmo = this.comentariosAte(primeira - 1, 0)

    // Constantes
    const consts = []
    for (const c of prog.consts) {
      consts.push(...this.comentariosAte(c.linha - 1, 1))
      consts.push(`${INDENT}${identificador(c.v)} = ${this.expr(c.expr)};`)
      this.consts.set(c.n, this.tipoDe(c.expr))
    }

    // Tipos: registros na ordem declarada; vetores conforme aparecem.
    for (const t of prog.tipos) {
      const campos = new Map()
      const coments = this.comentariosAte(t.linha - 1, 1)
      const linhas = []
      for (const d of t.campos) {
        const tipo = this.resolver(d.tipo)
        for (const nome of d.nomes) campos.set(nome.n, tipo)
        linhas.push(`${INDENT}${INDENT}${d.nomes.map((x) => identificador(x.v)).join(', ')}: ${this.nomeTipo(tipo)};`)
      }
      this.registros.set(t.n, { nome: t.v, campos })
      this.declTipos.push(...coments, `${INDENT}${identificador(t.v)} = record`, ...linhas, `${INDENT}end;`)
    }

    const vars = this.declaracoes(prog.vars, this.globais, 1)
    for (const s of prog.subs) this.subs.set(s.n, s)
    // Cabeçalhos primeiro (registram vetores usados em parâmetros).
    const forwards = this.precisamForward().map((s) => `${this.cabecalhoSub(s)} forward;`)
    const subs = prog.subs.flatMap((s) => this.subprograma(s))

    this.subAtual = null
    this.locais = null
    this.lacos = 0
    this.corpoAtual = prog.corpo
    this.temporarios = []
    const corpo = this.bloco(prog.corpo, 1)
    corpo.push(...this.comentariosAte(prog.linhaFim, 1))
    vars.push(...this.temporarios.map((d) => INDENT + d))

    const saida = [...cabecalho]
    // {$R+}: índice fora do vetor é erro em tempo de execução, como no VisuAlg.
    saida.push('{$mode objfpc}{$H+}{$R+}', '')
    saida.push(`program ${this.nomePrograma()};`, '')
    if (antesAlgoritmo.length) saida.push(...antesAlgoritmo, '')
    saida.push(`uses SysUtils${this.usaMath ? ', Math' : ''};`, '')
    if (prog.dos) saida.push('{ MisterALG: comando dos não tem equivalente em Pascal }', '')
    if (prog.arquivo) saida.push(`{ MisterALG: comando arquivo "${prog.arquivo.nome.replace(/[{}]/g, '')}" não tem equivalente em Pascal (as leituras usam o teclado) }`, '')
    if (consts.length) saida.push('const', ...consts, '')
    if (this.declTipos.length) saida.push('type', ...this.declTipos, '')
    if (vars.length) saida.push('var', ...vars, '')
    saida.push(...this.textoAuxiliares())
    if (forwards.length) saida.push(...forwards, '')
    saida.push(...subs)
    saida.push('begin')
    if (this.usaRandom) saida.push(`${INDENT}Randomize;`)
    saida.push(...corpo, 'end.', '')
    return saida.join('\n')
  }

  nomePrograma() {
    let nome = identificador(this.prog.nome || 'semnome')
    const usados = new Set([...this.globais.keys(), ...this.consts.keys(), ...this.subs.keys(), ...this.registros.keys()].map((n) => identificador(n).toLowerCase()))
    if (usados.has(nome.toLowerCase())) nome += '_prog'
    return nome
  }

  textoAuxiliares() {
    const linhas = []
    if (this.auxiliares.has('fmtreal')) {
      linhas.push(
        '{ Real como o escreva do VisuAlg: até 10 casas, sem zeros à direita. }',
        'function MisterFmtReal(x: Double): String;',
        'var',
        `${INDENT}fs: TFormatSettings;`,
        'begin',
        `${INDENT}fs := DefaultFormatSettings;`,
        `${INDENT}fs.DecimalSeparator := '.';`,
        `${INDENT}Result := FormatFloat('0.##########', x, fs);`,
        `${INDENT}if Result = '-0' then Result := '0';`,
        'end;',
        '',
      )
    }
    if (this.auxiliares.has('lerlogico')) {
      linhas.push(
        '{ leia de variável lógica: V ou VERDADEIRO. }',
        'function MisterLerLogico: Boolean;',
        'var',
        `${INDENT}s: String;`,
        'begin',
        `${INDENT}readln(s);`,
        `${INDENT}s := UpperCase(Trim(s));`,
        `${INDENT}Result := (s = 'V') or (s = 'VERDADEIRO');`,
        'end;',
        '',
      )
    }
    if (this.auxiliares.has('caracpnum')) {
      linhas.push(
        '{ caracpnum: texto → número (ponto como separador decimal). }',
        'function MisterCaracPNum(const s: String): Double;',
        'var',
        `${INDENT}fs: TFormatSettings;`,
        'begin',
        `${INDENT}fs := DefaultFormatSettings;`,
        `${INDENT}fs.DecimalSeparator := '.';`,
        `${INDENT}Result := StrToFloat(Trim(s), fs);`,
        'end;',
        '',
      )
    }
    return linhas
  }
}
