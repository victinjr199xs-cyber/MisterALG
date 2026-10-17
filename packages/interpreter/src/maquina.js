// Máquina de execução: percorre a AST com generators para poder pausar em
// qualquer linha (passo a passo, pontos de parada, leia, pausa, timer).
//
// Eventos que o generator entrega a quem o conduz (index.js / Sessao):
//   { tipo: 'linha', linha }   antes de executar cada linha
//   { tipo: 'leia', descricao } espera um texto (ou null para parar)
//   { tipo: 'pausa', linha }   comando pausa / debug verdadeiro

import { erro, TEXTOS } from './erros.js'
import { formatarSaida, textoGrade, textoValor } from './formatos.js'
import { FUNCOES_EMBUTIDAS, textoParaNumero } from './stdlib.js'
import { normalizar } from './palavras.js'

export const INTERROMPA = Symbol('interrompa')

class Retorno {
  constructor(valor) {
    this.valor = valor
  }
}

/** Execução interrompida pelo usuário (Esc no leia, Ctrl+F2). */
export class Parada extends Error {
  constructor() {
    super(TEXTOS.terminadoUsuario)
    this.name = 'Parada'
  }
}

const CODIGO_BASICO = { INTEIRO: 'I', REAL: 'R', CARACTERE: 'C', LOGICO: 'L' }
export const NOME_TIPO = { I: 'INTEIRO', R: 'REAL', C: 'CARACTER', L: 'LOGICO', V: 'VETOR', G: 'REGISTRO' }
const CORES = new Set(['BRANCO', 'AMARELO', 'VERMELHO', 'VERDE', 'ROXO', 'AZUL', 'PRETO'])
const POSICOES = new Set(['FRENTE', 'FUNDOS', 'FUNDO'])
const LIMITE_PILHA = 5000

const ehNumero = (v) => v.t === 'I' || v.t === 'R'
const maiusculaAscii = (s) => s.replace(/[a-z]/g, (c) => c.toUpperCase())

function comparar(a, b, linha) {
  if (ehNumero(a) && ehNumero(b)) return a.v < b.v ? -1 : a.v > b.v ? 1 : 0
  if (a.t === 'C' && b.t === 'C') {
    const x = maiusculaAscii(a.v)
    const y = maiusculaAscii(b.v)
    return x < y ? -1 : x > y ? 1 : 0
  }
  if (a.t === 'L' && b.t === 'L') return Number(a.v) - Number(b.v)
  throw erro(47, linha, ehNumero(a) ? 'INTEIRO ou REAL' : NOME_TIPO[a.t] ?? 'INTEIRO ou REAL')
}

export class Maquina {
  /**
   * @param prog AST de parser.analisar
   * @param opcoes { rng, relogio: { agora() }, arquivos: { ler(nome), anexar(nome, linha) }, io }
   *   io = { saida(texto), limpar(), cor(cor, posicao) }
   */
  constructor(prog, opcoes = {}) {
    this.prog = prog
    this.rng = opcoes.rng ?? Math.random
    this.relogio = opcoes.relogio ?? { agora: () => Date.now() }
    this.arquivos = opcoes.arquivos ?? null
    this.io = opcoes.io ?? { saida() {}, limpar() {}, cor() {} }

    this.globais = new Map()
    this.registros = new Map()
    this.subs = new Map()
    this.frames = []
    this.eco = true
    // Botão "Gerar valores aleatórios" da IDE liga o modo desde o início.
    this.aleatorio = opcoes.aleatorio
      ? { ligado: true, min: 0, max: 100, casas: undefined, ...opcoes.aleatorio }
      : { ligado: false, min: 0, max: 100, casas: undefined }
    // Listas da aba "Listas" (listas.txt do original): `lista <nome>` faz o
    // aleatório sortear os caracteres dessa lista em vez de 5 letras.
    this.listas = new Map((opcoes.listas ?? []).map((l) => [normalizar(l.nome), l.itens]))
    this.listaAtiva = null
    this.timerMs = null
    this.cronometro = null
    this.perfil = new Map()
    this.pedirPerfil = false
    this.arquivo = null
    this.linhaAtual = prog.linhaInicio
  }

  // ---- preparação ----------------------------------------------------------

  preparar() {
    const { prog } = this
    for (const t of prog.tipos) {
      if (this.registros.has(t.n)) throw erro(35, t.linha, t.v)
      const tipo = { k: 'G', nome: t.v, campos: [] }
      this.registros.set(t.n, tipo)
      for (const d of t.campos) {
        const tc = this.resolverTipo(d.tipo, d.linha)
        for (const nome of d.nomes) {
          if (tipo.campos.some((c) => c.n === nome.n)) throw erro(35, d.linha, nome.v)
          tipo.campos.push({ n: nome.n, v: nome.v, tipo: tc })
        }
      }
    }
    for (const c of prog.consts) {
      if (this.globais.has(c.n)) throw erro(35, c.linha, c.v)
      const valor = this.avaliarConstante(c.expr)
      this.globais.set(c.n, { nome: c.v, tipo: { k: valor.t }, valor: valor.v, constante: true })
    }
    this.declarar(this.globais, prog.vars)
    for (const s of prog.subs) {
      if (this.subs.has(s.n)) throw erro(36, s.linha, s.v)
      const vistos = new Set()
      for (const p of s.params) {
        if (vistos.has(p.n)) throw erro(37, s.linha, p.v)
        vistos.add(p.n)
      }
      this.subs.set(s.n, s)
    }
    if (prog.arquivo && this.arquivos) {
      const conteudo = this.arquivos.ler(prog.arquivo.nome)
      this.arquivo = conteudo === null || conteudo === undefined
        ? { nome: prog.arquivo.nome, dados: [], gravando: true }
        : { nome: prog.arquivo.nome, dados: conteudo.replace(/\r\n?/g, '\n').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1), gravando: false }
    }
    this.frames.push({ tipoFrame: 'Corpo Principal do Programa', nome: prog.nome, vars: this.globais, linhaChamada: 0 })
  }

  declarar(mapa, decls) {
    for (const d of decls) {
      const tipo = this.resolverTipo(d.tipo, d.linha)
      for (const nome of d.nomes) {
        if (mapa.has(nome.n)) throw erro(35, d.linha, nome.v)
        mapa.set(nome.n, { nome: nome.v, tipo, valor: this.valorInicial(tipo) })
      }
    }
  }

  avaliarConstante(expr) {
    const gen = this.avaliar(expr)
    const r = gen.next()
    if (!r.done) throw erro(28, expr.linha)
    return r.value
  }

  resolverTipo(t, linha) {
    if (t.k === 'basico') return { k: CODIGO_BASICO[t.nome] }
    if (t.k === 'nome') {
      const reg = this.registros.get(t.n)
      if (!reg) throw erro(40, t.linha ?? linha, t.v)
      return reg
    }
    const dims = t.dims.map(([lo, hi]) => {
      const a = this.avaliarConstante(lo)
      const b = this.avaliarConstante(hi)
      if (a.t !== 'I' || b.t !== 'I' || b.v < a.v) throw erro(42, linha)
      return { lo: a.v, hi: b.v }
    })
    const total = dims.reduce((n, d) => n * (d.hi - d.lo + 1), 1)
    return { k: 'V', dims, elem: this.resolverTipo(t.elem, linha), total }
  }

  valorInicial(tipo) {
    switch (tipo.k) {
      case 'I':
      case 'R': return 0
      case 'C': return ''
      case 'L': return false
      case 'V': return { dados: Array.from({ length: tipo.total }, () => this.valorInicial(tipo.elem)) }
      case 'G': return { campos: Object.fromEntries(tipo.campos.map((c) => [c.n, this.valorInicial(c.tipo)])) }
      default: return null
    }
  }

  copiar(valor, tipo) {
    if (tipo.k === 'V') return { dados: valor.dados.map((x) => this.copiar(x, tipo.elem)) }
    if (tipo.k === 'G') {
      return { campos: Object.fromEntries(tipo.campos.map((c) => [c.n, this.copiar(valor.campos[c.n], c.tipo)])) }
    }
    return valor
  }

  /** Converte um valor tipado para guardar numa variável do tipo `destino`. */
  converter(destino, valor, nomeAlvo, linha) {
    switch (destino.k) {
      case 'I':
        if (valor.t === 'I') return valor.v
        if (valor.t === 'R') return Math.trunc(valor.v)
        break
      case 'R':
        if (ehNumero(valor)) return valor.v
        break
      case 'C':
      case 'L':
        if (valor.t === destino.k) return valor.v
        break
      case 'V':
        if (valor.t === 'V' && valor.tipo.total === destino.total && valor.tipo.elem.k === destino.elem.k) {
          return this.copiar(valor.v, destino)
        }
        break
      case 'G':
        if (valor.t === 'G' && valor.tipo === destino) return this.copiar(valor.v, destino)
        break
    }
    throw erro(27, linha, nomeAlvo)
  }

  // ---- nomes e referências -------------------------------------------------

  get frame() { return this.frames[this.frames.length - 1] }

  procurar(n) {
    return this.frame?.vars.get(n) ?? this.globais.get(n)
  }

  refDeSlot(slot) {
    if (slot.ref) return slot.ref
    return {
      tipo: slot.tipo,
      nome: slot.nome,
      get: () => slot.valor,
      set: (x) => { slot.valor = x },
    }
  }

  /** Referência (lado esquerdo) para id, v[i,j] ou reg.campo. */
  * ref(no) {
    switch (no.e) {
      case 'id': {
        const slot = this.procurar(no.n)
        if (!slot) throw erro(11, no.linha, no.v)
        if (slot.constante) throw erro(33, no.linha)
        return this.refDeSlot(slot)
      }
      case 'idx': {
        const base = yield* this.ref(no.base)
        if (base.tipo.k !== 'V') throw erro(28, no.linha)
        const { dims, elem } = base.tipo
        if (no.indices.length !== dims.length) throw erro(28, no.linha)
        let offset = 0
        const usados = []
        for (let i = 0; i < dims.length; i += 1) {
          const v = yield* this.avaliar(no.indices[i])
          if (v.t !== 'I') throw erro(43, no.linha)
          const { lo, hi } = dims[i]
          if (v.v < lo || v.v > hi) throw erro(100, no.linha, base.nome)
          offset = offset * (hi - lo + 1) + (v.v - lo)
          usados.push(v.v)
        }
        const dados = base.get().dados
        return {
          tipo: elem,
          nome: `${base.nome}[${usados.join(',')}]`,
          get: () => dados[offset],
          set: (x) => { dados[offset] = x },
        }
      }
      case 'campo': {
        const base = yield* this.ref(no.base)
        if (base.tipo.k !== 'G') throw erro(12, no.linha, no.v)
        const campo = base.tipo.campos.find((c) => c.n === no.n)
        if (!campo) throw erro(12, no.linha, no.v)
        const obj = base.get().campos
        return {
          tipo: campo.tipo,
          nome: `${base.nome}.${campo.v}`,
          get: () => obj[campo.n],
          set: (x) => { obj[campo.n] = x },
        }
      }
      default:
        throw erro(33, no.linha)
    }
  }

  lerRef(r) {
    return { t: r.tipo.k, v: r.get(), tipo: r.tipo }
  }

  // ---- expressões ----------------------------------------------------------

  * avaliar(no) {
    switch (no.e) {
      case 'num': return { t: no.t, v: no.v }
      case 'str': return { t: 'C', v: no.v }
      case 'log': return { t: 'L', v: no.v }
      case 'id': {
        const slot = this.procurar(no.n)
        if (slot) {
          if (slot.ref) return this.lerRef(slot.ref)
          return { t: slot.tipo.k, v: slot.valor, tipo: slot.tipo }
        }
        const sub = this.subs.get(no.n)
        if (sub) {
          if (sub.tipo !== 'funcao') throw erro(28, no.linha)
          return yield* this.chamar(sub, [], no)
        }
        const embutida = FUNCOES_EMBUTIDAS[no.n]
        if (embutida) {
          if (embutida.aridade !== 0) throw erro(23, no.linha)
          return embutida.fn([], { linha: no.linha, rng: this.rng })
        }
        throw erro(11, no.linha, no.v)
      }
      case 'call': {
        const sub = this.subs.get(no.n)
        if (sub) {
          if (sub.tipo !== 'funcao') throw erro(28, no.linha)
          return yield* this.chamar(sub, no.args, no)
        }
        const embutida = FUNCOES_EMBUTIDAS[no.n]
        if (embutida) {
          if (no.args.length !== embutida.aridade) throw erro(102, no.linha, no.v)
          const args = []
          for (const a of no.args) args.push(yield* this.avaliar(a))
          return embutida.fn(args, { linha: no.linha, rng: this.rng })
        }
        if (this.procurar(no.n)) throw erro(44, no.linha)
        throw erro(101, no.linha, no.v)
      }
      case 'idx':
      case 'campo':
        return this.lerRef(yield* this.ref(no))
      case 'un': {
        const a = yield* this.avaliar(no.a)
        if (no.op === 'NAO') {
          if (a.t !== 'L') throw erro(47, no.linha, 'LOGICO')
          return { t: 'L', v: !a.v }
        }
        if (!ehNumero(a)) throw erro(47, no.linha, 'INTEIRO ou REAL')
        return { t: a.t, v: no.op === '-' ? -a.v : a.v }
      }
      case 'bin':
        return yield* this.binario(no)
      default:
        throw erro(28, no.linha)
    }
  }

  * binario(no) {
    const { op, linha } = no
    if (op === 'E' || op === 'OU') {
      const a = yield* this.avaliar(no.a)
      if (a.t !== 'L') throw erro(47, linha, 'LOGICO')
      if (op === 'E' && !a.v) return { t: 'L', v: false }
      if (op === 'OU' && a.v) return { t: 'L', v: true }
      const b = yield* this.avaliar(no.b)
      if (b.t !== 'L') throw erro(47, linha, 'LOGICO')
      return { t: 'L', v: b.v }
    }
    const a = yield* this.avaliar(no.a)
    const b = yield* this.avaliar(no.b)
    switch (op) {
      case 'XOU':
        if (a.t !== 'L' || b.t !== 'L') throw erro(47, linha, 'LOGICO')
        return { t: 'L', v: a.v !== b.v }
      case '=': return { t: 'L', v: comparar(a, b, linha) === 0 }
      case '<>': return { t: 'L', v: comparar(a, b, linha) !== 0 }
      case '<': return { t: 'L', v: comparar(a, b, linha) < 0 }
      case '>': return { t: 'L', v: comparar(a, b, linha) > 0 }
      case '<=': return { t: 'L', v: comparar(a, b, linha) <= 0 }
      case '>=': return { t: 'L', v: comparar(a, b, linha) >= 0 }
    }
    if (op === '+' && a.t === 'C' && b.t === 'C') return { t: 'C', v: a.v + b.v }
    if (!ehNumero(a) || !ehNumero(b)) throw erro(47, linha, a.t === 'C' || b.t === 'C' ? 'CARACTER' : 'INTEIRO ou REAL')
    const inteiros = a.t === 'I' && b.t === 'I'
    switch (op) {
      case '+': return { t: inteiros ? 'I' : 'R', v: a.v + b.v }
      case '-': return { t: inteiros ? 'I' : 'R', v: a.v - b.v }
      case '*': return { t: inteiros ? 'I' : 'R', v: a.v * b.v }
      case '/':
        if (b.v === 0) throw erro(52, linha, '/')
        return { t: 'R', v: a.v / b.v }
      case '\\': {
        const d = Math.trunc(b.v)
        if (d === 0) throw erro(52, linha, 'DIV')
        return { t: 'I', v: Math.trunc(Math.trunc(a.v) / d) }
      }
      case '%': {
        const d = Math.trunc(b.v)
        if (d === 0) throw erro(52, linha, 'MOD')
        return { t: 'I', v: Math.trunc(a.v) % d }
      }
      case '^': {
        if ((a.v < 0 && !Number.isInteger(b.v)) || (a.v === 0 && b.v < 0)) throw erro(52, linha, '^')
        return { t: inteiros && b.v >= 0 ? 'I' : 'R', v: a.v ** b.v }
      }
    }
    throw erro(25, linha, op)
  }

  * condicao(expr) {
    const v = yield* this.avaliar(expr)
    if (v.t !== 'L') throw erro(47, expr.linha, 'LOGICO')
    return v.v
  }

  * inteiroDe(expr) {
    const v = yield* this.avaliar(expr)
    if (!ehNumero(v)) throw erro(47, expr.linha, 'INTEIRO')
    return Math.trunc(v.v)
  }

  // ---- subprogramas --------------------------------------------------------

  * chamar(sub, args, no) {
    if (args.length !== sub.params.length) throw erro(102, no.linha, sub.v)
    if (this.frames.length >= LIMITE_PILHA) throw erro(103, no.linha)
    const vars = new Map()
    for (let i = 0; i < sub.params.length; i += 1) {
      const p = sub.params[i]
      const tipo = this.resolverTipo(p.tipo, sub.linha)
      if (p.porRef) {
        const arg = args[i]
        if (!['id', 'idx', 'campo'].includes(arg.e)) throw erro(50, no.linha)
        const ref = yield* this.ref(arg)
        vars.set(p.n, { nome: p.v, tipo, ref })
      } else {
        const valor = yield* this.avaliar(args[i])
        vars.set(p.n, { nome: p.v, tipo, valor: this.converter(tipo, valor, p.v, no.linha) })
      }
    }
    this.declarar(vars, sub.vars)

    this.frames.push({
      tipoFrame: sub.tipo === 'funcao' ? 'Funcao' : 'Procedimento',
      nome: sub.v,
      sub,
      vars,
      linhaChamada: no.linha,
    })
    let r
    try {
      r = yield* this.bloco(sub.corpo)
      yield* this.passo(sub.linhaFim)
    } finally {
      this.frames.pop()
    }
    if (sub.tipo !== 'funcao') return { t: 'L', v: false }
    const tipoRet = this.resolverTipo(sub.retorno, sub.linha)
    if (r instanceof Retorno && r.valor) {
      return { t: tipoRet.k, v: this.converter(tipoRet, r.valor, sub.v, no.linha), tipo: tipoRet }
    }
    return { t: tipoRet.k, v: this.valorInicial(tipoRet), tipo: tipoRet }
  }

  // ---- comandos ------------------------------------------------------------

  * executar() {
    const r = yield* this.bloco(this.prog.corpo)
    if (r === INTERROMPA || r instanceof Retorno || r === undefined) yield* this.passo(this.prog.linhaFim)
  }

  * passo(linha) {
    this.linhaAtual = linha
    this.perfil.set(linha, (this.perfil.get(linha) ?? 0) + 1)
    yield { tipo: 'linha', linha }
  }

  * bloco(comandos) {
    for (const c of comandos) {
      const r = yield* this.comando(c)
      if (r !== undefined) return r
    }
    return undefined
  }

  * comando(c) {
    yield* this.passo(c.linha)
    switch (c.s) {
      case 'atrib': {
        const alvo = yield* this.ref(c.alvo)
        const valor = yield* this.avaliar(c.expr)
        alvo.set(this.converter(alvo.tipo, valor, alvo.nome.toUpperCase(), c.linha))
        return undefined
      }
      case 'escreva': {
        let texto = ''
        for (const item of c.itens) {
          const valor = yield* this.avaliar(item.expr)
          if (valor.t === 'V' || valor.t === 'G') throw erro(47, c.linha, 'INTEIRO, REAL, LOGICO ou CARACTER')
          const largura = item.largura ? yield* this.inteiroDe(item.largura) : undefined
          const decimais = item.decimais ? yield* this.inteiroDe(item.decimais) : undefined
          texto += formatarSaida(valor, largura, decimais)
        }
        if (c.novaLinha) texto += '\n'
        if (texto) this.io.saida(texto)
        return undefined
      }
      case 'leia': {
        if (c.mensagem) this.io.saida(c.mensagem.v)
        for (const alvo of c.alvos) {
          const r = yield* this.ref(alvo)
          yield* this.ler(r, c.linha)
        }
        return undefined
      }
      case 'se': {
        const cond = yield* this.condicao(c.cond)
        if (cond) return yield* this.bloco(c.entao)
        if (c.senao) {
          yield* this.passo(c.linhaSenao)
          return yield* this.bloco(c.senao)
        }
        return undefined
      }
      case 'escolha': {
        const v = yield* this.avaliar(c.expr)
        for (const caso of c.casos) {
          for (const item of caso.itens) {
            const a = yield* this.avaliar(item.a)
            let casa
            if (item.b) {
              const b = yield* this.avaliar(item.b)
              casa = comparar(v, a, c.linha) >= 0 && comparar(v, b, c.linha) <= 0
            } else {
              casa = comparar(v, a, c.linha) === 0
            }
            if (casa) return yield* this.bloco(caso.corpo)
          }
        }
        if (c.outro) return yield* this.bloco(c.outro)
        return undefined
      }
      case 'para': return yield* this.para(c)
      case 'enquanto': {
        for (let primeira = true; ; primeira = false) {
          if (!primeira) yield* this.passo(c.linha)
          if (!(yield* this.condicao(c.cond))) return undefined
          const r = yield* this.bloco(c.corpo)
          if (r === INTERROMPA) return undefined
          if (r !== undefined) return r
          yield* this.passo(c.linhaFim)
        }
      }
      case 'repita': {
        for (;;) {
          const r = yield* this.bloco(c.corpo)
          if (r === INTERROMPA) return undefined
          if (r !== undefined) return r
          yield* this.passo(c.linhaFim)
          if (c.cond && (yield* this.condicao(c.cond))) return undefined
        }
      }
      case 'interrompa': return INTERROMPA
      case 'retorne': {
        if (this.frames.length === 1) throw erro(10, c.linha, 'RETORNE')
        return new Retorno(c.expr ? yield* this.avaliar(c.expr) : null)
      }
      case 'chamada': {
        const sub = this.subs.get(c.n)
        if (sub) {
          yield* this.chamar(sub, c.args, c)
          return undefined
        }
        const embutida = FUNCOES_EMBUTIDAS[c.n]
        if (embutida) {
          yield* this.avaliar({ e: 'call', n: c.n, v: c.v, args: c.args, linha: c.linha })
          return undefined
        }
        if (this.procurar(c.n)) throw erro(28, c.linha)
        throw erro(101, c.linha, c.v)
      }
      case 'aleatorio': {
        if (!c.ligar) {
          this.aleatorio.ligado = false
          return undefined
        }
        const valores = []
        for (const v of c.valores) {
          const n = yield* this.avaliar(v)
          if (!ehNumero(n)) throw erro(47, c.linha, 'INTEIRO ou REAL')
          valores.push(n.v)
        }
        let [min, max] = valores.length === 0 ? [0, 100] : valores.length === 1 ? [0, valores[0]] : [valores[0], valores[1]]
        if (max < min) [min, max] = [max, min]
        this.aleatorio = { ligado: true, min, max, casas: valores[2] }
        return undefined
      }
      case 'timer': {
        if (!c.ligar) this.timerMs = null
        else {
          const ms = c.ms ? Math.min(10000, Math.max(0, yield* this.inteiroDe(c.ms))) : 500
          this.timerMs = ms > 0 ? ms : null
        }
        return undefined
      }
      case 'eco':
        this.eco = c.ligar
        return undefined
      case 'cronometro': {
        if (c.ligar) {
          this.cronometro = this.relogio.agora()
          this.io.saida(TEXTOS.cronoIniciado + '\n')
        } else if (this.cronometro === null) {
          this.io.saida(TEXTOS.cronoNaoIniciado + '\n')
        } else {
          const total = Math.max(0, Math.round(this.relogio.agora() - this.cronometro))
          const s = Math.floor(total / 1000)
          const ms = total % 1000
          let tempo
          if (s === 0) tempo = `${ms} ms.`
          else if (ms === 0) tempo = `${s} segundo(s).`
          else tempo = `${s} segundo(s) e ${ms} ms.`
          this.io.saida(TEXTOS.cronoTerminado + tempo + '\n')
          this.cronometro = null
        }
        return undefined
      }
      case 'pausa':
        yield { tipo: 'pausa', linha: c.linha }
        return undefined
      case 'debug':
        if (yield* this.condicao(c.expr)) yield { tipo: 'pausa', linha: c.linha }
        return undefined
      case 'limpatela':
        this.io.limpar()
        return undefined
      case 'mudacor': {
        const cor = yield* this.avaliar(c.cor)
        const posicao = yield* this.avaliar(c.posicao)
        const nomeCor = cor.t === 'C' ? maiusculaAscii(cor.v.trim()) : ''
        const nomePos = posicao.t === 'C' ? maiusculaAscii(posicao.v.trim()) : ''
        if (!CORES.has(nomeCor) || !POSICOES.has(nomePos)) throw erro(51, c.linha, 'MUDACOR')
        this.io.cor(nomeCor, nomePos === 'FRENTE' ? 'FRENTE' : 'FUNDOS')
        return undefined
      }
      case 'perfil':
        this.pedirPerfil = true
        return undefined
      case 'lista': {
        const nome = normalizar(c.nome.replace(/^"|"$/g, '').trim())
        if (!nome) {
          this.listaAtiva = null
          return undefined
        }
        if (!this.listas.has(nome) || !this.listas.get(nome).length) throw erro(104, c.linha, c.nome)
        this.listaAtiva = this.listas.get(nome)
        return undefined
      }
      case 'mensagem': {
        const v = yield* this.avaliar(c.expr)
        this.io.saida(textoValor(v) + '\n')
        return undefined
      }
      default:
        throw erro(28, c.linha)
    }
  }

  * para(c) {
    const ctrl = yield* this.ref(c.variavel)
    if (ctrl.tipo.k !== 'I' && ctrl.tipo.k !== 'R') {
      throw erro(34, c.linha, 'INTEIRO (como variável de controle do PARA...FAÇA)')
    }
    const inicio = yield* this.avaliar(c.inicio)
    const fim = yield* this.avaliar(c.fim)
    const passo = c.passo ? yield* this.avaliar(c.passo) : { t: 'I', v: 1 }
    for (const v of [inicio, fim, passo]) if (!ehNumero(v)) throw erro(47, c.linha, 'INTEIRO')
    if (passo.v === 0) throw erro(31, c.linha)

    ctrl.set(this.converter(ctrl.tipo, inicio, ctrl.nome, c.linha))
    for (;;) {
      const atual = ctrl.get()
      if (passo.v > 0 ? atual > fim.v : atual < fim.v) return undefined
      const r = yield* this.bloco(c.corpo)
      if (r === INTERROMPA) return undefined
      if (r !== undefined) return r
      yield* this.passo(c.linhaFim)
      ctrl.set(this.converter(ctrl.tipo, { t: ctrl.tipo.k, v: ctrl.get() + passo.v }, ctrl.nome, c.linha))
    }
  }

  // ---- leitura -------------------------------------------------------------

  gerarAleatorio(tipo) {
    const { min, max, casas } = this.aleatorio
    if (tipo === 'C') {
      if (this.listaAtiva) return this.listaAtiva[Math.floor(this.rng() * this.listaAtiva.length)]
      let s = ''
      for (let i = 0; i < 5; i += 1) s += String.fromCharCode(65 + Math.floor(this.rng() * 26))
      return s
    }
    if (tipo === 'I') return String(Math.floor(this.rng() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min))
    const x = min + this.rng() * (max - min)
    return x.toFixed(Math.max(0, Math.min(10, casas ?? 0)))
  }

  * ler(ref, linha) {
    const tipo = ref.tipo.k
    if (tipo === 'V' || tipo === 'G') throw erro(33, linha)
    let bruto
    if (this.arquivo && !this.arquivo.gravando && this.arquivo.dados.length > 0) {
      bruto = this.arquivo.dados.shift()
    } else if (this.aleatorio.ligado && tipo !== 'L') {
      bruto = this.gerarAleatorio(tipo)
    } else {
      bruto = yield { tipo: 'leia', descricao: ref.nome, tipoVariavel: tipo }
      if (bruto === null || bruto === undefined) throw new Parada()
      bruto = String(bruto)
      if (this.arquivo?.gravando) this.arquivos.anexar(this.arquivo.nome, bruto)
    }
    if (this.eco) this.io.saida(bruto + '\n')

    switch (tipo) {
      case 'I': {
        const n = textoParaNumero(bruto, linha)
        if (n.t !== 'I') throw erro(49, linha, bruto)
        ref.set(n.v)
        break
      }
      case 'R':
        ref.set(textoParaNumero(bruto, linha).v)
        break
      case 'C':
        ref.set(bruto)
        break
      case 'L':
        ref.set(/^\s*(V|VERDADEIRO)\s*$/i.test(bruto))
        break
    }
  }

  // ---- inspeção (grade de variáveis, pilha, perfil) -------------------------

  linhasDe(escopo, nome, tipo, valor, saida) {
    if (saida.length > 5000) return
    if (tipo.k === 'V') {
      const { dims } = tipo
      const indices = dims.map((d) => d.lo)
      for (let i = 0; i < tipo.total; i += 1) {
        this.linhasDe(escopo, `${nome}[${indices.join(',')}]`, tipo.elem, valor.dados[i], saida)
        for (let d = dims.length - 1; d >= 0; d -= 1) {
          indices[d] += 1
          if (indices[d] <= dims[d].hi) break
          indices[d] = dims[d].lo
        }
      }
      return
    }
    if (tipo.k === 'G') {
      for (const c of tipo.campos) this.linhasDe(escopo, `${nome}.${c.v}`, c.tipo, valor.campos[c.n], saida)
      return
    }
    saida.push({ escopo, nome: nome.toUpperCase(), tipo: tipo.k, valor: textoGrade({ t: tipo.k, v: valor }) })
  }

  /** Quadro de variáveis: globais e locais do subprograma em execução. */
  quadro() {
    const globais = []
    for (const slot of this.globais.values()) {
      if (slot.constante) continue
      this.linhasDe('GLOBAL', slot.nome, slot.tipo, slot.valor, globais)
    }
    const locais = []
    const f = this.frame
    if (f && f.vars !== this.globais) {
      for (const slot of f.vars.values()) {
        const valor = slot.ref ? slot.ref.get() : slot.valor
        this.linhasDe(f.nome.toUpperCase(), slot.nome, slot.tipo, valor, locais)
      }
    }
    return { globais, locais }
  }

  pilha() {
    const nomeTipo = (t) => (t.k === 'basico' ? t.nome : t.k === 'nome' ? t.v.toUpperCase() : 'VETOR')
    return this.frames.map((f) => ({
      tipo: f.tipoFrame,
      nome: f.nome,
      linhaChamada: f.linhaChamada,
      assinatura: f.sub ? f.sub.params.map((p) => `${p.porRef ? 'var ' : ''}${p.v} : ${nomeTipo(p.tipo)}`).join(' , ') : '',
    })).reverse()
  }

  relatorioPerfil() {
    return [...this.perfil.entries()].sort((a, b) => a[0] - b[0]).map(([linha, vezes]) => ({ linha, vezes }))
  }
}
