// Gera as imagens da documentação dirigindo o app de verdade.
// 1. Rode o app em modo de captura:
//      MISTERALG_CAPTURA=1 MISTERALG_DADOS=<pasta-temporária> electron app/out/main/index.js --remote-debugging-port=9333
// 2. node scripts/cdp.mjs 9333 scripts/capturas.mjs
// Saída: docs/imagens/*.png e docs/imagens/quadros/*.png (para a animação).

import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const saida = join(raiz, 'docs', 'imagens')
const quadros = join(saida, 'quadros')
mkdirSync(quadros, { recursive: true })
const exemplo = (nome) => join(raiz, 'exemplos', nome)

export default async ({ avaliar, esperar, foto, tecla, digitar }) => {
  const M = 'window.__misteralg'
  const abrir = async (nome) => {
    await avaliar(`${M}.execucao.restaurar(); ${M}.doc.modificado = false`)
    await avaliar(`${M}.comandos['abrir-recente'](${JSON.stringify(exemplo(nome))})`)
    await esperar(600)
  }
  const digitarEntrada = async (texto) => {
    for (let i = 0; i < 20 && !(await avaliar(`!!document.querySelector('.console-entrada')`)); i += 1) await esperar(150)
    await avaliar(`document.querySelector('.console-entrada').focus()`)
    await digitar(texto)
    await tecla('Enter')
    await esperar(250)
  }
  const fecharDialogos = () => avaliar(`document.querySelectorAll('dialog[open]').forEach(d => d.close())`)
  const irParaLinha = (n) => avaliar(`(() => { const v = ${M}.editor.view; const l = v.state.doc.line(${n}); ${M}.editor.selecionar(l.from + l.text.length, l.from + l.text.length) })()`)

  for (let i = 0; i < 40 && !(await avaliar('!!window.__misteralg')); i += 1) await esperar(500)

  // 1. Tela principal
  await abrir('media_notas.alg')
  await irParaLinha(13)
  await foto(join(saida, '01-tela-principal.png'))

  // 2. Execução com leia, console e variáveis
  await avaliar(`void ${M}.comandos.executar()`)
  await digitarEntrada('Ana')
  await digitarEntrada('8')
  await digitarEntrada('6.5')
  await esperar(500)
  await foto(join(saida, '02-execucao.png'))

  // 3. Depuração: breakpoint dentro da função recursiva + pilha de ativação
  await abrir('fatorial_recursivo.alg')
  await irParaLinha(9) // "se x <= 1 entao", dentro da função
  await avaliar(`${M}.comandos.breakpoint()`)
  await avaliar(`void ${M}.comandos.executar()`)
  await digitarEntrada('4')
  await esperar(300)
  await avaliar(`void ${M}.comandos.executar()`) // fatorial(3)
  await esperar(300)
  await avaliar(`void ${M}.comandos.executar()`) // fatorial(2)
  await esperar(400)
  await foto(join(saida, '03-depuracao.png'))
  await avaliar(`void ${M}.comandos.pilha()`)
  await esperar(400)
  await foto(join(saida, '04-pilha-de-ativacao.png'))
  await fecharDialogos()
  await avaliar(`${M}.comandos.parar(); ${M}.comandos['limpar-breakpoints']()`)
  await esperar(300)

  // 4. Erro de execução com explicação
  await abrir('erro_indice.alg')
  await avaliar(`void ${M}.comandos.executar()`)
  await esperar(700)
  await foto(join(saida, '05-erro.png'))
  await fecharDialogos()

  // 5. Sugestões (Ctrl+J) e auto-digitação
  await abrir('tabuada.alg')
  await irParaLinha(9)
  await avaliar(`${M}.editor.inserir('\\n   esc')`)
  await esperar(200)
  await tecla('j', ['Control'], 'KeyJ')
  await esperar(500)
  await foto(join(saida, '06-sugestoes-ctrl-j.png'))
  await tecla('Escape')
  await avaliar(`${M}.doc.modificado = false`)

  // 6. Localizar
  await abrir('ordena_vetor.alg')
  await irParaLinha(28)
  await avaliar(`void ${M}.comandos.localizar()`)
  await esperar(400)
  await avaliar(`(() => { const i = document.querySelector('dialog[open] input'); i.value = 'troca'; i.select() })()`)
  await foto(join(saida, '07-localizar.png'))
  await fecharDialogos()

  // 7. Perfil depois de rodar
  await avaliar(`void ${M}.comandos.executar()`)
  await esperar(800)
  await avaliar(`void ${M}.comandos.perfil()`)
  await esperar(400)
  await foto(join(saida, '08-perfil.png'))
  await fecharDialogos()

  // 8. Quadros do passo a passo (animação)
  await abrir('ordena_vetor.alg')
  for (let n = 0; n < 48; n += 1) {
    await avaliar(`${M}.comandos.passo()`)
    await esperar(120)
    await foto(join(quadros, `${String(n).padStart(3, '0')}.png`))
  }
  await avaliar(`${M}.comandos.parar()`)
  console.log('capturas prontas em', saida)
}
