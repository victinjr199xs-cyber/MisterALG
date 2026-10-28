// Tela inicial (a página inicio.html) no estilo de um "launcher": barra de topo, faixa com a dica do dia, a grade das linguagens
// (uma célula numerada por linguagem, com ícone, descrição, o que a IDE mostra e o botão de criar),
// os arquivos recentes e a barra de rodapé com as opções.

import { comNegrito, el } from './dialogos.js'
import { ICONES_LINGUAGEM } from './icones-linguagens.js'
import { IDIOMAS, tradutor } from '../compartilhado/idiomas.js'

export const LINGUAGENS = [
  { id: 'portugol', nome: 'Portugol', ext: '.alg', cor: '#8b5cf6', resumo: 'Lógica de programação em português', visao: 'Variáveis, pilha de ativação e perfil, como no VisuAlg', selo: 'Como no VisuAlg' },
  { id: 'csharp', nome: 'C#', ext: '.cs', cor: '#e5533d', resumo: 'Orientação a objetos com .NET', visao: 'Pilha de chamadas, objetos e referências (setas)', selo: 'Objetos e setas' },
  { id: 'javascript', nome: 'JavaScript', ext: '.js', cor: '#f2b705', resumo: 'A linguagem da web', visao: 'Pilha de chamadas e fila de eventos', selo: 'Pilha e eventos' },
  { id: 'typescript', nome: 'TypeScript', ext: '.ts', cor: '#2f6fde', resumo: 'JavaScript com tipos', visao: 'O tipo de cada valor durante a execução', selo: 'Tipos ao vivo' },
  { id: 'python', nome: 'Python', ext: '.py', cor: '#16a37f', resumo: 'Simples, legível e poderosa', visao: 'Objetos e referências, ligados por setas', selo: 'Objetos e setas' },
  { id: 'c', nome: 'C', ext: '.c', cor: '#4361ee', resumo: 'Memória, ponteiros e desempenho', visao: 'Biblioteca padrão completa (clang). Em breve: memória e ponteiros', selo: 'Memória e ponteiros' },
  { id: 'cpp', nome: 'C++', ext: '.cpp', cor: '#0ea5c6', resumo: 'C com classes e a STL', visao: 'Biblioteca padrão completa (clang). Em breve: objetos', selo: 'Compilador clang' },
  { id: 'php', nome: 'PHP', ext: '.php', cor: '#ec4899', resumo: 'Páginas web geradas no servidor', visao: 'A página gerada, ao vivo', selo: 'Página ao vivo' },
  { id: 'sql', nome: 'SQL', ext: '.sql', cor: '#b45309', resumo: 'Bancos de dados com PostgreSQL', visao: 'As tabelas mudando a cada comando, com as chaves e as linhas novas em destaque', selo: 'PostgreSQL de verdade' },
]

/**
 * @param {{versao:string, recentes:string[], dica:string, prefs:{abertura:boolean, idioma?:string}, atalhos:{novo:string, abrir:string}}} opcoes
 * @returns {Promise<{acao:'novo'|'abrir'|'recente'|'idioma', idioma?:string, linguagem?:string, caminho?:string, prefs:{abertura:boolean}}>}
 */
export function telaInicial({ versao, recentes, dica, prefs, atalhos }) {
  const t = tradutor(prefs.idioma)
  return new Promise((resolve) => {
    const caixa = (rotulo, marcado) => {
      const input = el('input', { type: 'checkbox', checked: marcado })
      return [input, el('label', { className: 'inicio-opcao' }, input, rotulo)]
    }
    const [animar, rotuloAnimar] = caixa(t('Animação de abertura'), prefs.abertura !== false)
    const [atualizar, rotuloAtualizar] = caixa(t('Procurar atualizações ao abrir'), prefs.procurarAtualizacoes !== false)
    const [aoLigar, rotuloAoLigar] = caixa(t('Abrir quando o computador ligar'), prefs.abrirAoLigar === true)
    // Trocar o idioma refaz a tela inicial já traduzida (main.js).
    const idioma = el('select', { className: 'inicio-idioma', ariaLabel: t('Idioma') },
      ...IDIOMAS.map((i) => el('option', { value: i.id, textContent: i.nome, selected: i.id === (prefs.idioma ?? 'pt') })))
    idioma.addEventListener('change', () => terminar({ acao: 'idioma', idioma: idioma.value }))

    const tela = el('div', { className: 'tela-inicial', role: 'dialog', ariaModal: 'true', ariaLabel: t('Tela inicial do MisterALG') })
    const terminar = (escolha) => {
      if (!tela.isConnected) return
      tela.remove()
      resolve({ ...escolha, prefs: { abertura: animar.checked, procurarAtualizacoes: atualizar.checked, abrirAoLigar: aoLigar.checked } })
    }

    const botao = (classe, filhos, aoClicar, extra = {}) => {
      const b = el('button', { type: 'button', className: classe, ...extra }, ...filhos)
      if (aoClicar) b.addEventListener('click', aoClicar)
      return b
    }

    // A célula inteira é o botão (Enter/clique cria um programa novo naquela linguagem).
    const cartoes = LINGUAGENS.map((l, i) => {
      const icone = el('span', { className: 'inicio-icone' })
      icone.innerHTML = ICONES_LINGUAGEM[l.id] // texto fixo do próprio app
      const numero = el('span', { className: 'inicio-numero', textContent: String(i + 1).padStart(2, '0') })
      const b = botao('inicio-linguagem', [
        el('span', { className: 'inicio-celula-topo' }, numero, el('span', { className: 'inicio-ext', textContent: l.ext })),
        el('span', { className: 'inicio-celula-meio' },
          icone,
          el('span', { className: 'inicio-textos' },
            el('span', { className: 'inicio-nome', textContent: l.nome }),
            el('span', { className: 'inicio-resumo', textContent: t(l.resumo) }))),
        el('span', { className: 'inicio-selo', textContent: t(l.selo) }),
        el('span', { className: 'inicio-visao', textContent: t(l.visao) }),
        el('span', { className: 'inicio-criar', textContent: t('Criar programa') }),
      ], () => terminar({ acao: 'novo', linguagem: l.id }), { title: `${t('Criar programa')}: ${l.nome}` })
      b.style.setProperty('--cor', l.cor)
      b.style.setProperty('--i', i)
      return b
    })

    const nomeArquivo = (c) => c.split(/[\\/]/).pop()
    const listaRecentes = recentes.length
      ? el('ul', { className: 'inicio-recentes' }, ...recentes.map((c) => el('li', {},
          botao('inicio-link', [el('b', { textContent: nomeArquivo(c) }), el('small', { textContent: c })], () => terminar({ acao: 'recente', caminho: c }), { title: c }))))
      : el('p', { className: 'inicio-vazio', textContent: t('Os algoritmos que você abrir aparecem aqui.') })

    tela.append(
      el('header', { className: 'inicio-barra' },
        el('span', { className: 'inicio-logo' }, 'MISTER', el('b', { textContent: 'ALG' })),
        el('span', { className: 'inicio-aba ativa', textContent: t('Início') }),
        el('span', { className: 'inicio-aba', textContent: t('Ambiente de programação') }),
        el('span', { className: 'inicio-espaco' }),
        el('label', { className: 'inicio-rotulo' }, t('Idioma'), idioma),
        botao('inicio-botao-claro', [t('Abrir…'), el('kbd', { textContent: atalhos.abrir })], () => terminar({ acao: 'abrir' })),
      ),
      el('div', { className: 'inicio-conteudo' },
        el('div', { className: 'inicio-faixa' },
          el('span', { className: 'inicio-chip', textContent: t('Dica do dia') }),
          el('p', { className: 'inicio-dica' }, ...comNegrito(dica)),
          botao('inicio-botao-claro', [t('Novo algoritmo'), el('kbd', { textContent: atalhos.novo })], () => terminar({ acao: 'novo', linguagem: 'portugol' })),
        ),
        el('div', { className: 'inicio-filtros' },
          el('span', { className: 'inicio-filtro ativo' }, t('Linguagens'), el('em', { textContent: ` ${LINGUAGENS.length}` })),
          el('span', { className: 'inicio-espaco' }),
          el('span', { className: 'inicio-rotulo', textContent: t('Em qual linguagem você quer programar?') }),
        ),
        el('section', { className: 'inicio-grade', ariaLabel: t('Linguagens') }, ...cartoes),
        el('section', { className: 'inicio-bloco-recentes' },
          el('h2', { className: 'inicio-rotulo', textContent: t('Recentes') }),
          listaRecentes,
        ),
      ),
      el('footer', { className: 'inicio-rodape' },
        rotuloAnimar, rotuloAtualizar, rotuloAoLigar,
        el('span', { className: 'inicio-espaco' }),
        el('span', { className: 'inicio-rotulo', textContent: `MisterALG ${t('versão')} ${versao}` }),
      ),
    )

    document.body.append(tela)
    cartoes[0].focus({ focusVisible: false }) // foco para o teclado, sem o contorno até usar o Tab
  })
}
