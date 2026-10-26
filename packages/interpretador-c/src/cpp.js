// C++ no passo a passo: objetos (construtores, destrutores, métodos, herança e
// virtual), referências, temporários, new/delete e o for de intervalo. Os métodos
// abaixo são instalados na MaquinaC (que já sabe o C) quando o programa é C++.
//
// Modelo: todo objeto de classe mora na memória e é tratado pelo endereço. Um
// temporário (o resultado de uma função que devolve string, por exemplo) é construído
// num espaço da pilha e destruído no fim da expressão completa, como no C++ de verdade.

import { BIBLIOTECA } from './biblioteca.js'
import { BIBLIOTECA_CPP } from './biblioteca-cpp.js'
import { ErroC } from './erros.js'
import { INT, layout, tamanhoDe, vetor } from './tipos.js'

const semTemplate = (nome) => nome.replace(/<.*$/, '')

/** Uma exceção do C++ voando: o objeto lançado mora num bloco do heap até um catch terminar. */
export class ExcecaoCpp {
  constructor(endereco, tipo, linha) {
    this.endereco = endereco
    this.tipo = tipo
    this.linha = linha
  }
}
const DESEMBRULHAR = new Set(['ParenExpr', 'MaterializeTemporaryExpr', 'CXXFunctionalCastExpr'])

export const METODOS_CPP = {
  ehClasse(t) { return t?.k === 'struct' },
  registroDe(t) { return t?.k === 'struct' ? t.decl ?? null : null },
  tipoDaClasse(chave) { return this.tipos.struct(chave, false) },

  indiceDaClasse(chave) {
    this.classesPorIndice ??= []
    let i = this.classesPorIndice.indexOf(chave)
    if (i < 0) i = this.classesPorIndice.push(chave) - 1
    return i + 1
  },

  /** Objetos de classes com destrutor (ou com membros que têm) precisam ser destruídos. */
  precisaDestruir(t) {
    if (t.k === 'array') return this.precisaDestruir(t.elem)
    const r = this.registroDe(t)
    if (!r) return false
    if (r.precisaDestruir === undefined) {
      r.precisaDestruir = false // contra recursão
      r.precisaDestruir = r.destrutorNaoTrivial || layout(t).campos.some((c) => !c.oculto && this.precisaDestruir(c.tipo))
    }
    return r.precisaDestruir
  },

  // ---- quem é chamado ----------------------------------------------------------

  corpoDe(decl) { return (decl?.inner ?? []).find((n) => n.kind === 'CompoundStmt') },

  /** Protótipo → definição (a que tem corpo), para funções livres e métodos definidos fora da classe. */
  definicaoDe(decl, classe) {
    if (!decl) return null
    if (this.corpoDe(decl)) return decl
    if (classe) return this.metodosPorAssinatura.get(`${classe}::${decl.name}|${decl.type.qualType}`) ?? null
    return this.funcoesPorAssinatura.get(`${decl.name}|${decl.type.qualType}`) ?? null
  },

  classeDinamica(endereco, classe) {
    const r = this.registros.get(classe)
    if (!r?.polimorfica || !endereco) return classe
    const indice = this.mem.dv.getUint32(endereco, true)
    return this.classesPorIndice?.[indice - 1] ?? classe
  },

  baseDe(classe) {
    const b = this.registros.get(classe)?.bases?.[0]
    return b ? this.tipos.de(b).rotulo : null
  },

  /** Método virtual: procura a versão mais "de baixo", a partir do tipo de verdade do objeto. */
  despachar(decl, classe, objeto) {
    const semConst = (t) => t.replace(/\s*(const|noexcept|override)\s*$/g, '')
    for (let c = this.classeDinamica(objeto, classe); c; c = this.baseDe(c)) {
      const m = this.registros.get(c)?.metodos.find((x) => x.kind === decl.kind && x.name === decl.name && semConst(x.type.qualType) === semConst(decl.type.qualType))
      if (m) return { decl: m, classe: c }
    }
    return { decl, classe }
  },

  /** Deslocamento da base dentro da derivada (herança simples ou múltipla). */
  deslocamentoDaBase(derivada, base) {
    if (derivada === base) return 0
    for (const c of layout(derivada).campos) {
      if (!c.base) continue
      if (c.tipo === base) return c.deslocamento
      const dentro = this.deslocamentoDaBase(c.tipo, base)
      if (dentro !== null) return c.deslocamento + dentro
    }
    return null
  },

  // ---- argumentos e chamadas -----------------------------------------------------

  * argumentos(decl, tipoFn, nos) {
    const params = tipoFn?.params ?? []
    const parmDecls = (decl?.inner ?? []).filter((n) => n.kind === 'ParmVarDecl')
    const lista = []
    for (let i = 0; i < nos.length; i += 1) {
      let no = nos[i]
      if (no.kind === 'CXXDefaultArgExpr') no = no.inner?.[0] ?? parmDecls[i]?.inner?.[parmDecls[i].inner.length - 1]
      if (!no) throw new ErroC('valor padrão de parâmetro que o passo a passo não encontrou')
      const t = params[i]
      let valor
      if (t?.k === 'ref') valor = yield* this.end(no)
      else if (this.ehClasse(t)) valor = yield* this.temporario(no) // por valor: construído pelo chamador, o parâmetro só dá nome a ele
      else valor = yield* this.val(no)
      lista.push({ valor, tipo: t ?? this.tipo(no), no })
    }
    return lista
  },

  /** Chama uma função ou método já escolhido (com corpo, implícito ou da biblioteca). */
  * invocar(decl, classe, objeto, args, destino, chamada) {
    const tipoFn = this.tipos.de(decl.type)
    if (this.ehClasse(tipoFn.ret) && destino === undefined) destino = this.rascunho(Math.max(1, tamanhoDe(tipoFn.ret)))
    const nome = decl.name
    const nativa = BIBLIOTECA_CPP[classe ? `${semTemplate(classe)}::${nome}` : nome]
    // (uma função "..._js" da biblioteca é feita em JavaScript; o corpo vazio dela é só para o clang)
    const def = nativa && /_js$/.test(nome) ? null : this.definicaoDe(decl, classe)
    if (def) {
      return yield* this.chamarFuncao(def, args.map((a) => a.valor), this.linhaAtual, { this: objeto, destino, classe, args })
    }
    if (nativa) {
      const r = yield* nativa(this, { objeto, args, destino, decl, classe, tipoFn, chamada })
      return r === undefined && destino !== undefined ? destino : r
    }
    if (!classe && BIBLIOTECA[nome]) return yield* BIBLIOTECA[nome](this, args, chamada)
    if (classe && decl.kind === 'CXXMethodDecl' && decl.isImplicit && nome === 'operator=') {
      yield* this.atribuirObjeto(objeto, args[0].valor, this.tipoDaClasse(classe))
      return objeto
    }
    throw new ErroC(`${classe ? `${semTemplate(classe)}::` : ''}${nome} foi declarada mas não foi escrita (ou ainda não existe no passo a passo; rode com F9)`)
  },

  /** CallExpr, CXXMemberCallExpr e CXXOperatorCallExpr. `destino`: onde construir a classe devolvida. */
  * chamadaCpp(x, destino) {
    const [callee, ...resto] = x.inner
    if (x.kind === 'CXXMemberCallExpr') {
      let membro = callee
      while (membro.kind === 'ParenExpr') membro = membro.inner[0]
      const info = this.decls.get(membro.referencedMemberDecl)
      if (!info) throw new ErroC(`método ${membro.name} desconhecido`)
      const base = membro.inner[0]
      const objeto = membro.isArrow ? yield* this.val(base) : yield* this.end(base)
      if (membro.isArrow && !objeto) throw new ErroC(`chamada de ${membro.name}() por um ponteiro NULL`)
      let alvo = { decl: info.no, classe: info.classe }
      if (info.no.virtual && !membro.qualifier) alvo = this.despachar(info.no, info.classe, objeto)
      const args = yield* this.argumentos(alvo.decl, this.tipos.de(alvo.decl.type), resto)
      return yield* this.invocar(alvo.decl, alvo.classe, objeto, args, destino, x)
    }
    // Chamada por nome (função livre ou operador sobrecarregado).
    let c = callee
    while (c && (c.kind === 'ImplicitCastExpr' || c.kind === 'ParenExpr')) c = c.inner[0]
    const ref = c?.kind === 'DeclRefExpr' ? c.referencedDecl : null
    if (!ref || !/FunctionDecl|CXXMethodDecl|CXXConversionDecl/.test(ref.kind)) {
      // ponteiro de função (também para uma função da biblioteca: transform(..., ::toupper))
      const p = yield* this.val(callee)
      const nome = this.funcaoNoEndereco.get(Number(p))
      const def = nome && (this.funcoes.get(nome) ?? (BIBLIOTECA[nome] || BIBLIOTECA_CPP[nome] ? this.declaracaoPorNome(nome) : null))
      if (!def) throw new ErroC('chamada por um ponteiro de função inválido')
      const args = yield* this.argumentos(def, this.tipos.de(def.type), resto)
      return yield* this.invocar(def, null, undefined, args, destino, x)
    }
    const info = this.decls.get(ref.id) ?? { no: ref }
    if (x.kind === 'CXXOperatorCallExpr' && ref.kind === 'CXXMethodDecl') {
      const objeto = yield* this.end(resto[0])
      let alvo = { decl: info.no, classe: info.classe }
      if (info.no.virtual) alvo = this.despachar(info.no, info.classe, objeto)
      const args = yield* this.argumentos(alvo.decl, this.tipos.de(alvo.decl.type), resto.slice(1))
      return yield* this.invocar(alvo.decl, alvo.classe, objeto, args, destino, x)
    }
    const args = yield* this.argumentos(info.no, this.tipos.de(info.no.type), resto)
    const linha = this.linhaAtual
    const r = yield* this.invocar(info.no, info.classe ?? null, undefined, args, destino, x)
    this.linhaAtual = linha
    return r
  },

  /** A declaração de uma função livre pelo nome (para ponteiros de função da biblioteca). */
  declaracaoPorNome(nome) {
    this.funcoesPorNome ??= new Map()
    if (!this.funcoesPorNome.has(nome)) {
      let achada = null
      for (const { no } of this.decls.values()) if (no.kind === 'FunctionDecl' && no.name === nome) { achada = no; break }
      this.funcoesPorNome.set(nome, achada)
    }
    return this.funcoesPorNome.get(nome)
  },

  /** O construtor de cópia (X(const X &)) ou o operator= de cópia de uma classe, se ela tiver. */
  metodoDeCopia(t, nome) {
    return this.registroDe(t)?.metodos.find((m) => {
      if (nome ? m.name !== nome : m.kind !== 'CXXConstructorDecl') return false
      if (/&&/.test(m.type.qualType)) return false // de movimento
      const params = this.tipos.de(m.type).params ?? []
      return params.length === 1 && params[0].k === 'ref' && params[0].alvo === t
    }) ?? null
  },

  // ---- construção, cópia e destruição ---------------------------------------------

  /** Constrói um objeto de classe no endereço, a partir da expressão que o cria. */
  * construirEm(destino, x, temporario = false) {
    if (DESEMBRULHAR.has(x.kind)) return yield* this.construirEm(destino, x.inner[0], temporario)
    switch (x.kind) {
      case 'ExprWithCleanups': {
        const marca = this.temporarios.length
        yield* this.construirEm(destino, x.inner[0], temporario)
        yield* this.limparTemporarios(marca)
        return destino
      }
      case 'CXXBindTemporaryExpr':
        yield* this.construirEm(destino, x.inner[0], temporario)
        if (temporario) this.temporarios.push({ endereco: destino, tipo: this.tipo(x) })
        return destino
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr':
      case 'CXXStaticCastExpr':
        if (x.valueCategory === 'prvalue') return yield* this.construirEm(destino, x.inner[0], temporario)
        break
      case 'CXXConstructExpr':
      case 'CXXTemporaryObjectExpr': return yield* this.construtor(destino, x)
      case 'CallExpr':
      case 'CXXMemberCallExpr':
      case 'CXXOperatorCallExpr':
        if (x.valueCategory === 'prvalue') {
          yield* this.chamadaCpp(x, destino)
          return destino
        }
        break
      case 'InitListExpr':
        yield* this.inicializar(destino, this.tipo(x), x)
        return destino
      case 'LambdaExpr': return yield* this.construirLambda(destino, x)
      case 'CXXStdInitializerListExpr': {
        // initializer_list: um vetor temporário com os valores + { início, tamanho }.
        let lista = x.inner[0]
        const tipoVetor = this.tipo(lista)
        while (lista.kind !== 'InitListExpr' && lista.inner?.length === 1) lista = lista.inner[0]
        const vetorTemp = this.rascunho(Math.max(1, tamanhoDe(tipoVetor)))
        yield* this.inicializar(vetorTemp, tipoVetor, lista)
        // O vetor por trás da lista é temporário: some no fim da expressão (depois de o vector copiar os valores).
        if (this.precisaDestruir(tipoVetor)) this.temporarios.push({ endereco: vetorTemp, tipo: tipoVetor })
        this.mem.escrever(INT, destino, vetorTemp)
        this.mem.escrever(INT, destino + 4, tipoVetor.n ?? 0)
        return destino
      }
      default:
    }
    // Um objeto que já existe (lvalue): cópia.
    const origem = yield* this.end(x)
    yield* this.copiarObjeto(destino, origem, this.tipo(x))
    return destino
  },

  /** O objeto de uma lambda: um campo por captura (o valor copiado, ou o endereço se for por referência). */
  * construirLambda(destino, x) {
    const t = this.tipo(x)
    const campos = layout(t).campos
    const inits = x.inner.slice(1, -1)
    for (let i = 0; i < inits.length; i += 1) {
      const c = campos[i]
      const e = destino + c.deslocamento
      if (c.tipo.k === 'ref') this.mem.escrever(c.tipo, e, yield* this.end(inits[i]))
      else yield* this.inicializar(e, c.tipo, inits[i])
    }
    return destino
  },

  /** Um objeto temporário construído a partir de uma expressão (ou o próprio objeto, se ela já for um). */
  * temporario(x) {
    if (x.valueCategory !== 'prvalue') return yield* this.end(x)
    const t = this.tipo(x)
    const e = this.rascunho(Math.max(1, tamanhoDe(t)))
    yield* this.construirEm(e, x, true)
    return e
  },

  * limparTemporarios(marca) {
    while (this.temporarios.length > marca) {
      const t = this.temporarios.pop()
      yield* this.destruirObjeto(t.endereco, t.tipo)
    }
  },

  achaConstrutor(classe, tipoTexto) {
    const r = this.registros.get(classe)
    return r?.metodos.find((m) => m.kind === 'CXXConstructorDecl' && m.type.qualType === tipoTexto) ?? null
  },

  * construtor(destino, x) {
    const t = this.tipo(x)
    if (t.k === 'array') return yield* this.construirVetor(destino, t, x)
    const classe = t.rotulo
    if (x.zeroing) this.mem.preencher(destino, 0, tamanhoDe(t))
    const ctor = this.achaConstrutor(classe, x.ctorType.qualType)
    const args = yield* this.argumentos(ctor, this.tipos.de(x.ctorType), x.inner ?? [])
    return yield* this.chamarConstrutor(ctor, classe, destino, args)
  },

  * construirVetor(destino, t, x) {
    const tam = tamanhoDe(t.elem)
    for (let i = 0; i < (t.n ?? 0); i += 1) {
      const ctor = this.achaConstrutor(t.elem.rotulo, x.ctorType.qualType)
      yield* this.chamarConstrutor(ctor, t.elem.rotulo, destino + i * tam, [])
    }
    return destino
  },

  * chamarConstrutor(ctor, classe, destino, args) {
    const def = ctor && this.definicaoDe(ctor, classe)
    if (def) {
      yield* this.chamarFuncao(def, args.map((a) => a.valor), this.linhaAtual, { this: destino, classe, construtor: true, args })
      return destino
    }
    const nativa = BIBLIOTECA_CPP[`${semTemplate(classe)}::${semTemplate(classe)}`]
    if (nativa) {
      yield* nativa(this, { objeto: destino, args, classe, decl: ctor })
      return destino
    }
    // Construtor implícito: padrão (sem argumentos) ou de cópia/movimento (um argumento do próprio tipo).
    const t = this.tipoDaClasse(classe)
    if (args.length === 1) yield* this.copiarObjeto(destino, args[0].valor, t)
    else yield* this.iniciarObjeto(null, classe, destino)
    return destino
  },

  * construirPadrao(destino, t) {
    if (t.k === 'array') {
      for (let i = 0; i < (t.n ?? 0); i += 1) yield* this.construirPadrao(destino + i * tamanhoDe(t.elem), t.elem)
      return
    }
    if (!this.ehClasse(t)) return
    const ctor = this.registroDe(t)?.metodos.find((m) => m.kind === 'CXXConstructorDecl' && /^void \(\)/.test(m.type.qualType))
    yield* this.chamarConstrutor(ctor, t.rotulo, destino, [])
  },

  /** Antes do corpo do construtor: as bases, o tipo dinâmico (vptr) e os membros. */
  * iniciarObjeto(ctor, classe, objeto) {
    const t = this.tipoDaClasse(classe)
    const r = this.registroDe(t)
    if (!r) return
    const inits = (ctor?.inner ?? []).filter((n) => n.kind === 'CXXCtorInitializer')
    const campos = layout(t).campos
    for (const c of campos.filter((x) => x.base)) {
      const init = inits.find((i) => i.baseInit && this.tipos.de(i.baseInit) === c.tipo)
      if (init) yield* this.construirEm(objeto + c.deslocamento, init.inner[0])
      else yield* this.construirPadrao(objeto + c.deslocamento, c.tipo)
    }
    if (r.polimorfica) {
      const raiz = objeto // herança simples: o vptr da base mais de cima fica no começo do objeto
      this.mem.escrever(INT, raiz, this.indiceDaClasse(classe))
    }
    for (const c of campos.filter((x) => !x.base && !x.oculto)) {
      const decl = r.campos.find((x) => x.nome === c.nome)?.decl
      // pelo id (os campos de uma lambda não têm nome no clang)
      const init = inits.find((i) => (decl && i.anyInit?.id === decl.id) || (i.anyInit?.name && i.anyInit.name === c.nome))
      const destino = objeto + c.deslocamento
      let expr = init?.inner?.[0]
      if (!expr || expr.kind === 'CXXDefaultInitExpr') {
        expr = decl?.hasInClassInitializer ? decl.inner?.[decl.inner.length - 1] : null
      }
      if (expr) yield* this.inicializar(destino, c.tipo, expr)
      else yield* this.construirPadrao(destino, c.tipo)
    }
  },

  * copiarObjeto(destino, origem, t) {
    if (destino === origem) return
    if (t.k === 'array') {
      const tam = tamanhoDe(t.elem)
      for (let i = 0; i < (t.n ?? 0); i += 1) yield* this.copiarObjeto(destino + i * tam, origem + i * tam, t.elem)
      return
    }
    if (!this.ehClasse(t)) return this.mem.copiar(destino, origem, tamanhoDe(t))
    const r = this.registroDe(t)
    const copia = this.metodoDeCopia(t)
    const def = copia && this.definicaoDe(copia, t.rotulo)
    if (def) return yield* this.chamarFuncao(def, [origem], this.linhaAtual, { this: destino, classe: t.rotulo, construtor: true })
    const nativa = BIBLIOTECA_CPP[`${semTemplate(t.rotulo)}::${semTemplate(t.rotulo)}`]
    if (nativa) return yield* nativa(this, { objeto: destino, args: [{ valor: origem, tipo: { k: 'ref', alvo: t } }], classe: t.rotulo, copia: true })
    // Cópia implícita: membro a membro (e o vptr passa a ser o desta classe).
    for (const c of layout(t).campos) {
      if (c.oculto) continue
      yield* this.copiarObjeto(destino + c.deslocamento, origem + c.deslocamento, c.tipo)
    }
    if (r?.polimorfica) this.mem.escrever(INT, destino, this.indiceDaClasse(t.rotulo))
  },

  * atribuirObjeto(destino, origem, t) {
    if (destino === origem) return
    if (!this.ehClasse(t)) return this.mem.copiar(destino, origem, tamanhoDe(t))
    const op = this.metodoDeCopia(t, 'operator=')
    const def = op && this.definicaoDe(op, t.rotulo)
    if (def) return yield* this.chamarFuncao(def, [origem], this.linhaAtual, { this: destino, classe: t.rotulo })
    const nativa = BIBLIOTECA_CPP[`${semTemplate(t.rotulo)}::operator=`]
    if (nativa) return yield* nativa(this, { objeto: destino, args: [{ valor: origem, tipo: { k: 'ref', alvo: t } }], classe: t.rotulo })
    for (const c of layout(t).campos) {
      if (c.oculto) continue
      if (this.ehClasse(c.tipo)) yield* this.atribuirObjeto(destino + c.deslocamento, origem + c.deslocamento, c.tipo)
      else this.mem.copiar(destino + c.deslocamento, origem + c.deslocamento, tamanhoDe(c.tipo))
    }
  },

  * destruirObjeto(e, t) {
    if (t.k === 'array') {
      const tam = tamanhoDe(t.elem)
      for (let i = (t.n ?? 0) - 1; i >= 0; i -= 1) yield* this.destruirObjeto(e + i * tam, t.elem)
      return
    }
    if (!this.precisaDestruir(t)) return
    const classe = t.rotulo
    const r = this.registroDe(t)
    const dtor = r?.metodos.find((m) => m.kind === 'CXXDestructorDecl')
    const def = dtor && this.definicaoDe(dtor, classe)
    if (def) return yield* this.chamarFuncao(def, [], this.linhaAtual, { this: e, classe, destrutor: true })
    const nativa = BIBLIOTECA_CPP[`${semTemplate(classe)}::~${semTemplate(classe)}`]
    if (nativa) return yield* nativa(this, { objeto: e, args: [], classe })
    yield* this.destruirMembros(e, t)
  },

  * destruirMembros(e, t) {
    for (const c of [...layout(t).campos].reverse()) {
      if (!c.oculto) yield* this.destruirObjeto(e + c.deslocamento, c.tipo)
    }
  },

  * destruirLocais(quadro, marca) {
    for (const v of quadro.variaveis.slice(marca).reverse()) {
      if (!v.apelido && v.tipo && this.precisaDestruir(v.tipo)) yield* this.destruirObjeto(v.endereco, v.tipo)
    }
  },

  // ---- new e delete ------------------------------------------------------------

  * novo(x) {
    const t = this.tipo(x).alvo
    const tam = Math.max(1, tamanhoDe(t))
    if (x.isArray) {
      const n = Number(yield* this.val(x.inner[0]))
      if (n < 0) throw new ErroC(`new com tamanho negativo (${n})`)
      const e = this.mem.malloc(n * tam, false, { tipoElem: t, novo: 'vetor' })
      if (!e) throw new ErroC('não há memória para o new')
      const init = x.inner[1]
      if (init?.kind === 'InitListExpr') yield* this.inicializar(e, vetor(t, n), init)
      else for (let i = 0; i < n; i += 1) yield* this.construirPadrao(e + i * tam, t)
      return e
    }
    const e = this.mem.malloc(tam, false, { tipoElem: t, novo: 'objeto' })
    if (!e) throw new ErroC('não há memória para o new')
    const init = x.inner?.[x.inner.length - 1]
    if (init && init.kind !== 'ImplicitValueInitExpr') yield* this.inicializar(e, t, init)
    else if (init) this.mem.preencher(e, 0, tam)
    else yield* this.construirPadrao(e, t)
    return e
  },

  * apagar(x) {
    const p = Number(yield* this.val(x.inner[0]))
    if (!p) return undefined
    const t = this.tipo(x.inner[0]).alvo
    const bloco = this.mem.heap.find((b) => b.inicio === p)
    if (bloco && this.precisaDestruir(t)) {
      if (x.isArray || x.isArrayAsWritten) {
        const n = Math.floor(bloco.tamanho / Math.max(1, tamanhoDe(t)))
        for (let i = n - 1; i >= 0; i -= 1) yield* this.destruirObjeto(p + i * tamanhoDe(t), t)
      } else {
        // delete por ponteiro da base com destrutor virtual: destrói como o tipo de verdade.
        const real = this.ehClasse(t) ? this.tipoDaClasse(this.classeDinamica(p, t.rotulo)) : t
        yield* this.destruirObjeto(p, real)
      }
    }
    this.mem.free(p)
    return undefined
  },

  // ---- exceções: throw, try/catch --------------------------------------------------

  * lancar(x) {
    if (!x.inner?.length) { // "throw;" relança a exceção que o catch atual está tratando
      const atual = this.excecoesAtivas.at(-1)
      if (!atual) throw new ErroC('throw; fora de um catch: não há exceção para relançar')
      throw atual
    }
    const expr = x.inner[0]
    const t = this.tipo(expr)
    const e = this.mem.malloc(Math.max(1, tamanhoDe(t)), false, { tipoElem: t, excecao: true })
    if (!e) throw new ErroC('não há memória para a exceção')
    if (this.ehClasse(t)) yield* this.construirEm(e, expr)
    else this.mem.escrever(t, e, yield* this.val(expr))
    throw new ExcecaoCpp(e, t, this.linhaAtual)
  },

  /** Lança uma exceção da biblioteca (out_of_range...) se o programa incluiu <stdexcept>; senão, é erro do passo a passo. */
  * lancarDaBiblioteca(classe, mensagem, explicacao) {
    const ctor = this.achaConstrutor(classe, 'void (const char *)')
    if (!ctor) throw new ErroC(mensagem, 0, explicacao)
    const t = this.tipoDaClasse(classe)
    const texto = this.rascunho(mensagem.length + 1)
    this.mem.gravarCadeia(texto, mensagem)
    const e = this.mem.malloc(tamanhoDe(t), false, { tipoElem: t, excecao: true })
    yield* this.chamarConstrutor(ctor, classe, e, [{ valor: texto, tipo: { k: 'ptr' } }])
    throw new ExcecaoCpp(e, t, this.linhaAtual)
  },

  /** O catch aceita a exceção? Mesmo tipo, ou uma classe base dela (por valor, referência ou ponteiro). */
  capturaAceita(tc, exc) {
    const alvo = tc.k === 'ref' ? tc.alvo : tc
    const lancado = exc.tipo
    if (this.ehClasse(alvo)) return this.ehClasse(lancado) && this.deslocamentoDaBase(lancado, alvo) !== null
    if (alvo.k === 'ptr' && lancado.k === 'ptr') {
      if (this.ehClasse(alvo.alvo) && this.ehClasse(lancado.alvo)) return this.deslocamentoDaBase(lancado.alvo, alvo.alvo) !== null
      return alvo.alvo.nome === lancado.alvo.nome || alvo.alvo.k === 'void'
    }
    return alvo.k === lancado.k && alvo.tamanho === lancado.tamanho && !!alvo.sinal === !!lancado.sinal && !!alvo.bool === !!lancado.bool
  },

  * vincularCaptura(decl, exc) {
    const t = this.tipos.de(decl.type)
    const alvo = t.k === 'ref' ? t.alvo : t
    const desloc = this.ehClasse(alvo) && this.ehClasse(exc.tipo) ? this.deslocamentoDaBase(exc.tipo, alvo) ?? 0 : 0
    const v = this.novaLocal(decl, t)
    if (t.k === 'ref') this.mem.escrever(t, v.endereco, exc.endereco + desloc)
    else if (this.ehClasse(t)) yield* this.copiarObjeto(v.endereco, exc.endereco + desloc, t)
    else this.mem.escrever(t, v.endereco, this.converter(this.mem.ler(exc.tipo, exc.endereco), exc.tipo, t))
  },

  * liberarExcecao(exc) {
    if (this.ehClasse(exc.tipo)) {
      const real = this.tipoDaClasse(this.classeDinamica(exc.endereco, exc.tipo.rotulo))
      yield* this.destruirObjeto(exc.endereco, real)
    }
    this.mem.free(exc.endereco)
  },

  * tentar(no) {
    const [corpo, ...capturas] = no.inner
    const quadro = this.quadro
    const marcaTemporarios = this.temporarios.length
    let excecao
    try {
      return yield* this.exec(corpo)
    } catch (e) {
      if (!(e instanceof ExcecaoCpp)) throw e
      excecao = e
    }
    // As funções chamadas dentro do try já saíram (cada uma destruiu os seus objetos); os temporários da expressão também saem.
    yield* this.limparTemporarios(marcaTemporarios)
    for (const c of capturas) {
      const decl = (c.inner ?? []).find((n) => n?.kind === 'VarDecl')
      if (decl && !this.capturaAceita(this.tipos.de(decl.type), excecao)) continue
      const corpoDoCatch = (c.inner ?? []).find((n) => n?.kind === 'CompoundStmt')
      yield this.linha(c)
      const marcaVariaveis = quadro.variaveis.length
      const marcaPilha = this.mem.topoPilha
      this.excecoesAtivas.push(excecao)
      let r
      try {
        if (decl) yield* this.vincularCaptura(decl, excecao)
        r = yield* this.exec(corpoDoCatch)
        yield* this.destruirLocais(quadro, marcaVariaveis)
      } finally {
        this.excecoesAtivas.pop()
        for (const v of quadro.variaveis.splice(marcaVariaveis)) quadro.porId.delete(v.id)
        this.mem.desempilharAte(marcaPilha)
      }
      yield* this.liberarExcecao(excecao) // o catch terminou sem relançar: a exceção acabou
      return r
    }
    throw excecao // nenhum catch aceitou: continua subindo
  },

  /** Exceção que chegou ao fim do main: vira um erro com o what() (se houver) e a linha do throw. */
  * erroDeExcecao(exc) {
    let detalhe = ''
    const t = exc.tipo
    try {
      if (this.ehClasse(t)) {
        const classe = this.classeDinamica(exc.endereco, t.rotulo)
        for (let c = classe; c && !detalhe; c = this.baseDe(c)) {
          const what = this.registros.get(c)?.metodos.find((m) => m.name === 'what')
          if (what) detalhe = this.cadeia(yield* this.invocar(what, c, exc.endereco, [], undefined))
        }
        detalhe ||= `um objeto ${t.nome}`
      } else if (t.k === 'ptr') detalhe = this.mem.cadeia(this.mem.ler(t, exc.endereco), 300)
      else detalhe = String(this.mem.ler(t, exc.endereco))
    } catch {
      detalhe ||= 'sem descrição'
    }
    const texto = new TextDecoder().decode(Uint8Array.from(detalhe, (ch) => ch.charCodeAt(0)))
    return new ErroC(`exceção não tratada: ${texto}`, exc.linha,
      'Um throw lançou uma exceção que subiu até o main sem nenhum catch que a aceitasse. Envolva o trecho num try { ... } catch (const exception &e) { ... }.')
  },

  // ---- for de intervalo: for (auto x : v) -------------------------------------------

  * paraIntervalo(no) {
    const [init, intervalo, comeco, fim, cond, inc, variavel, corpo] = no.inner
    const quadro = this.quadro
    const marcaPilha = this.mem.topoPilha
    const marcaVariaveis = quadro.variaveis.length
    try {
      if (init?.kind) yield* this.exec(init)
      yield this.linha(no)
      for (const d of [intervalo, comeco, fim]) for (const v of d.inner) yield* this.declarar(v)
      for (;;) {
        if (!this.verdade(yield* this.val(cond))) break
        const marcaVolta = quadro.variaveis.length
        const pilhaVolta = this.mem.topoPilha
        for (const v of variavel.inner) yield* this.declarar(v)
        yield this.linha(no)
        const r = yield* this.exec(corpo)
        yield* this.destruirLocais(quadro, marcaVolta)
        for (const v of quadro.variaveis.splice(marcaVolta)) quadro.porId.delete(v.id)
        this.mem.desempilharAte(pilhaVolta)
        if (r && r.tipo !== 'continue') {
          if (r.tipo === 'break') break
          return r
        }
        yield* this.val(inc)
      }
      return undefined
    } catch (e) {
      if (e instanceof ExcecaoCpp) yield* this.destruirLocais(quadro, marcaVariaveis)
      throw e
    } finally {
      for (const v of quadro.variaveis.splice(marcaVariaveis)) quadro.porId.delete(v.id)
      this.mem.desempilharAte(marcaPilha)
    }
  },

  // ---- expressões que só existem no C++ -----------------------------------------------

  * valCpp(x) {
    const t = x.type ? this.tipo(x) : null
    switch (x.kind) {
      case 'CXXBoolLiteralExpr': return x.value ? 1 : 0
      case 'CXXNullPtrLiteralExpr': return 0
      case 'CXXThisExpr': return this.quadro?.this ?? 0
      case 'CXXScalarValueInitExpr': return 0
      case 'SubstNonTypeTemplateParmExpr':
      case 'CXXDefaultArgExpr':
      case 'CXXDefaultInitExpr': return yield* this.val(x.inner[x.inner.length - 1])
      case 'ExprWithCleanups': {
        const marca = this.temporarios.length
        const v = yield* this.val(x.inner[0])
        yield* this.limparTemporarios(marca)
        return v
      }
      case 'CXXBindTemporaryExpr':
      case 'MaterializeTemporaryExpr':
      case 'CXXConstructExpr':
      case 'CXXTemporaryObjectExpr':
      case 'CXXStdInitializerListExpr': return yield* this.temporario(x)
      case 'CXXFunctionalCastExpr':
      case 'CXXStaticCastExpr':
      case 'CXXReinterpretCastExpr':
      case 'CXXConstCastExpr':
        if (this.ehClasse(t)) return yield* this.temporario(x)
        return yield* this.conversao(x)
      case 'CXXMemberCallExpr':
      case 'CXXOperatorCallExpr':
        if (this.ehClasse(t) && x.valueCategory === 'prvalue') return yield* this.temporario(x)
        return yield* this.chamadaCpp(x)
      case 'CXXNewExpr': return yield* this.novo(x)
      case 'CXXDeleteExpr': return yield* this.apagar(x)
      case 'LambdaExpr': return yield* this.temporario(x)
      case 'CXXThrowExpr': return yield* this.lancar(x)
      case 'CXXTypeidExpr': throw new ErroC('typeid ainda não funciona no passo a passo')
      default: throw new ErroC(`o passo a passo ainda não sabe calcular "${x.kind}"`)
    }
  },

  /** Endereço (lvalue) das expressões do C++; undefined = a MaquinaC resolve. */
  * endCpp(x) {
    switch (x.kind) {
      case 'MaterializeTemporaryExpr':
      case 'CXXBindTemporaryExpr':
      case 'CXXConstructExpr':
      case 'CXXTemporaryObjectExpr': {
        const t = this.tipo(x)
        const e = this.rascunho(Math.max(1, tamanhoDe(t)))
        // (MaterializeTemporaryExpr é xvalue/lvalue: constrói direto, sem passar de novo por temporario())
        if (this.ehClasse(t)) yield* this.construirEm(e, x.kind === 'MaterializeTemporaryExpr' ? x.inner[0] : x, true)
        else yield* this.inicializar(e, t, x.kind === 'MaterializeTemporaryExpr' || x.kind === 'CXXBindTemporaryExpr' ? x.inner[0] : x)
        return e
      }
      case 'ExprWithCleanups': return yield* this.end(x.inner[0])
      case 'CXXDefaultArgExpr':
      case 'SubstNonTypeTemplateParmExpr': return yield* this.end(x.inner[x.inner.length - 1])
      case 'CallExpr':
      case 'CXXMemberCallExpr':
      case 'CXXOperatorCallExpr':
        if (x.valueCategory !== 'prvalue') return yield* this.chamadaCpp(x)
        if (this.ehClasse(this.tipo(x))) return yield* this.temporario(x)
        return undefined
      case 'CXXStaticCastExpr':
      case 'CXXFunctionalCastExpr':
      case 'CXXConstCastExpr':
      case 'CXXReinterpretCastExpr':
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr':
        if (['DerivedToBase', 'UncheckedDerivedToBase'].includes(x.castKind) && x.valueCategory !== 'prvalue') {
          const e = yield* this.end(x.inner[0])
          return e + (this.deslocamentoDaBase(this.tipo(x.inner[0]), this.tipo(x)) ?? 0)
        }
        if (x.valueCategory !== 'prvalue') return yield* this.end(x.inner[0])
        if (this.ehClasse(this.tipo(x))) return yield* this.temporario(x)
        return undefined
      case 'MemberExpr': {
        // Membro estático (uma variável da classe, não do objeto).
        const g = this.globais.get(x.referencedMemberDecl)
        if (g) return g.endereco
        return undefined
      }
      case 'ConditionalOperator':
        if (x.valueCategory !== 'prvalue') {
          const c = yield* this.val(x.inner[0])
          return yield* this.end(this.verdade(c) ? x.inner[1] : x.inner[2])
        }
        return undefined
      case 'BinaryOperator':
      case 'CompoundAssignOperator':
        if (x.valueCategory === 'lvalue' && x.opcode !== ',') {
          yield* this.val(x)
          return yield* this.end(x.inner[0])
        }
        return undefined
      case 'UnaryOperator':
        if ((x.opcode === '++' || x.opcode === '--') && !x.isPostfix) {
          yield* this.val(x)
          return yield* this.end(x.inner[0])
        }
        return undefined
      default: return undefined
    }
  },

  /** Conversões de ponteiro entre base e derivada (ajustam o endereço). */
  ajustarPonteiro(x, v) {
    if (x.castKind === 'DerivedToBase' || x.castKind === 'UncheckedDerivedToBase') {
      if (!v) return 0
      return v + (this.deslocamentoDaBase(this.tipo(x.inner[0]).alvo ?? this.tipo(x.inner[0]), this.tipo(x).alvo ?? this.tipo(x)) ?? 0)
    }
    if (x.castKind === 'BaseToDerived') {
      if (!v) return 0
      return v - (this.deslocamentoDaBase(this.tipo(x).alvo ?? this.tipo(x), this.tipo(x.inner[0]).alvo ?? this.tipo(x.inner[0])) ?? 0)
    }
    return undefined
  },
}
