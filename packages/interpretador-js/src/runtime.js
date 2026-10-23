// O laço de eventos do passo a passo de JavaScript. O código instrumentado (instrumentar.js)
// chama as funções daqui; tudo é gerador, para o passo a passo pausar em qualquer linha.
//
// Para o aluno ver como o JavaScript funciona de verdade, as filas são nossas e ficam à mostra:
//  - pilha de chamadas: as funções em execução agora;
//  - Web APIs: os setTimeout/setInterval esperando o relógio (que é virtual: pula direto
//    para o próximo temporizador, sem esperar de verdade);
//  - fila de tarefas: os callbacks cujo tempo já chegou;
//  - microtarefas: as reações de Promise (then, await), que sempre passam na frente.

export const GERADOR = Symbol('gerador')
export const INFO = Symbol('info')
const MAX_CHAMADAS = 700 // cada chamada usa vários quadros de gerador no JS; acima disso a pilha do próprio JS estoura

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

  function __funcao(gerador, info) {
    const F = function (...args) { return __sincrono(F, this, args) }
    F[GERADOR] = gerador
    F[INFO] = info
    Object.defineProperty(F, 'name', { value: info.nome === '(anônima)' ? '' : info.nome })
    return F
  }

  function __registrar(F, gerador, info) {
    F[GERADOR] = gerador
    F[INFO] = info
  }

  function __envolverMetodos(Classe, metodos) {
    for (const m of metodos) {
      const alvo = m.estatico ? Classe : Classe.prototype
      const gerador = alvo[m.chave]
      const W = function (...args) { return __sincrono(W, this, args) }
      W[GERADOR] = gerador
      W[INFO] = { ...m.info, nome: `${Classe.name}.${m.info.nome}` }
      Object.defineProperty(alvo, m.chave, { value: W, writable: true, configurable: true, enumerable: false })
    }
    return Classe
  }

  /** Função do aluno chamada por código da biblioteca (sort, addEventListener...): roda inteira, sem pausar. */
  function __sincrono(F, este, args) {
    const info = F[INFO]
    if (info.assincrona) {
      const { corrotina, promessa } = criarCorrotina(F, este, args)
      silencioso(continuarCorrotina(corrotina, undefined, false))
      return promessa
    }
    return silencioso(chamarFuncaoDoAluno(F, este, args))
  }

  function silencioso(gen) {
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
      return yield* F[GERADOR].apply(este, args)
    } finally {
      pilha.pop()
    }
  }

  function* __chamar(f, este, args, linha) {
    if (typeof f !== 'function') throw new TypeError(`${descreverCurto(f)} não é uma função`)
    if (f[GERADOR]) {
      if (f[INFO].assincrona) {
        const { corrotina, promessa } = criarCorrotina(f, este, args)
        yield* continuarCorrotina(corrotina, undefined, false) // até o primeiro await, como no JavaScript de verdade
        return promessa
      }
      return yield* chamarFuncaoDoAluno(f, este, args)
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
    return { corrotina: { g: F[GERADOR].apply(este, args), info, quadro: novoQuadro(info), resolver, rejeitar }, promessa }
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
          PromiseMister.resolve(ev.valor).reagir(`continuar ${c.info.nome}() depois do await`,
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

  const __aguardar = (valor) => ({ tipo: 'aguardar', valor })

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

  const formatarArgs = (args) => {
    if (typeof args[0] === 'string' && /%[sdifoOc]/.test(args[0])) {
      let i = 1
      const primeiro = args[0].replace(/%([sdifoOc%])/g, (m, c) => {
        if (c === '%') return '%'
        if (i >= args.length) return m
        const v = args[i++]
        if (c === 's') return String(v)
        if (c === 'd' || c === 'i') return String(Number.parseInt(v, 10))
        if (c === 'f') return String(Number(v))
        if (c === 'c') return ''
        return inspecionar(v)
      })
      return [primeiro, ...args.slice(i).map((a) => (typeof a === 'string' ? a : inspecionar(a)))].join(' ')
    }
    return args.map((a) => (typeof a === 'string' ? a : inspecionar(a))).join(' ')
  }
  let recuo = ''
  const console = {
    log: (...a) => saida(`${recuo}${formatarArgs(a)}\n`),
    info: (...a) => saida(`${recuo}${formatarArgs(a)}\n`),
    debug: (...a) => saida(`${recuo}${formatarArgs(a)}\n`),
    warn: (...a) => saida(`${recuo}${formatarArgs(a)}\n`),
    error: (...a) => saida(`${recuo}${formatarArgs(a)}\n`),
    table: (dados) => saida(`${inspecionar(dados)}\n`),
    clear: () => saida('\f'),
    group: (...a) => { if (a.length) saida(`${recuo}${formatarArgs(a)}\n`); recuo += '  ' },
    groupEnd: () => { recuo = recuo.slice(2) },
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

  // ---- o laço de eventos ----------------------------------------------------------------

  function* esvaziarMicrotarefas() {
    while (microtarefas.length) {
      const m = microtarefas.shift()
      yield* m.executar()
    }
  }

  function* laco(programa) {
    pilha.push(principal)
    try {
      yield* programa()
    } finally {
      pilha.pop()
    }
    for (;;) {
      yield* esvaziarMicrotarefas()
      if (!prontas.length) {
        if (!temporizadores.length) break
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
      __passo, __funcao, __registrar, __envolverMetodos, __sincrono, __chamar, __chamarMetodo, __aguardar,
      console,
      Promise: PromiseMister,
      setTimeout: (f, ms, ...args) => agendar(f, ms, args, false),
      setInterval: (f, ms, ...args) => agendar(f, ms, args, true),
      clearTimeout: cancelar,
      clearInterval: cancelar,
      queueMicrotask: (f) => enfileirarMicro(`queueMicrotask(${nomeDaFuncao(f)})`, function* () { yield* __chamar(f, undefined, []) }),
      prompt: promptDoAluno,
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
  return inspecionar(e)
}

/** Como o console.log do Node mostra valores (simplificado). */
export function inspecionar(v, profundidade = 0, vistos = new Set()) {
  if (typeof v === 'string') return profundidade ? `'${v}'` : v
  if (typeof v === 'number' || typeof v === 'boolean' || v === undefined || v === null) return Object.is(v, -0) ? '-0' : String(v)
  if (typeof v === 'bigint') return `${v}n`
  if (typeof v === 'symbol') return v.toString()
  if (typeof v === 'function') {
    if (/^class\b/.test(Function.prototype.toString.call(v))) return `[class ${v.name}]`
    return `[Function: ${nomeDaFuncao(v)}]`
  }
  if (vistos.has(v)) return '[Circular]'
  if (v instanceof Error) return `${v.name}: ${v.message}`
  if (v?.[Symbol.toStringTag] === 'Promise' && 'estado' in v) {
    return `Promise { ${v.estado === 'pendente' ? '<pending>' : v.estado === 'rejeitada' ? `<rejected> ${inspecionar(v.valor, profundidade + 1, vistos)}` : inspecionar(v.valor, profundidade + 1, vistos)} }`
  }
  if (profundidade > 2) return Array.isArray(v) ? '[Array]' : '[Object]'
  vistos.add(v)
  try {
    if (Array.isArray(v)) return v.length ? `[ ${v.map((x) => inspecionar(x, profundidade + 1, vistos)).join(', ')} ]` : '[]'
    if (v instanceof Map) return `Map(${v.size}) { ${[...v].map(([k, x]) => `${inspecionar(k, profundidade + 1, vistos)} => ${inspecionar(x, profundidade + 1, vistos)}`).join(', ')} }`
    if (v instanceof Set) return `Set(${v.size}) { ${[...v].map((x) => inspecionar(x, profundidade + 1, vistos)).join(', ')} }`
    if (v instanceof Date) return v.toISOString()
    const nome = v.constructor && v.constructor !== Object ? `${v.constructor.name} ` : ''
    const campos = Object.keys(v).map((k) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${inspecionar(v[k], profundidade + 1, vistos)}`)
    return campos.length ? `${nome}{ ${campos.join(', ')} }` : `${nome}{}`
  } finally {
    vistos.delete(v)
  }
}
