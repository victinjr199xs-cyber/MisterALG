// Máquina do passo a passo do C: anda pela árvore (AST em JSON) que o clang gerou
// para o programa e executa cada nó, com a memória de bytes de memoria.js. Tudo é
// gerador: a cada linha ela entrega { tipo: 'linha' } e, quando precisa de entrada,
// { tipo: 'entrada' } — é assim que a IDE pausa, mostra a memória e continua.

import { BIBLIOTECA } from './biblioteca.js'
import { ErroC, EXPLICACOES } from './erros.js'
import { INICIO_ESTATICO, Memoria } from './memoria.js'
import { ExcecaoCpp, METODOS_CPP } from './cpp.js'
import { DOUBLE, Tipos, alinhamentoDe, ehInteiro, layout, ponteiro, tamanhoDe } from './tipos.js'

const FIM_DE_LACO = { tipo: 'break' }
const PROXIMA_VOLTA = { tipo: 'continue' }
const INICIO_FUNCOES = 0x100 // "endereços" das funções (para ponteiros de função); fora da memória de dados
// Cada chamada do C usa uns 10 quadros de gerador do JS; acima disto a pilha do próprio JS estoura.
const MAX_CHAMADAS = 900

/** exit(n): sai do programa de qualquer profundidade. */
export class SaidaDoPrograma {
  constructor(codigo) { this.codigo = codigo }
}

const ehExpressao = (no) => !!no?.kind && !/(Stmt|Decl)$/.test(no.kind) && /Expr|Operator|Literal/.test(no.kind)

/** Texto do StringLiteral do clang ("\"Olá\\n\"") → bytes num texto binário. */
function decodificarLiteral(bruto) {
  const s = bruto.replace(/^[uUL8]*"/, '').replace(/"$/, '')
  let saida = ''
  const codificador = new TextEncoder()
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]
    if (c !== '\\') {
      const cp = s.codePointAt(i)
      if (cp < 0x80) saida += c
      else {
        for (const b of codificador.encode(String.fromCodePoint(cp))) saida += String.fromCharCode(b)
        if (cp > 0xffff) i += 1
      }
      continue
    }
    const e = s[++i]
    const simples = { n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, '\\': 92, "'": 39, '"': 34, '?': 63, e: 27 }
    if (e in simples) saida += String.fromCharCode(simples[e])
    else if (e === 'x') {
      const m = /^[0-9a-fA-F]+/.exec(s.slice(i + 1))[0]
      saida += String.fromCharCode(Number.parseInt(m, 16) & 0xff)
      i += m.length
    } else if (/[0-7]/.test(e)) {
      const m = /^[0-7]{1,3}/.exec(s.slice(i))[0]
      saida += String.fromCharCode(Number.parseInt(m, 8) & 0xff)
      i += m.length - 1
    } else saida += e
  }
  return saida
}

export class MaquinaC {
  /**
   * @param ast árvore do clang (objeto já lido do JSON)
   * @param fonte o texto do programa (para converter as posições em bytes em linhas)
   * @param op { saida(textoBinario), aleatorio?: () => número, agora?: () => ms }
   */
  constructor(ast, fonte, op = {}) {
    this.ast = ast
    this.op = op
    this.mem = new Memoria()
    this.registros = new Map()
    this.chavePorId = new Map() // id da RecordDecl → nome em this.registros
    this.apelidos = new Map()
    this.tipos = new Tipos(this.registros, this.apelidos)
    this.funcoes = new Map() // nome → FunctionDecl com corpo
    this.funcoesPorAssinatura = new Map() // "nome|tipo" → FunctionDecl com corpo (C++ tem sobrecarga)
    this.decls = new Map() // id → { no, classe } das funções e métodos
    this.metodosPorAssinatura = new Map() // "Classe::nome|tipo" → método com corpo
    this.temporarios = [] // C++: objetos temporários a destruir no fim da expressão completa
    this.excecoesAtivas = [] // C++: as exceções que os catch em andamento estão tratando (para o "throw;")
    this.cpp = !!op.cpp
    this.globais = new Map() // id da declaração → variável { nome, tipo, endereco }
    this.listaGlobais = []
    this.enums = new Map()
    this.literais = new Map()
    this.enderecosDeFuncao = new Map()
    this.funcaoNoEndereco = new Map()
    this.pilha = []
    this.quadro = null
    this.linhaAtual = 0
    this.entrada = ''
    this.posEntrada = 0
    this.fimDaEntrada = false
    this.semente = 1
    this.estadoStrtok = 0
    this.agora = op.agora ?? (() => Date.now())
    this.inicio = this.agora()
    this.permitirFim = false
    // Linhas: o clang dá posições em bytes (UTF-8) do arquivo.
    const bytes = new TextEncoder().encode(fonte)
    this.bytesDaFonte = bytes
    this.inicioDasLinhas = [0]
    for (let i = 0; i < bytes.length; i += 1) if (bytes[i] === 10) this.inicioDasLinhas.push(i + 1)
    this.leitor = this.criarLeitor()
  }

  // ---- preparação --------------------------------------------------------------------

  linhaDoDeslocamento(off) {
    let a = 0
    let b = this.inicioDasLinhas.length - 1
    while (a < b) {
      const m = (a + b + 1) >> 1
      if (this.inicioDasLinhas[m] <= off) a = m
      else b = m - 1
    }
    return a + 1
  }

  /**
   * Os caches guardados no próprio nó (tipo, linha, campo) valem para esta máquina: se o mesmo objeto da
   * árvore passar por outra, eles são refeitos.
   */
  cacheDo(no) {
    if (no.__m !== this) {
      no.__m = this
      no.__t = undefined
      no.__l = undefined
      no.__campo = undefined
      no.__info = undefined // (funções)
      no.__tf = undefined
      no.__nativa = undefined
      no.__def = undefined
      no.__despacho = undefined
    }
    return no
  }

  linhaDe(no) {
    if (!no) return this.linhaAtual
    if (this.cacheDo(no).__l === undefined) {
      const ini = no.range?.begin ?? no.loc
      const off = ini?.offset ?? ini?.expansionLoc?.offset ?? ini?.spellingLoc?.offset
      no.__l = off === undefined ? null : this.linhaDoDeslocamento(off)
    }
    return no.__l ?? this.linhaAtual
  }

  /** Percorre a árvore inteira uma vez: tipos, enums, funções, literais e globais. */
  preparar() {
    const anonimo = (no) => {
      const off = no.loc?.offset ?? no.loc?.spellingLoc?.offset
      const linha = this.linhaDoDeslocamento(off)
      return `__anon_${linha}_${off - this.inicioDasLinhas[linha - 1] + 1}`
    }
    const globaisParaIniciar = []
    const moldeDe = (t) => (t.inner ?? []).find((c) => /^(FunctionDecl|CXXMethodDecl|CXXConstructorDecl|CXXDestructorDecl|CXXConversionDecl|CXXRecordDecl|CXXDeductionGuideDecl)$/.test(c.kind))
    // O clang só escreve "file" numa posição quando o arquivo muda em relação à posição anterior
    // (na ordem do JSON); acompanhando isso dá para saber o que veio dos cabeçalhos.
    let arquivo = null
    let principal = null
    const anotarArquivo = (pos) => {
      if (!pos) return
      for (const p of [pos, pos.spellingLoc, pos.expansionLoc]) if (p?.file) arquivo = p.file
    }
    const visitar = (no, dentroDeFuncao, classe) => {
      if (!no || typeof no !== 'object') return
      anotarArquivo(no.loc)
      anotarArquivo(no.range?.begin)
      anotarArquivo(no.range?.end)
      principal ??= this.cpp ? 'programa.cpp' : 'programa.c'
      if (arquivo && arquivo !== principal) no.biblioteca = true
      let classeDosFilhos = classe
      switch (no.kind) {
        case 'RecordDecl':
        case 'CXXRecordDecl':
        case 'ClassTemplateSpecializationDecl':
          if (no.completeDefinition && (!no.isImplicit || no.nomeDaLambda)) {
            let nome = no.nomeDaLambda ?? (no.name || anonimo(no))
            if (no.kind === 'ClassTemplateSpecializationDecl') {
              // um pacote (class... T) vem como um argumento só, com os de verdade dentro
              const args = (no.inner ?? []).filter((c) => c.kind === 'TemplateArgument').flatMap((c) => (c.isPack ? (c.inner ?? []) : [c]))
              nome = this.tipos.chaveDeTemplate(nome, args.map((c) => c.type?.qualType ?? String(c.value ?? '')))
            }
            const filhos = no.inner ?? []
            // os métodos que são templates (template <class I> map(I a, I b)) entram pelas especializações
            const metodos = filhos.flatMap((c) => (c.kind === 'FunctionTemplateDecl' ? (c.inner ?? []).filter((x) => x !== moldeDe(c)) : [c]))
            this.registros.set(nome, {
              uniao: no.tagUsed === 'union',
              campos: filhos.filter((c) => c.kind === 'FieldDecl').map((c) => ({ nome: c.name ?? '', tipo: c.type.qualType, decl: c })),
              bases: (no.bases ?? []).map((b) => b.type.qualType),
              metodos: metodos.filter((c) => /^CXX(Method|Constructor|Destructor|Conversion)Decl$/.test(c.kind)),
              polimorfica: !!no.definitionData?.isPolymorphic,
              destrutorNaoTrivial: !!no.definitionData?.dtor?.nonTrivial,
              cpp: no.kind !== 'RecordDecl',
              nome,
              capturas: no.capturas,
              biblioteca: !!no.biblioteca,
            })
            this.chavePorId.set(no.id, nome)
            classeDosFilhos = nome
          }
          break
        case 'LambdaExpr': {
          // A classe da lambda vem sem nome: ganha o do tipo, e os campos, o nome do que capturam.
          const classe = no.inner?.[0]
          if (classe?.kind === 'CXXRecordDecl') {
            classe.nomeDaLambda = this.tipos.de(no.type).rotulo
            classe.capturas = this.capturasDaLambda(no, classe)
          }
          break
        }
        case 'FunctionTemplateDecl':
        case 'ClassTemplateDecl': {
          if (no.kind === 'ClassTemplateDecl' && !this.tipos.padroes.has(no.name)) {
            // os valores padrão dos parâmetros, para as chaves das especializações saírem como o clang escreve os tipos
            this.tipos.padroes.set(no.name, (no.inner ?? []).filter((c) => /^(TemplateTypeParm|NonTypeTemplateParm|TemplateTemplateParm)Decl$/.test(c.kind)).map((c) => {
              let padrao = null
              if (c.defaultArg?.type) padrao = c.defaultArg.type.qualType
              else if (c.defaultArg) {
                const expr = c.inner?.find((x) => x.kind === 'TemplateArgument')?.inner?.[0]
                try { if (expr) padrao = String(this.constante(expr)) } catch { /* sem valor fixo */ }
              }
              return { nome: c.name, padrao }
            }))
          }
          // O primeiro filho é o "molde" (com tipos T ainda abertos); só as especializações valem.
          const molde = moldeDe(no)
          for (const filho of no.inner ?? []) if (filho !== molde) visitar(filho, dentroDeFuncao, classe)
          return
        }
        case 'CXXMethodDecl':
        case 'CXXConstructorDecl':
        case 'CXXDestructorDecl':
        case 'CXXConversionDecl': {
          // Método definido fora da classe (Conta::depositar) traz o id da classe em parentDeclContextId.
          const dono = classe ?? this.chavePorId.get(no.parentDeclContextId)
          this.decls.set(no.id, { no, classe: dono })
          if ((no.inner ?? []).some((c) => c.kind === 'CompoundStmt')) this.metodosPorAssinatura.set(`${dono}::${no.name}|${no.type.qualType}`, no)
          break
        }
        case 'TypedefDecl':
        case 'TypeAliasDecl': {
          // typedef dentro de classe (map<...>::iterator): o clang dá o tipo de verdade junto (desugaredQualType)
          if (classe) { this.tipos.apelidosDeMembro.add(no.id); break }
          this.apelidos.set(no.name, no.type.qualType)
          // typedef struct { ... } Pessoa; — o clang chama a struct anônima de "struct Pessoa".
          const tag = /^(?:struct|union) (\w+)$/.exec(no.type.qualType)?.[1]
          const dono = this.declDeRegistro(no)
          if (tag && dono && !this.registros.has(tag) && this.chavePorId.has(dono)) this.registros.set(tag, this.registros.get(this.chavePorId.get(dono)))
          break
        }
        case 'EnumDecl': {
          let valor = -1
          for (const c of no.inner ?? []) {
            if (c.kind !== 'EnumConstantDecl') continue
            const expr = c.inner?.[0]
            valor = expr ? Number(this.constante(expr)) : valor + 1
            this.enums.set(c.id, valor)
          }
          break
        }
        case 'FunctionDecl':
          this.decls.set(no.id, { no })
          if ((no.inner ?? []).some((c) => c.kind === 'CompoundStmt')) {
            this.funcoes.set(no.name, no)
            this.funcoesPorAssinatura.set(`${no.name}|${no.type.qualType}`, no)
          }
          break
        case 'StringLiteral':
          if (!this.literais.has(no.id)) {
            const tipo = this.tipos.de(no.type)
            const e = this.mem.alocarEstatico(tipo.tamanho, 1, { nome: 'texto constante', tipo, literal: true })
            this.mem.gravarCadeia(e, decodificarLiteral(no.value).slice(0, tipo.tamanho - 1))
            this.literais.set(no.id, e)
          }
          break
        case 'VarDecl':
          if (!dentroDeFuncao || no.storageClass === 'static' || no.storageClass === 'extern') {
            // membro static: a classe dele (o "int A::n = 0;" de fora da classe aponta para ela em parentDeclContextId)
            no.classeDaVariavel = classe ?? this.chavePorId.get(no.parentDeclContextId) ?? null
            globaisParaIniciar.push(no)
          }
          break
        default:
      }
      const ehFuncao = /^(FunctionDecl|CXXMethodDecl|CXXConstructorDecl|CXXDestructorDecl|CXXConversionDecl)$/.test(no.kind)
      for (const filho of no.inner ?? []) visitar(filho, dentroDeFuncao || ehFuncao, classeDosFilhos)
      if (no.array_filler) for (const f of [].concat(no.array_filler)) visitar(f, dentroDeFuncao, classe)
    }
    visitar(this.ast, false, null)
    // Só a classe polimórfica mais de base ganha o "vptr" (as derivadas usam o dela).
    for (const r of this.registros.values()) {
      r.vptr = r.polimorfica && !(r.bases ?? []).some((b) => this.registroDe(this.tipos.de(b))?.polimorfica)
    }

    // Globais (e static locais): uma vez só, já com o valor inicial.
    for (const d of globaisParaIniciar) {
      if (this.globais.has(d.id)) continue
      const ja = [...this.globais.values()].find((g) => g.nome === d.name && !g.local && g.classe === d.classeDaVariavel && d.storageClass === 'extern')
      if (ja) { this.globais.set(d.id, ja); continue }
      const tipo = this.tipos.de(d.type)
      const variavel = { nome: d.name, classe: d.classeDaVariavel, tipo, tipoTexto: d.type.qualType, endereco: 0, local: !!d.storageClass && d.storageClass === 'static' && this.estaEmFuncao(d) }
      variavel.endereco = this.mem.alocarEstatico(tamanhoDe(tipo), alinhamentoDe(tipo), { nome: d.name, tipo })
      this.globais.set(d.id, variavel)
      // Um extern do cabeçalho (stdin...) ganha um valor diferente de zero, para não parecer NULL.
      if (d.biblioteca) {
        if (tipo.k === 'ptr') this.mem.escrever(tipo, variavel.endereco, variavel.endereco)
        variavel.doCabecalho = true
      } else this.listaGlobais.push(variavel)
      // (a mesma variável declarada de novo; membros static de mesmo nome em classes diferentes são variáveis diferentes)
      for (const outro of globaisParaIniciar) if (outro !== d && outro.name === d.name && outro.classeDaVariavel === d.classeDaVariavel && !this.globais.has(outro.id) && !this.estaEmFuncao(outro)) this.globais.set(outro.id, variavel)
    }
    this.textoC = this.mem.alocarEstatico(2, 1, { nome: 'texto constante' })
    this.mem.gravarCadeia(this.textoC, 'C')
    this.mem.fixarPilha()
    for (const d of globaisParaIniciar) {
      const init = d.init ? d.inner?.[d.inner.length - 1] : null
      if (!init || !ehExpressao(init)) continue
      const g = this.globais.get(d.id)
      const gen = this.inicializar(g.endereco, g.tipo, init)
      while (!gen.next().done) { /* inicializar globais não pausa */ }
    }
    if (!this.funcoes.has('main')) throw new ErroC('o programa não tem a função main')
  }

  /**
   * Capturas de uma lambda, na ordem dos campos da classe dela: { nome, ids (das variáveis de fora que o
   * corpo usa), this }. No corpo, o clang aponta para a variável de fora, e não para o campo; ao chamar a
   * lambda, cada campo entra no quadro com o id dessa variável.
   */
  capturasDaLambda(lambda, classe) {
    const campos = (classe.inner ?? []).filter((c) => c.kind === 'FieldDecl')
    const inits = (lambda.inner ?? []).slice(1, -1)
    // Os nomes das capturas com valor inicial ([n = 0]) só aparecem no texto: [a, &b, n = 0, this].
    const escritas = []
    const ini = lambda.range?.begin?.offset
    if (ini !== undefined && this.bytesDaFonte[ini] === 0x5b && !lambda.range.begin.includedFrom) {
      let texto = ''
      let nivel = 0
      for (let i = ini + 1; i < this.bytesDaFonte.length; i += 1) {
        const c = String.fromCharCode(this.bytesDaFonte[i])
        if ('([{'.includes(c)) nivel += 1
        else if (')]}'.includes(c)) { if (nivel === 0) break; nivel -= 1 }
        texto += c === ',' && nivel > 0 ? '\u0001' : c
      }
      for (const item of texto.split(',').map((x) => x.trim()).filter((x) => x && x !== '&' && x !== '=')) {
        escritas.push(/^&?\s*([A-Za-z_]\w*)\s*[={(]/.exec(item)?.[1] ?? null)
      }
    }
    const operadores = []
    const juntar = (n) => {
      if (!n || typeof n !== 'object') return
      if (n.kind === 'CXXMethodDecl' && n.name === 'operator()') operadores.push(n)
      if (n.kind === 'FunctionTemplateDecl' || n === classe) for (const f of n.inner ?? []) juntar(f)
    }
    juntar(classe)
    const idsUsados = (nome) => {
      const ids = new Set()
      const ver = (n) => {
        if (!n || typeof n !== 'object') return
        if (n.kind === 'DeclRefExpr' && n.referencedDecl?.kind === 'VarDecl' && n.referencedDecl.name === nome) ids.add(n.referencedDecl.id)
        for (const f of n.inner ?? []) ver(f)
      }
      operadores.forEach(ver)
      return [...ids]
    }
    return campos.map((campo, i) => {
      let x = inits[i]
      while (x && ['ImplicitCastExpr', 'ParenExpr', 'ExprWithCleanups', 'MaterializeTemporaryExpr', 'CXXBindTemporaryExpr', 'CXXConstructExpr', 'CXXFunctionalCastExpr'].includes(x.kind) && x.inner?.length === 1) x = x.inner[0]
      if (x?.kind === 'CXXThisExpr' && !escritas[i]) {
        campo.name = 'this'
        return { nome: 'this', ids: [], this: true }
      }
      const nome = escritas[i] ?? (x?.kind === 'DeclRefExpr' ? x.referencedDecl.name : `(captura ${i + 1})`)
      campo.name = nome
      const ids = escritas[i] ? idsUsados(nome) : x?.kind === 'DeclRefExpr' ? [x.referencedDecl.id] : []
      return { nome, ids }
    })
  }

  /** O id da struct/union que um typedef nomeia (a árvore do tipo traz "decl" ou "ownedTagDecl"). */
  declDeRegistro(no) {
    for (const filho of no.inner ?? []) {
      const d = filho.ownedTagDecl ?? filho.decl
      if (d?.kind === 'RecordDecl' || d?.kind === 'CXXRecordDecl') return d.id
      const dentro = this.declDeRegistro(filho)
      if (dentro) return dentro
    }
    return null
  }

  estaEmFuncao(d) {
    if (this.declsEmFuncao === undefined) {
      this.declsEmFuncao = new Set()
      const marcar = (no, dentro) => {
        if (!no || typeof no !== 'object') return
        if (dentro && no.kind === 'VarDecl') this.declsEmFuncao.add(no.id)
        for (const f of no.inner ?? []) marcar(f, dentro || no.kind === 'FunctionDecl')
      }
      marcar(this.ast, false)
    }
    return this.declsEmFuncao.has(d.id)
  }

  /** Expressão constante já calculada pelo clang (ConstantExpr) ou um literal simples. */
  constante(expr) {
    if (expr.value !== undefined) return expr.value
    if (expr.inner?.length) return this.constante(expr.inner[0])
    throw new ErroC('valor de enum que o passo a passo não sabe calcular')
  }

  // ---- entrada (stdin) --------------------------------------------------------------

  criarLeitor() {
    const m = this
    return {
      * espiar() {
        while (m.posEntrada >= m.entrada.length) {
          if (m.fimDaEntrada) return -1
          const linha = yield { tipo: 'entrada' }
          if (linha === null || linha === undefined) {
            m.fimDaEntrada = true
            return -1
          }
          m.entrada = m.entrada.slice(m.posEntrada) + m.paraBinario(`${linha}\n`)
          m.posEntrada = 0
        }
        return m.entrada.charCodeAt(m.posEntrada)
      },
      avancar() { m.posEntrada += 1 },
      pendente: () => m.posEntrada < m.entrada.length,
      /** Joga fora o que já foi digitado e ainda não foi lido (o Enter que sobra do scanf). */
      descartarPendente() {
        m.entrada = ''
        m.posEntrada = 0
      },
      descartarLinha() {
        const fim = m.entrada.indexOf('\n', m.posEntrada)
        m.posEntrada = fim < 0 ? m.entrada.length : fim + 1
      },
    }
  }

  paraBinario(texto) {
    let s = ''
    for (const b of new TextEncoder().encode(texto)) s += String.fromCharCode(b)
    return s
  }

  // ---- ajudantes usados pela biblioteca ----------------------------------------------

  saida(textoBinario) { this.op.saida?.(textoBinario) }
  cadeia(e, limite) { return this.mem.cadeia(Number(e), limite) }
  textoFixo() { return this.textoC }
  arquivo(nome) {
    const g = [...this.globais.values()].find((x) => x.nome === nome && x.doCabecalho)
    return g ? this.mem.ler(g.tipo, g.endereco) : -1
  }
  saidaDoPrograma(codigo) { return new SaidaDoPrograma(codigo) }
  rascunho(n = 8) { return this.mem.empilhar(n, 8, { nome: '(temporário)' }) }
  semearAleatorio(s) { this.semente = (s >>> 0) || 1 }
  aleatorio() {
    if (this.op.aleatorio) return this.op.aleatorio()
    // O mesmo gerador do C da glibc antiga (LCG): sem srand, a sequência é sempre a mesma.
    this.semente = (Math.imul(this.semente, 1103515245) + 12345) >>> 0
    return (this.semente >>> 1) & 0x7fffffff
  }

  // ---- execução --------------------------------------------------------------------

  /** Roda o main; devolve o código de saída. */
  * executar() {
    try {
      const r = yield* this.chamarFuncao(this.funcoes.get('main'), [], 0)
      return Number(r ?? 0)
    } catch (e) {
      if (e instanceof SaidaDoPrograma) return e.codigo
      if (e instanceof ExcecaoCpp) throw yield* this.erroDeExcecao(e)
      throw e
    }
  }

  /**
   * Evento de linha (o passo a passo pausa aqui); null dentro do código dos cabeçalhos, que roda sem pausar.
   * Quem chama só faz yield quando há evento: um yield de null subiria por todos os geradores da pilha à toa.
   */
  linha(no) {
    if (this.quadro?.biblioteca) return null
    this.linhaAtual = this.linhaDe(no)
    if (this.quadro) this.quadro.linha = this.linhaAtual
    // (o mesmo objeto a cada linha: quem recebe o evento lê na hora)
    this.eventoLinha ??= { tipo: 'linha', linha: 0 }
    this.eventoLinha.linha = this.linhaAtual
    return this.eventoLinha
  }

  /** O que uma chamada precisa da função (parâmetros, corpo, tipo, nome por classe), calculado uma vez. */
  infoDaFuncao(def) {
    if (this.cacheDo(def).__info === undefined) {
      const filhos = def.inner ?? []
      def.__info = {
        params: filhos.filter((n) => n.kind === 'ParmVarDecl'),
        corpo: filhos.find((n) => n.kind === 'CompoundStmt'),
        retorno: this.tipos.de(def.type).ret,
        linha: this.linhaDe(def),
        nomes: new Map(), // classe → "Classe::nome"
      }
    }
    return def.__info
  }

  tipo(no) {
    if (this.cacheDo(no).__t === undefined) no.__t = this.tipos.de(no.type)
    return no.__t
  }

  /**
   * @param ctx C++: { this, classe, destino (onde construir a classe devolvida), construtor, destrutor }
   */
  * chamarFuncao(def, valores, linhaDaChamada, ctx = {}) {
    if (this.pilha.length >= MAX_CHAMADAS) throw new ErroC('chamadas demais uma dentro da outra (recursão infinita?)', 0, EXPLICACOES.pilha)
    const info = this.infoDaFuncao(def)
    const { params, corpo } = info
    const marca = this.mem.topoPilha
    const anterior = this.quadro
    let nome = def.name
    if (ctx.classe) {
      nome = info.nomes.get(ctx.classe)
      if (nome === undefined) {
        nome = `${ctx.classe.replace(/<.*$/, '')}::${def.name}`
        info.nomes.set(ctx.classe, nome)
      }
    }
    const quadro = {
      funcao: nome, linha: info.linha, linhaDaChamada, variaveis: [], porId: new Map(),
      this: ctx.this, destino: ctx.destino, retorno: info.retorno, biblioteca: !!def.biblioteca,
    }
    this.pilha.push(quadro)
    this.quadro = quadro
    try {
      // (só o operator() da lambda; o operator= e os construtores dela usam o this normal)
      const capturas = ctx.classe && def.name === 'operator()' && this.registros.get(ctx.classe)?.capturas
      if (capturas && ctx.this !== undefined) {
        // Lambda: o que ela capturou aparece com o nome de fora (por cópia: o campo; por referência: o original).
        const campos = layout(this.tipoDaClasse(ctx.classe)).campos
        quadro.this = undefined
        capturas.forEach((c, i) => {
          const campo = campos[i]
          if (c.this) { quadro.this = this.mem.ler(campo.tipo, ctx.this + campo.deslocamento); return }
          const v = { id: `captura ${i}`, nome: c.nome, tipo: campo.tipo, tipoTexto: campo.tipo.nome ?? '', endereco: ctx.this + campo.deslocamento, apelido: true }
          quadro.variaveis.push(v)
          for (const id of c.ids) quadro.porId.set(id, v)
        })
      } else if (ctx.this !== undefined) {
        // "this" aparece na tela de memória como um ponteiro para o objeto.
        this.ponteirosThis ??= new Map()
        let pt = this.ponteirosThis.get(ctx.classe)
        if (!pt) {
          pt = { tipo: ponteiro(this.tipoDaClasse(ctx.classe)), texto: `${ctx.classe.replace(/<.*$/, '')} *` }
          this.ponteirosThis.set(ctx.classe, pt)
        }
        const e = this.mem.empilhar(4, 4, { nome: 'this', tipo: pt.tipo })
        this.mem.escrever(pt.tipo, e, ctx.this)
        quadro.variaveis.push({ id: 'this', nome: 'this', tipo: pt.tipo, tipoTexto: pt.texto, endereco: e, apelido: true })
      }
      for (let i = 0; i < params.length; i += 1) {
        const p = params[i]
        const t = this.tipo(p)
        if (this.cpp && t.k === 'struct') {
          // Parâmetro por valor de classe: o chamador já construiu o objeto; aqui ele só ganha um nome.
          const v = { id: p.id, nome: p.name || `(parâmetro ${i + 1})`, tipo: t, tipoTexto: p.type.qualType, endereco: valores[i], apelido: true }
          quadro.variaveis.push(v)
          quadro.porId.set(p.id, v)
          continue
        }
        const variavel = this.novaLocal(p, t)
        if (t.k === 'struct') this.mem.gravarBytes(variavel.endereco, valores[i])
        else if (valores[i] !== undefined) this.mem.escrever(t, variavel.endereco, valores[i])
        variavel.apelido = t.k === 'ref'
      }
      if (this.linha(def)) yield this.eventoLinha
      if (ctx.construtor) yield* this.iniciarObjeto(def, ctx.classe, ctx.this)
      const r = yield* this.bloco(corpo?.inner ?? [], true)
      if (ctx.destrutor) yield* this.destruirMembros(ctx.this, this.tipoDaClasse(ctx.classe))
      if (r?.tipo === 'return') return r.valor
      if (ctx.destino !== undefined) return ctx.destino
      return def.name === 'main' ? 0 : undefined
    } finally {
      this.pilha.pop()
      this.quadro = anterior
      this.mem.desempilharAte(marca)
    }
  }

  * chamarPorEndereco(endereco, valores) {
    const nome = this.funcaoNoEndereco.get(Number(endereco))
    const def = nome && this.funcoes.get(nome)
    if (!def) throw new ErroC('chamada por um ponteiro de função inválido', 0, EXPLICACOES.invalido)
    return yield* this.chamarFuncao(def, valores, this.linhaAtual)
  }

  enderecoDeFuncao(nome) {
    let e = this.enderecosDeFuncao.get(nome)
    if (e === undefined) {
      e = INICIO_FUNCOES + this.enderecosDeFuncao.size * 8
      this.enderecosDeFuncao.set(nome, e)
      this.funcaoNoEndereco.set(e, nome)
    }
    return e
  }

  novaLocal(decl, tipo) {
    const tamanho = tamanhoDe(tipo)
    if (tipo.k === 'array' && tipo.n === null) throw new ErroC(`vetor "${decl.name}" sem tamanho fixo: o passo a passo ainda não aceita vetor de tamanho variável (rode com F9)`)
    const endereco = this.mem.empilhar(tamanho, alinhamentoDe(tipo), { nome: decl.name, tipo })
    const variavel = { id: decl.id, nome: decl.name, tipo, tipoTexto: decl.type.qualType, endereco }
    this.quadro.variaveis.push(variavel)
    this.quadro.porId.set(decl.id, variavel)
    return variavel
  }

  * bloco(lista, eDeFuncao = false) {
    const marcaPilha = this.mem.topoPilha
    const quadro = this.quadro
    const marcaVariaveis = quadro.variaveis.length
    const marcaTemporarios = this.temporarios.length
    try {
      let r
      for (let i = 0; i < lista.length; i += 1) {
        r = yield* this.exec(lista[i])
        if (r?.tipo === 'goto') {
          // goto para um rótulo deste mesmo bloco (para frente ou para trás); senão sobe até o bloco que o tem.
          const alvo = lista.findIndex((s) => { let l = s; while (l.kind === 'LabelStmt') { if (l.declId === r.alvo) return true; l = l.inner[0] } return false })
          if (alvo >= 0) { i = alvo - 1; r = undefined; continue }
        }
        if (r) break
      }
      // C++: os objetos declarados neste bloco são destruídos ao sair dele (na ordem inversa).
      if (this.cpp && quadro.variaveis.length > marcaVariaveis) yield* this.destruirLocais(quadro, marcaVariaveis)
      return r
    } catch (e) {
      // Uma exceção atravessando o bloco também destrói os objetos dele (o "desempilhamento" do C++).
      // (antes, os temporários da expressão que lançou: eles moram na pilha deste bloco)
      if (e instanceof ExcecaoCpp) {
        yield* this.limparTemporarios(marcaTemporarios)
        yield* this.destruirLocais(quadro, marcaVariaveis)
      }
      throw e
    } finally {
      if (!eDeFuncao) {
        if (quadro.variaveis.length > marcaVariaveis) for (const v of quadro.variaveis.splice(marcaVariaveis)) quadro.porId.delete(v.id)
        this.mem.desempilharAte(marcaPilha)
      }
    }
  }

  // ---- comandos ----------------------------------------------------------------------

  * exec(no) {
    switch (no.kind) {
      case 'CompoundStmt': return yield* this.bloco(no.inner ?? [])
      case 'NullStmt': return undefined
      case 'DeclStmt':
        if (this.linha(no)) yield this.eventoLinha
        for (const d of no.inner ?? []) if ((d.kind === 'VarDecl' || d.kind === 'DecompositionDecl') && !this.globais.has(d.id)) yield* this.declarar(d)
        return undefined
      case 'IfStmt': {
        const [cond, entao, senao] = this.partesDoIf(no)
        if (this.linha(no)) yield this.eventoLinha
        if (this.verdade(yield* this.val(cond))) return yield* this.exec(entao)
        return senao ? yield* this.exec(senao) : undefined
      }
      case 'WhileStmt': {
        const [cond, corpo] = no.inner
        for (;;) {
          if (this.linha(no)) yield this.eventoLinha
          if (!this.verdade(yield* this.val(cond))) return undefined
          const r = yield* this.exec(corpo)
          if (r === FIM_DE_LACO) return undefined
          if (r && r !== PROXIMA_VOLTA) return r
        }
      }
      case 'DoStmt': {
        const [corpo, cond] = no.inner
        for (;;) {
          const r = yield* this.exec(corpo)
          if (r === FIM_DE_LACO) return undefined
          if (r && r !== PROXIMA_VOLTA) return r
          if (this.linha(cond)) yield this.eventoLinha
          if (!this.verdade(yield* this.val(cond))) return undefined
        }
      }
      case 'ForStmt': return yield* this.para(no)
      case 'SwitchStmt': return yield* this.escolha(no)
      case 'BreakStmt': if (this.linha(no)) yield this.eventoLinha; return FIM_DE_LACO
      case 'ContinueStmt': if (this.linha(no)) yield this.eventoLinha; return PROXIMA_VOLTA
      case 'ReturnStmt': {
        if (this.linha(no)) yield this.eventoLinha
        const expr = no.inner?.[0]
        if (!expr) return { tipo: 'return', valor: undefined }
        const ret = this.quadro.retorno
        // C++: classe devolvida é construída direto no lugar que o chamador reservou; referência devolve o endereço.
        if (this.cpp && ret?.k === 'struct') return { tipo: 'return', valor: yield* this.construirEm(this.quadro.destino, expr) }
        if (ret?.k === 'ref') return { tipo: 'return', valor: yield* this.end(expr) }
        return { tipo: 'return', valor: yield* this.val(expr) }
      }
      case 'CXXForRangeStmt': return yield* this.paraIntervalo(no)
      case 'LabelStmt': return yield* this.exec(no.inner[0])
      case 'CaseStmt': return yield* this.exec(no.inner[no.inner.length - 1])
      case 'DefaultStmt': return yield* this.exec(no.inner[0])
      case 'GotoStmt': if (this.linha(no)) yield this.eventoLinha; return { tipo: 'goto', alvo: no.targetLabelDeclId }
      case 'CXXTryStmt': return yield* this.tentar(no)
      default:
        if (!(no.__ex ??= ehExpressao(no))) throw new ErroC(`o passo a passo ainda não sabe executar "${no.kind}"`)
        if (this.linha(no)) yield this.eventoLinha
        if (no.__sv ?? this.simplesVal(no)) this.valR(no)
        else yield* this.val(no)
        return undefined
    }
  }

  partesDoIf(no) {
    const partes = [...(no.inner ?? [])]
    if (no.hasInit) partes.shift()
    if (no.hasVar) partes.shift()
    return [partes[0], partes[1], no.hasElse ? partes[2] : null]
  }

  * para(no) {
    // O clang põe 5 filhos no for (init, variável da condição, condição, incremento, corpo); os ausentes vêm como {}.
    const [init, , cond, inc, corpo] = no.inner
    const marcaPilha = this.mem.topoPilha
    const quadro = this.quadro
    const marcaVariaveis = quadro.variaveis.length
    try {
      let r
      if (init?.kind) yield* this.exec(init)
      for (;;) {
        if (this.linha(no)) yield this.eventoLinha
        if (cond?.kind && !this.verdade(yield* this.val(cond))) break
        r = yield* this.exec(corpo)
        if (r === FIM_DE_LACO) { r = undefined; break }
        if (r && r !== PROXIMA_VOLTA) break
        r = undefined
        if (inc?.kind) yield* this.val(inc)
      }
      if (this.cpp && quadro.variaveis.length > marcaVariaveis) yield* this.destruirLocais(quadro, marcaVariaveis)
      return r
    } catch (e) {
      if (e instanceof ExcecaoCpp) yield* this.destruirLocais(quadro, marcaVariaveis)
      throw e
    } finally {
      if (quadro.variaveis.length > marcaVariaveis) for (const v of quadro.variaveis.splice(marcaVariaveis)) quadro.porId.delete(v.id)
      this.mem.desempilharAte(marcaPilha)
    }
  }

  * escolha(no) {
    const cond = no.inner[0]
    const corpo = no.inner[no.inner.length - 1]
    if (this.linha(no)) yield this.eventoLinha
    const valor = yield* this.val(cond)
    const lista = corpo.kind === 'CompoundStmt' ? corpo.inner ?? [] : [corpo]
    const casa = (s) => {
      if (s.kind === 'CaseStmt') return BigInt(this.constante(s.inner[0])) === BigInt(valor) || casa(s.inner[s.inner.length - 1])
      return false
    }
    const temDefault = (s) => s.kind === 'DefaultStmt' || (s.kind === 'CaseStmt' && temDefault(s.inner[s.inner.length - 1]))
    let inicio = lista.findIndex(casa)
    if (inicio < 0) inicio = lista.findIndex(temDefault)
    if (inicio < 0) return undefined
    for (const s of lista.slice(inicio)) {
      const r = yield* this.exec(s)
      if (r === FIM_DE_LACO) return undefined
      if (r) return r
    }
    return undefined
  }

  * declarar(d) {
    const tipo = this.tipos.de(d.type)
    const variavel = this.novaLocal(d, tipo)
    const filhos = (d.inner ?? []).filter((c) => c.kind !== 'BindingDecl')
    const init = d.init ? filhos[filhos.length - 1] : null
    if (init && ehExpressao(init)) yield* this.inicializar(variavel.endereco, tipo, init)
    if (d.kind === 'DecompositionDecl') {
      // auto [a, b] = par; — cada nome é um apelido para uma parte do objeto escondido
      variavel.nome = `[${(d.inner ?? []).filter((c) => c.kind === 'BindingDecl').map((c) => c.name).join(', ')}]`
      for (const b of d.inner ?? []) {
        if (b.kind !== 'BindingDecl') continue
        const expr = b.inner?.[b.inner.length - 1]
        const tipo = b.type ?? expr.type // (o BindingDecl vem sem tipo: é o da expressão)
        const v = { id: b.id, nome: b.name, tipo: this.tipos.de(tipo), tipoTexto: tipo.qualType, endereco: yield* this.end(expr), apelido: true }
        this.quadro.variaveis.push(v)
        this.quadro.porId.set(b.id, v)
      }
    }
  }

  * inicializar(e, t, x) {
    if (this.cpp) {
      if (t.k === 'ref') {
        // Referência: guarda o endereço do que ela passa a ser (int &r = v[1]).
        this.mem.escrever(t, e, yield* this.end(x))
        return
      }
      if (t.k === 'struct' && x.kind !== 'InitListExpr') {
        yield* this.construirEm(e, x)
        return
      }
      if (x.kind === 'ExprWithCleanups') {
        const marca = this.temporarios.length
        yield* this.inicializar(e, t, x.inner[0])
        yield* this.limparTemporarios(marca)
        return
      }
      if (t.k === 'array' && (x.kind === 'CXXConstructExpr' || x.kind === 'CXXTemporaryObjectExpr')) {
        yield* this.construtor(e, x)
        return
      }
    }
    if (x.kind === 'InitListExpr') {
      let itens = x.inner ?? []
      // O clang despeja o preenchimento do vetor E os valores dados em `array_filler` quando a lista é parcial
      // (int v[5] = {1, 2}): o 1º é o preenchimento, o resto são os valores.
      if (!itens.length && Array.isArray(x.array_filler) && x.array_filler.length > 1) itens = x.array_filler.slice(1)
      this.mem.preencher(e, 0, tamanhoDe(t))
      if (t.k === 'array') {
        const tam = tamanhoDe(t.elem)
        let i = 0
        for (; i < itens.length; i += 1) yield* this.inicializar(e + i * tam, t.elem, itens[i])
        const enchimento = x.array_filler && [].concat(x.array_filler).filter((f) => f.kind)[0]
        if (enchimento && enchimento.kind !== 'ImplicitValueInitExpr') for (; i < t.n; i += 1) yield* this.inicializar(e + i * tam, t.elem, enchimento)
      } else if (t.k === 'struct') {
        const campos = layout(t).campos.filter((c) => !c.oculto)
        if (t.uniao) {
          const campo = campos.find((c) => c.nome === x.field?.name) ?? campos[0]
          if (itens[0]) yield* this.inicializar(e, campo.tipo, itens[0])
        } else {
          for (let i = 0; i < campos.length && i < itens.length; i += 1) yield* this.inicializar(e + campos[i].deslocamento, campos[i].tipo, itens[i])
        }
      } else if (itens[0]) yield* this.inicializar(e, t, itens[0])
      return
    }
    if (x.kind === 'ImplicitValueInitExpr') {
      this.mem.preencher(e, 0, tamanhoDe(t))
      return
    }
    if (t.k === 'array') {
      let lit = x
      while (lit.kind === 'ParenExpr' || lit.kind === 'ImplicitCastExpr') lit = lit.inner[0]
      if (lit.kind === 'StringLiteral') {
        this.mem.preencher(e, 0, t.tamanho)
        const s = this.mem.cadeia(this.literais.get(lit.id))
        this.mem.gravarCadeia(e, s.slice(0, t.n), s.length < t.n)
        return
      }
    }
    const v = yield* this.val(x)
    this.guardar(t, e, v)
  }

  /** Grava um valor e, se for um ponteiro para o começo de um bloco do malloc, anota o tipo do bloco. */
  guardar(t, e, v) {
    if (t.k === 'struct') return typeof v === 'number' ? this.mem.copiar(e, v, tamanhoDe(t)) : this.mem.gravarBytes(e, v)
    this.mem.escrever(t, e, v)
    if (t.k === 'ptr' && t.alvo.k !== 'void' && v) {
      const b = this.mem.bloco(v)
      if (b?.regiao === 'heap' && !b.tipoElem && b.inicio === v) b.tipoElem = t.alvo
    }
    return undefined
  }

  // ---- valores --------------------------------------------------------------------

  verdade(v) { return v !== 0 && v !== 0n && v !== undefined }

  normalizar(t, n) {
    if (t.bool) return this.verdade(n) ? 1 : 0
    const bits = t.tamanho * 8
    if (bits >= 64) return t.sinal ? BigInt.asIntN(64, BigInt(n)) : BigInt.asUintN(64, BigInt(n))
    let x = typeof n === 'bigint' ? Number(BigInt.asIntN(bits, n)) : n
    if (bits === 32) return t.sinal ? x | 0 : x >>> 0
    if (bits === 16) return t.sinal ? (x << 16) >> 16 : x & 0xffff
    x &= 0xff
    return t.sinal ? (x << 24) >> 24 : x
  }

  converter(v, de, para) {
    if (para.k === 'void') return undefined
    if (para.k === 'struct' || para.k === 'array' || para.k === 'func') return v
    if (para.bool) return this.verdade(v) ? 1 : 0
    if (para.k === 'int') {
      if (typeof v === 'number' && de.k === 'real') {
        if (!Number.isFinite(v)) return this.normalizar(para, para.tamanho === 8 ? -(2n ** 63n) : -2147483648)
        v = Math.trunc(v)
        if (Math.abs(v) >= 2 ** 53 || para.tamanho === 8) return this.normalizar(para, BigInt(v))
      }
      return this.normalizar(para, v)
    }
    if (para.k === 'real') {
      const n = Number(v)
      return para.tamanho === 4 ? Math.fround(n) : n
    }
    if (para.k === 'ptr' || para.k === 'ref') return Number(BigInt.asUintN(32, BigInt(typeof v === 'number' ? Math.trunc(v) : v)))
    return v
  }

  carregar(t, e) {
    if (t.k === 'struct') return this.mem.lerBytes(e, tamanhoDe(t))
    if (t.k === 'array') return e
    return this.mem.ler(t, e)
  }

  literal(no) { return this.literais.get(no.id) }

  * val(x) {
    if (x.__sv ?? this.simplesVal(x)) return this.valR(x)
    switch (x.kind) {
      case 'IntegerLiteral': {
        const t = this.tipo(x)
        return t.tamanho >= 8 ? this.normalizar(t, BigInt(x.value)) : Number(x.value)
      }
      case 'CharacterLiteral': return x.value
      case 'FloatingLiteral': return Number(x.value)
      case 'StringLiteral': return this.literal(x)
      case 'ParenExpr': return yield* this.val(x.inner[0])
      case 'ConstantExpr':
        if (x.value !== undefined) {
          const t = this.tipo(x)
          if (x.value === 'true' || x.value === 'false') return x.value === 'true' ? 1 : 0 // if constexpr
          return ehInteiro(t) ? this.normalizar(t, t.tamanho >= 8 ? BigInt(x.value) : Number(x.value)) : yield* this.val(x.inner[0])
        }
        return yield* this.val(x.inner[0])
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr': return yield* this.conversao(x)
      case 'DeclRefExpr': {
        const r = x.referencedDecl
        if (r.kind === 'EnumConstantDecl') return this.enums.get(r.id)
        if (r.kind === 'FunctionDecl' || r.kind === 'CXXMethodDecl') return this.enderecoDeFuncao(r.name)
        return yield* this.end(x)
      }
      case 'UnaryOperator': return yield* this.unario(x)
      case 'BinaryOperator': return yield* this.binario(x)
      case 'CompoundAssignOperator': return yield* this.atribuicaoComposta(x)
      case 'ConditionalOperator': {
        const c = yield* this.val(x.inner[0])
        return yield* this.val(this.verdade(c) ? x.inner[1] : x.inner[2])
      }
      case 'CallExpr':
        if (this.cpp) return this.tipo(x).k === 'struct' && x.valueCategory === 'prvalue' ? yield* this.temporario(x) : yield* this.chamadaCpp(x)
        return yield* this.chamada(x)
      case 'UnaryExprOrTypeTraitExpr': {
        const t = x.argType ? this.tipos.de(x.argType) : this.tipo(x.inner[0])
        return x.name === 'alignof' || x.name === '_Alignof' ? alinhamentoDe(t) : tamanhoDe(t)
      }
      case 'ArraySubscriptExpr':
      case 'MemberExpr':
      case 'CompoundLiteralExpr': return yield* this.end(x)
      case 'PredefinedExpr': return yield* this.val(x.inner[0])
      case 'ImplicitValueInitExpr': return this.tipo(x).k === 'real' ? 0 : 0
      case 'StmtExpr': throw new ErroC('expressão-comando do GNU não funciona no passo a passo')
      default:
        if (this.cpp) return yield* this.valCpp(x)
        throw new ErroC(`o passo a passo ainda não sabe calcular "${x.kind}"`)
    }
  }

  * conversao(x) {
    const sub = x.inner[0]
    const para = this.tipo(x)
    switch (x.castKind) {
      case 'LValueToRValue': {
        const e = yield* this.end(sub)
        return this.carregar(para, e)
      }
      case 'ArrayToPointerDecay': return yield* this.end(sub)
      case 'FunctionToPointerDecay':
      case 'BuiltinFnToFnPtr': return yield* this.val(sub)
      case 'NullToPointer':
        yield* this.val(sub)
        return 0
      case 'ToVoid':
        yield* this.val(sub)
        return undefined
      case 'NoOp':
      case 'LValueBitCast': return yield* this.val(sub)
      case 'ConstructorConversion': return yield* this.temporario(x)
      case 'UserDefinedConversion': return yield* this.val(sub)
      case 'DerivedToBase':
      case 'UncheckedDerivedToBase':
      case 'BaseToDerived':
        if (x.valueCategory !== 'prvalue' || para.k === 'struct') return yield* this.end(x)
        return this.ajustarPonteiro(x, yield* this.val(sub))
      default: return this.converter(yield* this.val(sub), this.tipo(sub), para)
    }
  }

  // ---- endereços (lvalues) --------------------------------------------------------

  enderecoDaVariavel(ref) {
    const v = this.quadro?.porId.get(ref.id) ?? this.globais.get(ref.id)
    if (!v) throw new ErroC(`a variável ${ref.name} ainda não existe neste ponto`)
    // Referência (C++): a variável guarda o endereço do que ela representa.
    return v.tipo?.k === 'ref' ? this.mem.ler(v.tipo, v.endereco) : v.endereco
  }

  nomeDaExpressao(x) {
    while (x && (x.kind === 'ImplicitCastExpr' || x.kind === 'ParenExpr')) x = x.inner[0]
    if (x?.kind === 'DeclRefExpr') return x.referencedDecl.name
    if (x?.kind === 'MemberExpr') return `${this.nomeDaExpressao(x.inner[0]) ?? ''}${x.isArrow ? '->' : '.'}${x.name}`
    if (x?.kind === 'ArraySubscriptExpr') return `${this.nomeDaExpressao(x.inner[0]) ?? ''}[]`
    return null
  }

  * end(x) {
    if (x.__se ?? this.simplesEnd(x)) return this.endR(x)
    switch (x.kind) {
      case 'DeclRefExpr': return this.enderecoDaVariavel(x.referencedDecl)
      case 'ParenExpr': return yield* this.end(x.inner[0])
      case 'StringLiteral': return this.literal(x)
      case 'PredefinedExpr': return yield* this.end(x.inner[0])
      case 'UnaryOperator':
        if (x.opcode === '*') {
          const p = yield* this.val(x.inner[0])
          if (p === 0) throw new ErroC(`uso de *${this.nomeDaExpressao(x.inner[0]) ?? 'ponteiro'} com o ponteiro valendo NULL`, 0, EXPLICACOES.nulo)
          return p
        }
        break
      case 'ArraySubscriptExpr': {
        const [a, b] = x.inner
        const va = yield* this.val(a)
        const vb = yield* this.val(b)
        return this.enderecoNoVetor(x, va, vb)
      }
      case 'MemberExpr': {
        if (this.cpp && this.globais.has(x.referencedMemberDecl)) return this.globais.get(x.referencedMemberDecl).endereco // membro static
        const base = x.inner[0]
        return this.enderecoDoCampo(x, x.isArrow ? yield* this.val(base) : yield* this.end(base))
      }
      case 'CompoundLiteralExpr': {
        const t = this.tipo(x)
        const e = this.mem.empilhar(tamanhoDe(t), alinhamentoDe(t), { nome: '(literal composto)', tipo: t })
        yield* this.inicializar(e, t, x.inner[0])
        return e
      }
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr':
        if (x.castKind === 'DerivedToBase' || x.castKind === 'UncheckedDerivedToBase') break // o C++ ajusta o endereço (endCpp)
        if (['NoOp', 'LValueBitCast', 'LValueToRValue'].includes(x.castKind) || x.valueCategory === 'lvalue') return yield* this.end(x.inner[0])
        break
      case 'ConstantExpr': return yield* this.end(x.inner[0])
      default:
    }
    if (this.cpp) {
      const r = yield* this.endCpp(x)
      if (r !== undefined) return r
    }
    // Valor sem endereço (struct devolvida por uma função, por exemplo): vai para um temporário.
    const t = this.tipo(x)
    const v = yield* this.val(x)
    const e = this.rascunho(Math.max(tamanhoDe(t), 1))
    this.guardar(t, e, v)
    return e
  }

  /** v[i] (ou i[v]): o endereço do elemento, conferindo o índice de um vetor de tamanho conhecido. */
  enderecoNoVetor(x, va, vb) {
    const [a, b] = x.inner
    const aEhPonteiro = this.tipo(a).k === 'ptr'
    const base = aEhPonteiro ? va : vb
    const indice = Number(aEhPonteiro ? vb : va)
    const noBase = aEhPonteiro ? a : b
    const tam = tamanhoDe(this.tipo(x))
    // Vetor declarado com tamanho (v[10], m[3][4]): confere o índice pelo tamanho dele.
    const sub = noBase.kind === 'ImplicitCastExpr' && noBase.castKind === 'ArrayToPointerDecay' ? noBase.inner[0] : null
    const tipoVetor = sub && this.tipo(sub)
    if (tipoVetor?.k === 'array' && tipoVetor.n !== null) {
      const n = tipoVetor.n
      if (indice < 0 || indice > n || (indice === n && !this.permitirFim)) {
        throw new ErroC(`índice ${indice} fora dos limites do vetor ${this.nomeDaExpressao(sub) ?? ''} (ele tem ${n} elementos: posições 0 a ${n - 1})`.replace('vetor  (', 'vetor ('), 0, EXPLICACOES.vetor)
      }
    } else if (base === 0) throw new ErroC(`uso de ${this.nomeDaExpressao(noBase) ?? 'ponteiro'}[${indice}] com o ponteiro valendo NULL`, 0, EXPLICACOES.nulo)
    return base + indice * tam
  }

  /** a.campo / p->campo, com o endereço (ou o ponteiro) de a já calculado. */
  enderecoDoCampo(x, e) {
    const base = x.inner[0]
    if (x.isArrow && e === 0) throw new ErroC(`uso de ${this.nomeDaExpressao(base) ?? 'ponteiro'}->${x.name} com o ponteiro valendo NULL`, 0, EXPLICACOES.nulo)
    let campo = this.cacheDo(x).__campo
    if (!campo) {
      const tipoBase = x.isArrow ? this.tipo(base).alvo : this.tipo(base)
      const campos = layout(tipoBase).campos
      campo = campos.find((c) => c.id === x.referencedMemberDecl) ?? campos.find((c) => c.nome === x.name)
      if (!campo) throw new ErroC(`campo ${x.name} desconhecido`)
      x.__campo = campo
    }
    // campo que é referência (int &r; numa classe): o endereço é o que ela guarda
    return campo.tipo.k === 'ref' ? this.mem.ler(campo.tipo, e + campo.deslocamento) : e + campo.deslocamento
  }

  /** ++ e -- no endereço e (devolve o valor de antes, se for pós-fixado). */
  incrementar(x, e) {
    const ts = this.tipo(x.inner[0])
    const velho = this.mem.ler(ts, e)
    const passo = x.opcode === '++' ? 1 : -1
    let novo
    if (ts.k === 'ptr') novo = (velho + passo * tamanhoDe(ts.alvo)) >>> 0
    else if (ts.k === 'real') novo = this.converter(velho + passo, DOUBLE, ts)
    else novo = this.normalizar(ts, typeof velho === 'bigint' ? velho + BigInt(passo) : velho + passo)
    this.mem.escrever(ts, e, novo)
    return x.isPostfix ? velho : novo
  }

  /** a += b (e os outros): grava no endereço e e devolve o resultado. */
  compor(x, e, vb) {
    const [a, b] = x.inner
    const ta = this.tipo(a)
    const atual = this.mem.ler(ta, e)
    const op = x.opcode.slice(0, -1)
    let resultado
    if (ta.k === 'ptr') resultado = this.operar(op, atual, vb, ta, this.tipo(b), ta)
    else {
      const tl = this.tipos.de(x.computeLHSType)
      const tr = this.tipos.de(x.computeResultType)
      resultado = this.converter(this.operar(op, this.converter(atual, ta, tl), vb, tl, this.tipo(b), tr), tr, ta)
    }
    this.mem.escrever(ta, e, resultado)
    return resultado
  }

  // ---- expressões simples, sem gerador -----------------------------------------------
  // A maior parte das expressões (variáveis, contas, v[i], p->campo, x = y, i++) nunca pausa nem chama
  // nada: são calculadas aqui, numa função comum, sem criar um gerador por nó. simplesVal/simplesEnd
  // decidem isso uma vez por nó (guardado nele); valR/endR fazem exatamente o que val/end fariam.

  simplesVal(x) {
    let r = false
    const naoClasse = () => !(this.cpp && this.tipo(x).k === 'struct')
    switch (x.kind) {
      case 'IntegerLiteral':
      case 'CharacterLiteral':
      case 'FloatingLiteral':
      case 'StringLiteral':
      case 'DeclRefExpr':
      case 'UnaryExprOrTypeTraitExpr':
      case 'ImplicitValueInitExpr':
        r = true
        break
      case 'CXXBoolLiteralExpr':
      case 'CXXNullPtrLiteralExpr':
      case 'CXXThisExpr':
      case 'CXXScalarValueInitExpr':
        r = this.cpp
        break
      case 'ParenExpr':
      case 'ConstantExpr':
        r = this.simplesVal(x.inner[0])
        break
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr':
        switch (x.castKind) {
          case 'LValueToRValue':
          case 'ArrayToPointerDecay': r = this.simplesEnd(x.inner[0]) && naoClasse(); break
          case 'ConstructorConversion':
          case 'UserDefinedConversion':
          case 'DerivedToBase':
          case 'UncheckedDerivedToBase':
          case 'BaseToDerived': r = false; break
          default: r = this.simplesVal(x.inner[0]) && naoClasse()
        }
        break
      case 'UnaryOperator':
        switch (x.opcode) {
          case '&':
          case '++':
          case '--': r = this.simplesEnd(x.inner[0]); break
          case '*':
          case '+':
          case '-':
          case '~':
          case '!':
          case '__extension__': r = this.simplesVal(x.inner[0]); break
          default: r = false
        }
        break
      case 'BinaryOperator':
        r = x.opcode === '='
          ? this.simplesEnd(x.inner[0]) && this.simplesVal(x.inner[1]) && !(this.cpp && this.tipo(x.inner[0]).k === 'struct')
          : this.simplesVal(x.inner[0]) && this.simplesVal(x.inner[1])
        break
      case 'CompoundAssignOperator':
        r = this.simplesEnd(x.inner[0]) && this.simplesVal(x.inner[1])
        break
      case 'ConditionalOperator':
        r = x.inner.every((f) => this.simplesVal(f)) && naoClasse()
        break
      case 'ArraySubscriptExpr':
      case 'MemberExpr':
        r = this.simplesEnd(x)
        break
      default:
    }
    x.__sv = r
    return r
  }

  simplesEnd(x) {
    let r = false
    switch (x.kind) {
      case 'DeclRefExpr':
      case 'StringLiteral':
        r = true
        break
      case 'ParenExpr':
      case 'ConstantExpr':
        r = this.simplesEnd(x.inner[0])
        break
      case 'UnaryOperator':
        r = x.opcode === '*' && this.simplesVal(x.inner[0])
        break
      case 'ArraySubscriptExpr':
        r = this.simplesVal(x.inner[0]) && this.simplesVal(x.inner[1])
        break
      case 'MemberExpr':
        r = x.isArrow ? this.simplesVal(x.inner[0]) : this.simplesEnd(x.inner[0])
        break
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr':
        if (x.castKind === 'DerivedToBase' || x.castKind === 'UncheckedDerivedToBase') r = false
        else r = (x.castKind === 'NoOp' || x.castKind === 'LValueBitCast' || x.castKind === 'LValueToRValue' || x.valueCategory === 'lvalue') && this.simplesEnd(x.inner[0])
        break
      default:
    }
    x.__se = r
    return r
  }

  valR(x) {
    switch (x.kind) {
      // (os mais comuns primeiro: o switch compara um caso por vez)
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr': {
        const sub = x.inner[0]
        switch (x.castKind) {
          case 'LValueToRValue': return this.carregar(this.tipo(x), this.endR(sub))
          case 'ArrayToPointerDecay': return this.endR(sub)
          case 'FunctionToPointerDecay':
          case 'BuiltinFnToFnPtr':
          case 'NoOp':
          case 'LValueBitCast': return this.valR(sub)
          case 'NullToPointer': this.valR(sub); return 0
          case 'ToVoid': this.valR(sub); return undefined
          default: return this.converter(this.valR(sub), this.tipo(sub), this.tipo(x))
        }
      }
      case 'DeclRefExpr': {
        const r = x.referencedDecl
        if (r.kind === 'EnumConstantDecl') return this.enums.get(r.id)
        if (r.kind === 'FunctionDecl' || r.kind === 'CXXMethodDecl') return this.enderecoDeFuncao(r.name)
        return this.enderecoDaVariavel(r)
      }
      case 'IntegerLiteral': {
        const t = this.tipo(x)
        return t.tamanho >= 8 ? this.normalizar(t, BigInt(x.value)) : Number(x.value)
      }
      case 'CharacterLiteral': return x.value
      case 'FloatingLiteral': return Number(x.value)
      case 'StringLiteral': return this.literal(x)
      case 'CXXBoolLiteralExpr': return x.value ? 1 : 0
      case 'CXXNullPtrLiteralExpr':
      case 'CXXScalarValueInitExpr':
      case 'ImplicitValueInitExpr': return 0
      case 'CXXThisExpr': return this.quadro?.this ?? 0
      case 'ParenExpr': return this.valR(x.inner[0])
      case 'ConstantExpr':
        if (x.value !== undefined) {
          const t = this.tipo(x)
          if (x.value === 'true' || x.value === 'false') return x.value === 'true' ? 1 : 0
          return ehInteiro(t) ? this.normalizar(t, t.tamanho >= 8 ? BigInt(x.value) : Number(x.value)) : this.valR(x.inner[0])
        }
        return this.valR(x.inner[0])
      case 'UnaryOperator': {
        const sub = x.inner[0]
        switch (x.opcode) {
          case '&':
            this.permitirFim = true
            try {
              return this.endR(sub)
            } finally {
              this.permitirFim = false
            }
          case '*': return this.endR(x)
          case '+':
          case '__extension__': return this.valR(sub)
          case '-': {
            const t = this.tipo(x)
            const v = this.valR(sub)
            return t.k === 'real' ? -v : this.normalizar(t, -v)
          }
          case '~': return this.normalizar(this.tipo(x), ~this.valR(sub))
          case '!': return this.verdade(this.valR(sub)) ? 0 : 1
          default: return this.incrementar(x, this.endR(sub)) // ++ e --
        }
      }
      case 'BinaryOperator': {
        const op = x.opcode
        const [a, b] = x.inner
        if (op === '&&') return this.verdade(this.valR(a)) && this.verdade(this.valR(b)) ? 1 : 0
        if (op === '||') return this.verdade(this.valR(a)) || this.verdade(this.valR(b)) ? 1 : 0
        if (op === ',') {
          this.valR(a)
          return this.valR(b)
        }
        if (op === '=') {
          // no C++17 o lado direito vem antes do endereço do esquerdo (v[i] = ++i); no C a ordem não é definida
          let e
          if (!this.cpp) e = this.endR(a)
          const v = this.valR(b)
          if (this.cpp) e = this.endR(a)
          this.guardar(this.tipo(a), e, v)
          return v
        }
        const va = this.valR(a)
        const vb = this.valR(b)
        return this.operar(op, va, vb, this.tipo(a), this.tipo(b), this.tipo(x))
      }
      case 'CompoundAssignOperator': {
        const vb = this.valR(x.inner[1])
        return this.compor(x, this.endR(x.inner[0]), vb)
      }
      case 'ConditionalOperator': return this.valR(this.verdade(this.valR(x.inner[0])) ? x.inner[1] : x.inner[2])
      case 'UnaryExprOrTypeTraitExpr': {
        const t = x.argType ? this.tipos.de(x.argType) : this.tipo(x.inner[0])
        return x.name === 'alignof' || x.name === '_Alignof' ? alinhamentoDe(t) : tamanhoDe(t)
      }
      default: return this.endR(x) // ArraySubscriptExpr e MemberExpr
    }
  }

  endR(x) {
    switch (x.kind) {
      case 'DeclRefExpr': return this.enderecoDaVariavel(x.referencedDecl)
      case 'StringLiteral': return this.literal(x)
      case 'ParenExpr':
      case 'ConstantExpr':
      case 'ImplicitCastExpr':
      case 'CStyleCastExpr': return this.endR(x.inner[0])
      case 'UnaryOperator': {
        const p = this.valR(x.inner[0])
        if (p === 0) throw new ErroC(`uso de *${this.nomeDaExpressao(x.inner[0]) ?? 'ponteiro'} com o ponteiro valendo NULL`, 0, EXPLICACOES.nulo)
        return p
      }
      case 'ArraySubscriptExpr': {
        const va = this.valR(x.inner[0])
        return this.enderecoNoVetor(x, va, this.valR(x.inner[1]))
      }
      default: { // MemberExpr
        if (this.cpp && this.globais.has(x.referencedMemberDecl)) return this.globais.get(x.referencedMemberDecl).endereco
        const base = x.inner[0]
        return this.enderecoDoCampo(x, x.isArrow ? this.valR(base) : this.endR(base))
      }
    }
  }

  // ---- operadores -----------------------------------------------------------------

  * unario(x) {
    const op = x.opcode
    const sub = x.inner[0]
    const t = this.tipo(x)
    switch (op) {
      case '&': {
        this.permitirFim = true
        try {
          return yield* this.end(sub)
        } finally {
          this.permitirFim = false
        }
      }
      case '*': return yield* this.end(x)
      case '+': return yield* this.val(sub)
      case '-': {
        const v = yield* this.val(sub)
        return t.k === 'real' ? -v : this.normalizar(t, -v)
      }
      case '~': return this.normalizar(t, ~(yield* this.val(sub)))
      case '!': return this.verdade(yield* this.val(sub)) ? 0 : 1
      case '++':
      case '--': return this.incrementar(x, yield* this.end(sub))
      case '__extension__': return yield* this.val(sub)
      default: throw new ErroC(`operador ${op} ainda não funciona no passo a passo`)
    }
  }

  * binario(x) {
    const op = x.opcode
    const [a, b] = x.inner
    if (op === '&&') {
      if (!this.verdade(yield* this.val(a))) return 0
      return this.verdade(yield* this.val(b)) ? 1 : 0
    }
    if (op === '||') {
      if (this.verdade(yield* this.val(a))) return 1
      return this.verdade(yield* this.val(b)) ? 1 : 0
    }
    if (op === ',') {
      yield* this.val(a)
      return yield* this.val(b)
    }
    if (op === '=') {
      const ta = this.tipo(a)
      let e
      if (!this.cpp) e = yield* this.end(a) // (a ordem: ver valR)
      const v = yield* this.val(b)
      if (this.cpp) e = yield* this.end(a)
      this.guardar(ta, e, v)
      return v
    }
    const va = yield* this.val(a)
    const vb = yield* this.val(b)
    return this.operar(op, va, vb, this.tipo(a), this.tipo(b), this.tipo(x))
  }

  operar(op, va, vb, ta, tb, tr) {
    // Aritmética de ponteiros: p + n anda n elementos; p - q dá quantos elementos há entre eles.
    if (ta.k === 'ptr' || tb.k === 'ptr') {
      if (op === '+' || op === '-') {
        if (ta.k === 'ptr' && tb.k === 'ptr') return this.normalizar(tr, Math.trunc((va - vb) / Math.max(1, tamanhoDe(ta.alvo))))
        const [p, n, tp] = ta.k === 'ptr' ? [va, vb, ta] : [vb, va, tb]
        const passo = Number(n) * tamanhoDe(tp.alvo)
        return (op === '+' ? p + passo : p - passo) >>> 0
      }
    }
    switch (op) {
      case '<': return va < vb ? 1 : 0
      case '>': return va > vb ? 1 : 0
      case '<=': return va <= vb ? 1 : 0
      case '>=': return va >= vb ? 1 : 0
      case '==': return va == vb ? 1 : 0 // eslint-disable-line eqeqeq
      case '!=': return va != vb ? 1 : 0 // eslint-disable-line eqeqeq
      default:
    }
    if (tr.k === 'real') {
      const r = { '+': va + vb, '-': va - vb, '*': va * vb, '/': va / vb }[op]
      if (r === undefined) throw new ErroC(`operador ${op} com números reais`)
      return tr.tamanho === 4 ? Math.fround(r) : r
    }
    if (typeof va === 'bigint' || typeof vb === 'bigint' || tr.tamanho >= 8) {
      const x = BigInt(va)
      const y = BigInt(vb)
      if ((op === '/' || op === '%') && y === 0n) throw new ErroC('divisão inteira por zero', 0, EXPLICACOES.divisao)
      const r = {
        '+': () => x + y, '-': () => x - y, '*': () => x * y, '/': () => x / y, '%': () => x % y,
        '<<': () => x << (y & 63n), '>>': () => x >> (y & 63n), '&': () => x & y, '|': () => x | y, '^': () => x ^ y,
      }[op]
      if (!r) throw new ErroC(`operador ${op} ainda não funciona no passo a passo`)
      return this.normalizar(tr, r())
    }
    switch (op) {
      case '+': return this.normalizar(tr, va + vb)
      case '-': return this.normalizar(tr, va - vb)
      case '*': return this.normalizar(tr, Math.imul(va, vb))
      case '/':
        if (vb === 0) throw new ErroC('divisão inteira por zero', 0, EXPLICACOES.divisao)
        return this.normalizar(tr, Math.trunc(va / vb))
      case '%':
        if (vb === 0) throw new ErroC('resto de divisão por zero', 0, EXPLICACOES.divisao)
        return this.normalizar(tr, va % vb)
      case '<<': return this.normalizar(tr, va << (vb & 31))
      case '>>': return this.normalizar(tr, tr.sinal ? va >> (vb & 31) : va >>> (vb & 31))
      case '&': return this.normalizar(tr, va & vb)
      case '|': return this.normalizar(tr, va | vb)
      case '^': return this.normalizar(tr, va ^ vb)
      default: throw new ErroC(`operador ${op} ainda não funciona no passo a passo`)
    }
  }

  * atribuicaoComposta(x) {
    const vb = yield* this.val(x.inner[1])
    return this.compor(x, yield* this.end(x.inner[0]), vb)
  }

  // ---- chamadas -----------------------------------------------------------------

  nomeDaFuncaoChamada(callee) {
    let c = callee
    while (c && (c.kind === 'ImplicitCastExpr' || c.kind === 'ParenExpr')) c = c.inner[0]
    return c?.kind === 'DeclRefExpr' && c.referencedDecl.kind === 'FunctionDecl' ? c.referencedDecl.name : null
  }

  * chamada(x) {
    const [callee, ...argumentos] = x.inner
    let nome = this.nomeDaFuncaoChamada(callee)
    if (!nome) {
      const p = yield* this.val(callee)
      nome = this.funcaoNoEndereco.get(Number(p))
      if (!nome) throw new ErroC('chamada por um ponteiro de função inválido', 0, EXPLICACOES.invalido)
    }
    const args = []
    for (const a of argumentos) args.push({ valor: yield* this.val(a), tipo: this.tipo(a) })
    const def = this.funcoes.get(nome)
    const linhaDaChamada = this.linhaAtual
    if (def) {
      const r = yield* this.chamarFuncao(def, args.map((a) => a.valor), linhaDaChamada)
      this.linhaAtual = linhaDaChamada
      return r
    }
    const nativa = BIBLIOTECA[nome]
    if (!nativa) throw new ErroC(`a função ${nome} foi declarada mas não foi escrita (ou ainda não existe no passo a passo)`)
    try {
      return yield* nativa(this, args, x)
    } catch (e) {
      if (e instanceof ErroC && !e.mensagem.includes(nome) && !(e instanceof SaidaDoPrograma)) e.mensagem = `${nome}: ${e.mensagem}`
      throw e
    }
  }

  // ---- inspeção (para a tela de memória) -------------------------------------------

  /** Variáveis de cada chamada, as globais e os blocos do heap, como estão agora. */
  instantaneo() {
    return {
      // As variáveis "__range1", "__begin1"... do for de intervalo são do compilador, não do aluno.
      quadros: this.pilha.map((q) => ({ funcao: q.funcao, linha: q.linha, variaveis: q.variaveis.filter((v) => !v.nome?.startsWith('__')).map((v) => ({ ...v })) })),
      globais: this.listaGlobais.map((v) => ({ ...v })),
      heap: this.mem.heap.map((b) => ({ endereco: b.inicio, tamanho: b.tamanho, numero: b.numero, tipoElem: b.tipoElem })),
      liberados: this.mem.liberados.map((b) => ({ endereco: b.inicio, tamanho: b.tamanho, numero: b.numero })),
    }
  }

  ehEnderecoDeDados(e) { return e >= INICIO_ESTATICO }
}

Object.assign(MaquinaC.prototype, METODOS_CPP)
