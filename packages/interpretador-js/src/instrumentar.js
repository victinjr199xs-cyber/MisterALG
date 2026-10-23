// Instrumenta um programa JavaScript (ou TypeScript) para o passo a passo:
//  - antes de cada comando entra `yield __passo(linha, () => ({variáveis visíveis}))`;
//  - cada função vira um gerador (para o passo a passo poder entrar nela e pausar);
//  - cada chamada vira `yield* __chamar(...)` e cada `await` vira `yield __aguardar(...)`,
//    que o laço de eventos de runtime.js conduz (pilha de chamadas e filas visíveis).
// Construtores, getters/setters e inicializadores de campos de classe rodam direto, sem passo a passo.

import { transformSync } from '@babel/core'
import pluginTypescript from '@babel/plugin-transform-typescript'

const CRIADO = Symbol('criado pelo MisterALG')

/** Função que o passo a passo transforma em gerador. */
function convertivel(no) {
  if (no.generator) return false // gerador do próprio aluno: roda como está
  if (no.type === 'ClassMethod' || no.type === 'ObjectMethod') return no.kind === 'method'
  return ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(no.type)
}

/** Onde um nó está: 'programa', a função convertível que o contém, ou null (contexto sem yield). */
function contexto(path) {
  let p = path
  while (p.parentPath) {
    const pai = p.parentPath
    if (['ClassProperty', 'ClassPrivateProperty', 'ClassAccessorProperty', 'StaticBlock'].includes(pai.node.type) && p.key === 'value') return null
    if (pai.isFunction()) {
      if (p.listKey === 'params') return null // valor padrão de parâmetro: yield não é permitido ali
      return convertivel(pai.node) && !pai.node[CRIADO] ? pai : null
    }
    if (pai.isClassMethod() || pai.isClassPrivateMethod()) return null
    p = pai
  }
  return 'programa'
}

const linhaDe = (no) => no.loc?.start.line ?? 0

export function instrumentar(fonte, { typescript = false } = {}) {
  let codigo = fonte
  const tiposDeclarados = {} // TypeScript: nome → tipo escrito pelo aluno (o último, se o nome se repetir)
  try {
    if (typescript) {
      codigo = transformSync(fonte, {
        filename: 'programa.ts', babelrc: false, configFile: false, sourceType: 'script',
        retainLines: true, // as linhas do JS gerado continuam as do .ts
        plugins: [coletarTipos(tiposDeclarados), [pluginTypescript, { onlyRemoveTypeImports: true }]],
      }).code
    }
    const r = transformSync(codigo, {
      filename: 'programa.js', babelrc: false, configFile: false, sourceType: 'script',
      plugins: [pluginDoPassoAPasso],
    })
    return { codigo: r.code, tiposDeclarados }
  } catch (e) {
    return { erro: { linha: e.loc?.line ?? 0, coluna: e.loc?.column ?? 0, mensagem: traduzirErroDeSintaxe(e) } }
  }
}

function traduzirErroDeSintaxe(e) {
  const m = String(e.reasonCode ?? '')
  const original = String(e.message).replace(/^.*?: /, '').replace(/\s*\(\d+:\d+\)\s*$/, '').split('\n')[0]
  const TRADUCOES = {
    UnexpectedToken: 'símbolo inesperado (confira parênteses, chaves e vírgulas)',
    MissingSemicolon: 'falta um ponto e vírgula, ou há algo sobrando na linha',
    UnterminatedString: 'texto sem aspas de fechamento',
    UnterminatedTemplate: 'template string (crase) sem fechamento',
    VarRedeclaration: 'nome declarado duas vezes',
    UnexpectedReservedWord: 'palavra reservada usada como nome',
    InvalidLhs: 'lado esquerdo inválido numa atribuição',
  }
  return TRADUCOES[m] ? `${TRADUCOES[m]} — ${original}` : original
}

/** Guarda os tipos que o aluno escreveu (let x: number), para a tela mostrar ao lado do valor. */
function coletarTipos(destino) {
  return () => ({
    visitor: {
      Identifier(path) {
        const anotacao = path.node.typeAnnotation?.typeAnnotation
        if (!anotacao) return
        const texto = path.hub.getCode?.()?.slice(anotacao.start, anotacao.end)
        if (texto) destino[path.node.name] = texto
      },
    },
  })
}

function pluginDoPassoAPasso({ types: t, template }) {
  const criado = (no) => { no[CRIADO] = true; return no }
  /** Marca uma subárvore inteira criada aqui, para o Babel não instrumentá-la de novo quando visitá-la. */
  const criadoTudo = (no) => {
    if (no && typeof no === 'object') {
      if (no.type) no[CRIADO] = true
      for (const [k, v] of Object.entries(no)) if (k !== 'loc' && v && typeof v === 'object') criadoTudo(v)
    }
    return no
  }

  /** `yield __passo(linha, () => ({a, b}))` com as variáveis já declaradas antes de `posicao`. */
  function passo(path, linha, posicao = path.node.start ?? 0) {
    const nomes = new Set()
    const funcao = path.getFunctionParent()?.node ?? null
    for (let escopo = path.scope; escopo; escopo = escopo.parent) {
      for (const [nome, b] of Object.entries(escopo.bindings)) {
        if (nome.startsWith('__') || nomes.has(nome)) continue
        if (b.kind === 'hoisted' || b.path.isClassDeclaration() || b.path.isFunctionDeclaration()) continue
        if (b.kind === 'module') continue
        const antes = b.kind === 'var' || b.kind === 'param' || (b.path.node.start ?? 0) < posicao
        if (antes) nomes.add(nome)
      }
      if (escopo.block === funcao || escopo.path.isProgram()) break
    }
    const leitura = t.arrowFunctionExpression([], t.objectExpression([...nomes].map((n) => t.objectProperty(t.identifier(n), t.identifier(n), false, true))))
    criado(leitura)
    return criado(t.yieldExpression(criado(t.callExpression(t.identifier('__passo'), [t.numericLiteral(linha), leitura]))))
  }

  function instrumentarLista(path, chave) {
    const lista = path.get(chave)
    for (const s of lista) {
      if (s.node[CRIADO] || s.isFunctionDeclaration() || s.isEmptyStatement()) continue
      if (s.isExpressionStatement() && s.node.expression.type === 'StringLiteral') continue // "use strict"
      s.insertBefore(criado(t.expressionStatement(passo(s, linhaDe(s.node)))))
    }
  }

  function info(no, nome) {
    return t.objectExpression([
      t.objectProperty(t.identifier('nome'), t.stringLiteral(nome || '(anônima)')),
      t.objectProperty(t.identifier('linha'), t.numericLiteral(linhaDe(no))),
      t.objectProperty(t.identifier('assincrona'), t.booleanLiteral(!!no.async)),
    ])
  }

  function nomeDaFuncao(path) {
    const no = path.node
    if (no.id?.name) return no.id.name
    if (no.key) return no.key.name ?? no.key.value ?? '(método)'
    const pai = path.parent
    if (pai.type === 'VariableDeclarator' && pai.id.type === 'Identifier') return pai.id.name
    if ((pai.type === 'ObjectProperty' || pai.type === 'ClassProperty') && pai.key) return pai.key.name ?? pai.key.value
    if (pai.type === 'AssignmentExpression' && pai.left.type === 'MemberExpression') return pai.left.property.name ?? '(anônima)'
    return '(anônima)'
  }

  return {
    visitor: {
      Program: {
        exit(path) {
          instrumentarLista(path, 'body')
          // Todo o programa vira o gerador __programa, que o laço de eventos chama primeiro.
          const corpo = path.node.body
          path.node.body = [criado(t.functionDeclaration(t.identifier('__programa'), [], t.blockStatement(corpo), true))]
        },
      },
      BlockStatement: {
        exit(path) {
          if (path.node[CRIADO] || !contexto(path)) return
          instrumentarLista(path, 'body')
        },
      },
      SwitchCase: {
        exit(path) {
          if (contexto(path)) instrumentarLista(path, 'consequent')
        },
      },
      // (uma chave só: o Babel não junta duas chaves "A|B" que repetem um tipo; a segunda apaga a primeira)
      'IfStatement|ForStatement|ForInStatement|ForOfStatement|WhileStatement|DoWhileStatement': {
        enter(path) {
          if (!contexto(path)) return
          // Corpos de uma linha só viram blocos, para receber o passo a passo também.
          for (const chave of ['consequent', 'alternate', 'body']) {
            const filho = path.node[chave]
            if (filho && filho.type !== 'BlockStatement' && !(chave === 'alternate' && filho.type === 'IfStatement')) {
              path.node[chave] = t.blockStatement([filho])
            }
          }
        },
        exit(path) {
          if (!contexto(path) || path.node[CRIADO] || !(path.isForStatement() || path.isWhileStatement() || path.isDoWhileStatement())) return
          // A condição de cada volta também pausa (e um laço vazio não trava o app).
          const teste = path.node.test ?? t.booleanLiteral(true)
          // (a variável do for, declarada no início dele, já vale na condição)
          const posicao = path.node.test?.start ?? path.node.body.start
          path.node.test = t.sequenceExpression([passo(path, linhaDe(path.node), posicao), teste])
          path.node[CRIADO] = true
        },
      },
      CallExpression: {
        exit(path) {
          if (path.node[CRIADO] || !contexto(path)) return
          const { callee } = path.node
          if (callee.type === 'Super' || callee.type === 'Import' || path.node.optional || callee.optional) return
          const args = t.arrayExpression(path.node.arguments)
          const linha = t.numericLiteral(linhaDe(path.node))
          let chamada
          if (callee.type === 'MemberExpression' && callee.object.type !== 'Super') {
            const chave = callee.computed ? callee.property : t.stringLiteral(callee.property.name ?? callee.property.id?.name)
            if (callee.property.type === 'PrivateName') return // obj.#metodo(): roda direto
            chamada = t.callExpression(t.identifier('__chamarMetodo'), [callee.object, chave, args, linha])
          } else {
            const este = callee.type === 'MemberExpression' ? t.thisExpression() : t.identifier('undefined')
            chamada = t.callExpression(t.identifier('__chamar'), [callee, este, args, linha])
          }
          path.replaceWith(criado(t.yieldExpression(criado(chamada), true)))
        },
      },
      AwaitExpression: {
        exit(path) {
          const ctx = contexto(path)
          if (!ctx || ctx === 'programa') return
          path.replaceWith(criado(t.yieldExpression(criado(t.callExpression(t.identifier('__aguardar'), [path.node.argument])))))
        },
      },
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ObjectMethod|ClassMethod': {
        exit(path) {
          const no = path.node
          if (no[CRIADO] || !convertivel(no)) return
          const nome = nomeDaFuncao(path)
          const corpo = no.body.type === 'BlockStatement' ? no.body : t.blockStatement([t.returnStatement(no.body)])
          const gerador = criado(t.functionExpression(null, no.params, corpo, true, false))
          if (path.isClassMethod()) {
            // Vira método gerador (o super continua valendo); depois da classe, __envolverMetodos põe o invólucro.
            const classe = path.parentPath.parentPath
            ;(classe.node.__metodos ??= []).push({ chave: no.computed ? null : (no.key.name ?? no.key.value), estatico: !!no.static, info: info(no, nome) })
            no.generator = true
            no.async = false
            no[CRIADO] = true
            return
          }
          if (path.isObjectMethod()) {
            path.replaceWith(criado(t.objectProperty(no.key, criado(t.callExpression(t.identifier('__funcao'), [gerador, info(no, nome)])), no.computed)))
            return
          }
          if (path.isArrowFunctionExpression()) {
            const ligado = criado(t.callExpression(criado(t.memberExpression(gerador, t.identifier('bind'))), [criado(t.thisExpression())]))
            path.replaceWith(criado(t.callExpression(t.identifier('__funcao'), [ligado, info(no, nome)])))
            return
          }
          if (path.isFunctionExpression()) {
            path.replaceWith(criado(t.callExpression(t.identifier('__funcao'), [gerador, info(no, nome)])))
            return
          }
          // Declaração: continua "içada" (dá para chamar antes da linha dela); o gerador é registrado no começo do bloco.
          const id = no.id
          const invólucro = criadoTudo(template.statement.ast`function ${t.identifier(id.name)}(...__argumentos) { return __sincrono(${t.identifier(id.name)}, this, __argumentos) }`)
          const registro = criado(t.expressionStatement(criado(t.callExpression(t.identifier('__registrar'), [t.identifier(id.name), gerador, info(no, nome)]))))
          path.replaceWith(invólucro)
          const bloco = path.parentPath.node.type === 'ExportNamedDeclaration' ? path.parentPath.parentPath : path.parentPath
          const lista = bloco.node.body ?? bloco.node.consequent
          if (Array.isArray(lista)) lista.unshift(registro)
        },
      },
      'ClassDeclaration|ClassExpression': {
        exit(path) {
          const metodos = path.node.__metodos
          if (!metodos?.length) return
          const lista = t.arrayExpression(metodos.filter((m) => m.chave !== null).map((m) => t.objectExpression([
            t.objectProperty(t.identifier('chave'), t.stringLiteral(String(m.chave))),
            t.objectProperty(t.identifier('estatico'), t.booleanLiteral(m.estatico)),
            t.objectProperty(t.identifier('info'), m.info),
          ])))
          delete path.node.__metodos
          if (path.isClassDeclaration()) {
            path.insertAfter(criado(t.expressionStatement(criado(t.callExpression(t.identifier('__envolverMetodos'), [t.identifier(path.node.id.name), lista])))))
          } else {
            path.node[CRIADO] = true
            path.replaceWith(criado(t.callExpression(t.identifier('__envolverMetodos'), [path.node, lista])))
          }
        },
      },
    },
  }
}
