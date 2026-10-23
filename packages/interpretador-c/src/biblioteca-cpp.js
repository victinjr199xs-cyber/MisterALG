// Biblioteca do C++ no passo a passo. string e vector são objetos de verdade na
// memória — { ponteiro para os dados no heap, tamanho, capacidade } — e por isso
// aparecem na tela de memória com uma seta até o bloco onde os dados moram.
// Cada função recebe (maquina, { objeto, args, destino, classe, decl, tipoFn }).

import { ErroC } from './erros.js'
import { escanear, formatar } from './formatos.js'
import { CHAR, DOUBLE, INT, SIZE_T, ponteiro, tamanhoDe } from './tipos.js'

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
  for (let i = ate - 1; i >= de; i -= 1) yield* m.destruirObjeto(dados + i * tamanhoDe(t), t)
}

function indiceDoVector(m, v, i, nome) {
  const n = m.mem.ler(SIZE_T, v + 4)
  if (i < 0 || i >= n) {
    throw new ErroC(`${nome}: índice ${i} fora do vector (ele tem ${n} elementos: posições 0 a ${n - 1})`, 0,
      'As posições de um vector vão de 0 a size()-1. Use push_back para aumentar o vector.')
  }
}

function* compararPorTipo(m, t, a, b) {
  if (ehString(t)) {
    const x = lerTexto(m, a)
    const y = lerTexto(m, b)
    return x < y ? -1 : x > y ? 1 : 0
  }
  if (t.k === 'struct') throw new ErroC('para ordenar ou comparar objetos, passe uma função de comparação')
  const x = m.mem.ler(t, a)
  const y = m.mem.ler(t, b)
  return x < y ? -1 : x > y ? 1 : 0
}

/** Chama a função de comparação do aluno (parâmetros por valor ou por referência). */
function* comparadorDoAluno(m, cmp, t, a, b) {
  const nome = m.funcaoNoEndereco.get(Number(cmp))
  const def = nome && m.funcoes.get(nome)
  if (!def) throw new ErroC('a função de comparação não foi encontrada (funções lambda ainda não funcionam no passo a passo)')
  const params = m.tipos.de(def.type).params
  const valor = (e, p) => (p?.k === 'ref' || p?.k === 'struct' ? e : m.mem.ler(t, e))
  const r = yield* m.chamarFuncao(def, [valor(a, params[0]), valor(b, params[1])], m.linhaAtual)
  return m.verdade(r)
}

// ---- iostream ----------------------------------------------------------------------

function estado(m, objeto) {
  m.fluxos ??= new Map()
  let e = m.fluxos.get(objeto)
  if (!e) {
    e = { precisao: 6, fixo: false, largura: 0, preenchimento: ' ', falhou: false }
    m.fluxos.set(objeto, e)
  }
  return e
}

function escreverNoFluxo(m, objeto, texto) {
  const e = estado(m, objeto)
  if (e.largura > texto.length) texto = e.preenchimento.repeat(e.largura - texto.length) + texto
  e.largura = 0
  m.saida(texto)
}

function* lerDoFluxo(m, objeto, formato, gravar) {
  const e = estado(m, objeto)
  if (e.falhou) return
  const r = yield* escanear(m.leitor, formato, gravar)
  if (r !== 1) e.falhou = true
}

function* lerPalavra(m) {
  const espaco = (c) => c === 32 || (c >= 9 && c <= 13)
  while (espaco(yield* m.leitor.espiar())) m.leitor.avancar()
  let s = ''
  for (;;) {
    const c = yield* m.leitor.espiar()
    if (c === -1 || espaco(c)) break
    s += String.fromCharCode(c)
    m.leitor.avancar()
  }
  return s
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
  * stoi(m, { args }) {
    const v = Number.parseInt(lerTexto(m, args[0].valor).trim(), 10)
    if (Number.isNaN(v)) yield* m.lancarDaBiblioteca('invalid_argument', 'stoi: o texto não é um número inteiro')
    return v | 0
  },
  * stod(m, { args }) {
    const v = Number.parseFloat(lerTexto(m, args[0].valor).trim())
    if (Number.isNaN(v)) yield* m.lancarDaBiblioteca('invalid_argument', 'stod: o texto não é um número')
    return v
  },

  // ---- iostream ----
  * 'ostream::operator<<'(m, { objeto, args }) {
    const a = args[0]
    const t = a.tipo.k === 'ref' ? a.tipo.alvo : a.tipo
    const e = estado(m, objeto)
    if (t.k === 'ptr' && t.alvo.k === 'func') {
      const nome = m.funcaoNoEndereco.get(Number(a.valor))
      if (nome === 'endl') escreverNoFluxo(m, objeto, '\n')
      else if (nome === 'fixed') e.fixo = true
      else if (nome === 'defaultfloat') e.fixo = false
      return objeto
    }
    if (t.k === 'struct') {
      if (t.rotulo === '__setprecision') e.precisao = m.mem.ler(INT, a.valor)
      else if (t.rotulo === '__setw') e.largura = m.mem.ler(INT, a.valor)
      else if (t.rotulo === '__setfill') e.preenchimento = String.fromCharCode(m.mem.ler(CHAR, a.valor) & 0xff)
      else if (ehString(t)) escreverNoFluxo(m, objeto, lerTexto(m, a.valor))
      return objeto
    }
    let texto
    if (t.k === 'ptr') texto = t.alvo.k === 'int' && t.alvo.tamanho === 1 ? m.cadeia(a.valor) : `0x${(Number(a.valor) >>> 0).toString(16)}`
    else if (t.bool) texto = a.valor ? '1' : '0'
    else if (t.k === 'int' && t.tamanho === 1) texto = String.fromCharCode(Number(a.valor) & 0xff)
    else if (t.k === 'int') texto = String(a.valor)
    else texto = formatar(e.fixo ? `%.${e.precisao}f` : `%.${e.precisao}g`, [{ valor: a.valor, tipo: DOUBLE }])
    escreverNoFluxo(m, objeto, texto)
    return objeto
  },
  * 'ostream::flush'(m, { objeto }) { return objeto },
  * 'istream::operator>>'(m, { objeto, args }) {
    const a = args[0]
    const destino = Number(a.valor)
    const t = a.tipo.k === 'ref' ? a.tipo.alvo : a.tipo
    if (ehString(t)) {
      if (estado(m, objeto).falhou) return objeto
      const palavra = yield* lerPalavra(m)
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
  * 'istream::eof'(m, { objeto }) { return estado(m, objeto).falhou && m.fimDaEntrada ? 1 : 0 },
  * 'istream::clear'(m, { objeto }) { estado(m, objeto).falhou = false },
  * 'istream::get'(m) {
    const c = yield* m.leitor.espiar()
    if (c !== -1) m.leitor.avancar()
    return c
  },
  * 'istream::ignore'(m, { objeto, args }) {
    const n = n0(args, 0, 1)
    const ate = n0(args, 1, -1)
    for (let i = 0; i < n; i += 1) {
      const c = yield* m.leitor.espiar()
      if (c === -1) break
      m.leitor.avancar()
      if (c === ate) break
    }
    return objeto
  },
  * getline(m, { args }) {
    const [fluxo, texto] = args
    let s = ''
    let algo = false
    for (;;) {
      const c = yield* m.leitor.espiar()
      if (c === -1) break
      algo = true
      m.leitor.avancar()
      if (c === 10) break
      s += String.fromCharCode(c)
    }
    if (!algo) estado(m, fluxo.valor).falhou = true
    else gravarTexto(m, texto.valor, s)
    return fluxo.valor
  },
  * ws(m, { args }) {
    while ([32, 9, 10, 13].includes(yield* m.leitor.espiar())) m.leitor.avancar()
    return args[0].valor
  },
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
  * 'vector::~vector'(m, { objeto, classe }) {
    const t = elementoDe(m, classe)
    yield* destruirElementos(m, objeto, t, 0, m.mem.ler(SIZE_T, objeto + 4))
    const dados = m.mem.ler(ponteiro(t), objeto)
    if (dados) m.mem.free(dados)
    m.mem.preencher(objeto, 0, 12)
  },
  * 'vector::operator='(m, { objeto, args, classe }) {
    const outro = args[0].valor
    if (outro === objeto) return objeto
    yield* BIBLIOTECA_CPP['vector::~vector'](m, { objeto, classe })
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
  },
  * 'initializer_list::size'(m, { objeto }) { return m.mem.ler(INT, objeto + 4) },
  * 'initializer_list::begin'(m, { objeto }) { return m.mem.ler(INT, objeto) },
  * 'initializer_list::end'(m, { objeto, tipoFn }) { return m.mem.ler(INT, objeto) + m.mem.ler(INT, objeto + 4) * tamanhoDe(tipoFn.ret.alvo) },

  // ---- algorithm ----
  * sort(m, { args }) {
    const [a, b, cmp] = args
    const t = a.tipo.alvo
    const tam = tamanhoDe(t)
    const n = (Number(b.valor) - Number(a.valor)) / tam
    const inicio = Number(a.valor)
    const itens = []
    for (let i = 0; i < n; i += 1) itens.push(m.mem.lerBytes(inicio + i * tam, tam))
    // Inserção, comparando com a função do aluno (que também roda no passo a passo) ou pelo tipo.
    const x = m.rascunho(tam)
    const y = m.rascunho(tam)
    for (let i = 1; i < itens.length; i += 1) {
      const atual = itens[i]
      let j = i - 1
      for (; j >= 0; j -= 1) {
        m.mem.gravarBytes(x, atual)
        m.mem.gravarBytes(y, itens[j])
        const menor = cmp ? yield* comparadorDoAluno(m, cmp.valor, t, x, y) : (yield* compararPorTipo(m, t, x, y)) < 0
        if (!menor) break
        itens[j + 1] = itens[j]
      }
      itens[j + 1] = atual
    }
    itens.forEach((item, i) => m.mem.gravarBytes(inicio + i * tam, item))
  },
  * reverse(m, { args }) {
    const [a, b] = args
    const tam = tamanhoDe(a.tipo.alvo)
    const n = (Number(b.valor) - Number(a.valor)) / tam
    const itens = []
    for (let i = 0; i < n; i += 1) itens.push(m.mem.lerBytes(Number(a.valor) + i * tam, tam))
    itens.reverse().forEach((item, i) => m.mem.gravarBytes(Number(a.valor) + i * tam, item))
  },
  * swap(m, { args }) {
    const [a, b] = args
    const tam = tamanhoDe(a.tipo.alvo)
    const x = m.mem.lerBytes(Number(a.valor), tam)
    m.mem.gravarBytes(Number(a.valor), m.mem.lerBytes(Number(b.valor), tam))
    m.mem.gravarBytes(Number(b.valor), x)
  },
  * max(m, { args }) {
    const t = args[0].tipo.alvo
    return (yield* compararPorTipo(m, t, args[0].valor, args[1].valor)) < 0 ? args[1].valor : args[0].valor
  },
  * min(m, { args }) {
    const t = args[0].tipo.alvo
    return (yield* compararPorTipo(m, t, args[1].valor, args[0].valor)) < 0 ? args[1].valor : args[0].valor
  },
  * find(m, { args }) {
    const [a, b, valor] = args
    const t = a.tipo.alvo
    const tam = tamanhoDe(t)
    for (let p = Number(a.valor); p < Number(b.valor); p += tam) if ((yield* compararPorTipo(m, t, p, valor.valor)) === 0) return p
    return Number(b.valor)
  },
  * count(m, { args }) {
    const [a, b, valor] = args
    const t = a.tipo.alvo
    const tam = tamanhoDe(t)
    let n = 0
    for (let p = Number(a.valor); p < Number(b.valor); p += tam) if ((yield* compararPorTipo(m, t, p, valor.valor)) === 0) n += 1
    return n
  },
  * max_element(m, { args }) {
    const [a, b] = args
    const t = a.tipo.alvo
    const tam = tamanhoDe(t)
    let melhor = Number(a.valor)
    for (let p = melhor + tam; p < Number(b.valor); p += tam) if ((yield* compararPorTipo(m, t, melhor, p)) < 0) melhor = p
    return melhor
  },
  * min_element(m, { args }) {
    const [a, b] = args
    const t = a.tipo.alvo
    const tam = tamanhoDe(t)
    let melhor = Number(a.valor)
    for (let p = melhor + tam; p < Number(b.valor); p += tam) if ((yield* compararPorTipo(m, t, p, melhor)) < 0) melhor = p
    return melhor
  },
}
