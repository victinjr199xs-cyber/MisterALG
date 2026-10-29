// Lógica pura do console moderno (sem DOM): texto do selo de estado, tempo, histórico do `leia`
// e detecção de "linha N" nas mensagens de erro. O console em si está em console.js.

/** 0,05 s · 12,3 s · 1 min 05 s */
export function formatarTempo(ms, locale = 'pt-BR') {
  const n = (v, casas) => v.toLocaleString(locale, { minimumFractionDigits: casas, maximumFractionDigits: casas })
  const v = Math.max(0, Number(ms) || 0)
  if (v < 1000) return `${n(v / 1000, 2)} s`
  if (v < 60_000) return `${n(v / 1000, 1)} s`
  const min = Math.floor(v / 60_000)
  const seg = Math.floor((v % 60_000) / 1000)
  return `${min} min ${String(seg).padStart(2, '0')} s`
}

/**
 * Texto e aparência do selo. `t` é o tradutor (texto em português → idioma da tela).
 * estado: 'rodando' | 'compilando' | 'aguardando' | 'pausado' | 'finalizado' | 'erro' | 'parado'
 * dados: { ms, codigo, linha }
 */
export function descreverSelo(estado, dados = {}, t = (x, ...a) => x.replace(/\{(\d+)\}/g, (_, i) => a[i]), locale = 'pt-BR') {
  switch (estado) {
    case 'rodando': return { texto: t('Executando'), tom: 'rodando', pulsa: true }
    case 'compilando': return { texto: t('Compilando'), tom: 'rodando', pulsa: true }
    case 'aguardando': return { texto: t('Aguardando entrada'), tom: 'espera', pulsa: true }
    case 'pausado': return { texto: t('Pausado'), tom: 'espera', pulsa: false }
    case 'finalizado': return { texto: t('Finalizado em {0} · código {1}', formatarTempo(dados.ms, locale), dados.codigo ?? 0), tom: 'ok', pulsa: false }
    case 'erro': {
      const linha = Number(dados.linha)
      return linha > 0
        ? { texto: t('Erro na linha {0}', linha), tom: 'erro', pulsa: false, linha }
        : { texto: t('Erro'), tom: 'erro', pulsa: false }
    }
    case 'parado': return { texto: t('Interrompido'), tom: 'parado', pulsa: false }
    default: return { texto: '', tom: 'parado', pulsa: false }
  }
}

/** Entradas digitadas no `leia` nesta sessão do app: ↑ volta no tempo, ↓ avança e devolve ao rascunho. */
export function criarHistorico(max = 100) {
  const itens = []
  let posicao = -1 // -1 = digitando (fora do histórico)
  let rascunho = ''
  return {
    get itens() { return [...itens] },
    adicionar(valor) {
      posicao = -1
      rascunho = ''
      if (valor === '' || itens.at(-1) === valor) return
      itens.push(valor)
      if (itens.length > max) itens.shift()
    },
    /** ↑: o texto atual do campo vira rascunho na primeira vez. Devolve o novo texto (ou null se não há para onde ir). */
    anterior(atual) {
      if (!itens.length) return null
      if (posicao === -1) { rascunho = atual; posicao = itens.length - 1 }
      else if (posicao > 0) posicao -= 1
      else return null
      return itens[posicao]
    },
    proximo() {
      if (posicao === -1) return null
      if (posicao < itens.length - 1) { posicao += 1; return itens[posicao] }
      posicao = -1
      return rascunho
    },
    recomecar() { posicao = -1; rascunho = '' },
  }
}

// "linha 5" (clang traduzido, Portugol), "line 3" (traceback do Python), "programa.cs(12,5)" / "programa.c:7:3".
const RE_LINHA = /\b(?:linha|line)\s+(\d+)|\bprograma\.(?:cpp|cs|c|js|ts|py|php)[:(](\d+)/gi

/** Divide um texto de erro em pedaços; os que citam uma linha vêm com `linha` (número) para virar link. */
export function dividirLinhas(texto) {
  const partes = []
  let fim = 0
  for (const m of texto.matchAll(RE_LINHA)) {
    const linha = Number(m[1] ?? m[2])
    if (!(linha >= 1)) continue
    if (m.index > fim) partes.push({ texto: texto.slice(fim, m.index) })
    partes.push({ texto: m[0], linha })
    fim = m.index + m[0].length
  }
  if (fim < texto.length) partes.push({ texto: texto.slice(fim) })
  return partes
}

/** Quantas linhas um texto escreve no console (cada \n fecha uma linha). */
export const contarQuebras = (texto) => {
  let n = 0
  for (let i = texto.indexOf('\n'); i !== -1; i = texto.indexOf('\n', i + 1)) n += 1
  return n
}

/** Janela própria? `pref` é null (automático: sim na clássica, não na moderna), true ou false. */
export const consoleEmJanela = (pref, disposicao) => (typeof pref === 'boolean' ? pref : disposicao !== 'moderna')
