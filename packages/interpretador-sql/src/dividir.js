// Separa um script SQL em comandos (um por ";"), guardando a linha de cada um para o passo a passo.
// Respeita o que o PostgreSQL respeita: 'textos' (com '' dentro), "nomes", -- comentários, /* comentários */
// (que podem se aninhar) e corpos $tag$ ... $tag$ de funções.

/** @returns {{ sql: string, linha: number, inicio: number }[]} linha começa em 1; inicio = posição no texto */
export function dividirComandos(fonte) {
  const comandos = []
  let inicio = 0
  let i = 0
  const n = fonte.length
  const fechar = (fim) => {
    const trecho = fonte.slice(inicio, fim)
    if (temCodigo(trecho)) {
      const desloc = inicio + primeiroCodigo(trecho)
      comandos.push({ sql: fonte.slice(desloc, fim).trim(), linha: linhaDe(fonte, desloc), inicio: desloc })
    }
    inicio = fim + 1
  }
  while (i < n) {
    const c = fonte[i]
    const d = fonte[i + 1]
    if (c === "'" || c === '"') {
      i += 1
      while (i < n && !(fonte[i] === c && fonte[i + 1] !== c)) i += fonte[i] === c ? 2 : 1
      i += 1
    } else if (c === '-' && d === '-') {
      while (i < n && fonte[i] !== '\n') i += 1
    } else if (c === '/' && d === '*') {
      i = fimDoComentario(fonte, i)
    } else if (c === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(fonte.slice(i))?.[0]
      if (tag) {
        const fim = fonte.indexOf(tag, i + tag.length)
        i = fim < 0 ? n : fim + tag.length
      } else i += 1
    } else if (c === ';') {
      fechar(i)
      i += 1
    } else i += 1
  }
  fechar(n)
  return comandos
}

/** O texto tem algo além de espaços e comentários? */
function temCodigo(trecho) {
  return primeiroCodigo(trecho) < trecho.length
}

/** Posição do primeiro caractere que não é espaço nem comentário. */
function primeiroCodigo(trecho) {
  let i = 0
  for (;;) {
    while (i < trecho.length && /\s/.test(trecho[i])) i += 1
    if (trecho.startsWith('--', i)) {
      while (i < trecho.length && trecho[i] !== '\n') i += 1
    } else if (trecho.startsWith('/*', i)) {
      i = fimDoComentario(trecho, i)
    } else return i
  }
}

// Posição logo depois do comentário de bloco que começa em i (no PostgreSQL eles se aninham).
function fimDoComentario(texto, i) {
  let nivel = 0
  do {
    if (texto[i] === '/' && texto[i + 1] === '*') { nivel += 1; i += 2 }
    else if (texto[i] === '*' && texto[i + 1] === '/') { nivel -= 1; i += 2 }
    else i += 1
  } while (i < texto.length && nivel > 0)
  return i
}

export const linhaDe = (texto, posicao) => texto.slice(0, posicao).split('\n').length
