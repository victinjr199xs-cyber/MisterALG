// Formatação do C#: os formatos padrão (C, D, E, F, G, N, P, X) e personalizados ("0.00", "#,##0.00"),
// datas (dd/MM/yyyy HH:mm:ss) e o {indice,alinhamento:formato} do string.Format e das strings interpoladas.
// A cultura padrão é a do Brasil (pt-BR): vírgula nos decimais, ponto nos milhares, R$ na moeda.

import {
  Chr, Dbl, Dec, Flt, Num, ValorEnum,
  decArredondar, decDeNumero, decParaTexto, textoDouble, textoFloat, tipoNumerico,
} from './valores.js'

const NBSP = ' '

export const CULTURAS = {
  'pt-BR': {
    nome: 'pt-BR', decimal: ',', milhar: '.', moeda: 'R$', moedaDepois: false, espacoMoeda: NBSP, percentual: '%', espacoPercentual: '',
    dataCurta: 'dd/MM/yyyy', dataLonga: "dddd, d 'de' MMMM 'de' yyyy", horaCurta: 'HH:mm', horaLonga: 'HH:mm:ss',
    dias: ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
    diasCurtos: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
    meses: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    mesesCurtos: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
    infinito: '∞',
  },
  invariant: {
    nome: '', decimal: '.', milhar: ',', moeda: '¤', moedaDepois: false, espacoMoeda: '', percentual: '%', espacoPercentual: '',
    dataCurta: 'MM/dd/yyyy', dataLonga: 'dddd, dd MMMM yyyy', horaCurta: 'HH:mm', horaLonga: 'HH:mm:ss',
    dias: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    diasCurtos: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    mesesCurtos: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    infinito: 'Infinity',
  },
  'en-US': {
    nome: 'en-US', decimal: '.', milhar: ',', moeda: '$', moedaDepois: false, espacoMoeda: '', percentual: '%', espacoPercentual: '',
    dataCurta: 'M/d/yyyy', dataLonga: 'dddd, MMMM d, yyyy', horaCurta: 'h:mm tt', horaLonga: 'h:mm:ss tt',
    dias: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    diasCurtos: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    mesesCurtos: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    infinito: 'Infinity',
  },
}

export class ErroFormato extends Error {}

// ---- números ---------------------------------------------------------------------------------------

/** Separa os dígitos com o separador de milhares de 3 em 3. */
function milhares(inteira, sep) {
  return inteira.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

/** O número como { negativo, inteira, fracao } arredondado para `casas` (meio para longe do zero, como o .NET). */
function emCasas(valor, casas) {
  const tipo = tipoNumerico(valor)
  let dec
  if (valor instanceof Dec) dec = valor
  else if (typeof valor === 'bigint') dec = new Dec(valor, 0)
  else if (typeof valor === 'number') dec = new Dec(BigInt(valor), 0)
  else if (valor instanceof Num) dec = new Dec(BigInt(valor.v), 0)
  else {
    const n = valor instanceof Chr ? valor.c : valor.v
    if (tipo === 'double' || tipo === 'float') {
      if (!Number.isFinite(n)) return { especial: n }
      dec = decDeNumero(tipo === 'float' ? Number(textoFloat(n, false).replace('E', 'e')) : n)
    } else dec = new Dec(BigInt(n), 0)
  }
  const arred = decArredondar(dec, casas, 'longe')
  const negativo = arred.u < 0n
  let dig = (negativo ? -arred.u : arred.u).toString().padStart(arred.s + 1, '0')
  const fracao = arred.s > 0 ? dig.slice(-arred.s) : ''
  dig = arred.s > 0 ? dig.slice(0, -arred.s) : dig
  return { negativo: negativo && (BigInt(dig + fracao) !== 0n), inteira: dig, fracao: fracao.padEnd(casas, '0') }
}

const textoEspecial = (n, c) => (Number.isNaN(n) ? 'NaN' : n > 0 ? c.infinito : `-${c.infinito}`)

function fixo(valor, casas, c, comMilhares) {
  const r = emCasas(valor, casas)
  if (r.especial !== undefined) return textoEspecial(r.especial, c)
  const inteira = comMilhares ? milhares(r.inteira, c.milhar) : r.inteira
  return (r.negativo ? '-' : '') + inteira + (casas > 0 ? c.decimal + r.fracao : '')
}

function cientifico(valor, casas, c, maiuscula, digitosExp = 3) {
  const n = valorComoNumero(valor)
  if (!Number.isFinite(n)) return textoEspecial(n, c)
  const [m, e] = n.toExponential(casas).split('e')
  const exp = Number(e)
  return `${m.replace('.', c.decimal)}${maiuscula ? 'E' : 'e'}${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(digitosExp, '0')}`
}

function valorComoNumero(v) {
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Dec) return Number(v.u) / 10 ** v.s
  if (v instanceof Chr) return v.c
  return v.v
}

const ehInteiroTipo = (v) => ['int', 'long', 'short', 'ushort', 'uint', 'ulong', 'byte', 'sbyte'].includes(tipoNumerico(v))

/** Formato padrão de uma letra ("F2", "N0", "C", "P1", "D5", "X", "E3", "G"). */
function formatoPadrao(valor, letra, precisao, c) {
  const L = letra.toUpperCase()
  const maiuscula = letra === L
  switch (L) {
    case 'F': return fixo(valor, precisao ?? 2, c, false)
    case 'N': return fixo(valor, precisao ?? 2, c, true)
    case 'D': {
      if (!ehInteiroTipo(valor)) throw new ErroFormato('Format specifier was invalid.')
      const n = BigInt(valor instanceof Num ? valor.v : valor)
      const dig = (n < 0n ? -n : n).toString().padStart(precisao ?? 0, '0')
      return (n < 0n ? '-' : '') + dig
    }
    case 'X': {
      if (!ehInteiroTipo(valor)) throw new ErroFormato('Format specifier was invalid.')
      let n = BigInt(valor instanceof Num ? valor.v : valor)
      if (n < 0n) n = BigInt.asUintN(typeof valor === 'bigint' ? 64 : 32, n)
      const h = n.toString(16).padStart(precisao ?? 0, '0')
      return maiuscula ? h.toUpperCase() : h
    }
    case 'E': return cientifico(valor, precisao ?? 6, c, maiuscula)
    case 'C': {
      const t = fixo(valor, precisao ?? 2, c, true)
      const neg = t.startsWith('-')
      const corpo = neg ? t.slice(1) : t
      return `${neg ? '-' : ''}${c.moeda}${c.espacoMoeda}${corpo}`
    }
    case 'P': {
      const n = valorComoNumero(valor) * 100
      const t = fixo(new Dbl(n), precisao ?? 2, c, true)
      return `${t}${c.espacoPercentual}${c.percentual}`
    }
    case 'G': {
      if (precisao === undefined) return textoGeral(valor, c)
      const n = valorComoNumero(valor)
      if (!Number.isFinite(n)) return textoEspecial(n, c)
      const t = Number(n.toPrecision(precisao))
      return textoDouble(t, c.decimal === ',')
    }
    case 'R': return textoGeral(valor, c)
    default: throw new ErroFormato('Format specifier was invalid.')
  }
}

/** ToString() sem formato. */
export function textoGeral(valor, c = CULTURAS['pt-BR']) {
  const v = valor
  if (typeof v === 'number') return String(v)
  if (typeof v === 'bigint') return v.toString()
  if (v instanceof Dbl) return textoDouble(v.v, c.decimal === ',')
  if (v instanceof Flt) return textoFloat(v.v, c.decimal === ',')
  if (v instanceof Dec) return decParaTexto(v, c.decimal === ',')
  if (v instanceof Num) return v.v.toString()
  if (v instanceof Chr) return String.fromCharCode(v.c)
  return String(v)
}

/** Formato personalizado: 0.00, #,##0.00, 00, #.##, 0%, 0.0E+0 e textos entre aspas. */
function formatoPersonalizado(valor, fmt, c) {
  const n = valorComoNumero(valor)
  if (!Number.isFinite(n)) return textoEspecial(n, c)
  // Em partes separadas por ';' (positivo;negativo;zero).
  const secoes = fmt.split(';')
  let usado = secoes[0]
  let abs = Math.abs(n)
  let negativo = n < 0
  if (secoes.length > 1 && n < 0) {
    usado = secoes[1]
    negativo = false
  }
  if (secoes.length > 2 && n === 0) usado = secoes[2]

  // Literais ('texto' e "texto") e escapes viram marcadores.
  const literais = []
  usado = usado.replace(/'([^']*)'|"([^"]*)"|\\(.)/g, (_, a, b, e) => { literais.push(a ?? b ?? e); return '\u0001' })
  const porcentos = (usado.match(/%/g) ?? []).length
  if (porcentos) abs *= 100 ** porcentos
  const milhar = /0,|#,|,0|,#/.test(usado.replace(/,+$/, ''))
  const escalaMilhares = (usado.match(/,+(?=\.|[^0#,]|$)/)?.[0] ?? '').length
  if (/[0#],+(\.|$)/.test(usado)) abs /= 1000 ** (usado.match(/[0#](,+)(\.|$)/)?.[1].length ?? 0)

  const m = /^([^0#]*)([0#,]*)(?:\.([0#]*))?(.*)$/.exec(usado.replace(/,+(?=\.|[^0#,]|$)/g, (s) => (milhar ? ',' : '')))
  const prefixo = m?.[1] ?? ''
  const parteInt = (m?.[2] ?? '').replace(/,/g, '')
  const parteFra = m?.[3] ?? ''
  const sufixo = m?.[4] ?? ''
  if (!m || (parteInt === '' && parteFra === '' && !/[0#]/.test(usado))) return String(usado).replace(/\u0001/g, () => literais.shift() ?? '')

  const casas = parteFra.length
  const minFra = (parteFra.match(/0/g) ?? []).length
  const r = emCasas(new Dbl(abs), casas)
  let inteira = r.inteira.replace(/^0+/, '')
  const minInt = (parteInt.match(/0/g) ?? []).length
  inteira = inteira.padStart(minInt, '0')
  if (milhar && inteira) inteira = milhares(inteira, c.milhar)
  let fracao = r.fracao
  while (fracao.length > minFra && fracao.endsWith('0')) fracao = fracao.slice(0, -1)
  let texto = inteira + (fracao ? c.decimal + fracao : '')
  if (texto === '' && minInt === 0 && !fracao) texto = ''
  const zero = /^[0,.]*$/.test(texto) && Number(r.inteira + r.fracao) === 0
  const sinal = negativo && !zero ? '-' : ''
  void escalaMilhares
  const unido = `${sinal}${prefixo}${texto}${sufixo}`.replace(/%/g, c.percentual)
  return unido.replace(/\u0001/g, () => literais.shift() ?? '')
}

/** valor.ToString(formato, cultura) para qualquer número. */
export function formatarNumero(valor, fmt, c = CULTURAS['pt-BR']) {
  if (fmt === undefined || fmt === null || fmt === '') return textoGeral(valor, c)
  const m = /^([A-Za-z])(\d{0,2})$/.exec(fmt)
  if (m) return formatoPadrao(valor, m[1], m[2] === '' ? undefined : Number(m[2]), c)
  return formatoPersonalizado(valor, fmt, c)
}

// ---- datas -------------------------------------------------------------------------------------------

const dois = (n) => String(n).padStart(2, '0')

/** Formata uma data (campos: ano, mes 1-12, dia, hora, minuto, segundo, ms, diaSemana 0-6). */
export function formatarData(d, fmt, c = CULTURAS['pt-BR']) {
  if (!fmt || fmt.length === 1) {
    const padrao = {
      d: c.dataCurta, D: c.dataLonga, t: c.horaCurta, T: c.horaLonga,
      g: `${c.dataCurta} ${c.horaCurta}`, G: `${c.dataCurta} ${c.horaLonga}`, f: `${c.dataLonga} ${c.horaCurta}`, F: `${c.dataLonga} ${c.horaLonga}`,
      M: "d 'de' MMMM", m: "d 'de' MMMM", Y: "MMMM 'de' yyyy", y: "MMMM 'de' yyyy", s: "yyyy-MM-dd'T'HH:mm:ss", o: "yyyy-MM-dd'T'HH:mm:ss.fffffff", u: "yyyy-MM-dd HH:mm:ss'Z'",
    }
    const f = fmt ? padrao[fmt] : `${c.dataCurta} ${c.horaLonga}`
    if (!f) throw new ErroFormato('Format specifier was invalid.')
    return formatarData(d, f, c)
  }
  const h12 = d.hora % 12 === 0 ? 12 : d.hora % 12
  let r = ''
  for (let i = 0; i < fmt.length;) {
    const ch = fmt[i]
    if (ch === "'" || ch === '"') {
      const fim = fmt.indexOf(ch, i + 1)
      r += fmt.slice(i + 1, fim < 0 ? fmt.length : fim)
      i = fim < 0 ? fmt.length : fim + 1
      continue
    }
    if (ch === '\\') {
      r += fmt[i + 1] ?? ''
      i += 2
      continue
    }
    let n = 1
    while (fmt[i + n] === ch) n += 1
    const t = ch.repeat(n)
    i += n
    switch (ch) {
      case 'y': r += n <= 2 ? dois(d.ano % 100) : String(d.ano).padStart(n, '0'); break
      case 'M': r += n === 1 ? d.mes : n === 2 ? dois(d.mes) : n === 3 ? c.mesesCurtos[d.mes - 1] : c.meses[d.mes - 1]; break
      case 'd': r += n === 1 ? d.dia : n === 2 ? dois(d.dia) : n === 3 ? c.diasCurtos[d.diaSemana] : c.dias[d.diaSemana]; break
      case 'H': r += n === 1 ? d.hora : dois(d.hora); break
      case 'h': r += n === 1 ? h12 : dois(h12); break
      case 'm': r += n === 1 ? d.minuto : dois(d.minuto); break
      case 's': r += n === 1 ? d.segundo : dois(d.segundo); break
      case 'f': r += String(d.ms).padStart(3, '0').padEnd(n, '0').slice(0, n); break
      case 'F': r += String(d.ms).padStart(3, '0').slice(0, n).replace(/0+$/, ''); break
      case 't': r += (d.hora < 12 ? 'AM' : 'PM').slice(0, n); break
      case '/': r += c.dataCurta.includes('/') ? '/' : '-'; break
      case ':': r += ':'; break
      default: r += t
    }
  }
  return r
}

// ---- string.Format e interpolação ------------------------------------------------------------------

/**
 * @param texto o formato, com {0}, {1,5}, {2:F2}, {{ e }}
 * @param args os valores
 * @param converter (valor, formato) → texto  (a máquina sabe formatar objetos, datas, enums...)
 */
export function compor(texto, args, converter) {
  let r = ''
  for (let i = 0; i < texto.length;) {
    const ch = texto[i]
    if (ch === '{') {
      if (texto[i + 1] === '{') {
        r += '{'
        i += 2
        continue
      }
      const fim = texto.indexOf('}', i)
      if (fim < 0) throw new ErroFormato('Input string was not in a correct format.')
      const m = /^\s*(\d+)\s*(?:,\s*(-?\d+))?\s*(?::(.*))?$/s.exec(texto.slice(i + 1, fim))
      if (!m) throw new ErroFormato('Input string was not in a correct format.')
      const idx = Number(m[1])
      if (idx >= args.length) throw new ErroFormato('Index (zero based) must be greater than or equal to zero and less than the size of the argument list.')
      let s = converter(args[idx], m[3])
      if (m[2]) {
        const w = Number(m[2])
        s = w >= 0 ? s.padStart(w) : s.padEnd(-w)
      }
      r += s
      i = fim + 1
    } else if (ch === '}') {
      if (texto[i + 1] === '}') {
        r += '}'
        i += 2
      } else throw new ErroFormato('Input string was not in a correct format.')
    } else {
      r += ch
      i += 1
    }
  }
  return r
}

export const ehEnum = (v) => v instanceof ValorEnum
