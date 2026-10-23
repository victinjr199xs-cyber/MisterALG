// A "fotografia" da memória do programa C# para a tela de objetos (memoria-objetos.js): as chamadas na pilha
// com as variáveis de cada uma, e os objetos (cada um com um número, para as setas). Tudo vira dados simples.

import { Arr, Chr, Dbl, Dec, Flt, Num, Objeto, Tupla, ValorEnum, ehNumero } from './valores.js'
import { CULTURAS, textoGeral } from './formatar.js'
import { Multicast } from './operadores.js'
import { DictCS, ConjuntoCS, FilaCS, LigadaCS, ListaCS, PilhaCS, PrioridadeCS } from './biblioteca/colecoes.js'
import { SbCS } from './biblioteca/texto.js'
import { SeqCS } from './biblioteca/linq.js'
import { CronometroCS, DataCS, TempoCS } from './biblioteca/datas.js'
import { AleatorioCS } from './biblioteca/numeros.js'
import { MatchCS, GrupoCS, RegexCS } from './biblioteca/regex.js'
import { BigCS, CulturaCS, GuidCS, TarefaCS, ThreadAtualCS, TipoCS } from './biblioteca/sistema.js'

const MAX_OBJETOS = 80
const MAX_ITENS = 40

const aspas = (s) => JSON.stringify(s).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))

/** O texto de um valor "simples" como se escreve no código (3.14, "texto", 'a', true, null). null se for objeto. */
function simples(m, v) {
  if (v === null || v === undefined) return { texto: 'null', tipo: 'null' }
  if (typeof v === 'string') return { texto: aspas(v.length > 60 ? `${v.slice(0, 57)}...` : v), tipo: 'string' }
  if (typeof v === 'boolean') return { texto: String(v), tipo: 'bool' }
  if (typeof v === 'number') return { texto: String(v), tipo: 'int' }
  if (typeof v === 'bigint') return { texto: `${v}L`, tipo: 'long' }
  if (v instanceof Chr) return { texto: `'${String.fromCharCode(v.c)}'`, tipo: 'char' }
  if (v instanceof Dbl || v instanceof Flt || v instanceof Dec || v instanceof Num) {
    const k = m.nomeDoTipoDe(v)
    return { texto: textoGeral(v, CULTURAS.invariant) + (k === 'decimal' ? 'm' : k === 'float' ? 'f' : ''), tipo: k }
  }
  if (v instanceof ValorEnum) return { texto: `${v.def.nome}.${v.nome ?? v.v}`, tipo: v.def.nome }
  if (v instanceof Tupla) return { texto: `(${v.itens.map((x) => simples(m, x)?.texto ?? m.aTexto(x)).join(', ')})`, tipo: 'tupla' }
  return null
}

const VALORES_INLINE = [DataCS, TempoCS, GuidCS, BigCS, TipoCS, RegexCS, MatchCS, GrupoCS, CulturaCS, AleatorioCS, CronometroCS, TarefaCS, ThreadAtualCS]

export function fotografar(m) {
  const ids = new Map()
  const fila = []

  const descrever = (v) => {
    const s = simples(m, v)
    if (s) return s
    if (v && VALORES_INLINE.some((C) => v instanceof C)) return { texto: m.aTexto(v), tipo: m.nomeDoTipoDe(v) }
    if (v instanceof Multicast || v?.ehFunc) {
      let id = ids.get(v)
      if (id === undefined) {
        if (ids.size >= MAX_OBJETOS) return { texto: '…', tipo: 'delegate' }
        id = ids.size + 1
        ids.set(v, id)
        fila.push(v)
      }
      return { ref: id, tipo: 'delegate' }
    }
    let id = ids.get(v)
    if (id === undefined) {
      if (ids.size >= MAX_OBJETOS) return { texto: '…', tipo: m.nomeDoTipoDe(v) }
      id = ids.size + 1
      ids.set(v, id)
      fila.push(v)
    }
    return { ref: id, tipo: m.nomeDoTipoDe(v) }
  }

  const itensDe = (pares, total) => ({ total, itens: pares.slice(0, MAX_ITENS).map(([chave, valor]) => ({ chave, valor: descrever(valor) })) })

  const expandir = (v) => {
    const id = ids.get(v)
    const base = { id, tipo: m.nomeDoTipoDe(v) }
    if (v instanceof Objeto) {
      const pares = [...v.campos.entries()].filter(([k]) => !k.startsWith('_') || !v.cls.ehPrelude)
      if (v.cls.ehPrelude && v.campos.has('_mensagem')) pares.unshift(['Message', m.rodarSync(m.lerMembro(v, 'Message'))])
      const rotulo = v.cls.ehTipoValor ? `struct ${v.cls.nome}` : v.cls.ehRecord ? `record ${v.cls.nome}` : v.cls.nome
      return { ...base, rotulo, ...itensDe(pares, pares.length) }
    }
    if (v instanceof Arr) {
      if (v.dims) {
        const pares = v.itens.map((x, i) => {
          const idx = []
          let r = i
          for (let k = v.dims.length - 1; k >= 0; k -= 1) { idx.unshift(r % v.dims[k]); r = Math.floor(r / v.dims[k]) }
          return [`[${idx.join(',')}]`, x]
        })
        return { ...base, rotulo: `${v.tipoElem}[${v.dims.join(',')}]`, ...itensDe(pares, pares.length) }
      }
      return { ...base, rotulo: `${v.tipoElem}[${v.itens.length}]`, ...itensDe(v.itens.map((x, i) => [String(i), x]), v.itens.length) }
    }
    if (v instanceof ListaCS) return { ...base, rotulo: `${v.nomeCS()} (${v.itens.length})`, ...itensDe(v.itens.map((x, i) => [String(i), x]), v.itens.length) }
    if (v instanceof DictCS) {
      const e = v.entradas(m)
      return { ...base, rotulo: `${v.nomeCS()} (${e.length})`, ...itensDe(e.map((x) => [simples(m, x.k)?.texto ?? m.aTexto(x.k), x.v]), e.length) }
    }
    if (v instanceof ConjuntoCS) { const e = v.valores(m); return { ...base, rotulo: `${v.nomeCS()} (${e.length})`, ...itensDe(e.map((x, i) => [String(i), x]), e.length) } }
    if (v instanceof FilaCS) return { ...base, rotulo: `${v.nomeCS()} (${v.itens.length})`, ...itensDe(v.itens.map((x, i) => [String(i), x]), v.itens.length) }
    if (v instanceof PilhaCS) { const e = v.itens.slice().reverse(); return { ...base, rotulo: `${v.nomeCS()} (${e.length})`, ...itensDe(e.map((x, i) => [i === 0 ? 'topo' : String(i), x]), e.length) } }
    if (v instanceof LigadaCS) return { ...base, rotulo: `${v.nomeCS()} (${v.nos.length})`, ...itensDe(v.nos.map((n, i) => [String(i), n.Value]), v.nos.length) }
    if (v instanceof PrioridadeCS) return { ...base, rotulo: `${v.nomeCS()} (${v.itens.length})`, ...itensDe(v.itens.map((x) => [m.aTexto(x.p), x.e]), v.itens.length) }
    if (v instanceof SbCS) return { ...base, rotulo: 'StringBuilder', ...itensDe([['texto', v.s]], 1) }
    if (v instanceof SeqCS) return { ...base, rotulo: 'IEnumerable (ainda não percorrida)', itens: [], total: 0 }
    if (v.ehFunc || v instanceof Multicast) return { ...base, rotulo: v.md ? `ƒ ${v.md.nome}()` : v.nome ? `ƒ ${v.nome}()` : 'ƒ (lambda)', itens: [], total: 0 }
    return { ...base, rotulo: m.nomeDoTipoDe(v), itens: [], total: 0 }
  }

  const variaveisDe = (quadro) => {
    const escopos = []
    for (let a = quadro.atual ?? quadro.amb; a; a = a.pai) escopos.unshift(a)
    const vistos = new Set()
    const lista = []
    const este = quadro.amb?.ctx?.este
    for (const esc of escopos.slice().reverse()) {
      for (const [nome, ref] of [...esc.vars.entries()].reverse()) {
        if (vistos.has(nome)) continue
        vistos.add(nome)
        if (ref.v?.ehFunc && ref.t === 'Func') continue // função local: barulho na tela
        lista.unshift({ nome, tipoDeclarado: ref.t && ref.t !== 'var' ? ref.t : null, valor: descrever(ref.v) })
      }
    }
    if (este instanceof Objeto) lista.unshift({ nome: 'this', tipoDeclarado: este.cls.nome, valor: descrever(este) })
    return lista
  }

  const quadros = m.pilha.map((q) => ({ nome: q.nome, linha: q.linha, variaveis: variaveisDe(q) }))
  // Campos estáticos das classes do programa
  const estaticos = []
  for (const def of new Set(m.porNomeCompleto.values())) {
    if (def.ehPrelude || def.tipo === 'enum') continue
    for (const [nome, ref] of def.estaticos) estaticos.push({ nome: `${def.nome}.${nome}`, tipoDeclarado: ref.t, valor: descrever(ref.v) })
  }
  if (estaticos.length) quadros.unshift({ nome: '(campos estáticos)', linha: 0, variaveis: estaticos, global: true })
  const objetos = []
  while (fila.length) objetos.push(expandir(fila.shift()))
  return { quadros, objetos }
}

export { ehNumero }
