// Teste de fumaça da IDE empacotada (usado no CI do Linux com xvfb).
// Uso: node scripts/cdp.mjs <porta> scripts/fumaca-ide.mjs
// Falha (exceção → código de saída ≠ 0) se a IDE não se comportar como esperado.

const PROGRAMA = `algoritmo "fumaca"
var
   i, soma : inteiro
   nome : caractere
procedimento dobra(var x : inteiro)
inicio
   x <- x * 2
fimprocedimento
inicio
   escreva("Seu nome: ")
   leia(nome)
   para i de 1 ate 5 faca
      soma <- soma + i
   fimpara
   dobra(soma)
   escreval("Olá, ", nome, "! Soma dobrada =", soma)
fimalgoritmo
`
const PROGRAMA_C = '#include <stdio.h>\nint main(void) {\n    int x;\n    printf("Valor: ");\n    scanf("%d", &x);\n    printf("Dobro = %d\\n", 2 * x);\n    return 0;\n}\n'
const PROGRAMA_CPP = '#include <iostream>\n#include <stdexcept>\nint dividir(int a, int b) { if (b == 0) throw std::runtime_error("zero"); return a / b; }\nint main() {\n    try { std::cout << dividir(1, 0); } catch (const std::exception &e) { std::cout << "pegou: " << e.what() << std::endl; }\n}\n'
const ESPERADO = 'Seu nome: Linux\nOlá, Linux! Soma dobrada = 30\n\n>>> Fim da execução do programa !'

function conferir(nome, obtido, esperado) {
  const ok = typeof obtido === 'object' ? JSON.stringify(obtido) === JSON.stringify(esperado) : obtido === esperado // listas e null por conteúdo
  console.log(`${ok ? '✔' : '✖'} ${nome}: ${JSON.stringify(obtido)}`)
  if (!ok) throw new Error(`${nome}: esperado ${JSON.stringify(esperado)}`)
}

export default async ({ avaliar, esperar, digitar, tecla }) => {
  // A IDE pode estar parada na tela de termos (primeira abertura).
  for (let i = 0; i < 40; i += 1) {
    const pronto = await avaliar(`!!window.__misteralg || !!document.querySelector('dialog[open] .termos')`)
    if (pronto) break
    await esperar(500)
  }
  const termos = await avaliar(`document.querySelector('dialog[open] .janela-titulo')?.textContent ?? ''`)
  console.log('tela inicial:', termos || '(IDE direto)')
  await avaliar(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent === 'Aceito')?.click()`)
  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)
  conferir('IDE carregada', await avaliar('!!window.__misteralg'), true)
  // Nos testes a janela abre direto na IDE (index.html); a tela inicial é outra página (inicio.html).

  const M = 'window.__misteralg'
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA)})`)
  await avaliar(`void ${M}.comandos.executar()`)
  for (let i = 0; i < 20 && !(await avaliar(`!!document.querySelector('.console-entrada')`)); i += 1) await esperar(250)
  conferir('leia esperando entrada', await avaliar(`!!document.querySelector('.console-entrada')`), true)
  await avaliar(`document.querySelector('.console-entrada').focus()`)
  await digitar('Linux')
  await tecla('Enter')
  await esperar(800)
  conferir('saída do console', await avaliar('document.querySelector("#console-tela").textContent'), ESPERADO)
  conferir('grade de variáveis', await avaliar(`[...document.querySelectorAll('#variaveis tbody tr td:nth-child(4)')].map(t => t.textContent).join(',')`), '6,30,"Linux"')

  // Erro de execução: diálogo Aviso com a linha certa.
  await avaliar(`${M}.execucao.restaurar(); ${M}.editor.definirTexto('algoritmo "e"\\nvar\\n v: vetor[1..3] de inteiro\\ninicio\\n v[4] <- 1\\nfimalgoritmo\\n')`)
  await avaliar(`void ${M}.comandos.executar()`)
  await esperar(500)
  const aviso = await avaliar(`document.querySelector('dialog[open]')?.innerText ?? ''`)
  conferir('aviso de erro na linha 5', /na linha 5 :/.test(aviso) && /Índice fora dos limites/.test(aviso), true)
  await avaliar(`document.querySelector('dialog[open]')?.close()`)

  // C: o clang em WebAssembly (resources/clang), o worker e o executor (app.asar.unpacked)
  // só existem no app empacotado; aqui eles compilam e rodam um programa de verdade.
  await avaliar(`${M}.doc.modificado = false`) // senão a caixa nativa "Deseja salvá-lo?" trava o teste
  await avaliar(`${M}.comandos.novo('c')`)
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA_C)})`)
  await avaliar(`void ${M}.comandos.executar()`)
  const temTexto = (t) => avaliar(`document.querySelector('#console-tela').textContent.includes(${JSON.stringify(t)})`)
  for (let i = 0; i < 240 && !(await temTexto('Valor: ')); i += 1) await esperar(500)
  conferir('C compilou e pediu a entrada', await temTexto('Valor: '), true)
  await avaliar(`document.querySelector('.console-entrada').focus()`)
  await digitar('21')
  await tecla('Enter')
  for (let i = 0; i < 240 && !(await temTexto('Process finished')); i += 1) await esperar(250) // PC lento/CI: o processo pode demorar a sair
  conferir('saída do C', await avaliar('document.querySelector("#console-tela").textContent'), 'Valor: 21\nDobro = 42\n\nProcess finished with exit code 0')

  // C++ com try/catch: liga a libexcecoes.a embutida no worker (exceções do WebAssembly).
  await avaliar(`${M}.doc.modificado = false`)
  await avaliar(`${M}.comandos.novo('cpp')`)
  await avaliar(`${M}.editor.definirTexto(${JSON.stringify(PROGRAMA_CPP)})`)
  await avaliar(`void ${M}.comandos.executar()`)
  for (let i = 0; i < 360 && !(await temTexto('Process finished')); i += 1) await esperar(500)
  conferir('saída do C++ com exceção', await avaliar('document.querySelector("#console-tela").textContent'), 'pegou: zero\n\nProcess finished with exit code 0')

  await verificarMenusEDialogos({ avaliar, esperar })
  await verificarArquivos({ avaliar, esperar })
  await verificarIdiomas({ avaliar, esperar })
  console.log('Fumaça da IDE: tudo certo.')
}

// ---- menus, diálogos, arquivos e idiomas (varredura da interface) ---------------------------------

const M = 'window.__misteralg'
const dialogoAberto = (avaliar) => avaliar(`(() => { const d = document.querySelector('dialog[open]'); return d ? { titulo: d.querySelector('.janela-titulo')?.textContent ?? '', botoes: [...d.querySelectorAll('.janela-acoes button')].map((b) => b.textContent), texto: d.innerText } : null })()`)
async function fecharDialogos(avaliar, esperar) {
  for (let i = 0; i < 5 && (await avaliar(`!!document.querySelector('dialog[open]')`)); i += 1) {
    await avaliar(`document.querySelector('dialog[open]')?.close()`)
    await esperar(100)
  }
}

/** Todo item do menu tem um comando na IDE e os diálogos abrem e fecham sem erro. */
async function verificarMenusEDialogos({ avaliar, esperar }) {
  await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false`)
  await avaliar(`${M}.comandos.novo('portugol')`)
  await avaliar(`${M}.editor.definirTexto('algoritmo "x"\\nvar\\n  a: inteiro\\ninicio\\n  a <- 1\\n  escreva(a)\\nfimalgoritmo\\n')`)

  const { readFileSync } = await import('node:fs')
  const menu = readFileSync(new URL('../app/src/main/menu.js', import.meta.url), 'utf8')
  const ids = new Set([...menu.matchAll(/item\('[^']*', '([a-z-]+)'/g)].map((m) => m[1]))
  const comandos = await avaliar(`Object.keys(${M}.comandos)`)
  const semComando = [...ids].filter((i) => !comandos.includes(i) && i !== 'dos') // "dos" é só uma marca (desligada) no menu
  conferir('todo item do menu tem comando na IDE', semComando, [])

  const DIALOGOS = {
    calculadora: /calculadora/i, calendario: /Calendário de \d{4}/, dica: /Dica do dia/, termos: /Termos de Uso/, sobre: /Sobre o MisterALG/,
    pilha: /Pilha de Ativação/, perfil: /Perfil de execução/, configuracoes: /configuração/, 'configurar-cores': /configuração/, 'configurar-ia': /Assistente de IA/,
    'ajuda-tela': /Tela do MisterALG/, 'ajuda-linguagem': /Linguagem \(Portugol\)/, 'ajuda-referencia': /Referência da Linguagem/,
    localizar: /Pesquisar o Texto/, substituir: /Substituir os textos/,
    'exportar-pascal': /Pascal/, 'exportar-c': /C \/ C\+\+/, 'exportar-java': /Java/,
  }
  for (const [id, titulo] of Object.entries(DIALOGOS)) {
    await avaliar(`void ${M}.comandos[${JSON.stringify(id)}]()`)
    await esperar(300)
    const d = await dialogoAberto(avaliar)
    conferir(`menu ${id}: abre o diálogo`, titulo.test(d?.titulo ?? ''), true)
    await fecharDialogos(avaliar, esperar)
    conferir(`menu ${id}: fecha o diálogo`, await dialogoAberto(avaliar), null)
  }
  const exportado = async (id) => { await avaliar(`void ${M}.comandos[${JSON.stringify(id)}]()`); await esperar(300); const t = (await dialogoAberto(avaliar)).texto; await fecharDialogos(avaliar, esperar); return t }
  conferir('exportar Pascal gera o programa', /program x;/.test(await exportado('exportar-pascal')), true)
  conferir('exportar C gera o programa', /int main\(void\)/.test(await exportado('exportar-c')), true)
  conferir('exportar Java gera a classe', /public class X/.test(await exportado('exportar-java')), true)

  // Calculadora: 7 + 8 = 15
  await avaliar(`void ${M}.comandos.calculadora()`)
  await esperar(200)
  for (const t of ['7', '+', '8', '=']) await avaliar(`[...document.querySelectorAll('dialog[open] .calculadora button')].find((b) => b.textContent === ${JSON.stringify(t)}).click()`)
  conferir('calculadora: 7 + 8', await avaliar(`document.querySelector('dialog[open] .calculadora output').textContent`), '15')
  await fecharDialogos(avaliar, esperar)

  // Localizar: acha "inicio" no editor
  await avaliar(`void ${M}.comandos.localizar()`)
  await esperar(200)
  await avaliar(`(() => { const d = document.querySelector('dialog[open]'); d.querySelector('input').value = 'inicio'; [...d.querySelectorAll('.janela-acoes button')].find((b) => b.textContent === 'OK').click() })()`)
  await esperar(300)
  conferir('localizar seleciona o texto achado', await avaliar(`${M}.editor.textoSelecionado()`), 'inicio')

  // Linhas numeradas liga/desliga e volta
  const linhas = () => avaliar(`!!document.querySelector('.cm-lineNumbers')`)
  const antes = await linhas()
  await avaliar(`void ${M}.comandos.linhas()`)
  await esperar(400)
  conferir('linhas (ativa/desativa) muda a calha', await linhas(), !antes)
  await avaliar(`void ${M}.comandos.linhas()`)
  await esperar(400)
}

/** Abrir, modificar, salvar e a recuperação após falha, com um arquivo de verdade. */
async function verificarArquivos({ avaliar, esperar }) {
  const { mkdtempSync, readFileSync, writeFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const pasta = mkdtempSync(join(tmpdir(), 'misteralg-fumaca-'))
  const arquivo = join(pasta, 'teste.alg')
  const original = 'algoritmo "teste"\ninicio\n   escreval("oi")\nfimalgoritmo\n'
  writeFileSync(arquivo, original, 'latin1')
  try {
    await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false`)
    await avaliar(`void ${M}.comandos['abrir-recente'](${JSON.stringify(arquivo)})`)
    await esperar(500)
    conferir('abrir arquivo: caminho no documento', await avaliar(`${M}.doc.caminho`), arquivo)
    conferir('abrir arquivo: texto no editor', await avaliar(`${M}.editor.texto()`), original)
    conferir('abrir arquivo: não fica modificado', await avaliar(`${M}.doc.modificado`), false)
    await avaliar(`${M}.editor.inserir('// novo\\n')`)
    conferir('editar marca como modificado', await avaliar(`${M}.doc.modificado`), true)
    conferir('título da janela mostra a modificação', /modificado/i.test(await avaliar(`document.querySelector('#st-estado').textContent`)), true)
    await avaliar(`void ${M}.comandos.salvar()`)
    await esperar(500)
    conferir('salvar: não fica modificado', await avaliar(`${M}.doc.modificado`), false)
    conferir('salvar: o arquivo em disco foi atualizado', /\/\/ novo/.test(readFileSync(arquivo, 'latin1')), true)
    const inexistente = await avaliar(`window.misteralg.arquivo.abrirCaminho(${JSON.stringify(join(pasta, 'nao-existe.alg'))})`)
    conferir('abrir arquivo que não existe devolve erro', typeof inexistente?.erro, 'string')

    // Recuperação após falha: o que a IDE grava a cada 5 s volta pela mesma ponte e some ao limpar.
    await avaliar(`window.misteralg.recuperacao.gravar({ texto: 'algoritmo "r"\\nfimalgoritmo\\n', caminho: null, nome: 'r', codificacao: 'windows-1252', linguagem: 'portugol' })`)
    conferir('recuperação: grava e lê', (await avaliar(`window.misteralg.recuperacao.ler()`))?.nome, 'r')
    await avaliar(`window.misteralg.recuperacao.limpar()`)
    conferir('recuperação: limpa', await avaliar(`window.misteralg.recuperacao.ler()`), null)
  } finally {
    rmSync(pasta, { recursive: true, force: true })
    await avaliar(`${M}.doc.modificado = false`)
    await avaliar(`${M}.comandos.novo('portugol')`) // o documento não aponta mais para o arquivo apagado
  }
}

/** Troca para o inglês e confere que nada com tradução ficou em português; depois volta ao português. */
async function verificarIdiomas({ avaliar, esperar }) {
  const { default: CHAVES } = await import('../app/src/compartilhado/traducoes/chaves.js')
  const { default: en } = await import('../app/src/compartilhado/traducoes/en.js')
  // textos em português que têm tradução (e que o inglês muda): se aparecerem na tela em inglês, faltou traduzir
  const traduzidos = new Map(Object.entries(CHAVES).filter(([n, pt]) => en[n] && en[n] !== pt && !/\{\d+\}/.test(pt)).map(([, pt]) => [pt, true]))
  const coletar = `(() => {
    const aluno = '.cm-editor, #console-tela, #visualizacao, .previa-html, .previa-quadro, .assistente-msg, .grade td, .mo-valor, .mc-valor'
    const out = []
    const visita = (n) => {
      if (n.nodeType === 3) { if (!n.parentElement?.closest(aluno)) out.push(n.nodeValue.trim()); return }
      if (n.nodeType !== 1 || n.matches(aluno)) return
      for (const a of ['title', 'placeholder', 'aria-label', 'data-dica']) { const v = n.getAttribute(a); if (v) out.push(v.trim()) }
      n.childNodes.forEach(visita)
    }
    visita(document.body)
    return out
  })()`
  // Trocar o idioma recarrega a IDE: a marca some junto com a página antiga, e a nova só vale quando __misteralg existe.
  const trocarIdioma = async (id) => {
    await avaliar(`${M}.doc.modificado = false; window.__marcaFumaca = true; void ${M}.comandos.idioma(${JSON.stringify(id)})`)
    for (let i = 0; i < 80; i += 1) {
      await esperar(500)
      if (await avaliar('window.__marcaFumaca === undefined && !!window.__misteralg').catch(() => false)) return
    }
    throw new Error(`a IDE não recarregou ao trocar para ${id}: ${JSON.stringify(await avaliar(`({ url: location.href, lang: document.documentElement.lang, ide: !!window.__misteralg, marca: window.__marcaFumaca, dialogo: !!document.querySelector('dialog[open]') })`).catch((e) => e.message))}`)
  }
  await avaliar(`${M}.execucao.restaurar()`)
  await trocarIdioma('en')
  conferir('idioma en: a página recarregou em inglês', await avaliar(`document.documentElement.lang`), 'en')
  conferir('idioma en: barra de ferramentas', await avaliar(`document.querySelector('#barra').getAttribute('aria-label')`), 'Toolbar')
  const restos = new Set()
  const colher = async () => { for (const t of await avaliar(coletar)) if (traduzidos.has(t)) restos.add(t) }
  await colher()
  for (const id of ['ajuda-tela', 'ajuda-linguagem', 'ajuda-referencia', 'configuracoes', 'configurar-ia', 'sobre', 'localizar', 'substituir', 'pilha', 'calendario', 'dica']) {
    console.log('  (idioma en) abrindo', id)
    await avaliar(`void ${M}.comandos[${JSON.stringify(id)}]()`)
    await esperar(300)
    conferir(`idioma en: ${id} abre`, !!(await dialogoAberto(avaliar)), true)
    await colher()
    await fecharDialogos(avaliar, esperar)
  }
  conferir('idioma en: nenhum texto traduzível ficou em português', [...restos], [])
  conferir('idioma en: ajuda traduzida', await (async () => { await avaliar(`void ${M}.comandos['ajuda-tela']()`); await esperar(300); const t = (await dialogoAberto(avaliar)).texto; await fecharDialogos(avaliar, esperar); return /Shortcuts/.test(t) && /Run \(or continue after a pause\)/.test(t) })(), true)

  await trocarIdioma('pt')
  conferir('idioma pt: voltou ao português', await avaliar(`document.documentElement.lang`), 'pt-BR')
}

