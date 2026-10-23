// Memória do programa C: um vetor de bytes de verdade, com globais, pilha e heap.
// Cada variável e cada bloco do malloc é um "bloco"; todo acesso confere se cai
// dentro de um bloco vivo. É isso que deixa o passo a passo apontar os erros que no
// C de verdade passam em silêncio (índice fora do vetor, ponteiro NULL, uso depois do free).

import { ErroC, EXPLICACOES } from './erros.js'
import { alinhar } from './tipos.js'

export const TAMANHO = 16 * 1024 * 1024
export const INICIO_ESTATICO = 0x1000
const TAMANHO_PILHA = 1024 * 1024
const GUARDA = 0x10000 // espaço vazio entre a pilha e o heap

export const hex = (n) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`

/** Busca binária: o bloco (de uma lista ordenada por início) que contém o endereço. */
function procurar(lista, endereco) {
  let a = 0
  let b = lista.length - 1
  while (a <= b) {
    const m = (a + b) >> 1
    const bloco = lista[m]
    if (endereco < bloco.inicio) b = m - 1
    else if (endereco >= bloco.fim && !(bloco.tamanho === 0 && endereco === bloco.inicio)) a = m + 1
    else return bloco
  }
  return null
}

export class Memoria {
  constructor() {
    this.bytes = new Uint8Array(TAMANHO)
    this.dv = new DataView(this.bytes.buffer)
    this.iniciado = new Uint8Array(TAMANHO) // 1 = o byte já recebeu um valor (senão é "lixo")
    this.estaticos = []
    this.pilha = []
    this.heap = []
    this.liberados = [] // blocos do heap já devolvidos (para as mensagens e para a tela)
    this.foraDeEscopo = [] // últimas variáveis locais que deixaram de existir
    this.topoEstatico = INICIO_ESTATICO
    this.semente = 0x2545f491
    this.blocosCriados = 0
  }

  // ---- alocação ---------------------------------------------------------------------

  alocarEstatico(tamanho, alinhamento, info) {
    const inicio = alinhar(this.topoEstatico, Math.max(alinhamento, 1))
    this.topoEstatico = inicio + Math.max(tamanho, 1)
    if (this.topoEstatico > TAMANHO / 4) throw new ErroC('as variáveis globais são grandes demais para o passo a passo')
    const bloco = { inicio, tamanho, fim: inicio + tamanho, regiao: 'global', vivo: true, ...info }
    this.estaticos.push(bloco)
    this.iniciado.fill(1, inicio, inicio + tamanho) // globais começam zeradas, como no C
    return inicio
  }

  /** Depois das globais: a pilha vem em seguida e o heap depois dela. */
  fixarPilha() {
    this.inicioPilha = alinhar(this.topoEstatico + 16, 16)
    this.topoPilha = this.inicioPilha
    this.limitePilha = this.inicioPilha + TAMANHO_PILHA
    this.inicioHeap = this.limitePilha + GUARDA
    this.livres = [{ inicio: this.inicioHeap, fim: TAMANHO }]
  }

  /** Memória nova da pilha e do malloc vem com "lixo", como no C de verdade. */
  sujar(inicio, fim) {
    let s = this.semente
    for (let i = inicio; i < fim; i += 1) {
      s ^= s << 13
      s ^= s >>> 17
      s ^= s << 5
      this.bytes[i] = s & 0xff
    }
    this.semente = s
    this.iniciado.fill(0, inicio, fim)
  }

  empilhar(tamanho, alinhamento, info) {
    const inicio = alinhar(this.topoPilha, Math.max(alinhamento, 1))
    const fim = inicio + tamanho
    if (fim > this.limitePilha) throw new ErroC('a pilha de chamadas estourou (recursão infinita?)', 0, EXPLICACOES.pilha)
    this.topoPilha = Math.max(fim, inicio + 1)
    this.sujar(inicio, fim)
    const bloco = { inicio, tamanho, fim, regiao: 'pilha', vivo: true, ...info }
    this.pilha.push(bloco)
    return inicio
  }

  desempilharAte(marca) {
    while (this.pilha.length && this.pilha[this.pilha.length - 1].inicio >= marca) {
      const bloco = this.pilha.pop()
      bloco.vivo = false
      this.foraDeEscopo.push(bloco)
      if (this.foraDeEscopo.length > 64) this.foraDeEscopo.shift()
    }
    this.topoPilha = marca
  }

  /** malloc/calloc: devolve 0 (NULL) se não couber. */
  malloc(n, zerar = false, info = {}) {
    const tamanho = Math.max(0, Math.floor(n))
    const ocupa = alinhar(Math.max(tamanho, 1), 8)
    const i = this.livres.findIndex((l) => l.fim - l.inicio >= ocupa)
    if (i < 0) return 0
    const livre = this.livres[i]
    const inicio = livre.inicio
    livre.inicio += ocupa
    if (livre.inicio === livre.fim) this.livres.splice(i, 1)
    this.blocosCriados += 1
    const bloco = { inicio, tamanho, fim: inicio + tamanho, ocupa, regiao: 'heap', vivo: true, numero: this.blocosCriados, ...info }
    const pos = this.heap.findIndex((b) => b.inicio > inicio)
    this.heap.splice(pos < 0 ? this.heap.length : pos, 0, bloco)
    if (zerar) {
      this.bytes.fill(0, inicio, bloco.fim)
      this.iniciado.fill(1, inicio, bloco.fim)
    } else this.sujar(inicio, bloco.fim)
    return inicio
  }

  free(endereco) {
    if (endereco === 0) return
    const i = this.heap.findIndex((b) => b.inicio === endereco)
    if (i < 0) {
      if (this.liberados.some((b) => b.inicio === endereco)) throw new ErroC('free() chamado duas vezes para o mesmo bloco', 0, EXPLICACOES.free)
      throw new ErroC(`free() recebeu um endereço (${hex(endereco)}) que não veio do malloc`, 0, EXPLICACOES.free)
    }
    const [bloco] = this.heap.splice(i, 1)
    bloco.vivo = false
    this.liberados.push(bloco)
    if (this.liberados.length > 32) this.liberados.shift()
    this.devolver(bloco.inicio, bloco.inicio + bloco.ocupa)
  }

  devolver(inicio, fim) {
    this.livres.push({ inicio, fim })
    this.livres.sort((a, b) => a.inicio - b.inicio)
    const juntos = []
    for (const l of this.livres) {
      const ultimo = juntos[juntos.length - 1]
      if (ultimo && ultimo.fim === l.inicio) ultimo.fim = l.fim
      else juntos.push({ ...l })
    }
    this.livres = juntos
  }

  // ---- blocos e verificação -----------------------------------------------------------

  bloco(endereco) {
    if (this.inicioHeap !== undefined && endereco >= this.inicioHeap) return procurar(this.heap, endereco)
    if (this.inicioPilha !== undefined && endereco >= this.inicioPilha) return procurar(this.pilha, endereco)
    return procurar(this.estaticos, endereco)
  }

  verificar(endereco, tamanho) {
    const b = this.bloco(endereco)
    if (b && endereco + tamanho <= b.fim) return b
    throw this.erroDeAcesso(endereco, b)
  }

  erroDeAcesso(endereco, bloco) {
    if (endereco < INICIO_ESTATICO) {
      return new ErroC(endereco === 0 ? 'acesso à memória por um ponteiro NULL' : `acesso a um endereço inválido (${hex(endereco)})`, 0, EXPLICACOES.nulo)
    }
    if (bloco) return new ErroC(`acesso além do fim de ${bloco.nome ?? 'um bloco de memória'}`, 0, EXPLICACOES.vetor)
    const contem = (b) => endereco >= b.inicio && endereco < Math.max(b.fim, b.inicio + 1)
    if (this.liberados.some(contem)) return new ErroC('acesso a uma memória que já foi liberada com free()', 0, EXPLICACOES.liberado)
    const local = this.foraDeEscopo.find(contem)
    if (local) return new ErroC(`acesso à variável local ${local.nome ?? ''} de uma função que já terminou`.replace('  ', ' '), 0, EXPLICACOES.escopo)
    const vizinho = [...this.estaticos, ...this.pilha, ...this.heap].find((b) => endereco >= b.fim && endereco < b.fim + 64)
    if (vizinho) return new ErroC(`acesso além do fim de ${vizinho.nome ?? 'um bloco de memória'}`, 0, EXPLICACOES.vetor)
    return new ErroC(`acesso a um endereço inválido (${hex(endereco)})`, 0, EXPLICACOES.invalido)
  }

  // ---- leitura e escrita ---------------------------------------------------------------

  ler(t, e) {
    this.verificar(e, t.tamanho || 1)
    const dv = this.dv
    if (t.k === 'int') {
      if (t.bool) return dv.getUint8(e) ? 1 : 0
      switch (t.tamanho) {
        case 1: return t.sinal ? dv.getInt8(e) : dv.getUint8(e)
        case 2: return t.sinal ? dv.getInt16(e, true) : dv.getUint16(e, true)
        case 4: return t.sinal ? dv.getInt32(e, true) : dv.getUint32(e, true)
        case 8: return t.sinal ? dv.getBigInt64(e, true) : dv.getBigUint64(e, true)
        default: return dv.getBigInt64(e, true)
      }
    }
    if (t.k === 'real') return t.tamanho === 4 ? dv.getFloat32(e, true) : dv.getFloat64(e, true)
    if (t.k === 'ptr' || t.k === 'ref') return dv.getUint32(e, true)
    throw new ErroC(`leitura de um valor do tipo ${t.nome}`)
  }

  escrever(t, e, v) {
    this.verificar(e, t.tamanho || 1)
    const dv = this.dv
    if (t.k === 'int') {
      if (t.bool) dv.setUint8(e, v ? 1 : 0)
      else if (t.tamanho === 1) dv.setUint8(e, Number(v) & 0xff)
      else if (t.tamanho === 2) dv.setUint16(e, Number(v) & 0xffff, true)
      else if (t.tamanho === 4) dv.setUint32(e, Number(v) >>> 0, true)
      else dv.setBigUint64(e, BigInt.asUintN(64, BigInt(v)), true)
    } else if (t.k === 'real') {
      if (t.tamanho === 4) dv.setFloat32(e, Number(v), true)
      else dv.setFloat64(e, Number(v), true)
    } else if (t.k === 'ptr' || t.k === 'ref') dv.setUint32(e, Number(v) >>> 0, true)
    else throw new ErroC(`escrita de um valor do tipo ${t.nome}`)
    this.iniciado.fill(1, e, e + t.tamanho)
  }

  /** Copia bytes (atribuição de struct, memcpy...), levando junto a marca de "já tem valor". */
  copiar(destino, origem, n) {
    if (n <= 0) return
    this.verificar(origem, n)
    this.verificar(destino, n)
    this.bytes.copyWithin(destino, origem, origem + n)
    this.iniciado.copyWithin(destino, origem, origem + n)
  }

  lerBytes(e, n) {
    if (n > 0) this.verificar(e, n)
    return { bytes: this.bytes.slice(e, e + n), iniciado: this.iniciado.slice(e, e + n) }
  }

  gravarBytes(e, { bytes, iniciado }) {
    if (!bytes.length) return
    this.verificar(e, bytes.length)
    this.bytes.set(bytes, e)
    this.iniciado.set(iniciado, e)
  }

  preencher(e, valor, n) {
    if (n <= 0) return
    this.verificar(e, n)
    this.bytes.fill(valor & 0xff, e, e + n)
    this.iniciado.fill(1, e, e + n)
  }

  temValor(e, n) {
    for (let i = e; i < e + n; i += 1) if (!this.iniciado[i]) return false
    return true
  }

  /** Texto C (até o '\0') como "texto binário": cada caractere do JS é um byte. */
  cadeia(e, limite = Infinity) {
    let s = ''
    for (let i = 0; i < limite; i += 1) {
      this.verificar(e + i, 1)
      const b = this.bytes[e + i]
      if (b === 0) return s
      s += String.fromCharCode(b)
      if (s.length > 1 << 20) throw new ErroC('texto sem o \\0 no final')
    }
    return s
  }

  /** Grava um texto binário e, se pedido, o '\0' do final. */
  gravarCadeia(e, s, comZero = true) {
    const n = s.length + (comZero ? 1 : 0)
    if (n === 0) return
    this.verificar(e, n)
    for (let i = 0; i < s.length; i += 1) this.bytes[e + i] = s.charCodeAt(i) & 0xff
    if (comZero) this.bytes[e + s.length] = 0
    this.iniciado.fill(1, e, e + n)
  }
}
