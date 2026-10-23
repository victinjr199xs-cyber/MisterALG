// Python no MisterALG: roda com Pyodide (CPython em WebAssembly), 100% offline.
// No app, os arquivos do Pyodide ficam em <renderer>/pyodide/ (copiados no build por electron.vite.config.mjs);
// no Node (testes) o próprio pacote "pyodide" os encontra. O passo a passo linha a linha ainda não existe.

let carregando = null

function inicializarPyodide() {
  carregando ??= (async () => {
    const m = await import('pyodide/pyodide.mjs')
    // No Node o pyodide.mjs procura os arquivos a partir da pasta atual, então o caminho vai explícito.
    const indexURL = globalThis.document
      ? new URL('pyodide/', document.baseURI).href
      : new URL('.', import.meta.resolve('pyodide/pyodide.mjs')).pathname.replace(/^\/(\w:)/, '$1')
    const py = await m.loadPyodide({ indexURL })
    py.runPython(PREPARO)
    return py
  })()
  carregando.catch(() => { carregando = null }) // uma falha de carregamento não pode ficar guardada para sempre
  return carregando
}

// Roda o programa do aluno com exec(compile(...)): o texto não é colado em nenhum modelo,
// então strings de várias linhas e a indentação do aluno chegam intactas, e o traceback traz a linha certa.
const PREPARO = `
import contextlib, io, json, traceback

def __misteralg_rodar(fonte):
    saida = io.StringIO()
    erro = None
    with contextlib.redirect_stdout(saida), contextlib.redirect_stderr(saida):
        try:
            exec(compile(fonte, 'programa.py', 'exec'), {'__name__': '__main__'})
        except SystemExit:
            pass
        except BaseException as e:
            linha = getattr(e, 'lineno', 0) if isinstance(e, SyntaxError) else 0
            if not linha:
                for f in reversed(traceback.extract_tb(e.__traceback__)):
                    if f.filename == 'programa.py':
                        linha = f.lineno
                        break
            erro = {'mensagem': f'{type(e).__name__}: {e}', 'linha': linha or 0}
    return json.dumps({'saida': saida.getvalue(), 'erro': erro})
`

export class SessaoPython {
  constructor(fonte, opcoes = {}) {
    this.fonte = fonte
    this.opcoes = opcoes
    this.estado = 'pronto'
    this.terminado = false
    this.pyodide = null
    this.iniciar()
  }

  async iniciar() {
    try {
      this.pyodide = await inicializarPyodide()
    } catch (e) {
      return this.finalizar('erro', { mensagem: `Não foi possível carregar o Python: ${e?.message ?? e}`, linha: 0 })
    }
    if (!this.terminado) this.executarTudo()
  }

  // Sem passo a passo ainda: F8 e F9 rodam o programa inteiro (assim que o Pyodide terminar de carregar).
  continuar() {}
  passo() {}

  parar() {
    if (!this.terminado) this.finalizar('parado')
  }

  fornecerEntrada() {}

  executarTudo() {
    this.estado = 'rodando'
    try {
      const r = JSON.parse(this.pyodide.globals.get('__misteralg_rodar')(this.fonte))
      if (r.saida) this.opcoes.onOutput?.(r.saida)
      if (r.erro) this.finalizar('erro', { ...r.erro, explicacao: 'Este erro aconteceu durante a execução do programa em Python. Leia a última linha da mensagem: ela diz o que deu errado.' })
      else this.finalizar('terminado')
    } catch (e) {
      this.finalizar('erro', { mensagem: String(e?.message ?? e).split('\n').pop(), linha: 0 })
    }
  }

  finalizar(estado, erro) {
    if (this.terminado) return
    this.terminado = true
    this.estado = estado
    this.opcoes.onEnd?.(estado, erro)
  }
}

/** Atalho para testes: roda até o fim e devolve a saída. */
export function rodarPython(fonte, opcoes = {}) {
  return new Promise((resolve) => {
    let saida = ''
    const sessao = new SessaoPython(fonte, {
      ...opcoes,
      onOutput: (t) => { saida += t },
      onEnd: (status, erro) => resolve({ saida, status, erro, sessao }),
    })
  })
}
