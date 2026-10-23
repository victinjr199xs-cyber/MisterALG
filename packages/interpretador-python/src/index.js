// Executa Python no navegador usando Pyodide.
// O passo a passo com rastreamento de linhas será implementado em versão futura.

let pyodide = null

async function inicializarPyodide() {
  if (pyodide) return pyodide
  try {
    const { loadPyodide } = await import('https://cdn.jsdelivr.net/pyodide/v0.24.0/full/pyodide.js')
    pyodide = await loadPyodide()
    return pyodide
  } catch (e) {
    throw new Error('Erro ao carregar Pyodide: ' + String(e))
  }
}

export class SessaoPython {
  constructor(fonte, opcoes = {}) {
    this.fonte = fonte
    this.opcoes = opcoes
    this.estado = 'pronto'
    this.terminado = false
    this.buffer = ''
    this.iniciar()
  }

  async iniciar() {
    try {
      await inicializarPyodide()
      if (this.opcoes.modo === 'passo') {
        this.passo()
      } else {
        this.continuar()
      }
    } catch (e) {
      this.estado = 'erro'
      this.terminado = true
      this.opcoes.onEnd?.('erro', {
        mensagem: String(e),
        linha: 0
      })
    }
  }

  continuar() {
    if (this.terminado) return
    this.executarTudo()
  }

  passo() {
    if (this.terminado) return
    this.executarTudo()
  }

  parar() {
    if (this.terminado) return
    this.terminado = true
    this.estado = 'parado'
    this.opcoes.onEnd?.('parado')
  }

  fornecerEntrada(texto) {
    // input() será implementado
  }

  async executarTudo() {
    try {
      this.estado = 'rodando'

      const codigo = `
import sys
from io import StringIO

_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

try:
${this.fonte.split('\n').map(l => '    ' + l).join('\n')}
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    _saida = sys.stdout.getvalue()
    _erro = sys.stderr.getvalue()
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr
`

      pyodide.runPython(codigo)
      const saida = pyodide.runPython('_saida if "_saida" in dir() else ""')
      const erro = pyodide.runPython('_erro if "_erro" in dir() else ""')

      this.buffer = saida + (erro ? erro : '')
      this.opcoes.onOutput?.(this.buffer)

      this.estado = 'terminado'
      this.terminado = true
      this.opcoes.onEnd?.('terminado')
    } catch (e) {
      this.estado = 'erro'
      this.terminado = true
      this.opcoes.onEnd?.('erro', {
        mensagem: String(e).split('\n')[0],
        linha: 0,
        explicacao: 'Erro durante a execução do programa em Python.'
      })
    }
  }
}

export async function rodarPython(fonte, opcoes = {}) {
  return new Promise(async (resolve) => {
    let saida = ''
    const sessao = new SessaoPython(fonte, {
      ...opcoes,
      onOutput: (t) => { saida = t },
      onEnd: (status, erro) => resolve({ saida, status, erro, sessao }),
    })
  })
}
