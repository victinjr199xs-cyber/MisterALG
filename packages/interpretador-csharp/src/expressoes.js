// As expressões do C#. *aval(n, amb) devolve o valor; é um gerador porque uma expressão pode chamar
// código do aluno (um método, uma propriedade) e o passo a passo precisa poder entrar nele.

import { ErroCS, ExcecaoCS } from './erros.js'
import { Lambda } from './funcoes.js'
import { desescapar, lerChar, lerInteiro, lerReal, lerTexto } from './literais.js'
import { Amb } from './maquina.js'
import { Multicast, binario, maisUm, unario } from './operadores.js'
import { Indice, Intervalo, NsRef, TipoRef } from './refs.js'
import { elementoDe, ehArray, nomeCompleto, nomeTipo, partesGenericas, semNulo } from './tipos.js'
import {
  Arr, Chr, Dbl, Dec, Flt, Num, Objeto, Ref, Tupla, ValorEnum,
  cabeEm, converterNumero, ehNumero, tipoNumerico,
} from './valores.js'
import { compor } from './formatar.js'

const filho = (n, campo) => n.f?.find((x) => x.k === campo)

export const expressoes = {
  /** O nome do tipo de um valor, como aparece na tela de objetos (int, string, Pessoa, List<int>...). */
  nomeDoTipoDe(v) {
    if (v === null || v === undefined) return 'null'
    if (typeof v === 'number') return 'int'
    if (typeof v === 'string') return 'string'
    if (typeof v === 'boolean') return 'bool'
    if (ehNumero(v)) return tipoNumerico(v)
    if (v instanceof Objeto) return v.cls.nome
    if (v instanceof Arr) return `${v.tipoElem}[${v.dims ? ','.repeat(v.dims.length - 1) : ''}]`
    if (v instanceof ValorEnum) return v.def.nome
    if (v instanceof Tupla) return `(${v.itens.map((x) => this.nomeDoTipoDe(x)).join(', ')})`
    if (v.nomeCS) return v.nomeCS()
    if (v.ehFunc) return 'delegate'
    return v.nomeCS ? v.nomeCS() : 'object'
  },

  /** T → int (o tipo com que a classe ou o método genérico foi usado), quando se sabe. */
  resolverGenerico(nome, ctx) {
    return ctx.tiposGenericos?.get(nome) ?? ctx.este?.tiposGenericos?.get(nome) ?? nome
  },

  /** É uma coleção que dá para percorrer (array, lista, yield, objeto com GetEnumerator)? */
  ehColecao(v) {
    return v instanceof Arr || this.bib.ehEnumeravel(v) || (v instanceof Objeto && !!this.acharMetodoVirtual(v.cls, 'GetEnumerator', 0))
  },

  /** Como aval, mas com o tipo esperado: new() sem tipo, { 1, 2 } e [1, 2] dependem de saber o tipo da variável. */
  *avalComTipo(n, amb, tipo) {
    if (tipo && tipo !== 'var') {
      const t = semNulo(tipo)
      if (n.t === 'implicit_object_creation_expression') return yield* this.criarObjeto(t, null, filho(n, 'arguments') ?? n.f.find((x) => x.t === 'argument_list'), n.f.find((x) => x.t === 'initializer_expression'), amb)
      if (n.t === 'initializer_expression' && ehArray(t)) return yield* this.criarArrayDeInicializador(t, n, amb)
      if (n.t === 'collection_expression') return yield* this.criarDeColecao(t, n, amb)
      if (n.t === 'array_creation_expression' || n.t === 'implicit_array_creation_expression') return yield* this.aval(n, amb)
      if (n.t === 'conditional_expression') {
        const c = yield* this.aval(filho(n, 'condition'), amb)
        return yield* this.avalComTipo(c === true ? filho(n, 'consequence') : filho(n, 'alternative'), amb, tipo)
      }
      if (n.t === 'parenthesized_expression') return yield* this.avalComTipo(n.f[0], amb, tipo)
      if (n.t === 'switch_expression') return yield* this.avalSwitchExpressao(n, amb, tipo)
      if (n.t === 'lambda_expression' || n.t === 'anonymous_method_expression') {
        const f = yield* this.aval(n, amb)
        const { nome, args } = partesGenericas(t)
        if (f instanceof Lambda && f.params.some((p) => !p.tipo) && args.length && /^(Func|Action|Predicate|Comparison)$/.test(nome)) {
          const ps = f.params
          const tiposParam = nome === 'Func' ? args.slice(0, -1) : args
          ps.forEach((p, i) => { if (!p.tipo && tiposParam[i]) p.tipo = tiposParam[i] })
        }
        return f
      }
    }
    return yield* this.aval(n, amb)
  },

  *aval(n, amb) {
    switch (n.t) {
      case 'integer_literal': return lerInteiro(n.x)
      case 'real_literal': return lerReal(n.x)
      case 'string_literal': case 'verbatim_string_literal': case 'raw_string_literal': return lerTexto(n.x)
      case 'character_literal': return lerChar(n.x)
      case 'boolean_literal': return n.f[0].t === 'true'
      case 'null_literal': return null
      case 'identifier': return yield* this.avalIdentificador(n, amb)
      case 'parenthesized_expression': return yield* this.aval(n.f[0], amb)
      case 'interpolated_string_expression': return yield* this.avalInterpolada(n, amb)
      case 'binary_expression': return yield* this.avalBinaria(n, amb)
      case 'prefix_unary_expression': return yield* this.avalPrefixo(n, amb)
      case 'postfix_unary_expression': return yield* this.avalPosfixo(n, amb)
      case 'assignment_expression': return yield* this.avalAtribuicao(n, amb)
      case 'conditional_expression': {
        const c = yield* this.aval(filho(n, 'condition'), amb)
        return yield* this.aval(c === true ? filho(n, 'consequence') : filho(n, 'alternative'), amb)
      }
      case 'invocation_expression': return yield* this.avalInvocacao(n, amb)
      case 'member_access_expression': return yield* this.avalAcessoMembro(n, amb)
      case 'element_access_expression': return yield* this.avalAcessoIndice(n, amb)
      case 'this_expression': return amb.ctx.este
      case 'base_expression': return amb.ctx.este
      case 'object_creation_expression': {
        const tipo = nomeTipo(filho(n, 'type'))
        return yield* this.criarObjeto(tipo, filho(n, 'type'), filho(n, 'arguments'), n.f.find((x) => x.t === 'initializer_expression'), amb)
      }
      case 'implicit_object_creation_expression':
        throw new ErroCS('o new() sem o nome do tipo só funciona quando o tipo da variável está escrito (ex.: List<int> l = new();)', n.l)
      case 'array_creation_expression': return yield* this.avalNovoArray(n, amb)
      case 'implicit_array_creation_expression': return yield* this.avalArrayImplicito(n, amb)
      case 'stackalloc_expression': throw new ErroCS('stackalloc ainda não é suportado', n.l)
      case 'initializer_expression': return yield* this.criarArrayDeInicializador('object[]', n, amb)
      case 'collection_expression': return yield* this.criarDeColecao('List<object>', n, amb)
      case 'tuple_expression': return yield* this.avalTupla(n, amb)
      case 'cast_expression': return yield* this.avalCast(n, amb)
      case 'lambda_expression': return this.criarLambda(n, amb)
      case 'anonymous_method_expression': return this.criarLambda(n, amb)
      case 'type_of_expression': return this.bib.tipoValor(this.resolverGenerico(nomeTipo(n.f.find((x) => x.t !== 'typeof')), amb.ctx))
      case 'default_expression': {
        const t = n.f.find((x) => x.k === 'type')
        return t ? this.valorPadrao(this.resolverGenerico(nomeTipo(t), amb.ctx)) : null
      }
      case 'is_expression': {
        const v = yield* this.aval(filho(n, 'left'), amb)
        const direito = filho(n, 'right')
        return this.ehTipo(v, nomeTipo(direito))
      }
      case 'is_pattern_expression': {
        const v = yield* this.aval(filho(n, 'expression'), amb)
        return yield* this.casarPadrao(filho(n, 'pattern'), v, amb)
      }
      case 'as_expression': {
        const v = yield* this.aval(filho(n, 'left'), amb)
        const t = nomeTipo(filho(n, 'right'))
        return this.ehTipo(v, t) ? v : null
      }
      case 'switch_expression': return yield* this.avalSwitchExpressao(n, amb, null)
      case 'range_expression': {
        const [a, b] = this.extremosDeIntervalo(n)
        return new Intervalo(a ? yield* this.avalIndice(a, amb) : null, b ? yield* this.avalIndice(b, amb) : null)
      }
      case 'await_expression': return yield* this.avalAwait(n, amb)
      case 'throw_expression': throw yield* this.criarExcecaoLancada(n.f[n.f.length - 1], amb)
      case 'conditional_access_expression': return yield* this.avalAcessoCondicional(n, amb)
      case 'member_binding_expression': case 'element_binding_expression': return yield* this.avalLigacao(n, amb)
      case 'with_expression': return yield* this.avalWith(n, amb)
      case 'anonymous_object_creation_expression': return yield* this.avalAnonimo(n, amb)
      case 'declaration_expression': {
        // out var x / out int x usados como valor: declara a variável.
        const nome = filho(n, 'name')?.x
        if (nome) amb.declarar(nome, new Ref(null, nomeTipo(filho(n, 'type'))))
        return null
      }
      case 'checked_expression': {
        const anterior = this.verificado
        this.verificado = n.f[0].t === 'checked' ? 1 : 0
        try {
          return yield* this.aval(n.f[n.f.length - 1], amb)
        } finally {
          this.verificado = anterior
        }
      }
      case 'query_expression': return yield* this.avalConsulta(n, amb)
      case 'generic_name': return yield* this.avalIdentificador(n.f.find((x) => x.t === 'identifier'), amb)
      case 'qualified_name': return yield* this.avalNomeQualificado(n, amb)
      case 'postfix_null_forgiving': return yield* this.aval(n.f[0], amb)
      case 'size_of_expression': return 4
      case 'predefined_type': return new TipoRef(n.x, null, this.bib.tipo(n.x))
      case 'discard': return null
      case 'ref_expression': return yield* this.aval(n.f[n.f.length - 1], amb)
      default:
        throw new ErroCS(`o passo a passo do C# ainda não conhece esta expressão (${n.t})`, n.l)
    }
  },

  // ---- nomes -----------------------------------------------------------------------------------------

  *avalIdentificador(n, amb) {
    const nome = n.x
    const ref = amb.buscar(nome)
    if (ref) return ref.v
    const ctx = amb.ctx
    if (ctx.este) {
      const r = yield* this.lerMembroImplicito(ctx.este, nome)
      if (r !== undefined) return r.v
    }
    for (let c = ctx.cls; c; c = c.externa) {
      const dono = this.achaEstatico(c, nome)
      if (dono) return yield* this.lerEstatico(dono, nome)
      if (c.ehPrelude === false && c.aninhadas.has(nome)) return new TipoRef(nome, c.aninhadas.get(nome))
    }
    for (const u of this.usingsEstaticos) {
      const alvo = this.buscarClasse(u)
      if (alvo && this.achaEstatico(alvo, nome)) return yield* this.lerEstatico(alvo, nome)
      const nat = this.bib.tipo(u)
      if (nat && this.bib.temEstatico(nat, nome)) return this.bib.lerEstatico(this, nat, nome)
    }
    const def = this.buscarClasse(nome)
    if (def) return new TipoRef(nome, def)
    const nat = this.bib.tipo(nome)
    if (nat) return new TipoRef(nome, null, nat)
    if (this.bib.ehNamespace(nome)) return new NsRef(nome)
    // Método usado como valor (Func<int,int> f = Dobro;)
    const f = this.grupoDeMetodos(nome, ctx)
    if (f) return f
    throw new ErroCS(`o nome "${nome}" não existe neste contexto`, n.l, 'Declare a variável antes de usá-la (ex.: int x = 0;) e confira a grafia — maiúsculas e minúsculas contam. CS0103.')
  },

  *avalNomeQualificado(n, amb) {
    let v = yield* this.aval(n.f[0], amb)
    for (const parte of n.f.slice(1)) v = yield* this.membroDe(v, parte.x ?? parte.f?.[0]?.x, amb, parte)
    return v
  },

  grupoDeMetodos(nome, ctx) {
    const lista = []
    for (let c = ctx.cls; c; c = c.externa) lista.push(...this.metodosDe(c, nome))
    return lista.length ? this.bib.criarGrupo(nome, lista, ctx.este) : null
  },

  // ---- texto interpolado -----------------------------------------------------------------------------------

  *avalInterpolada(n, amb) {
    const verbatim = n.f.some((x) => x.t.includes('@'))
    let r = ''
    for (const p of n.f) {
      if (p.t === 'interpolated_string_text' || p.t === 'interpolated_verbatim_string_text') {
        r += (verbatim ? p.x.replace(/""/g, '"') : desescapar(p.x)).replace(/\{\{/g, '{').replace(/\}\}/g, '}')
      } else if (p.t.includes('escape')) {
        r += desescapar(p.x)
      } else if (p.t === 'interpolation') {
        const expr = p.f[0]
        const v = yield* this.aval(expr, amb)
        const alinh = p.f.find((x) => x.t === 'interpolation_alignment_clause')
        const fmt = p.f.find((x) => x.t === 'interpolation_format_clause')
        let s = this.aTexto(v, fmt ? fmt.x.replace(/^:/, '') : undefined)
        if (alinh) {
          const w = yield* this.aval(alinh.f[alinh.f.length - 1], amb)
          s = w >= 0 ? s.padStart(w) : s.padEnd(-w)
        }
        r += s
      }
    }
    return r
  },

  // ---- operadores ------------------------------------------------------------------------------------------

  *avalBinaria(n, amb) {
    const op = filho(n, 'operator').x
    const esq = filho(n, 'left')
    const dir = filho(n, 'right')
    if (op === '&&') {
      if ((yield* this.aval(esq, amb)) !== true) return false
      return (yield* this.aval(dir, amb)) === true
    }
    if (op === '||') {
      if ((yield* this.aval(esq, amb)) === true) return true
      return (yield* this.aval(dir, amb)) === true
    }
    if (op === '??') {
      const v = yield* this.aval(esq, amb)
      return v !== null && v !== undefined ? v : yield* this.aval(dir, amb)
    }
    const a = yield* this.aval(esq, amb)
    const b = yield* this.aval(dir, amb)
    const r = binario(this, op, a, b)
    if (r !== undefined) return r
    return yield* this.operadorDoAluno(op, a, b, n)
  },

  *operadorDoAluno(op, a, b, n) {
    for (const v of [a, b]) {
      if (!(v instanceof Objeto)) continue
      for (let c = v.cls; c; c = c.base) {
        const lista = c.operadores.get(op)
        if (!lista) continue
        const md = this.escolherSobrecarga(lista, [a, b])
        if (md) return yield* this.chamarMetodo(md, null, [a, b], md.cls)
      }
    }
    // Conversão implícita para um tipo que a conta aceite (ex.: class Dinheiro com implicit operator double).
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x instanceof Objeto) {
        for (const alvo of ['double', 'int', 'decimal', 'long', 'string']) {
          const cx = this.conversaoImplicita(x, alvo)
          if (cx !== undefined) {
            const r = x === a ? binario(this, op, cx, y) : binario(this, op, y, cx)
            if (r !== undefined) return r
          }
        }
      }
    }
    if (a === null || b === null) {
      if (op === '+') return this.aTexto(a) + this.aTexto(b)
    }
    throw new ErroCS(`o operador ${op} não funciona entre ${this.nomeDoTipoDe(a)} e ${this.nomeDoTipoDe(b)}`, n.l, 'Confira os tipos dos dois lados da conta (CS0019). Converta com int.Parse, Convert.ToInt32, (int), etc.')
  },

  *avalPrefixo(n, amb) {
    const op = n.f[0].t === 'identifier' || n.f[0].x === undefined ? n.f[0].x : n.f[0].x
    const e = n.f[1]
    if (op === '++' || op === '--') {
      const lv = yield* this.avalLValue(e, amb)
      const antes = yield* lv.ler()
      const depois = this.incrementar(antes, op === '++' ? 1 : -1, n)
      yield* lv.gravar(depois)
      return depois
    }
    if (op === '^') return new Indice(yield* this.aval(e, amb), true)
    if (op === '&' || op === '*') throw new ErroCS('ponteiros (unsafe) não são suportados no C# do MisterALG', n.l)
    const v = yield* this.aval(e, amb)
    const r = unario(this, op, v)
    if (r !== undefined) return r
    if (v instanceof Objeto) {
      for (let c = v.cls; c; c = c.base) {
        const lista = c.operadores.get(op)
        const md = lista && this.escolherSobrecarga(lista, [v])
        if (md) return yield* this.chamarMetodo(md, null, [v], md.cls)
      }
    }
    throw new ErroCS(`o operador ${op} não funciona com ${this.nomeDoTipoDe(v)}`, n.l)
  },

  *avalPosfixo(n, amb) {
    const e = n.f[0]
    const op = n.f[1].x
    if (op === '!') return yield* this.aval(e, amb)
    const lv = yield* this.avalLValue(e, amb)
    const antes = yield* lv.ler()
    yield* lv.gravar(this.incrementar(antes, op === '++' ? 1 : -1, n))
    return antes
  },

  incrementar(v, delta, n) {
    const r = maisUm(v, delta, this)
    if (r !== undefined) return r
    if (v instanceof Objeto) {
      for (let c = v.cls; c; c = c.base) {
        const lista = c.operadores.get(delta > 0 ? '++' : '--')
        const md = lista && this.escolherSobrecarga(lista, [v])
        if (md) return this.rodarSync(this.chamarMetodo(md, null, [v], md.cls))
      }
    }
    throw new ErroCS(`o operador ${delta > 0 ? '++' : '--'} não funciona com ${this.nomeDoTipoDe(v)}`, n.l)
  },

  // ---- atribuição --------------------------------------------------------------------------------------------

  *avalAtribuicao(n, amb) {
    const esq = filho(n, 'left')
    const op = filho(n, 'assignment_operator')?.f?.[0]?.x ?? n.f.find((x) => x.t === 'assignment_operator').f[0].x
    const dir = filho(n, 'right')
    if (esq.t === 'tuple_expression' || (esq.t === 'declaration_expression' && esq.f.some((x) => x.t.includes('designation')))) {
      const v = yield* this.aval(dir, amb)
      yield* this.desconstruirAtribuicao(esq, v, amb)
      return v
    }
    const lv = yield* this.avalLValue(esq, amb)
    if (op === '=') {
      const tipo = lv.tipo?.()
      let v = yield* this.avalComTipo(dir, amb, tipo)
      v = this.coagir(v, tipo)
      yield* lv.gravar(v)
      return v
    }
    const atual = yield* lv.ler()
    if (op === '??=') {
      if (atual !== null && atual !== undefined) return atual
      const v = this.coagir(yield* this.avalComTipo(dir, amb, lv.tipo?.()), lv.tipo?.())
      yield* lv.gravar(v)
      return v
    }
    const b = yield* this.aval(dir, amb)
    const operador = op.slice(0, -1)
    let r = binario(this, operador, atual, b)
    if (r === undefined) r = yield* this.operadorDoAluno(operador, atual, b, n)
    // x += y mantém o tipo de x (byte, int, double...)
    const tipoAtual = tipoNumerico(atual)
    if (tipoAtual && ehNumero(r) && tipoNumerico(r) !== tipoAtual) r = converterNumero(r, tipoAtual)
    else if (atual instanceof ValorEnum && typeof r === 'number') r = atual.def.valorDe(r)
    yield* lv.gravar(r)
    return r
  },

  *desconstruirAtribuicao(alvo, valor, amb) {
    const destinos = []
    const coletar = (x) => {
      if (x.t === 'tuple_expression') for (const a of x.f) coletar(a.t === 'argument' ? a.f[a.f.length - 1] : a)
      else if (x.t === 'declaration_expression') {
        const nome = filho(x, 'name')
        const tipo = filho(x, 'type')
        if (nome) destinos.push({ decl: true, nome: nome.x, tipo: nomeTipo(tipo) })
        else for (const d of x.f.filter((y) => y.t.includes('designation') || y.t === 'identifier')) coletarDesig(d, nomeTipo(tipo))
      } else destinos.push({ expr: x })
    }
    const coletarDesig = (d, tipo) => {
      if (d.t === 'identifier') destinos.push({ decl: true, nome: d.x, tipo })
      else if (d.t === 'discard') destinos.push({ descarte: true })
      else for (const f of d.f ?? []) coletarDesig(f, tipo)
    }
    coletar(alvo)
    const itens = this.itensDesconstruidos(valor, destinos.length)
    for (let i = 0; i < destinos.length; i += 1) {
      const d = destinos[i]
      if (d.descarte || d.nome === '_') continue
      if (d.decl) amb.declarar(d.nome, new Ref(this.coagir(itens[i], d.tipo), d.tipo === 'var' ? this.nomeDoTipoDe(itens[i]) : d.tipo))
      else if (d.expr.t === 'discard' || d.expr.x === '_') continue
      else {
        const lv = yield* this.avalLValue(d.expr, amb)
        yield* lv.gravar(this.coagir(itens[i], lv.tipo?.()))
      }
    }
  },

  // ---- tuplas, casts, lambdas -----------------------------------------------------------------------------

  *avalTupla(n, amb) {
    const itens = []
    const nomes = []
    for (const a of n.f.filter((x) => x.t === 'argument')) {
      const nc = a.f.find((x) => x.t === 'name_colon')
      nomes.push(nc ? nc.f[0].x : null)
      itens.push(yield* this.aval(a.f[a.f.length - 1], amb))
    }
    return new Tupla(itens, nomes.some(Boolean) ? nomes : null)
  },

  *avalCast(n, amb) {
    const tipo = nomeTipo(filho(n, 'type'))
    const v = yield* this.aval(filho(n, 'value'), amb)
    return this.converterExplicito(v, tipo, n)
  },

  /** (T)valor: números truncam, enums trocam de número, referências conferem o tipo. */
  converterExplicito(v, tipo, n) {
    const t = semNulo(tipo)
    if (v === null || v === undefined) {
      if (t !== tipo || !['int', 'long', 'double', 'float', 'decimal', 'char', 'bool', 'byte', 'short', 'sbyte', 'ushort', 'uint', 'ulong'].includes(t)) return null
      throw this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    }
    if (['int', 'long', 'double', 'float', 'decimal', 'char', 'byte', 'short', 'sbyte', 'ushort', 'uint', 'ulong'].includes(t)) {
      if (ehNumero(v)) {
        if (this.verificado && t !== 'double' && t !== 'float' && t !== 'decimal' && t !== 'char' && !cabeEm(v, t)) throw this.excecao('OverflowException', 'Arithmetic operation resulted in an overflow.')
        return converterNumero(v, t)
      }
      if (v instanceof ValorEnum) return converterNumero(v.v, t)
      if (v instanceof Objeto) {
        const cv = this.conversaoDoAluno(v, t)
        if (cv !== undefined) return cv
      }
      throw this.excecao('InvalidCastException', `Unable to cast object of type '${this.nomeDoTipoDe(v)}' to type '${nomeCompleto(t)}'.`)
    }
    const def = this.buscarClasse(partesGenericas(t).nome)
    if (def?.tipo === 'enum') {
      if (v instanceof ValorEnum) return def.valorDe(v.v)
      if (ehNumero(v)) return def.valorDe(Number(v instanceof Dbl ? Math.trunc(v.v) : v instanceof Chr ? v.c : v.v ?? v))
    }
    if (v instanceof Objeto) {
      const cv = this.conversaoDoAluno(v, t)
      if (cv !== undefined) return cv
    }
    if (def && !this.ehTipo(v, t)) {
      const cv = this.conversaoParaClasse(v, t, false) // (Fracao)3 com um explicit operator Fracao(int)
      if (cv !== undefined) return cv
    }
    if (t === 'string' && typeof v !== 'string') throw this.excecao('InvalidCastException', `Unable to cast object of type '${this.nomeDoTipoDe(v)}' to type 'System.String'.`)
    if (def && !this.ehTipo(v, t)) throw this.excecao('InvalidCastException', `Unable to cast object of type '${this.nomeDoTipoDe(v)}' to type '${def.nome}'.`)
    void n
    return v
  },

  conversaoDoAluno(v, tipoAlvo) {
    for (let c = v.cls; c; c = c.base) {
      const cv = c.conversoes.find((x) => semNulo(x.tipoRetorno) === tipoAlvo)
      if (cv) return this.rodarSync(this.chamarMetodo(cv, null, [v], cv.cls))
    }
    return undefined
  },

  criarLambda(n, amb) {
    const ps = []
    if (n.t === 'anonymous_method_expression') {
      for (const p of this.lerParametros(filho(n, 'parameters'))) ps.push({ nome: p.nome, tipo: p.tipo, modo: p.modo })
    } else {
      const lista = filho(n, 'parameters')
      if (lista) {
        for (const p of this.lerParametros(lista)) ps.push({ nome: p.nome, tipo: p.tipo === 'var' ? null : p.tipo, modo: p.modo })
        if (!ps.length) for (const x of lista.f) if (x.t === 'identifier') ps.push({ nome: x.x, tipo: null })
      } else {
        const id = n.f.find((x) => x.t === 'identifier' && !x.k)
        if (id) ps.push({ nome: id.x, tipo: null })
      }
    }
    const corpo = filho(n, 'body') ?? n.f.find((x) => x.t === 'block') ?? n.f[n.f.length - 1]
    const assincrono = n.f.some((x) => x.t === 'modifier' && x.f?.[0]?.x === 'async') || n.f.some((x) => x.t === 'async')
    return new Lambda(ps, corpo, amb, assincrono, n.l)
  },

  *avalAwait(n, amb) {
    const v = yield* this.aval(n.f[n.f.length - 1], amb)
    return this.bib.esperar(this, v)
  },

  // ---- switch como expressão ----------------------------------------------------------------------------------

  *avalSwitchExpressao(n, amb, tipo) {
    const alvo = n.f[0]
    const v = yield* this.aval(alvo, amb)
    for (const arma of n.f.filter((x) => x.t === 'switch_expression_arm')) {
      const escopo = new Amb(amb)
      const partes = arma.f
      const padrao = partes[0]
      const guarda = partes.find((x) => x.t === 'when_clause')
      const resultado = partes[partes.length - 1]
      if (!(yield* this.casarPadrao(padrao, v, escopo))) continue
      if (guarda && (yield* this.aval(guarda.f[guarda.f.length - 1], escopo)) !== true) continue
      return yield* this.avalComTipo(resultado, escopo, tipo)
    }
    throw this.excecao('InvalidOperationException', `Nenhum braço do switch aceitou o valor ${this.aTexto(v)} (SwitchExpressionException).`)
  },

  // ---- índices e intervalos -----------------------------------------------------------------------------------

  extremosDeIntervalo(n) {
    // a..b, ..b, a.., ..  — o ".." é um nó; o que vem antes é o início, depois é o fim.
    const filhos = n.f
    const i = filhos.findIndex((x) => x.t === '..')
    const antes = i > 0 ? filhos[i - 1] : null
    const depois = i >= 0 && i + 1 < filhos.length ? filhos[i + 1] : null
    return [antes, depois]
  },

  *avalIndice(n, amb) {
    if (n.t === 'prefix_unary_expression' && n.f[0].x === '^') return new Indice(yield* this.aval(n.f[1], amb), true)
    return new Indice(yield* this.aval(n, amb), false)
  },

  // ---- with, anônimos ----------------------------------------------------------------------------------------

  *avalWith(n, amb) {
    const origem = yield* this.aval(n.f[0], amb)
    if (!(origem instanceof Objeto)) throw new ErroCS('with só funciona com records e structs', n.l)
    const copia = new Objeto(origem.cls)
    for (const [k, v] of origem.campos) copia.campos.set(k, this.copiar(v))
    const ini = n.f.find((x) => x.t === 'with_initializer_expression')
    for (const a of ini?.f ?? []) {
      const nome = a.f[0].x
      const v = yield* this.aval(a.f[a.f.length - 1], amb)
      copia.campos.set(nome, v)
    }
    return copia
  },

  *avalAnonimo(n, amb) {
    const campos = []
    const filhos = n.f.filter((x) => x.t !== 'new')
    for (let i = 0; i < filhos.length; i += 1) {
      const f = filhos[i]
      if (f.t === 'name_equals') {
        const v = yield* this.aval(filhos[i + 1], amb)
        campos.push([f.f[0].x, v])
        i += 1
      } else {
        const nome = f.t === 'member_access_expression' ? filho(f, 'name').x : f.x
        campos.push([nome, yield* this.aval(f, amb)])
      }
    }
    return this.bib.criarAnonimo(this, campos)
  },

  // ---- LINQ em sintaxe de consulta ---------------------------------------------------------------------------

  *avalConsulta(n, amb) {
    return yield* this.processarConsulta(n.f, amb, [new Map()])
  },

  /**
   * from x in fonte where ... let ... orderby ... join ... select/group ... [into y ...]
   * Cada "linha" da consulta é um Map com as variáveis (x, y, os let...) naquele ponto.
   */
  *processarConsulta(clausulas, amb, linhas) {
    const escopoDe = (linha) => {
      const a = new Amb(amb)
      for (const [k, v] of linha) a.declarar(k, new Ref(v))
      return a
    }
    const nomeDe = (c) => c.f.find((x) => x.t === 'identifier').x
    for (let i = 0; i < clausulas.length; i += 1) {
      const c = clausulas[i]
      switch (c.t) {
        case 'from_clause': {
          const nome = nomeDe(c)
          const prox = []
          for (const linha of linhas) {
            const fonte = yield* this.aval(c.f[c.f.length - 1], escopoDe(linha))
            for (const item of yield* this.iterarGen(fonte)) prox.push(new Map([...linha, [nome, item]]))
          }
          linhas = prox
          break
        }
        case 'where_clause': {
          const prox = []
          for (const linha of linhas) if ((yield* this.aval(c.f[c.f.length - 1], escopoDe(linha))) === true) prox.push(linha)
          linhas = prox
          break
        }
        case 'let_clause': {
          const nome = nomeDe(c)
          for (const linha of linhas) linha.set(nome, yield* this.aval(c.f[c.f.length - 1], escopoDe(linha)))
          break
        }
        case 'order_by_clause': {
          const chaves = []
          for (const f of c.f) {
            if (f.t === 'orderby' || f.t === 'ascending') continue
            if (f.t === 'descending') chaves[chaves.length - 1].desc = true
            else chaves.push({ expr: f, desc: false })
          }
          const calc = []
          for (const linha of linhas) {
            const ks = []
            for (const k of chaves) ks.push(yield* this.aval(k.expr, escopoDe(linha)))
            calc.push({ linha, ks })
          }
          calc.sort((a, b) => {
            for (let k = 0; k < chaves.length; k += 1) {
              const r = this.comparar(a.ks[k], b.ks[k])
              if (r !== 0) return chaves[k].desc ? -r : r
            }
            return 0
          })
          linhas = calc.map((x) => x.linha)
          break
        }
        case 'join_clause': {
          // join b in ys on a.Id equals b.Id [into g]
          const nome = nomeDe(c)
          const partes = c.f.filter((x) => !['join', 'in', 'on', 'equals', 'join_into_clause'].includes(x.t) && x.t !== 'identifier')
          const [fonteNo, chaveEsq, chaveDir] = partes
          const into = c.f.find((x) => x.t === 'join_into_clause')
          const prox = []
          for (const linha of linhas) {
            const fonte = yield* this.iterarGen(yield* this.aval(fonteNo, escopoDe(linha)))
            const k = yield* this.aval(chaveEsq, escopoDe(linha))
            const achados = []
            for (const item of fonte) {
              const kd = yield* this.aval(chaveDir, escopoDe(new Map([...linha, [nome, item]])))
              if (this.igualObjetosValor(k, kd)) achados.push(item)
            }
            if (into) prox.push(new Map([...linha, [nomeDe(into), this.bib.linq.lista(this, achados)]]))
            else for (const a of achados) prox.push(new Map([...linha, [nome, a]]))
          }
          linhas = prox
          break
        }
        case 'select_clause': case 'group_clause': {
          const resultado = []
          if (c.t === 'select_clause') {
            for (const linha of linhas) resultado.push(yield* this.aval(c.f[c.f.length - 1], escopoDe(linha)))
          } else {
            const [expr, chave] = c.f.filter((x) => x.t !== 'group' && x.t !== 'by')
            const grupos = new Map()
            for (const linha of linhas) {
              const k = yield* this.aval(chave, escopoDe(linha))
              const h = this.hashDe(k)
              if (!grupos.has(h)) grupos.set(h, { k, itens: [] })
              grupos.get(h).itens.push(yield* this.aval(expr, escopoDe(linha)))
            }
            for (const g of grupos.values()) resultado.push(this.bib.criarAgrupamento(g.k, g.itens))
          }
          const cont = clausulas[i + 1]
          if (cont?.t === 'query_continuation') {
            const nome = nomeDe(cont)
            const resto = cont.f.filter((x) => x.t !== 'into' && !(x.t === 'identifier' && x === cont.f.find((y) => y.t === 'identifier')))
            return yield* this.processarConsulta(resto, amb, resultado.map((x) => new Map([[nome, x]])))
          }
          return this.bib.linq.lista(this, resultado)
        }
        default:
          throw new ErroCS(`a consulta LINQ usa uma cláusula que o passo a passo ainda não conhece (${c.t})`, c.l)
      }
    }
    return this.bib.linq.lista(this, linhas.map((l) => [...l.values()].pop()))
  },

  igualObjetosValor(a, b) {
    return this.hashDe(a) === this.hashDe(b)
  },
  /** Todos os itens de uma coleção (para código que precisa deles de uma vez). */
  *iterarGen(fonte) {
    const itens = []
    const it = yield* this.criarIterador(fonte, this.linhaAtual)
    for (;;) {
      const p = yield* it.prox()
      if (p.fim) break
      itens.push(p.v)
    }
    return itens
  },

  // ---- as partes de string.Format que dependem da máquina ----------------------------------------------------

  formatar(texto, args) {
    return compor(texto, args, (v, fmt) => this.aTexto(v, fmt))
  },
}

export { ExcecaoCS, Chr, Dec, Flt, Num, Multicast }
