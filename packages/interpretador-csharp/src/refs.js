// Valores "de compilação": o nome de um tipo ou de um namespace usado numa expressão (Console, Math, System, MinhaClasse),
// e índices/intervalos (arr[^1], arr[1..3]).

export class TipoRef {
  /** def: ClasseDef do aluno ou da biblioteca em C#; nativo: um tipo da biblioteca em JavaScript; args: tipos genéricos. */
  constructor(nome, def = null, nativo = null, args = []) {
    this.nome = nome
    this.def = def
    this.nativo = nativo
    this.args = args
  }
}

/** Uma função da biblioteca que precisa conversar com a máquina (ler do teclado, chamar código do aluno com pausa): devolve isto. */
export class Suspende {
  constructor(gen) { this.gen = gen }
}

export class NsRef {
  constructor(nome) { this.nome = nome }
}

export class Indice {
  constructor(n, doFim = false) { this.n = n; this.doFim = doFim }
  em(tamanho) { return this.doFim ? tamanho - this.n : this.n }
}

export class Intervalo {
  constructor(de, ate) { this.de = de; this.ate = ate }
  /** { inicio, tamanho } para uma coleção de `tamanho` itens. */
  em(tamanho) {
    const inicio = this.de ? this.de.em(tamanho) : 0
    const fim = this.ate ? this.ate.em(tamanho) : tamanho
    return { inicio, tamanho: fim - inicio }
  }
}
