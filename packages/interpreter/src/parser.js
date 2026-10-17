// Parser de descida recursiva: tokens → AST (gramática de
// docs/spec/_sintese-A-linguagem.md §1.4). Um comando por linha.

import { erro } from './erros.js'
import { tokenizar } from './lexer.js'
import { PALAVRAS_CHAVE, TIPOS_BASICOS } from './palavras.js'

const SECOES = new Set(['CONST', 'TIPO', 'VAR', 'PROCEDIMENTO', 'FUNCAO', 'INICIO', 'DOS', 'ARQUIVO', 'FIMALGORITMO', 'ALGORITMO'])
const FINAIS = new Set([
  'FIMSE', 'SENAO', 'FIMPARA', 'FIMENQUANTO', 'ATE', 'FIMREPITA', 'CASO', 'OUTROCASO',
  'FIMESCOLHA', 'FIMALGORITMO', 'FIMPROCEDIMENTO', 'FIMFUNCAO',
])
const ORFAOS = { FIMPARA: 16, FIMSE: 17, SENAO: 18, FIMENQUANTO: 19, ATE: 20 }
const RELACIONAIS = new Set(['=', '<>', '<', '>', '<=', '>='])

/** Analisa o programa inteiro. Lança ErroVisualg com a linha do problema. */
export function analisar(fonte) {
  return new Parser(tokenizar(fonte)).programa()
}

class Parser {
  constructor(tokens) {
    this.t = tokens
    this.i = 0
  }

  // ---- utilitários -------------------------------------------------------

  get tok() { return this.t[this.i] }
  olhar(n = 1) { return this.t[Math.min(this.i + n, this.t.length - 1)] }
  avancar() { return this.t[this.i++] }
  ehPalavra(n, tok = this.tok) { return tok.k === 'ID' && tok.n === n }
  ehOp(v, tok = this.tok) { return tok.k === 'OP' && tok.v === v }
  fimDeLinha(tok = this.tok) { return tok.k === 'NL' || tok.k === 'EOF' }

  pularLinhas() {
    while (this.tok.k === 'NL') this.i += 1
  }

  aceitarPalavra(n) {
    if (!this.ehPalavra(n)) return false
    this.i += 1
    return true
  }

  aceitarOp(v) {
    if (!this.ehOp(v)) return false
    this.i += 1
    return true
  }

  exigirPalavra(n, codigo = 30) {
    if (this.aceitarPalavra(n)) return
    throw codigo === 30 ? erro(30, this.tok.linha, n) : erro(codigo, this.tok.linha)
  }

  exigirOp(v, codigo) {
    if (this.aceitarOp(v)) return
    throw erro(codigo, this.tok.linha)
  }

  /** Fim do comando: tolera `;` e exige quebra de linha. */
  fimComando() {
    while (this.aceitarOp(';'));
    if (!this.fimDeLinha()) throw erro(28, this.tok.linha)
    if (this.tok.k === 'NL') this.i += 1
  }

  nome(codigo = 12) {
    const tok = this.tok
    if (tok.k !== 'ID') throw erro(codigo, tok.linha, tok.v)
    if (PALAVRAS_CHAVE.has(tok.n)) throw erro(codigo, tok.linha, tok.v)
    this.i += 1
    return { n: tok.n, v: tok.v }
  }

  // ---- programa e declarações -------------------------------------------

  programa() {
    this.pularLinhas()
    if (!this.ehPalavra('ALGORITMO')) {
      throw erro(this.tok.k === 'ID' && PALAVRAS_CHAVE.has(this.tok.n) ? 1 : 4, this.tok.linha)
    }
    const linha = this.avancar().linha
    let nome = 'semnome'
    if (this.tok.k === 'STR' || this.tok.k === 'ID') nome = this.avancar().v
    this.fimComando()

    const prog = { nome, linha, dos: false, arquivo: null, consts: [], tipos: [], vars: [], subs: [], corpo: [], linhaInicio: 0, linhaFim: 0 }

    for (;;) {
      this.pularLinhas()
      const tok = this.tok
      if (tok.k === 'EOF') throw erro(5, tok.linha)
      if (tok.k !== 'ID') throw erro(28, tok.linha)

      switch (tok.n) {
        case 'DOS':
          this.avancar()
          prog.dos = true
          this.fimComando()
          break
        case 'ARQUIVO':
          this.avancar()
          if (this.tok.k !== 'STR') throw erro(32, tok.linha)
          prog.arquivo = { nome: this.avancar().v, linha: tok.linha }
          this.fimComando()
          break
        case 'CONST':
          this.avancar()
          this.constantes(prog.consts)
          break
        case 'TIPO':
          this.avancar()
          this.tipos(prog.tipos)
          break
        case 'VAR':
          this.avancar()
          prog.vars.push(...this.declaracoes())
          break
        case 'PROCEDIMENTO':
        case 'FUNCAO':
          prog.subs.push(this.subprograma())
          break
        case 'INICIO':
          prog.linhaInicio = this.avancar().linha
          this.fimComando()
          prog.corpo = this.bloco(['FIMALGORITMO'], (l) => erro(6, l))
          prog.linhaFim = this.avancar().linha
          return prog
        case 'FIMALGORITMO':
          throw erro(2, tok.linha)
        case 'ALGORITMO':
          throw erro(7, tok.linha)
        default:
          if (PALAVRAS_CHAVE.has(tok.n)) throw erro(10, tok.linha, tok.v.toUpperCase())
          throw erro(42, tok.linha)
      }
    }
  }

  constantes(lista) {
    for (;;) {
      this.pularLinhas()
      if (this.tok.k !== 'ID' || SECOES.has(this.tok.n)) return
      const linha = this.tok.linha
      const nome = this.nome()
      if (!this.aceitarOp('=') && !this.aceitarOp('<-') && !this.aceitarOp(':=')) throw erro(42, linha)
      lista.push({ ...nome, expr: this.expressao(), linha })
      this.fimComando()
    }
  }

  tipos(lista) {
    for (;;) {
      this.pularLinhas()
      if (this.tok.k !== 'ID' || SECOES.has(this.tok.n)) return
      const linha = this.tok.linha
      const nome = this.nome()
      this.exigirOp('=', 42)
      this.exigirPalavra('REGISTRO')
      this.fimComando()
      const campos = this.declaracoes(['FIMREGISTRO'])
      this.exigirPalavra('FIMREGISTRO')
      this.fimComando()
      lista.push({ ...nome, campos, linha })
    }
  }

  /** Linhas `a, b: tipo` até a próxima seção (ou até uma das palavras `fim`). */
  declaracoes(fim = []) {
    const decls = []
    for (;;) {
      this.pularLinhas()
      const tok = this.tok
      if (tok.k === 'EOF') return decls
      if (tok.k === 'ID' && (SECOES.has(tok.n) || fim.includes(tok.n))) return decls
      decls.push(this.declaracao())
      while (this.aceitarOp(';')) {
        if (this.fimDeLinha()) break
        decls.push(this.declaracao())
      }
      this.fimComando()
    }
  }

  declaracao() {
    const linha = this.tok.linha
    const nomes = [this.nome()]
    while (this.aceitarOp(',')) nomes.push(this.nome())
    if (!this.aceitarOp(':')) throw erro(42, linha)
    return { nomes, tipo: this.tipo(), linha }
  }

  tipo() {
    const tok = this.tok
    if (tok.k !== 'ID') throw erro(41, tok.linha)
    this.avancar()
    if (TIPOS_BASICOS.has(tok.n)) return { k: 'basico', nome: tok.n }
    if (tok.n === 'VETOR') {
      this.exigirOp('[', 44)
      const dims = []
      do {
        const lo = this.limite()
        if (!this.aceitarOp('..')) throw erro(30, this.tok.linha, "'..'")
        dims.push([lo, this.limite()])
      } while (this.aceitarOp(','))
      this.exigirOp(']', 45)
      this.exigirPalavra('DE')
      return { k: 'vetor', dims, elem: this.tipo() }
    }
    if (PALAVRAS_CHAVE.has(tok.n)) throw erro(41, tok.linha)
    return { k: 'nome', n: tok.n, v: tok.v, linha: tok.linha }
  }

  limite() {
    const linha = this.tok.linha
    let sinal = 1
    if (this.aceitarOp('-')) sinal = -1
    else this.aceitarOp('+')
    const tok = this.avancar()
    if (tok.k === 'NUM' && tok.t === 'I') return { e: 'num', t: 'I', v: sinal * tok.valor, linha }
    if (tok.k === 'ID' && !PALAVRAS_CHAVE.has(tok.n)) {
      const id = { e: 'id', n: tok.n, v: tok.v, linha }
      return sinal < 0 ? { e: 'un', op: '-', a: id, linha } : id
    }
    throw erro(42, linha)
  }

  subprograma() {
    const tokTipo = this.avancar()
    const ehFuncao = tokTipo.n === 'FUNCAO'
    const linha = tokTipo.linha
    const nome = this.nome(13)
    const params = []
    if (this.aceitarOp('(')) {
      if (!this.aceitarOp(')')) {
        do {
          const porRef = this.aceitarPalavra('VAR')
          const nomes = [this.nome()]
          while (this.aceitarOp(',')) nomes.push(this.nome())
          if (!this.aceitarOp(':')) throw erro(42, this.tok.linha)
          const tipo = this.tipo()
          for (const n of nomes) params.push({ ...n, porRef, tipo })
        } while (this.aceitarOp(';') || this.aceitarOp(','))
        this.exigirOp(')', 24)
      }
    }
    let retorno = null
    if (ehFuncao) {
      if (!this.aceitarOp(':')) throw erro(30, this.tok.linha, "':'")
      retorno = this.tipo()
    }
    this.fimComando()

    const vars = []
    for (;;) {
      this.pularLinhas()
      if (this.aceitarPalavra('VAR')) {
        vars.push(...this.declaracoes())
        continue
      }
      if (this.ehPalavra('INICIO')) break
      throw erro(5, this.tok.linha)
    }
    this.avancar()
    this.fimComando()

    const final = ehFuncao ? 'FIMFUNCAO' : 'FIMPROCEDIMENTO'
    const corpo = this.bloco([final], (l) => erro(30, l, final))
    const linhaFim = this.avancar().linha
    this.fimComando()
    return { tipo: ehFuncao ? 'funcao' : 'procedimento', ...nome, params, retorno, vars, corpo, linha, linhaFim }
  }

  // ---- comandos ------------------------------------------------------------

  /** Comandos até uma das palavras `finais` (não as consome). */
  bloco(finais, faltando) {
    const corpo = []
    for (;;) {
      this.pularLinhas()
      const tok = this.tok
      if (tok.k === 'EOF') throw faltando(tok.linha)
      if (tok.k === 'ID' && FINAIS.has(tok.n)) {
        if (finais.includes(tok.n)) return corpo
        if (finais.includes('FIMALGORITMO')) throw erro(ORFAOS[tok.n] ?? 28, tok.linha)
        throw faltando(tok.linha)
      }
      corpo.push(this.comando())
    }
  }

  comando() {
    const tok = this.tok
    const linha = tok.linha
    if (tok.k !== 'ID') throw erro(28, linha)

    switch (tok.n) {
      case 'SE': return this.cmdSe()
      case 'ESCOLHA': return this.cmdEscolha()
      case 'PARA': return this.cmdPara()
      case 'ENQUANTO': return this.cmdEnquanto()
      case 'REPITA': return this.cmdRepita()
      case 'ESCREVA':
      case 'ESCREVAL': return this.cmdEscreva()
      case 'LEIA': return this.cmdLeia()
      case 'INTERROMPA':
        this.avancar()
        this.fimComando()
        return { s: 'interrompa', linha }
      case 'RETORNE': {
        this.avancar()
        const expr = this.fimDeLinha() ? null : this.expressao()
        this.fimComando()
        return { s: 'retorne', expr, linha }
      }
      case 'ALEATORIO': return this.cmdAleatorio()
      case 'TIMER': {
        this.avancar()
        let cmd
        if (this.aceitarPalavra('ON')) cmd = { s: 'timer', ligar: true, ms: null, linha }
        else if (this.aceitarPalavra('OFF')) cmd = { s: 'timer', ligar: false, linha }
        else cmd = { s: 'timer', ligar: true, ms: this.expressao(), linha }
        this.fimComando()
        return cmd
      }
      case 'ECO':
      case 'CRONOMETRO': {
        this.avancar()
        let ligar
        if (this.aceitarPalavra('ON')) ligar = true
        else if (this.aceitarPalavra('OFF')) ligar = false
        else throw erro(30, this.tok.linha, 'ON ou OFF')
        this.fimComando()
        return { s: tok.n === 'ECO' ? 'eco' : 'cronometro', ligar, linha }
      }
      case 'PAUSA':
      case 'LIMPATELA':
      case 'PERFIL':
        this.avancar()
        this.fimComando()
        return { s: tok.n.toLowerCase(), linha }
      case 'DEBUG':
      case 'MENSAGEM': {
        this.avancar()
        const expr = this.expressao()
        this.fimComando()
        return { s: tok.n.toLowerCase(), expr, linha }
      }
      case 'MUDACOR': {
        this.avancar()
        this.exigirOp('(', 23)
        const cor = this.expressao()
        if (!this.aceitarOp(',')) throw erro(15, this.tok.linha)
        const posicao = this.expressao()
        this.exigirOp(')', 24)
        this.fimComando()
        return { s: 'mudacor', cor, posicao, linha }
      }
      case 'LISTA': {
        this.avancar()
        const partes = []
        while (!this.fimDeLinha()) partes.push(this.avancar().v)
        this.fimComando()
        return { s: 'lista', nome: partes.join(' '), linha }
      }
      case 'DOS':
      case 'ARQUIVO':
        throw erro(8, linha, `Comando '${tok.n}'`)
      default:
        if (PALAVRAS_CHAVE.has(tok.n)) throw erro(28, linha)
        return this.cmdAtribuicaoOuChamada()
    }
  }

  cmdAtribuicaoOuChamada() {
    const linha = this.tok.linha
    const alvo = this.posfixo()
    if (this.aceitarOp('<-') || this.aceitarOp(':=')) {
      if (alvo.e === 'call') throw erro(33, linha)
      const expr = this.expressao()
      this.fimComando()
      return { s: 'atrib', alvo, expr, linha }
    }
    if (this.ehOp('=')) throw erro(28, linha)
    if (alvo.e === 'id') {
      this.fimComando()
      return { s: 'chamada', n: alvo.n, v: alvo.v, args: [], linha }
    }
    if (alvo.e === 'call') {
      this.fimComando()
      return { s: 'chamada', n: alvo.n, v: alvo.v, args: alvo.args, linha }
    }
    throw erro(28, linha)
  }

  /** Comandos que podem vir na mesma linha de `entao`/`senao` (tolerância). */
  blocoAposPalavra(finais, faltando) {
    const primeiros = []
    while (this.aceitarOp(';'));
    if (!this.fimDeLinha()) primeiros.push(this.comando())
    else this.fimComando()
    return [...primeiros, ...this.bloco(finais, faltando)]
  }

  cmdSe() {
    const linha = this.avancar().linha
    const cond = this.expressao()
    if (!this.ehPalavra('ENTAO')) {
      const volta = this.i
      this.pularLinhas()
      if (!this.ehPalavra('ENTAO')) {
        this.i = volta
        throw erro(46, linha)
      }
    }
    this.avancar()
    const faltaFimse = (l) => erro(21, l)
    const entao = this.blocoAposPalavra(['SENAO', 'FIMSE'], faltaFimse)
    let senao = null
    let linhaSenao = 0
    if (this.ehPalavra('SENAO')) {
      linhaSenao = this.avancar().linha
      senao = this.blocoAposPalavra(['FIMSE'], faltaFimse)
    }
    const linhaFim = this.avancar().linha
    this.fimComando()
    return { s: 'se', cond, entao, senao, linha, linhaSenao, linhaFim }
  }

  cmdEscolha() {
    const linha = this.avancar().linha
    const expr = this.expressao()
    this.aceitarPalavra('FACA')
    this.fimComando()
    const falta = (l) => erro(30, l, 'FIMESCOLHA')
    const casos = []
    let outro = null
    for (;;) {
      this.pularLinhas()
      const tok = this.tok
      if (tok.k === 'EOF') throw falta(tok.linha)
      if (this.aceitarPalavra('CASO')) {
        const itens = []
        do {
          const a = this.expressao()
          let b = null
          if (this.aceitarPalavra('ATE') || this.aceitarOp('..')) b = this.expressao()
          itens.push({ a, b })
        } while (this.aceitarOp(','))
        this.fimComando()
        casos.push({ itens, corpo: this.bloco(['CASO', 'OUTROCASO', 'FIMESCOLHA'], falta), linha: tok.linha })
      } else if (this.aceitarPalavra('OUTROCASO')) {
        this.fimComando()
        outro = this.bloco(['FIMESCOLHA'], falta)
      } else if (this.aceitarPalavra('FIMESCOLHA')) {
        this.fimComando()
        return { s: 'escolha', expr, casos, outro, linha }
      } else {
        throw erro(30, tok.linha, 'CASO')
      }
    }
  }

  cmdPara() {
    const linha = this.avancar().linha
    const tokVar = this.tok
    if (tokVar.k !== 'ID' || PALAVRAS_CHAVE.has(tokVar.n)) throw erro(33, linha)
    this.avancar()
    const variavel = { e: 'id', n: tokVar.n, v: tokVar.v, linha }
    if (!this.aceitarPalavra('DE') && !this.aceitarOp(':=') && !this.aceitarOp('<-')) throw erro(30, linha, 'DE ou :=')
    const inicio = this.expressao()
    this.exigirPalavra('ATE')
    const fim = this.expressao()
    const passo = this.aceitarPalavra('PASSO') ? this.expressao() : null
    this.exigirPalavra('FACA')
    this.fimComando()
    const corpo = this.bloco(['FIMPARA'], (l) => erro(39, l))
    const linhaFim = this.avancar().linha
    this.fimComando()
    return { s: 'para', variavel, inicio, fim, passo, corpo, linha, linhaFim }
  }

  cmdEnquanto() {
    const linha = this.avancar().linha
    const cond = this.expressao()
    this.exigirPalavra('FACA')
    this.fimComando()
    const corpo = this.bloco(['FIMENQUANTO'], (l) => erro(38, l))
    const linhaFim = this.avancar().linha
    this.fimComando()
    return { s: 'enquanto', cond, corpo, linha, linhaFim }
  }

  cmdRepita() {
    const linha = this.avancar().linha
    this.fimComando()
    const corpo = this.bloco(['ATE', 'FIMREPITA'], (l) => erro(22, l))
    const fim = this.avancar()
    const cond = fim.n === 'ATE' ? this.expressao() : null
    this.fimComando()
    return { s: 'repita', corpo, cond, linha, linhaFim: fim.linha }
  }

  cmdEscreva() {
    const tok = this.avancar()
    const linha = tok.linha
    const itens = []
    if (this.aceitarOp('(')) {
      if (!this.aceitarOp(')')) {
        do {
          const expr = this.expressao()
          let largura
          let decimais
          if (this.aceitarOp(':')) {
            largura = this.unario()
            if (this.aceitarOp(':')) decimais = this.unario()
          }
          itens.push({ expr, largura, decimais })
        } while (this.aceitarOp(','))
        this.exigirOp(')', 24)
      }
    } else if (!this.fimDeLinha()) {
      throw erro(23, linha)
    }
    this.fimComando()
    return { s: 'escreva', novaLinha: tok.n === 'ESCREVAL', itens, linha }
  }

  cmdLeia() {
    const linha = this.avancar().linha
    const comParenteses = this.aceitarOp('(')
    const alvos = []
    let mensagem = null
    if (this.aceitarPalavra('MENSAGEM')) this.aceitarOp(',')
    if (this.tok.k === 'STR') {
      mensagem = { e: 'str', v: this.avancar().v, linha }
      this.aceitarOp(',')
    }
    if (!(comParenteses && this.ehOp(')')) && !this.fimDeLinha()) {
      do {
        const alvo = this.posfixo()
        if (alvo.e === 'call' || alvo.e === 'num' || alvo.e === 'str') throw erro(33, linha)
        alvos.push(alvo)
      } while (this.aceitarOp(','))
    }
    if (comParenteses) this.exigirOp(')', 24)
    this.fimComando()
    return { s: 'leia', alvos, mensagem, linha }
  }

  cmdAleatorio() {
    const linha = this.avancar().linha
    let cmd
    if (this.aceitarPalavra('OFF')) cmd = { s: 'aleatorio', ligar: false, linha }
    else {
      this.aceitarPalavra('ON')
      const valores = []
      if (!this.fimDeLinha()) {
        do valores.push(this.unario())
        while (this.aceitarOp(','))
      }
      cmd = { s: 'aleatorio', ligar: true, valores, linha }
    }
    this.fimComando()
    return cmd
  }

  // ---- expressões (precedência de §2.7) ------------------------------------

  expressao() { return this.ouXou() }

  ouXou() {
    let a = this.e()
    for (;;) {
      const linha = this.tok.linha
      if (this.aceitarPalavra('OU')) a = { e: 'bin', op: 'OU', a, b: this.e(), linha }
      else if (this.aceitarPalavra('XOU')) a = { e: 'bin', op: 'XOU', a, b: this.e(), linha }
      else return a
    }
  }

  e() {
    let a = this.nao()
    while (this.ehPalavra('E')) {
      const linha = this.avancar().linha
      a = { e: 'bin', op: 'E', a, b: this.nao(), linha }
    }
    return a
  }

  nao() {
    if (this.ehPalavra('NAO')) {
      const linha = this.avancar().linha
      return { e: 'un', op: 'NAO', a: this.nao(), linha }
    }
    return this.relacional()
  }

  relacional() {
    const a = this.aditivo()
    if (this.tok.k === 'OP' && RELACIONAIS.has(this.tok.v)) {
      const tok = this.avancar()
      return { e: 'bin', op: tok.v, a, b: this.aditivo(), linha: tok.linha }
    }
    return a
  }

  aditivo() {
    let a = this.multiplicativo()
    while (this.ehOp('+') || this.ehOp('-')) {
      const tok = this.avancar()
      a = { e: 'bin', op: tok.v, a, b: this.multiplicativo(), linha: tok.linha }
    }
    return a
  }

  multiplicativo() {
    let a = this.potencia()
    for (;;) {
      const tok = this.tok
      let op = null
      if (tok.k === 'OP' && ['*', '/', '\\', '%'].includes(tok.v)) op = tok.v
      else if (this.ehPalavra('DIV')) op = '\\'
      else if (this.ehPalavra('MOD')) op = '%'
      if (!op) return a
      this.avancar()
      a = { e: 'bin', op, a, b: this.potencia(), linha: tok.linha }
    }
  }

  potencia() {
    let a = this.unario()
    while (this.ehOp('^')) {
      const linha = this.avancar().linha
      a = { e: 'bin', op: '^', a, b: this.unario(), linha }
    }
    return a
  }

  unario() {
    if (this.ehOp('-') || this.ehOp('+')) {
      const tok = this.avancar()
      return { e: 'un', op: tok.v, a: this.unario(), linha: tok.linha }
    }
    return this.posfixo()
  }

  posfixo() {
    let a = this.primario()
    for (;;) {
      const linha = this.tok.linha
      if (this.aceitarOp('[')) {
        const indices = [this.expressao()]
        while (this.aceitarOp(',')) indices.push(this.expressao())
        this.exigirOp(']', 45)
        a = { e: 'idx', base: a, indices, linha }
      } else if (this.ehOp('.') && this.olhar().k === 'ID') {
        this.avancar()
        const campo = this.avancar()
        a = { e: 'campo', base: a, n: campo.n, v: campo.v, linha }
      } else {
        return a
      }
    }
  }

  primario() {
    const tok = this.tok
    const linha = tok.linha
    if (tok.k === 'NUM') {
      this.avancar()
      return { e: 'num', t: tok.t, v: tok.valor, linha }
    }
    if (tok.k === 'STR') {
      this.avancar()
      return { e: 'str', v: tok.v, linha }
    }
    if (this.aceitarOp('(')) {
      const expr = this.expressao()
      this.exigirOp(')', 24)
      return expr
    }
    if (tok.k === 'ID') {
      if (tok.n === 'VERDADEIRO' || tok.n === 'FALSO') {
        this.avancar()
        return { e: 'log', v: tok.n === 'VERDADEIRO', linha }
      }
      if (PALAVRAS_CHAVE.has(tok.n)) throw erro(28, linha)
      this.avancar()
      if (this.aceitarOp('(')) {
        const args = []
        if (!this.aceitarOp(')')) {
          do args.push(this.expressao())
          while (this.aceitarOp(','))
          this.exigirOp(')', 24)
        }
        return { e: 'call', n: tok.n, v: tok.v, args, linha }
      }
      return { e: 'id', n: tok.n, v: tok.v, linha }
    }
    if (tok.k === 'OP') throw erro(25, linha, tok.v)
    throw erro(28, linha)
  }
}
