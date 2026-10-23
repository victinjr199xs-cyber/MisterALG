import { loadPyodide } from 'pyodide'

let pyodide = null

export async function rodarPython(fonte) {
  try {
    if (!pyodide) {
      pyodide = await loadPyodide()
    }

    let saida = ''
    let status = 'terminado'
    let erro = undefined

    try {
      // Captura stdout
      const capturaCodig = `
import sys
from io import StringIO

_old_stdout = sys.stdout
sys.stdout = StringIO()

try:
    exec("""${fonte.replace(/"/g, '\\"').replace(/\n/g, '\\n')}""")
finally:
    _saida = sys.stdout.getvalue()
    sys.stdout = _old_stdout
    print(_saida, end='')
`
      pyodide.runPython(capturaCodig)
      saida = pyodide.runPython('_saida if "_saida" in dir() else ""')
    } catch (e) {
      status = 'erro'
      erro = {
        mensagem: String(e).split('\n')[0],
        linha: 0,
        explicacao: 'Erro durante a execução do programa em Python.'
      }
    }

    return { saida, status, erro }
  } catch (e) {
    return {
      saida: '',
      status: 'erro',
      erro: {
        mensagem: String(e).split('\n')[0],
        linha: 0,
        explicacao: 'Erro ao inicializar Pyodide.'
      }
    }
  }
}
