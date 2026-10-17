// Conversão de valores em texto, como o escreva/escreval do VisuAlg
// (docs/spec/_sintese-A-linguagem.md §2.11).

/** Real sem formato: até 10 casas, sem zeros à direita, sem ponto sobrando, sem "-0". */
export function textoReal(x, casas = 10) {
  if (!Number.isFinite(x)) return String(x)
  let s = Math.abs(x) < 1e21 ? x.toFixed(casas) : String(x)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  if (s === '-0') s = '0'
  return s
}

/** Texto de um valor tipado {t, v}, sem o espaço que o escreva acrescenta. */
export function textoValor({ t, v }) {
  switch (t) {
    case 'I': return String(v)
    case 'R': return textoReal(v)
    case 'L': return v ? 'VERDADEIRO' : 'FALSO'
    default: return String(v)
  }
}

/** `d` casas, arredondando para longe do zero (Str(x:n:d) do Pascal). */
function fixo(x, d) {
  const fator = 10 ** d
  const arredondado = (Math.sign(x) * Math.round(Math.abs(x) * fator * (1 + Number.EPSILON))) / fator
  const s = arredondado.toFixed(d)
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s
}

/**
 * Um item do escreva: `valor[:largura[:decimais]]`.
 * Sem largura, números e lógicos ganham um espaço à esquerda.
 */
export function formatarSaida(valor, largura, decimais) {
  if (largura === undefined) {
    const s = textoValor(valor)
    return valor.t === 'C' ? s : ' ' + s
  }
  const s = decimais !== undefined && (valor.t === 'R' || valor.t === 'I')
    ? fixo(valor.v, decimais)
    : textoValor(valor)
  return s.padStart(largura, ' ')
}

/** Texto usado na grade de variáveis (até 14 casas para reais). */
export function textoGrade({ t, v }) {
  if (t === 'R') return textoReal(v, 14)
  if (t === 'C') return `"${v}"`
  return textoValor({ t, v })
}
