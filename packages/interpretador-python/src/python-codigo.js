// O código em Python que o executor carrega no Pyodide: roda o programa do aluno com
// exec(compile(...)) (o texto do aluno nunca é colado dentro de outro código) e, quando pedido,
// rastreia cada linha com sys.settrace para pausar, tirar a "foto" da memória e esperar um comando.

export const PREPARO = String.raw`
import sys, json, types, collections, traceback

_ARQ = 'programa.py'
_SEM_RASTRO = {'<listcomp>', '<dictcomp>', '<setcomp>', '<genexpr>', '<lambda>'}
_MAX_OBJETOS = 80
_MAX_ITENS = 40
_PRIMITIVOS = (bool, int, float, complex, str, bytes, bytearray, range, type(None), type(Ellipsis), type(NotImplemented))


def _txt(v):
    try:
        s = repr(v)
    except BaseException:
        s = '<' + type(v).__name__ + '>'
    return s if len(s) <= 80 else s[:77] + '...'


def _expansivel(v):
    if isinstance(v, (list, tuple, set, frozenset, dict, collections.deque)):
        return True
    if isinstance(v, (types.FunctionType, types.MethodType, type)):
        return True
    if isinstance(v, (types.ModuleType, types.GeneratorType, types.BuiltinFunctionType, types.CodeType, types.FrameType)):
        return False
    return hasattr(v, '__dict__') or bool(getattr(type(v), '__slots__', ()))


class _Foto:
    def __init__(self):
        self.ids = {}
        self.fila = []

    def valor(self, v):
        if isinstance(v, _PRIMITIVOS) or not _expansivel(v):
            return {'texto': _txt(v), 'tipo': type(v).__name__}
        n = self.ids.get(id(v))
        if n is None:
            if len(self.ids) >= _MAX_OBJETOS:
                return {'texto': '…', 'tipo': type(v).__name__}
            n = len(self.ids) + 1
            self.ids[id(v)] = n
            self.fila.append(v)
        return {'ref': n, 'tipo': type(v).__name__}

    def objeto(self, v, n):
        tipo = type(v).__name__
        if isinstance(v, (list, tuple, set, frozenset, collections.deque)):
            pares = [(str(i), x) for i, x in enumerate(v)]
            rotulo = tipo + ' (' + str(len(v)) + ')'
        elif isinstance(v, dict):
            pares = [(_txt(k), x) for k, x in v.items()]
            rotulo = tipo + ' (' + str(len(v)) + ')'
        elif isinstance(v, type):
            pares = []
            rotulo = 'class ' + v.__name__
        elif isinstance(v, (types.FunctionType, types.MethodType)):
            pares = []
            rotulo = 'ƒ ' + getattr(v, '__qualname__', getattr(v, '__name__', '?')) + '()'
        else:
            try:
                pares = list(vars(v).items())
            except TypeError:
                pares = []
                for nome in getattr(type(v), '__slots__', ()):
                    if hasattr(v, nome):
                        pares.append((nome, getattr(v, nome)))
            rotulo = tipo
        itens = [{'chave': c, 'valor': self.valor(x)} for c, x in pares[:_MAX_ITENS]]
        return {'id': n, 'tipo': tipo, 'rotulo': rotulo, 'total': len(pares), 'itens': itens}


def _variaveis(foto, quadro, no_modulo):
    saida = []
    for nome, v in list(quadro.f_locals.items()):
        if nome.startswith('__') and nome.endswith('__'):
            continue
        if nome.startswith('.'):
            continue
        if no_modulo and isinstance(v, (types.FunctionType, types.ModuleType, types.BuiltinFunctionType, type)):
            continue
        saida.append({'nome': nome, 'valor': foto.valor(v)})
    return saida


def _foto(quadro_atual):
    pilha = []
    q = quadro_atual
    while q is not None:
        c = q.f_code
        if c.co_filename == _ARQ and c.co_name not in _SEM_RASTRO:
            pilha.append(q)
        q = q.f_back
    pilha.reverse()
    foto = _Foto()
    quadros = []
    for q in pilha:
        no_modulo = q.f_code.co_name == '<module>'
        quadros.append({
            'nome': '(programa principal)' if no_modulo else q.f_code.co_qualname,
            'linha': q.f_lineno,
            'variaveis': _variaveis(foto, q, no_modulo),
        })
    objetos = []
    i = 0
    while i < len(foto.fila):
        objetos.append(foto.objeto(foto.fila[i], i + 1))
        i += 1
    return {'quadros': quadros, 'objetos': objetos}


def __misteralg_rodar(fonte, passo, bps, pausar):
    estado = {'passo': passo, 'bps': set(json.loads(bps))}

    corpos_de_classe = set()

    def rastro(quadro, evento, arg):
        c = quadro.f_code
        if c.co_filename != _ARQ or c.co_name in _SEM_RASTRO:
            return None
        if evento == 'call' and c.co_name != '<module>' and not (c.co_flags & 1):
            corpos_de_classe.add(id(quadro))  # o corpo de uma class começa repetindo a linha do "class X:"
        if evento == 'line':
            linha = quadro.f_lineno
            if id(quadro) in corpos_de_classe:
                corpos_de_classe.discard(id(quadro))
                if linha == c.co_firstlineno:
                    return rastro
            if estado['passo'] or linha in estado['bps']:
                resposta = json.loads(pausar(linha, json.dumps(_foto(quadro), ensure_ascii=False)))
                estado['passo'] = resposta['c'] == 'passo'
                estado['bps'] = set(resposta.get('bps', ()))
        return rastro

    ambiente = {'__name__': '__main__', '__builtins__': __builtins__}
    erro = None
    try:
        codigo = compile(fonte, _ARQ, 'exec')
        if passo or estado['bps']:
            sys.settrace(rastro)
        exec(codigo, ambiente)
    except SystemExit as e:
        if isinstance(e.code, str):
            sys.stderr.write(e.code + '\n')
    except BaseException as e:
        sys.settrace(None)
        linha = e.lineno if isinstance(e, SyntaxError) and e.lineno else 0
        pilha_aluno = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == _ARQ]
        if not linha and pilha_aluno:
            linha = pilha_aluno[-1].lineno
        if isinstance(e, SyntaxError):
            texto = ''.join(traceback.format_exception_only(type(e), e))
        else:
            texto = 'Traceback (most recent call last):\n' + ''.join(traceback.format_list(pilha_aluno)) + ''.join(traceback.format_exception_only(type(e), e))
        mensagem = e.msg if isinstance(e, SyntaxError) else str(e)
        erro = {'tipo': type(e).__name__, 'mensagem': mensagem, 'linha': linha or 0, 'texto': texto}
    finally:
        sys.settrace(None)
    return json.dumps(erro, ensure_ascii=False) if erro else ''
`
