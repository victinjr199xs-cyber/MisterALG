// Lógica pura do menu "/" do editor (sem CodeMirror nem DOM, para poder ser testada no Node).

/** Sem acento e sem caixa: é o que a filtragem compara. */
export const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * O menu abre quando a "/" é a primeira coisa da linha (só espaços antes)
 * e não está dentro de string ou comentário. "a / b" (divisão) nunca abre.
 * @param {string} antes texto da linha antes da "/" digitada
 * @param {boolean} emTextoOuComentario o cursor está dentro de string ou comentário
 */
export function deveAbrir(antes, emTextoOuComentario = false) {
  return !emTextoOuComentario && /^\s*$/.test(antes)
}

/** Enquanto digita depois da "/", só letras, números e "_" mantêm o menu aberto (espaço ou símbolo fecha). */
export const consultaValida = (consulta) => /^[\p{L}\p{N}_]*$/u.test(consulta)

/**
 * Filtra os blocos pelo que foi digitado depois da "/". Começo do nome vem antes de meio de palavra.
 * @param {{busca: string}[]} itens cada item traz `busca` (nome e apelidos)
 */
export function filtrar(itens, consulta) {
  const q = semAcento(consulta).trim()
  if (!q) return itens
  const pontos = (item) => {
    const palavras = semAcento(item.busca).split(/[^\p{L}\p{N}_]+/u).filter(Boolean)
    if (palavras.some((p) => p.startsWith(q))) return 0
    return semAcento(item.busca).includes(q) ? 1 : -1
  }
  return itens
    .map((item, ordem) => ({ item, ordem, p: pontos(item) }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => a.p - b.p || a.ordem - b.ordem)
    .map((x) => x.item)
}

/**
 * Expande o modelo (`|` marca o cursor; `\t` vira um nível de recuo) com a indentação da linha atual.
 * @returns {{texto: string, cursor: number}}
 */
export function montarTrecho(modelo, recuo, unidade = '    ') {
  const linhas = modelo.replaceAll('\t', unidade).split('\n').map((l, i) => (i === 0 ? l : recuo + l))
  const junto = linhas.join('\n')
  const cursor = junto.indexOf('|')
  return { texto: junto.replace('|', ''), cursor: cursor === -1 ? junto.length : cursor }
}
