// Padrões do C#: o que vem depois de "is", dentro de "switch" e nos braços do "switch" expressão.
// *casarPadrao(padrao, valor, amb) diz se o valor combina e, se o padrão declara variáveis (int n, var x),
// guarda-as em amb.

import { ErroCS } from './erros.js'
import { binario } from './operadores.js'
import { TipoRef } from './refs.js'
import { nomeTipo } from './tipos.js'
import { Arr, Chr, Objeto, Ref } from './valores.js'
import { ListaCS } from './biblioteca/colecoes.js'

const filho = (n, campo) => n.f?.find((x) => x.k === campo)

export const padroes = {
  *casarPadrao(p, v, amb) {
    switch (p.t) {
      case 'discard': return true
      case 'constant_pattern': return yield* this.casarConstante(p.f[0], v, amb)
      case 'declaration_pattern': {
        const tipo = nomeTipo(filho(p, 'type'))
        const nome = filho(p, 'name')?.x
        if (!this.ehTipo(v, tipo)) return false
        if (nome && nome !== '_') amb.declarar(nome, new Ref(v, tipo))
        return true
      }
      case 'type_pattern': return this.ehTipo(v, nomeTipo(p.f[0]))
      case 'var_pattern': {
        const nomes = []
        const coletar = (d) => {
          if (d.t === 'identifier') nomes.push(d.x)
          else for (const f of d.f ?? []) if (f.t !== 'var') coletar(f)
        }
        coletar(p)
        if (nomes.length === 1) amb.declarar(nomes[0], new Ref(v, this.nomeDoTipoDe(v)))
        else {
          const itens = this.itensDesconstruidos(v, nomes.length)
          nomes.forEach((n, i) => amb.declarar(n, new Ref(itens[i], this.nomeDoTipoDe(itens[i]))))
        }
        return true
      }
      case 'relational_pattern': {
        const op = p.f[0].x
        const alvo = yield* this.aval(p.f[p.f.length - 1], amb)
        if (v === null) return false
        return binario(this, op, v, alvo) === true
      }
      case 'and_pattern': return (yield* this.casarPadrao(filho(p, 'left') ?? p.f[0], v, amb)) && (yield* this.casarPadrao(filho(p, 'right') ?? p.f[p.f.length - 1], v, amb))
      case 'or_pattern': return (yield* this.casarPadrao(filho(p, 'left') ?? p.f[0], v, amb)) || (yield* this.casarPadrao(filho(p, 'right') ?? p.f[p.f.length - 1], v, amb))
      case 'negated_pattern': return !(yield* this.casarPadrao(p.f[p.f.length - 1], v, amb))
      case 'parenthesized_pattern': return yield* this.casarPadrao(p.f[0], v, amb)
      case 'recursive_pattern': return yield* this.casarRecursivo(p, v, amb)
      case 'list_pattern': return yield* this.casarLista(p, v, amb)
      default:
        // Uma expressão solta onde se esperava um padrão (is null, is 5, is Cor.Verde).
        if (p.t === 'identifier' && p.x === '_' && !amb.buscar('_')) return true // `_` num case [1, _, ..]:
        return yield* this.casarConstante(p, v, amb)
    }
  },

  /** O padrão é uma constante, ou o nome de um tipo (case Circulo: / is Circulo). */
  *casarConstante(e, v, amb) {
    if (e.t === 'identifier' && !amb.buscar(e.x)) {
      const def = this.buscarClasse(e.x)
      if (def && def.tipo !== 'enum') return this.ehTipo(v, e.x)
      if (!def && this.bib.tipo(e.x) && !(amb.ctx.este && this.acharPropriedade?.(amb.ctx.este.cls, e.x))) return this.ehTipo(v, e.x)
    }
    if (e.t === 'predefined_type') return this.ehTipo(v, e.x)
    if (e.t === 'generic_name' || e.t === 'array_type' || e.t === 'nullable_type') return this.ehTipo(v, nomeTipo(e))
    const alvo = yield* this.aval(e, amb)
    if (alvo instanceof TipoRef) return this.ehTipo(v, alvo.nome)
    if (v === null || v === undefined) return alvo === null
    return binario(this, '==', v, alvo) === true
  },

  /** [1, 2, ..], [var a, .., var z], [1, .. var resto]: array, List<T> ou texto. O `..var r` chega como `var __sl_r` (preprocessar.js). */
  *casarLista(p, v, amb) {
    const ehTexto = typeof v === 'string'
    const itens = ehTexto ? [...v].map((c) => new Chr(c.charCodeAt(0))) : v instanceof Arr && !v.dims ? v.itens : v instanceof ListaCS ? v.itens : null
    if (!itens) return false
    const subs = p.f.filter((x) => x.k !== 'name')
    const nomeFatia = (s) => (s.t === 'var_pattern' && /^__sl_/.test(s.f[s.f.length - 1]?.x ?? '') ? s.f[s.f.length - 1].x.slice(5) : null)
    // `.. [2, 3]` / `.. { Length: 2 } meio` chega como `__SL and <padrão> and ...` (preprocessar.js): os padrões depois do __SL
    const conjuntos = (s) => (s.t === 'and_pattern' ? [...conjuntos(filho(s, 'left') ?? s.f[0]), ...conjuntos(filho(s, 'right') ?? s.f[s.f.length - 1])] : [s])
    const subFatia = (s) => {
      if (s.t !== 'and_pattern') return null
      const cs = conjuntos(s)
      return cs[0].t === 'constant_pattern' && cs[0].f[0]?.x === '__SL' ? cs.slice(1) : null
    }
    const ixF = subs.findIndex((s) => s.t === 'slice_pattern' || nomeFatia(s) !== null || subFatia(s) !== null)
    if (ixF < 0 ? itens.length !== subs.length : itens.length < subs.length - 1) return false
    for (let i = 0; i < subs.length; i += 1) {
      if (i === ixF) continue
      const pos = ixF >= 0 && i > ixF ? itens.length - (subs.length - i) : i
      if (!(yield* this.casarPadrao(subs[i], itens[pos], amb))) return false
    }
    const nome = ixF >= 0 ? nomeFatia(subs[ixF]) : null
    const sub = ixF >= 0 ? subFatia(subs[ixF]) : null
    if ((nome && nome !== '_') || sub) {
      const [a, b] = [ixF, itens.length - (subs.length - 1 - ixF)]
      const fatia = ehTexto ? v.slice(a, b) : v instanceof ListaCS ? new ListaCS(itens.slice(a, b), v.tipoElem) : new Arr(v.tipoElem, itens.slice(a, b))
      if (nome && nome !== '_') amb.declarar(nome, new Ref(fatia, this.nomeDoTipoDe(fatia)))
      for (const p2 of sub ?? []) if (!(yield* this.casarPadrao(p2, fatia, amb))) return false
    }
    return true
  },

  *casarRecursivo(p, v, amb) {
    const tipo = p.f.find((x) => x.k === 'type' || (x.k !== 'name' && ['identifier', 'qualified_name', 'generic_name', 'predefined_type'].includes(x.t)))
    if (tipo && !this.ehTipo(v, nomeTipo(tipo))) return false
    if (!tipo && (v === null || v === undefined)) return false
    const posicional = p.f.find((x) => x.t === 'positional_pattern_clause')
    const propriedades = p.f.find((x) => x.t === 'property_pattern_clause')
    if (posicional) {
      const subs = posicional.f.filter((x) => x.t === 'subpattern')
      const itens = this.itensDesconstruidos(v, subs.length)
      for (let i = 0; i < subs.length; i += 1) {
        const sp = subs[i].f[subs[i].f.length - 1]
        if (!(yield* this.casarPadrao(sp, itens[i], amb))) return false
      }
    }
    if (propriedades) {
      for (const sub of propriedades.f.filter((x) => x.t === 'subpattern')) {
        const nc = sub.f.find((x) => x.t === 'name_colon' || x.t === 'expression_colon')
        const nomeProp = nc ? nc.f[0].x : sub.f[0].x
        const sp = sub.f[sub.f.length - 1]
        let valor
        if (v instanceof Objeto) valor = yield* this.lerMembro(v, nomeProp)
        else valor = this.bib.lerPropriedade(this, v, nomeProp)
        if (!(yield* this.casarPadrao(sp, valor, amb))) return false
      }
    }
    const nome = p.f.find((x) => x.k === 'name' || x.t === 'identifier' && x.k === undefined && p.f.indexOf(x) === p.f.length - 1)
    if (nome && nome.t === 'identifier' && nome.k === 'name') amb.declarar(nome.x, new Ref(v, this.nomeDoTipoDe(v)))
    return true
  },
}
