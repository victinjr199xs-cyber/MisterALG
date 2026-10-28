// Descreve a memória para a tela: o valor de cada variável (vetores, structs e
// ponteiros por dentro) e o nome do lugar para onde um ponteiro aponta ("v[2]", "p.x",
// "bloco #3[1]"), que é o que a IDE usa para desenhar as setas.

import { hex } from './memoria.js'
import { layout, tamanhoDe, vetor } from './tipos.js'

const MAX_ITENS = 64

function formatarValor(tipo, v, compacto) {
  if (tipo.k === 'real') {
    const s = String(Number.parseFloat(Number(v).toPrecision(tipo.tamanho === 4 ? 7 : 15)))
    return /[.eEn]/.test(s) ? s : `${s}.0`
  }
  if (tipo.bool) return v ? 'true' : 'false'
  if (tipo.k === 'int' && tipo.tamanho === 1 && !/^(u?int8_t|uint8_t)$/.test(tipo.nome)) {
    const n = Number(v)
    // Dentro de um vetor de char basta a letra; numa variável sozinha mostra também o código.
    if (compacto) return n >= 32 && n < 127 ? String.fromCharCode(n) : n === 0 ? '\\0' : n === 10 ? '\\n' : String(n)
    return n >= 32 && n < 127 ? `'${String.fromCharCode(n)}' (${n})` : n === 0 ? "'\\0' (0)" : n === 10 ? "'\\n' (10)" : String(n)
  }
  return String(v)
}

/** O texto de um vetor de char, até o '\0' (ou o fim do vetor, marcado com …). */
function textoDoVetor(mem, e, n) {
  const bytes = []
  let fechado = false
  for (let i = 0; i < n; i += 1) {
    if (!mem.iniciado[e + i]) return null
    if (mem.bytes[e + i] === 0) { fechado = true; break }
    bytes.push(mem.bytes[e + i])
  }
  const texto = new TextDecoder().decode(Uint8Array.from(bytes))
  return fechado ? `"${texto}"` : `"${texto}…" (sem \\0!)`
}

/** O texto guardado num std::string do passo a passo ({ dados, tamanho, capacidade }). */
function textoDaString(mem, e) {
  if (!mem.temValor(e, 8)) return null
  const dados = mem.dv.getUint32(e, true)
  const n = mem.dv.getUint32(e + 4, true)
  if (!dados || !mem.bloco(dados)) return '""'
  return `"${new TextDecoder().decode(mem.bytes.slice(dados, dados + Math.min(n, 200)))}"`
}

/** Os nomes dos tipos internos da biblioteca do passo a passo do jeito que o aluno entende. */
export function nomeAmigavel(nome) {
  return String(nome)
    .replace(/\bstd::/g, '')
    .replace(/__lambda_(?:\w+?_)?(\d+)_\d+/g, 'lambda da linha $1')
    .replace(/\(lambda at [^)]*?:(\d+):\d+\)/g, 'lambda da linha $1')
    .replace(/\b__no_(?:arvore|hash|lista)</g, 'nó<')
    .replace(/\b__elo_lista\b/g, 'nó')
    .replace(/\b__it_\w+</g, 'iterator<')
}

const MAX_RESUMO = 20

/** Os elementos guardados num contêiner da STL do passo a passo: [{ endereco, tipo }], ou null se não for um. */
function elementos(maq, e, tipo) {
  const mem = maq.mem
  const campos = layout(tipo).campos
  const campo = (lista, nome) => lista.find((c) => c.nome === nome)
  const ler = (c, base = e) => mem.ler(c.tipo, base + c.deslocamento)
  const base = tipo.rotulo.replace(/<.*/, '')
  const itens = []
  if (base === 'vector' || base === 'deque') {
    const dados = campo(campos, '__dados')
    const n = Number(ler(campo(campos, '__tamanho')))
    const inicio = base === 'deque' ? Number(ler(campo(campos, '__inicio'))) : 0
    const cap = base === 'deque' ? Number(ler(campo(campos, '__capacidade'))) : 0
    const t = dados.tipo.alvo
    const p = Number(ler(dados))
    for (let i = 0; i < Math.min(n, MAX_RESUMO + 1); i += 1) itens.push({ endereco: p + (cap ? (inicio + i) % cap : i) * tamanhoDe(t), tipo: t })
    return itens
  }
  if (base === 'array') {
    const v = campo(campos, '__v')
    for (let i = 0; i < Math.min(v.tipo.n, MAX_RESUMO + 1); i += 1) itens.push({ endereco: e + v.deslocamento + i * tamanhoDe(v.tipo.elem), tipo: v.tipo.elem })
    return itens
  }
  if (base === 'list') {
    const no = maq.tipos.de(`__no_lista${tipo.rotulo.slice(base.length)}`)
    const valor = campo(layout(no).campos, 'valor')
    const sentinela = Number(ler(campo(campos, '__sentinela')))
    for (let n = mem.dv.getUint32(sentinela, true); n && n !== sentinela && itens.length <= MAX_RESUMO; n = mem.dv.getUint32(n, true)) {
      itens.push({ endereco: n + valor.deslocamento, tipo: valor.tipo })
    }
    return itens
  }
  const parte = campos.find((c) => c.base && /^__(arvore|tabela)</.test(c.tipo.rotulo))
  if (parte && /^(map|set|multimap|multiset)$/.test(base)) {
    const raiz = campo(layout(parte.tipo).campos, '__raiz')
    const camposNo = layout(raiz.tipo.alvo).campos
    const [valor, esq, dir] = ['valor', 'esq', 'dir'].map((n) => campo(camposNo, n))
    const visitar = (n) => {
      if (!n || itens.length > MAX_RESUMO) return
      visitar(Number(ler(esq, n)))
      if (itens.length <= MAX_RESUMO) itens.push({ endereco: n + valor.deslocamento, tipo: valor.tipo })
      visitar(Number(ler(dir, n)))
    }
    visitar(Number(ler(raiz, e + parte.deslocamento)))
    return itens
  }
  if (parte && /^unordered_/.test(base)) {
    const primeiro = campo(layout(parte.tipo).campos, '__primeiro')
    const camposNo = layout(primeiro.tipo.alvo).campos
    const [valor, prox] = ['valor', 'prox'].map((n) => campo(camposNo, n))
    for (let n = Number(ler(primeiro, e + parte.deslocamento)); n && itens.length <= MAX_RESUMO; n = Number(ler(prox, n))) {
      itens.push({ endereco: n + valor.deslocamento, tipo: valor.tipo })
    }
    return itens
  }
  return null
}

/** Um texto curto com o conteúdo: [1, 2, 3], {ana: 3, bia: 1}, (1, "x")... ou null. */
function resumo(maq, e, tipo, nivel = 0) {
  if (tipo.k !== 'struct') {
    const d = descrever(maq, e, tipo, true)
    return d.forma === 'valor' ? d.texto : d.forma === 'ponteiro' ? d.texto : d.texto ?? '…'
  }
  if (!tipo.decl || nivel > 3) return '…'
  if (tipo.rotulo === 'string') return textoDaString(maq.mem, e) ?? '?'
  const base = tipo.rotulo.replace(/<.*/, '')
  const campos = layout(tipo).campos
  if (base === 'pair') {
    const [a, b] = ['first', 'second'].map((n) => campos.find((c) => c.nome === n))
    return `(${resumo(maq, e + a.deslocamento, a.tipo, nivel + 1)}, ${resumo(maq, e + b.deslocamento, b.tipo, nivel + 1)})`
  }
  if (/^(stack|queue|priority_queue)$/.test(base)) {
    const c = campos.find((x) => x.nome === 'c')
    return resumo(maq, e + c.deslocamento, c.tipo, nivel)
  }
  const itens = elementos(maq, e, tipo)
  if (!itens) return null
  const mapa = /map$/.test(base)
  const textos = itens.slice(0, MAX_RESUMO).map((it) => {
    if (!mapa) return resumo(maq, it.endereco, it.tipo, nivel + 1)
    const [k, v] = ['first', 'second'].map((n) => layout(it.tipo).campos.find((c) => c.nome === n))
    return `${resumo(maq, it.endereco + k.deslocamento, k.tipo, nivel + 1)}: ${resumo(maq, it.endereco + v.deslocamento, v.tipo, nivel + 1)}`
  })
  if (itens.length > MAX_RESUMO) textos.push('…')
  return /set$|map$/.test(base) ? `{${textos.join(', ')}}` : `[${textos.join(', ')}]`
}

export function descrever(maq, endereco, tipo, compacto = false) {
  const mem = maq.mem
  const base = { endereco, tipo: nomeAmigavel(tipo.nome) }
  if (tipo.k === 'array') {
    const n = tipo.n ?? 0
    const tam = tamanhoDe(tipo.elem)
    const itens = []
    for (let i = 0; i < Math.min(n, MAX_ITENS); i += 1) itens.push({ rotulo: `[${i}]`, ...descrever(maq, endereco + i * tam, tipo.elem, true) })
    const r = { ...base, forma: 'vetor', itens, total: n }
    if (tipo.elem.k === 'int' && tipo.elem.tamanho === 1) r.texto = textoDoVetor(mem, endereco, n)
    return r
  }
  if (tipo.k === 'struct') {
    if (!tipo.decl) return { ...base, forma: 'valor', texto: '(tipo incompleto)' }
    const r = {
      ...base,
      forma: 'registro',
      // O vptr (tipo dinâmico) é coisa do compilador; a parte de uma classe base aparece com o nome dela.
      // ("__dados" do string/vector aparece como "dados": é a biblioteca, não o aluno, que escolheu o nome.)
      campos: layout(tipo).campos.filter((c) => !c.oculto).map((c) => ({ rotulo: c.base ? `(${c.nome})` : c.nome.replace(/^__/, ''), ...descrever(maq, endereco + c.deslocamento, c.tipo) })),
    }
    if (tipo.rotulo === 'string') r.texto = textoDaString(mem, endereco)
    else if (tipo.decl.biblioteca) {
      // contêiner da STL: o conteúdo num texto só (os campos de dentro continuam lá)
      try {
        const texto = resumo(maq, endereco, tipo)
        if (texto) r.texto = texto
      } catch { /* objeto ainda sendo construído: sem resumo */ }
    }
    return r
  }
  if (tipo.k === 'void' || tipo.k === 'func') return { ...base, forma: 'valor', texto: '' }
  const temValor = mem.temValor(endereco, tipo.tamanho)
  let valor
  try {
    valor = mem.ler(tipo, endereco)
  } catch {
    return { ...base, forma: 'valor', texto: '?' }
  }
  if (tipo.k === 'ptr' || tipo.k === 'ref') {
    return {
      ...base,
      forma: 'ponteiro',
      alvo: temValor ? valor : null,
      texto: !temValor ? 'lixo' : valor === 0 ? 'NULL' : hex(valor),
      destino: temValor && valor !== 0 ? nomeDoEndereco(maq, valor) : null,
      lixo: !temValor,
    }
  }
  return { ...base, forma: 'valor', texto: temValor ? formatarValor(tipo, valor, compacto) : 'lixo', lixo: !temValor }
}

/** O tipo inteiro de um bloco (para o heap, um vetor do tipo que o programa usou). */
export function tipoDoBloco(b) {
  if (b.regiao !== 'heap') return b.tipo
  if (!b.tipoElem) return null
  const n = Math.floor(b.tamanho / Math.max(1, tamanhoDe(b.tipoElem)))
  return n === 1 ? b.tipoElem : vetor(b.tipoElem, n)
}

function caminho(tipo, desloc) {
  if (!tipo) return desloc ? ` + ${desloc} bytes` : ''
  if (tipo.k === 'array') {
    const tam = Math.max(1, tamanhoDe(tipo.elem))
    const i = Math.floor(desloc / tam)
    return `[${i}]${caminho(tipo.elem, desloc - i * tam)}`
  }
  if (tipo.k === 'struct' && tipo.decl) {
    const campos = layout(tipo).campos
    const c = [...campos].reverse().find((x) => x.deslocamento <= desloc && desloc < x.deslocamento + tamanhoDe(x.tipo))
    if (!c || c.oculto) return '' // o começo de um objeto polimórfico (o vptr): é o objeto inteiro
    // A parte de uma classe base não ganha nome no caminho (b->nome, não b->Animal.nome).
    if (c.base) return caminho(c.tipo, desloc - c.deslocamento)
    return `.${c.nome}${caminho(c.tipo, desloc - c.deslocamento)}`
  }
  return desloc ? ` + ${desloc} bytes` : ''
}

export function nomeDoEndereco(maq, alvo) {
  if (alvo === 0) return 'NULL'
  const funcao = maq.funcaoNoEndereco.get(alvo)
  if (funcao) return `função ${funcao}`
  const mem = maq.mem
  const b = mem.bloco(alvo)
  if (!b) {
    const contem = (x) => alvo >= x.inicio && alvo < Math.max(x.fim, x.inicio + 1)
    if (mem.liberados.some(contem)) return 'memória já liberada!'
    if (mem.foraDeEscopo.some(contem)) return 'variável que já não existe!'
    return 'endereço inválido!'
  }
  const nome = b.regiao === 'heap' ? `bloco #${b.numero}` : b.literal ? 'texto constante' : b.nome
  return nome + caminho(tipoDoBloco(b), alvo - b.inicio)
}
