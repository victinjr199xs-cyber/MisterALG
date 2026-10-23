// Passo a passo de JavaScript e TypeScript: a sessão que conduz o programa instrumentado,
// no mesmo formato da Sessao do Portugol e da SessaoC (continuar, passo, parar, fornecerEntrada).

import { fotografar } from './fotografia.js'
import { instrumentar } from './instrumentar.js'
import { ErroJS, criarRuntime } from './runtime.js'

export { instrumentar } from './instrumentar.js'
export { fotografar } from './fotografia.js'

const FATIA = 20000
const imediato = globalThis.setImmediate ?? ((f) => setTimeout(f, 0))

/** Erros do JavaScript em português, com uma explicação para quem está começando. */
export function traduzirErro(e) {
  const m = String(e?.message ?? e)
  const casos = [
    [/^(.+) is not defined$/, (x) => [`"${x[1]}" não foi declarada`, 'Use let, const ou var para criar a variável antes de usá-la, e confira se o nome está escrito igual (maiúsculas contam).']],
    [/^Cannot read propert(?:y|ies) of (undefined|null) \(reading '(.*)'\)$/, (x) => [`tentou ler "${x[2]}" de ${x[1]}`, `O valor antes do ponto é ${x[1]}: a variável não recebeu um objeto, ou a propriedade/índice que veio antes não existe.`]],
    [/^Cannot set propert(?:y|ies) of (undefined|null) \(setting '(.*)'\)$/, (x) => [`tentou guardar "${x[2]}" em ${x[1]}`, `O valor antes do ponto é ${x[1]}, não um objeto.`]],
    [/^Assignment to constant variable\.?$/, () => ['não dá para mudar o valor de uma const', 'Uma variável const não pode receber outro valor. Use let se ela precisa mudar.']],
    [/^Cannot access '(.+)' before initialization$/, (x) => [`"${x[1]}" foi usada antes da linha que a declara`, 'Com let e const, a variável só existe a partir da linha da declaração.']],
    [/não é uma função/, () => [m, 'Só dá para chamar com () o que é uma função. Confira o nome e se o objeto tem esse método.']],
    [/^(.+) is not a function$/, (x) => [`${x[1]} não é uma função`, 'Só dá para chamar com () o que é uma função. Confira o nome e se o objeto tem esse método.']],
    [/Maximum call stack size exceeded|recursão infinita/, () => ['a pilha de chamadas estourou (recursão infinita?)', 'Uma função que chama a si mesma precisa de um caso base que pare a recursão.']],
    [/^Class constructor (.+) cannot be invoked without 'new'$/, (x) => [`a classe ${x[1]} precisa ser criada com new`, `Escreva new ${x[1]}(...) para criar um objeto da classe.`]],
    [/^Invalid array length$/, () => ['tamanho de array inválido', 'O tamanho de um array precisa ser um inteiro de 0 para cima.']],
  ]
  for (const [re, f] of casos) {
    const x = re.exec(m)
    if (x) {
      const [mensagem, explicacao] = f(x)
      return { mensagem: e?.name && e.name !== 'Error' && !(e instanceof ErroJS) ? `${e.name}: ${mensagem}` : mensagem, explicacao }
    }
  }
  return { mensagem: e?.name && !(e instanceof ErroJS) ? `${e.name}: ${m}` : m, explicacao: e instanceof ErroJS ? undefined : 'Este erro aconteceu durante a execução do programa.' }
}

export class SessaoJS {
  /**
   * @param op typescript, modo 'continuo'|'passo'|'timer', timerMs, breakpoints, entrada[], semAtrasos,
   *           e os eventos onOutput(texto), onStep({linha, evento}), onMemory(foto), onWaitInput(), onEnd(status, erro)
   */
  constructor(fonte, op = {}) {
    this.op = op
    this.estado = 'pronto'
    this.modo = op.modo ?? 'continuo'
    this.timerMs = op.timerMs ?? 500
    this.breakpoints = new Set(op.breakpoints ?? [])
    this.entradas = [...(op.entrada ?? [])]
    this.buffer = ''
    this.linhaAtual = 0
    this.pararNaProxima = false
    this.pedidoParada = false
    this.rodando = false
    if (typeof fonte !== 'string') fonte = ''
    const r = instrumentar(fonte, { typescript: !!op.typescript })
    if (r.erro) {
      this.erroInicial = Object.assign(new ErroJS(`erro de sintaxe: ${r.erro.mensagem}`, r.erro.linha), {
        explicacao: 'O programa tem um erro de escrita nesta linha (ou logo antes dela): parênteses, chaves, aspas ou vírgulas.',
      })
      return
    }
    this.tipos = r.tiposDeclarados
    this.rt = criarRuntime({ saida: (t) => { this.buffer += t } })
    try {
      const nomes = Object.keys(this.rt.ambiente)
      // eslint-disable-next-line no-new-func
      const criar = new Function('__ambiente', `const { ${nomes.join(', ')} } = __ambiente;\n${r.codigo}\nreturn __programa;`)
      this.gen = this.rt.laco(criar(this.rt.ambiente))
    } catch (e) {
      this.erroInicial = new ErroJS(`o passo a passo não conseguiu preparar o programa: ${e.message}`, 0)
    }
  }

  get terminado() { return ['terminado', 'erro', 'parado', 'limite'].includes(this.estado) }

  continuar() {
    if (this.terminado || this.estado === 'aguardando') return
    this.pararNaProxima = this.modo === 'passo'
    this.rodar()
  }

  passo() {
    if (this.terminado || this.estado === 'aguardando') return
    this.pararNaProxima = true
    this.rodar()
  }

  parar() {
    if (this.terminado) return
    if (this.rodando) {
      this.pedidoParada = true
      return
    }
    clearTimeout(this.agendado)
    this.finalizar('parado')
  }

  fornecerEntrada(texto) {
    if (this.estado === 'aguardando') {
      this.estado = 'rodando'
      this.pendente = texto
      this.rodar()
    } else if (texto !== null) this.entradas.push(texto)
  }

  descarregar() {
    if (!this.buffer) return
    const t = this.buffer
    this.buffer = ''
    this.op.onOutput?.(t)
  }

  foto() { return this.rt ? fotografar(this.rt, this.tipos) : null }

  rodar() {
    if (this.rodando || this.terminado) return
    if (this.erroInicial) return this.finalizar('erro', this.erroInicial)
    this.rodando = true
    this.estado = 'rodando'
    let envio = this.pendente
    this.pendente = undefined
    let nestaFatia = 0
    try {
      for (;;) {
        const r = this.gen.next(envio)
        envio = undefined
        if (r.done) {
          this.rodando = false
          return this.finalizar('terminado')
        }
        const ev = r.value
        if (ev.tipo === 'linha' || ev.tipo === 'laco') {
          if (ev.tipo === 'linha') this.linhaAtual = ev.linha
          if (this.pedidoParada) {
            this.rodando = false
            return this.finalizar('parado')
          }
          // As pausas do laço de eventos (fila de tarefas) só aparecem no passo a passo.
          if (this.pararNaProxima || (ev.tipo === 'linha' && this.breakpoints.has(ev.linha))) return this.pausar(ev)
          if (this.modo === 'timer' && !this.op.semAtrasos && ev.tipo === 'linha') {
            this.mostrar(ev)
            this.rodando = false
            this.agendado = setTimeout(() => this.rodar(), this.timerMs)
            return undefined
          }
          nestaFatia += 1
          if (nestaFatia >= FATIA && this.op.fatias !== false) {
            this.descarregar()
            this.rodando = false
            this.agendado = imediato(() => this.rodar())
            return undefined
          }
        } else if (ev.tipo === 'entrada') {
          if (this.entradas.length) {
            envio = this.entradas.shift()
            if (envio !== null) this.buffer += `${envio}\n` // eco, como no terminal
            continue
          }
          this.descarregar()
          this.rodando = false
          this.estado = 'aguardando'
          this.op.onStep?.({ linha: this.linhaAtual })
          this.op.onMemory?.(this.foto())
          this.op.onWaitInput?.()
          return undefined
        }
      }
    } catch (e) {
      this.rodando = false
      return this.finalizar('erro', e)
    }
  }

  mostrar(ev) {
    this.descarregar()
    this.op.onStep?.({ linha: ev.tipo === 'linha' ? ev.linha : this.linhaAtual, evento: ev.tipo === 'laco' ? ev.descricao : null })
    this.op.onMemory?.(this.foto())
  }

  pausar(ev) {
    this.rodando = false
    this.pararNaProxima = false
    this.estado = 'pausado'
    this.mostrar(ev)
  }

  finalizar(status, e) {
    if (this.terminado) return
    this.descarregar()
    this.estado = status
    let erro
    if (e) {
      const t = traduzirErro(e)
      erro = { mensagem: t.mensagem, explicacao: e.explicacao ?? t.explicacao, linha: e.linha ?? this.rt?.ultimaLinha ?? this.linhaAtual }
    }
    if (this.rt) this.op.onMemory?.(this.foto())
    this.op.onEnd?.(status, erro)
  }
}

/** Atalho para testes: roda até o fim e devolve a saída. */
export function rodarJS(fonte, opcoes = {}) {
  return new Promise((resolve) => {
    let saida = ''
    const sessao = new SessaoJS(fonte, {
      semAtrasos: true,
      fatias: false,
      ...opcoes,
      onOutput: (t) => { saida += t },
      onWaitInput: () => resolve({ saida, status: 'aguardando', sessao }),
      onEnd: (status, erro) => resolve({ saida, status, erro, sessao }),
    })
    sessao.continuar()
  })
}
