// A gramática do tree-sitter é do C# 10: não conhece o `>>>` nem os textos "raw" ("""...""") do C# 11.
// Este passo reescreve só isso, ANTES da leitura, sem mudar o número de linhas (os erros e o passo a passo
// apontam para as linhas do aluno):
//   a >>> b   vira  a >> b   (com um espaço no fim; as posições vão em `deslocamentos` e o analisar.js devolve o `>>>`)
//   """..."""  vira  um texto comum ("a\nb") ou, em linhas, ("" +  "a\n" +  "b"  ), com o recuo do fechamento já tirado
//   $"""..{x}..""" e $$"""..{{x}}..""" viram textos interpolados comuns ($"..{x}..").
// Só é chamado quando a leitura direta do programa falhou (analisar.js), então um programa sem C# 11 nunca passa por aqui.

/**
 * @returns { fonte, deslocamentos: número[] (posições no texto novo), mudou }
 */
export function reescrever(f, { deslocamentos: reescreverDeslocamentos = true } = {}) {
  const buf = []
  let tam = 0
  const desl = []
  // MARCA: um `>>` posto no lugar de `>>>` dentro de um {buraco} cru; a posição só se sabe ao emitir
  const MARCA = '\uE000'
  const emitir = (s) => {
    if (s.includes(MARCA)) {
      let r = ''
      for (const ch of s) { if (ch === MARCA) desl.push(tam + r.length); else r += ch }
      s = r
    }
    buf.push(s)
    tam += s.length
  }
  const copiar = (a, b) => emitir(f.slice(a, b))
  let mudou = false

  // Um texto comum ou verbatim (@"", $"", $@""): copia, mas entra nos {buracos} dos interpolados (têm código lá dentro).
  function texto(i, ini, interpolado, verbatim) {
    let j = ini
    let desde = i
    while (j < f.length) {
      const c = f[j]
      if (verbatim) {
        if (c === '"') { if (f[j + 1] === '"') { j += 2; continue } break }
      } else {
        if (c === '\\') { j += 2; continue }
        if (c === '"' || c === '\n') break
      }
      if (interpolado && c === '{') {
        if (f[j + 1] === '{') { j += 2; continue }
        copiar(desde, j + 1)
        j = codigo(j + 1, true)
        desde = j
        continue
      }
      j += 1
    }
    copiar(desde, j + 1)
    return j + 1
  }

  /** O texto cru ("""...""") que começa em i ($ * k, depois j = primeira aspa, N aspas). Devolve onde o programa continua. */
  function cru(i, k, j, N) {
    const aspas = '"'.repeat(N)
    const p = j + N
    let m = p
    while (f[m] === ' ' || f[m] === '\t') m += 1
    const multi = f[m] === '\n' || (f[m] === '\r' && f[m + 1] === '\n')
    const prefixo = k > 0 ? '$' : ''
    if (!multi) {
      // numa linha só: o fechamento (N aspas) tem de estar na mesma linha
      let q = p
      for (; q < f.length && f[q] !== '\n'; q += 1) {
        if (f[q] !== '"') continue
        let r = 0
        while (f[q + r] === '"') r += 1
        if (r >= N) break
        q += r - 1
      }
      if (f[q] !== '"') { copiar(i, p); return p } // sem fechamento: deixa o erro aparecer
      const pecas = [prefixo + '"' + conteudo(f.slice(p, q), k, '') + '"']
      const novo = pecas[0]
      mudou = true
      emitir(novo + ' '.repeat(Math.max(0, q + N - i - novo.replaceAll(MARCA, '').length)))
      return q + N
    }
    // várias linhas: acha a linha do fechamento (só espaços e depois as N aspas)
    const nl = f[m] === '\r' ? '\r\n' : '\n'
    const inicio = m + nl.length
    let linhaIni = inicio
    let fecha = -1
    let recuo = ''
    while (linhaIni <= f.length) {
      const fim = f.indexOf('\n', linhaIni)
      const linha = f.slice(linhaIni, fim < 0 ? f.length : fim)
      const ws = /^[ \t]*/.exec(linha)[0]
      if (linha.startsWith(aspas, ws.length)) { fecha = linhaIni; recuo = ws; break }
      if (fim < 0) break
      linhaIni = fim + 1
    }
    if (fecha < 0) { copiar(i, p); return p }
    const corpo = fecha > inicio ? f.slice(inicio, fecha - nl.length) : null // sem o último fim de linha
    const pecas = corpo === null ? [] : conteudoEmLinhas(corpo, k, recuo, nl)
    mudou = true
    emitir('("" +' + nl)
    for (const peca of pecas) emitir(peca + ' +' + nl)
    emitir(recuo + '"")')
    return fecha + recuo.length + N
  }

  /** O corpo de um texto cru de várias linhas, uma peça ("..." ou $"...") por linha, sem o recuo do fechamento. */
  function conteudoEmLinhas(corpo, k, recuo, nl) {
    const pecas = []
    let resto = corpo
    // uma linha por vez, mas um {buraco} que atravessa linhas fica numa peça só
    let atual = ''
    let inicioDeLinha = true
    let i = 0
    const prefixo = k > 0 ? '$' : ''
    while (i <= resto.length) {
      if (inicioDeLinha) {
        if (resto.startsWith(recuo, i)) i += recuo.length
        else { const ws = /^[ \t]*/.exec(resto.slice(i))[0]; if (/^[ \t]*(\r?\n|$)/.test(resto.slice(i))) i += ws.length }
        inicioDeLinha = false
      }
      if (i >= resto.length) break
      const c = resto[i]
      if (c === '\n' || (c === '\r' && resto[i + 1] === '\n')) {
        const quebra = c === '\r' ? '\\r\\n' : '\\n'
        pecas.push(prefixo + '"' + atual + quebra + '"')
        atual = ''
        i += c === '\r' ? 2 : 1
        inicioDeLinha = true
        continue
      }
      const r = um(resto, i, k)
      atual += r.texto
      i = r.prox
    }
    pecas.push(prefixo + '"' + atual + '"')
    return pecas
  }

  function conteudo(s, k) {
    let saida = ''
    for (let i = 0; i < s.length;) {
      const r = um(s, i, k)
      saida += r.texto
      i = r.prox
    }
    return saida
  }

  /** Um pedaço do corpo cru em s[i]: o texto já escapado para um texto comum (ou o {buraco} inteiro). */
  function um(s, i, k) {
    const c = s[i]
    if (c === '"') return { texto: '\\"', prox: i + 1 }
    if (c === '\\') return { texto: '\\\\', prox: i + 1 }
    if (k === 0) return { texto: c, prox: i + 1 }
    if (c === '}') return { texto: '}}', prox: i + 1 }
    if (c !== '{') return { texto: c, prox: i + 1 }
    let m = 0
    while (s[i + m] === '{') m += 1
    if (m < k) return { texto: '{{'.repeat(m), prox: i + m }
    const literais = m - k
    // o buraco vai até k chaves } seguidas, fora de chaves internas e de textos
    let prof = 0
    let q = i + m
    for (; q < s.length; q += 1) {
      const d = s[q]
      if (d === '"') { q = fimDoTexto(s, q); continue }
      if (d === '{') prof += 1
      else if (d === '}') {
        if (prof > 0) { prof -= 1; continue }
        let r = 0
        while (s[q + r] === '}') r += 1
        if (r >= k) break
        q += r - 1
      }
    }
    if (q >= s.length) return { texto: '{{'.repeat(m), prox: i + m } // sem fechar: deixa o erro aparecer
    return { texto: '{{'.repeat(literais) + '{' + (reescreverDeslocamentos ? s.slice(i + m, q).replace(/>>>(=?)/g, (_, ig) => MARCA + (ig ? '>>= ' : '>> ')) : s.slice(i + m, q)) + '}', prox: q + k }
  }

  const fimDoTexto = (s, q) => {
    for (q += 1; q < s.length && s[q] !== '"'; q += 1) if (s[q] === '\\') q += 1
    return q
  }

  // O código do programa (ou de dentro de um {buraco} de texto interpolado, até a chave que o fecha).
  function codigo(i, buraco) {
    let prof = 0
    let genericos = 0
    const colchetes = [] // cada [ aberto: é de padrão de lista?
    while (i < f.length) {
      const c = f[i]
      if (c === '/' && f[i + 1] === '/') {
        const fim = f.indexOf('\n', i)
        const e = fim < 0 ? f.length : fim
        copiar(i, e)
        i = e
        continue
      }
      if (c === '/' && f[i + 1] === '*') {
        const fim = f.indexOf('*/', i + 2)
        const e = fim < 0 ? f.length : fim + 2
        copiar(i, e)
        i = e
        continue
      }
      if (c === "'") {
        let j = i + 1
        while (j < f.length && f[j] !== "'" && f[j] !== '\n') j += f[j] === '\\' ? 2 : 1
        copiar(i, j + 1)
        i = j + 1
        continue
      }
      if (c === '$' || c === '@' || c === '"') {
        let j = i
        let cifroes = 0
        let arroba = false
        while (f[j] === '$' || f[j] === '@') { if (f[j] === '$') cifroes += 1; else arroba = true; j += 1 }
        if (f[j] === '"') {
          let q = 0
          while (f[j + q] === '"') q += 1
          i = q >= 3 && !arroba ? cru(i, cifroes, j, q) : texto(i, j + 1, cifroes > 0, arroba)
          // "abc"u8 (bytes UTF-8): vira "abc".__U8(), um método escondido do texto que devolve byte[]
          if (cifroes === 0 && (f[i] === 'u' || f[i] === 'U') && f[i + 1] === '8' && !/\w/.test(f[i + 2] ?? '')) { emitir('.__U8()'); i += 2; mudou = true }
        } else {
          copiar(i, j) // @identificador
          i = j
        }
        continue
      }
      if (buraco) {
        if (c === '{') prof += 1
        else if (c === '}') { if (prof === 0) return i; prof -= 1 }
      }
      // List<List<List<int>>>: o >>> que fecha genéricos abertos neste comando não é deslocamento
      if (c === ';') genericos = 0
      else if (c === '<' && /\w/.test(f[i - 1] ?? '') && !/[\s<=]/.test(f[i + 1] ?? ' ')) genericos += 1
      if (c === '>' && f[i + 1] === '>' && f[i + 2] === '>' && genericos >= 3) {
        copiar(i, i + 3)
        genericos -= 3
        i += 3
        continue
      }
      // padrão de lista [1, .. var resto]: a gramática só aceita `..` sozinho, então vira `var __sl_resto` (o padroes.js reconhece)
      if (c === '[') colchetes.push(/(?:\b(?:is|not|and|or|case)|[{,(:[]|\.\.)\s*$/.test(f.slice(Math.max(0, i - 12), i)))
      else if (c === ']' && colchetes.pop()) {
        // [2, 3] resto: a gramática não aceita nome depois de um padrão de lista, então vira `[2, 3] and var resto`
        const d = /^\s*([A-Za-z_]\w*)/.exec(f.slice(i + 1, i + 80))
        if (d && !/^(?:and|or|when|is|as|switch|with|not|in|into|on|equals|by|ascending|descending|select|where|orderby|group|join|let|from)$/.test(d[1])) {
          emitir(']  and var ' + d[1]); i += 1 + d[0].length; mudou = true; continue
        }
      }
      if (c === '.' && f[i + 1] === '.' && f[i - 1] !== '.' && f[i + 2] !== '.') {
        const fatia = /^\.\.\s*var\s+([A-Za-z_]\w*)/.exec(f.slice(i, i + 80))
        if (fatia) { emitir('var __sl_' + fatia[1]); i += fatia[0].length; mudou = true; continue }
        // `..` sozinho entre `[`/`,` e `,`/`]` de um padrão de lista ([.., 9], [..]) a gramática lê como intervalo
        if (colchetes[colchetes.length - 1] && /[[,]\s*$/.test(f.slice(Math.max(0, i - 20), i)) && /^\.\.\s*[,\]]/.test(f.slice(i, i + 20))) {
          emitir('var __sl__'); i += 2; mudou = true; continue
        }
        // `.. [2, 3]`, `.. { Length: 2 } meio`: a fatia com subpadrão vira `__SL and <padrão>` (o padroes.js reconhece)
        if (colchetes[colchetes.length - 1] && /[[,]\s*$/.test(f.slice(Math.max(0, i - 20), i))) {
          emitir('__SL and '); i += 2; mudou = true; continue
        }
      }
      if (reescreverDeslocamentos && c === '>' && f[i + 1] === '>' && f[i + 2] === '>') {
        desl.push(tam)
        emitir(f[i + 3] === '=' ? '>>= ' : '>> ')
        i += f[i + 3] === '=' ? 4 : 3
        mudou = true
        continue
      }
      emitir(c)
      i += 1
    }
    return i
  }

  codigo(0, false)
  return { fonte: buf.join(''), deslocamentos: desl, mudou }
}
