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

export function descrever(maq, endereco, tipo, compacto = false) {
  const mem = maq.mem
  const base = { endereco, tipo: tipo.nome }
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
