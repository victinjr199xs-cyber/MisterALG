// "Corrigir indentação" (Ctrl+G): reorganiza o recuo de cada linha conforme
// as estruturas do Portugol. Função pura, sem DOM.

const normalizar = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

/** Primeira palavra da linha, normalizada (ex.: "Se(x > 1)" → "SE"). */
function primeiraPalavra(linha) {
  const m = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(linha)
  return m ? normalizar(m[0]) : ''
}

const ABRE = new Set(['SE', 'PARA', 'ENQUANTO', 'REPITA', 'ESCOLHA'])
const FECHA = { FIMSE: 'SE', FIMPARA: 'PARA', FIMENQUANTO: 'ENQUANTO', FIMREPITA: 'REPITA', ATE: 'REPITA', ATE_QUE: 'REPITA' }
const SECOES = new Set(['VAR', 'VARIAVEL', 'DECLARE', 'CONST', 'TIPO'])

export function corrigirIndentacao(texto, largura = 3) {
  const pilha = []
  const nivel = () => pilha.filter((b) => b !== 'SUB').length
  const recuo = (n) => ' '.repeat(Math.max(0, n) * largura)
  const tirar = (...tipos) => {
    while (pilha.length && tipos.includes(pilha[pilha.length - 1])) pilha.pop()
  }

  return texto.split('\n').map((bruta) => {
    const linha = bruta.trim()
    if (!linha) return ''
    if (linha.startsWith('//')) return recuo(nivel()) + linha
    const p = primeiraPalavra(linha)

    if (p === 'ALGORITMO') {
      pilha.length = 0
      return linha
    }
    if (SECOES.has(p)) {
      tirar('DECL', 'REG')
      const r = recuo(nivel()) + linha
      pilha.push('DECL')
      return r
    }
    if (p === 'PROCEDIMENTO' || p === 'FUNCAO') {
      pilha.length = 0
      pilha.push('SUB')
      return linha
    }
    if (p === 'INICIO') {
      tirar('DECL', 'REG')
      const r = recuo(nivel()) + linha
      pilha.push('CORPO')
      return r
    }
    if (p === 'FIMALGORITMO' || p === 'FIMPROCEDIMENTO' || p === 'FIMFUNCAO') {
      pilha.length = 0
      return linha
    }
    if (/=\s*registro\s*$/i.test(linha)) {
      const r = recuo(nivel()) + linha
      pilha.push('REG')
      return r
    }
    if (p === 'FIMREGISTRO') {
      tirar('REG')
      return recuo(nivel()) + linha
    }
    if (FECHA[p]) {
      while (pilha.length && pilha[pilha.length - 1] !== FECHA[p] && pilha[pilha.length - 1] !== 'CORPO') pilha.pop()
      if (pilha[pilha.length - 1] === FECHA[p]) pilha.pop()
      return recuo(nivel()) + linha
    }
    if (p === 'SENAO') return recuo(nivel() - 1) + linha
    if (p === 'CASO' || p === 'OUTROCASO') {
      tirar('CASO')
      const r = recuo(nivel()) + linha
      pilha.push('CASO')
      return r
    }
    if (p === 'FIMESCOLHA') {
      tirar('CASO')
      if (pilha[pilha.length - 1] === 'ESCOLHA') pilha.pop()
      return recuo(nivel()) + linha
    }
    const r = recuo(nivel()) + linha
    if (ABRE.has(p)) pilha.push(p)
    return r
  }).join('\n')
}
