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

  function __envolverMetodos(Classe, metodos, texto) {
    for (const m of metodos) {
      const alvo = m.estatico ? Classe : Classe.prototype
      const gerador = alvo[m.chave]
      const W = function (...args) { return __sincrono(W, this, args) }
      marcar(W, gerador, { ...m.info, nome: `${Classe.name}.${m.info.nome}` })
      disfarcar(W, m.info)
      Object.defineProperty(W, 'name', { value: m.info.nome })
      Object.defineProperty(alvo, m.chave, { value: W, writable: true, configurable: true, enumerable: false })
    }
    if (texto !== undefined && !Object.hasOwn(Classe, 'toString')) Object.defineProperty(Classe, 'toString', { value: () => texto, writable: true, configurable: true })
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
