// Lógica pura do aviso de erro editável (sem DOM): o campo mostra a linha sem a indentação
// e a correção devolve a indentação original, a menos que o aluno tenha digitado a dele.

const RE_INDENTACAO = /^[ \t]*/

/** O que aparece no campo "Conteúdo da linha": a linha sem a indentação. */
export const textoVisivel = (linha) => linha.replace(RE_INDENTACAO, '')

/** A linha como ficará no documento: indentação original + o que foi digitado (salvo se o aluno digitou a própria). */
export const linhaCorrigida = (original, digitado) => (/^[ \t]/.test(digitado) ? digitado : RE_INDENTACAO.exec(original)[0] + digitado)

/** "Corrigir" e "Corrigir e executar" só valem se a linha vai mudar. */
export const alterou = (original, digitado) => linhaCorrigida(original, digitado) !== original
