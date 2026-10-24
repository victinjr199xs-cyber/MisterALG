// Como o console.log do Node mostra valores: uma porta fiel do util.inspect (lib/internal/util/inspect.js),
// com as mesmas quebras de linha (breakLength 80, compact 3, vetores numéricos em colunas, profundidade 2,
// referências circulares, getters, classes, Map/Set...). Sem cores. O teste diferencial compara com o Node.

import { INFO } from './simbolos.js'

const K_OBJETO = 0
const K_VETOR = 1
const K_EXTRAS_VETOR = 2
const REGEX_CHAVE = /^[a-zA-Z_][a-zA-Z_0-9]*$/
// eslint-disable-next-line no-control-regex
const ESCAPAR = /[\x00-\x1f\x27\x5c\x7f-\x9f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
// eslint-disable-next-line no-control-regex
const ESCAPAR_SEM_ASPA = /[\x00-\x1f\x5c\x7f-\x9f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
const META = (() => {
  const m = []
  for (let i = 0; i < 160; i += 1) m.push(`\\x${i.toString(16).toUpperCase().padStart(2, '0')}`)
  Object.assign(m, { 8: '\\b', 9: '\\t', 10: '\\n', 12: '\\f', 13: '\\r', 39: "\\'", 92: '\\\\' })
  return m
})()

const escaparTexto = (str, aspa) => {
  let r = ''
  let ultimo = 0
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i)
    if (c === aspa || c === 92 || c < 32 || (c > 126 && c < 160)) {
      r += str.slice(ultimo, i) + META[c]
      ultimo = i + 1
    } else if (c >= 0xd800 && c <= 0xdfff) {
      if (c <= 0xdbff && i + 1 < str.length) {
        const prox = str.charCodeAt(i + 1)
        if (prox >= 0xdc00 && prox <= 0xdfff) { i += 1; continue }
      }
      r += `${str.slice(ultimo, i)}\\u${c.toString(16)}`
      ultimo = i + 1
    }
  }
  return ultimo === 0 ? str : r + str.slice(ultimo)
}

export function escaparCadeia(str) {
  let aspa = 39
  let teste = ESCAPAR
  if (str.includes("'")) {
    if (!str.includes('"')) aspa = -1
    else if (!str.includes('`') && !str.includes('${')) aspa = -2
    if (aspa !== 39) teste = ESCAPAR_SEM_ASPA
  }
  if (str.length < 5000 && !teste.test(str)) return colocarAspas(str, aspa)
  return colocarAspas(escaparTexto(str, aspa === 39 ? 39 : -9), aspa)
}
const colocarAspas = (str, aspa) => (aspa === -1 ? `"${str}"` : aspa === -2 ? `\`${str}\`` : `'${str}'`)

const numero = (n) => (Object.is(n, -0) ? '-0' : `${n}`)

function nomeDoConstrutor(obj) {
  let primeiro
  const original = obj
  while (obj) {
    const d = Object.getOwnPropertyDescriptor(obj, 'constructor')
    if (d !== undefined && typeof d.value === 'function' && d.value.name !== '' && original instanceof d.value) return String(d.value.name)
    obj = Object.getPrototypeOf(obj)
    if (primeiro === undefined) primeiro = obj
  }
  if (primeiro === null) return null
  return 'Object'
}

function prefixo(construtor, etiqueta, padrao, tamanho = '') {
  if (construtor === null) {
    if (etiqueta !== '' && padrao !== etiqueta) return `[${padrao}${tamanho}: null prototype] [${etiqueta}] `
    return `[${padrao}${tamanho}: null prototype] `
  }
  if (etiqueta !== '' && construtor !== etiqueta) return `${construtor}${tamanho} [${etiqueta}] `
  return `${construtor}${tamanho} `
}

function chavesDe(valor, ehVetor) {
  let chaves = Object.keys(valor)
  if (ehVetor) chaves = chaves.filter((k) => !/^(0|[1-9]\d*)$/.test(k) || Number(k) >= 2 ** 32 - 1)
  const simbolos = Object.getOwnPropertySymbols(valor).filter((s) => Object.getOwnPropertyDescriptor(valor, s).enumerable)
  return simbolos.length ? chaves.concat(simbolos) : chaves
}

const ehClasse = (f) => {
  const s = Function.prototype.toString.call(f)
  if (!s.startsWith('class') || !s.endsWith('}')) return false
  const fatia = s.slice(5, -1)
  const i = fatia.indexOf('{')
  return i !== -1 && (!fatia.slice(0, i).includes('(') || /^\s*(extends\s+[\w$.()\s]+)?\s*$/.test(fatia.slice(0, i)))
}

function baseDeFuncao(valor, construtor, etiqueta) {
  if (ehClasse(valor)) {
    const nome = (Object.hasOwn(valor, 'name') && valor.name) || '(anonymous)'
    let base = `class ${nome}`
    if (construtor !== 'Function' && construtor !== null) base += ` [${construtor}]`
    if (etiqueta !== '' && construtor !== etiqueta) base += ` [${etiqueta}]`
    if (construtor !== null) {
      const sup = Object.getPrototypeOf(valor).name
      if (sup) base += ` extends ${sup}`
    } else base += ' extends [null prototype]'
    return `[${base}]`
  }
  let tipo = 'Function'
  const info = valor[INFO]
  if (info) {
    if (info.assincrona) { tipo = 'AsyncFunction'; construtor = 'AsyncFunction' }
  } else {
    const c = Object.getPrototypeOf(valor)?.constructor?.name
    if (c === 'GeneratorFunction' || c === 'AsyncFunction' || c === 'AsyncGeneratorFunction') tipo = c
  }
  let base = `[${tipo}`
  if (construtor === null) base += ' (null prototype)'
  if (valor.name === '') base += ' (anonymous)'
  else base += `: ${valor.name}`
  base += ']'
  if (construtor !== tipo && construtor !== null) base += ` ${construtor}`
  if (etiqueta !== '' && construtor !== etiqueta) base += ` [${etiqueta}]`
  return base
}

function baseDeErro(err) {
  let nome = err.name
  let msg = err.message
  if (typeof nome !== 'string') nome = 'Error'
  if (typeof msg !== 'string') msg = ''
  return `[${msg ? `${nome}: ${msg}` : nome}]`
}

function formatarPrimitivo(ctx, v) {
  switch (typeof v) {
    case 'string': {
      if (v.length > 16 && v.length > ctx.breakLength - ctx.indentationLvl - 4) {
        return v.split(/(?<=\n)/).map((l) => escaparCadeia(l)).join(` +\n${' '.repeat(ctx.indentationLvl + 2)}`)
      }
      return escaparCadeia(v)
    }
    case 'number': return numero(v)
    case 'bigint': return `${v}n`
    case 'boolean': return `${v}`
    case 'undefined': return 'undefined'
    default: return v.toString() // symbol
  }
}

export function formatarValor(ctx, valor, recurseTimes, ehChave = false) {
  if (typeof valor !== 'object' && typeof valor !== 'function') return formatarPrimitivo(ctx, valor)
  if (valor === null) return 'null'
  if (ctx.visto.includes(valor)) {
    let indice = 1
    if (ctx.circular === undefined) {
      ctx.circular = new Map([[valor, indice]])
    } else {
      indice = ctx.circular.get(valor)
      if (indice === undefined) { indice = ctx.circular.size + 1; ctx.circular.set(valor, indice) }
    }
    return `[Circular *${indice}]`
  }
  return formatarBruto(ctx, valor, recurseTimes, ehChave)
}

function formatarBruto(ctx, valor, recurseTimes) {
  let chaves
  let formatador = () => []
  let base = ''
  let tipoExtras = K_OBJETO
  let braces
  let etiqueta
  const ehPromessa = valor?.[Symbol.toStringTag] === 'Promise' && 'estado' in valor // a PromiseMister do runtime
  const construtor = ehPromessa ? 'Promise' : nomeDoConstrutor(valor)
  etiqueta = valor[Symbol.toStringTag]
  if (typeof etiqueta !== 'string' || (etiqueta !== '' && construtor === etiqueta)) etiqueta = ''

  if (Array.isArray(valor)) {
    const pre = construtor !== 'Array' || etiqueta !== '' ? prefixo(construtor, etiqueta, 'Array', `(${valor.length})`) : ''
    chaves = chavesDe(valor, true)
    braces = [`${pre}[`, ']']
    if (valor.length === 0 && chaves.length === 0) return `${braces[0]}]`
    tipoExtras = K_EXTRAS_VETOR
    formatador = formatarVetor
  } else if (valor instanceof Set) {
    const pre = prefixo(construtor, etiqueta, 'Set', `(${valor.size})`)
    chaves = chavesDe(valor)
    formatador = formatarConjunto
    if (valor.size === 0 && chaves.length === 0) return `${pre}{}`
    braces = [`${pre}{`, '}']
  } else if (valor instanceof Map) {
    const pre = prefixo(construtor, etiqueta, 'Map', `(${valor.size})`)
    chaves = chavesDe(valor)
    formatador = formatarMapa
    if (valor.size === 0 && chaves.length === 0) return `${pre}{}`
    braces = [`${pre}{`, '}']
  } else if (ArrayBuffer.isView(valor) && !(valor instanceof DataView)) {
    chaves = chavesDe(valor, true)
    braces = [`${prefixo(construtor, etiqueta, valor.constructor.name, `(${valor.length})`)}[`, ']']
    if (valor.length === 0 && chaves.length === 0) return `${braces[0]}]`
    formatador = formatarVetor
    tipoExtras = K_EXTRAS_VETOR
  } else {
    chaves = chavesDe(valor)
    braces = ['{', '}']
    if (typeof valor === 'function') {
      base = baseDeFuncao(valor, construtor, etiqueta)
      if (chaves.length === 0) return base
    } else if (valor instanceof RegExp) {
      base = RegExp.prototype.toString.call(valor)
      const pre = prefixo(construtor, etiqueta, 'RegExp')
      if (pre !== 'RegExp ') base = `${pre}${base}`
      if (chaves.length === 0) return base
    } else if (valor instanceof Date) {
      base = Number.isNaN(valor.getTime()) ? Date.prototype.toString.call(valor) : Date.prototype.toISOString.call(valor)
      const pre = prefixo(construtor, etiqueta, 'Date')
      if (pre !== 'Date ') base = `${pre}${base}`
      if (chaves.length === 0) return base
    } else if (valor instanceof Error) {
      base = baseDeErro(valor)
      chaves = chaves.filter((k) => k !== 'message' && k !== 'stack')
      if (chaves.length === 0) return base
    } else if (valor instanceof Number || valor instanceof String || valor instanceof Boolean || valor instanceof BigInt || (typeof Symbol === 'function' && valor instanceof Symbol)) {
      const tipo = valor instanceof Number ? 'Number' : valor instanceof String ? 'String' : valor instanceof Boolean ? 'Boolean' : valor instanceof BigInt ? 'BigInt' : 'Symbol'
      const prim = valor.valueOf()
      base = `[${tipo}`
      if (tipo !== construtor) base += construtor === null ? ' (null prototype)' : ` (${construtor})`
      base += `: ${formatarPrimitivo({ ...ctx, indentationLvl: 0 }, prim)}]`
      if (etiqueta !== '' && etiqueta !== construtor) base += ` [${etiqueta}]`
      if (tipo === 'String') chaves = chaves.filter((k) => typeof k !== 'string' || !/^\d+$/.test(k))
      if (chaves.length === 0) return base
    } else if (ehPromessa) {
      braces[0] = `${prefixo(construtor, etiqueta, 'Promise')}{`
      formatador = formatarPromessa
    } else if (valor instanceof WeakSet || valor instanceof WeakMap) {
      braces[0] = `${prefixo(construtor, etiqueta, valor instanceof WeakSet ? 'WeakSet' : 'WeakMap')}{`
      formatador = () => ['<items unknown>']
    } else {
      if (construtor === 'Object') {
        if (etiqueta !== '') braces[0] = `${prefixo(construtor, etiqueta, 'Object')}{`
        if (chaves.length === 0) return `${braces[0]}}`
      } else {
        braces[0] = `${prefixo(construtor, etiqueta, 'Object')}{`
        if (chaves.length === 0) return `${braces[0]}}`
      }
    }
  }

  if (recurseTimes > ctx.depth && ctx.depth !== null) {
    let nome = prefixo(construtor, etiqueta, 'Object').slice(0, -1)
    if (construtor !== null) nome = `[${nome}]`
    return nome
  }
  recurseTimes += 1
  ctx.visto.push(valor)
  ctx.currentDepth = recurseTimes
  let saida
  try {
    saida = formatador(ctx, valor, recurseTimes)
    for (let i = 0; i < chaves.length; i += 1) saida.push(formatarPropriedade(ctx, valor, recurseTimes, chaves[i], tipoExtras))
  } finally {
    ctx.visto.pop()
  }
  if (ctx.circular !== undefined) {
    const indice = ctx.circular.get(valor)
    if (indice !== undefined) {
      const ref = `<ref *${indice}>`
      base = base === '' ? ref : `${ref} ${base}`
    }
  }
  return reduzir(ctx, saida, base, braces, tipoExtras, recurseTimes, valor)
}

function formatarVetor(ctx, valor, recurseTimes) {
  const total = valor.length
  const len = Math.min(Math.max(0, ctx.maxArrayLength), total)
  const resto = total - len
  const saida = []
  for (let i = 0; i < len; i += 1) {
    if (!Object.hasOwn(valor, i)) return formatarVetorEsparso(ctx, valor, recurseTimes, len, saida)
    saida.push(formatarPropriedade(ctx, valor, recurseTimes, i, K_VETOR))
  }
  if (resto > 0) saida.push(`... ${resto} more item${resto > 1 ? 's' : ''}`)
  return saida
}

function formatarVetorEsparso(ctx, valor, recurseTimes, maxLength, saida) {
  // Percorre os índices: buracos viram "<N empty items>".
  saida.length = 0
  let indice = 0
  const total = valor.length
  let itens = 0
  while (indice < total && itens < ctx.maxArrayLength) {
    if (!Object.hasOwn(valor, indice)) {
      let fim = indice
      while (fim < total && !Object.hasOwn(valor, fim)) fim += 1
      const n = fim - indice
      saida.push(`<${n} empty item${n > 1 ? 's' : ''}>`)
      indice = fim
    } else {
      saida.push(formatarPropriedade(ctx, valor, recurseTimes, indice, K_VETOR))
      indice += 1
    }
    itens += 1
  }
  const resto = total - indice
  if (resto > 0) saida.push(`... ${resto} more item${resto > 1 ? 's' : ''}`)
  return saida
}

function formatarConjunto(ctx, valor, recurseTimes) {
  const saida = []
  ctx.indentationLvl += 2
  for (const v of valor) saida.push(formatarValor(ctx, v, recurseTimes))
  ctx.indentationLvl -= 2
  return saida
}

function formatarMapa(ctx, valor, recurseTimes) {
  const saida = []
  ctx.indentationLvl += 2
  for (const [k, v] of valor) saida.push(`${formatarValor(ctx, k, recurseTimes)} => ${formatarValor(ctx, v, recurseTimes)}`)
  ctx.indentationLvl -= 2
  return saida
}

function formatarPromessa(ctx, valor, recurseTimes) {
  if (valor.estado === 'pendente') return ['<pending>']
  ctx.indentationLvl += 2
  const str = formatarValor(ctx, valor.valor, recurseTimes)
  ctx.indentationLvl -= 2
  return [valor.estado === 'rejeitada' ? `<rejected> ${str}` : str]
}

function formatarPropriedade(ctx, valor, recurseTimes, chave, tipo, desc) {
  let nome
  let str
  desc = desc ?? Object.getOwnPropertyDescriptor(valor, chave) ?? { value: valor[chave], enumerable: true }
  if (desc.value !== undefined) {
    ctx.indentationLvl += 2
    str = formatarValor(ctx, desc.value, recurseTimes)
    ctx.indentationLvl -= 2
  } else if (desc.get !== undefined) {
    str = desc.set !== undefined ? '[Getter/Setter]' : '[Getter]'
  } else if (desc.set !== undefined) {
    str = '[Setter]'
  } else {
    str = 'undefined'
  }
  if (tipo === K_VETOR) return str
  if (typeof chave === 'symbol') nome = chave.toString() // (Node 24 não põe colchetes na chave-símbolo)
  else if (chave === '__proto__') nome = "['__proto__']"
  else if (desc.enumerable === false) nome = `[${escaparTexto(String(chave), -9)}]`
  else if (REGEX_CHAVE.test(chave)) nome = chave
  else nome = escaparCadeia(chave)
  return `${nome}: ${str}`
}

function abaixoDoLimite(ctx, saida, inicio, base) {
  let total = saida.length + inicio
  if (total + saida.length > ctx.breakLength) return false
  for (let i = 0; i < saida.length; i += 1) {
    total += saida[i].length
    if (total > ctx.breakLength) return false
  }
  return base === '' || !base.includes('\n')
}

function reduzir(ctx, saida, base, braces, tipoExtras, recurseTimes, valor) {
  const entradas = saida.length
  if (tipoExtras === K_EXTRAS_VETOR && entradas > 6) saida = agruparElementos(ctx, saida, valor)
  if (ctx.currentDepth - recurseTimes < ctx.compact && entradas === saida.length) {
    const inicio = saida.length + ctx.indentationLvl + braces[0].length + base.length + 10
    if (abaixoDoLimite(ctx, saida, inicio, base)) {
      const junto = saida.join(', ')
      if (!junto.includes('\n')) return `${base ? `${base} ` : ''}${braces[0]} ${junto} ${braces[1]}`
    }
  }
  const indentacao = `\n${' '.repeat(ctx.indentationLvl)}`
  return `${base ? `${base} ` : ''}${braces[0]}${indentacao}  ${saida.join(`,${indentacao}  `)}${indentacao}${braces[1]}`
}

function agruparElementos(ctx, saida, valor) {
  let total = 0
  let maxLen = 0
  let i = 0
  let tamanhoSaida = saida.length
  if (ctx.maxArrayLength < saida.length) tamanhoSaida -= 1 // não conta o "... n more items"
  const separador = 2
  const dados = new Array(tamanhoSaida)
  for (; i < tamanhoSaida; i += 1) {
    const len = saida[i].length
    dados[i] = len
    total += len + separador
    if (maxLen < len) maxLen = len
  }
  const maxReal = maxLen + separador
  if (maxReal * 3 + ctx.indentationLvl < ctx.breakLength && (total / maxReal > 5 || maxLen <= 6)) {
    const alturaCaractere = 2.5
    const vies = Math.sqrt(maxReal - total / saida.length)
    const maxComVies = Math.max(maxReal - 3 - vies, 1)
    const colunas = Math.min(
      Math.round(Math.sqrt(alturaCaractere * maxComVies * tamanhoSaida) / maxComVies),
      Math.floor((ctx.breakLength - ctx.indentationLvl) / maxReal),
      ctx.compact * 4,
      15,
    )
    if (colunas <= 1) return saida
    const tmp = []
    const larguras = []
    for (let c = 0; c < colunas; c += 1) {
      let largura = 0
      for (let j = c; j < saida.length; j += colunas) if (dados[j] > largura) largura = dados[j]
      larguras.push(largura + separador)
    }
    let alinhar = 'padStart'
    if (valor !== undefined) {
      for (let k = 0; k < saida.length; k += 1) {
        if (typeof valor[k] !== 'number' && typeof valor[k] !== 'bigint') { alinhar = 'padEnd'; break }
      }
    }
    for (let k = 0; k < tamanhoSaida; k += colunas) {
      const max = Math.min(k + colunas, tamanhoSaida)
      let str = ''
      let j = k
      for (; j < max - 1; j += 1) str += `${saida[j]}, `[alinhar](larguras[j - k], ' ')
      if (alinhar === 'padStart') str += saida[j].padStart(larguras[j - k] - separador, ' ')
      else str += saida[j]
      tmp.push(str)
    }
    if (ctx.maxArrayLength < saida.length) tmp.push(saida[tamanhoSaida])
    saida = tmp
  }
  return saida
}

/** util.inspect(valor, opcoes) sem cores. */
export function inspecionar(valor, opcoes = {}) {
  const ctx = {
    visto: [], circular: undefined, indentationLvl: 0, currentDepth: 0,
    depth: opcoes.depth === undefined ? 2 : opcoes.depth,
    breakLength: opcoes.breakLength ?? 80, compact: opcoes.compact ?? 3, maxArrayLength: opcoes.maxArrayLength ?? 100,
  }
  return formatarValor(ctx, valor, 0)
}

const CONSTRUTORES_NATIVOS = new Set(['Object', 'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'Promise', 'Function', 'Number', 'String', 'Boolean', 'Symbol', 'BigInt'])
function temToStringNativo(obj) {
  let p = obj
  while (p !== null && p !== undefined) {
    if (Object.hasOwn(p, 'toString')) return false
    const d = Object.getOwnPropertyDescriptor(p, 'constructor')
    if (d !== undefined && typeof d.value === 'function' && CONSTRUTORES_NATIVOS.has(d.value.name)) return true
    p = Object.getPrototypeOf(p)
  }
  return true
}

/** util.format: o que o console.log faz com os argumentos (%s, %d, %i, %f, %j, %o, %O, %c, %%). */
export function formatarArgumentos(args) {
  const primeiro = args[0]
  let a = 0
  let str = ''
  let junta = ''
  if (typeof primeiro === 'string') {
    if (args.length === 1) return primeiro
    let temp
    let ultimo = 0
    for (let i = 0; i < primeiro.length - 1; i += 1) {
      if (primeiro.charCodeAt(i) === 37) {
        const prox = primeiro.charCodeAt(i + 1)
        i += 1
        if (a + 1 !== args.length) {
          switch (prox) {
            case 115: { // %s
              const v = args[++a]
              if (typeof v === 'number') temp = numero(v)
              else if (typeof v === 'bigint') temp = `${v}n`
              else if (typeof v !== 'object' || v === null || !temToStringNativo(v)) temp = String(v)
              else temp = inspecionar(v, { depth: 0 })
              break
            }
            case 106: // %j
              try { temp = JSON.stringify(args[++a]) } catch (e) { if (/circular/i.test(e.message)) temp = '[Circular]'; else throw e }
              break
            case 100: { // %d
              const v = args[++a]
              if (typeof v === 'bigint') temp = `${v}n`
              else if (typeof v === 'symbol') temp = 'NaN'
              else temp = numero(Number(v))
              break
            }
            case 79: temp = inspecionar(args[++a]); break // %O
            case 111: temp = inspecionar(args[++a], { depth: 4 }); break // %o
            case 105: { // %i
              const v = args[++a]
              if (typeof v === 'bigint') temp = `${v}n`
              else if (typeof v === 'symbol') temp = 'NaN'
              else temp = numero(Number.parseInt(v))
              break
            }
            case 102: { // %f
              const v = args[++a]
              temp = typeof v === 'symbol' ? 'NaN' : numero(Number.parseFloat(v))
              break
            }
            case 99: a += 1; temp = ''; break // %c
            case 37: str += primeiro.slice(ultimo, i); ultimo = i + 1; continue
            default: continue
          }
          if (ultimo !== i - 1) str += primeiro.slice(ultimo, i - 1)
          str += temp
          ultimo = i + 1
        } else if (prox === 37) {
          str += primeiro.slice(ultimo, i)
          ultimo = i + 1
        }
      }
    }
    if (ultimo !== 0) {
      a += 1
      junta = ' '
      if (ultimo < primeiro.length) str += primeiro.slice(ultimo)
    }
  }
  while (a < args.length) {
    const v = args[a]
    str += junta
    str += typeof v !== 'string' ? inspecionar(v) : v
    junta = ' '
    a += 1
  }
  return str
}

/** console.table, como o Node 20+ desenha. */
export function tabela(dados, propriedades) {
  if (dados === null || typeof dados !== 'object') return null
  const celula = (v) => {
    const fundo = v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 2 ? -1 : 0
    return inspecionar(v, { depth: fundo, maxArrayLength: 3, breakLength: Infinity })
  }
  const linhas = dados instanceof Map ? null : (Array.isArray(dados) ? dados.map((v, i) => [String(i), v]) : Object.entries(dados))
  if (!linhas) return null
  const colunas = []
  const mapa = new Map()
  let temValores = false
  const registros = linhas.map(([indice, v]) => {
    const r = { indice, cel: new Map(), valor: undefined }
    if (v !== null && typeof v === 'object') {
      for (const k of propriedades ?? Object.keys(v)) {
        if (propriedades && !(k in v)) continue
        if (!mapa.has(k)) { mapa.set(k, colunas.length); colunas.push(k) }
        r.cel.set(k, celula(v[k]))
      }
    } else {
      r.valor = celula(v)
      temValores = true
    }
    return r
  })
  const cabecalho = ['(index)', ...colunas, ...(temValores ? ['Values'] : [])]
  const corpo = registros.map((r) => [r.indice, ...colunas.map((c) => r.cel.get(c) ?? ''), ...(temValores ? [r.valor ?? ''] : [])])
  const larguras = cabecalho.map((h, i) => Math.max(h.length, ...corpo.map((l) => [...l[i]].length)) + 2)
  const linha = (cels) => `│${cels.map((c, i) => ` ${c}${' '.repeat(larguras[i] - 1 - [...c].length)}`).join('│')}│`
  const reta = (a, b, c) => `${a}${larguras.map((w) => '─'.repeat(w)).join(b)}${c}`
  return [reta('┌', '┬', '┐'), linha(cabecalho), reta('├', '┼', '┤'), ...corpo.map(linha), reta('└', '┴', '┘')].join('\n')
}
