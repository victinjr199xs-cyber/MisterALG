// Idioma da interface. O texto em português é a chave (traducoes/chaves.js, numerada); cada idioma traz
// { número: tradução } em traducoes/<id>.js. tr('texto em português') devolve a tradução ou, se faltar, o original.
// Textos com partes que mudam usam {0}, {1}...: tr('Pausado na linha {0}', 5), e a tela também os reconhece prontos
// ("Pausado na linha 5"). O Portugol continua em português (é a própria linguagem).

import CHAVES from './traducoes/chaves.js'
import ar from './traducoes/ar.js'
import de from './traducoes/de.js'
import en from './traducoes/en.js'
import es from './traducoes/es.js'
import fr from './traducoes/fr.js'
import hi from './traducoes/hi.js'
import id from './traducoes/id.js'
import it from './traducoes/it.js'
import ja from './traducoes/ja.js'
import ko from './traducoes/ko.js'
import nl from './traducoes/nl.js'
import pl from './traducoes/pl.js'
import ru from './traducoes/ru.js'
import tr from './traducoes/tr.js'
import uk from './traducoes/uk.js'
import vi from './traducoes/vi.js'
import zh from './traducoes/zh.js'

export const IDIOMAS = [
  { id: 'pt', nome: 'Português' },
  { id: 'en', nome: 'English' },
  { id: 'es', nome: 'Español' },
  { id: 'fr', nome: 'Français' },
  { id: 'de', nome: 'Deutsch' },
  { id: 'it', nome: 'Italiano' },
  { id: 'nl', nome: 'Nederlands' },
  { id: 'pl', nome: 'Polski' },
  { id: 'tr', nome: 'Türkçe' },
  { id: 'ru', nome: 'Русский' },
  { id: 'uk', nome: 'Українська' },
  { id: 'ar', nome: 'العربية' },
  { id: 'hi', nome: 'हिन्दी' },
  { id: 'id', nome: 'Bahasa Indonesia' },
  { id: 'vi', nome: 'Tiếng Việt' },
  { id: 'zh', nome: '中文（简体）' },
  { id: 'ja', nome: '日本語' },
  { id: 'ko', nome: '한국어' },
]

export const TRADUCOES = { ar, de, en, es, fr, hi, id, it, ja, ko, nl, pl, ru, tr, uk, vi, zh }

const preencher = (modelo, args) => modelo.replace(/\{(\d+)\}/g, (_, i) => (args[i] ?? ''))
const escaparRegex = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d+)\\?\}/g, '{$1}')

const cache = new Map()
function dicionario(idioma) {
  if (cache.has(idioma)) return cache.get(idioma)
  const lista = TRADUCOES[idioma]
  let d = null
  if (lista) {
    const exatos = new Map()
    const modelos = [] // textos com {0}: viram expressões regulares para reconhecer o texto já preenchido
    for (const [n, pt] of Object.entries(CHAVES)) {
      const alvo = lista[n]
      if (!alvo) continue
      exatos.set(pt, alvo)
      if (/\{\d+\}/.test(pt)) {
        const re = new RegExp(`^${escaparRegex(pt).replace(/\{(\d+)\}/g, '(.*?)')}$`, 's')
        modelos.push({ re, alvo, ordem: [...pt.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])) })
      }
    }
    d = { exatos, modelos }
  }
  cache.set(idioma, d)
  return d
}

/** Uma função de tradução para o idioma: t(textoEmPortugues, ...valores). */
export function tradutor(idioma) {
  const d = dicionario(idioma)
  const t = (texto, ...args) => preencher(d?.exatos.get(texto) ?? texto, args)
  /** Traduz um texto que já veio preenchido ("Pausado na linha 5"); devolve null se não conhece. */
  const reconhecerInteiro = (texto) => {
    const exato = d.exatos.get(texto)
    if (exato) return exato
    for (const m of d.modelos) {
      const r = m.re.exec(texto)
      if (r) {
        const args = []
        m.ordem.forEach((i, k) => { args[i] = r[k + 1] })
        return preencher(m.alvo, args)
      }
    }
    return null
  }
  t.reconhecer = (texto) => {
    if (!d) return null
    const r = reconhecerInteiro(texto)
    if (r != null) return r
    // "Aviso: a variável $x não existe", "TypeError: ...": um rótulo (texto conhecido ou nome de código) antes do ": ".
    const p = /^([^:\n]{1,40}): (.+)$/s.exec(texto)
    if (!p) return null
    const resto = reconhecerInteiro(p[2])
    const cabeca = d.exatos.get(p[1]) ?? (/^[\w.]+$/.test(p[1]) ? p[1] : null)
    return resto != null && cabeca != null ? `${cabeca}: ${resto}` : null
  }
  t.idioma = d ? idioma : 'pt'
  return t
}
