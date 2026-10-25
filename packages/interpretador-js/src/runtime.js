// O laço de eventos do passo a passo de JavaScript. O código instrumentado (instrumentar.js)
// chama as funções daqui; tudo é gerador, para o passo a passo pausar em qualquer linha.
//
// Para o aluno ver como o JavaScript funciona de verdade, as filas são nossas e ficam à mostra:
//  - pilha de chamadas: as funções em execução agora;
//  - Web APIs: os setTimeout/setInterval esperando o relógio (que é virtual: pula direto
//    para o próximo temporizador, sem esperar de verdade);
//  - fila de tarefas: os callbacks cujo tempo já chegou;
//  - microtarefas: as reações de Promise (then, await), que sempre passam na frente.

import { GERADOR, INFO } from './simbolos.js'
import { formatarArgumentos, inspecionar, tabela } from './inspecionar.js'
import { criarModulos } from './modulos.js'

export { GERADOR, INFO }
const MAX_CHAMADAS = 12000 // como o Node (~10 mil chamadas simples); as chamadas ficam numa pilha explícita (Condutor), não na do JS

export class ErroJS extends Error {
  constructor(mensagem, linha) {
    super(mensagem)
    this.mensagem = mensagem
    this.linha = linha
  }
}

export const nomeDaFuncao = (f) => f?.[INFO]?.nome ?? (f?.name || '(anônima)')

export function criarRuntime(op = {}) {
  const saida = op.saida ?? (() => {})
  const pilha = []
  const microtarefas = []
  const temporizadores = []
  const prontas = []
  const rejeicoesSemCatch = new Set()
  let relogio = 0
  let proximoId = 1
  let sequencia = 0
  let ultimaLinha = 0

  const novoQuadro = (info) => ({ nome: info.nome, linha: info.linha, leitura: null })
  const principal = { nome: '(programa principal)', linha: 0, leitura: null }

  // ---- funções do aluno -----------------------------------------------------------

  function __passo(linha, leitura) {
    ultimaLinha = linha
    const topo = pilha[pilha.length - 1]
    if (topo) {
      topo.linha = linha
      topo.leitura = leitura
    }
    return { tipo: 'linha', linha }
  }

  // O invólucro tem de parecer a função do aluno: .length (nº de parâmetros) e toString() (o código dela).
  function disfarcar(F, info) {
    Object.defineProperty(F, 'length', { value: info.aridade ?? 0, configurable: true })
    if (info.texto !== undefined) Object.defineProperty(F, 'toString', { value: () => info.texto, writable: true, configurable: true })
  }

  // (não enumeráveis: o console.log e o Object.keys do aluno não podem ver as marcas)
  function marcar(F, gerador, info) {
    Object.defineProperty(F, GERADOR, { value: gerador, writable: true, configurable: true })
    Object.defineProperty(F, INFO, { value: info, writable: true, configurable: true })
  }

  function __funcao(gerador, info) {
    const F = function (...args) { return __sincrono(F, this, args) }
    marcar(F, gerador, info)
    Object.defineProperty(F, 'name', { value: info.nome === '(anônima)' ? '' : info.nome })
    disfarcar(F, info)
    return F
  }

  function __registrar(F, gerador, info) {
    marcar(F, gerador, info)
    disfarcar(F, info)
  }

  // Método de classe com chave calculada ([Symbol.asyncIterator]): a chave é guardada ao ser calculada, por etiqueta.
  const chavesCalculadas = new Map()
  function __chaveCalc(etiqueta, valor) {
    const chave = typeof valor === 'symbol' ? valor : `${valor}`
    chavesCalculadas.set(etiqueta, chave)
    return chave
  }

  function __envolverMetodos(Classe, metodos, texto) {
    for (const m of metodos) {
      const chave = m.chave ?? chavesCalculadas.get(m.etiqueta)
      const alvo = m.estatico ? Classe : Classe.prototype
      const gerador = alvo[chave]
      const W = function (...args) { return __sincrono(W, this, args) }
      marcar(W, gerador, { ...m.info, nome: `${Classe.name}.${m.info.nome}` })
      disfarcar(W, m.info)
      Object.defineProperty(W, 'name', { value: m.info.nome })
      Object.defineProperty(alvo, chave, { value: W, writable: true, configurable: true, enumerable: false })
    }
    if (texto !== undefined && !Object.hasOwn(Classe, 'toString')) Object.defineProperty(Classe, 'toString', { value: () => texto, writable: true, configurable: true })
    return Classe
  }

  // Condutor: roda um gerador e, quando ele pede `yield { tipo: 'chamar', gen, quadro }` (uma chamada de função do aluno),
  // empilha o gerador da função chamada numa pilha própria em vez de aninhar yield*. Assim a recursão não usa a pilha do JS
  // (que estourava em ~700 chamadas) e cada passo custa o mesmo, qualquer que seja a profundidade.
  class Condutor {
    constructor(raiz) { this.frames = [{ gen: raiz, quadro: null }] }
    [Symbol.iterator]() { return this }
    next(v) { return this.rodar(false, v) }
    throw(e) { return this.rodar(true, e) }
    return(v) {
      const fr = this.frames
      while (fr.length > 1) {
        const f = fr.pop()
        pilha.pop()
        try { f.gen.return() } catch { /* o finally da função fechada falhou: o return da base é o que vale */ }
      }
      return fr[0].gen.return(v)
    }

    rodar(erro, envio) {
      const fr = this.frames
      for (;;) {
        const topo = fr[fr.length - 1]
        let r
        try {
          r = erro ? topo.gen.throw(envio) : topo.gen.next(envio)
        } catch (e) {
          if (fr.length === 1) throw e
          fr.pop()
          pilha.pop()
          envio = e
          erro = true
          continue
        }
        erro = false
        if (r.done) {
          if (fr.length === 1) return r
          fr.pop()
          pilha.pop()
          envio = r.value
          continue
        }
        const ev = r.value
        if (ev?.tipo !== 'chamar') return r
        envio = undefined
        if (pilha.length >= MAX_CHAMADAS) {
          envio = new ErroJS('chamadas demais uma dentro da outra (recursão infinita?)', ultimaLinha)
          erro = true
          continue
        }
        pilha.push(ev.quadro)
        fr.push({ gen: ev.gen, quadro: ev.quadro })
      }
    }
  }
  const conduzir = (gen) => new Condutor(gen)

  /** Função do aluno chamada por código da biblioteca (sort, addEventListener...): roda inteira, sem pausar. */
  function __sincrono(F, este, args) {
    const info = F[INFO]
    if (info.geradora) return criarGeradorAssincrono(F, este, args)
    if (info.assincrona) {
      const { corrotina, promessa } = criarCorrotina(F, este, args)
      silencioso(continuarCorrotina(corrotina, undefined, false))
      return promessa
    }
    return silencioso(chamarFuncaoDoAluno(F, este, args))
  }

  function silencioso(gen) {
    gen = conduzir(gen)
    let r = gen.next()
    while (!r.done) {
      if (r.value?.tipo === 'entrada') {
        throw new ErroJS('prompt() dentro de uma função chamada pela biblioteca ainda não funciona no passo a passo', ultimaLinha)
      }
      r = gen.next()
    }
    return r.value
  }

  function* chamarFuncaoDoAluno(F, este, args) {
    if (pilha.length >= MAX_CHAMADAS) throw new ErroJS('chamadas demais uma dentro da outra (recursão infinita?)', ultimaLinha)
    pilha.push(novoQuadro(F[INFO]))
    try {
      return yield* conduzir(F[GERADOR].apply(este, args))
    } finally {
      pilha.pop()
    }
  }

  function* __chamar(f, este, args, linha) {
    if (typeof f !== 'function') throw new TypeError(`${descreverCurto(f)} não é uma função`)
    if (f[GERADOR]) {
      if (f[INFO].geradora) return criarGeradorAssincrono(f, este, args)
      if (f[INFO].assincrona) {
        const { corrotina, promessa } = criarCorrotina(f, este, args)
        yield* continuarCorrotina(corrotina, undefined, false) // até o primeiro await, como no JavaScript de verdade
        return promessa
      }
      // quem conduz (Condutor) empilha o gerador da função: a recursão não aninha geradores
      return yield { tipo: 'chamar', gen: f[GERADOR].apply(este, args), quadro: novoQuadro(f[INFO]) }
    }
    const especial = ESPECIAIS.get(f)
    if (especial) return yield* especial(este, args, linha)
    return Reflect.apply(f, este, args)
  }

  function* __chamarMetodo(objeto, chave, args, linha) {
    if (objeto === null || objeto === undefined) throw new TypeError(`Cannot read properties of ${objeto} (reading '${String(chave)}')`)
    const f = objeto[chave]
    if (typeof f !== 'function') throw new TypeError(`${String(chave)} não é uma função (o valor é ${descreverCurto(f)})`)
    return yield* __chamar(f, objeto, args, linha)
  }

  // ---- async/await --------------------------------------------------------------------

  function criarCorrotina(F, este, args) {
    let resolver
    let rejeitar
    const promessa = new PromiseMister((res, rej) => { resolver = res; rejeitar = rej })
    const info = F[INFO]
    return { corrotina: { g: conduzir(F[GERADOR].apply(este, args)), info, quadro: novoQuadro(info), resolver, rejeitar }, promessa }
  }

  function* continuarCorrotina(c, valor, comErro) {
    if (pilha.length >= MAX_CHAMADAS) throw new ErroJS('chamadas demais uma dentro da outra (recursão infinita?)', ultimaLinha)
    pilha.push(c.quadro)
    try {
      let r = comErro ? c.g.throw(valor) : c.g.next(valor)
      for (;;) {
        if (r.done) {
          c.resolver(r.value)
          return
        }
        const ev = r.value
        if (ev?.tipo === 'aguardar') {
          // O await suspende a função: ela sai da pilha e volta como microtarefa quando a promessa terminar.
          if (c.info.programa) c.linhaAguardando = ev.linha ?? ultimaLinha
          PromiseMister.resolve(ev.valor).reagir(`continuar ${c.info.nome}${c.info.programa ? '' : '()'} depois do await`,
            (v) => continuarCorrotina(c, v, false), (e) => continuarCorrotina(c, e, true))
          return
        }
        r = c.g.next(yield ev)
      }
    } catch (e) {
      if (e instanceof ErroJS) throw e // erro do próprio passo a passo
      c.rejeitar(e)
    } finally {
      pilha.pop()
    }
  }

  const __aguardar = (valor, linha) => ({ tipo: 'aguardar', valor, linha })
  const __ceder = (valor) => ({ tipo: 'ceder', valor })

  // yield* dentro de async function*: repassa next/throw/return ao iterável (assíncrono, ou síncrono como o JS faz).
  // (o valor que um iterável assíncrono cede não é esperado de novo: `bruto`)
  let retornoPendente // o valor do return() que está fechando o gerador (o finally de __delegar repassa ao iterável)
  function* __delegar(iteravel, linha) {
    const S = __abrirAssinc(iteravel)
    const it = S.it
    const esperar = function* (r) { return S.assinc ? yield __aguardar(r, linha) : r }
    let modo = 'next'
    let v
    let cedendo = false
    let acabou = false
    try {
      for (;;) {
        let r
        if (modo === 'throw' && typeof it.throw !== 'function') {
          cedendo = true // fecha o iterável como o return() faria
          throw new TypeError('o iterável do yield* não tem o método throw')
        }
        r = yield* __chamarMetodo(it, modo, [v], linha)
        r = yield* esperar(r)
        if (r === null || typeof r !== 'object') { acabou = true; throw new TypeError(`o resultado de ${modo}() precisa ser um objeto, mas veio ${descreverCurto(r)}`) }
        if (r.done) { acabou = true; return r.value }
        cedendo = true
        try {
          v = yield { tipo: 'ceder', valor: r.value, bruto: S.assinc }
          modo = 'next'
        } catch (e) {
          v = e
          modo = 'throw'
        }
        cedendo = false
      }
    } catch (e) {
      if (!cedendo) acabou = true // next/throw do iterável falhou: ele já terminou
      throw e
    } finally {
      // shortcut: o return() do iterável de dentro roda sem pausas e sem esperar o resultado (um yield aqui perderia o valor do
      // return de fora); se o finally dele tiver um await, ele termina depois do finally de fora. Melhorar se isso aparecer em aula.
      if (!acabou && typeof it.return === 'function') silencioso(__chamarMetodo(it, 'return', [retornoPendente], linha))
    }
  }

  // ---- async function* e for await -------------------------------------------------------

  // O gerador assíncrono do aluno: cada next/return/throw entra numa fila e roda o corpo (um gerador) até o próximo yield.
  class GeradorAssincrono {
    [Symbol.asyncIterator]() { return this }
    get [Symbol.toStringTag]() { return 'AsyncGenerator' }
    next(v) { return silencioso(pedir(this, 'next', v)) }
    return(v) { return silencioso(pedir(this, 'return', v)) }
    throw(e) { return silencioso(pedir(this, 'throw', e)) }
  }
  const estadosGA = new WeakMap()

  function criarGeradorAssincrono(F, este, args) {
    const info = F[INFO]
    const g = new GeradorAssincrono()
    estadosGA.set(g, { g: conduzir(F[GERADOR].apply(este, args)), nome: info.nome, quadro: novoQuadro(info), fila: [], ocupado: false, terminou: false })
    return g
  }

  function* pedir(g, modo, valor) {
    const o = estadosGA.get(g)
    if (!o) throw new TypeError('next/return/throw chamado num objeto que não é um gerador assíncrono')
    let res
    let rej
    const promessa = new PromiseMister((a, b) => { res = a; rej = b })
    o.fila.push({ modo, valor, res, rej })
    yield* despachar(o)
    return promessa
  }

  function* despachar(o) {
    while (!o.ocupado && o.fila.length) {
      const q = o.fila[0]
      if (o.terminou) {
        o.fila.shift()
        if (q.modo === 'throw') q.rej(q.valor)
        else q.res({ value: q.modo === 'return' ? q.valor : undefined, done: true })
        continue
      }
      o.ocupado = true
      yield* impulsionar(o, q.modo, q.valor)
    }
  }

  function concluir(o, ok, valor, fim) {
    const q = o.fila.shift()
    o.ocupado = false
    if (fim) o.terminou = true
    ;(ok ? q.res : q.rej)(valor)
  }

  /** Roda o corpo até ele ceder um valor, terminar ou parar num await (aí a continuação volta como microtarefa). */
  function* impulsionar(o, modo, valor) {
    pilha.push(o.quadro)
    try {
      if (modo === 'return') retornoPendente = valor
      let r = o.g[modo](valor)
      for (;;) {
        if (r.done) return concluir(o, true, { value: r.value, done: true }, true)
        const ev = r.value
        if (ev?.tipo === 'aguardar') {
          PromiseMister.resolve(ev.valor).reagir(`continuar ${o.nome}() depois do await`,
            (v) => retomar(o, 'next', v), (e) => retomar(o, 'throw', e))
          return undefined
        }
        if (ev?.bruto) return concluir(o, true, { value: ev.valor, done: false })
        if (ev?.tipo === 'ceder') return concluir(o, true, PromiseMister.resolve(ev.valor).then((x) => ({ value: x, done: false })))
        r = o.g.next(yield ev)
      }
    } catch (e) {
      if (e instanceof ErroJS) throw e
      return concluir(o, false, e, true)
    } finally {
      pilha.pop()
    }
  }

  function* retomar(o, modo, valor) {
    yield* impulsionar(o, modo, valor)
    yield* despachar(o)
  }

  function __abrirAssinc(iteravel) {
    const assinc = iteravel?.[Symbol.asyncIterator]
    if (typeof assinc === 'function') return { it: assinc.call(iteravel), assinc: true, fim: false }
    const sinc = iteravel?.[Symbol.iterator]
    if (typeof sinc === 'function') return { it: sinc.call(iteravel), assinc: false, fim: false }
    throw new TypeError(`${descreverCurto(iteravel)} não é iterável (o for await precisa de um iterável, de um iterável assíncrono ou de uma lista)`)
  }

  function* __proximoAssinc(S, linha) {
    S.fim = true // se next() falhar ou acabar, não há o que fechar
    let r = yield* __chamarMetodo(S.it, 'next', [], linha)
    if (S.assinc) r = yield __aguardar(r, linha)
    if (r === null || typeof r !== 'object') throw new TypeError(`o resultado de next() precisa ser um objeto, mas veio ${descreverCurto(r)}`)
    if (r.done) return { done: true, value: r.value }
    const value = S.assinc ? r.value : yield __aguardar(r.value, linha) // numa lista de promessas, cada valor é esperado
    S.fim = false
    return { done: false, value }
  }

  function* __fecharAssinc(S, linha) {
    if (typeof S.it.return !== 'function') return
    const r = yield* __chamarMetodo(S.it, 'return', [], linha)
    if (S.assinc) yield __aguardar(r)
  }

  // ---- Promise -----------------------------------------------------------------------

  const enfileirarMicro = (descricao, executar) => microtarefas.push({ descricao, executar })

  class PromiseMister {
    #estado = 'pendente'
    #valor = undefined
    #reacoes = []
    #tratada = false

    constructor(executor) {
      if (typeof executor !== 'function') throw new TypeError('Promise precisa de uma função')
      const [resolver, rejeitar] = this.#funcoes()
      try {
        executor(resolver, rejeitar)
      } catch (e) {
        rejeitar(e)
      }
    }

    get estado() { return this.#estado }
    get valor() { return this.#valor }
    get [Symbol.toStringTag]() { return 'Promise' }

    #funcoes() {
      let feito = false
      return [
        (v) => { if (!feito) { feito = true; this.#resolver(v) } },
        (e) => { if (!feito) { feito = true; this.#acertar('rejeitada', e) } },
      ]
    }

    #resolver(v) {
      if (v === this) return this.#acertar('rejeitada', new TypeError('uma Promise não pode se resolver com ela mesma'))
      if (v && (typeof v === 'object' || typeof v === 'function')) {
        let then
        try {
          then = v.then
        } catch (e) {
          return this.#acertar('rejeitada', e)
        }
        if (typeof then === 'function') {
          const [res, rej] = this.#funcoes()
          enfileirarMicro('adotar o resultado de outra promessa', function* () {
            try {
              yield* __chamar(then, v, [res, rej])
            } catch (e) {
              rej(e)
            }
          })
          return undefined
        }
      }
      return this.#acertar('resolvida', v)
    }

    #acertar(estado, valor) {
      if (this.#estado !== 'pendente') return
      this.#estado = estado
      this.#valor = valor
      for (const r of this.#reacoes) this.#agendar(r)
      this.#reacoes = []
      if (estado === 'rejeitada' && !this.#tratada) rejeicoesSemCatch.add(this)
    }

    #agendar(reacao) {
      const estado = this.#estado
      const valor = this.#valor
      enfileirarMicro(reacao.descricao, () => reacao.executar(estado, valor))
    }

    #adicionar(reacao) {
      this.#tratada = true
      rejeicoesSemCatch.delete(this)
      if (this.#estado === 'pendente') this.#reacoes.push(reacao)
      else this.#agendar(reacao)
    }

    /** Uso interno do await: continua a função quando esta promessa terminar. */
    reagir(descricao, aoResolver, aoRejeitar) {
      this.#adicionar({ descricao, executar: (estado, valor) => (estado === 'resolvida' ? aoResolver(valor) : aoRejeitar(valor)) })
    }

    then(aoResolver, aoRejeitar) {
      let res
      let rej
      const filha = new PromiseMister((a, b) => { res = a; rej = b })
      const nome = typeof aoResolver === 'function' ? nomeDaFuncao(aoResolver) : typeof aoRejeitar === 'function' ? nomeDaFuncao(aoRejeitar) : ''
      this.#adicionar({
        descricao: `then(${nome})`,
        * executar(estado, valor) {
          const h = estado === 'resolvida' ? aoResolver : aoRejeitar
          if (typeof h !== 'function') return estado === 'resolvida' ? res(valor) : rej(valor)
          try {
            res(yield* __chamar(h, undefined, [valor]))
          } catch (e) {
            if (e instanceof ErroJS) throw e
            rej(e)
          }
          return undefined
        },
      })
      return filha
    }

    catch(aoRejeitar) { return this.then(undefined, aoRejeitar) }

    finally(f) {
      return this.then(
        (v) => PromiseMister.resolve(typeof f === 'function' ? f() : undefined).then(() => v),
        (e) => PromiseMister.resolve(typeof f === 'function' ? f() : undefined).then(() => { throw e }),
      )
    }

    static resolve(v) { return v instanceof PromiseMister ? v : new PromiseMister((r) => r(v)) }
    static reject(e) { return new PromiseMister((_, r) => r(e)) }
    static all(lista) {
      return new PromiseMister((res, rej) => {
        const itens = [...lista]
        const valores = new Array(itens.length)
        let faltam = itens.length
        if (!faltam) res(valores)
        itens.forEach((p, i) => PromiseMister.resolve(p).then((v) => { valores[i] = v; if (--faltam === 0) res(valores) }, rej))
      })
    }
    static allSettled(lista) {
      return PromiseMister.all([...lista].map((p) => PromiseMister.resolve(p).then(
        (value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }))))
    }
    static race(lista) {
      return new PromiseMister((res, rej) => { for (const p of lista) PromiseMister.resolve(p).then(res, rej) })
    }
    static any(lista) {
      return new PromiseMister((res, rej) => {
        const itens = [...lista]
        let faltam = itens.length
        if (!faltam) rej(new Error('All promises were rejected'))
        for (const p of itens) PromiseMister.resolve(p).then(res, () => { if (--faltam === 0) rej(new Error('All promises were rejected')) })
      })
    }
  }

  // ---- temporizadores (Web APIs) ---------------------------------------------------------

  function agendar(f, ms, args, intervalo) {
    if (typeof f !== 'function') throw new TypeError('setTimeout/setInterval precisam de uma função')
    const id = proximoId++
    const espera = Math.max(0, Number(ms) || 0)
    temporizadores.push({ id, quando: relogio + espera, espera, seq: sequencia++, f, args, intervalo,
      descricao: `${intervalo ? 'setInterval' : 'setTimeout'}(${nomeDaFuncao(f)}, ${espera})` })
    return id
  }
  const cancelar = (id) => {
    for (const lista of [temporizadores, prontas]) {
      const i = lista.findIndex((t) => t.id === id)
      if (i >= 0) lista.splice(i, 1)
    }
  }

  // ---- console, prompt ------------------------------------------------------------------

  let recuo = ''
  // (a saída de erro e a padrão vão para o mesmo lugar: a tela do aluno)
  const escrever = (texto) => saida(`${recuo}${recuo ? texto.replace(/\n/g, `\n${recuo}`) : texto}\n`)
  const contadores = new Map()
  const relogios = new Map()
  const console = {
    log: (...a) => escrever(formatarArgumentos(a)),
    info: (...a) => escrever(formatarArgumentos(a)),
    debug: (...a) => escrever(formatarArgumentos(a)),
    warn: (...a) => escrever(formatarArgumentos(a)),
    error: (...a) => escrever(formatarArgumentos(a)),
    dirxml: (...a) => escrever(formatarArgumentos(a)),
    trace: (...a) => escrever(`Trace${a.length ? `: ${formatarArgumentos(a)}` : ''}`),
    dir: (valor, opcoes) => escrever(inspecionar(valor, opcoes ?? {})),
    table: (dados, colunas) => escrever(tabela(dados, colunas) ?? formatarArgumentos([dados])),
    assert: (condicao, ...a) => { if (!condicao) escrever(`Assertion failed${a.length ? `: ${formatarArgumentos(a)}` : ''}`) },
    count: (rotulo = 'default') => { rotulo = `${rotulo}`; const n = (contadores.get(rotulo) ?? 0) + 1; contadores.set(rotulo, n); escrever(`${rotulo}: ${n}`) },
    countReset: (rotulo = 'default') => { contadores.delete(`${rotulo}`) },
    time: (rotulo = 'default') => { relogios.set(`${rotulo}`, performance.now()) },
    timeEnd: (rotulo = 'default') => { const t = relogios.get(`${rotulo}`); relogios.delete(`${rotulo}`); if (t !== undefined) escrever(`${rotulo}: ${(performance.now() - t).toFixed(3)}ms`) },
    timeLog: (rotulo = 'default', ...a) => { const t = relogios.get(`${rotulo}`); if (t !== undefined) escrever(`${rotulo}: ${(performance.now() - t).toFixed(3)}ms${a.length ? ` ${formatarArgumentos(a)}` : ''}`) },
    clear: () => saida('\f'),
    group: (...a) => { if (a.length) escrever(formatarArgumentos(a)); recuo += '  ' },
    groupCollapsed: (...a) => { if (a.length) escrever(formatarArgumentos(a)); recuo += '  ' },
    groupEnd: () => { recuo = recuo.slice(2) },
  }
  const SAIDA_DO_PROGRAMA = Symbol.for('misteralg.saida')
  // O mínimo do `process` do Node que programas de aluno usam (process.stdout.write, argv, exit...).
  const processo = {
    stdout: { write: (t) => { saida(String(t)); return true }, isTTY: false, columns: 80 },
    stderr: { write: (t) => { saida(String(t)); return true } },
    argv: ['node', 'programa.js'],
    env: {},
    platform: 'linux',
    version: 'v20.0.0',
    versions: { node: '20.0.0' },
    pid: 1,
    exitCode: undefined,
    cwd: () => '/',
    uptime: () => relogio / 1000,
    hrtime: Object.assign((anterior) => { const t = performance.now(); const s = Math.floor(t / 1000); const ns = Math.round((t % 1000) * 1e6); return anterior ? [s - anterior[0], ns - anterior[1]] : [s, ns] }, { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }),
    memoryUsage: () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }),
    nextTick: (f, ...args) => enfileirarMicro(`process.nextTick(${nomeDaFuncao(f)})`, function* () { yield* __chamar(f, undefined, args) }),
    exit: () => { throw { [SAIDA_DO_PROGRAMA]: true } },
    on: () => processo,
  }

  function* prompt(_este, args) {
    if (args.length && args[0] !== undefined) saida(`${String(args[0])} `)
    const texto = yield { tipo: 'entrada' }
    return texto ?? null
  }

  // Versões passo a passo das funções de vetor que recebem callbacks (o passo a passo entra no callback).
  const ESPECIAIS = new Map([
    [Array.prototype.forEach, function* (arr, [cb, ctx]) { for (let i = 0; i < arr.length; i += 1) if (i in arr) yield* __chamar(cb, ctx, [arr[i], i, arr]) }],
    [Array.prototype.map, function* (arr, [cb, ctx]) { const r = new Array(arr.length); for (let i = 0; i < arr.length; i += 1) if (i in arr) r[i] = yield* __chamar(cb, ctx, [arr[i], i, arr]); return r }],
    [Array.prototype.flatMap, function* (arr, [cb, ctx]) { const r = []; for (let i = 0; i < arr.length; i += 1) if (i in arr) { const x = yield* __chamar(cb, ctx, [arr[i], i, arr]); if (Array.isArray(x)) r.push(...x); else r.push(x) } return r }],
    [Array.prototype.filter, function* (arr, [cb, ctx]) { const r = []; for (let i = 0; i < arr.length; i += 1) if (i in arr && (yield* __chamar(cb, ctx, [arr[i], i, arr]))) r.push(arr[i]); return r }],
    [Array.prototype.find, function* (arr, [cb, ctx]) { for (let i = 0; i < arr.length; i += 1) if (yield* __chamar(cb, ctx, [arr[i], i, arr])) return arr[i]; return undefined }],
    [Array.prototype.findIndex, function* (arr, [cb, ctx]) { for (let i = 0; i < arr.length; i += 1) if (yield* __chamar(cb, ctx, [arr[i], i, arr])) return i; return -1 }],
    [Array.prototype.some, function* (arr, [cb, ctx]) { for (let i = 0; i < arr.length; i += 1) if (i in arr && (yield* __chamar(cb, ctx, [arr[i], i, arr]))) return true; return false }],
    [Array.prototype.every, function* (arr, [cb, ctx]) { for (let i = 0; i < arr.length; i += 1) if (i in arr && !(yield* __chamar(cb, ctx, [arr[i], i, arr]))) return false; return true }],
    [Array.prototype.reduce, function* (arr, args) {
      let i = 0
      let acc
      if (args.length >= 2) acc = args[1]
      else {
        while (i < arr.length && !(i in arr)) i += 1
        if (i >= arr.length) throw new TypeError('Reduce of empty array with no initial value')
        acc = arr[i++]
      }
      for (; i < arr.length; i += 1) if (i in arr) acc = yield* __chamar(args[0], undefined, [acc, arr[i], i, arr])
      return acc
    }],
    [Array.prototype.sort, function* (arr, [cmp]) {
      if (typeof cmp !== 'function') return arr.sort()
      // Ordenação por inserção chamando o comparador do aluno (também no passo a passo).
      for (let i = 1; i < arr.length; i += 1) {
        const atual = arr[i]
        let j = i - 1
        for (; j >= 0 && (yield* __chamar(cmp, undefined, [arr[j], atual])) > 0; j -= 1) arr[j + 1] = arr[j]
        arr[j + 1] = atual
      }
      return arr
    }],
  ])
  // prompt do aluno (não existe no Worker): o nosso, que pede a entrada no console.
  const promptDoAluno = function prompt() { throw new ErroJS('prompt() só funciona chamado direto do seu código', ultimaLinha) }
  ESPECIAIS.set(promptDoAluno, prompt)
  for (const modo of ['next', 'return', 'throw']) {
    ESPECIAIS.set(GeradorAssincrono.prototype[modo], function* (g, [v]) { return yield* pedir(g, modo, v) })
  }

  const modulos = criarModulos({
    saida,
    enfileirar: (f, args, descricao) => prontas.push({ f, args, descricao: `${descricao} (${nomeDaFuncao(f)})` }),
    Promessa: PromiseMister,
    especiais: ESPECIAIS,
    falhar: (mensagem, explicacao) => Object.assign(new ErroJS(mensagem, ultimaLinha), { explicacao }),
  })
  processo.stdin = modulos.stdin

  // ---- o laço de eventos ----------------------------------------------------------------

  function* esvaziarMicrotarefas() {
    while (microtarefas.length) {
      const m = microtarefas.shift()
      yield* m.executar()
    }
  }

  const laco = (programa) => conduzir(lacoInterno(programa))

  function* lacoInterno(programa) {
    // o programa é uma corrotina como as funções async: um await no topo o suspende e o laço segue com as filas
    const c = { g: conduzir(programa()), info: { nome: 'o programa principal', programa: true }, quadro: principal,
      resolver: () => { c.fim = true }, rejeitar: (e) => { throw e } }
    yield* continuarCorrotina(c, undefined, false)
    for (;;) {
      yield* esvaziarMicrotarefas()
      if (!prontas.length) {
        if (!temporizadores.length) {
          if (!modulos.temDemanda()) break
          modulos.despachar((yield { tipo: 'entrada' }) ?? null) // readline / process.stdin esperando uma linha
          continue
        }
        // O relógio pula para o próximo temporizador; os que vencem passam para a fila de tarefas.
        temporizadores.sort((a, b) => a.quando - b.quando || a.seq - b.seq)
        relogio = temporizadores[0].quando
        while (temporizadores.length && temporizadores[0].quando <= relogio) prontas.push(temporizadores.shift())
        yield { tipo: 'laco', descricao: `o relógio chegou a ${relogio} ms: ${prontas.length} callback(s) na fila de tarefas` }
      }
      const t = prontas.shift()
      if (t.intervalo) temporizadores.push({ ...t, quando: relogio + Math.max(1, t.espera), seq: sequencia++ })
      yield { tipo: 'laco', descricao: `a pilha está vazia: o laço de eventos tira ${t.descricao} da fila` }
      yield* __chamar(t.f, undefined, t.args ?? [])
    }
    if (rejeicoesSemCatch.size) {
      const [p] = rejeicoesSemCatch
      throw Object.assign(new ErroJS(`uma Promise foi rejeitada e ninguém tratou (falta .catch ou try/catch no await): ${descreverErro(p.valor)}`, ultimaLinha), { semCatch: true })
    }
    // Sem nada mais a rodar e o programa ainda parado num await: a Promise nunca vai terminar (o Node sai com código 13).
    if (!c.fim && c.linhaAguardando !== undefined) {
      throw Object.assign(new ErroJS(`o programa terminou esperando uma Promise que nunca foi resolvida (await na linha ${c.linhaAguardando})`, c.linhaAguardando), {
        explicacao: 'Um await no topo do programa ficou esperando uma Promise que nunca chama resolve nem reject, e não há mais nada para rodar (nenhum setTimeout pendente). O Node avisa "unsettled top-level await" e encerra. Confira se a Promise chama resolve() ou reject() em todos os caminhos.',
      })
    }
  }

  return {
    pilha,
    principal,
    filas: () => ({
      relogio,
      webApis: [...temporizadores].sort((a, b) => a.quando - b.quando).map((t) => ({ descricao: t.descricao, faltam: t.quando - relogio })),
      tarefas: prontas.map((t) => t.descricao),
      microtarefas: microtarefas.map((m) => m.descricao),
    }),
    get ultimaLinha() { return ultimaLinha },
    laco,
    PromiseMister,
    // Nomes que o código instrumentado e o aluno enxergam.
    ambiente: {
      __passo, __funcao, __registrar, __envolverMetodos, __sincrono, __chamar, __chamarMetodo, __aguardar, __ceder, __delegar, __chaveCalc,
      __abrirAssinc, __proximoAssinc, __fecharAssinc,
      console,
      Promise: PromiseMister,
      setTimeout: (f, ms, ...args) => agendar(f, ms, args, false),
      setInterval: (f, ms, ...args) => agendar(f, ms, args, true),
      clearTimeout: cancelar,
      clearInterval: cancelar,
      queueMicrotask: (f) => enfileirarMicro(`queueMicrotask(${nomeDaFuncao(f)})`, function* () { yield* __chamar(f, undefined, []) }),
      prompt: promptDoAluno,
      process: processo,
      require: modulos.require,
      module: modulos.module,
      exports: modulos.exports,
      alert: (msg) => saida(`${String(msg)}\n`),
    },
  }
}

// ---- texto dos valores (console.log e mensagens) -------------------------------------------

export function descreverCurto(v) {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'function') return `função ${nomeDaFuncao(v)}`
  if (v === null || v === undefined || typeof v !== 'object') return String(v)
  return Array.isArray(v) ? '[array]' : '{objeto}'
}

function descreverErro(e) {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return formatarArgumentos([e])
}

export { inspecionar }
