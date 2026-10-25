// "Fotografia" do programa para a tela: as chamadas na pilha com as variáveis de cada uma,
// os objetos (cada um com um número, para as setas) e as filas do laço de eventos.
// Tudo vira dados simples, que atravessam o postMessage do Worker.

import { GERADOR, INFO, nomeDaFuncao } from './runtime.js'

const MAX_OBJETOS = 80
const MAX_ITENS = 40
const MAX_QUADROS = 300

function tipoReal(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'function') return /^class\b/.test(Function.prototype.toString.call(v)) ? 'class' : 'function'
  if (typeof v === 'object') return v.constructor?.name && v.constructor !== Object ? v.constructor.name : 'object'
  return typeof v
}

function textoPrimitivo(v) {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'bigint') return `${v}n`
  if (Object.is(v, -0)) return '-0'
  return String(v)
}

export function fotografar(rt, tiposDeclarados = {}) {
  const ids = new Map()
  const objetos = []
  const fila = []

  const descrever = (v) => {
    if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return { texto: textoPrimitivo(v), tipo: tipoReal(v) }
    let id = ids.get(v)
    if (id === undefined) {
      if (ids.size >= MAX_OBJETOS) return { texto: '…', tipo: tipoReal(v) }
      id = ids.size + 1
      ids.set(v, id)
      fila.push(v)
    }
    return { ref: id, tipo: tipoReal(v) }
  }

  const expandir = (v) => {
    const id = ids.get(v)
    const base = { id, tipo: tipoReal(v) }
    if (typeof v === 'function') {
      const ehClasse = /^class\b/.test(Function.prototype.toString.call(v))
      return { ...base, forma: 'funcao', rotulo: ehClasse ? `class ${v.name}` : `ƒ ${nomeDaFuncao(v)}()${v[GERADOR] && v[INFO]?.assincrona ? ' (async)' : ''}`, itens: [] }
    }
    if (v?.[Symbol.toStringTag] === 'Promise' && 'estado' in v) {
      return { ...base, forma: 'promessa', rotulo: `Promise (${v.estado})`, itens: v.estado === 'pendente' ? [] : [{ chave: v.estado === 'resolvida' ? 'valor' : 'motivo', valor: descrever(v.valor) }] }
    }
    if (Array.isArray(v)) {
      return { ...base, forma: 'vetor', rotulo: `Array(${v.length})`, total: v.length, itens: v.slice(0, MAX_ITENS).map((x, i) => ({ chave: String(i), valor: descrever(x) })) }
    }
    if (v instanceof Map) {
      return { ...base, forma: 'objeto', rotulo: `Map(${v.size})`, itens: [...v].slice(0, MAX_ITENS).map(([k, x]) => ({ chave: typeof k === 'string' ? k : textoPrimitivo(k), valor: descrever(x) })) }
    }
    if (v instanceof Set) {
      return { ...base, forma: 'vetor', rotulo: `Set(${v.size})`, total: v.size, itens: [...v].slice(0, MAX_ITENS).map((x, i) => ({ chave: String(i), valor: descrever(x) })) }
    }
    if (v instanceof Date) return { ...base, forma: 'objeto', rotulo: 'Date', itens: [{ chave: 'valor', valor: { texto: Number.isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString(), tipo: 'string' } }] }
    if (v instanceof Error) return { ...base, forma: 'objeto', rotulo: v.name, itens: [{ chave: 'message', valor: descrever(v.message) }] }
    const chaves = Object.keys(v)
    const rotulo = v.constructor && v.constructor !== Object ? v.constructor.name : '{ }'
    return { ...base, forma: 'objeto', rotulo, total: chaves.length, itens: chaves.slice(0, MAX_ITENS).map((k) => ({ chave: k, valor: descrever(v[k]) })) }
  }

  const variaveis = (quadro) => {
    if (!quadro.leitura) return []
    let valores
    try {
      valores = quadro.leitura()
    } catch {
      return []
    }
    return Object.entries(valores)
      .filter(([, v]) => !(typeof v === 'function' && v[GERADOR] && !tiposDeclarados[v.name])) // funções declaradas: barulho na tela
      .map(([nome, v]) => ({ nome, tipoDeclarado: tiposDeclarados[nome] ?? null, valor: descrever(v) }))
  }

  // (recursão funda: dezenas de milhares de quadros não cabem na tela nem no postMessage; ficam o de baixo e os de cima)
  const visiveis = rt.pilha.length <= MAX_QUADROS ? rt.pilha : [rt.pilha[0], ...rt.pilha.slice(-(MAX_QUADROS - 1))]
  const quadros = visiveis.map((q) => ({ nome: q.nome, linha: q.linha, variaveis: variaveis(q) }))
  // Depois do programa principal (callbacks de setTimeout, then...), as globais continuam valendo.
  if (rt.pilha[0] !== rt.principal) quadros.unshift({ nome: '(globais)', linha: rt.principal.linha, variaveis: variaveis(rt.principal), global: true })
  while (fila.length) objetos.push(expandir(fila.shift()))
  return { quadros, objetos, filas: rt.filas() }
}

// A pilha de ativação do diálogo (Ctrl+F3): o quadro de baixo é o corpo principal; cada chamada volta na linha atual de quem chamou.
export function pilhaDe(foto) {
  const quadros = (foto?.quadros ?? []).filter((q) => !q.global)
  return quadros.map((q, i) => i === 0 && q.nome === '(programa principal)'
    ? { tipo: 'Corpo Principal do Programa', nome: q.nome, linhaChamada: 0 }
    : { tipo: 'Funcao', nome: q.nome, assinatura: '', linhaChamada: quadros[i - 1]?.linha ?? 0 })
}
