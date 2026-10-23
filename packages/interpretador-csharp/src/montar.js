// Junta a máquina com as instruções, expressões, chamadas, padrões e a biblioteca.

import { Biblioteca } from './biblioteca/index.js'
import { expressoes } from './expressoes.js'
import { instrucoes } from './instrucoes.js'
import { invocacao } from './invocacao.js'
import { MaquinaCS as Base } from './maquina.js'
import { padroes } from './padroes.js'

for (const modulo of [instrucoes, expressoes, invocacao, padroes]) {
  // defineProperties (e não assign) para os "get" virarem propriedades e não serem executados agora.
  Object.defineProperties(Base.prototype, Object.getOwnPropertyDescriptors(modulo))
}

export class MaquinaCS extends Base {
  constructor(ast, preludioAst, op) {
    super(ast, preludioAst, op)
    this.bib = new Biblioteca()
  }
}
