// Worker do JavaScript/TypeScript do aluno: sem DOM e sem window.misteralg, só o interpretador.

import { SessaoJS, pilhaDe } from '@misteralg/interpretador-js'

let sessao = null

const enviar = (tipo, dados) => postMessage({ tipo, estado: sessao?.estado, ...dados })

self.onmessage = ({ data }) => {
  const { tipo } = data
  if (tipo === 'iniciar') {
    sessao = new SessaoJS(data.fonte, {
      ...data.opcoes,
      onOutput: (texto) => enviar('saida', { texto }),
      onStep: (passo) => enviar('passo', { passo }),
      onMemory: (foto) => enviar('memoria', { foto, pilha: pilhaDe(foto) }),
      onWaitInput: () => enviar('entrada'),
      onEnd: (status, erro) => enviar('fim', { status, erro }),
    })
    return
  }
  if (!sessao) return
  if (tipo === 'continuar') sessao.continuar()
  else if (tipo === 'passo') sessao.passo()
  else if (tipo === 'parar') sessao.parar()
  else if (tipo === 'entrada') sessao.fornecerEntrada(data.texto)
  else if (tipo === 'modo') sessao.modo = data.valor
  else if (tipo === 'pararNaProxima') sessao.pararNaProxima = data.valor
  else if (tipo === 'breakpoints') sessao.breakpoints = new Set(data.valor)
}
