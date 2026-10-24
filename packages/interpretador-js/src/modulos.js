// Os módulos do Node que programas de aluno pedem com require/import: readline, fs (só para ler a entrada),
// util e assert. A entrada usa o mesmo mecanismo do prompt(): o laço de eventos pede uma linha ao console
// sempre que alguém está esperando por ela (temDemanda) e entrega com despachar(). null = fim da entrada (Esc).

import { formatarArgumentos, inspecionar } from './inspecionar.js'

const DISPONIVEIS = 'só readline, fs para ler a entrada, util e assert'

// shortcut: igualdade profunda por texto do inspecionar (a ordem das chaves conta); trocar se alguém reclamar
const iguais = (a, b) => inspecionar(a, { depth: null }) === inspecionar(b, { depth: null })

class AssertionError extends Error {
  constructor(mensagem) {
    super(mensagem)
    this.name = 'AssertionError'
    this.code = 'ERR_ASSERTION'
  }
}

function falha(mensagem, padrao) {
  throw mensagem instanceof Error ? mensagem : new AssertionError(mensagem ?? padrao)
}

const comparar = (a, b, sinal) => `Expected values to be ${sinal}:\n\n${inspecionar(a)} !== ${inspecionar(b)}\n`

function criarAssert() {
  const ok = (valor, m) => { if (!valor) falha(m, 'The expression evaluated to a falsy value') }
  return Object.assign((valor, m) => ok(valor, m), {
    ok,
    AssertionError,
    fail: (m) => falha(m, 'Failed'),
    // eslint-disable-next-line eqeqeq
    equal: (a, b, m) => { if (a != b) falha(m, `${inspecionar(a)} == ${inspecionar(b)}`) },
    // eslint-disable-next-line eqeqeq
    notEqual: (a, b, m) => { if (a == b) falha(m, `${inspecionar(a)} != ${inspecionar(b)}`) },
    strictEqual: (a, b, m) => { if (!Object.is(a, b)) falha(m, comparar(a, b, 'strictly equal')) },
    notStrictEqual: (a, b, m) => { if (Object.is(a, b)) falha(m, `Expected "actual" to be strictly unequal to: ${inspecionar(b)}`) },
    deepEqual: (a, b, m) => { if (!iguais(a, b)) falha(m, comparar(a, b, 'loosely deep-equal')) },
    deepStrictEqual: (a, b, m) => { if (!iguais(a, b)) falha(m, comparar(a, b, 'strictly deep-equal')) },
    notDeepStrictEqual: (a, b, m) => { if (iguais(a, b)) falha(m, 'Expected "actual" not to be strictly deep-equal to: ' + inspecionar(b)) },
    throws: (f, _esperado, m) => {
      try { f() } catch { return }
      falha(typeof _esperado === 'string' ? _esperado : m, 'Missing expected exception.')
    },
  })
}

/**
 * @param saida escreve na tela do aluno
 * @param enfileirar(f, args, descricao) põe um callback na fila de tarefas do laço de eventos
 * @param Promessa a Promise do runtime (para readline/promises)
 * @param especiais mapa das funções que rodam passo a passo e podem pedir entrada (como o prompt)
 * @param falhar(mensagem, explicacao) cria o erro do próprio MisterALG
 */
export function criarModulos({ saida, enfileirar, Promessa, especiais, falhar }) {
  let fimEntrada = false
  let stdinRetomado = false
  const interfaces = []

  function criarEmissor(rotulo) {
    const ouvintes = {}
    return {
      adicionar(evento, f, uma) {
        if (typeof f !== 'function') throw new TypeError(`o ouvinte de '${evento}' precisa ser uma função`)
        ;(ouvintes[evento] ??= []).push({ f, uma })
      },
      remover(evento, f) { ouvintes[evento] = (ouvintes[evento] ?? []).filter((l) => l.f !== f) },
      tem: (evento) => (ouvintes[evento]?.length ?? 0) > 0,
      emitir(evento, args) {
        const lista = ouvintes[evento] ?? []
        ouvintes[evento] = lista.filter((l) => !l.uma)
        for (const l of lista) enfileirar(l.f, args, `evento '${evento}' do ${rotulo}`)
      },
    }
  }

  // ---- readline -----------------------------------------------------------------------

  function fechar(estado) {
    if (!estado.aberta) return
    estado.aberta = false
    estado.perguntas.length = 0
    interfaces.splice(interfaces.indexOf(estado), 1)
    estado.emissor.emitir('close', [])
  }

  function criarInterface(opcoes, comPromessa) {
    const estado = { aberta: true, perguntas: [], emissor: criarEmissor('readline'), prompt: '> ', escreve: !!opcoes?.output }
    const rl = {
      question(texto, ...resto) {
        if (!estado.aberta) throw Object.assign(new Error('readline was closed'), { code: 'ERR_USE_AFTER_CLOSE' })
        if (estado.escreve) saida(String(texto))
        if (comPromessa) return new Promessa((resolver) => { estado.perguntas.push(resolver) })
        const cb = resto.find((x) => typeof x === 'function')
        if (!cb) throw new TypeError('rl.question(texto, callback) precisa de uma função no segundo argumento')
        estado.perguntas.push(cb)
        return undefined
      },
      on: (evento, f) => { estado.emissor.adicionar(evento, f, false); return rl },
      once: (evento, f) => { estado.emissor.adicionar(evento, f, true); return rl },
      off: (evento, f) => { estado.emissor.remover(evento, f); return rl },
      close: () => fechar(estado),
      setPrompt: (p) => { estado.prompt = String(p) },
      getPrompt: () => estado.prompt,
      prompt: () => { if (estado.escreve && estado.aberta) saida(estado.prompt) },
      pause: () => rl,
      resume: () => rl,
      write: () => {},
    }
    rl.addListener = rl.on
    rl.removeListener = rl.off
    interfaces.push(estado)
    return rl
  }

  const readlinePromises = { createInterface: (o) => criarInterface(o, true) }
  const readline = { createInterface: (o) => criarInterface(o, false), promises: readlinePromises }

  // ---- process.stdin ------------------------------------------------------------------

  const emissorStdin = criarEmissor('process.stdin')
  const stdin = {
    fd: 0,
    isTTY: false,
    on(evento, f) { emissorStdin.adicionar(evento, f, false); return stdin },
    once(evento, f) { emissorStdin.adicionar(evento, f, true); return stdin },
    off(evento, f) { emissorStdin.remover(evento, f); return stdin },
    setEncoding: () => stdin,
    resume() { stdinRetomado = true; return stdin },
    pause() { stdinRetomado = false; return stdin },
  }
  stdin.addListener = stdin.on
  stdin.removeListener = stdin.off

  // ---- fs: só a entrada ------------------------------------------------------------------

  const lerArquivo = function readFileSync() { throw falhar('fs.readFileSync só funciona chamado direto do seu código') }
  especiais.set(lerArquivo, function* (_este, [caminho]) {
    if (caminho !== 0 && caminho !== '/dev/stdin') {
      throw falhar(`fs.readFileSync só lê a entrada do teclado (0 ou '/dev/stdin'); o MisterALG não tem arquivos`,
        'Para ler tudo que o usuário digitar use fs.readFileSync(0, "utf8"). Termine a entrada com uma linha vazia ou com Esc.')
    }
    const linhas = []
    while (!fimEntrada) {
      const texto = yield { tipo: 'entrada' }
      if (texto === null || texto === undefined) fimEntrada = true
      else if (texto === '') break
      else linhas.push(texto)
    }
    return linhas.length ? `${linhas.join('\n')}\n` : ''
  })

  // ---- util, assert e o require ---------------------------------------------------------------

  const util = {
    inspect: (valor, opcoes) => inspecionar(valor, opcoes ?? {}),
    format: (...args) => formatarArgumentos(args),
    isDeepStrictEqual: iguais,
  }
  const modulos = { readline, 'readline/promises': readlinePromises, fs: { readFileSync: lerArquivo }, util, assert: criarAssert() }
  const modulo = { exports: {} }

  const exigir = (nome) => {
    const n = String(nome).replace(/^node:/, '')
    if (Object.hasOwn(modulos, n)) return modulos[n]
    throw falhar(`O módulo '${n}' não existe no MisterALG (${DISPONIVEIS}).`,
      'O MisterALG roda o JavaScript sem o Node.js, então módulos como http, path ou arquivos de verdade não estão disponíveis. '
      + 'Para ler dados do teclado use readline (rl.question) ou prompt(). Numa leitura contínua (rl.on("line")), '
      + 'tecle Esc no campo de entrada para encerrar a entrada, ou chame rl.close().')
  }
  exigir.main = modulo

  return {
    require: exigir,
    module: modulo,
    exports: modulo.exports,
    stdin,
    /** Alguém está esperando uma linha do teclado? Se não, o programa pode terminar. */
    temDemanda: () => !fimEntrada && (interfaces.some((r) => r.perguntas.length || r.emissor.tem('line'))
      || emissorStdin.tem('data') || stdinRetomado),
    /** Entrega a linha digitada (ou null = fim da entrada) a quem esperava. */
    despachar(texto) {
      if (texto === null || texto === undefined) {
        fimEntrada = true
        for (const r of [...interfaces]) fechar(r)
        emissorStdin.emitir('end', [])
        emissorStdin.emitir('close', [])
        return
      }
      const linha = String(texto)
      const comPergunta = interfaces.find((r) => r.perguntas.length)
      if (comPergunta) {
        enfileirar(comPergunta.perguntas.shift(), [linha], 'a resposta de rl.question')
        return
      }
      for (const r of interfaces) r.emissor.emitir('line', [linha])
      emissorStdin.emitir('data', [`${linha}\n`])
    },
  }
}
