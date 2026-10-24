// As instruções do C# (if, for, foreach, try, switch, using, return...). Cada uma é um gerador que cede
// { tipo: 'linha', linha } ao começar, para o passo a passo parar ali. O resultado é undefined (seguiu normal)
// ou um sinal de fluxo: BREAK, CONTINUE ou { t: 'return', v }.

import { ErroCS, ExcecaoCS } from './erros.js'
import { Amb, BREAK, CONTINUE, IteradorUsuario } from './maquina.js'
import { nomeTipo } from './tipos.js'
import { Arr, Chr, Objeto, Ref, Tupla } from './valores.js'

const filho = (n, campo) => n.f?.find((x) => x.k === campo)

export const instrucoes = {
  *linha(n, amb) {
    this.linhaAtual = n.l
    const q = this.pilha[this.pilha.length - 1]
    if (q) {
      q.linha = n.l
      q.atual = amb
    }
    yield { tipo: 'linha', linha: n.l }
  },

  *execBloco(bloco, amb, novoEscopo = true) {
    const interno = novoEscopo ? new Amb(amb) : amb
    const stmts = bloco.f ?? []
    yield* this.declararLocais(stmts, interno)
    return yield* this.execLista(stmts, interno)
  },

  /** As funções locais valem no bloco todo, inclusive antes da linha em que aparecem. */
  *declararLocais(stmts, amb) {
    for (const st of stmts) {
      const n = st.t === 'local_function_statement' ? st : null
      if (!n) continue
      const nome = filho(n, 'name').x
      const md = {
        nome,
        cls: amb.ctx.cls,
        params: this.lerParametros(filho(n, 'parameters')),
        tipoRetorno: nomeTipo(filho(n, 'type')),
        estatico: false,
        corpo: filho(n, 'body') ?? n.f.find((x) => x.t === 'block' || x.t === 'arrow_expression_clause'),
        iterador: false,
        assincrono: this.modificadores(n).has('async'),
        local: true,
        fechamento: amb,
        genericos: [],
        linha: n.l,
      }
      md.iterador = this.temYield(md.corpo)
      amb.declarar(nome, new Ref(this.bib.criarFuncaoDeMetodo(md, amb.ctx.este), 'Func'))
    }
  },

  *execLista(stmts, amb) {
    for (let i = 0; i < stmts.length; i += 1) {
      const st = stmts[i]
      if (st.t === 'local_declaration_statement' && st.f.some((x) => x.t === 'using')) {
        yield* this.exec(st, amb)
        const nomes = st.f.find((x) => x.t === 'variable_declaration').f.filter((x) => x.t === 'variable_declarator').map((d) => d.f[0].x)
        try {
          const r = yield* this.execLista(stmts.slice(i + 1), amb)
          return r
        } finally {
          for (const nome of nomes.reverse()) yield* this.descartar(amb.buscar(nome)?.v)
        }
      }
      const r = yield* this.exec(st, amb)
      if (r?.t === 'goto') {
        // goto rótulo; para um rótulo deste mesmo bloco (para frente ou para trás); senão sobe até o bloco que o tem
        const alvo = stmts.findIndex((s) => { let l = s; while (l.t === 'labeled_statement') { if (l.f.find((x) => x.t === 'identifier')?.x === r.rotulo) return true; l = l.f[l.f.length - 1] } return false })
        if (alvo >= 0) { i = alvo - 1; continue }
      }
      if (r) return r
    }
    return undefined
  },

  /** using: chama Dispose() no que foi criado. */
  *descartar(v) {
    if (v === null || v === undefined) return
    if (v instanceof Objeto) {
      const md = this.acharMetodoVirtual(v.cls, 'Dispose', 0)
      if (md) yield* this.chamarMetodo(md, v, [], md.cls)
      return
    }
    if (v.Dispose) v.Dispose(this)
  },

  *exec(n, amb) {
    switch (n.t) {
      case 'block':
        return yield* this.execBloco(n, amb)
      case 'local_declaration_statement': {
        yield* this.linha(n, amb)
        const decl = n.f.find((x) => x.t === 'variable_declaration')
        yield* this.declararVariaveis(decl, amb)
        return undefined
      }
      case 'expression_statement': {
        yield* this.linha(n, amb)
        yield* this.aval(n.f[0], amb)
        return undefined
      }
      case 'if_statement': {
        yield* this.linha(n, amb)
        const cond = filho(n, 'condition')
        const v = yield* this.aval(cond, amb)
        if (v === true) return yield* this.exec(filho(n, 'consequence'), new Amb(amb))
        const alt = filho(n, 'alternative')
        if (alt) return yield* this.exec(alt, new Amb(amb))
        return undefined
      }
      case 'while_statement': {
        const [cond, corpo] = n.f.filter((x) => x.t !== 'while')
        for (;;) {
          yield* this.linha(n, amb)
          if ((yield* this.aval(cond, amb)) !== true) break
          const r = yield* this.exec(corpo, new Amb(amb))
          if (r) {
            if (r === BREAK) break
            if (r === CONTINUE) continue
            return r
          }
        }
        return undefined
      }
      case 'do_statement': {
        const corpo = n.f.find((x) => x.t !== 'do' && x.t !== 'while')
        const cond = n.f[n.f.length - 1]
        for (;;) {
          const r = yield* this.exec(corpo, new Amb(amb))
          if (r) {
            if (r === BREAK) break
            if (r !== CONTINUE) return r
          }
          yield* this.linha(cond, amb)
          if ((yield* this.aval(cond, amb)) !== true) break
        }
        return undefined
      }
      case 'for_statement':
        return yield* this.execFor(n, amb)
      case 'for_each_statement':
        return yield* this.execForeach(n, amb)
      case 'return_statement': {
        yield* this.linha(n, amb)
        const e = n.f.find((x) => x.t !== 'return')
        const v = e ? yield* this.avalComTipo(e, amb, amb.ctx.metodo?.tipoRetorno) : undefined
        return { t: 'return', v }
      }
      case 'break_statement':
        yield* this.linha(n, amb)
        return BREAK
      case 'continue_statement':
        yield* this.linha(n, amb)
        return CONTINUE
      case 'throw_statement': {
        yield* this.linha(n, amb)
        const e = n.f.find((x) => x.t !== 'throw')
        if (!e) {
          if (!this.excecaoAtual) throw new ErroCS('throw; só pode ser usado dentro de um catch', n.l)
          throw this.excecaoAtual
        }
        throw yield* this.criarExcecaoLancada(e, amb)
      }
      case 'try_statement':
        return yield* this.execTry(n, amb)
      case 'switch_statement':
        return yield* this.execSwitch(n, amb)
      case 'using_statement': {
        yield* this.linha(n, amb)
        const escopo = new Amb(amb)
        const decl = n.f.find((x) => x.t === 'variable_declaration')
        const corpo = filho(n, 'body') ?? n.f[n.f.length - 1]
        let recurso
        let nomes = []
        if (decl) {
          yield* this.declararVariaveis(decl, escopo)
          nomes = decl.f.filter((x) => x.t === 'variable_declarator').map((d) => d.f[0].x)
        } else recurso = yield* this.aval(n.f.find((x) => x.t !== 'using' && x !== corpo), amb)
        try {
          return yield* this.exec(corpo, escopo)
        } finally {
          if (decl) for (const nome of nomes.reverse()) yield* this.descartar(escopo.buscar(nome)?.v)
          else yield* this.descartar(recurso)
        }
      }
      case 'lock_statement': {
        yield* this.linha(n, amb)
        const corpo = n.f[n.f.length - 1]
        yield* this.aval(n.f.find((x) => x.t !== 'lock' && x !== corpo), amb)
        return yield* this.exec(corpo, amb)
      }
      case 'checked_statement': {
        const anterior = this.verificado
        this.verificado = n.f[0].t === 'checked' ? 1 : 0
        try {
          return yield* this.execBloco(n.f.find((x) => x.t === 'block'), amb)
        } finally {
          this.verificado = anterior
        }
      }
      case 'yield_statement': {
        yield* this.linha(n, amb)
        if (n.f.some((x) => x.t === 'break')) return { t: 'return', v: undefined }
        const e = n.f[n.f.length - 1]
        const v = yield* this.aval(e, amb)
        yield { tipo: 'valor', v: this.coagir(v, null) }
        return undefined
      }
      case 'local_function_statement': case 'empty_statement': case 'comment':
        return undefined
      case 'labeled_statement':
        return yield* this.exec(n.f[n.f.length - 1], amb)
      case 'goto_statement': {
        yield* this.linha(n, amb)
        if (n.f.some((x) => x.t === 'default')) return { t: 'goto-case', padrao: true }
        if (n.f.some((x) => x.t === 'case')) return { t: 'goto-case', valor: yield* this.aval(n.f[n.f.length - 1], amb) }
        return { t: 'goto', rotulo: n.f.find((x) => x.t === 'identifier')?.x }
      }
      default:
        throw new ErroCS(`o passo a passo do C# ainda não conhece este comando (${n.t})`, n.l)
    }
  },

  /** O objeto que o throw lança: uma exceção do C# (precisa ser da família Exception). */
  *criarExcecaoLancada(e, amb) {
    const v = yield* this.aval(e, amb)
    if (v === null) return this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    if (!(v instanceof Objeto) || !v.cls.deriva(this.buscarClasse('Exception'))) throw new ErroCS('só dá para lançar (throw) uma exceção: um objeto da classe Exception ou de uma classe que herda dela', e.l)
    if (!v.linha) v.linha = this.linhaAtual
    return new ExcecaoCS(v, this.linhaAtual)
  },

  *declararVariaveis(decl, amb) {
    const tipoNo = filho(decl, 'type')
    const tipo = nomeTipo(tipoNo)
    for (const d of decl.f.filter((x) => x.t === 'variable_declarator')) {
      const ev = d.f.find((x) => x.t === 'equals_value_clause')
      const desig = d.f.find((x) => x.t === 'tuple_pattern' || x.t === 'parenthesized_variable_designation')
      if (desig) {
        // var (a, b) = valor;
        const v = yield* this.aval(ev.f[ev.f.length - 1], amb)
        this.desconstruirEm(desig, v, amb)
        continue
      }
      const nome = d.f.find((x) => x.t === 'identifier').x
      let v
      if (ev) v = yield* this.avalComTipo(ev.f[ev.f.length - 1], amb, tipo)
      else v = this.valorPadrao(tipo)
      v = this.coagir(v, tipo)
      amb.declarar(nome, new Ref(v, tipo === 'var' ? this.nomeDoTipoDe(v) : tipo))
    }
  },

  *execFor(n, amb) {
    const escopo = new Amb(amb)
    const init = n.f.filter((x) => x.k === 'initializer')
    for (const i of init) {
      yield* this.linha(n, escopo)
      if (i.t === 'variable_declaration') yield* this.declararVariaveis(i, escopo)
      else yield* this.aval(i, escopo)
    }
    const cond = filho(n, 'condition')
    const updates = n.f.filter((x) => x.k === 'update')
    const corpo = filho(n, 'body')
    for (;;) {
      yield* this.linha(n, escopo)
      if (cond && (yield* this.aval(cond, escopo)) !== true) break
      // Cada volta tem as variáveis do corpo novas; a do for é uma só (como no C#).
      const r = yield* this.exec(corpo, new Amb(escopo))
      if (r) {
        if (r === BREAK) break
        if (r !== CONTINUE) return r
      }
      for (const u of updates) yield* this.aval(u, escopo)
    }
    return undefined
  },

  *execForeach(n, amb) {
    const tipoNo = filho(n, 'type')
    const esquerda = filho(n, 'left')
    const tipo = tipoNo ? nomeTipo(tipoNo) : 'var'
    yield* this.linha(n, amb)
    const fonte = yield* this.aval(filho(n, 'right'), amb)
    const corpo = filho(n, 'body')
    const it = yield* this.criarIterador(fonte, n.l)
    for (;;) {
      const p = yield* it.prox()
      if (p.fim) break
      const escopo = new Amb(amb)
      if (esquerda.t === 'identifier') escopo.declarar(esquerda.x, new Ref(this.coagir(p.v, tipo), tipo === 'var' ? this.nomeDoTipoDe(p.v) : tipo))
      else this.desconstruirEm(esquerda, p.v, escopo)
      yield* this.linha(n, amb)
      const r = yield* this.exec(corpo, escopo)
      if (r) {
        if (r === BREAK) break
        if (r !== CONTINUE) return r
      }
    }
    return undefined
  },

  /** foreach (var (a, b) in pares): reparte o item nas variáveis. */
  desconstruirEm(alvo, valor, escopo) {
    const nomes = []
    const coletar = (x) => {
      if (x.t === 'identifier') nomes.push(x.x)
      else if (x.t === 'discard') nomes.push('_')
      else for (const f of x.f ?? []) if (f.t !== 'var' && !f.t.endsWith('_type')) coletar(f)
    }
    coletar(alvo)
    const itens = this.itensDesconstruidos(valor, nomes.length)
    nomes.forEach((nome, i) => { if (nome !== '_') escopo.declarar(nome, new Ref(itens[i], this.nomeDoTipoDe(itens[i]))) })
  },

  itensDesconstruidos(valor, quantos) {
    if (valor instanceof Tupla) return valor.itens
    if (valor instanceof Objeto) {
      const d = this.acharMetodoVirtual(valor.cls, 'Deconstruct', quantos) ?? this.metodosDe(valor.cls, 'Deconstruct')[0]
      if (d) {
        const refs = d.params.map(() => new Ref(null))
        this.rodarSync(this.chamarMetodo(d, valor, refs, d.cls))
        return refs.map((r) => r.v)
      }
      if (valor.cls.recordParams) return valor.cls.recordParams.map((p) => valor.campos.get(p.nome))
    }
    if (valor && valor.Key !== undefined && valor.Value !== undefined) return [valor.Key, valor.Value]
    throw new ErroCS('este valor não pode ser separado em variáveis (falta um Deconstruct)', this.linhaAtual)
  },

  /** O que o foreach (e as funções da biblioteca) usam para andar numa coleção. Devolve { *prox() → { fim, v } }. */
  *criarIterador(fonte, linha) {
    if (fonte === null || fonte === undefined) throw this.excecao('NullReferenceException', 'Object reference not set to an instance of an object.')
    if (fonte instanceof Arr) {
      let i = 0
      const itens = fonte.itens
      return { *prox() { return i < itens.length ? { fim: false, v: itens[i++] } : { fim: true } } }
    }
    if (typeof fonte === 'string') {
      let i = 0
      return { *prox() { return i < fonte.length ? { fim: false, v: new Chr(fonte.charCodeAt(i++)) } : { fim: true } } }
    }
    if (fonte instanceof IteradorUsuario) {
      const maq = this
      return {
        *prox() {
          for (;;) {
            const r = fonte.gen.next()
            if (r.done) return { fim: true }
            if (r.value?.tipo === 'valor') return { fim: false, v: r.value.v }
            yield r.value
            void maq
          }
        },
      }
    }
    if (fonte.iterar) {
      const it = fonte.iterar(this)
      return { *prox() { const r = it.next(); return r.done ? { fim: true } : { fim: false, v: r.value } } }
    }
    if (fonte instanceof Objeto) {
      const ge = this.acharMetodoVirtual(fonte.cls, 'GetEnumerator', 0)
      if (ge) {
        const e = yield* this.chamarMetodo(ge, fonte, [], ge.cls)
        return yield* this.criarIteradorDeEnumerador(e)
      }
    }
    throw new ErroCS(`o foreach não funciona com este tipo (${this.nomeDoTipoDe(fonte)})`, linha, 'O foreach percorre arrays, listas, textos e objetos que têm GetEnumerator() ou usam yield return.')
  },

  *criarIteradorDeEnumerador(e) {
    if (e instanceof IteradorUsuario) return yield* this.criarIterador(e, this.linhaAtual)
    if (e instanceof Objeto) {
      const mn = this.acharMetodoVirtual(e.cls, 'MoveNext', 0)
      const maq = this
      return {
        *prox() {
          const tem = yield* maq.chamarMetodo(mn, e, [], mn.cls)
          if (tem !== true) return { fim: true }
          return { fim: false, v: yield* maq.lerMembro(e, 'Current') }
        },
      }
    }
    if (e && e.iterar) return yield* this.criarIterador(e, this.linhaAtual)
    throw new ErroCS('o GetEnumerator() devolveu algo que o foreach não entende', this.linhaAtual)
  },

  /** Um iterador do JavaScript para o código nativo (LINQ, AddRange...), sem pausar. */
  *iterarSync(fonte) {
    const it = this.rodarSync(this.criarIterador(fonte, this.linhaAtual))
    for (;;) {
      const p = this.rodarSync(it.prox())
      if (p.fim) return
      yield p.v
    }
  },

  *execTry(n, amb) {
    const corpo = filho(n, 'body')
    const catches = n.f.filter((x) => x.t === 'catch_clause')
    const fin = n.f.find((x) => x.t === 'finally_clause')
    let resultado
    try {
      try {
        resultado = yield* this.execBloco(corpo, amb)
      } catch (e0) {
        const e = this.converterErroInterno(e0)
        if (!(e instanceof ExcecaoCS)) throw e0 === e ? e : e
        let tratada = false
        for (const c of catches) {
          const decl = c.f.find((x) => x.t === 'catch_declaration')
          const tipo = decl ? nomeTipo(filho(decl, 'type')) : 'Exception'
          if (!this.ehTipo(e.valor, tipo)) continue
          const escopo = new Amb(amb)
          const nomeVar = decl && filho(decl, 'name')?.x
          if (nomeVar) escopo.declarar(nomeVar, new Ref(e.valor, tipo))
          const filtro = c.f.find((x) => x.t === 'catch_filter_clause')
          if (filtro && (yield* this.aval(filtro.f[filtro.f.length - 1], escopo)) !== true) continue
          const anterior = this.excecaoAtual
          this.excecaoAtual = e
          try {
            resultado = yield* this.execBloco(filho(c, 'body') ?? c.f[c.f.length - 1], escopo)
          } finally {
            this.excecaoAtual = anterior
          }
          tratada = true
          break
        }
        if (!tratada) throw e
      }
    } finally {
      if (fin) {
        const rf = yield* this.execBloco(fin.f[fin.f.length - 1], amb)
        void rf
      }
    }
    return resultado
  },

  *execSwitch(n, amb) {
    yield* this.linha(n, amb)
    const valor = yield* this.aval(filho(n, 'value') ?? n.f.find((x) => x.t !== 'switch' && x.t !== 'switch_body'), amb)
    const corpo = filho(n, 'body') ?? n.f.find((x) => x.t === 'switch_body')
    const escopo = new Amb(amb)
    const secoes = corpo.f.filter((x) => x.t === 'switch_section')
    const escolher = function* (maq, v) {
      let escolhida = null
      let padrao = null
      for (const s of secoes) {
        const rotulos = s.f.filter((x) => x.t === 'case_switch_label' || x.t === 'default_switch_label' || x.t === 'case_pattern_switch_label')
        for (const r of rotulos) {
          if (r.t === 'default_switch_label') {
            padrao = s
            continue
          }
          if (yield* maq.casarRotulo(r, v, escopo)) {
            escolhida = s
            break
          }
        }
        if (escolhida) break
      }
      return { escolhida, padrao }
    }
    let { escolhida, padrao } = yield* escolher(this, valor)
    let alvo = escolhida ?? padrao
    if (!alvo) return undefined
    for (;;) {
      const stmts = alvo.f.filter((x) => !['case_switch_label', 'default_switch_label', 'case_pattern_switch_label'].includes(x.t))
      yield* this.declararLocais(stmts, escopo)
      const r = yield* this.execLista(stmts, escopo)
      if (r?.t === 'goto-case') { // goto case 3; / goto default;
        if (r.padrao) alvo = padrao
        else {
          const e = yield* escolher(this, r.valor)
          alvo = e.escolhida ?? e.padrao
        }
        if (!alvo) return undefined
        continue
      }
      if (r === BREAK) return undefined
      return r
    }
  },

  *casarRotulo(rotulo, valor, amb) {
    if (rotulo.t === 'case_pattern_switch_label') {
      const padrao = rotulo.f.find((x) => x.t.endsWith('_pattern') || x.t === 'discard' || x.t === 'var_pattern')
      if (!(yield* this.casarPadrao(padrao, valor, amb))) return false
      const guarda = rotulo.f.find((x) => x.t === 'when_clause')
      return guarda ? (yield* this.aval(guarda.f[guarda.f.length - 1], amb)) === true : true
    }
    const e = rotulo.f[rotulo.f.length - 1]
    const guarda = rotulo.f.find((x) => x.t === 'when_clause')
    // `case [1, _, ..]:` a gramática lê como expressão ([...] sem dono): cada argumento vira um subpadrão
    const comoLista = (x) => ({ ...x, t: 'list_pattern', f: x.f[0].f.map((a) => { const s = a.f[a.f.length - 1]; return s.t === 'range_expression' && s.f.length === 1 ? { ...s, t: 'slice_pattern' } : s.t === 'declaration_expression' ? { ...s, t: 'var_pattern' } : s }) })
    const padrao = e.t.endsWith('_pattern') ? e : e.t === 'element_binding_expression' ? comoLista(e) : null
    const ok = padrao ? yield* this.casarPadrao(padrao, valor, amb) : yield* this.casarConstante(e, valor, amb)
    if (!ok) return false
    return guarda ? (yield* this.aval(guarda.f[guarda.f.length - 1], amb)) === true : true
  },
}
