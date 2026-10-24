// Lê o programa em C# com o tree-sitter (a gramática vem em WebAssembly) e devolve a árvore como dados
// simples, para o interpretador (maquina.js) executar. Só roda no Node (processo principal do app e testes).
//
// Cada nó da árvore: { t: tipo, l: linha (1...), c: coluna, k?: nome do campo no pai, x?: texto (folhas), f?: filhos }

import { createRequire } from 'node:module'

// Pontuação que não ajuda o interpretador: a estrutura já diz onde cada coisa está.
const PONTUACAO = new Set([';', ',', '(', ')', '{', '}', '[', ']', '.', ':', '=>', '::'])

// Nós cujo texto inteiro importa (o conteúdo de um texto entre aspas não é um nó da árvore).
const COM_TEXTO = new Set(['string_literal', 'verbatim_string_literal', 'raw_string_literal', 'character_literal', 'interpolation_format_clause', 'interpolated_string_text', 'interpolated_verbatim_string_text'])

/** Converte o nó em que o cursor está (e, por dentro, os filhos), deixando o cursor onde estava. */
function converter(cursor) {
  const pos = cursor.startPosition
  const o = { t: cursor.nodeType, l: pos.row + 1, c: pos.column }
  const campo = cursor.currentFieldName()
  if (campo) o.k = campo
  if (COM_TEXTO.has(o.t)) {
    o.x = cursor.nodeText
    return o
  }
  if (!cursor.gotoFirstChild()) {
    o.x = cursor.nodeText
    return o
  }
  const filhos = []
  let virgulas = 0
  const listaDeTipos = o.t === 'type_argument_list' || o.t === 'type_parameter_list' // os < e > aqui são só pontuação
  do {
    if (!cursor.nodeIsNamed && (PONTUACAO.has(cursor.nodeType) || (listaDeTipos && (cursor.nodeType === '<' || cursor.nodeType === '>')))) {
      if (cursor.nodeType === ',') virgulas += 1
      continue
    }
    filhos.push(converter(cursor))
  } while (cursor.gotoNextSibling())
  cursor.gotoParent()
  o.f = filhos
  if (o.t === 'array_rank_specifier') o.d = virgulas + 1 // int[,] tem duas dimensões
  return o
}

const COM_OPERANDO_A_DIREITA = new Set(['binary_expression', 'prefix_unary_expression'])

/**
 * A gramática lê "a" + s?.Length como ("a" + s)?.Length, e no C# o ?. pega só o último operando: "a" + (s?.Length).
 * (Sem isto, Console.WriteLine("Nome: " + p?.Nome) escreve a coisa errada.) Reescreve a árvore: o operando mais à
 * direita do binário (ou o operando do unário) vira a condição do ?., e o binário passa a ficar por fora.
 */
function corrigirAcessoCondicional(n) {
  if (!n.f) return n
  n.f = n.f.map(corrigirAcessoCondicional)
  if (n.t !== 'conditional_access_expression') return n
  const cond = n.f.find((x) => x.k === 'condition') ?? n.f[0]
  if (!cond || !COM_OPERANDO_A_DIREITA.has(cond.t)) return n
  const idx = cond.t === 'binary_expression' ? cond.f.findIndex((x) => x.k === 'right') : cond.f.length - 1
  if (idx < 0) return n
  const operando = cond.f[idx]
  const ca = corrigirAcessoCondicional({ ...n, k: operando.k, l: operando.l, c: operando.c, f: n.f.map((x) => (x === cond ? { ...operando, k: 'condition' } : x)) })
  return { ...cond, k: n.k, f: cond.f.map((x, i) => (i === idx ? ca : x)) }
}

const FECHAMENTOS = { ')': 'o parêntese )', '}': 'a chave }', ']': 'o colchete ]', '"': 'as aspas ("")' }

/** Os erros de escrita (o tree-sitter marca com ERROR e MISSING), em português, na ordem do arquivo. */
function coletarErros(cursor, linhas, erros) {
  const tipo = cursor.nodeType
  const pos = cursor.startPosition
  if (cursor.nodeIsMissing) {
    const mensagem = tipo === ';'
      ? 'falta o ponto e vírgula (;) no fim do comando'
      : FECHAMENTOS[tipo]
        ? `falta fechar com ${FECHAMENTOS[tipo]}`
        : `falta ${tipo === 'identifier' ? 'um nome' : `"${tipo}"`} aqui`
    // O C# aponta o fim do comando anterior, não o começo da linha seguinte.
    let linha = pos.row + 1
    let coluna = pos.column
    if (tipo === ';' && coluna === 0 && linha > 1) {
      linha -= 1
      coluna = (linhas[linha - 1] ?? '').length
    }
    erros.push({ linha, coluna, mensagem })
    return
  }
  if (tipo === 'ERROR') {
    const trecho = cursor.nodeText.trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 30)
    erros.push({
      linha: pos.row + 1,
      coluna: pos.column,
      mensagem: trecho ? `símbolo inesperado perto de "${trecho}" (confira ponto e vírgula, parênteses, chaves e aspas)` : 'erro de escrita',
    })
    return
  }
  if (!cursor.gotoFirstChild()) return
  do coletarErros(cursor, linhas, erros)
  while (cursor.gotoNextSibling())
  cursor.gotoParent()
}

/**
 * @param opcoes moduloTreeSitter (o tree-sitter.js), wasmMotor (tree-sitter.wasm) e wasmLinguagem (tree-sitter-c_sharp.wasm);
 *        sem eles, os do node_modules. O módulo é carregado com require de propósito: o empacotador não o embute (ele usa __dirname).
 * @returns { analisar(fonte) → { ast } | { erros: [{ linha, coluna, mensagem }] } }
 */
export async function criarAnalisador({ moduloTreeSitter, wasmMotor, wasmLinguagem } = {}) {
  const requerer = createRequire(import.meta.url)
  const Parser = requerer(moduloTreeSitter ?? 'web-tree-sitter')
  const motor = wasmMotor ?? requerer.resolve('web-tree-sitter/tree-sitter.wasm')
  const gramatica = wasmLinguagem ?? requerer.resolve('tree-sitter-wasms/out/tree-sitter-c_sharp.wasm')
  await Parser.init({ locateFile: () => motor })
  const linguagem = await Parser.Language.load(gramatica)
  const parser = new Parser()
  parser.setLanguage(linguagem)
  return {
    analisar(fonte) {
      const arvore = parser.parse(fonte)
      const cursor = arvore.walk()
      try {
        if (arvore.rootNode.hasError()) {
          const erros = []
          coletarErros(cursor, fonte.split('\n'), erros)
          return { erros: erros.length ? erros : [{ linha: 1, coluna: 0, mensagem: 'erro de escrita no programa' }] }
        }
        return { ast: corrigirAcessoCondicional(converter(cursor)) }
      } finally {
        cursor.delete()
        arvore.delete()
      }
    },
  }
}
