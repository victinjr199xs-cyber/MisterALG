// Nomes de tipos do C# como texto ("int", "List<int>", "int[]", "Dictionary<string,int>") e o que se faz com eles.

import { NOMES_NUMERICOS } from './valores.js'

const APELIDOS = {
  Int32: 'int', Int64: 'long', Int16: 'short', UInt32: 'uint', UInt64: 'ulong', UInt16: 'ushort', Byte: 'byte', SByte: 'sbyte',
  Double: 'double', Single: 'float', Decimal: 'decimal', Boolean: 'bool', String: 'string', Char: 'char', Object: 'object',
}

const ultimo = (qualificado) => qualificado.slice(qualificado.lastIndexOf('.') + 1)

/** O nó de tipo da árvore como texto. */
export function nomeTipo(n) {
  if (!n) return 'var'
  switch (n.t) {
    case 'predefined_type':
      return n.x
    case 'implicit_type':
      return 'var'
    case 'void_keyword':
      return 'void'
    case 'identifier':
      return APELIDOS[n.x] ?? n.x
    case 'qualified_name': {
      const f = n.f
      return nomeTipo(f[f.length - 1])
    }
    case 'alias_qualified_name':
      return nomeTipo(n.f[n.f.length - 1])
    case 'generic_name': {
      const id = n.f.find((x) => x.t === 'identifier')
      const args = n.f.find((x) => x.t === 'type_argument_list')
      return `${APELIDOS[id.x] ?? id.x}<${args.f.map(nomeTipo).join(',')}>`
    }
    case 'array_type': {
      const elem = n.f.find((x) => x.k === 'type')
      const rank = n.f.find((x) => x.k === 'rank')
      return `${nomeTipo(elem)}[${','.repeat((rank?.d ?? 1) - 1)}]`
    }
    case 'nullable_type':
      return `${nomeTipo(n.f[0])}?`
    case 'tuple_type':
      return `(${n.f.map((e) => nomeTipo(e.f?.find((x) => x.k === 'type') ?? e)).join(',')})`
    case 'ref_type':
      return nomeTipo(n.f[n.f.length - 1])
    default:
      return n.x ?? n.t
  }
}

/** "Dictionary<string,List<int>>" → { nome: 'Dictionary', args: ['string', 'List<int>'] } */
export function partesGenericas(tipo) {
  const i = tipo.indexOf('<')
  if (i < 0 || !tipo.endsWith('>')) return { nome: tipo, args: [] }
  const args = []
  let prof = 0
  let ini = i + 1
  for (let j = ini; j < tipo.length - 1; j += 1) {
    const c = tipo[j]
    if (c === '<' || c === '(') prof += 1
    else if (c === '>' || c === ')') prof -= 1
    else if (c === ',' && prof === 0) {
      args.push(tipo.slice(ini, j))
      ini = j + 1
    }
  }
  args.push(tipo.slice(ini, tipo.length - 1))
  return { nome: ultimo(tipo.slice(0, i)), args }
}

export const semNulo = (t) => (t && t.endsWith('?') ? t.slice(0, -1) : t)
export const ehArray = (t) => !!t && /\[,*\]$/.test(t)
export const elementoDe = (t) => t.replace(/\[,*\]$/, '')
export const ehNumericoNome = (t) => NOMES_NUMERICOS.has(t)

const TUPLA = /^\((.*)\)$/
export const ehTuplaTipo = (t) => TUPLA.test(t ?? '')

export const NOMES_COMPLETOS = {
  int: 'System.Int32', long: 'System.Int64', short: 'System.Int16', byte: 'System.Byte', sbyte: 'System.SByte', ushort: 'System.UInt16',
  uint: 'System.UInt32', ulong: 'System.UInt64', double: 'System.Double', float: 'System.Single', decimal: 'System.Decimal',
  bool: 'System.Boolean', char: 'System.Char', string: 'System.String', object: 'System.Object',
}

/** O texto do tipo como o GetType().ToString() do .NET mostra. */
export function nomeCompleto(tipo) {
  const t = semNulo(tipo)
  if (NOMES_COMPLETOS[t]) return NOMES_COMPLETOS[t]
  if (ehArray(t)) return `${nomeCompleto(elementoDe(t))}[${t.match(/\[(,*)\]/)[1]}]`
  const { nome, args } = partesGenericas(t)
  if (args.length) {
    const prefixo = { List: 'System.Collections.Generic.', Dictionary: 'System.Collections.Generic.', HashSet: 'System.Collections.Generic.', Queue: 'System.Collections.Generic.', Stack: 'System.Collections.Generic.' }[nome] ?? ''
    return `${prefixo}${nome}\`${args.length}[${args.map(nomeCompleto).join(',')}]`
  }
  return t
}
