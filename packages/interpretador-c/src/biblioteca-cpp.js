// Biblioteca do C++ no passo a passo. string e vector são objetos de verdade na
// memória — { ponteiro para os dados no heap, tamanho, capacidade } — e por isso
// aparecem na tela de memória com uma seta até o bloco onde os dados moram.
// Cada função recebe (maquina, { objeto, args, destino, classe, decl, tipoFn }).

import { ErroC } from './erros.js'
import { escanear, formatar } from './formatos.js'
import { CHAR, DOUBLE, INT, SIZE_T, layout, ponteiro, tamanhoDe } from './tipos.js'

const NPOS = 4294967295
const PCHAR = ponteiro(CHAR)

// ---- string ----------------------------------------------------------------------

const ehString = (t) => t?.k === 'struct' && t.rotulo === 'string'

function lerTexto(m, s) {
  const dados = m.mem.ler(PCHAR, s)
  const n = m.mem.ler(SIZE_T, s + 4)
  if (!dados || !n) return ''
  m.mem.verificar(dados, n)
  let r = ''
  for (let i = 0; i < n; i += 1) r += String.fromCharCode(m.mem.bytes[dados + i])
  return r
}

function gravarTexto(m, s, texto) {
  let dados = m.mem.ler(PCHAR, s)
  let cap = m.mem.ler(SIZE_T, s + 8)
  if (!dados || texto.length > cap) {
    const nova = Math.max(15, texto.length, cap * 2)
    const bloco = m.mem.malloc(nova + 1, false, { tipoElem: CHAR })
    if (!bloco) throw new ErroC('não há memória para o texto')
    if (dados) m.mem.free(dados)
    dados = bloco
    cap = nova
    m.mem.escrever(PCHAR, s, dados)
    m.mem.escrever(SIZE_T, s + 8, cap)
  }
  m.mem.gravarCadeia(dados, texto)
  m.mem.escrever(SIZE_T, s + 4, texto.length)
}

function novaString(m, destino, texto) {
  m.mem.preencher(destino, 0, 12)
  gravarTexto(m, destino, texto)
  return destino
}

/** Texto de um argumento: string, const char* ou char. */
function textoDe(m, a) {
  const t = a.tipo.k === 'ref' ? a.tipo.alvo : a.tipo
  if (ehString(t)) return lerTexto(m, a.valor)
  if (t.k === 'ptr') return m.cadeia(a.valor)
  return String.fromCharCode(Number(a.valor) & 0xff)
}

const n0 = (args, i, padrao) => (args[i] === undefined ? padrao : Number(args[i].valor))

/** find_first_of / find_last_of / ..._not_of: a primeira (ou última) posição com uma letra que está (ou não) em `letras`. */
function procurarLetras(s, letras, pos, dentro, paraFrente) {
  if (paraFrente) {
    for (let i = pos; i < s.length; i += 1) if (letras.includes(s[i]) === dentro) return i
  } else {
    for (let i = Math.min(pos, s.length - 1); i >= 0; i -= 1) if (letras.includes(s[i]) === dentro) return i
  }
  return NPOS
}

function* textoParaInteiro(m, args, nome) {
  const t = lerTexto(m, args[0].valor).trimStart()
  const r = /^[-+]?\d+/.exec(t)
  if (!r) yield* m.lancarDaBiblioteca('invalid_argument', `${nome}: o texto não é um número inteiro`)
  return BigInt(r[0])
}

function posicaoNoTexto(m, s, i, nome) {
  const n = m.mem.ler(SIZE_T, s + 4)
  if (i < 0 || i > n) throw new ErroC(`${nome}: posição ${i} fora do texto (que tem ${n} caracteres)`, 0, 'As posições de uma string vão de 0 a size()-1.')
  return m.mem.ler(PCHAR, s) + i
}

// ---- vector ----------------------------------------------------------------------

const elementoDe = (m, classe) => m.tipos.de(m.registros.get(classe).campos[0].tipo).alvo

function* copiarElemento(m, destino, origem, t) {
  if (t.k === 'struct') yield* m.copiarObjeto(destino, origem, t)
  else m.mem.copiar(destino, origem, tamanhoDe(t))
}

/** Garante espaço para n elementos (troca o bloco do heap por um maior, como o vector de verdade). */
function garantir(m, v, t, n) {
  const cap = m.mem.ler(SIZE_T, v + 8)
  if (n <= cap) return
  const tam = tamanhoDe(t)
  const nova = Math.max(n, cap * 2, 1)
  const bloco = m.mem.malloc(nova * tam, false, { tipoElem: t })
  if (!bloco) throw new ErroC('não há memória para o vector crescer')
  const antigo = m.mem.ler(ponteiro(t), v)
  const usados = m.mem.ler(SIZE_T, v + 4)
  if (antigo) {
    m.mem.copiar(bloco, antigo, usados * tam)
    m.mem.free(antigo)
  }
  m.mem.escrever(ponteiro(t), v, bloco)
  m.mem.escrever(SIZE_T, v + 8, nova)
}

function* destruirElementos(m, v, t, de, ate) {
  if (!m.precisaDestruir(t)) return
  const dados = m.mem.ler(ponteiro(t), v)
  // do primeiro para o último, como a libstdc++ (std::_Destroy)
  for (let i = de; i < ate; i += 1) yield* m.destruirObjeto(dados + i * tamanhoDe(t), t)
}

function indiceDoVector(m, v, i, nome) {
  const n = m.mem.ler(SIZE_T, v + 4)
  if (i < 0 || i >= n) {
    throw new ErroC(`${nome}: índice ${i} fora do vector (ele tem ${n} elementos: posições 0 a ${n - 1})`, 0,
      'As posições de um vector vão de 0 a size()-1. Use push_back para aumentar o vector.')
  }
}

// ---- iostream ----------------------------------------------------------------------

const novoEstado = () => ({
  precisao: 6, fixo: false, cientifico: false, largura: 0, preenchimento: ' ', alinhamento: 'direita', base: 10,
  boolalpha: false, ponto: false, sinal: false, maiusculas: false, falhou: false,
})

/** O estado de um fluxo (cout, cin, uma stringstream): formatação e se a última leitura falhou. */
function estado(m, objeto) {
  m.fluxos ??= new Map()
  let e = m.fluxos.get(objeto)
  if (!e) {
    e = novoEstado()
    m.fluxos.set(objeto, e)
  }
  return e
}

function escreverNoFluxo(m, objeto, texto, numero = false) {
  const e = estado(m, objeto)
  if (e.largura > texto.length) {
    const falta = e.preenchimento.repeat(e.largura - texto.length)
    if (e.alinhamento === 'esquerda') texto += falta
    else if (e.alinhamento === 'interno' && numero && /^[-+]/.test(texto)) texto = texto[0] + falta + texto.slice(1)
    else texto = falta + texto
  }
  e.largura = 0
  if (e.texto) gravarTexto(m, e.texto, lerTexto(m, e.texto) + texto) // stringstream: vai para o texto dela
  else m.saida(texto)
}

/** De onde o fluxo lê: a entrada do programa ou o texto de uma stringstream. */
function leitorDe(m, objeto) {
  const e = estado(m, objeto)
  if (!e.texto) return m.leitor
  e.leitor ??= {
    * espiar() {
      const n = m.mem.ler(SIZE_T, e.texto + 4)
      const pos = m.mem.ler(SIZE_T, e.posicao)
      if (pos >= n) {
        e.fim = true
        return -1
      }
      return m.mem.bytes[m.mem.ler(PCHAR, e.texto) + pos]
    },
    avancar() { m.mem.escrever(SIZE_T, e.posicao, m.mem.ler(SIZE_T, e.posicao) + 1) },
  }
  return e.leitor
}

function* lerDoFluxo(m, objeto, formato, gravar) {
  const e = estado(m, objeto)
  if (e.falhou) return
  const r = yield* escanear(leitorDe(m, objeto), formato, gravar)
  if (r !== 1) e.falhou = true
}

function* lerPalavra(leitor) {
  const espaco = (c) => c === 32 || (c >= 9 && c <= 13)
  while (espaco(yield* leitor.espiar())) leitor.avancar()
  let s = ''
  for (;;) {
    const c = yield* leitor.espiar()
    if (c === -1 || espaco(c)) break
    s += String.fromCharCode(c)
    leitor.avancar()
  }
  return s
}

/** Um número escrito com <<, conforme os manipuladores (hex, boolalpha, scientific, showpos...). */
function numeroNoFluxo(e, t, valor) {
  if (t.bool) return e.boolalpha ? (valor ? 'true' : 'false') : valor ? '1' : '0'
  if (t.k === 'int') {
    if (e.base !== 10) {
      const s = BigInt.asUintN(t.tamanho * 8, BigInt(valor)).toString(e.base)
      return e.maiusculas ? s.toUpperCase() : s
    }
    const s = String(valor)
    return e.sinal && !s.startsWith('-') ? `+${s}` : s
  }
  const conversao = e.fixo && e.cientifico ? 'a' : e.fixo ? 'f' : e.cientifico ? 'e' : 'g'
  const flags = `${e.sinal ? '+' : ''}${e.ponto ? '#' : ''}`
  return formatar(`%${flags}.${e.precisao}${e.maiusculas ? conversao.toUpperCase() : conversao}`, [{ valor, tipo: DOUBLE }])
}

// Manipuladores sem argumento (cout << left << hex...): o que cada um muda no estado do fluxo.
const MANIPULADORES = {
  fixed: { fixo: true, cientifico: false },
  scientific: { fixo: false, cientifico: true },
  defaultfloat: { fixo: false, cientifico: false },
  left: { alinhamento: 'esquerda' },
  right: { alinhamento: 'direita' },
  internal: { alinhamento: 'interno' },
  boolalpha: { boolalpha: true },
  noboolalpha: { boolalpha: false },
  showpoint: { ponto: true },
  noshowpoint: { ponto: false },
  showpos: { sinal: true },
  noshowpos: { sinal: false },
  uppercase: { maiusculas: true },
  nouppercase: { maiusculas: false },
  hex: { base: 16 },
  dec: { base: 10 },
  oct: { base: 8 },
}

// ---- unordered_map: a dispersão e os tamanhos da libstdc++ ----------------------------

const M64 = (1n << 64n) - 1n
const MUL = (0xc6a4a793n << 32n) + 0x5bd1e995n
const misturar = (v) => v ^ (v >> 47n)

/** _Hash_bytes da libstdc++ (MurmurHash2 de 64 bits, semente 0xc70f6907): é o std::hash de string e double. */
function hashBytes(bytes) {
  const n = bytes.length
  let h = (0xc70f6907n ^ ((BigInt(n) * MUL) & M64)) & M64
  const alinhado = n & ~7
  for (let i = 0; i < alinhado; i += 8) {
    let d = 0n
    for (let k = 7; k >= 0; k -= 1) d = (d << 8n) | BigInt(bytes[i + k])
    h ^= (misturar((d * MUL) & M64) * MUL) & M64
    h = (h * MUL) & M64
  }
  if (n & 7) {
    let d = 0n
    for (let k = (n & 7) - 1; k >= 0; k -= 1) d = (d << 8n) | BigInt(bytes[alinhado + k])
    h ^= d
    h = (h * MUL) & M64
  }
  h = (misturar(h) * MUL) & M64
  return misturar(h)
}

// Os números de baldes da libstdc++ (_Prime_rehash_policy): poucos baldes vêm da tabela rápida, o resto dos primos.
const BALDES_RAPIDOS = [2, 2, 2, 3, 5, 5, 7, 7, 11, 11, 11, 11, 13, 13]
const PRIMOS = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 103, 109, 113, 127, 137, 139, 149, 157,
  167, 179, 193, 199, 211, 227, 241, 257, 277, 293, 313, 337, 359, 383, 409, 439, 467, 503, 541, 577, 619, 661, 709, 761, 823, 887,
  953, 1031, 1109, 1193, 1289, 1381, 1493, 1613, 1741, 1879, 2029, 2179, 2357, 2549, 2753, 2971, 3209, 3469, 3739, 4027, 4349, 4703,
  5087, 5503, 5953, 6427, 6949, 7517, 8123, 8783, 9497, 10273, 11113, 12011, 12983, 14033, 15173, 16411, 17749, 19183, 20753, 22447,
  24281, 26267, 28411, 30727, 33223, 35933, 38873, 42043, 45481, 49201, 53201, 57557, 62233, 67307, 72817, 78779, 85229, 92203,
  99733, 107897, 116731, 126271, 136607, 147793, 159871, 172933, 187091, 202409, 218971, 236897, 256279, 277261, 299951, 324503,
  351061, 379787, 410857, 444487, 480881, 520241, 562841, 608903, 658753, 712697, 771049, 834181, 902483, 976369, 1056323, 1142821,
  1236397, 1337629, 1447153, 1565659, 1693859, 1832561, 1982627, 2144977, 2320627, 2510653, 2716249, 2938679, 3179303]

function proximoPrimo(n) {
  if (n < BALDES_RAPIDOS.length) return n === 0 ? 1 : BALDES_RAPIDOS[n]
  return PRIMOS.find((p) => p >= n) ?? n * 2 + 1
}

// ---- sort e heap (em JavaScript; o C++ só passa os iteradores e o comparador) --------

/**
 * Os elementos entre dois iteradores de acesso aleatório: { n, tipo, end(k) } — ponteiro (vector, array,
 * string), iterator de deque ou reverse_iterator de um deles.
 */
function intervalo(m, ini, fim) {
  const ti = ini.tipo.k === 'ref' ? ini.tipo.alvo : ini.tipo
  const posicao = (t, e) => { // { tipo, end(k) } a partir do iterador guardado em e
    if (t.k === 'ptr') {
      const p = Number(m.mem.ler(t, e))
      return { tipo: t.alvo, end: (k) => p + k * tamanhoDe(t.alvo), indice: p / Math.max(1, tamanhoDe(t.alvo)) }
    }
    const campos = layout(t).campos
    const campo = (n) => campos.find((c) => c.nome === n)
    if (/^reverse_iterator</.test(t.rotulo)) {
      const base = campo('__base')
      const b = posicao(base.tipo, e + base.deslocamento)
      return { tipo: b.tipo, end: (k) => b.end(-(k + 1)), indice: -b.indice }
    }
    if (/^__it_deque</.test(t.rotulo)) {
      const d = Number(m.mem.ler(campo('__d').tipo, e + campo('__d').deslocamento))
      const i = Number(m.mem.ler(campo('__i').tipo, e + campo('__i').deslocamento))
      const cd = layout(campo('__d').tipo.alvo).campos
      const ler = (n) => { const c = cd.find((x) => x.nome === n); return Number(m.mem.ler(c.tipo, d + c.deslocamento)) }
      const tipo = cd.find((x) => x.nome === '__dados').tipo.alvo
      const [dados, inicio, cap] = [ler('__dados'), ler('__inicio'), ler('__capacidade')]
      return { tipo, end: (k) => dados + ((inicio + i + k) % cap) * tamanhoDe(tipo), indice: i }
    }
    throw new ErroC(`o passo a passo não sabe percorrer este iterador (${t.nome})`)
  }
  // os iteradores chegam por valor: ponteiro = o próprio valor; objeto = o endereço dele
  const guardar = (a) => {
    if (ti.k !== 'ptr') return a.valor
    const e = m.rascunho(4)
    m.mem.escrever(ti, e, a.valor)
    return e
  }
  const a = posicao(ti, guardar(ini))
  const b = posicao(ti, guardar(fim))
  return { n: Math.max(0, Math.round(b.indice - a.indice)), tipo: a.tipo, end: a.end }
}

/** O comparador (ponteiro de função, lambda ou objeto com operator()) como um gerador (a, b) => booleano. */
function comparador(m, comp, t) {
  const tc = comp.tipo.k === 'ref' ? comp.tipo.alvo : comp.tipo
  const argumento = (e, p) => {
    if (p.k === 'ref' || p.k === 'struct') return e
    return m.converter(m.mem.ler(t, e), t, p)
  }
  if (tc.k === 'ptr') {
    const p = Number(m.mem.ler(tc, comp.valor))
    const nome = m.funcaoNoEndereco.get(p)
    const def = nome && m.funcoes.get(nome)
    if (!def) throw new ErroC('a função de comparação não foi encontrada')
    const params = m.tipos.de(def.type).params
    return function* comparar(a, b) {
      return m.verdade(yield* m.chamarFuncao(def, [argumento(a, params[0]), argumento(b, params[1])], m.linhaAtual))
    }
  }
  const combina = (p) => {
    const alvo = p?.k === 'ref' ? p.alvo : p
    return alvo === t || (alvo && alvo.k === t.k && alvo.k !== 'struct' && alvo.tamanho === t.tamanho)
  }
  const metodos = (m.registroDe(tc)?.metodos ?? []).filter((x) => x.name === 'operator()' && m.tipos.de(x.type).params?.length === 2)
  // lambda com auto ou less<>: o clang escreveu um operator() para cada tipo usado; vale o deste elemento
  const decl = metodos.find((x) => m.tipos.de(x.type).params.every(combina)) ?? metodos[0]
  if (!decl) throw new ErroC(`${tc.nome} não serve para comparar (falta o operator())`)
  const params = m.tipos.de(decl.type).params
  return function* comparar(a, b) {
    const args = [a, b].map((e, i) => ({ valor: argumento(e, params[i]), tipo: params[i] }))
    return m.verdade(yield* m.invocar(decl, tc.rotulo, comp.valor, args, undefined))
  }
}

/** Ordenações e heaps sobre um intervalo da memória, com os algoritmos da libstdc++ (os empates saem iguais). */
function algoritmos(m, { n, tipo, end }, menor) {
  const tam = tamanhoDe(tipo)
  const valor = m.rascunho(Math.max(1, tam)) // o "auto valor = *i" dos algoritmos
  const copiar = (destino, origem) => m.mem.copiar(destino, origem, tam)
  const trocar = (i, j) => {
    const x = m.mem.lerBytes(end(i), tam)
    copiar(end(i), end(j))
    m.mem.gravarBytes(end(j), x)
  }
  const a = {
    * empurrarHeap() { // push_heap: o último (o novo) sobe até o lugar dele
      if (n < 1) return
      copiar(valor, end(n - 1))
      yield* a.subirHeap(n - 1, 0)
    },
    * tirarDoHeap() { // pop_heap: o maior vai para o fim
      if (n > 1) yield* a.tirarHeap(n - 1, n - 1)
    },
    * subirHeap(buraco, topo) { // __push_heap, com o valor guardado em `valor`
      let pai = Math.trunc((buraco - 1) / 2)
      while (buraco > topo && (yield* menor(end(pai), valor))) {
        copiar(end(buraco), end(pai))
        buraco = pai
        pai = Math.trunc((buraco - 1) / 2)
      }
      copiar(end(buraco), valor)
    },
    * ajustarHeap(buraco, tamanho) { // __adjust_heap
      const topo = buraco
      let filho = buraco
      while (filho < Math.trunc((tamanho - 1) / 2)) {
        filho = 2 * (filho + 1)
        if (yield* menor(end(filho), end(filho - 1))) filho -= 1
        copiar(end(buraco), end(filho))
        buraco = filho
      }
      if ((tamanho & 1) === 0 && filho === Math.trunc((tamanho - 2) / 2)) {
        filho = 2 * (filho + 1)
        copiar(end(buraco), end(filho - 1))
        buraco = filho - 1
      }
      yield* a.subirHeap(buraco, topo)
    },
    * tirarHeap(fim, resultado) { // __pop_heap(first, last, result)
      copiar(valor, end(resultado))
      copiar(end(resultado), end(0))
      yield* a.ajustarHeap(0, fim)
    },
    * fazerHeap(tamanho) {
      if (tamanho < 2) return
      for (let pai = Math.trunc((tamanho - 2) / 2); ; pai -= 1) {
        copiar(valor, end(pai))
        yield* a.ajustarHeap(pai, tamanho)
        if (pai === 0) return
      }
    },
    * selecionarHeap(meio) { // __heap_select: os `meio` menores ficam num heap no começo
      yield* a.fazerHeap(meio)
      for (let i = meio; i < n; i += 1) if (yield* menor(end(i), end(0))) yield* a.tirarHeap(meio, i)
    },
    * ordenarHeap(tamanho) {
      for (let fim = tamanho; fim > 1; fim -= 1) yield* a.tirarHeap(fim - 1, fim - 1)
    },
    * inserirSemGuarda(fim) { // __unguarded_linear_insert
      copiar(valor, end(fim))
      let prox = fim - 1
      while (yield* menor(valor, end(prox))) {
        copiar(end(fim), end(prox))
        fim = prox
        prox -= 1
      }
      copiar(end(fim), valor)
    },
    * insercao(ini, fim) { // __insertion_sort
      for (let i = ini + 1; i < fim; i += 1) {
        if (yield* menor(end(i), end(ini))) {
          copiar(valor, end(i))
          for (let j = i; j > ini; j -= 1) copiar(end(j), end(j - 1))
          copiar(end(ini), valor)
        } else yield* a.inserirSemGuarda(i)
      }
    },
    * medianaParaOInicio(r, x, y, z) {
      if (yield* menor(end(x), end(y))) {
        if (yield* menor(end(y), end(z))) trocar(r, y)
        else if (yield* menor(end(x), end(z))) trocar(r, z)
        else trocar(r, x)
      } else if (yield* menor(end(x), end(z))) trocar(r, x)
      else if (yield* menor(end(y), end(z))) trocar(r, z)
      else trocar(r, y)
    },
    * particionar(primeiro, ultimo, pivo) { // __unguarded_partition
      for (;;) {
        while (yield* menor(end(primeiro), end(pivo))) primeiro += 1
        ultimo -= 1
        while (yield* menor(end(pivo), end(ultimo))) ultimo -= 1
        if (!(primeiro < ultimo)) return primeiro
        trocar(primeiro, ultimo)
        primeiro += 1
      }
    },
    * introsort(ini, fim, profundidade) { // __introsort_loop
      while (fim - ini > 16) {
        if (profundidade === 0) { // __partial_sort(first, last, last): heapsort do resto
          const sub = algoritmos(m, { n: fim - ini, tipo, end: (k) => end(ini + k) }, menor)
          yield* sub.fazerHeap(fim - ini)
          yield* sub.ordenarHeap(fim - ini)
          return
        }
        profundidade -= 1
        const meio = ini + Math.trunc((fim - ini) / 2)
        yield* a.medianaParaOInicio(ini, ini + 1, meio, fim - 1)
        const corte = yield* a.particionar(ini + 1, fim, ini)
        yield* a.introsort(corte, fim, profundidade)
        fim = corte
      }
    },
    * ordenar() {
      if (n < 2) return
      yield* a.introsort(0, n, 2 * Math.floor(Math.log2(n)))
      if (n > 16) {
        yield* a.insercao(0, 16)
        for (let i = 16; i < n; i += 1) yield* a.inserirSemGuarda(i)
      } else yield* a.insercao(0, n)
    },
    * ordenarEstavel() { // intercalação (o resultado de uma ordenação estável é um só)
      if (n < 2) return
      const aux = m.mem.malloc(n * tam, false, { tipoElem: tipo })
      try {
        const e2 = (k) => aux + k * tam
        for (let largura = 1; largura < n; largura *= 2) {
          for (let k = 0; k < n; k += 1) copiar(e2(k), end(k))
          for (let ini = 0; ini < n; ini += 2 * largura) {
            const meio = Math.min(ini + largura, n)
            const fim = Math.min(ini + 2 * largura, n)
            let i = ini
            let j = meio
            for (let k = ini; k < fim; k += 1) {
              if (i < meio && (j >= fim || !(yield* menor(e2(j), e2(i))))) copiar(end(k), e2(i++))
              else copiar(end(k), e2(j++))
            }
          }
        }
      } finally {
        m.mem.free(aux)
      }
    },
  }
  return a
}

/** Os nativos de sort/heap: (início, fim, comparador) → roda o algoritmo e libera o espaço de rascunho. */
const sobreIntervalo = (acao) => function* nativo(m, { args }) {
  const marca = m.mem.topoPilha
  try {
    const iv = intervalo(m, args[0], args[1])
    yield* acao(algoritmos(m, iv, comparador(m, args[2], iv.tipo)), iv.n)
  } finally {
    m.mem.desempilharAte(marca)
  }
}

// ---- a árvore AVL de map/set (cabecalhos-stl.js: os nós são C++, o resto é aqui) --------

/** Os campos de um __no_arvore<V>: ler/gravar ponteiros e a altura, e onde fica a chave. */
function noDaArvore(m, tipoNo, primeiro = 0) {
  const campos = layout(tipoNo).campos
  const campo = (n) => campos.find((c) => c.nome === n)
  const [valor, esq, dir, pai, altura] = ['valor', 'esq', 'dir', 'pai', 'altura'].map(campo)
  const ler = (c) => (n) => (n ? Number(m.mem.ler(c.tipo, n + c.deslocamento)) : 0)
  const gravar = (c) => (n, v) => m.mem.escrever(c.tipo, n + c.deslocamento, v)
  const first = primeiro ? layout(valor.tipo).campos.find((c) => c.nome === 'first') : null
  return {
    esq: ler(esq), dir: ler(dir), pai: ler(pai), altura: ler(altura),
    porEsq: gravar(esq), porDir: gravar(dir), porPai: gravar(pai), porAltura: gravar(altura),
    tipoPonteiro: esq.tipo,
    tipoChave: first ? first.tipo : valor.tipo,
    chave: (n) => n + valor.deslocamento + (first ? first.deslocamento : 0),
  }
}

function minimo(a, n) { while (n && a.esq(n)) n = a.esq(n); return n }
function maximo(a, n) { while (n && a.dir(n)) n = a.dir(n); return n }
function seguinte(a, n) {
  if (a.dir(n)) return minimo(a, a.dir(n))
  while (a.pai(n) && n === a.dir(a.pai(n))) n = a.pai(n)
  return a.pai(n)
}
function antecessor(a, n) {
  if (a.esq(n)) return maximo(a, a.esq(n))
  while (a.pai(n) && n === a.esq(a.pai(n))) n = a.pai(n)
  return a.pai(n)
}

/** Ligações e rebalanceamento (AVL) com a raiz guardada no endereço `raiz`. */
function avl(m, a, raiz) {
  const alt = (n) => (n ? a.altura(n) : 0)
  const atualizar = (n) => a.porAltura(n, Math.max(alt(a.esq(n)), alt(a.dir(n))) + 1)
  const trocarFilho = (pai, velho, novo) => {
    if (!pai) m.mem.escrever(a.tipoPonteiro, raiz, novo)
    else if (a.esq(pai) === velho) a.porEsq(pai, novo)
    else a.porDir(pai, novo)
    if (novo) a.porPai(novo, pai)
  }
  const girarEsq = (x) => {
    const y = a.dir(x)
    a.porDir(x, a.esq(y))
    if (a.esq(y)) a.porPai(a.esq(y), x)
    trocarFilho(a.pai(x), x, y)
    a.porEsq(y, x)
    a.porPai(x, y)
    atualizar(x)
    atualizar(y)
    return y
  }
  const girarDir = (x) => {
    const y = a.esq(x)
    a.porEsq(x, a.dir(y))
    if (a.dir(y)) a.porPai(a.dir(y), x)
    trocarFilho(a.pai(x), x, y)
    a.porDir(y, x)
    a.porPai(x, y)
    atualizar(x)
    atualizar(y)
    return y
  }
  const rebalancear = (n) => {
    while (n) {
      atualizar(n)
      const f = alt(a.esq(n)) - alt(a.dir(n))
      if (f > 1) {
        if (alt(a.esq(a.esq(n))) < alt(a.dir(a.esq(n)))) girarEsq(a.esq(n))
        n = girarDir(n)
      } else if (f < -1) {
        if (alt(a.dir(a.dir(n))) < alt(a.esq(a.dir(n)))) girarDir(a.dir(n))
        n = girarEsq(n)
      }
      n = a.pai(n)
    }
  }
  return { trocarFilho, rebalancear }
}

const tipoDoNo = (arg) => (arg.tipo.k === 'ref' ? arg.tipo.alvo : arg.tipo).alvo

// ---- a tabela de dispersão de unordered_* (como a da libstdc++; os nós são C++) ---------

/** Os campos de um __tabela (no endereço t) e dos nós dele. Os baldes apontam para o nó antes do primeiro do balde. */
function tabelaHash(m, tArg, primeiro = 0) {
  const t = Number(tArg.valor)
  const campos = layout(tipoDoNo(tArg)).campos
  const campo = (n) => campos.find((c) => c.nome === n)
  const [baldes, numBaldes, prim, tamanho, aumento] = ['__baldes', '__num_baldes', '__primeiro', '__tamanho', '__proximo_aumento'].map(campo)
  const tipoNo = prim.tipo.alvo
  const camposNo = layout(tipoNo).campos
  const [prox, codigo, valor] = ['prox', 'codigo', 'valor'].map((n) => camposNo.find((c) => c.nome === n))
  const first = primeiro ? layout(valor.tipo).campos.find((c) => c.nome === 'first') : null
  const ler = (c, base = t) => m.mem.ler(c.tipo, base + c.deslocamento)
  const gravar = (c, v, base = t) => m.mem.escrever(c.tipo, base + c.deslocamento, v)
  const h = {
    antes: t + prim.deslocamento, // o "nó" cujo prox é o __primeiro
    tipoPonteiro: prim.tipo,
    baldes: () => Number(ler(baldes)),
    num: () => BigInt(ler(numBaldes)),
    tamanho: () => Number(ler(tamanho)),
    prox: (n) => Number(m.mem.ler(prox.tipo, n + prox.deslocamento)),
    porProx: (n, v) => m.mem.escrever(prox.tipo, n + prox.deslocamento, v),
    codigo: (n) => BigInt(m.mem.ler(codigo.tipo, n + codigo.deslocamento)),
    chave: (n) => n + valor.deslocamento + (first ? first.deslocamento : 0),
    tipoChave: first ? first.tipo : valor.tipo,
    balde: (c) => Number(BigInt(c) % h.num()),
    noBalde: (b) => Number(m.mem.ler(prim.tipo, h.baldes() + b * 4)),
    porBalde: (b, v) => m.mem.escrever(prim.tipo, h.baldes() + b * 4, v),
    aumento: () => BigInt(ler(aumento)),
    porAumento: (v) => gravar(aumento, v),
    /** _M_rehash_aux: os nós passam para `n` baldes novos, na mesma ordem da libstdc++. */
    redimensionar(n) {
      const novos = m.mem.malloc(n * 4, false, { tipoElem: prim.tipo, novo: 'vetor' })
      if (!novos) throw new ErroC('não há memória para a tabela crescer')
      m.mem.preencher(novos, 0, n * 4)
      const balde = (c) => Number(BigInt(c) % BigInt(n))
      const novoBalde = (b) => Number(m.mem.ler(prim.tipo, novos + b * 4))
      const porNovoBalde = (b, v) => m.mem.escrever(prim.tipo, novos + b * 4, v)
      let p = h.prox(h.antes)
      h.porProx(h.antes, 0)
      let baldeDoPrimeiro = 0
      while (p) {
        const seguinte = h.prox(p)
        const b = balde(h.codigo(p))
        if (!novoBalde(b)) {
          h.porProx(p, h.prox(h.antes))
          h.porProx(h.antes, p)
          porNovoBalde(b, h.antes)
          if (h.prox(p)) porNovoBalde(baldeDoPrimeiro, p)
          baldeDoPrimeiro = b
        } else {
          const antes = novoBalde(b)
          h.porProx(p, h.prox(antes))
          h.porProx(antes, p)
        }
        p = seguinte
      }
      if (h.baldes()) m.mem.free(h.baldes())
      gravar(baldes, novos)
      gravar(numBaldes, BigInt(n))
    },
  }
  return h
}


// ---- stringstream ------------------------------------------------------------------

function camposDoFluxo(m, objeto) {
  const campos = layout(m.tipoDaClasse('stringstream')).campos
  const de = (nome) => objeto + campos.find((c) => c.nome === nome).deslocamento
  return { texto: de('__texto'), posicao: de('__posicao'), entrada: de('istream'), saida: de('ostream') }
}

export const BIBLIOTECA_CPP = {
  // ---- string ----
  * 'string::string'(m, { objeto, args }) {
    let texto = ''
    if (args.length === 2) texto = String.fromCharCode(Number(args[1].valor) & 0xff).repeat(Number(args[0].valor))
    else if (args.length === 1) texto = textoDe(m, args[0])
    novaString(m, objeto, texto)
  },
  * 'string::~string'(m, { objeto }) {
    const dados = m.mem.ler(PCHAR, objeto)
    if (dados) m.mem.free(dados)
    m.mem.escrever(PCHAR, objeto, 0)
  },
  * 'string::operator='(m, { objeto, args }) { gravarTexto(m, objeto, textoDe(m, args[0])); return objeto },
  * 'string::operator+='(m, { objeto, args }) { gravarTexto(m, objeto, lerTexto(m, objeto) + textoDe(m, args[0])); return objeto },
  * 'string::append'(m, { objeto, args }) { gravarTexto(m, objeto, lerTexto(m, objeto) + textoDe(m, args[0])); return objeto },
  * 'string::push_back'(m, { objeto, args }) { gravarTexto(m, objeto, lerTexto(m, objeto) + textoDe(m, args[0])) },
  * 'string::pop_back'(m, { objeto }) {
    const s = lerTexto(m, objeto)
    if (!s) throw new ErroC('pop_back numa string vazia')
    gravarTexto(m, objeto, s.slice(0, -1))
  },
  * 'string::size'(m, { objeto }) { return m.mem.ler(SIZE_T, objeto + 4) },
  * 'string::length'(m, { objeto }) { return m.mem.ler(SIZE_T, objeto + 4) },
  * 'string::empty'(m, { objeto }) { return m.mem.ler(SIZE_T, objeto + 4) === 0 ? 1 : 0 },
  * 'string::clear'(m, { objeto }) { gravarTexto(m, objeto, '') },
  * 'string::operator[]'(m, { objeto, args }) { return posicaoNoTexto(m, objeto, Number(args[0].valor), 'texto[i]') },
  * 'string::at'(m, { objeto, args }) {
    const i = Number(args[0].valor)
    const n = m.mem.ler(SIZE_T, objeto + 4)
    if (i < 0 || i >= n) yield* m.lancarDaBiblioteca('out_of_range', `string::at: posição ${i} fora do texto (que tem ${n} caracteres)`)
    return posicaoNoTexto(m, objeto, i, 'at')
  },
  * 'string::front'(m, { objeto }) { return posicaoNoTexto(m, objeto, 0, 'front') },
  * 'string::back'(m, { objeto }) { return posicaoNoTexto(m, objeto, m.mem.ler(SIZE_T, objeto + 4) - 1, 'back') },
  * 'string::c_str'(m, { objeto }) { return m.mem.ler(PCHAR, objeto) },
  * 'string::begin'(m, { objeto }) { return m.mem.ler(PCHAR, objeto) },
  * 'string::end'(m, { objeto }) { return m.mem.ler(PCHAR, objeto) + m.mem.ler(SIZE_T, objeto + 4) },
  * 'string::substr'(m, { objeto, args, destino }) {
    const s = lerTexto(m, objeto)
    const pos = n0(args, 0, 0)
    if (pos > s.length) yield* m.lancarDaBiblioteca('out_of_range', `substr: posição ${pos} além do fim do texto (tamanho ${s.length})`)
    const n = n0(args, 1, NPOS)
    return novaString(m, destino, s.substr(pos, n >= NPOS ? undefined : n))
  },
  * 'string::find'(m, { objeto, args }) {
    const i = lerTexto(m, objeto).indexOf(textoDe(m, args[0]), n0(args, 1, 0))
    return i < 0 ? NPOS : i
  },
  * 'string::rfind'(m, { objeto, args }) {
    const i = lerTexto(m, objeto).lastIndexOf(textoDe(m, args[0]), Math.min(n0(args, 1, NPOS), 2 ** 31))
    return i < 0 ? NPOS : i
  },
  * 'string::find_first_of'(m, { objeto, args }) { return procurarLetras(lerTexto(m, objeto), textoDe(m, args[0]), n0(args, 1, 0), true, true) },
  * 'string::find_last_of'(m, { objeto, args }) { return procurarLetras(lerTexto(m, objeto), textoDe(m, args[0]), n0(args, 1, NPOS), true, false) },
  * 'string::find_first_not_of'(m, { objeto, args }) { return procurarLetras(lerTexto(m, objeto), textoDe(m, args[0]), n0(args, 1, 0), false, true) },
  * 'string::find_last_not_of'(m, { objeto, args }) { return procurarLetras(lerTexto(m, objeto), textoDe(m, args[0]), n0(args, 1, NPOS), false, false) },
  * 'string::replace'(m, { objeto, args }) {
    const s = lerTexto(m, objeto)
    const pos = n0(args, 0, 0)
    if (pos > s.length) yield* m.lancarDaBiblioteca('out_of_range', `replace: posição ${pos} além do fim do texto (tamanho ${s.length})`)
    const n = n0(args, 1, NPOS)
    gravarTexto(m, objeto, s.slice(0, pos) + textoDe(m, args[2]) + s.slice(n >= NPOS ? s.length : pos + n))
    return objeto
  },
  * 'string::resize'(m, { objeto, args }) {
    const s = lerTexto(m, objeto)
    const n = n0(args, 0, 0)
    gravarTexto(m, objeto, n <= s.length ? s.slice(0, n) : s + String.fromCharCode(n0(args, 1, 0) & 0xff).repeat(n - s.length))
  },
  * 'string::swap'(m, { objeto, args }) {
    const a = lerTexto(m, objeto)
    gravarTexto(m, objeto, lerTexto(m, args[0].valor))
    gravarTexto(m, args[0].valor, a)
  },
  * 'string::assign'(m, { objeto, args }) { gravarTexto(m, objeto, textoDe(m, args[0])); return objeto },
  * 'string::data'(m, { objeto }) { return m.mem.ler(PCHAR, objeto) },
  * 'string::compare'(m, { objeto, args }) {
    const a = lerTexto(m, objeto)
    const b = textoDe(m, args[0])
    return a < b ? -1 : a > b ? 1 : 0
  },
  * 'string::insert'(m, { objeto, args }) {
    const s = lerTexto(m, objeto)
    const pos = n0(args, 0, 0)
    gravarTexto(m, objeto, s.slice(0, pos) + textoDe(m, args[1]) + s.slice(pos))
    return objeto
  },
  * 'string::erase'(m, { objeto, args }) {
    const s = lerTexto(m, objeto)
    const pos = n0(args, 0, 0)
    const n = n0(args, 1, NPOS)
    gravarTexto(m, objeto, s.slice(0, pos) + (n >= NPOS ? '' : s.slice(pos + n)))
    return objeto
  },
  * 'operator+'(m, { args, destino }) { return novaString(m, destino, textoDe(m, args[0]) + textoDe(m, args[1])) },
  * 'operator=='(m, { args }) { return textoDe(m, args[0]) === textoDe(m, args[1]) ? 1 : 0 },
  * 'operator!='(m, { args }) { return textoDe(m, args[0]) !== textoDe(m, args[1]) ? 1 : 0 },
  * 'operator<'(m, { args }) { return textoDe(m, args[0]) < textoDe(m, args[1]) ? 1 : 0 },
  * 'operator>'(m, { args }) { return textoDe(m, args[0]) > textoDe(m, args[1]) ? 1 : 0 },
  * 'operator<='(m, { args }) { return textoDe(m, args[0]) <= textoDe(m, args[1]) ? 1 : 0 },
  * 'operator>='(m, { args }) { return textoDe(m, args[0]) >= textoDe(m, args[1]) ? 1 : 0 },
  * to_string(m, { args, destino }) {
    const a = args[0]
    return novaString(m, destino, a.tipo.k === 'real' ? formatar('%f', [a]) : String(a.valor))
  },
  * stoi(m, { args }) { return Number(yield* textoParaInteiro(m, args, 'stoi')) | 0 },
  * stol(m, { args }) { return Number(yield* textoParaInteiro(m, args, 'stol')) | 0 },
  * stoll(m, { args }) { return yield* textoParaInteiro(m, args, 'stoll') },
  * stod(m, { args }) {
    const v = Number.parseFloat(lerTexto(m, args[0].valor).trim())
    if (Number.isNaN(v)) yield* m.lancarDaBiblioteca('invalid_argument', 'stod: o texto não é um número')
    return v
  },
  * stof(m, { args }) {
    const v = Number.parseFloat(lerTexto(m, args[0].valor).trim())
    if (Number.isNaN(v)) yield* m.lancarDaBiblioteca('invalid_argument', 'stof: o texto não é um número')
    return Math.fround(v)
  },

  // ---- iostream ----
  * 'ostream::operator<<'(m, { objeto, args }) {
    const a = args[0]
    const t = a.tipo.k === 'ref' ? a.tipo.alvo : a.tipo
    const e = estado(m, objeto)
    if (t.k === 'ptr' && t.alvo.k === 'func') {
      const nome = m.funcaoNoEndereco.get(Number(a.valor))
      if (nome === 'endl') {
        const largura = e.largura
        e.largura = 0
        escreverNoFluxo(m, objeto, '\n')
        e.largura = largura
      } else if (MANIPULADORES[nome]) Object.assign(e, MANIPULADORES[nome])
      return objeto
    }
    if (t.k === 'struct') {
      if (t.rotulo === '__setprecision') e.precisao = m.mem.ler(INT, a.valor)
      else if (t.rotulo === '__setw') e.largura = m.mem.ler(INT, a.valor)
      else if (t.rotulo === '__setfill') e.preenchimento = String.fromCharCode(m.mem.ler(CHAR, a.valor) & 0xff)
      else if (ehString(t)) escreverNoFluxo(m, objeto, lerTexto(m, a.valor))
      return objeto
    }
    if (t.k === 'ptr') {
      escreverNoFluxo(m, objeto, t.alvo.k === 'int' && t.alvo.tamanho === 1 ? m.cadeia(a.valor) : `0x${(Number(a.valor) >>> 0).toString(16)}`)
    } else if (t.k === 'int' && t.tamanho === 1 && !t.bool) escreverNoFluxo(m, objeto, String.fromCharCode(Number(a.valor) & 0xff))
    else escreverNoFluxo(m, objeto, numeroNoFluxo(e, t, a.valor), true)
    return objeto
  },
  * 'ostream::flush'(m, { objeto }) { return objeto },
  * 'ostream::precision'(m, { objeto, args }) {
    const e = estado(m, objeto)
    const antes = e.precisao
    if (args.length) e.precisao = Number(args[0].valor)
    return antes
  },
  * 'ostream::width'(m, { objeto, args }) {
    const e = estado(m, objeto)
    const antes = e.largura
    e.largura = Number(args[0].valor)
    return antes
  },
  * 'ostream::fill'(m, { objeto, args }) {
    const e = estado(m, objeto)
    const antes = e.preenchimento.charCodeAt(0)
    e.preenchimento = String.fromCharCode(Number(args[0].valor) & 0xff)
    return antes
  },
  * 'ostream::put'(m, { objeto, args }) {
    const e = estado(m, objeto)
    const largura = e.largura
    e.largura = 0
    escreverNoFluxo(m, objeto, String.fromCharCode(Number(args[0].valor) & 0xff))
    e.largura = largura
    return objeto
  },
  * 'istream::operator>>'(m, { objeto, args }) {
    const a = args[0]
    const destino = Number(a.valor)
    const t = a.tipo.k === 'ref' ? a.tipo.alvo : a.tipo
    if (t.k === 'ptr' && t.alvo.k === 'func') { // cin >> ws
      const leitor = leitorDe(m, objeto)
      while ([32, 9, 10, 11, 12, 13].includes(yield* leitor.espiar())) leitor.avancar()
      return objeto
    }
    if (ehString(t)) {
      if (estado(m, objeto).falhou) return objeto
      const palavra = yield* lerPalavra(leitorDe(m, objeto))
      if (!palavra) estado(m, objeto).falhou = true
      else gravarTexto(m, destino, palavra)
      return objeto
    }
    if (t.k === 'ptr') {
      yield* lerDoFluxo(m, objeto, '%s', (_i, v) => m.mem.gravarCadeia(destino, v))
      return objeto
    }
    const ehChar = t.k === 'int' && t.tamanho === 1 && !t.bool
    const formato = ehChar ? ' %c' : t.k === 'real' ? '%lf' : '%lld'
    yield* lerDoFluxo(m, objeto, formato, (_i, v) => {
      const valor = ehChar ? v.charCodeAt(0) : v
      m.mem.escrever(t, destino, m.converter(valor, typeof valor === 'bigint' ? { k: 'int', tamanho: 8, sinal: true } : DOUBLE, t))
    })
    return objeto
  },
  * 'istream::operator bool'(m, { objeto }) { return estado(m, objeto).falhou ? 0 : 1 },
  * 'istream::operator!'(m, { objeto }) { return estado(m, objeto).falhou ? 1 : 0 },
  * 'istream::fail'(m, { objeto }) { return estado(m, objeto).falhou ? 1 : 0 },
  * 'istream::eof'(m, { objeto }) {
    const e = estado(m, objeto)
    return (e.texto ? e.fim : e.falhou && m.fimDaEntrada) ? 1 : 0
  },
  * 'istream::good'(m, { objeto }) {
    const e = estado(m, objeto)
    return e.falhou || e.fim ? 0 : 1
  },
  * 'istream::clear'(m, { objeto }) {
    const e = estado(m, objeto)
    e.falhou = false
    e.fim = false
  },
  * 'istream::get'(m, { objeto, args }) {
    const leitor = leitorDe(m, objeto)
    const c = yield* leitor.espiar()
    if (c !== -1) leitor.avancar()
    if (!args.length) return c
    if (c === -1) estado(m, objeto).falhou = true // get(char &c)
    else m.mem.escrever(CHAR, Number(args[0].valor), c)
    return objeto
  },
  * 'istream::peek'(m, { objeto }) { return yield* leitorDe(m, objeto).espiar() },
  * 'istream::ignore'(m, { objeto, args }) {
    const n = n0(args, 0, 1)
    const ate = n0(args, 1, -1)
    const leitor = leitorDe(m, objeto)
    for (let i = 0; i < n; i += 1) {
      const c = yield* leitor.espiar()
      if (c === -1) break
      leitor.avancar()
      if (c === ate) break
    }
    return objeto
  },
  * getline(m, { args }) {
    const [fluxo, texto, delimitador] = args
    const fim = delimitador ? Number(delimitador.valor) & 0xff : 10
    const leitor = leitorDe(m, fluxo.valor)
    if (estado(m, fluxo.valor).falhou) return fluxo.valor
    let s = ''
    let algo = false
    for (;;) {
      const c = yield* leitor.espiar()
      if (c === -1) break
      algo = true
      leitor.avancar()
      if (c === fim) break
      s += String.fromCharCode(c)
    }
    if (!algo) estado(m, fluxo.valor).falhou = true
    else gravarTexto(m, texto.valor, s)
    return fluxo.valor
  },
  * ws(m, { args }) {
    const leitor = leitorDe(m, args[0].valor)
    while ([32, 9, 10, 11, 12, 13].includes(yield* leitor.espiar())) leitor.avancar()
    return args[0].valor
  },

  // ---- stringstream ----
  * 'stringstream::stringstream'(m, { objeto, args }) {
    const c = camposDoFluxo(m, objeto)
    novaString(m, c.texto, args.length ? textoDe(m, args[0]) : '')
    m.mem.escrever(SIZE_T, c.posicao, 0)
    const e = { ...novoEstado(), texto: c.texto, posicao: c.posicao }
    estado(m, c.entrada) // (cria o mapa)
    m.fluxos.set(c.entrada, e)
    m.fluxos.set(c.saida, e)
  },
  * 'stringstream::~stringstream'(m, { objeto }) {
    const c = camposDoFluxo(m, objeto)
    yield* BIBLIOTECA_CPP['string::~string'](m, { objeto: c.texto })
    m.fluxos?.delete(c.entrada)
    m.fluxos?.delete(c.saida)
  },
  * 'stringstream::str'(m, { objeto, args, destino }) {
    const c = camposDoFluxo(m, objeto)
    if (!args.length) return novaString(m, destino, lerTexto(m, c.texto))
    gravarTexto(m, c.texto, textoDe(m, args[0]))
    m.mem.escrever(SIZE_T, c.posicao, 0)
    return undefined
  },

  // ---- sort e heap ----
  __ordenar_js: sobreIntervalo((a) => a.ordenar()),
  __ordenar_estavel_js: sobreIntervalo((a) => a.ordenarEstavel()),
  __empurrar_heap_js: sobreIntervalo((a) => a.empurrarHeap()),
  __tirar_heap_js: sobreIntervalo((a) => a.tirarDoHeap()),
  __fazer_heap_js: sobreIntervalo((a, n) => a.fazerHeap(n)),
  __ordenar_heap_js: sobreIntervalo((a, n) => a.ordenarHeap(n)),
  // ---- comparação de dois intervalos (vector == e <) ----
  * __iguais_js(m, { args }) {
    const marca = m.mem.topoPilha
    try {
      const x = intervalo(m, args[0], args[1])
      const y = intervalo(m, args[2], args[3])
      if (x.n !== y.n) return 0
      const igual = comparador(m, args[4], x.tipo)
      for (let k = 0; k < x.n; k += 1) if (!(yield* igual(x.end(k), y.end(k)))) return 0
      return 1
    } finally {
      m.mem.desempilharAte(marca)
    }
  },
  * __menor_lexico_js(m, { args }) { // lexicographical_compare
    const marca = m.mem.topoPilha
    try {
      const x = intervalo(m, args[0], args[1])
      const y = intervalo(m, args[2], args[3])
      const menor = comparador(m, args[4], x.tipo)
      for (let k = 0; k < x.n && k < y.n; k += 1) {
        if (yield* menor(x.end(k), y.end(k))) return 1
        if (yield* menor(y.end(k), x.end(k))) return 0
      }
      return x.n < y.n ? 1 : 0
    } finally {
      m.mem.desempilharAte(marca)
    }
  },
  * __ordenar_parcial_js(m, { args }) {
    const marca = m.mem.topoPilha
    try {
      const iv = intervalo(m, args[0], args[2])
      const meio = intervalo(m, args[0], args[1]).n
      const a = algoritmos(m, iv, comparador(m, args[3], iv.tipo))
      yield* a.selecionarHeap(meio)
      yield* a.ordenarHeap(meio)
    } finally {
      m.mem.desempilharAte(marca)
    }
  },

  // ---- map e set (a árvore) ----
  * __minimo_js(m, { args }) { return minimo(noDaArvore(m, tipoDoNo(args[0])), Number(args[0].valor)) },
  * __maximo_js(m, { args }) { return maximo(noDaArvore(m, tipoDoNo(args[0])), Number(args[0].valor)) },
  * __seguinte_js(m, { args }) { return seguinte(noDaArvore(m, tipoDoNo(args[0])), Number(args[0].valor)) },
  * __antecessor_js(m, { args }) { return antecessor(noDaArvore(m, tipoDoNo(args[0])), Number(args[0].valor)) },
  * __limite_js(m, { args }) { // lower_bound (superior = 0) ou upper_bound (1)
    const [raiz, k, comp, primeiro, superior] = args
    const a = noDaArvore(m, tipoDoNo(raiz), Number(primeiro.valor))
    const menor = comparador(m, comp, a.tipoChave)
    const chave = Number(k.valor)
    let n = Number(raiz.valor)
    let r = 0
    while (n) {
      const vaiEsq = Number(superior.valor) ? yield* menor(chave, a.chave(n)) : !(yield* menor(a.chave(n), chave))
      if (vaiEsq) { r = n; n = a.esq(n) } else n = a.dir(n)
    }
    return r
  },
  * __ligar_js(m, { args }) { // o nó novo entra no lugar dele (iguais vão para a direita) e a árvore se rebalanceia
    const [raizEnd, novoArg, comp, primeiro] = args
    const novo = Number(novoArg.valor)
    const a = noDaArvore(m, tipoDoNo(novoArg), Number(primeiro.valor))
    const menor = comparador(m, comp, a.tipoChave)
    const raiz = Number(raizEnd.valor)
    let pai = 0
    let n = Number(m.mem.ler(a.tipoPonteiro, raiz))
    let esquerda = false
    while (n) {
      pai = n
      esquerda = yield* menor(a.chave(novo), a.chave(n))
      n = esquerda ? a.esq(n) : a.dir(n)
    }
    a.porPai(novo, pai)
    if (!pai) m.mem.escrever(a.tipoPonteiro, raiz, novo)
    else if (esquerda) a.porEsq(pai, novo)
    else a.porDir(pai, novo)
    avl(m, a, raiz).rebalancear(pai)
  },
  * __desligar_js(m, { args }) { // tira o nó da árvore (quem apaga é o delete do C++) e rebalanceia
    const [raizEnd, noArg] = args
    const z = Number(noArg.valor)
    const a = noDaArvore(m, tipoDoNo(noArg))
    const { trocarFilho, rebalancear } = avl(m, a, Number(raizEnd.valor))
    let desde
    if (!a.esq(z)) { desde = a.pai(z); trocarFilho(a.pai(z), z, a.dir(z)) }
    else if (!a.dir(z)) { desde = a.pai(z); trocarFilho(a.pai(z), z, a.esq(z)) }
    else {
      const y = minimo(a, a.dir(z))
      if (a.pai(y) !== z) {
        desde = a.pai(y)
        trocarFilho(a.pai(y), y, a.dir(y))
        a.porDir(y, a.dir(z))
        a.porPai(a.dir(y), y)
      } else desde = y
      trocarFilho(a.pai(z), z, y)
      a.porEsq(y, a.esq(z))
      a.porPai(a.esq(y), y)
      a.porAltura(y, a.altura(z))
    }
    rebalancear(desde)
  },

  // ---- unordered_map e unordered_set (a tabela) ----
  * __antes_de_js(m, { args }) { // o nó antes do primeiro igual a k no balde dele (ou nulo)
    const [tArg, k, codigoArg, igualArg, primeiro] = args
    const h = tabelaHash(m, tArg, Number(primeiro.valor))
    if (!h.tamanho() || !h.baldes()) return 0
    const codigo = BigInt(codigoArg.valor)
    const b = h.balde(codigo)
    let antes = h.noBalde(b)
    if (!antes) return 0
    const igual = comparador(m, igualArg, h.tipoChave)
    for (let p = h.prox(antes); p && h.balde(h.codigo(p)) === b; antes = p, p = h.prox(p)) {
      if (h.codigo(p) === codigo && (yield* igual(h.chave(p), Number(k.valor)))) return antes
    }
    return 0
  },
  * __crescer_js(m, { args }) { // _M_need_rehash (fator de carga máximo 1): a 1ª inserção já cria 13 baldes
    const h = tabelaHash(m, args[0])
    const n = BigInt(h.tamanho() + 1)
    const aumento = h.aumento()
    const num = h.num()
    if (n > aumento) {
      const minimo = n > (aumento ? 0n : 11n) ? n : 11n
      if (minimo >= num) {
        const pedido = minimo + 1n > num * 2n ? minimo + 1n : num * 2n
        const novo = proximoPrimo(Number(pedido))
        h.porAumento(BigInt(novo))
        h.redimensionar(novo)
        return
      }
      h.porAumento(num)
    }
    if (!h.baldes()) h.redimensionar(Number(num))
  },
  * __reservar_js(m, { args }) {
    const h = tabelaHash(m, args[0])
    const n = Number(args[1].valor)
    if (BigInt(n) > h.num()) {
      const novo = proximoPrimo(n)
      h.porAumento(BigInt(novo))
      h.redimensionar(novo)
    }
  },
  * __limpar_baldes_js(m, { args }) {
    const h = tabelaHash(m, args[0])
    if (h.baldes()) m.mem.preencher(h.baldes(), 0, Number(h.num()) * 4)
  },
  * __ligar_hash_js(m, { args }) { // _M_insert_bucket_begin (ou logo depois de `antes`, no multi)
    const h = tabelaHash(m, args[0])
    const no = Number(args[1].valor)
    const b = h.balde(h.codigo(no))
    const antes = Number(args[2].valor) || h.noBalde(b)
    if (antes) {
      h.porProx(no, h.prox(antes))
      h.porProx(antes, no)
    } else {
      h.porProx(no, h.prox(h.antes))
      h.porProx(h.antes, no)
      if (h.prox(no)) h.porBalde(h.balde(h.codigo(h.prox(no))), no)
      h.porBalde(b, h.antes)
    }
  },
  * __desligar_hash_js(m, { args }) { // _M_erase (quem apaga o nó é o delete do C++)
    const h = tabelaHash(m, args[0])
    const no = Number(args[1].valor)
    const b = h.balde(h.codigo(no))
    let antes = h.noBalde(b)
    while (h.prox(antes) !== no) antes = h.prox(antes)
    const prox = h.prox(no)
    if (antes === h.noBalde(b)) {
      if (!prox || h.balde(h.codigo(prox)) !== b) {
        if (prox) h.porBalde(h.balde(h.codigo(prox)), antes)
        h.porBalde(b, 0)
      }
    } else if (prox && h.balde(h.codigo(prox)) !== b) h.porBalde(h.balde(h.codigo(prox)), antes)
    h.porProx(antes, prox)
  },

  // ---- unordered_map ----
  * __hash_bytes(m, { args }) {
    const p = Number(args[0].valor)
    const n = Number(args[1].valor)
    m.mem.verificar(p, n)
    return hashBytes(m.mem.bytes.subarray(p, p + n))
  },
  * __proximo_primo(m, { args }) { return BigInt(proximoPrimo(Number(args[0].valor))) },
  * setprecision(m, { args, destino }) { m.mem.escrever(INT, destino, Number(args[0].valor)); return destino },
  * setw(m, { args, destino }) { m.mem.escrever(INT, destino, Number(args[0].valor)); return destino },
  * setfill(m, { args, destino }) { m.mem.escrever(CHAR, destino, Number(args[0].valor)); return destino },

  // ---- vector ----
  * 'vector::vector'(m, { objeto, args, classe }) {
    const t = elementoDe(m, classe)
    const tam = tamanhoDe(t)
    m.mem.preencher(objeto, 0, 12)
    if (!args.length) return
    const a = args[0]
    const ta = a.tipo.k === 'ref' ? a.tipo.alvo : a.tipo
    let origem
    let n
    if (ta.k === 'struct' && ta.rotulo === classe) { // cópia
      origem = m.mem.ler(ponteiro(t), a.valor)
      n = m.mem.ler(SIZE_T, a.valor + 4)
    } else if (ta.k === 'struct' && ta.rotulo.startsWith('initializer_list')) {
      origem = m.mem.ler(INT, a.valor)
      n = m.mem.ler(INT, a.valor + 4)
    }
    if (origem !== undefined) {
      garantir(m, objeto, t, n)
      const dados = m.mem.ler(ponteiro(t), objeto)
      for (let i = 0; i < n; i += 1) yield* copiarElemento(m, dados + i * tam, origem + i * tam, t)
      m.mem.escrever(SIZE_T, objeto + 4, n)
      return
    }
    n = Number(a.valor)
    garantir(m, objeto, t, n)
    const dados = m.mem.ler(ponteiro(t), objeto)
    for (let i = 0; i < n; i += 1) {
      if (args[1]) yield* copiarElemento(m, dados + i * tam, args[1].valor, t)
      else if (t.k === 'struct') yield* m.construirPadrao(dados + i * tam, t)
      else m.mem.preencher(dados + i * tam, 0, tam)
    }
    m.mem.escrever(SIZE_T, objeto + 4, n)
  },
  * 'vector::__destruir'(m, { objeto, classe }) {
    const t = elementoDe(m, classe)
    yield* destruirElementos(m, objeto, t, 0, m.mem.ler(SIZE_T, objeto + 4))
    const dados = m.mem.ler(ponteiro(t), objeto)
    if (dados) m.mem.free(dados)
    m.mem.preencher(objeto, 0, 12)
  },
  * 'vector::operator='(m, { objeto, args, classe }) {
    const outro = args[0].valor
    if (outro === objeto) return objeto
    yield* BIBLIOTECA_CPP['vector::__destruir'](m, { objeto, classe })
    yield* BIBLIOTECA_CPP['vector::vector'](m, { objeto, args, classe })
    return objeto
  },
  * 'vector::push_back'(m, { objeto, args, classe }) {
    const t = elementoDe(m, classe)
    const tam = tamanhoDe(t)
    const n = m.mem.ler(SIZE_T, objeto + 4)
    let origem = Number(args[0].valor)
    const antigo = m.mem.ler(ponteiro(t), objeto)
    const dentro = antigo && origem >= antigo && origem < antigo + n * tam // v.push_back(v[0])
    const indiceOrigem = dentro ? (origem - antigo) / tam : -1
    garantir(m, objeto, t, n + 1)
    const dados = m.mem.ler(ponteiro(t), objeto)
    if (dentro) origem = dados + indiceOrigem * tam
    yield* copiarElemento(m, dados + n * tam, origem, t)
    m.mem.escrever(SIZE_T, objeto + 4, n + 1)
  },
  * 'vector::pop_back'(m, { objeto, classe }) {
    const n = m.mem.ler(SIZE_T, objeto + 4)
    if (!n) throw new ErroC('pop_back num vector vazio')
    yield* destruirElementos(m, objeto, elementoDe(m, classe), n - 1, n)
    m.mem.escrever(SIZE_T, objeto + 4, n - 1)
  },
  * 'vector::size'(m, { objeto }) { return m.mem.ler(SIZE_T, objeto + 4) },
  * 'vector::empty'(m, { objeto }) { return m.mem.ler(SIZE_T, objeto + 4) === 0 ? 1 : 0 },
  * 'vector::clear'(m, { objeto, classe }) {
    yield* destruirElementos(m, objeto, elementoDe(m, classe), 0, m.mem.ler(SIZE_T, objeto + 4))
    m.mem.escrever(SIZE_T, objeto + 4, 0)
  },
  * 'vector::resize'(m, { objeto, args, classe }) {
    const t = elementoDe(m, classe)
    const tam = tamanhoDe(t)
    const n = m.mem.ler(SIZE_T, objeto + 4)
    const novo = Number(args[0].valor)
    if (novo < n) yield* destruirElementos(m, objeto, t, novo, n)
    else {
      garantir(m, objeto, t, novo)
      const dados = m.mem.ler(ponteiro(t), objeto)
      for (let i = n; i < novo; i += 1) {
        if (t.k === 'struct') yield* m.construirPadrao(dados + i * tam, t)
        else m.mem.preencher(dados + i * tam, 0, tam)
      }
    }
    m.mem.escrever(SIZE_T, objeto + 4, novo)
  },
  * 'vector::operator[]'(m, { objeto, args, classe }) {
    const i = Number(args[0].valor)
    indiceDoVector(m, objeto, i, 'v[i]')
    return m.mem.ler(INT, objeto) + i * tamanhoDe(elementoDe(m, classe))
  },
  * 'vector::at'(m, { objeto, args, classe }) {
    const i = Number(args[0].valor)
    const n = m.mem.ler(SIZE_T, objeto + 4)
    // at() confere o índice e lança out_of_range (operator[] não confere no C++; aqui ele dá erro direto).
    if (i < 0 || i >= n) yield* m.lancarDaBiblioteca('out_of_range', `vector::at: índice ${i} fora do vector (ele tem ${n} elementos)`)
    return m.mem.ler(INT, objeto) + i * tamanhoDe(elementoDe(m, classe))
  },
  * 'vector::front'(m, { objeto }) {
    indiceDoVector(m, objeto, 0, 'front')
    return m.mem.ler(INT, objeto)
  },
  * 'vector::back'(m, { objeto, classe }) {
    const n = m.mem.ler(SIZE_T, objeto + 4)
    indiceDoVector(m, objeto, n - 1, 'back')
    return m.mem.ler(INT, objeto) + (n - 1) * tamanhoDe(elementoDe(m, classe))
  },
  * 'vector::begin'(m, { objeto }) { return m.mem.ler(INT, objeto) },
  * 'vector::cbegin'(m, { objeto }) { return m.mem.ler(INT, objeto) },
  * 'vector::capacity'(m, { objeto }) { return m.mem.ler(SIZE_T, objeto + 8) },
  * 'vector::cend'(m, { objeto, classe }) { return m.mem.ler(INT, objeto) + m.mem.ler(SIZE_T, objeto + 4) * tamanhoDe(elementoDe(m, classe)) },
  * 'vector::data'(m, { objeto }) { return m.mem.ler(INT, objeto) },
  * 'vector::end'(m, { objeto, classe }) { return m.mem.ler(INT, objeto) + m.mem.ler(SIZE_T, objeto + 4) * tamanhoDe(elementoDe(m, classe)) },
  * 'vector::insert'(m, { objeto, args, classe }) {
    const t = elementoDe(m, classe)
    const tam = tamanhoDe(t)
    const n = m.mem.ler(SIZE_T, objeto + 4)
    const indice = (Number(args[0].valor) - m.mem.ler(INT, objeto)) / tam
    if (indice < 0 || indice > n) throw new ErroC('insert: posição fora do vector')
    garantir(m, objeto, t, n + 1)
    const dados = m.mem.ler(INT, objeto)
    if (n > indice) m.mem.copiar(dados + (indice + 1) * tam, dados + indice * tam, (n - indice) * tam)
    yield* copiarElemento(m, dados + indice * tam, Number(args[1].valor), t)
    m.mem.escrever(SIZE_T, objeto + 4, n + 1)
    return dados + indice * tam
  },
  * 'vector::erase'(m, { objeto, args, classe }) {
    const t = elementoDe(m, classe)
    const tam = tamanhoDe(t)
    const n = m.mem.ler(SIZE_T, objeto + 4)
    const dados = m.mem.ler(INT, objeto)
    const indice = (Number(args[0].valor) - dados) / tam
    indiceDoVector(m, objeto, indice, 'erase')
    if (t.k === 'struct') yield* m.destruirObjeto(dados + indice * tam, t)
    if (indice < n - 1) m.mem.copiar(dados + indice * tam, dados + (indice + 1) * tam, (n - 1 - indice) * tam)
    m.mem.escrever(SIZE_T, objeto + 4, n - 1)
    return dados + indice * tam
  },
  * 'initializer_list::size'(m, { objeto }) { return m.mem.ler(INT, objeto + 4) },
  * 'initializer_list::begin'(m, { objeto }) { return m.mem.ler(INT, objeto) },
  * 'initializer_list::end'(m, { objeto, tipoFn }) { return m.mem.ler(INT, objeto) + m.mem.ler(INT, objeto + 4) * tamanhoDe(tipoFn.ret.alvo) },
}
