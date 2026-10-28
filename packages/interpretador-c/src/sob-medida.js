// Cabeçalhos sob medida para cada programa. O passo a passo lê a árvore que o clang
// escreve em JSON, e o clang (em WebAssembly) escreve esse JSON aos pedacinhos: o
// tempo cresce com o tamanho dos cabeçalhos, mesmo o que o programa nem usa. Por isso
// fica de fora o que ninguém usa:
//   - nos cabeçalhos "podáveis" (<algorithm>, <numeric>...), cada função ou classe;
//   - em qualquer cabeçalho, as linhas marcadas com "// @se nome1 nome2" (ou os trechos
//     entre "// @se ..." e "// @fim"), como o rbegin() de cada contêiner; com "// @se!",
//     só se o programa usa o nome solto (o begin(v) livre: v.begin() e o .begin() dos
//     cabeçalhos não contam);
//   - no <bits/stdc++.h>, os contêineres cujos nomes não aparecem no programa.
//
// "Ninguém usa" é decidido pelos nomes: um item fica se o nome dele aparece no programa
// ou no que já ficou dos cabeçalhos (sort usa less, less usa...). Sobrar um item a mais
// só custa tempo; faltar um seria erro de compilação, e por isso um operador fica sempre
// que a classe dele fica, e o que não tem nome fica sempre.

const IDENTIFICADOR = /[A-Za-z_]\w*/g
const semComentarios = (texto) => texto.replace(/\/\/[^\n]*/g, '').replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
const nomesEm = (texto) => semComentarios(texto).match(IDENTIFICADOR) ?? []
// "  size_t find(const string &s) const;": o nome que uma linha declara (find) não é um uso dele.
const DECLARACAO = /^(\s*(?:(?:const|static|virtual|explicit|inline|friend|unsigned|long)\s+)*[A-Za-z_][\w:]*(?:<[^()]*?>)?(?:\s*[*&]+\s*|\s+))([A-Za-z_]\w*)(\s*\()/gm
const NAO_E_TIPO = /^\s*(return|throw|else|case|delete|new|goto|co_return|typedef|using)\b/
/** Os nomes usados num trecho de cabeçalho, sem os nomes das funções que ele só declara. */
const nomesUsadosEm = (texto) => nomesEm(semComentarios(texto).replace(DECLARACAO, (m, tipo, _nome, abre) => (NAO_E_TIPO.test(tipo) ? m : `${tipo} ${abre}`)))
/** Os nomes usados soltos (não depois de "." ou "->"). */
const nomesSoltosEm = (texto) => [...semComentarios(texto).matchAll(/(?<!(?:\.|->)\s*)\b[A-Za-z_]\w*/g)].map((m) => m[0])
const MARCA = '\u0001' // lugar de um trecho marcado dentro do texto: MARCA + número + MARCA

/** O nome do que um item declara (a função, a classe, o typedef; num operador, a classe dele), ou null. */
function nomeDoItem(texto) {
  let t = semComentarios(texto).replace(new RegExp(`${MARCA}\\d+${MARCA}`, 'g'), '').trim()
  // tira o "template <...>" do começo (com <> dentro)
  while (t.startsWith('template')) {
    let nivel = 0
    let i = t.indexOf('<')
    for (; i < t.length; i += 1) {
      if (t[i] === '<') nivel += 1
      else if (t[i] === '>' && --nivel === 0) break
    }
    t = t.slice(i + 1).trim()
  }
  const classe = /^(?:struct|class)\s+(\w+)/.exec(t)
  if (classe) return classe[1]
  const apelido = /^typedef\b[^;]*?\b(\w+)\s*;/.exec(t)
  if (apelido) return apelido[1]
  const operador = /\boperator\s*[^\s(]+\s*\(([^)]*)/.exec(t)
  if (operador) return /^\s*(?:const\s+)?(\w+)\s*</.exec(operador[1])?.[1] ?? null
  return /(\w+)\s*\(/.exec(t)?.[1] ?? null
}

/** Os itens de nível de namespace: [{ texto, nome }]; o começo (até "namespace std {") e o fim ficam sem nome. */
export function itensDoCabecalho(texto) {
  const inicio = texto.indexOf('namespace std {\n')
  const fim = texto.lastIndexOf('}')
  if (inicio < 0 || fim < inicio) return [{ texto, nome: null }]
  const corpo = texto.slice(inicio + 16, fim)
  const itens = [{ texto: texto.slice(0, inicio + 16), nome: null }]
  let nivel = 0
  let atual = ''
  for (let i = 0; i < corpo.length; i += 1) {
    const c = corpo[i]
    if (c === '/' && corpo[i + 1] === '/') { // comentário: até o fim da linha
      const nl = corpo.indexOf('\n', i)
      atual += corpo.slice(i, nl < 0 ? corpo.length : nl)
      i = (nl < 0 ? corpo.length : nl) - 1
      continue
    }
    if (c === '"' || c === "'") { // texto ou caractere: de uma vez (pode ter { e })
      let j = i + 1
      while (j < corpo.length && corpo[j] !== c) j += corpo[j] === '\\' ? 2 : 1
      atual += corpo.slice(i, j + 1)
      i = j
      continue
    }
    atual += c
    if (c === '{' || c === '(') nivel += 1
    else if (c === '}' || c === ')') nivel -= 1
    if (c === '\n' && nivel === 0 && /[;}]\s*$/.test(semComentarios(atual).replace(new RegExp(`${MARCA}\\d+${MARCA}`, 'g'), ''))) {
      itens.push({ texto: atual, nome: nomeDoItem(atual) })
      atual = ''
    }
  }
  if (atual.trim()) itens.push({ texto: atual, nome: nomeDoItem(atual) })
  itens.push({ texto: texto.slice(fim), nome: null })
  return itens
}

/** Separa os trechos marcados com "// @se nomes": devolve o texto com MARCAs no lugar deles. */
function separarMarcados(texto, trechos) {
  const linhas = texto.split('\n')
  const saida = []
  for (let i = 0; i < linhas.length; i += 1) {
    const sozinha = /^\s*\/\/ @se(!?) (.+)$/.exec(linhas[i])
    if (sozinha) { // trecho de várias linhas, até "// @fim"
      const fim = linhas.findIndex((l, j) => j > i && /^\s*\/\/ @fim\s*$/.test(l))
      trechos.push({ texto: `${linhas.slice(i + 1, fim).join('\n')}\n`, nomes: sozinha[2].trim().split(/\s+/), soDoPrograma: !!sozinha[1] })
      saida.push(`${MARCA}${trechos.length - 1}${MARCA}`)
      i = fim
      continue
    }
    const naLinha = /^(.*?)\s*\/\/ @se(!?) (.+)$/.exec(linhas[i])
    if (naLinha) {
      trechos.push({ texto: `${naLinha[1]}\n`, nomes: naLinha[3].trim().split(/\s+/), soDoPrograma: !!naLinha[2] })
      saida.push(`${MARCA}${trechos.length - 1}${MARCA}`)
      continue
    }
    saida.push(linhas[i])
  }
  return saida.join('\n')
}

/**
 * Os cabeçalhos para este programa.
 * @param cabecalhos { nome: texto | { pasta... } } (todos)
 * @param podaveis os nomes dos cabeçalhos que podem perder funções e classes inteiras
 * @param paraBits (nomes usados) => lista dos cabeçalhos que o <bits/stdc++.h> inclui
 */
export function cabecalhosSobMedida(fonte, cabecalhos, podaveis, paraBits) {
  const usados = new Set(nomesEm(fonte))
  const soltosNoPrograma = new Set(nomesSoltosEm(fonte))
  const resultado = { ...cabecalhos }
  if (cabecalhos.bits) resultado.bits = { 'stdc++.h': `#pragma once\n${paraBits(usados).map((c) => `#include <${c}>`).join('\n')}\n` }
  // Os cabeçalhos alcançados pelos #include do programa (e dos próprios cabeçalhos).
  const alcancados = new Set()
  const pendentes = [...semComentarios(fonte).matchAll(/#\s*include\s*<([^>]+)>/g)].map((m) => m[1])
  while (pendentes.length) {
    const nome = pendentes.pop()
    if (alcancados.has(nome)) continue
    alcancados.add(nome)
    const texto = nome === 'bits/stdc++.h' ? resultado.bits?.['stdc++.h'] : resultado[nome]
    if (typeof texto === 'string') for (const m of texto.matchAll(/#\s*include\s*<([^>]+)>/g)) pendentes.push(m[1])
  }
  // Partes que podem ficar de fora: os trechos marcados e (nos podáveis) os itens. O resto já conta como usado.
  const trechos = []
  const partes = []
  const montar = new Map() // cabeçalho → itens (cada um com texto que pode ter MARCAs)
  const usar = (texto) => { for (const n of nomesUsadosEm(texto.replace(new RegExp(`${MARCA}\\d+${MARCA}`, 'g'), ' '))) usados.add(n) }
  for (const nome of alcancados) {
    const original = resultado[nome]
    if (typeof original !== 'string') continue
    const texto = separarMarcados(original, trechos)
    const itens = podaveis.includes(nome) ? itensDoCabecalho(texto) : [{ texto, nome: null }]
    montar.set(nome, itens)
    for (const it of itens) {
      if (it.nome === null) { it.fica = true; usar(it.texto) } else partes.push({ ...it, item: it })
    }
  }
  for (const t of trechos) partes.push({ texto: t.texto, nomes: t.nomes, item: t, onde: t.soDoPrograma ? soltosNoPrograma : usados })
  // Fecho: uma parte fica se um nome dela é usado; os nomes de dentro passam a ser usados também.
  const ficou = (p) => { p.item.fica = true; usar(p.texto) }
  for (let mudou = true; mudou;) {
    mudou = false
    for (const p of partes) {
      if (p.item.fica || !(p.nomes ?? [p.nome]).some((n) => (p.onde ?? usados).has(n))) continue
      ficou(p)
      mudou = true
    }
  }
  const voltarTrechos = (texto) => texto.replace(new RegExp(`${MARCA}(\\d+)${MARCA}`, 'g'), (_m, i) => (trechos[i].fica ? voltarTrechos(trechos[i].texto) : '\n'))
  for (const [nome, itens] of montar) resultado[nome] = voltarTrechos(itens.filter((it) => it.fica).map((it) => it.texto).join(''))
  return resultado
}
