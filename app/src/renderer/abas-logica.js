// Lógica pura das abas de documentos (sem DOM): reutilizar a aba vazia, achar a aba de um arquivo,
// escolher a próxima ao fechar, ciclar com Ctrl+Tab e (de)serializar a recuperação após queda.

/** Mesma chave para o mesmo arquivo (o Windows não diferencia maiúsculas nem a barra). */
export const chaveCaminho = (c) => String(c).replace(/\\/g, '/').toLowerCase()

/** Aba que já mostra esse arquivo, ou undefined. */
export const acharPorCaminho = (abas, caminho) => (caminho ? abas.find((a) => a.caminho && chaveCaminho(a.caminho) === chaveCaminho(caminho)) : undefined)

/** Só existe uma aba, sem nome, sem alterações e vazia (ou só com o esqueleto): ela é reaproveitada. `vazia(aba)` decide o texto. */
export function abaReutilizavel(abas, vazia) {
  const [a] = abas
  return abas.length === 1 && !a.caminho && !a.modificado && vazia(a) ? a : undefined
}

/** Índice da aba que fica ativa depois de fechar a do índice `i` (a seguinte; se era a última, a anterior); null se não sobra nenhuma. */
export const proximaAoFechar = (n, i) => (n <= 1 ? null : i < n - 1 ? i : i - 1)

/** Ctrl+Tab (dir = 1) e Ctrl+Shift+Tab (dir = -1), dando a volta. */
export const ciclar = (n, atual, dir) => (n ? (atual + dir + n) % n : 0)

/** Move o item de `de` para `para` (arrastar para reordenar). Devolve uma lista nova. */
export function reordenar(lista, de, para) {
  const nova = [...lista]
  nova.splice(para, 0, ...nova.splice(de, 1))
  return nova
}

/** Nome mostrado na aba. */
export const nomeDaAba = (a, extensoes) => (a.caminho ? a.caminho.split(/[\\/]/).pop() : a.linguagem === 'portugol' ? a.nome : `${a.nome}.${extensoes[a.linguagem]}`)

/**
 * Arquivo de recuperação: só as abas modificadas. `abas` = [{ texto, caminho, nome, codificacao, linguagem, modificado }].
 * Devolve null se não há nada a guardar.
 */
export function serializarRecuperacao(abas, indiceAtivo) {
  const lista = abas.map((a, i) => ({ a, i })).filter(({ a }) => a.modificado)
  if (!lista.length) return null
  const guardar = ({ a }) => ({ texto: a.texto, caminho: a.caminho ?? null, nome: a.nome, codificacao: a.codificacao, linguagem: a.linguagem })
  const ativa = Math.max(0, lista.findIndex(({ i }) => i === indiceAtivo))
  return { versao: 2, abas: lista.map(guardar), ativa }
}

/** Lê o arquivo de recuperação: o formato novo (várias abas) ou o antigo (um documento só). Devolve { abas, ativa } ou null. */
export function lerRecuperacao(dados) {
  if (!dados || typeof dados !== 'object') return null
  if (Array.isArray(dados.abas)) {
    const abas = dados.abas.filter((a) => typeof a?.texto === 'string')
    return abas.length ? { abas, ativa: Math.min(Math.max(0, dados.ativa | 0), abas.length - 1) } : null
  }
  return typeof dados.texto === 'string' ? { abas: [dados], ativa: 0 } : null
}
