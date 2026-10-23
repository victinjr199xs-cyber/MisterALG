// Chamadas de método, acesso a membros e índices, atribuição (os "lvalues"), criação de objetos e arrays.

import { ErroCS, ExcecaoCS } from './erros.js'
import { FuncGrupo, FuncMetodo, FuncNativa, Lambda } from './funcoes.js'
import { Amb, IteradorUsuario, Quadro } from './maquina.js'
import { Multicast, compararNumeros } from './operadores.js'
import { Indice, Intervalo, NsRef, Suspende, TipoRef } from './refs.js'
import { elementoDe, ehArray, nomeTipo, partesGenericas, semNulo } from './tipos.js'
import { Arr, Chr, Objeto, Ref, RefCampo, RefElem, Tupla, ValorEnum, comoNumero, ehNumero, tipoNumerico } from './valores.js'

const filho = (n, campo) => n.f?.find((x) => x.k === campo)

/** O nome e os tipos genéricos de um nome de membro (Metodo ou Metodo<int>). */
function nomeMembro(n) {
  if (n.t === 'generic_name') {
    const id = n.f.find((x) => x.t === 'identifier')
    const args = n.f.find((x) => x.t === 'type_argument_list')
    return { nome: id.x, targs: args.f.map(nomeTipo) }
  }
  return { nome: n.x, targs: [] }
}

const semRef = (v) => (v instanceof Ref ? v.v : v)

export const invocacao = {
  // ---- ordem natural dos valores ---------------------------------------------------------------------------

  /** Compara dois valores como o Comparer padrão do C# (para Sort, OrderBy, Max...). */
  comparar(a, b) {
    if (a === b) return 0
    if (a === null || a === undefined) return -1
    if (b === null || b === undefined) return 1
    if (typeof a === 'string' && typeof b === 'string') return this.compararTextos(a, b)
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1
    if (ehNumero(a) && ehNumero(b)) {
      const c = compararNumeros(a, b)
      return Number.isNaN(c) ? 0 : c
    }
    if (a instanceof ValorEnum && b instanceof ValorEnum) return a.v - b.v
    if (a instanceof Tupla && b instanceof Tupla) {
      for (let i = 0; i < a.itens.length; i += 1) {
        const c = this.comparar(a.itens[i], b.itens[i])
        if (c !== 0) return c
      }
      return 0
    }
    if (a instanceof Objeto) {
      const md = this.acharMetodoVirtual(a.cls, 'CompareTo', 1)
      if (md) return Number(this.rodarSync(this.chamarMetodo(md, a, [b], md.cls)))
      throw this.excecao('InvalidOperationException', `Failed to compare two elements in the array: ${a.cls.nome} não implementa IComparable.`)
    }
    if (a.compararCom) return a.compararCom(b)
    return 0
  },

  compararTextos(a, b) {
    if (!this.colador) this.colador = new Intl.Collator('pt-BR')
    return Math.sign(this.colador.compare(a, b))
  },

  /** Cópia de um struct (os structs são valores: atribuir copia). */
  copiar(v) {
    if (v instanceof Objeto && v.cls.ehTipoValor) {
      const o = new Objeto(v.cls)
      for (const [k, x] of v.campos) o.campos.set(k, this.copiar(x))
      return o
    }
    return v
  },

  // ---- membros ----------------------------------------------------------------------------------------------

  acharPropriedade(def, nome) {
    const vistos = new Set()
    const visitar = (c) => {
      if (!c || vistos.has(c)) return null
      vistos.add(c)
      const p = c.propriedades.get(nome)
      if (p) return p
      return visitar(c.base) ?? c.interfaces.map(visitar).find(Boolean) ?? null
    }
    return visitar(def)
  },

  tipoDeCampo(def, nome) {
    for (let c = def; c; c = c.base) {
      const campo = c.campos.find((x) => x.nome === nome)
      if (campo) return campo.tipo
      const p = c.propriedades.get(nome)
      if (p) return p.tipo
      const rp = c.recordParams?.find((x) => x.nome === nome)
      if (rp) return rp.tipo
    }
    return null
  },

  *rodarAcessor(p, acessor, este, valor, indices = null) {
    const ctx = { este, cls: p.cls, quadro: null, metodo: { tipoRetorno: valor === null && p === undefined ? null : p.tipo, nome: p.nome, cls: p.cls } }
    const amb = new Amb(null, ctx)
    if (valor !== undefined) amb.declarar('value', new Ref(valor, p.tipo))
    if (indices && p.params) p.params.forEach((pp, i) => amb.declarar(pp.nome, new Ref(this.coagir(indices[i], pp.tipo), pp.tipo)))
    const quadro = new Quadro(`${p.cls.nome}.${p.nome === 'this[]' ? 'this[]' : p.nome}`, amb, p.linha)
    ctx.quadro = quadro
    if (this.pilha.length >= 600) throw this.excecao('InsufficientExecutionStackException', 'Stack overflow (muitas chamadas uma dentro da outra — recursão infinita?)')
    this.pilha.push(quadro)
    try {
      if (acessor.expressao) {
        this.linhaAtual = acessor.corpo.l
        quadro.linha = acessor.corpo.l
        yield { tipo: 'linha', linha: acessor.corpo.l }
        return yield* this.aval(acessor.corpo, amb)
      }
      const c = yield* this.execBloco(acessor.corpo, amb, false)
      return c && c.t === 'return' ? c.v : undefined
    } finally {
      this.pilha.pop()
    }
  },

  *lerPropriedade(obj, p) {
    if (!p.get) throw new ErroCS(`a propriedade ${p.nome} não tem get`, this.linhaAtual)
    if (p.get.auto) return obj ? obj.campos.get(p.nome) : p.cls.estaticos.get(p.nome)?.v
    const r = yield* this.rodarAcessor(p, p.get, obj, undefined)
    return r === undefined ? null : r
  },

  *gravarPropriedade(obj, p, valor) {
    const v = this.coagir(valor, p.tipo)
    if (p.set?.auto || (!p.set && p.get?.auto)) {
      if (obj) obj.campos.set(p.nome, v)
      else p.cls.estaticos.get(p.nome).v = v
      return
    }
    if (!p.set) throw new ErroCS(`a propriedade ${p.nome} não tem set (é somente leitura)`, this.linhaAtual, 'Uma propriedade só de leitura (sem set) não pode receber valor depois de criada.')
    yield* this.rodarAcessor(p, p.set, obj, v)
  },

  /** O membro (propriedade, campo ou método) de um nome simples dentro de um método de instância. */
  *lerMembroImplicito(obj, nome) {
    if (!(obj instanceof Objeto)) return undefined
    const p = this.acharPropriedade(obj.cls, nome)
    if (p && !p.estatico) return { v: yield* this.lerPropriedade(obj, p) }
    if (obj.campos.has(nome)) return { v: obj.campos.get(nome) }
    const ms = this.metodosDe(obj.cls, nome)
    if (ms.length) return { v: new FuncGrupo(nome, ms, obj) }
    return undefined
  },

  *lerMembro(obj, nome) {
    const r = yield* this.lerMembroImplicito(obj, nome)
    if (r) return r.v
    const nat = this.bib.chamarObjetoPropriedade?.(this, obj, nome)
    if (nat !== undefined) return nat
    throw new ErroCS(`${obj.cls.nome} não tem um membro chamado "${nome}"`, this.linhaAtual, 'Confira o nome do campo, propriedade ou método (maiúsculas e minúsculas contam). CS1061.')
  },

  *lerEstatico(def, nome) {
    for (let c = def; c; c = c.base) {
      yield* this.iniciarClasse(c)
      if (c.tipo === 'enum' && c.membrosEnum.has(nome)) return c.membrosEnum.get(nome)
      const r = c.estaticos.get(nome)
      if (r) return r.v
      const p = c.propriedades.get(nome)
      if (p?.estatico) return yield* this.lerPropriedade(null, p)
      if (c.aninhadas.has(nome)) return new TipoRef(nome, c.aninhadas.get(nome))
    }
    const ms = this.metodosDe(def, nome).filter((m) => m.estatico)
    if (ms.length) return new FuncGrupo(nome, ms, null)
    throw new ErroCS(`${def.nome} não tem um membro estático chamado "${nome}"`, this.linhaAtual, 'Confira o nome (maiúsculas e minúsculas contam) e se ele foi declarado como static. CS0117.')
  },

  /** valor.nome para qualquer valor (inclusive nomes de tipos e de namespaces). */
  *membroDe(v, nome, amb, no) {
    if (v instanceof TipoRef) {
      if (v.def) return yield* this.lerEstatico(v.def, nome)
      if (v.nativo) return this.bib.lerEstatico(this, v.nativo, nome)
    }
    if (v instanceof NsRef) {
      const completo = `${v.nome}.${nome}`
      const def = this.buscarClasse(nome)
      if (def) return new TipoRef(nome, def)
      const nat = this.bib.tipo(nome)
      if (nat) return new TipoRef(nome, null, nat)
      return new NsRef(completo)
    }
    if (nome === 'HasValue' && !(v instanceof Objeto && this.acharPropriedade(v.cls, 'HasValue'))) return v !== null && v !== undefined
    if (v === null || v === undefined) {
      if (nome === 'Value') throw this.excecao('InvalidOperationException', 'Nullable object must have a value.')
      throw this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    }
    if (nome === 'Value' && !(v instanceof Objeto) && (ehNumero(v) || typeof v === 'boolean' || v instanceof ValorEnum || v instanceof Tupla)) return v
    if (v instanceof Objeto) {
      if (no && no.t === 'base_expression') return yield* this.lerMembro(v, nome)
      return yield* this.lerMembro(v, nome)
    }
    void amb
    return this.bib.lerPropriedade(this, v, nome)
  },

  *avalAcessoMembro(n, amb) {
    const alvo = filho(n, 'expression')
    const { nome } = nomeMembro(filho(n, 'name'))
    if (alvo.t === 'base_expression') {
      const base = amb.ctx.cls.base
      const p = base && this.acharPropriedade(base, nome)
      if (p) return yield* this.lerPropriedade(amb.ctx.este, p)
      return yield* this.lerMembro(amb.ctx.este, nome)
    }
    const r = yield* this.avalAlvoCadeia(alvo, amb)
    if (r.curto) return null
    return yield* this.membroDe(r.v, nome, amb, n)
  },

  // ---- argumentos --------------------------------------------------------------------------------------------

  /** Os argumentos da chamada: { valores, nomeados } (ref/out viram Ref). */
  *avalArgumentos(lista, amb) {
    const valores = []
    const nomeados = new Map()
    for (const a of lista?.f ?? []) {
      if (a.t !== 'argument') continue
      const nc = a.f.find((x) => x.t === 'name_colon')
      const modo = a.f.find((x) => x.t === 'ref' || x.t === 'out' || x.t === 'in')?.t
      const expr = a.f[a.f.length - 1]
      let v
      if (modo === 'ref' || modo === 'out') v = yield* this.avalRefArg(expr, amb)
      else v = yield* this.aval(expr, amb)
      if (nc) nomeados.set(nc.f[0].x, v)
      else valores.push(v)
    }
    return { valores, nomeados }
  },

  *avalRefArg(expr, amb) {
    if (expr.t === 'declaration_expression') {
      const nome = filho(expr, 'name')?.x
      const tipo = nomeTipo(filho(expr, 'type'))
      const ref = new Ref(this.valorPadrao(tipo), tipo === 'var' ? null : tipo)
      if (nome && nome !== '_') amb.declarar(nome, ref)
      return ref
    }
    if (expr.t === 'discard' || (expr.t === 'identifier' && expr.x === '_' && !amb.buscar('_'))) return new Ref(null)
    const lv = yield* this.avalLValue(expr, amb)
    return lv.ref ? lv.ref() : new Ref(yield* lv.ler())
  },

  /** Põe os argumentos nomeados nas posições dos parâmetros. */
  reordenar(md, valores, nomeados) {
    if (!nomeados || nomeados.size === 0) return valores
    const r = valores.slice()
    for (const [nome, v] of nomeados) {
      const i = md.params.findIndex((p) => p.nome === nome)
      if (i < 0) throw new ErroCS(`o método ${md.nome} não tem o parâmetro "${nome}"`, this.linhaAtual)
      r[i] = v
    }
    return r
  },

  // ---- chamadas ----------------------------------------------------------------------------------------------

  *avalInvocacao(n, amb) {
    const f = filho(n, 'function')
    const lista = filho(n, 'arguments')
    if (f.t === 'identifier' && f.x === 'nameof') {
      const e = lista.f[0].f[lista.f[0].f.length - 1]
      return e.t === 'member_access_expression' ? nomeMembro(filho(e, 'name')).nome : e.x ?? e.f?.[0]?.x ?? ''
    }
    switch (f.t) {
      case 'identifier': return yield* this.chamarPorNome(f.x, [], lista, amb, n)
      case 'generic_name': {
        const { nome, targs } = nomeMembro(f)
        return yield* this.chamarPorNome(nome, targs, lista, amb, n)
      }
      case 'member_access_expression': return yield* this.chamarMembro(f, lista, amb, n)
      case 'member_binding_expression': {
        const alvo = this.ligacaoAtual
        const { nome, targs } = nomeMembro(filho(f, 'name'))
        return yield* this.chamarEmValor(alvo, nome, targs, lista, amb, n)
      }
      case 'conditional_access_expression': {
        // a?.Metodo(args): se "a" é null, nem os argumentos são calculados
        const v = yield* this.aval(filho(f, 'condition') ?? f.f[0], amb)
        if (v === null || v === undefined) return null
        const b = f.f[f.f.length - 1]
        if (b.t === 'member_binding_expression') {
          const { nome, targs } = nomeMembro(filho(b, 'name'))
          return yield* this.chamarEmValor(v, nome, targs, lista, amb, n)
        }
        ;(this.pilhaLigacao ??= []).push(v)
        let fn
        try {
          fn = yield* this.aval(b, amb)
        } finally {
          this.pilhaLigacao.pop()
        }
        const { valores } = yield* this.avalArgumentos(lista, amb)
        return yield* this.chamarFuncaoGen(fn, valores)
      }
      default: {
        const fn = yield* this.aval(f, amb)
        const { valores } = yield* this.avalArgumentos(lista, amb)
        return yield* this.chamarFuncaoGen(fn, valores)
      }
    }
  },

  *chamarPorNome(nome, targs, lista, amb, n) {
    this.linhaAtual = n.l
    const ref = amb.buscar(nome)
    const { valores, nomeados } = yield* this.avalArgumentos(lista, amb)
    if (ref && (ref.v?.ehFunc || ref.v instanceof Multicast)) return yield* this.chamarFuncaoGen(ref.v, valores)
    const ctx = amb.ctx
    const candidatos = []
    let este = ctx.este
    if (este instanceof Objeto) candidatos.push(...this.metodosDe(este.cls, nome))
    for (let c = ctx.cls; c; c = c.externa) {
      const ms = this.metodosDe(c, nome)
      for (const m of ms) if (!candidatos.includes(m)) candidatos.push(m)
    }
    if (candidatos.length) {
      const md = this.escolherSobrecarga(candidatos, valores, nomeados)
      if (!md) throw this.erroSobrecarga(nome, candidatos, valores, n)
      if (!md.estatico && !este) throw new ErroCS(`o método ${nome} não é static: precisa de um objeto para ser chamado`, n.l, 'Dentro de um método static só dá para chamar outros métodos static diretamente. Crie um objeto (new) e chame por ele. CS0120.')
      if (md.cls?.tipo === 'struct' || md.estatico) void 0
      if (!md.estatico && md.cls && este instanceof Objeto && !este.cls.deriva(md.cls) && ctx.cls !== md.cls) este = ctx.este
      return yield* this.chamarMetodo(md, md.estatico ? null : este, this.reordenar(md, valores, nomeados), md.cls, { tiposGenericos: targs })
    }
    for (const u of this.usingsEstaticos) {
      const def = this.buscarClasse(u)
      if (def) {
        const ms = this.metodosDe(def, nome).filter((m) => m.estatico)
        if (ms.length) {
          const md = this.escolherSobrecarga(ms, valores, nomeados)
          if (md) return yield* this.chamarMetodo(md, null, this.reordenar(md, valores, nomeados), md.cls)
        }
      }
      const nat = this.bib.tipo(u)
      if (nat && this.bib.temEstatico(nat, nome)) return yield* this.esperarNativo(this.bib.chamarEstatico(this, nat, nome, valores, targs, n))
    }
    if (ref) return yield* this.chamarFuncaoGen(ref.v, valores)
    if (este instanceof Objeto && this.bib.ehMetodoObjeto(nome)) return yield* this.esperarNativo(this.bib.chamarObjeto(this, este, nome, valores, false, n))
    throw new ErroCS(`o método "${nome}" não existe neste contexto`, n.l, 'Confira o nome do método (maiúsculas e minúsculas contam) e se ele foi declarado na classe. CS0103.')
  },

  erroSobrecarga(nome, candidatos, valores, n) {
    const tipos = valores.map((v) => this.nomeDoTipoDe(semRef(v))).join(', ')
    const assinaturas = candidatos.map((c) => `${nome}(${c.params.map((p) => p.tipo).join(', ')})`).join(' ou ')
    return new ErroCS(`nenhuma versão de "${nome}" aceita os argumentos (${tipos})`, n.l, `As versões que existem: ${assinaturas}. Confira a quantidade e os tipos dos valores passados. CS1503.`)
  },

  /** O resultado de uma função nativa pode vir "suspenso" (precisa conversar com a máquina). */
  *esperarNativo(r) {
    if (r instanceof Suspende) return yield* r.gen
    return r
  },

  *chamarMembro(f, lista, amb, n) {
    const alvo = filho(f, 'expression')
    const { nome, targs } = nomeMembro(filho(f, 'name'))
    this.linhaAtual = n.l
    if (alvo.t === 'base_expression') {
      const este = amb.ctx.este
      const base = amb.ctx.cls.base
      const { valores, nomeados } = yield* this.avalArgumentos(lista, amb)
      const ms = base ? this.metodosDe(base, nome) : []
      const md = ms.length ? this.escolherSobrecarga(ms, valores, nomeados) : null
      if (!md) {
        // base.ToString(), base.Equals(...) da classe Object
        return yield* this.esperarNativo(this.bib.chamarObjeto(this, este, nome, valores, true))
      }
      return yield* this.chamarMetodo(md, este, this.reordenar(md, valores, nomeados), md.cls)
    }
    const r = yield* this.avalAlvoCadeia(alvo, amb)
    if (r.curto) return null
    return yield* this.chamarEmValor(r.v, nome, targs, lista, amb, n)
  },

  /** O lado esquerdo de uma cadeia: se for a?.b e "a" for null, a cadeia toda (a?.b.c(...)) vale null. */
  *avalAlvoCadeia(alvo, amb) {
    if (alvo.t !== 'conditional_access_expression') return { curto: false, v: yield* this.aval(alvo, amb) }
    const cond = yield* this.aval(filho(alvo, 'condition') ?? alvo.f[0], amb)
    if (cond === null || cond === undefined) return { curto: true }
    ;(this.pilhaLigacao ??= []).push(cond)
    try {
      return { curto: false, v: yield* this.aval(alvo.f[alvo.f.length - 1], amb) }
    } finally {
      this.pilhaLigacao.pop()
    }
  },

  /** valor.nome(args): despacha pelo tipo do valor. */
  *chamarEmValor(v, nome, targs, lista, amb, n) {
    const { valores, nomeados } = yield* this.avalArgumentos(lista, amb)
    if (nome === 'GetValueOrDefault' && !(v instanceof Objeto)) return v ?? valores[0] ?? 0
    if (v === null || v === undefined) throw this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    if (v instanceof TipoRef) {
      if (v.def) {
        const ms = this.metodosDe(v.def, nome).filter((m) => m.estatico)
        if (ms.length) {
          yield* this.iniciarClasse(v.def)
          const md = this.escolherSobrecarga(ms, valores, nomeados)
          if (!md) throw this.erroSobrecarga(nome, ms, valores, n)
          return yield* this.chamarMetodo(md, null, this.reordenar(md, valores, nomeados), md.cls, { tiposGenericos: targs })
        }
        const f = yield* this.lerEstatico(v.def, nome)
        return yield* this.chamarFuncaoGen(f, valores)
      }
      return yield* this.esperarNativo(this.bib.chamarEstatico(this, v.nativo, nome, valores, targs.length ? targs : v.args, n))
    }
    if (v instanceof NsRef) throw new ErroCS(`"${v.nome}" é um namespace, não dá para chamar ${nome}() nele`, n.l)
    if (v instanceof Objeto) {
      const ms = this.metodosDe(v.cls, nome)
      if (ms.length) {
        const md = this.escolherSobrecarga(ms, valores, nomeados)
        if (md) return yield* this.chamarMetodo(md, md.estatico ? null : v, this.reordenar(md, valores, nomeados), md.cls, { tiposGenericos: targs })
        if (!this.metodoExtensao(nome, v)) throw this.erroSobrecarga(nome, ms, valores, n)
      }
      const ext = this.metodoExtensao(nome, v, valores)
      if (ext) return yield* this.chamarMetodo(ext, null, [v, ...valores], ext.cls)
      // Um campo ou propriedade que guarda um delegate: obj.Evento(...)
      const campo = v.campos.get(nome)
      if (campo?.ehFunc || campo instanceof Multicast) return yield* this.chamarFuncaoGen(campo, valores)
      const prop = this.acharPropriedade(v.cls, nome)
      if (prop) {
        const f = yield* this.lerPropriedade(v, prop)
        if (f?.ehFunc || f instanceof Multicast) return yield* this.chamarFuncaoGen(f, valores)
      }
      return yield* this.esperarNativo(this.bib.chamarObjeto(this, v, nome, valores, false, n))
    }
    if (v.ehFunc || v instanceof Multicast) {
      if (nome === 'Invoke' || nome === 'DynamicInvoke') return yield* this.chamarFuncaoGen(v, valores)
      return yield* this.esperarNativo(this.bib.chamarInstancia(this, v, nome, valores, targs, n))
    }
    // métodos de extensão do aluno em tipos nativos (static int Dobro(this int x))
    const ext = this.metodoExtensao(nome, v, valores)
    if (ext && !this.bib.temMetodo(v, nome)) return yield* this.chamarMetodo(ext, null, [v, ...valores], ext.cls)
    return yield* this.esperarNativo(this.bib.chamarInstancia(this, v, nome, valores, targs, n))
  },

  /** Procura um método de extensão do aluno (static com "this" no primeiro parâmetro). */
  metodoExtensao(nome, v, valores = null) {
    for (const def of this.porNomeCompleto.values()) {
      if (def.ehPrelude) continue
      for (const md of def.metodos.get(nome) ?? []) {
        if (!md.extensao) continue
        if (this.combina(v, md.params[0].tipo) < 0) continue
        if (valores) {
          const resto = { ...md, params: md.params.slice(1) }
          if (!this.escolherSobrecarga([resto], valores)) continue
        }
        return md
      }
    }
    return null
  },

  // ---- índices ---------------------------------------------------------------------------------------------------

  *avalAcessoIndice(n, amb) {
    const r = yield* this.avalAlvoCadeia(filho(n, 'expression'), amb)
    if (r.curto) return null
    const args = yield* this.avalIndices(filho(n, 'subscript') ?? n.f.find((x) => x.t === 'bracketed_argument_list'), amb)
    return yield* this.indexar(r.v, args)
  },

  *avalIndices(lista, amb) {
    const r = []
    for (const a of lista.f.filter((x) => x.t === 'argument')) r.push(yield* this.aval(a.f[a.f.length - 1], amb))
    return r
  },

  *indexar(alvo, args) {
    if (alvo === null || alvo === undefined) throw this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    if (alvo instanceof Arr) return this.indexarArray(alvo, args)
    if (typeof alvo === 'string') {
      const a = args[0]
      if (a instanceof Intervalo) {
        const { inicio, tamanho } = a.em(alvo.length)
        if (inicio < 0 || tamanho < 0 || inicio + tamanho > alvo.length) throw this.excecao('ArgumentOutOfRangeException', 'Specified argument was out of the range of valid values.')
        return alvo.substr(inicio, tamanho)
      }
      const i = a instanceof Indice ? a.em(alvo.length) : comoNumero(a)
      if (i < 0 || i >= alvo.length) throw this.excecao('IndexOutOfRangeException', 'Index was outside the bounds of the array.')
      return new Chr(alvo.charCodeAt(i))
    }
    if (alvo instanceof Objeto) {
      const ix = this.escolherIndexador(alvo, args)
      if (!ix) throw new ErroCS(`${alvo.cls.nome} não tem indexador (this[...])`, this.linhaAtual)
      const r = yield* this.rodarAcessor(ix, ix.get, alvo, undefined, args)
      return r === undefined ? null : r
    }
    return this.bib.indexar(this, alvo, args)
  },

  escolherIndexador(obj, args) {
    for (let c = obj.cls; c; c = c.base) {
      const cands = c.indexadores.filter((p) => p.params.length === args.length && p.params.every((pp, i) => this.combina(args[i], pp.tipo) >= 0))
      if (cands.length) return cands[0]
    }
    return null
  },

  indexarArray(arr, args) {
    if (args.length === 1 && (args[0] instanceof Intervalo)) {
      const { inicio, tamanho } = args[0].em(arr.itens.length)
      if (inicio < 0 || tamanho < 0 || inicio + tamanho > arr.itens.length) throw this.excecao('ArgumentOutOfRangeException', 'Specified argument was out of the range of valid values.')
      return new Arr(arr.tipoElem, arr.itens.slice(inicio, inicio + tamanho))
    }
    const i = this.posicaoNoArray(arr, args)
    return arr.itens[i]
  },

  posicaoNoArray(arr, args) {
    if (arr.dims) {
      if (args.length !== arr.dims.length) throw new ErroCS('o número de índices não combina com as dimensões do array', this.linhaAtual)
      let pos = 0
      for (let k = 0; k < arr.dims.length; k += 1) {
        const ix = comoNumero(args[k])
        if (ix < 0 || ix >= arr.dims[k]) throw this.excecao('IndexOutOfRangeException', 'Index was outside the bounds of the array.')
        pos = pos * arr.dims[k] + ix
      }
      return pos
    }
    const a = args[0]
    const i = a instanceof Indice ? a.em(arr.itens.length) : comoNumero(a)
    if (!Number.isInteger(i) || i < 0 || i >= arr.itens.length) throw this.excecao('IndexOutOfRangeException', 'Index was outside the bounds of the array.')
    return i
  },

  // ---- acesso condicional (a?.b, a?[i]) --------------------------------------------------------------------

  *avalAcessoCondicional(n, amb) {
    const cond = filho(n, 'condition') ?? n.f[0]
    const v = yield* this.aval(cond, amb)
    if (v === null || v === undefined) return null
    const resto = n.f[n.f.length - 1]
    ;(this.pilhaLigacao ??= []).push(v)
    try {
      return yield* this.aval(resto, amb)
    } finally {
      this.pilhaLigacao.pop()
    }
  },

  get ligacaoAtual() { return this.pilhaLigacao?.[this.pilhaLigacao.length - 1] },

  *avalLigacao(n, amb) {
    const alvo = this.ligacaoAtual
    if (n.t === 'member_binding_expression') return yield* this.membroDe(alvo, nomeMembro(filho(n, 'name')).nome, amb, n)
    const args = yield* this.avalIndices(n.f.find((x) => x.t === 'bracketed_argument_list'), amb)
    return yield* this.indexar(alvo, args)
  },

  // ---- atribuição: os "lvalues" -------------------------------------------------------------------------------

  *avalLValue(n, amb) {
    switch (n.t) {
      case 'identifier': {
        const ref = amb.buscar(n.x)
        if (ref) return lvRef(this, ref)
        const ctx = amb.ctx
        if (ctx.este instanceof Objeto) {
          const alvo = this.lvMembro(ctx.este, n.x)
          if (alvo) return alvo
        }
        for (let c = ctx.cls; c; c = c.externa) {
          const dono = this.achaEstatico(c, n.x)
          if (dono) return this.lvEstatico(dono, n.x)
        }
        throw new ErroCS(`não dá para atribuir a "${n.x}": o nome não existe neste contexto`, n.l, 'Declare a variável antes (ex.: int x = 0;). CS0103.')
      }
      case 'member_access_expression': {
        const alvoNo = filho(n, 'expression')
        const { nome } = nomeMembro(filho(n, 'name'))
        const obj = alvoNo.t === 'base_expression' ? amb.ctx.este : yield* this.aval(alvoNo, amb)
        if (obj instanceof TipoRef) {
          if (obj.def) return this.lvEstatico(this.achaEstatico(obj.def, nome) ?? obj.def, nome)
          return lvNativoEstatico(this, obj.nativo, nome)
        }
        if (obj === null || obj === undefined) throw this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
        if (obj instanceof Objeto) return this.lvMembro(obj, nome) ?? this.lvMembroLivre(obj, nome)
        return lvNativo(this, obj, nome)
      }
      case 'element_access_expression': {
        const alvo = yield* this.aval(filho(n, 'expression'), amb)
        const args = yield* this.avalIndices(filho(n, 'subscript') ?? n.f.find((x) => x.t === 'bracketed_argument_list'), amb)
        return lvIndice(this, alvo, args)
      }
      case 'parenthesized_expression': return yield* this.avalLValue(n.f[0], amb)
      case 'declaration_expression': {
        const nome = filho(n, 'name')?.x
        const tipo = nomeTipo(filho(n, 'type'))
        const ref = new Ref(this.valorPadrao(tipo), tipo)
        if (nome) amb.declarar(nome, ref)
        return lvRef(this, ref)
      }
      case 'conditional_access_expression': throw new ErroCS('não dá para atribuir com ?. do lado esquerdo', n.l)
      case 'postfix_unary_expression': return yield* this.avalLValue(n.f[0], amb)
      default:
        throw new ErroCS('o lado esquerdo da atribuição não é uma variável, campo, propriedade ou posição de array', n.l, 'CS0131: só dá para atribuir a uma variável, campo, propriedade ou item de array.')
    }
  },

  lvMembro(obj, nome) {
    const p = this.acharPropriedade(obj.cls, nome)
    if (p && !p.estatico) return lvPropriedade(this, obj, p)
    if (obj.campos.has(nome)) return lvCampo(this, obj, nome)
    return null
  },

  /** Atribuir a um campo que ainda não existe no objeto (anônimos, with...) cria-o. */
  lvMembroLivre(obj, nome) {
    const dono = this.achaEstatico(obj.cls, nome)
    if (dono) return this.lvEstatico(dono, nome)
    throw new ErroCS(`${obj.cls.nome} não tem um membro chamado "${nome}"`, this.linhaAtual, 'Confira o nome do campo ou propriedade. CS1061.')
  },

  lvEstatico(def, nome) {
    const maq = this
    return {
      *ler() { return yield* maq.lerEstatico(def, nome) },
      *gravar(v) {
        yield* maq.iniciarClasse(def)
        const p = def.propriedades.get(nome)
        if (p?.estatico) return yield* maq.gravarPropriedade(null, p, v)
        const r = def.estaticos.get(nome)
        if (!r) throw new ErroCS(`${def.nome} não tem o campo estático "${nome}"`, maq.linhaAtual)
        r.v = maq.coagir(v, r.t)
        return undefined
      },
      tipo() { return def.estaticos.get(nome)?.t ?? def.propriedades.get(nome)?.tipo ?? null },
      ref() { return def.estaticos.get(nome) ?? new Ref(null) },
    }
  },

  // ---- criação de objetos --------------------------------------------------------------------------------------

  *criarObjeto(tipoStr, tipoNo, argsNo, initNo, amb) {
    const { nome, args: targs } = partesGenericas(tipoStr)
    const { valores, nomeados } = yield* this.avalArgumentos(argsNo, amb)
    const def = this.buscarClasse(nome)
    if (def) {
      if (def.tipo === 'delegate') return valores[0]
      const o = yield* this.instanciar(def, valores, nomeados)
      if (initNo) yield* this.aplicarInicializador(o, initNo, amb)
      return o
    }
    const nat = this.bib.tipo(nome)
    if (nat?.criar) {
      const v = this.bib.criar(this, nat, valores, targs, tipoStr)
      const r = v instanceof Suspende ? yield* v.gen : v
      if (initNo) yield* this.aplicarInicializador(r, initNo, amb)
      return r
    }
    void tipoNo
    throw new ErroCS(`o tipo "${nome}" não existe`, this.linhaAtual, `Confira o nome do tipo (maiúsculas e minúsculas contam), se a classe foi declarada e se o using está no começo do arquivo. CS0246.`)
  },

  *instanciar(def, args, nomeados = null) {
    if (def.ehAbstrata || def.tipo === 'interface') {
      throw new ErroCS(`não dá para criar um objeto de ${def.tipo === 'interface' ? 'uma interface' : 'uma classe abstrata'} (${def.nome})`, this.linhaAtual, 'Crie um objeto de uma classe que herda dela (que implementa os métodos abstract). CS0144.')
    }
    yield* this.iniciarClasse(def)
    const o = new Objeto(def)
    this.inicializarCamposVazios(o, def)
    o.linha = this.linhaAtual
    yield* this.construir(o, def, args, nomeados)
    return o
  },

  *inicializarCampos(o, def) {
    const ctx = { este: o, cls: def, quadro: null }
    for (const c of def.campos) {
      if (c.init) o.campos.set(c.nome, this.coagir(yield* this.avalComTipo(c.init, new Amb(null, ctx), c.tipo), c.tipo))
    }
    for (const p of def.propriedades.values()) {
      if (p.estatico || !p.valorInicial) continue
      const ex = p.valorInicial.f ? p.valorInicial.f[p.valorInicial.f.length - 1] : p.valorInicial
      o.campos.set(p.nome, this.coagir(yield* this.avalComTipo(ex, new Amb(null, ctx), p.tipo), p.tipo))
    }
  },

  *construir(o, def, args, nomeados) {
    const cands = def.construtores
    const ctor = cands.length ? this.escolherSobrecarga(cands, args, nomeados) : null
    if (cands.length && !ctor && !def.recordParams) {
      throw new ErroCS(`nenhum construtor de ${def.nome} aceita estes argumentos (${args.map((a) => this.nomeDoTipoDe(a)).join(', ')})`, this.linhaAtual, `Os construtores que existem: ${cands.map((c) => `${def.nome}(${c.params.map((p) => p.tipo).join(', ')})`).join(' ou ')}. CS1729.`)
    }
    if (!cands.length && args.length && !def.recordParams) {
      throw new ErroCS(`${def.nome} não tem um construtor com ${args.length} argumento(s)`, this.linhaAtual, 'Escreva um construtor com esses parâmetros, ou crie o objeto sem argumentos. CS1729.')
    }
    const usaThis = ctor?.inicializador?.tipo === 'this'
    if (!usaThis) yield* this.inicializarCampos(o, def)
    if (!ctor) {
      if (def.recordParams) {
        const ps = def.recordParams
        const pos = this.reordenar({ params: ps, nome: def.nome }, args, nomeados)
        const proprios = def.base?.recordParams ? ps.slice(def.base.recordParams.length) : ps
        const doBase = def.base?.recordParams ? ps.slice(0, def.base.recordParams.length) : []
        if (def.base) yield* this.construir(o, def.base, doBase.length ? pos.slice(0, doBase.length) : [], null)
        proprios.forEach((p, i) => {
          const k = (def.base?.recordParams?.length ?? 0) + i
          let v = pos[k]
          if (v === undefined) {
            if (p.padrao) v = this.rodarSync(this.aval(p.padrao, new Amb(null, { este: o, cls: def, quadro: null })))
            else throw new ErroCS(`faltou o argumento "${p.nome}" ao criar ${def.nome}`, this.linhaAtual)
          }
          o.campos.set(p.nome, this.coagir(v, p.tipo))
        })
        return
      }
      if (def.base) yield* this.construir(o, def.base, [], null)
      return
    }
    const ctx = { este: o, cls: def, quadro: null, metodo: { ...ctor, tipoRetorno: 'void' } }
    const amb = new Amb(null, ctx)
    yield* this.ligarParametros(ctor, amb, this.reordenar(ctor, args, nomeados))
    const quadro = new Quadro(`${def.nome}.ctor`, amb, ctor.linha)
    ctx.quadro = quadro
    if (this.pilha.length >= 600) throw this.excecao('InsufficientExecutionStackException', 'Stack overflow (muitas chamadas uma dentro da outra — recursão infinita?)')
    this.pilha.push(quadro)
    try {
      const ini = ctor.inicializador
      if (ini?.tipo === 'this') {
        const a = yield* this.avalArgumentos(ini.args, amb)
        yield* this.construir(o, def, a.valores, a.nomeados)
      } else if (def.base) {
        const a = ini ? yield* this.avalArgumentos(ini.args, amb) : { valores: [], nomeados: null }
        yield* this.construir(o, def.base, a.valores, a.nomeados)
      }
      if (ctor.corpo) {
        if (ctor.corpo.t === 'arrow_expression_clause') yield* this.aval(ctor.corpo.f[0], amb)
        else yield* this.execBloco(ctor.corpo, amb, false)
      }
    } finally {
      this.pilha.pop()
    }
  },

  /** new T { A = 1 } e new List<int> { 1, 2 }: o que vem entre chaves depois do construtor. */
  *aplicarInicializador(obj, initNo, amb) {
    for (const item of initNo.f) {
      if (item.t === 'assignment_expression') {
        const esq = filho(item, 'left')
        const dir = filho(item, 'right')
        if (esq.t === 'element_binding_expression' || esq.t === 'element_access_expression' || esq.t === 'implicit_element_access') {
          const lista = esq.f.find((x) => x.t === 'bracketed_argument_list')
          const args = yield* this.avalIndices(lista, amb)
          const lv = lvIndice(this, obj, args)
          yield* lv.gravar(yield* this.aval(dir, amb))
        } else if (esq.t === 'identifier') {
          const lv = obj instanceof Objeto ? (this.lvMembro(obj, esq.x) ?? this.lvMembroLivre(obj, esq.x)) : lvNativo(this, obj, esq.x)
          const tipo = lv.tipo?.()
          const v = dir.t === 'initializer_expression' ? yield* this.preencherAninhado(yield* lv.ler(), dir, amb) : yield* this.avalComTipo(dir, amb, tipo)
          if (dir.t !== 'initializer_expression') yield* lv.gravar(this.coagir(v, tipo))
        } else throw new ErroCS('inicializador de objeto inválido', item.l)
      } else {
        // item de coleção: Add(valor) ou Add(a, b) para { a, b }
        const valores = item.t === 'initializer_expression' ? yield* this.avalLista(item, amb) : [yield* this.aval(item, amb)]
        yield* this.adicionarInicial(obj, valores)
      }
    }
  },

  *preencherAninhado(alvo, init, amb) {
    yield* this.aplicarInicializador(alvo, init, amb)
    return alvo
  },

  *avalLista(init, amb) {
    const r = []
    for (const x of init.f) r.push(yield* this.aval(x, amb))
    return r
  },

  *adicionarInicial(obj, valores) {
    if (obj instanceof Objeto) {
      const ms = this.metodosDe(obj.cls, 'Add')
      const md = this.escolherSobrecarga(ms, valores)
      if (!md) throw new ErroCS(`${obj.cls.nome} não tem um método Add para este inicializador`, this.linhaAtual)
      yield* this.chamarMetodo(md, obj, valores, md.cls)
      return
    }
    yield* this.esperarNativo(this.bib.chamarInstancia(this, obj, 'Add', valores, [], null))
  },

  // ---- arrays ------------------------------------------------------------------------------------------------------

  *avalNovoArray(n, amb) {
    const at = n.f.find((x) => x.t === 'array_type')
    const tipoElem = nomeTipo(at.f.find((x) => x.k === 'type'))
    const rank = at.f.find((x) => x.k === 'rank')
    const init = n.f.find((x) => x.t === 'initializer_expression')
    const dimsTexto = nomeTipo(at)
    if (init) return yield* this.criarArrayDeInicializador(this.tipoArrayComTamanhos(tipoElem, rank, dimsTexto), init, amb)
    const tamanhos = []
    for (const e of rank.f) tamanhos.push(comoNumero(yield* this.aval(e, amb)))
    if (tamanhos.some((t) => t < 0)) throw this.excecao('OverflowException', 'Arithmetic operation resulted in an overflow.')
    if ((rank.d ?? 1) > 1) {
      const total = tamanhos.reduce((a, b) => a * b, 1)
      return new Arr(tipoElem, Array.from({ length: total }, () => this.valorPadrao(tipoElem)), tamanhos)
    }
    const elemTipo = tipoElem + dimsTexto.slice(tipoElem.length).replace(/^\[,*\]/, '')
    void elemTipo
    // new int[3][] → elementos do tipo int[]; new int[3] → int
    const resto = dimsTexto.slice(tipoElem.length).replace(/^\[[,]*\]/, '')
    const tipoDosItens = tipoElem + resto
    const padrao = resto ? null : this.valorPadrao(tipoElem)
    return new Arr(tipoDosItens, Array.from({ length: tamanhos[0] }, () => (padrao instanceof Objeto ? this.copiar(padrao) : padrao)))
  },

  tipoArrayComTamanhos(tipoElem, rank, dimsTexto) {
    void rank
    return dimsTexto
  },

  *avalArrayImplicito(n, amb) {
    const init = n.f.find((x) => x.t === 'initializer_expression')
    const itens = []
    for (const e of init.f) itens.push(yield* this.aval(e, amb))
    const tipo = this.tipoComum(itens)
    return new Arr(tipo, itens.map((x) => this.coagir(x, tipo)))
  },

  tipoComum(valores) {
    const nomes = new Set(valores.filter((v) => v !== null).map((v) => this.nomeDoTipoDe(v)))
    if (nomes.size === 0) return 'object'
    if (nomes.size === 1) return [...nomes][0]
    const numericos = ['int', 'long', 'float', 'double', 'decimal']
    if ([...nomes].every((x) => numericos.includes(x))) return numericos[Math.max(...[...nomes].map((x) => numericos.indexOf(x)))]
    return 'object'
  },

  /** { 1, 2, 3 } ou { {1,2}, {3,4} } para o tipo de array dado (int[], int[,], int[][]...). */
  *criarArrayDeInicializador(tipoArray, init, amb) {
    const dimsMatch = /\[(,*)\]$/.exec(tipoArray)
    const rank = dimsMatch ? dimsMatch[1].length + 1 : 1
    const tipoBase = dimsMatch ? tipoArray.slice(0, dimsMatch.index) : tipoArray
    const resto = dimsMatch ? '' : ''
    void resto
    if (rank > 1) {
      const dims = []
      const dados = []
      const medir = (nodo, nivel) => {
        const n = nodo.f.length
        if (dims[nivel] === undefined) dims[nivel] = n
        if (nivel < rank - 1) for (const x of nodo.f) medir(x, nivel + 1)
      }
      medir(init, 0)
      const preencher = function* preencher(maq, nodo, nivel) {
        if (nivel === rank - 1) for (const x of nodo.f) dados.push(maq.coagir(yield* maq.avalComTipo(x, amb, tipoBase), tipoBase))
        else for (const x of nodo.f) yield* preencher(maq, x, nivel + 1)
      }
      yield* preencher(this, init, 0)
      return new Arr(tipoBase, dados, dims)
    }
    const itens = []
    for (const e of init.f) itens.push(this.coagir(yield* this.avalComTipo(e, amb, tipoBase), tipoBase))
    return new Arr(tipoBase, itens)
  },

  *criarDeColecao(tipo, n, amb) {
    const t = semNulo(tipo)
    if (ehArray(t)) {
      const elem = elementoDe(t)
      const itens = []
      for (const e of n.f) {
        if (e.t === 'spread_element') for (const x of yield* this.iterarGen(yield* this.aval(e.f[e.f.length - 1], amb))) itens.push(this.coagir(x, elem))
        else itens.push(this.coagir(yield* this.avalComTipo(e, amb, elem), elem))
      }
      return new Arr(elem, itens)
    }
    const { nome, args } = partesGenericas(t)
    const nat = this.bib.tipo(nome) ?? this.bib.tipo('List')
    const col = this.bib.criar(this, nat, [], args.length ? args : ['object'], t)
    for (const e of n.f) {
      if (e.t === 'spread_element') for (const x of yield* this.iterarGen(yield* this.aval(e.f[e.f.length - 1], amb))) yield* this.adicionarInicial(col, [x])
      else yield* this.adicionarInicial(col, [yield* this.avalComTipo(e, amb, args[0])])
    }
    return col
  },

  // ---- delegates ---------------------------------------------------------------------------------------------------

  /** Para a máquina e a biblioteca: um método do aluno como valor. */
  novaFuncaoDeMetodo(md, este) {
    return new FuncMetodo(md, este)
  },
}

// ---- as classes de lvalue ---------------------------------------------------------------------------------

function lvRef(maq, ref) {
  return {
    *ler() { return ref.v },
    *gravar(v) { ref.v = ref.t ? maq.coagir(v, ref.t) : v },
    tipo() { return ref.t },
    ref() { return ref },
  }
}

function lvPropriedade(maq, obj, p) {
  return {
    *ler() { return yield* maq.lerPropriedade(obj, p) },
    *gravar(v) { yield* maq.gravarPropriedade(obj, p, v) },
    tipo() { return p.tipo },
  }
}

function lvCampo(maq, obj, nome) {
  return {
    *ler() { return obj.campos.get(nome) },
    *gravar(v) { obj.campos.set(nome, maq.coagir(v, maq.tipoDeCampo(obj.cls, nome))) },
    tipo() { return maq.tipoDeCampo(obj.cls, nome) },
    ref() { return new RefCampo(obj, nome) },
  }
}

function lvIndice(maq, alvo, args) {
  return {
    *ler() { return yield* maq.indexar(alvo, args) },
    *gravar(v) {
      if (alvo === null || alvo === undefined) throw maq.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
      if (alvo instanceof Arr) {
        const i = maq.posicaoNoArray(alvo, args)
        alvo.itens[i] = maq.coagir(v, alvo.tipoElem)
        return
      }
      if (alvo instanceof Objeto) {
        const ix = maq.escolherIndexador(alvo, args)
        if (!ix?.set) throw new ErroCS(`${alvo.cls.nome} não tem indexador com set`, maq.linhaAtual)
        yield* maq.rodarAcessor(ix, ix.set, alvo, maq.coagir(v, ix.tipo), args)
        return
      }
      maq.bib.gravarIndice(maq, alvo, args, v)
    },
    tipo() { return alvo instanceof Arr ? alvo.tipoElem : null },
    ref() { return alvo instanceof Arr ? new RefElem(alvo, maq.posicaoNoArray(alvo, args)) : new Ref(maq.rodarSync(maq.indexar(alvo, args))) },
  }
}

function lvNativo(maq, obj, nome) {
  return {
    *ler() { return maq.bib.lerPropriedade(maq, obj, nome) },
    *gravar(v) { maq.bib.gravarPropriedade(maq, obj, nome, v) },
    tipo() { return null },
  }
}

function lvNativoEstatico(maq, nativo, nome) {
  return {
    *ler() { return maq.bib.lerEstatico(maq, nativo, nome) },
    *gravar(v) { maq.bib.gravarEstatico(maq, nativo, nome, v) },
    tipo() { return null },
  }
}

export { ExcecaoCS, Tupla, IteradorUsuario, FuncNativa, Lambda, tipoNumerico }
