// Tela inicial: a escolha da linguagem, Novo/Abrir, os arquivos recentes e a dica do dia.
// Cada linguagem terá uma visualização própria; as que ainda não chegaram aparecem como "em breve".

import { ICONE_SVG } from '../compartilhado/marca.js'
import { comNegrito, el } from './dialogos.js'
import { ICONES_LINGUAGEM } from './icones-linguagens.js'

export const LINGUAGENS = [
  { id: 'portugol', nome: 'Portugol', sigla: 'Pt', cor: '#7b5cff', visao: 'Variáveis, pilha de ativação e perfil, como no VisuAlg', pronta: true },
  { id: 'csharp', nome: 'C#', sigla: 'C#', cor: '#68217a', visao: 'Pilha de chamadas, objetos e referências (setas)', pronta: true },
  { id: 'javascript', nome: 'JavaScript', sigla: 'JS', cor: '#f0db4f', tinta: '#1b1b1b', visao: 'Pilha de chamadas e fila de eventos', pronta: true },
  { id: 'typescript', nome: 'TypeScript', sigla: 'TS', cor: '#3178c6', visao: 'O tipo de cada valor durante a execução', pronta: true },
  { id: 'python', nome: 'Python', sigla: 'Py', cor: '#3776ab', visao: 'Objetos e referências, ligados por setas', pronta: true },
  { id: 'c', nome: 'C', sigla: 'C', cor: '#5c6bc0', visao: 'Biblioteca padrão completa (clang). Em breve: memória e ponteiros', pronta: true },
  { id: 'cpp', nome: 'C++', sigla: 'C++', cor: '#00599c', visao: 'Biblioteca padrão completa (clang). Em breve: objetos', pronta: true },
  { id: 'php', nome: 'PHP', sigla: 'PHP', cor: '#777bb4', visao: 'A página gerada, ao vivo', pronta: true },
]

let fecharAtual = null

/** O título entra letra a letra (cada uma com o seu atraso, ver .inicio-letra no CSS). */
function titulo() {
  const h1 = el('h1', { ariaLabel: 'MisterALG' })
  ;[...'MisterALG'].forEach((c, i) => {
    const s = el('span', { className: 'inicio-letra', textContent: c, ariaHidden: 'true' })
    s.style.setProperty('--l', i)
    h1.append(s)
  })
  return h1
}

/** Fecha a tela inicial, se estiver aberta (um comando do menu chegou primeiro). */
export function fecharTelaInicial() {
  fecharAtual?.({ acao: 'fechar' })
}

export const telaInicialAberta = () => fecharAtual !== null

/**
 * @param {{versao:string, recentes:string[], dica:string, prefs:{telaInicial:boolean, abertura:boolean}, atalhos:{novo:string, abrir:string}}} opcoes
 * @returns {Promise<{acao:'novo'|'abrir'|'recente'|'fechar', linguagem?:string, caminho?:string, prefs:{telaInicial:boolean, abertura:boolean}}>}
 */
export function telaInicial({ versao, recentes, dica, prefs, atalhos }) {
  fecharTelaInicial()
  return new Promise((resolve) => {
    const caixa = (rotulo, marcado) => {
      const input = el('input', { type: 'checkbox', checked: marcado })
      return [input, el('label', { className: 'inicio-opcao' }, input, ` ${rotulo}`)]
    }
    const [mostrarTela, rotuloTela] = caixa('Mostrar esta tela ao abrir', prefs.telaInicial !== false)
    const [animar, rotuloAnimar] = caixa('Animação de abertura', prefs.abertura !== false)

    const tela = el('div', { className: 'tela-inicial', role: 'dialog', ariaModal: 'true', ariaLabel: 'Tela inicial do MisterALG' })
    // A IDE por trás fica inerte: o Tab não sai da tela inicial.
    const inertes = [...document.body.children].filter((f) => !f.inert)
    const terminar = (escolha) => {
      if (!tela.isConnected) return
      tela.remove()
      for (const f of inertes) f.inert = false
      fecharAtual = null
      resolve({ ...escolha, prefs: { telaInicial: mostrarTela.checked, abertura: animar.checked } })
    }
    fecharAtual = terminar

    const botao = (classe, filhos, aoClicar, extra = {}) => {
      const b = el('button', { type: 'button', className: classe, ...extra }, ...filhos)
      if (aoClicar) b.addEventListener('click', aoClicar)
      return b
    }

    const cartoes = LINGUAGENS.map((l, i) => {
      const icone = el('span', { className: 'inicio-icone' })
      icone.innerHTML = ICONES_LINGUAGEM[l.id] // texto fixo do próprio app
      icone.style.setProperty('--cor', l.cor)
      if (l.tinta) icone.style.color = l.tinta
      const b = botao('inicio-linguagem', [
        icone,
        el('span', { className: 'inicio-nome', textContent: l.nome }, l.pronta ? null : el('span', { className: 'inicio-breve', textContent: 'em breve' })),
        el('span', { className: 'inicio-visao', textContent: l.visao }),
      ], l.pronta ? () => terminar({ acao: 'novo', linguagem: l.id }) : null)
      b.style.setProperty('--i', i)
      b.style.setProperty('--cor', l.cor)
      // O brilho do cartão segue o ponteiro.
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect()
        b.style.setProperty('--mx', `${e.clientX - r.left}px`)
        b.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
      if (!l.pronta) {
        b.setAttribute('aria-disabled', 'true')
        b.title = `${l.nome} chega numa próxima versão do MisterALG`
      }
      return b
    })

    const nomeArquivo = (c) => c.split(/[\\/]/).pop()
    const listaRecentes = recentes.length
      ? el('ul', { className: 'inicio-recentes' }, ...recentes.map((c) => el('li', {},
          botao('inicio-link', [el('b', { textContent: nomeArquivo(c) }), el('small', { textContent: c })], () => terminar({ acao: 'recente', caminho: c }), { title: c }))))
      : el('p', { className: 'inicio-vazio', textContent: 'Os algoritmos que você abrir aparecem aqui.' })

    const marca = el('div', { className: 'inicio-marca' })
    marca.innerHTML = ICONE_SVG // texto fixo do próprio app

    tela.append(el('div', { className: 'inicio-aurora', ariaHidden: 'true' }, el('i'), el('i'), el('i')), el('div', { className: 'inicio-cartao' },
      el('header', { className: 'inicio-topo' },
        marca,
        el('div', {}, titulo(), el('p', { textContent: 'Aprenda a programar vendo o código rodar.' })),
        el('span', { className: 'inicio-versao', textContent: `versão ${versao}` }),
      ),
      el('div', { className: 'inicio-corpo' },
        el('section', { className: 'inicio-linguagens', ariaLabel: 'Linguagens' },
          el('h2', { textContent: 'Em qual linguagem você quer programar?' }),
          el('div', { className: 'inicio-grade' }, ...cartoes),
        ),
        el('aside', { className: 'inicio-lado' },
          el('h2', { textContent: 'Começar' }),
          botao('inicio-acao', ['Novo algoritmo', el('kbd', { textContent: atalhos.novo })], () => terminar({ acao: 'novo', linguagem: 'portugol' })),
          botao('inicio-acao', ['Abrir…', el('kbd', { textContent: atalhos.abrir })], () => terminar({ acao: 'abrir' })),
          el('h2', { textContent: 'Recentes' }),
          listaRecentes,
          el('h2', { textContent: 'Dica do dia' }),
          el('p', { className: 'inicio-dica' }, ...comNegrito(dica)),
        ),
      ),
      el('footer', { className: 'inicio-rodape' },
        rotuloTela, rotuloAnimar,
        botao('inicio-fechar', ['Fechar'], () => terminar({ acao: 'fechar' }), { title: 'Fechar (Esc)' }),
      ),
    ))

    tela.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      terminar({ acao: 'fechar' })
    })

    for (const f of inertes) f.inert = true
    document.body.append(tela)
    cartoes[0].focus()
  })
}
