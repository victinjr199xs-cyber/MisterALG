// Valores que são "chamáveis": lambdas, grupos de métodos (Func<int> f = Metodo;) e funções nativas.
// Todos têm *invocar(m, args), um gerador, para o passo a passo poder entrar neles.

import { Amb, Quadro } from './maquina.js'
import { Suspende } from './refs.js'
import { Ref } from './valores.js'

export class Lambda {
  /** params: [{ nome, tipo? }]; corpo: nó (expressão ou bloco); amb: onde foi criada (as variáveis que ela enxerga). */
  constructor(params, corpo, amb, assincrono = false, linha = 0) {
    this.ehFunc = true
    this.params = params
    this.corpo = corpo
    this.amb = amb
    this.assincrono = assincrono
    this.linha = linha
    this.nomeTipo = 'System.Func'
  }

  *invocar(m, args) {
    const amb = new Amb(this.amb)
    this.params.forEach((p, i) => {
      const a = args[i]
      amb.declarar(p.nome, p.modo === 'ref' || p.modo === 'out' ? (a instanceof Ref ? a : new Ref(a)) : new Ref(m.coagir(a, p.tipo), p.tipo ?? null))
    })
    const quadro = new Quadro('(lambda)', amb, this.linha)
    const ctxAnt = amb.ctx.quadro
    m.pilha.push(quadro)
    try {
      let r
      if (this.corpo.t === 'block') {
        const c = yield* m.execBloco(this.corpo, amb)
        r = c && c.t === 'return' ? c.v : null
      } else r = yield* m.aval(this.corpo, amb)
      return this.assincrono ? m.bib.criarTarefa(r ?? null) : r ?? null
    } finally {
      m.pilha.pop()
      void ctxAnt
    }
  }
}

/** Um método do aluno como valor (delegate): guarda o objeto (this) quando é de instância. */
export class FuncMetodo {
  constructor(md, este) {
    this.ehFunc = true
    this.md = md
    this.este = este
    this.nomeTipo = 'System.Func'
  }

  *invocar(m, args) {
    return yield* m.chamarMetodo(this.md, this.este, args, this.md.cls)
  }
}

/** Todas as sobrecargas de um nome (Func<int,int> f = Dobro; com Dobro sobrecarregado): decide na hora de chamar. */
export class FuncGrupo {
  constructor(nome, candidatos, este) {
    this.ehFunc = true
    this.nome = nome
    this.candidatos = candidatos
    this.este = este
    this.nomeTipo = 'System.Func'
  }

  *invocar(m, args) {
    const md = m.escolherSobrecarga(this.candidatos, args)
    if (!md) throw m.excecao('InvalidOperationException', `nenhuma versão de ${this.nome} aceita estes argumentos`)
    return yield* m.chamarMetodo(md, md.estatico ? null : this.este, args, md.cls)
  }
}

/** Uma função da biblioteca como valor (list.ForEach(Console.WriteLine)). fn(m, args) → valor. */
export class FuncNativa {
  constructor(fn, nome = '') {
    this.ehFunc = true
    this.fn = fn
    this.nome = nome
    this.nomeTipo = 'System.Func'
  }

  *invocar(m, args) {
    const r = this.fn(m, args)
    if (r instanceof Suspende) return yield* r.gen
    return r
  }
}
