// Barra de ferramentas: a tabela dos botões e a lógica de quem aparece (preferência `botoesOcultos`).
// Cada item é [data-id, chave em renderer/icones.js, dica em português, 'principal'?] ou um marcador
// (o 4º campo marca o que fica fixo na barra lateral; o resto vai para o painel "⋯"):
// '|' (separador), 'intervalo' (lista do timer) e 'faixa' (campos De/Até/Decimais do aleatório).

export const BARRA = [
  ['novo', 'novo', 'Botão Novo (⌘N)', 'principal'],
  ['abrir', 'abrir', 'Botão Abrir (⌘O)', 'principal'],
  ['salvar', 'salvar', 'Botão Salvar (⌘S)', 'principal'],
  '|',
  ['executar', 'executar', 'Botão Executar (F9)', 'principal'],
  ['passo', 'passo', 'Botão Passo a Passo (F8)', 'principal'],
  ['timer', 'timer', 'Executar com Timer (Tempo) (Shift+F9)', 'principal'],
  'intervalo',
  '|',
  ['parar', 'parar', 'Botão Parar (Ctrl+F2)', 'principal'],
  ['breakpoint', 'breakpoint', 'Botão Liga/desliga breakpoint (F5)', 'principal'],
  ['limpar-breakpoints', 'limparBreakpoints', 'Botão Desmarca todos os breakpoints (Ctrl+F5)'],
  ['restaurar', 'restaurar', 'Botão Restaura a tela inicial do MisterALG'],
  ['cortar', 'cortar', 'Botão Cortar (⌘X)'],
  ['copiar', 'copiar', 'Botão Copiar (⌘C)'],
  ['colar', 'colar', 'Botão Colar (⌘V)'],
  '|',
  ['gravar-bloco', 'gravarBloco', 'Botão Grava o bloco de texto selecionado (Ctrl+W)'],
  ['inserir-bloco', 'inserirBloco', 'Botão Insere um bloco de algoritmo na posição do cursor (Ctrl+R)'],
  ['desfazer', 'desfazer', 'Botão Desfazer (⌘Z)', 'principal'],
  ['refazer', 'refazer', 'Botão Refazer (Shift+⌘Z)', 'principal'],
  '|',
  ['localizar', 'localizar', 'Botão Localizar (⌘F ou Ctrl+L)', 'principal'],
  ['localizar-proximo', 'proximo', 'Botão Localizar o próximo (F3)'],
  ['localizar-anterior', 'anterior', 'Botão Localizar o anterior (F4)'],
  ['substituir', 'substituir', 'Botão Substituir (⌥⌘F ou Ctrl+U)'],
  ['indentar', 'indentar', 'Botão Corrigir indentação (Ctrl+G)'],
  ['imprimir', 'imprimir', 'Botão Imprimir (⌘P)'],
  ['perfil', 'perfil', 'Botão Perfil (F7)'],
  ['aleatorio', 'aleatorio', 'Botão Ativa/Desativa Aleatório'],
  'faixa',
  '|',
  ['pilha', 'pilha', 'Botão Mostra a pilha de ativação dos procedimentos e funções (Ctrl+F3)'],
  ['calculadora', 'calculadora', 'Mostra uma calculadora prática'],
  ['calendario', 'calendario', 'Mostra um calendário do ano atual'],
  ['temas', 'temas', 'Botão Temas: escolhe as cores da tela (claras ou escuras)'],
  ['assistente', 'assistente', 'Botão Assistente de IA: explica o código e dá dicas (⌘I)'],
  ['ajuda-tela', 'ajuda', 'Botão Ajuda on-line (F1)'],
  ['sair', 'sair', 'Sair do MisterALG'],
]

/** Botões que ficam sempre na barra: sem eles o aluno não consegue o básico. */
export const ESSENCIAIS = new Set(['novo', 'abrir', 'salvar', 'executar', 'passo', 'parar', 'ajuda-tela'])

export const POSICOES = ['topo', 'lateral']
export const TAMANHOS_ICONE = ['pequeno', 'medio', 'grande']

/** Só os ids que existem e que podem ser ocultados (valor vindo do arquivo de preferências). */
export const idsOcultaveis = (ocultos) => (Array.isArray(ocultos) ? ocultos : []).filter((id) => BARRA.some((i) => i[0] === id) && !ESSENCIAIS.has(id))

/**
 * Quais itens da BARRA aparecem: um booleano por item, na mesma ordem. O separador só aparece entre dois
 * grupos visíveis (nunca na ponta nem dois seguidos); a lista do timer e os campos do aleatório somem
 * junto com o botão deles.
 */
export function itensVisiveis(ocultos, itens = BARRA) {
  const fora = new Set(idsOcultaveis(ocultos))
  const dono = { intervalo: 'timer', faixa: 'aleatorio' }
  const ver = itens.map((i) => i !== '|' && !fora.has(Array.isArray(i) ? i[0] : dono[i]))
  let candidato = -1
  let mostrouAlgo = false
  itens.forEach((item, n) => {
    if (item === '|') candidato = n
    else if (ver[n]) {
      if (candidato !== -1 && mostrouAlgo) ver[candidato] = true
      candidato = -1
      mostrouAlgo = true
    }
  })
  return ver
}
/**
 * Na barra lateral: um booleano por item, na mesma ordem (true = fica fixo na coluna, false = vai para o painel "⋯").
 * Botões com 4º campo 'principal' ficam fixos; a lista do timer e os campos do aleatório sempre vão para o painel;
 * o separador acompanha o botão que vem antes dele.
 */
export function principaisLateral(itens = BARRA) {
  let ultimo = false
  return itens.map((i) => {
    if (Array.isArray(i)) ultimo = i[3] === 'principal'
    return i === '|' ? ultimo : Array.isArray(i) && ultimo
  })
}
/** No Windows e no Linux as dicas mostram os atalhos originais do VisuAlg em vez dos do Mac. */
export function dicaDaPlataforma(dica, ehMac) {
  if (ehMac) return dica
  return dica
    .replace(' (⌘F ou Ctrl+L)', ' (Ctrl+L)')
    .replace(' (⌥⌘F ou Ctrl+U)', ' (Ctrl+U)')
    .replace('⌘O', 'Ctrl+A')
    .replace('⌘', 'Ctrl+')
}