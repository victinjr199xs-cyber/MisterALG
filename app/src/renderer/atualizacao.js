// Avisos de versão nova (main/atualizacao.js): a faixa na tela inicial e a janela do menu Ajuda da IDE.

import { el, janela } from './dialogos.js'

const api = window.misteralg

/** Faixa "Atualização disponível" no topo da tela inicial, se houver versão nova. */
export async function faixaDeAtualizacao(t) {
  const r = await api.atualizacao.procurar()
  const conteudo = document.querySelector('.inicio-conteudo')
  if (!r?.versao || !conteudo) return
  const texto = el('p', { className: 'inicio-dica', textContent: t('O MisterALG {0} está disponível.', r.versao) })
  const novidades = el('button', { type: 'button', className: 'inicio-botao-linha', textContent: `${t('Novidades')} ↗` })
  novidades.addEventListener('click', () => api.abrirExterno(r.pagina))
  const acao = el('button', { type: 'button', className: 'inicio-botao-claro', textContent: t(r.automatica ? 'Atualizar' : 'Baixar') })
  const fechar = el('button', { type: 'button', className: 'inicio-botao-linha', textContent: '×', title: t('Fechar') })
  const faixa = el('div', { className: 'inicio-faixa inicio-faixa-atualizacao', role: 'status' },
    el('span', { className: 'inicio-chip', textContent: t('Atualização') }), texto, novidades, acao, fechar)
  fechar.addEventListener('click', () => faixa.remove())
  acao.addEventListener('click', async () => {
    if (!r.automatica) return api.abrirExterno(r.pagina)
    if (acao.dataset.pronta) return api.atualizacao.instalar()
    acao.disabled = true
    const parar = api.atualizacao.aoProgresso((p) => { texto.textContent = t('Baixando a atualização… {0}%', p) })
    const d = await api.atualizacao.baixar()
    parar()
    acao.disabled = false
    if (d.erro) {
      texto.textContent = t('Não deu para baixar a atualização. Baixe pelo site.')
      acao.textContent = t('Baixar')
      r.automatica = false
      return
    }
    texto.textContent = t('Pronto para instalar a versão {0}.', r.versao)
    acao.textContent = t('Reiniciar e instalar')
    acao.dataset.pronta = '1'
  })
  conteudo.prepend(faixa)
}

/** Menu Ajuda → Procurar atualizações (na IDE). podeDescartar() pergunta se quer salvar antes de reiniciar. */
export async function procurarNaIDE(t, { podeDescartar, status }) {
  status(` ${t('MENSAGEM: Procurando atualizações…')}`)
  const r = await api.atualizacao.procurar()
  status('')
  if (r?.erro) return janela({ titulo: t('Atualização'), corpo: el('p', { textContent: t('Não deu para procurar atualizações (sem internet?).') }) })
  if (!r?.versao) return janela({ titulo: t('Atualização'), corpo: el('p', { textContent: t('Você já está com a versão mais nova ({0}).', r.atual) }) })
  const escolha = await janela({
    titulo: t('Atualização'),
    corpo: el('p', { textContent: t('O MisterALG {0} está disponível.', r.versao) }),
    botoes: [
      { valor: 'acao', texto: t(r.automatica ? 'Atualizar' : 'Baixar'), principal: true },
      { valor: 'novidades', texto: t('Novidades') },
      { valor: 'cancelar', texto: t('Cancelar') },
    ],
  })
  if (escolha === 'novidades' || (escolha === 'acao' && !r.automatica)) return api.abrirExterno(r.pagina)
  if (escolha !== 'acao') return
  const parar = api.atualizacao.aoProgresso((p) => status(` ${t('Baixando a atualização… {0}%', p)}`))
  const d = await api.atualizacao.baixar()
  parar()
  status('')
  if (d.erro) {
    await janela({ titulo: t('Atualização'), corpo: el('p', { textContent: t('Não deu para baixar a atualização. Baixe pelo site.') }) })
    return api.abrirExterno(r.pagina)
  }
  const instalar = await janela({
    titulo: t('Atualização'),
    corpo: el('p', { textContent: t('Pronto para instalar a versão {0}.', r.versao) }),
    botoes: [{ valor: 'sim', texto: t('Reiniciar e instalar'), principal: true }, { valor: 'cancelar', texto: t('Depois') }],
  })
  if (instalar === 'sim' && (await podeDescartar())) api.atualizacao.instalar()
}
