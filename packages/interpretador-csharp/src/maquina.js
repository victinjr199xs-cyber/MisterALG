// A máquina do C#: lê a árvore (analisar.js), monta as classes e executa o programa como um gerador,
// que "cede" um evento a cada linha — é assim que o passo a passo (F8) para em qualquer ponto.
//
// Este arquivo tem a base (classes, ambientes, tipos, chamadas). As instruções ficam em instrucoes.js,
// as expressões em expressoes.js, os padrões (is, switch) em padroes.js e a biblioteca em biblioteca/.

import { ErroCS, ExcecaoCS } from './erros.js'
import { Multicast, igualdade, igualValor } from './operadores.js'
import { elementoDe, ehArray, nomeCompleto, nomeTipo, partesGenericas, semNulo, ehNumericoNome } from './tipos.js'
import {
  Arr, Chr, Dbl, DivisaoPorZero, Dec, Flt, Num, Objeto, Ref, RefCampo, RefElem, Tupla, ValorEnum,
  converterNumero, ehNumero, tipoNumerico,
} from './valores.js'
import { formatarData, formatarNumero, textoGeral, CULTURAS } from './formatar.js'

export const MAX_PILHA = 600

const filho = (n, campo) => n.f?.find((x) => x.k === campo)
const filhosDe = (n, tipo) => (n.f ?? []).filter((x) => x.t === tipo)

/** Uma classe, struct, record, interface ou enum do programa (ou da biblioteca em C#, o "prelúdio"). */
export class ClasseDef {
  constructor(nome, tipo, ns, no) {
    this.nome = nome
    this.tipo = tipo // class | struct | interface | record | recordstruct | enum
    this.ns = ns
    this.no = no
    this.mods = new Set()
    this.nomesBase = []
    this.base = null
    this.interfaces = []
    this.genericos = []
    this.campos = [] // de instância: { nome, tipo, init }
    this.estaticos = new Map() // nome → Ref
    this.camposEstaticos = [] // { nome, tipo, init, constante }
    this.metodos = new Map() // nome → [MetodoDef]
    this.propriedades = new Map() // nome → PropDef
    this.construtores = []
    this.construtorEstatico = null
    this.operadores = new Map() // '+' → [MetodoDef]
    this.conversoes = [] // MetodoDef (implicit / explicit operator)
    this.indexadores = []
    this.eventos = new Set()
    this.aninhadas = new Map()
    this.externa = null
    this.membrosEnum = null // Map nome → ValorEnum
    this.recordParams = null
    this.iniciada = false
    this.ehPrelude = false
  }

  get nomeCompleto() { return this.ns ? `${this.ns}.${this.nome}` : this.nome }
  get ehTipoValor() { return this.tipo === 'struct' || this.tipo === 'recordstruct' || this.tipo === 'enum' }
  get ehRecord() { return this.tipo === 'record' || this.tipo === 'recordstruct' }
  get ehAbstrata() { return this.mods.has('abstract') }

  /** Esta classe é `outra` (ou herda dela, ou a implementa)? */
  deriva(outra) {
    if (this === outra) return true
    if (this.base?.deriva(outra)) return true
    return this.interfaces.some((i) => i.deriva(outra))
  }

  /** O valor de enum com esse número (combinações de flags viram valores sem nome). */
  valorDe(v) {
    for (const m of this.membrosEnum.values()) if (m.v === v) return m
    return new ValorEnum(this, null, v)
  }
}

export class Amb {
  constructor(pai, ctx) {
    this.vars = new Map()
    this.pai = pai
    this.ctx = ctx ?? pai.ctx
  }

  buscar(nome) {
    for (let a = this; a; a = a.pai) {
      const r = a.vars.get(nome)
      if (r !== undefined) return r
    }
    return null
  }

  declarar(nome, ref) {
    this.vars.set(nome, ref)
    return ref
  }
}

/** Uma chamada de método em andamento (a pilha de chamadas que a tela mostra). */
export class Quadro {
  constructor(nome, amb, linha) { this.nome = nome; this.amb = amb; this.linha = linha }
}

/** O objeto devolvido por um método com yield: guarda o gerador que roda o corpo. */
export class IteradorUsuario {
  constructor(gerador) { this.gen = gerador; this.fim = false }
}

/** Atalho: o resultado de uma instrução que muda o fluxo. */
export const BREAK = { t: 'break' }
export const CONTINUE = { t: 'continue' }

const NOMES_MOD = new Set(['public', 'private', 'protected', 'internal', 'static', 'abstract', 'virtual', 'override', 'sealed', 'readonly', 'const', 'async', 'partial', 'new', 'extern', 'unsafe', 'volatile', 'required', 'file'])

export class MaquinaCS {
  /**
   * @param ast a árvore do programa (analisar.js)
   * @param preludioAst a árvore do prelúdio (a biblioteca escrita em C#: exceções, interfaces...)
   * @param op saida(texto), aleatorio (semente), agora() (Date), cultura
   */
  constructor(ast, preludioAst, op = {}) {
    this.op = op
    this.ast = ast
    this.preludioAst = preludioAst
    this.classes = new Map() // nome simples → ClasseDef (a última declarada vence)
    this.porNomeCompleto = new Map()
    this.pilha = []
    this.globais = [] // instruções de nível superior
    this.usings = new Set()
    this.usingsEstaticos = []
    this.cultura = CULTURAS['pt-BR']
    this.linhaAtual = 0
    this.aleatorio = op.aleatorio
    this.relogioExtra = 0 // ms "dormidos" (Thread.Sleep não trava a IDE: o relógio só anda)
    this.saidaTexto = op.saida ?? (() => {})
    this.ultimaCor = null
    this.contadorProfundidade = 0
    this.verificado = 0 // dentro de checked { }, o estouro de inteiros vira OverflowException
    this.bib = null
  }

  // ---- montagem -------------------------------------------------------------------------------------

  preparar() {
    if (this.preludioAst) this.declararUnidade(this.preludioAst, true)
    this.declararUnidade(this.ast, false)
    for (const c of new Set([...this.classes.values(), ...this.porNomeCompleto.values()])) this.resolverBases(c)
    this.aprontarEnums()
    this.achado = this.acharPrincipal()
  }

  declararUnidade(raiz, ehPrelude) {
    this.ehPreludeAtual = ehPrelude
    const percorrer = (n, ns) => {
      for (const f of n.f ?? []) {
        switch (f.t) {
          case 'using_directive': this.registrarUsing(f); break
          case 'namespace_declaration': percorrer(filho(f, 'body') ?? f, `${ns ? `${ns}.` : ''}${this.nomeQualificado(filho(f, 'name'))}`); break
          case 'file_scoped_namespace_declaration': {
            const nome = `${ns ? `${ns}.` : ''}${this.nomeQualificado(filho(f, 'name'))}`
            percorrer(f, nome)
            break
          }
          case 'class_declaration': case 'struct_declaration': case 'interface_declaration': case 'record_declaration':
          case 'record_struct_declaration': case 'enum_declaration':
            this.declararTipo(f, ns, null)
            break
          case 'delegate_declaration': this.declararDelegate(f, ns); break
          case 'global_statement': if (!ehPrelude) this.globais.push(f.f[0]); break
          default:
        }
      }
    }
    percorrer(raiz, '')
  }

  nomeQualificado(n) {
    if (!n) return ''
    if (n.t === 'qualified_name') return n.f.map((x) => this.nomeQualificado(x)).join('.')
    return n.x ?? ''
  }

  registrarUsing(n) {
    const nome = n.f.filter((x) => x.t === 'identifier' || x.t === 'qualified_name')
    const temStatic = n.f.some((x) => x.t === 'static')
    if (temStatic && nome[0]) this.usingsEstaticos.push(this.nomeQualificado(nome[0]))
    else if (nome[0]) this.usings.add(this.nomeQualificado(nome[nome.length - 1]))
  }

  declararDelegate(n, ns) {
    const nome = filho(n, 'name').x
    const def = new ClasseDef(nome, 'delegate', ns, n)
    def.params = this.lerParametros(filho(n, 'parameters'))
    def.tipoRetorno = nomeTipo(filho(n, 'type'))
    this.registrar(def, null)
  }

  registrar(def, externa) {
    def.externa = externa
    def.ehPrelude = this.ehPreludeAtual
    const completo = externa ? `${externa.nomeCompleto}.${def.nome}` : def.nomeCompleto
    this.porNomeCompleto.set(completo, def)
    if (externa) externa.aninhadas.set(def.nome, def)
    if (!this.classes.has(def.nome) || !def.ehPrelude) this.classes.set(def.nome, def)
  }

  modificadores(n) {
    const s = new Set()
    for (const f of n.f ?? []) {
      if (f.t === 'modifier') s.add(f.f?.[0]?.x ?? f.x)
    }
    return s
  }

  declararTipo(n, ns, externa) {
    const tipo = { class_declaration: 'class', struct_declaration: 'struct', interface_declaration: 'interface', record_declaration: 'record', record_struct_declaration: 'recordstruct', enum_declaration: 'enum' }[n.t]
    const nome = filho(n, 'name').x
    const def = new ClasseDef(nome, tipo, ns, n)
    def.mods = this.modificadores(n)
    const tp = filho(n, 'type_parameters')
    if (tp) def.genericos = tp.f.filter((x) => x.t === 'type_parameter').map((x) => filho(x, 'name')?.x ?? x.f[0].x)
    const bases = filho(n, 'bases')
    if (bases) def.nomesBase = bases.f.map((b) => partesGenericas(nomeTipo(b.t === 'primary_constructor_base_type' ? b.f[0] : b)).nome)
    const params = filho(n, 'parameters')
    if (params && (tipo === 'record' || tipo === 'recordstruct' || tipo === 'class' || tipo === 'struct')) {
      def.recordParams = this.lerParametros(params)
      def.primario = tipo === 'record' || tipo === 'recordstruct' ? 'record' : 'classe'
    }
    this.registrar(def, externa)
    const corpo = filho(n, 'body')
    if (tipo === 'enum') this.declararMembrosEnum(def, corpo)
    else for (const m of corpo?.f ?? []) this.declararMembro(def, m, ns)
    return def
  }

  declararMembrosEnum(def, corpo) {
    def.membrosEnum = new Map()
    def.enumPendentes = []
    let proximo = 0
    for (const m of corpo?.f ?? []) {
      if (m.t !== 'enum_member_declaration') continue
      const nome = filho(m, 'name').x
      const valor = filho(m, 'value')
      if (valor) def.enumPendentes.push({ nome, valor })
      else def.enumPendentes.push({ nome, valor: null })
      void proximo
    }
  }

  /** Calcula os números dos membros de enum (valores explícitos podem ser contas simples). */
  aprontarEnums() {
    for (const def of this.porNomeCompleto.values()) {
      if (def.tipo !== 'enum' || def.enumPronto) continue
      def.enumPronto = true
      let proximo = 0
      for (const { nome, valor } of def.enumPendentes) {
        let v = proximo
        if (valor) v = this.avalConstante(valor, def)
        def.membrosEnum.set(nome, new ValorEnum(def, nome, v))
        proximo = v + 1
      }
    }
  }

  avalConstante(n, def) {
    const gerador = this.aval(n, new Amb(null, { cls: def, este: null }))
    const r = this.rodarSync(gerador)
    return typeof r === 'number' ? r : ehNumero(r) ? Number(r instanceof Chr ? r.c : r.v ?? r) : 0
  }

  lerParametros(lista) {
    const ps = []
    if (!lista) return ps
    const filhos = lista.f ?? []
    for (let i = 0; i < filhos.length; i += 1) {
      const p = filhos[i]
      if (p.t === 'parameter') {
        const modo = p.f.find((x) => x.t === 'parameter_modifier')?.x ?? null
        const tipoNo = filho(p, 'type')
        const padrao = p.f.find((x) => x.t === 'equals_value_clause')
        ps.push({
          nome: filho(p, 'name')?.x ?? p.f.find((x) => x.t === 'identifier')?.x,
          tipo: tipoNo ? nomeTipo(tipoNo) : 'var',
          modo: modo === 'this' ? null : modo,
          este: modo === 'this',
          padrao: padrao ? padrao.f[padrao.f.length - 1] : null,
          ehParams: false,
        })
      } else if (p.t === 'params') {
        // "params int[] resto": o tree-sitter solta o tipo e o nome ao lado do "params".
        const tipoNo = filhos[i + 1]
        const nomeNo = filhos[i + 2]
        ps.push({ nome: nomeNo.x ?? filho(nomeNo, 'name')?.x, tipo: nomeTipo(tipoNo), modo: null, este: false, padrao: null, ehParams: true })
        i += 2
      }
    }
    return ps
  }

  declararMembro(def, m, ns) {
    const mods = this.modificadores(m)
    const estatico = mods.has('static') || mods.has('const')
    switch (m.t) {
      case 'field_declaration': case 'event_field_declaration': {
        const vd = m.f.find((x) => x.t === 'variable_declaration')
        const tipo = nomeTipo(filho(vd, 'type'))
        for (const d of vd.f.filter((x) => x.t === 'variable_declarator')) {
          const nome = d.f.find((x) => x.t === 'identifier').x
          const ev = d.f.find((x) => x.t === 'equals_value_clause')
          const campo = { nome, tipo, init: ev ? ev.f[ev.f.length - 1] : null, constante: mods.has('const'), somenteLeitura: mods.has('readonly') }
          if (m.t === 'event_field_declaration') def.eventos.add(nome)
          if (estatico) def.camposEstaticos.push(campo)
          else def.campos.push(campo)
        }
        break
      }
      case 'property_declaration': def.propriedades.set(filho(m, 'name').x, this.lerDeclaracaoPropriedade(def, m, mods, estatico)); break
      case 'indexer_declaration': def.indexadores.push(this.lerDeclaracaoPropriedade(def, m, mods, false, true)); break
      case 'method_declaration': {
        const espec = m.f.find((x) => x.t === 'explicit_interface_specifier')
        const nome = (espec ? `${espec.f.find((x) => x.x)?.x}.` : '') + filho(m, 'name').x
        const md = this.lerMetodo(def, m, mods, nome)
        if (!def.metodos.has(nome)) def.metodos.set(nome, [])
        def.metodos.get(nome).push(md)
        break
      }
      case 'constructor_declaration': {
        const md = this.lerMetodo(def, m, mods, '.ctor')
        const ini = filho(m, 'initializer') ?? m.f.find((x) => x.t === 'constructor_initializer')
        if (ini) {
          md.inicializador = { tipo: ini.f[0].t === 'this' || ini.f[0].x === 'this' ? 'this' : 'base', args: ini.f.find((x) => x.t === 'argument_list') }
        }
        if (mods.has('static')) def.construtorEstatico = md
        else def.construtores.push(md)
        break
      }
      case 'operator_declaration': {
        const op = m.f.find((x) => x.k === 'operator')?.x
        const md = this.lerMetodo(def, m, mods, `operator ${op}`)
        md.estatico = true
        if (!def.operadores.has(op)) def.operadores.set(op, [])
        def.operadores.get(op).push(md)
        break
      }
      case 'conversion_operator_declaration': {
        const md = this.lerMetodo(def, m, mods, 'operator')
        md.estatico = true
        md.implicita = m.f.some((x) => x.t === 'implicit')
        md.tipoRetorno = nomeTipo(filho(m, 'type'))
        def.conversoes.push(md)
        break
      }
      case 'class_declaration': case 'struct_declaration': case 'interface_declaration': case 'record_declaration':
      case 'record_struct_declaration': case 'enum_declaration':
        this.declararTipo(m, ns, def)
        break
      case 'delegate_declaration': this.declararDelegate(m, ns); break
      default:
    }
  }

  lerMetodo(def, m, mods, nome) {
    const corpo = filho(m, 'body')
    const params = this.lerParametros(filho(m, 'parameters'))
    const tp = filho(m, 'type_parameters')
    const md = {
      nome,
      cls: def,
      params,
      tipoRetorno: nomeTipo(filho(m, 'type')),
      estatico: mods.has('static'),
      abstrato: mods.has('abstract') || (def.tipo === 'interface' && !corpo),
      virtual: mods.has('virtual'),
      sobrescreve: mods.has('override'),
      assincrono: mods.has('async'),
      genericos: tp ? tp.f.filter((x) => x.t === 'type_parameter').map((x) => filho(x, 'name')?.x ?? x.f[0].x) : [],
      corpo: corpo ?? null,
      iterador: corpo ? this.temYield(corpo) : false,
      extensao: params[0]?.este === true,
      linha: m.l,
    }
    return md
  }

  temYield(n) {
    if (n.t === 'yield_statement') return true
    if (n.t === 'lambda_expression' || n.t === 'anonymous_method_expression' || n.t === 'local_function_statement') return false
    return (n.f ?? []).some((x) => this.temYield(x))
  }

  lerDeclaracaoPropriedade(def, m, mods, estatico, indexador = false) {
    const prop = {
      nome: indexador ? 'this[]' : filho(m, 'name').x,
      tipo: nomeTipo(filho(m, 'type')),
      estatico,
      abstrata: mods.has('abstract'),
      cls: def,
      get: null,
      set: null,
      init: false,
      auto: false,
      valorInicial: null,
      params: indexador ? this.lerParametros(filho(m, 'parameters')) : null,
      linha: m.l,
    }
    const acessores = filho(m, 'accessors')
    const valor = filho(m, 'value')
    if (valor?.t === 'arrow_expression_clause') {
      prop.get = { corpo: valor.f[0], expressao: true }
    } else if (acessores) {
      for (const a of acessores.f) {
        const tipo = a.f.find((x) => x.t === 'get' || x.t === 'set' || x.t === 'init')?.t
        const corpoA = filho(a, 'body') ?? a.f.find((x) => x.t === 'block' || x.t === 'arrow_expression_clause')
        const privado = this.modificadores(a).has('private')
        const acessor = corpoA ? { corpo: corpoA.t === 'arrow_expression_clause' ? corpoA.f[0] : corpoA, expressao: corpoA.t === 'arrow_expression_clause' } : { auto: true }
        if (tipo === 'get') prop.get = acessor
        else if (tipo === 'set' || tipo === 'init') {
          prop.set = acessor
          prop.init = tipo === 'init'
          prop.setPrivado = privado
        }
      }
      prop.auto = (prop.get?.auto ?? false) || (prop.set?.auto ?? false)
      if (valor) prop.valorInicial = valor
    }
    return prop
  }

  resolverBases(def) {
    if (def.resolvida) return
    def.resolvida = true
    for (const nome of def.nomesBase) {
      const b = this.classes.get(nome)
      if (!b) continue
      this.resolverBases(b)
      if (b.tipo === 'interface') def.interfaces.push(b)
      else if (!def.base && def.tipo !== 'interface') def.base = b
      else def.interfaces.push(b)
    }
    if (!def.base && def.tipo !== 'interface' && def.tipo !== 'enum' && def.tipo !== 'delegate') {
      const objeto = this.classes.get('Object')
      if (objeto && objeto !== def) def.base = def.tipo === 'struct' || def.tipo === 'recordstruct' ? this.classes.get('ValueType') ?? objeto : objeto
    }
  }

  acharPrincipal() {
    for (const def of this.porNomeCompleto.values()) {
      if (def.ehPrelude) continue
      const mains = def.metodos.get('Main')
      const md = mains?.find((x) => x.estatico)
      if (md) return { cls: def, metodo: md }
    }
    return null
  }

  // ---- execução do programa ------------------------------------------------------------------------

  *executar() {
    if (this.globais.length) {
      const ctx = { este: null, cls: this.classePrincipalImplicita(), quadro: null }
      const amb = new Amb(null, ctx)
      const quadro = new Quadro('Main', amb, this.globais[0].l)
      ctx.quadro = quadro
      this.pilha.push(quadro)
      this.ambienteGlobal = amb
      try {
        yield* this.declararLocais(this.globais, amb)
        for (const st of this.globais) {
          const r = yield* this.exec(st, amb)
          if (r && r.t === 'return') break
        }
      } finally {
        this.pilha.pop()
      }
      return
    }
    if (!this.achado) throw new ErroCS('o programa não tem um método Main', 1, 'Todo programa em C# começa no método static void Main(). Escreva-o dentro de uma classe (ou escreva as instruções direto no arquivo).')
    const { cls, metodo } = this.achado
    const args = metodo.params.length ? [new Arr('string', [])] : []
    const r = yield* this.chamarMetodo(metodo, null, args, cls)
    if (r instanceof Object && r.ehTarefa && r.excecao) throw r.excecao
    return typeof r === 'number' ? r : 0
  }

  classePrincipalImplicita() {
    const def = new ClasseDef('Program', 'class', '', null)
    def.resolvida = true
    return def
  }

  // ---- classes: campos, estáticos, instâncias ---------------------------------------------------------

  /** Roda os inicializadores estáticos de uma classe, uma vez, quando ela é usada pela primeira vez. */
  *iniciarClasse(def) {
    if (def.iniciada) return
    def.iniciada = true
    const ctx = { este: null, cls: def, quadro: null }
    for (const c of def.camposEstaticos) def.estaticos.set(c.nome, new Ref(this.valorPadrao(c.tipo), c.tipo))
    for (const c of def.camposEstaticos) {
      if (c.init) {
        const v = yield* this.avalComTipo(c.init, new Amb(null, ctx), c.tipo)
        def.estaticos.get(c.nome).v = this.coagir(v, c.tipo)
      }
    }
    if (def.tipo === 'enum') return
    for (const p of def.propriedades.values()) {
      if (p.estatico && p.auto) def.estaticos.set(p.nome, new Ref(this.valorPadrao(p.tipo), p.tipo))
    }
    for (const p of def.propriedades.values()) {
      if (p.estatico && p.valorInicial) {
        const ex = p.valorInicial.f ? p.valorInicial.f[p.valorInicial.f.length - 1] : p.valorInicial
        const v = yield* this.avalComTipo(ex, new Amb(null, ctx), p.tipo)
        def.estaticos.get(p.nome).v = this.coagir(v, p.tipo)
      }
    }
    if (def.construtorEstatico) yield* this.chamarMetodo(def.construtorEstatico, null, [], def)
  }

  /** O valor que o C# dá a uma variável de um tipo que ainda não recebeu nada. */
  valorPadrao(tipo) {
    if (!tipo) return null
    const t = tipo
    if (t.endsWith('?')) return null
    switch (t) {
      case 'int': return 0
      case 'bool': return false
      case 'double': return new Dbl(0)
      case 'float': return new Flt(0)
      case 'decimal': return new Dec(0n, 0)
      case 'long': return 0n
      case 'char': return new Chr(0)
      case 'byte': case 'sbyte': case 'short': case 'ushort': case 'uint': return new Num(t, 0)
      case 'ulong': return new Num('ulong', 0n)
      default:
    }
    const def = this.buscarClasse(partesGenericas(t).nome)
    if (def?.tipo === 'struct' || def?.tipo === 'recordstruct') {
      const o = new Objeto(def)
      this.inicializarCamposVazios(o, def)
      return o
    }
    if (def?.tipo === 'enum') return def.valorDe(0)
    if (t.startsWith('(') && t.endsWith(')')) return new Tupla(this.partesTupla(t).map((x) => this.valorPadrao(x)))
    return null
  }

  partesTupla(t) {
    return partesGenericas(`X<${t.slice(1, -1)}>`).args.map((a) => a.replace(/^\w+\s+/, (m) => (/^(int|long|double|string|bool|char|float|decimal|object|byte|short)\s/.test(m) ? m : '')))
  }

  inicializarCamposVazios(o, def) {
    if (def.base) this.inicializarCamposVazios(o, def.base)
    for (const c of def.campos) o.campos.set(c.nome, this.valorPadrao(c.tipo))
    for (const p of def.propriedades.values()) if (!p.estatico && p.auto) o.campos.set(p.nome, this.valorPadrao(p.tipo))
    if (def.recordParams) for (const p of def.recordParams) o.campos.set(p.nome, this.valorPadrao(p.tipo))
  }

  buscarClasse(nome) {
    if (!nome) return null
    return this.classes.get(nome) ?? this.porNomeCompleto.get(nome) ?? null
  }

  /** Procura o campo/propriedade/método estático por nome na classe e nas bases. */
  achaEstatico(def, nome) {
    for (let c = def; c; c = c.base) {
      if (c.estaticos.has(nome) || c.camposEstaticos.some((x) => x.nome === nome)) return c
      const p = c.propriedades.get(nome)
      if (p?.estatico) return c
    }
    return null
  }

  // ---- tipos em execução ------------------------------------------------------------------------------

  /** Converte o valor para o tipo declarado (int → double, int → long, etc.); outros tipos passam como estão. */
  coagir(v, tipo) {
    if (v instanceof Objeto && v.cls.tipo !== 'enum' && v.cls.ehTipoValor) return this.copiar(v)
    if (v === null || v === undefined || !tipo || tipo === 'var' || tipo === 'object') return v
    const t = semNulo(tipo)
    if (t === 'int') return typeof v === 'number' ? v : ehNumero(v) && !(v instanceof Dbl) && !(v instanceof Flt) ? converterNumero(v, 'int') : v
    if (ehNumericoNome(t)) {
      if (!ehNumero(v)) return this.conversaoImplicita(v, t) ?? v
      return tipoNumerico(v) === t ? v : converterNumero(v, t)
    }
    if (ehArray(t) || t === 'string' || t === 'bool' || t === 'dynamic') return v
    const nativo = this.bib?.coagirNativo(v, t)
    if (nativo !== undefined) return nativo
    return this.conversaoImplicita(v, t) ?? v
  }

  /** Operador implicit definido pelo aluno (class A { public static implicit operator int(A a) }). */
  conversaoImplicita(v, tipoAlvo) {
    if (!(v instanceof Objeto)) return undefined
    const procurar = (def) => {
      for (let c = def; c; c = c.base) {
        const cv = c.conversoes.find((x) => x.implicita && semNulo(x.tipoRetorno) === tipoAlvo)
        if (cv) return cv
      }
      return null
    }
    const cv = procurar(v.cls)
    return cv ? this.rodarSync(this.chamarMetodo(cv, null, [v], cv.cls)) : undefined
  }

  /** v é do tipo `tipo`? (para is, as, catch e casts) */
  ehTipo(v, tipo) {
    const t = semNulo(tipo)
    if (v === null || v === undefined) return false
    switch (t) {
      case 'object': return true
      case 'int': return typeof v === 'number'
      case 'long': return typeof v === 'bigint'
      case 'double': return v instanceof Dbl
      case 'float': return v instanceof Flt
      case 'decimal': return v instanceof Dec
      case 'char': return v instanceof Chr
      case 'string': return typeof v === 'string'
      case 'bool': return typeof v === 'boolean'
      case 'byte': case 'sbyte': case 'short': case 'ushort': case 'uint': case 'ulong': return v instanceof Num && v.k === t
      default:
    }
    if (ehArray(t)) return v instanceof Arr && (v.tipoElem === elementoDe(t) || elementoDe(t) === 'object')
    const { nome, args } = partesGenericas(t)
    if (v instanceof Objeto) {
      const alvo = this.buscarClasse(nome)
      return !!alvo && v.cls.deriva(alvo)
    }
    if (v instanceof ValorEnum) return v.def.nome === nome || nome === 'Enum'
    if (this.bib) return this.bib.ehTipoNativo(v, nome, args)
    return false
  }

  // ---- chamadas -------------------------------------------------------------------------------------

  /** Roda um gerador até o fim, sem pausar (para quando a biblioteca chama código do aluno). */
  rodarSync(gerador) {
    let r = gerador.next()
    while (!r.done) {
      if (r.value?.tipo === 'entrada') throw new ErroCS('ler do teclado (Console.ReadLine) dentro de uma chamada feita pela biblioteca ainda não funciona no passo a passo', this.linhaAtual)
      r = gerador.next()
    }
    return r.value
  }

  /** Chama um delegate ou lambda do aluno (ou um método nativo) de dentro de código nativo. */
  chamarFuncao(f, args) {
    return this.rodarSync(this.chamarFuncaoGen(f, args))
  }

  *chamarFuncaoGen(f, args) {
    if (f instanceof Multicast) {
      let r = null
      for (const x of f.itens) r = yield* this.chamarFuncaoGen(x, args)
      return r
    }
    if (!f) throw this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    if (f.ehFunc) return yield* f.invocar(this, args)
    throw new ErroCS(`isto não é uma função (${this.aTexto(f)})`, this.linhaAtual)
  }

  *chamarMetodo(md, este, args, clsContexto, extras = null) {
    if (this.pilha.length >= MAX_PILHA) throw this.excecao('InsufficientExecutionStackException', 'Stack overflow (muitas chamadas uma dentro da outra — recursão infinita?)')
    if (md.estatico && md.cls) yield* this.iniciarClasse(md.cls)
    if (!md.corpo) {
      if (md.abstrato) throw new ErroCS(`o método ${md.nome} é abstrato e não tem corpo`, this.linhaAtual)
      return null
    }
    const ctx = { este, cls: md.cls ?? clsContexto, quadro: null, metodo: md, tiposGenericos: md.genericos?.length ? this.mapaGenerico(md, args, extras?.tiposGenericos) : null }
    const amb = new Amb(md.fechamento ?? null, ctx)
    const linhaChamada = this.linhaAtual
    yield* this.ligarParametros(md, amb, args)
    const nome = md.cls && !md.local && md.nome !== '.ctor' ? `${md.cls.nome}.${md.nome}` : md.nome === '.ctor' ? `${md.cls.nome}.ctor` : md.nome
    const quadro = new Quadro(nome, amb, md.linha ?? linhaChamada)
    ctx.quadro = quadro
    ctx.estavaNaLinha = linhaChamada
    if (md.iterador) return this.criarIteradorUsuario(md, amb, quadro)
    this.pilha.push(quadro)
    try {
      let r
      if (md.corpo.t === 'arrow_expression_clause') {
        this.linhaAtual = md.corpo.l
        quadro.linha = md.corpo.l
        yield { tipo: 'linha', linha: md.corpo.l }
        r = yield* this.aval(md.corpo.f[0], amb)
      } else {
        const c = yield* this.execBloco(md.corpo, amb, false)
        r = c && c.t === 'return' ? c.v : undefined
      }
      if (md.assincrono) return this.tarefaCompleta(md, r)
      if (md.tipoRetorno === 'void' || r === undefined) return md.tipoRetorno === 'void' || md.tipoRetorno === undefined ? null : r === undefined ? this.valorPadrao(md.tipoRetorno) : r
      return this.coagir(r, md.tipoRetorno)
    } catch (e) {
      if (md.assincrono && e instanceof ExcecaoCS) return this.tarefaFalha(e)
      throw e
    } finally {
      this.pilha.pop()
      this.linhaAtual = linhaChamada
    }
  }

  /** Os tipos de T, U... de uma chamada genérica: os escritos (Metodo<int>) ou deduzidos dos argumentos. */
  mapaGenerico(md, args, explicitos) {
    const mapa = new Map()
    md.genericos.forEach((g, i) => { if (explicitos?.[i]) mapa.set(g, explicitos[i]) })
    md.params.forEach((p, i) => {
      const v = args[i]
      if (v === undefined || v === null) return
      const valor = v instanceof Ref ? v.v : v
      const direto = md.genericos.find((g) => g === p.tipo)
      if (direto && !mapa.has(direto)) mapa.set(direto, this.nomeDoTipoDe(valor))
      const arr = md.genericos.find((g) => p.tipo === `[]`)
      if (arr && valor instanceof Arr && !mapa.has(arr)) mapa.set(arr, valor.tipoElem)
      const gen = /^\w+<(\w+)>$/.exec(p.tipo)
      if (gen && md.genericos.includes(gen[1]) && !mapa.has(gen[1]) && valor?.tipoElem) mapa.set(gen[1], valor.tipoElem)
    })
    return mapa
  }

  tarefaCompleta(md, r) {
    return this.bib.criarTarefa(md.tipoRetorno === 'Task' || md.tipoRetorno === 'void' ? null : this.coagir(r, partesGenericas(md.tipoRetorno).args[0] ?? 'object'))
  }

  tarefaFalha(e) {
    return this.bib.criarTarefaFalha(e)
  }

  *ligarParametros(md, amb, args) {
    const ps = md.params
    let i = 0
    for (let k = 0; k < ps.length; k += 1) {
      const p = ps[k]
      if (p.ehParams) {
        const resto = args.slice(i)
        const unico = resto.length === 1 && (resto[0] instanceof Arr || resto[0] === null)
        const elem = elementoDe(p.tipo)
        amb.declarar(p.nome, new Ref(unico ? resto[0] : new Arr(elem, resto.map((x) => this.coagir(x, elem))), p.tipo))
        i = args.length
        continue
      }
      if (i < args.length && args[i] !== undefined) {
        const a = args[i]
        if (p.modo === 'ref' || p.modo === 'out') amb.declarar(p.nome, a instanceof Ref || a instanceof RefElem || a instanceof RefCampo ? a : new Ref(a, p.tipo))
        else amb.declarar(p.nome, new Ref(this.coagir(a, p.tipo), p.tipo))
      } else if (p.padrao) {
        const v = yield* this.aval(p.padrao, amb)
        amb.declarar(p.nome, new Ref(this.coagir(v, p.tipo), p.tipo))
      } else if (p.modo === 'out') {
        amb.declarar(p.nome, new Ref(this.valorPadrao(p.tipo), p.tipo))
      } else {
        throw new ErroCS(`faltou o argumento "${p.nome}" na chamada de ${md.nome}`, this.linhaAtual, 'Confira a quantidade de valores passados na chamada.')
      }
      i += 1
    }
  }

  /** Gerador de um método com yield: o corpo só roda quando alguém pede o próximo item. */
  criarIteradorUsuario(md, amb, quadro) {
    const maq = this
    const gerador = (function* corpo() {
      maq.pilha.push(quadro)
      try {
        const c = yield* maq.execBloco(md.corpo, amb, false)
        return c && c.t === 'return' ? c.v : undefined
      } finally {
        maq.pilha.pop()
      }
    }())
    return new IteradorUsuario(gerador)
  }

  // ---- escolha de sobrecarga ----------------------------------------------------------------------------

  /** Pontua o quanto um valor combina com o tipo do parâmetro (-1 = não serve). */
  combina(v, tipo) {
    if (tipo === 'var' || tipo === 'object' || tipo === 'dynamic') return 1
    const t = semNulo(tipo)
    if (v === null) return t === tipo && (ehNumericoNome(t) || t === 'bool' || t === 'char') ? -1 : 2
    if (this.ehTipo(v, t)) return 4
    if (ehNumero(v) && ehNumericoNome(t)) {
      const de = tipoNumerico(v)
      const ordem = ['sbyte', 'byte', 'short', 'ushort', 'char', 'int', 'uint', 'long', 'ulong', 'float', 'double', 'decimal']
      const a = ordem.indexOf(de)
      const b = ordem.indexOf(t)
      if (a >= 0 && b >= a) return 3 - Math.min(2, (b - a) / 6)
      return -1
    }
    const def = this.buscarClasse(partesGenericas(t).nome)
    if (def && v instanceof Objeto) return -1
    if (v instanceof Objeto) return t.length === 1 || this.conversaoImplicita(v, t) !== undefined ? 1 : -1
    if (this.bib?.combinaNativo) {
      const c = this.bib.combinaNativo(v, t)
      if (c !== undefined) return c
    }
    if (ehArray(t) || /^[A-Z]$/.test(t) || def) return v instanceof Arr || def ? -1 : 1
    return t.length <= 2 ? 1 : -1
  }

  escolherSobrecarga(candidatos, args, nomeados = null) {
    let melhor = null
    let melhorPontos = -Infinity
    for (const md of candidatos) {
      const ps = md.params
      const obrig = ps.filter((p) => !p.padrao && !p.ehParams).length
      const temParams = ps.some((p) => p.ehParams)
      const n = args.length
      if (n < obrig && !(nomeados && nomeados.size)) continue
      if (n > ps.length && !temParams) continue
      let pontos = 0
      let ok = true
      for (let i = 0; i < n && ok; i += 1) {
        const p = ps[Math.min(i, ps.length - 1)]
        if (!p) { ok = false; break }
        if (p.ehParams) {
          const elem = elementoDe(p.tipo)
          const s = (args[i] instanceof Arr && n === ps.length) ? 4 : this.combina(args[i], elem)
          if (s < 0) ok = false
          else pontos += s - 0.5
          continue
        }
        if (p.modo === 'ref' || p.modo === 'out') { pontos += 2; continue }
        const s = this.combina(args[i], p.tipo)
        if (s < 0) ok = false
        else pontos += s
      }
      if (!ok) continue
      pontos -= Math.abs(ps.length - n) * 0.1
      if (pontos > melhorPontos) {
        melhor = md
        melhorPontos = pontos
      }
    }
    return melhor
  }

  /** Todos os métodos com esse nome visíveis a partir da classe (a mais derivada primeiro), com as interfaces. */
  metodosDe(def, nome) {
    const lista = []
    const vistos = new Set()
    const visitar = (c) => {
      if (!c || vistos.has(c)) return
      vistos.add(c)
      for (const md of c.metodos.get(nome) ?? []) lista.push(md)
      visitar(c.base)
      for (const i of c.interfaces) visitar(i)
    }
    visitar(def)
    return lista
  }

  // ---- exceções -------------------------------------------------------------------------------------

  /** Cria um objeto de exceção da biblioteca (ex.: 'DivideByZeroException') com a mensagem. */
  criarObjetoExcecao(nome, mensagem, interna = null) {
    const def = this.buscarClasse(nome) ?? this.buscarClasse('Exception')
    const o = new Objeto(def)
    this.inicializarCamposVazios(o, def)
    o.campos.set('_mensagem', mensagem)
    o.campos.set('_interna', interna)
    o.linha = this.linhaAtual
    return o
  }

  excecao(nome, mensagem) {
    return new ExcecaoCS(this.criarObjetoExcecao(nome, mensagem), this.linhaAtual)
  }

  /** Converte erros internos do JavaScript no equivalente do C#. */
  converterErroInterno(e) {
    if (e instanceof ExcecaoCS || e instanceof ErroCS) return e
    if (e instanceof DivisaoPorZero) return this.excecao('DivideByZeroException', 'Attempted to divide by zero.')
    if (e instanceof RangeError && /call stack/i.test(e.message)) return this.excecao('InsufficientExecutionStackException', 'Stack overflow (muitas chamadas uma dentro da outra — recursão infinita?)')
    if (e && e.name === 'ErroFormato') return this.excecao('FormatException', e.message)
    if (e && e.csExcecao) return this.excecao(e.csExcecao, e.message)
    return e
  }

  // ---- texto -------------------------------------------------------------------------------------------

  /** valor.ToString() como o C# faz (com o ToString do aluno, se houver). */
  aTexto(v, formato, cultura = this.cultura) {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'boolean') return v ? 'True' : 'False'
    if (ehNumero(v)) return formatarNumero(v, formato, cultura)
    if (v instanceof ValorEnum) return this.textoEnum(v, formato)
    if (v instanceof Objeto) return this.textoObjeto(v, formato)
    if (v instanceof Tupla) return `(${v.itens.map((x) => this.aTexto(x)).join(', ')})`
    if (v instanceof Arr) return nomeCompleto(`${v.tipoElem}[${v.dims ? ','.repeat(v.dims.length - 1) : ''}]`)
    if (v instanceof Multicast) return 'System.MulticastDelegate'
    if (v.paraTexto) return v.paraTexto(this, formato, cultura)
    if (v.ehFunc) return v.nomeTipo ?? 'System.Func'
    return String(v)
  }

  textoEnum(v, formato) {
    if (formato === 'D' || formato === 'd') return String(v.v)
    if (formato === 'X' || formato === 'x') return v.v.toString(16).toUpperCase().padStart(8, '0')
    if (v.nome !== null) return v.nome
    // [Flags]: soma de membros
    const partes = []
    let resto = v.v
    for (const m of [...v.def.membrosEnum.values()].reverse()) {
      if (m.v !== 0 && (resto & m.v) === m.v && (m.v & (m.v - 1)) === 0) {
        partes.unshift(m.nome)
        resto &= ~m.v
      }
    }
    return resto === 0 && partes.length ? partes.join(', ') : String(v.v)
  }

  textoObjeto(o, formato) {
    const ts = this.acharMetodoVirtual(o.cls, 'ToString', 0)
    if (ts && !ts.cls.ehPrelude) return this.aTexto(this.rodarSync(this.chamarMetodo(ts, o, [], ts.cls)))
    if (o.cls.ehRecord) return this.textoRecord(o)
    if (ts) return this.aTexto(this.rodarSync(this.chamarMetodo(ts, o, [], ts.cls)))
    void formato
    return o.cls.nomeCompleto
  }

  textoRecord(o) {
    const nomes = []
    const coletar = (c) => {
      if (c.base) coletar(c.base)
      for (const p of c.recordParams ?? []) nomes.push(p.nome)
      for (const p of c.propriedades.values()) if (!p.estatico && (p.auto || p.get?.auto)) nomes.push(p.nome)
    }
    coletar(o.cls)
    const unicos = [...new Set(nomes)]
    const corpo = `{ ${unicos.map((n) => `${n} = ${this.aTextoLiteral(o.campos.get(n))}`).join(', ')} }`
    return o.cls.anonima ? corpo : `${o.cls.nome} ${corpo}`
  }

  /** Um KeyValuePair (do prelúdio) para o foreach de um dicionário. */
  novoKV(k, v) {
    const o = new Objeto(this.buscarClasse('KeyValuePair'))
    o.campos.set('Key', k)
    o.campos.set('Value', v)
    return o
  }

  /** A hora "agora" em ms (Thread.Sleep e Task.Delay só adiantam este relógio: não travam a IDE). */
  agoraMs() {
    return (this.op.agora ? this.op.agora() : Date.now()) + this.relogioExtra
  }

  aTextoLiteral(v) {
    return typeof v === 'string' ? v : this.aTexto(v)
  }

  acharMetodoVirtual(def, nome, nArgs) {
    for (const md of this.metodosDe(def, nome)) {
      if (md.params.length === nArgs && md.corpo && !md.estatico) return md
    }
    return null
  }

  // ---- igualdade de objetos ------------------------------------------------------------------------------

  igualObjetos(a, b) {
    if (a === b) return true
    const op = (def) => {
      for (let c = def; c; c = c.base) {
        const lista = c.operadores.get('==')
        if (lista?.length) return lista[0]
      }
      return null
    }
    const dono = a instanceof Objeto ? a : b
    const md = op(dono.cls)
    if (md) return this.rodarSync(this.chamarMetodo(md, null, [a, b], md.cls)) === true
    if (a instanceof Objeto && b instanceof Objeto && (a.cls.ehRecord || a.cls.ehTipoValor)) return this.equalsObjeto(a, b)
    return false
  }

  /** object.Equals do objeto: o Equals do aluno, ou os campos (record e struct), ou a mesma referência. */
  equalsObjeto(a, b) {
    if (a === b) return true
    if (!(b instanceof Objeto) && !(a.cls.ehRecord || a.cls.ehTipoValor)) {
      const eq = this.acharMetodoVirtual(a.cls, 'Equals', 1)
      return eq && !eq.cls.ehPrelude ? this.rodarSync(this.chamarMetodo(eq, a, [b], eq.cls)) === true : false
    }
    const eq = this.acharMetodoVirtual(a.cls, 'Equals', 1)
    if (eq && !eq.cls.ehPrelude) return this.rodarSync(this.chamarMetodo(eq, a, [b], eq.cls)) === true
    if (!(b instanceof Objeto) || a.cls !== b.cls) return false
    if (!(a.cls.ehRecord || a.cls.ehTipoValor)) return false
    for (const [k, v] of a.campos) if (!igualValor(this, v, b.campos.get(k))) return false
    return true
  }

  hashDe(v) {
    if (v === null || v === undefined) return 'n'
    if (typeof v === 'string') return `s${v}`
    if (typeof v === 'number') return `i${v}`
    if (typeof v === 'boolean') return `b${v}`
    if (typeof v === 'bigint') return `i${v}`
    if (ehNumero(v)) return `i${v instanceof Chr ? v.c : v instanceof Dbl || v instanceof Flt ? v.v : v instanceof Dec ? textoGeral(v, CULTURAS.invariant) : v.v}`
    if (v instanceof ValorEnum) return `e${v.def.nome}.${v.v}`
    if (typeof v.hashNativo === 'function') return v.hashNativo()
    if (v instanceof Tupla) return `t(${v.itens.map((x) => this.hashDe(x)).join(',')})`
    if (v instanceof Objeto) {
      const gh = this.acharMetodoVirtual(v.cls, 'GetHashCode', 0)
      if (gh && !gh.cls.ehPrelude) return `h${this.aTexto(this.rodarSync(this.chamarMetodo(gh, v, [], gh.cls)))}`
      if (v.cls.ehRecord || v.cls.ehTipoValor) return `r${v.cls.nome}(${[...v.campos.values()].map((x) => this.hashDe(x)).join(',')})`
    }
    return `o${v.id ?? (v.id = this.novoId())}`
  }

  novoId() {
    this.seqId = (this.seqId ?? 1000000) + 1
    return this.seqId
  }

  // ---- utilitários para os outros módulos ---------------------------------------------------------------

  get quadroAtual() { return this.pilha[this.pilha.length - 1] }

  filho(n, campo) { return filho(n, campo) }

  filhosDe(n, tipo) { return filhosDe(n, tipo) }

  nomeTipo(n) { return nomeTipo(n) }

  modsDe(n) { return this.modificadores(n) }

  formatarData(d, fmt) { return formatarData(d, fmt, this.cultura) }

  igual(a, b) { return igualdade(this, a, b) }

  get nomesModificadores() { return NOMES_MOD }
}
