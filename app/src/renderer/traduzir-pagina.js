// Traduz a página inteira para o idioma escolhido: textos e dicas (title, placeholder, aria-label, data-dica)
// que estão em compartilhado/traducoes. Um MutationObserver traduz também o que aparece depois (janelas,
// mensagens da barra de status, painéis). O que o aluno escreve e o que o programa imprime fica como está.

const ATRIBUTOS = ['title', 'placeholder', 'aria-label', 'data-dica']
const CONTEUDO_DO_ALUNO = '.cm-editor, #console-tela, #visualizacao, .previa-html, .previa-quadro, .assistente-msg, .inicio-link small, .grade td, .mo-valor, .mc-valor, .mb-tabela table, .mb-tabela header b'

export function traduzirPagina(t) {
  if (t.idioma === 'pt') return
  document.documentElement.lang = t.idioma
  document.documentElement.dir = t.idioma === 'ar' ? 'rtl' : 'ltr' // o código, o console e as tabelas continuam da esquerda para a direita (visualg.css)
  const traduzir = (texto) => {
    const limpo = texto.trim()
    if (limpo.length < 2 || !/\p{L}/u.test(limpo)) return texto
    const r = t.reconhecer(limpo)
    if (r != null) return texto.replace(limpo, r)
    // Dicas da barra de status: "MENSAGEM: " + a dica do item sob o mouse (já traduzida) ou outro texto livre.
    const msg = /^MENSAGEM:\s+(.+)$/s.exec(limpo)
    if (msg) return texto.replace(limpo, `${t('MENSAGEM:')} ${t.reconhecer(msg[1]) ?? msg[1]}`)
    return texto
  }
  const visitar = (no) => {
    if (no.nodeType === Node.TEXT_NODE) {
      if (no.parentElement?.closest(CONTEUDO_DO_ALUNO)) return
      const novo = traduzir(no.nodeValue)
      if (novo !== no.nodeValue) no.nodeValue = novo
      return
    }
    if (no.nodeType !== Node.ELEMENT_NODE || no.matches(CONTEUDO_DO_ALUNO)) return
    for (const a of ATRIBUTOS) {
      const v = no.getAttribute(a)
      if (v) {
        const novo = traduzir(v)
        if (novo !== v) no.setAttribute(a, novo)
      }
    }
    for (const filho of no.childNodes) visitar(filho)
  }
  visitar(document.body)
  // Traduzir um texto já traduzido não muda nada, então o observador não entra em laço.
  new MutationObserver((mudancas) => {
    for (const m of mudancas) {
      if (m.type === 'characterData') visitar(m.target)
      else if (m.type === 'attributes') visitar(m.target)
      else for (const n of m.addedNodes) visitar(n)
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS })
  document.title = traduzir(document.title)
}
