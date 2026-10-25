// O resto do System: Console, Environment, Thread, Task, Guid, CultureInfo, Type, BigInteger, File/Path (em memória).

import { CULTURAS } from '../formatar.js'
import { Multicast } from '../operadores.js'
import { Suspende } from '../refs.js'
import { Arr, Chr, Dbl, Flt, Num, Objeto, Tupla, ValorEnum, comoNumero, converterNumero, ehNumero } from '../valores.js'
import { nomeCompleto, semNulo } from '../tipos.js'
import { ErroCS, ExcecaoCS } from '../erros.js'
import { ListaCS } from './colecoes.js'
import { SeqCS } from './linq.js'

/** Environment.Exit(): termina o programa limpo. */
export class SaidaDoPrograma extends Error {
  constructor(codigo) { super('Environment.Exit'); this.codigo = codigo }
}

// ---- Console ----------------------------------------------------------------------------------------------------

const texto = (m, a) => {
  if (a.length === 0) return ''
  if (a.length === 1) {
    const v = a[0]
    if (v instanceof Arr && v.tipoElem === 'char') return v.itens.map((c) => String.fromCharCode(c.c)).join('')
    return m.aTexto(v)
  }
  if (typeof a[0] === 'string') {
    const resto = a.slice(1)
    return m.formatar(a[0], resto.length === 1 && resto[0] instanceof Arr && resto[0].tipoElem !== 'char' ? resto[0].itens : resto)
  }
  return m.aTexto(a[0])
}

const lerLinha = () => new Suspende((function* ler() {
  const t = yield { tipo: 'entrada' }
  return t === undefined ? null : t
}()))

const CORES_CSHARP = {
  Black: '#000000', DarkBlue: '#0000aa', DarkGreen: '#00aa00', DarkCyan: '#00aaaa', DarkRed: '#aa0000', DarkMagenta: '#aa00aa', DarkYellow: '#aa5500',
  Gray: '#aaaaaa', DarkGray: '#555555', Blue: '#5555ff', Green: '#55ff55', Cyan: '#55ffff', Red: '#ff5555', Magenta: '#ff55ff', Yellow: '#ffff55', White: '#ffffff',
}

export class FluxoConsoleCS {
  constructor(tipo) { this.tipo = tipo }

  nomeCS() { return 'TextWriter' }
}
FluxoConsoleCS.METODOS = {
  WriteLine(m, o, a) { m.saidaTexto(`${texto(m, a)}\n`); return null },
  Write(m, o, a) { m.saidaTexto(texto(m, a)); return null },
  Flush: () => null,
  ReadLine: () => lerLinha(),
  ReadToEnd: () => new Suspende((function* ler() {
    let r = ''
    for (;;) {
      const t = yield { tipo: 'entrada' }
      if (t === undefined || t === null) return r
      r += `${t}\n`
    }
  }())),
  Read: (m) => lerCaractere(m),
}

function lerCaractere(m) {
  return new Suspende((function* ler() {
    if (!m.bufferEntrada) {
      const t = yield { tipo: 'entrada' }
      if (t === undefined || t === null) return -1
      m.bufferEntrada = `${t}\n`
    }
    const c = m.bufferEntrada.charCodeAt(0)
    m.bufferEntrada = m.bufferEntrada.slice(1)
    return c
  }()))
}

export class TeclaCS {
  constructor(m, c) { this.c = c; this.m = m }

  nomeCS() { return 'ConsoleKeyInfo' }

  paraTexto() { return String.fromCharCode(this.c) }
}
TeclaCS.PROPS = {
  KeyChar: { get: (m, t) => new Chr(t.c) },
  Key: { get: (m, t) => { const def = m.buscarClasse('ConsoleKey'); return def.valorDe(t.c === 10 || t.c === 13 ? 13 : /[a-z]/i.test(String.fromCharCode(t.c)) ? String.fromCharCode(t.c).toUpperCase().charCodeAt(0) : t.c === 32 ? 32 : 0) } },
  Modifiers: { get: () => 0 },
}
TeclaCS.METODOS = {}

const estatCons = {
  fundo: 'Black', frente: 'Gray', titulo: '',
}

export const CONSOLE = {
  nome: 'Console',
  const: {},
  props: {
    Out: { get: () => new FluxoConsoleCS('out') },
    Error: { get: () => new FluxoConsoleCS('err') },
    In: { get: () => new FluxoConsoleCS('in') },
    ForegroundColor: {
      get: (m) => m.buscarClasse('ConsoleColor').valorDe(Object.keys(CORES_CSHARP).indexOf(m.corFrente ?? estatCons.frente)),
      set(m, v) {
        m.corFrente = v.nome
        m.op.cor?.(CORES_CSHARP[v.nome], 'FRENTE')
      },
    },
    BackgroundColor: {
      get: (m) => m.buscarClasse('ConsoleColor').valorDe(Object.keys(CORES_CSHARP).indexOf(m.corFundo ?? estatCons.fundo)),
      set(m, v) {
        m.corFundo = v.nome
        m.op.cor?.(CORES_CSHARP[v.nome], 'FUNDO')
      },
    },
    Title: { get: () => estatCons.titulo, set: (m, v) => { estatCons.titulo = v } },
    WindowWidth: { get: () => 100, set: () => {} },
    WindowHeight: { get: () => 25, set: () => {} },
    BufferWidth: { get: () => 100, set: () => {} },
    BufferHeight: { get: () => 25, set: () => {} },
    CursorLeft: { get: () => 0, set: () => {} },
    CursorTop: { get: () => 0, set: () => {} },
    CursorVisible: { get: () => true, set: () => {} },
    OutputEncoding: { get: () => null, set: () => {} },
    InputEncoding: { get: () => null, set: () => {} },
    KeyAvailable: { get: () => false },
    IsInputRedirected: { get: () => false },
    IsOutputRedirected: { get: () => false },
    TreatControlCAsInput: { get: () => false, set: () => {} },
  },
  estatico: {
    WriteLine(m, a) { m.saidaTexto(`${texto(m, a)}\n`); return null },
    Write(m, a) { m.saidaTexto(texto(m, a)); return null },
    ReadLine: () => lerLinha(),
    Read: (m) => lerCaractere(m),
    ReadKey: (m) => new Suspende((function* tecla() {
      const t = yield { tipo: 'entrada' }
      const c = t === undefined || t === null || t === '' ? 13 : t.charCodeAt(0)
      return new TeclaCS(m, c)
    }())),
    Clear(m) { m.saidaTexto('\f'); return null },
    Beep: () => null,
    ResetColor(m) {
      m.corFrente = null
      m.corFundo = null
      m.op.cor?.('#aaaaaa', 'FRENTE')
      m.op.cor?.('#000000', 'FUNDO')
      return null
    },
    SetCursorPosition: () => null,
    SetWindowSize: () => null,
    SetBufferSize: () => null,
    OpenStandardOutput: () => new FluxoConsoleCS('out'),
  },
}

// ---- Environment, Thread, GC ---------------------------------------------------------------------------------------

export const ENVIRONMENT = {
  nome: 'Environment',
  // "\n" de propósito: o console do MisterALG só usa "\n". No Windows o .NET dá "\r\n" (só muda se o programa comparar com "\r\n").
  const: { NewLine: '\n' },
  props: {
    ProcessorCount: { get: () => 4 },
    TickCount: { get: (m) => Math.floor(m.agoraMs()) | 0 },
    TickCount64: { get: (m) => BigInt(Math.floor(m.agoraMs())) },
    MachineName: { get: () => 'MISTERALG' },
    UserName: { get: () => 'aluno' },
    UserDomainName: { get: () => 'MISTERALG' },
    OSVersion: { get: () => 'MisterALG 1.0' },
    Version: { get: () => '8.0.0' },
    CurrentDirectory: { get: () => '/programa', set: () => {} },
    Is64BitProcess: { get: () => true },
    Is64BitOperatingSystem: { get: () => true },
    ExitCode: { get: (m) => m.codigoSaida ?? 0, set: (m, v) => { m.codigoSaida = v } },
    StackTrace: { get: () => '' },
    CurrentManagedThreadId: { get: () => 1 },
  },
  estatico: {
    Exit(m, [c]) { throw new SaidaDoPrograma(comoNumero(c ?? 0)) },
    GetEnvironmentVariable: () => null,
    GetCommandLineArgs: () => new Arr('string', ['programa']),
    GetFolderPath: () => '/programa',
    FailFast(m, [msg]) { throw new SaidaDoPrograma(134, msg) },
  },
}

export class ThreadAtualCS {
  nomeCS() { return 'Thread' }
}
ThreadAtualCS.PROPS = {
  ManagedThreadId: { get: () => 1 },
  CurrentCulture: { get: (m) => new CulturaCS(m.cultura), set: (m, v) => { m.cultura = v.cultura } },
  CurrentUICulture: { get: (m) => new CulturaCS(m.cultura), set: () => {} },
  IsAlive: { get: () => true },
  Name: { get: () => 'Main', set: () => {} },
  IsBackground: { get: () => false, set: () => {} },
  Priority: { get: () => 2, set: () => {} },
}
ThreadAtualCS.METODOS = { Join: () => null, Start: () => null, Interrupt: () => null, Abort: () => null }

export const THREAD = {
  nome: 'Thread',
  criar: () => new ThreadAtualCS(),
  const: {},
  props: { CurrentThread: { get: () => new ThreadAtualCS() } },
  estatico: {
    Sleep(m, [ms]) {
      m.relogioExtra += ms instanceof Object && ms.ms !== undefined ? ms.ms : comoNumero(ms)
      return null
    },
    Yield: () => true,
    SpinWait: () => null,
  },
}

export const GC = {
  nome: 'GC',
  const: {},
  estatico: {
    Collect: () => null,
    GetTotalMemory: () => 1048576n,
    SuppressFinalize: () => null,
    WaitForPendingFinalizers: () => null,
    GetGeneration: () => 0,
    CollectionCount: () => 0,
  },
}

// ---- Task -------------------------------------------------------------------------------------------------------------

export class TarefaCS {
  constructor(resultado = null, excecao = null) {
    this.ehTarefa = true
    this.resultado = resultado
    this.excecao = excecao
  }

  nomeCS() { return 'Task' }

  paraTexto() { return 'System.Threading.Tasks.Task' }
}

const aggregate = (m, e) => new ExcecaoCS(m.criarObjetoExcecao('AggregateException', `One or more errors occurred. (${m.aTexto(e.valor.campos.get('_mensagem') ?? '')})`, e.valor))

TarefaCS.PROPS = {
  Result: { get: (m, t) => { if (t.excecao) throw aggregate(m, t.excecao); return t.resultado } },
  IsCompleted: { get: () => true },
  IsCompletedSuccessfully: { get: (m, t) => !t.excecao },
  IsFaulted: { get: (m, t) => !!t.excecao },
  IsCanceled: { get: () => false },
  Status: { get: (m, t) => (t.excecao ? 'Faulted' : 'RanToCompletion') },
  Exception: { get: (m, t) => (t.excecao ? m.criarObjetoExcecao('AggregateException', 'One or more errors occurred.', t.excecao.valor) : null) },
  Id: { get: () => 1 },
}
TarefaCS.METODOS = {
  Wait(m, t) { if (t.excecao) throw aggregate(m, t.excecao); return null },
  GetAwaiter: (m, t) => t,
  GetResult: (m, t) => { if (t.excecao) throw t.excecao; return t.resultado },
  ContinueWith: (m, t, [f]) => new TarefaCS(m.chamarFuncao(f, [t])),
  ConfigureAwait: (m, t) => t,
  Dispose: () => null,
}

export const TASK = {
  nome: 'Task',
  const: { CompletedTask: new TarefaCS() },
  estatico: {
    Delay(m, [ms]) {
      m.relogioExtra += ms && ms.ms !== undefined ? ms.ms : comoNumero(ms)
      return new TarefaCS()
    },
    Run(m, [f]) {
      try {
        const r = m.chamarFuncao(f, [])
        return r instanceof TarefaCS ? r : new TarefaCS(r ?? null)
      } catch (e) {
        if (e instanceof ExcecaoCS) return new TarefaCS(null, e)
        throw e
      }
    },
    FromResult: (m, [v]) => new TarefaCS(v),
    FromException: (m, [e]) => new TarefaCS(null, new ExcecaoCS(e)),
    WhenAll(m, args) {
      const tarefas = args.length === 1 && m.ehColecao(args[0]) ? [...m.iterarSync(args[0])] : args
      const falha = tarefas.find((t) => t.excecao)
      if (falha) return new TarefaCS(null, falha.excecao)
      return new TarefaCS(new Arr('object', tarefas.map((t) => t.resultado)))
    },
    WhenAny(m, args) {
      const tarefas = args.length === 1 && m.ehColecao(args[0]) ? [...m.iterarSync(args[0])] : args
      return new TarefaCS(tarefas[0])
    },
    Yield: () => new TarefaCS(),
  },
}

export function esperar(m, v) {
  if (v instanceof TarefaCS) {
    if (v.excecao) throw v.excecao
    return v.resultado
  }
  return v
}

// ---- Guid, Tuple, CultureInfo, Type ---------------------------------------------------------------------------------------

export class GuidCS {
  constructor(s) { this.s = s }

  nomeCS() { return 'Guid' }

  paraTexto(m, fmt) {
    if (fmt === 'N') return this.s.replace(/-/g, '')
    if (fmt === 'B') return `{${this.s}}`
    if (fmt === 'P') return `(${this.s})`
    return this.s
  }

  igualNativo(b) { return b instanceof GuidCS && b.s === this.s }

  hashNativo() { return `g${this.s}` }

  compararCom(b) { return this.s < b.s ? -1 : this.s > b.s ? 1 : 0 }
}
GuidCS.METODOS = {
  ToString: (m, g, [f]) => g.paraTexto(m, f),
  Equals: (m, g, [o]) => g.igualNativo(o),
  GetHashCode: () => 0,
  CompareTo: (m, g, [o]) => g.compararCom(o),
}
GuidCS.PROPS = {}

const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
export const GUID = {
  nome: 'Guid',
  const: { Empty: new GuidCS('00000000-0000-0000-0000-000000000000') },
  criar: (m, a) => new GuidCS(a[0] ?? '00000000-0000-0000-0000-000000000000'),
  estatico: {
    NewGuid: () => new GuidCS(`${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`),
    Parse(m, [s]) {
      if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(s)) throw m.excecao('FormatException', 'Unrecognized Guid format.')
      const d = s.replace(/-/g, '').toLowerCase()
      return new GuidCS(`${d.slice(0, 8)}-${d.slice(8, 12)}-${d.slice(12, 16)}-${d.slice(16, 20)}-${d.slice(20)}`)
    },
    TryParse(m, [s, saida]) {
      try {
        saida.v = GUID.estatico.Parse(m, [s])
        return true
      } catch {
        saida.v = GUID.const.Empty
        return false
      }
    },
  },
}

export const TUPLE = {
  nome: 'Tuple',
  const: {},
  estatico: { Create: (m, a) => new Tupla(a) },
}

export class CulturaCS {
  constructor(cultura) { this.ehCultura = true; this.cultura = cultura }

  nomeCS() { return 'CultureInfo' }

  paraTexto() { return this.cultura.nome }
}
CulturaCS.PROPS = {
  Name: { get: (m, c) => c.cultura.nome },
  DisplayName: { get: (m, c) => c.cultura.nome },
  NumberFormat: { get: (m, c) => new FormatoNumeroCS(c.cultura) },
  TwoLetterISOLanguageName: { get: (m, c) => (c.cultura.nome || 'iv').slice(0, 2) },
}
CulturaCS.METODOS = { ToString: (m, c) => c.cultura.nome, Equals: (m, c, [o]) => o?.cultura === c.cultura }

class FormatoNumeroCS {
  constructor(c) { this.c = c }
}
FormatoNumeroCS.PROPS = {
  NumberDecimalSeparator: { get: (m, f) => f.c.decimal },
  NumberGroupSeparator: { get: (m, f) => f.c.milhar },
  CurrencySymbol: { get: (m, f) => f.c.moeda },
}
FormatoNumeroCS.METODOS = {}

const culturaPorNome = (m, nome) => {
  const n = String(nome ?? '')
  if (n === '') return CULTURAS.invariant
  if (CULTURAS[n]) return CULTURAS[n]
  if (/^pt/i.test(n)) return CULTURAS['pt-BR']
  if (/^en/i.test(n)) return CULTURAS['en-US']
  throw m.excecao('ArgumentException', `Culture is not supported. (Parameter 'name')\n${n} is an invalid culture identifier.`)
}

export const CULTUREINFO = {
  nome: 'CultureInfo',
  const: {},
  criar: (m, [n]) => new CulturaCS(culturaPorNome(m, n)),
  props: {
    InvariantCulture: { get: () => new CulturaCS(CULTURAS.invariant) },
    CurrentCulture: { get: (m) => new CulturaCS(m.cultura), set: (m, v) => { m.cultura = v.cultura } },
    CurrentUICulture: { get: (m) => new CulturaCS(m.cultura), set: () => {} },
    DefaultThreadCurrentCulture: { get: (m) => new CulturaCS(m.cultura), set: (m, v) => { m.cultura = v.cultura } },
  },
  estatico: { GetCultureInfo: (m, [n]) => new CulturaCS(culturaPorNome(m, n)) },
}

// Encoding.UTF8/ASCII/Unicode (UTF-16LE)/BigEndianUnicode/UTF32/Latin1: GetBytes, GetString, GetByteCount, GetChars
const pontos = (s) => [...String(s)].map((c) => c.codePointAt(0))
const unidades = (s) => Array.from({ length: String(s).length }, (_, i) => String(s).charCodeAt(i)) // (um '?' por char de 16 bits, como o .NET)
const FFFD = 0xfffd
const ehSurrogato = (cp) => cp >= 0xd800 && cp <= 0xdfff
const unidades16 = (s, be) => {
  const r = []
  const u = String(s)
  for (let i = 0; i < u.length; i += 1) {
    let c = u.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && u.charCodeAt(i + 1) >= 0xdc00 && u.charCodeAt(i + 1) <= 0xdfff) { r.push(...par16(c, be)); i += 1; c = u.charCodeAt(i) }
    else if (ehSurrogato(c)) c = FFFD
    r.push(...par16(c, be))
  }
  return r
}
const par16 = (c, be) => (be ? [c >> 8, c & 255] : [c & 255, c >> 8])
const CODIFICACOES = {
  utf8: {
    classe: 'UTF8EncodingSealed', texto: 'System.Text.UTF8Encoding+UTF8EncodingSealed', web: 'utf-8', pagina: 65001, nome: 'Unicode (UTF-8)',
    codificar: (s) => [...new TextEncoder().encode(String(s))],
    decodificar: (b) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(Uint8Array.from(b)),
  },
  ascii: {
    classe: 'ASCIIEncodingSealed', texto: 'System.Text.ASCIIEncodingSealed', web: 'us-ascii', pagina: 20127, nome: 'US-ASCII',
    codificar: (s) => unidades(s).map((c) => (c < 128 ? c : 63)),
    decodificar: (b) => b.map((x) => (x < 128 ? String.fromCharCode(x) : '?')).join(''),
  },
  latin1: {
    classe: 'Latin1EncodingSealed', texto: 'System.Text.Latin1Encoding+Latin1EncodingSealed', web: 'iso-8859-1', pagina: 28591, nome: 'Western European (ISO)',
    codificar: (s) => unidades(s).map((c) => (c < 256 ? c : 63)),
    decodificar: (b) => b.map((x) => String.fromCharCode(x)).join(''),
  },
  utf16: {
    classe: 'UnicodeEncoding', texto: 'System.Text.UnicodeEncoding', web: 'utf-16', pagina: 1200, nome: 'Unicode',
    codificar: (s) => unidades16(s, false),
    decodificar: (b) => decodificar16(b, false),
  },
  utf16be: {
    classe: 'UnicodeEncoding', texto: 'System.Text.UnicodeEncoding', web: 'utf-16BE', pagina: 1201, nome: 'Unicode (Big-Endian)',
    codificar: (s) => unidades16(s, true),
    decodificar: (b) => decodificar16(b, true),
  },
  utf32: {
    classe: 'UTF32Encoding', texto: 'System.Text.UTF32Encoding', web: 'utf-32', pagina: 12000, nome: 'Unicode (UTF-32)',
    codificar: (s) => pontos(s).flatMap((c) => { const v = ehSurrogato(c) ? FFFD : c; return [v & 255, (v >> 8) & 255, (v >> 16) & 255, 0] }),
    decodificar(b) {
      let r = ''
      for (let i = 0; i + 4 <= b.length; i += 4) {
        const c = (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0
        r += c > 0x10ffff || ehSurrogato(c) ? '�' : String.fromCodePoint(c)
      }
      return b.length % 4 ? r + '�' : r
    },
  },
}
function decodificar16(b, be) {
  let r = ''
  for (let i = 0; i + 2 <= b.length; i += 2) r += String.fromCharCode(be ? (b[i] << 8) | b[i + 1] : (b[i + 1] << 8) | b[i])
  r = r.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '�')
  return b.length % 2 ? r + '�' : r
}
class CodificacaoCS {
  constructor(c) { this.c = c }

  nomeCS() { return this.c.classe }

  paraTexto() { return this.c.texto }
}
const doTexto = (m, s, ini, n) => {
  if (s === null || s === undefined) throw m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'chars')")
  const t = typeof s === 'string' ? s : s.itens.map((c) => String.fromCharCode(c.c)).join('')
  return ini === undefined ? t : t.slice(ini, ini + n)
}
const bytesDe = (m, a, ini, n) => {
  if (a === null || a === undefined) throw m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'bytes')")
  return (ini === undefined ? a.itens : a.itens.slice(ini, ini + n)).map((x) => comoNumero(x))
}
const paraArrayDeBytes = (m, lista) => m.bib.novoArray('byte', lista.map((b) => new Num('byte', b)))
CodificacaoCS.METODOS = {
  GetBytes: (m, e, [s, i, n]) => paraArrayDeBytes(m, e.c.codificar(doTexto(m, s, typeof s === 'string' ? undefined : i, n))),
  GetString: (m, e, [a, ini, n]) => e.c.decodificar(bytesDe(m, a, ini, n)),
  GetByteCount: (m, e, [s, i, n]) => e.c.codificar(doTexto(m, s, typeof s === 'string' ? undefined : i, n)).length,
  GetChars: (m, e, [a, ini, n]) => m.bib.novoArray('char', [...e.c.decodificar(bytesDe(m, a, ini, n))].map((c) => new Chr(c.charCodeAt(0)))),
  GetCharCount: (m, e, [a, ini, n]) => e.c.decodificar(bytesDe(m, a, ini, n)).length,
}
CodificacaoCS.PROPS = {
  WebName: { get: (m, e) => e.c.web },
  CodePage: { get: (m, e) => e.c.pagina },
  EncodingName: { get: (m, e) => e.c.nome },
}
const ENCODINGS = Object.fromEntries(Object.entries(CODIFICACOES).map(([k, c]) => [k, new CodificacaoCS(c)]))
const POR_NOME = { 'utf-8': 'utf8', utf8: 'utf8', 'us-ascii': 'ascii', ascii: 'ascii', 'iso-8859-1': 'latin1', latin1: 'latin1', 'utf-16': 'utf16', utf16: 'utf16', unicode: 'utf16', unicodefffe: 'utf16be', 'utf-16be': 'utf16be', 'utf-32': 'utf32', utf32: 'utf32' }
export const ENCODING = {
  nome: 'Encoding',
  const: {},
  props: {
    UTF8: { get: () => ENCODINGS.utf8 },
    ASCII: { get: () => ENCODINGS.ascii },
    Latin1: { get: () => ENCODINGS.latin1 },
    Unicode: { get: () => ENCODINGS.utf16 },
    BigEndianUnicode: { get: () => ENCODINGS.utf16be },
    UTF32: { get: () => ENCODINGS.utf32 },
    Default: { get: () => ENCODINGS.utf8 },
  },
  estatico: {
    GetEncoding(m, [n]) {
      const e = typeof n === 'string' ? ENCODINGS[POR_NOME[n.toLowerCase()]] : Object.values(ENCODINGS).find((x) => x.c.pagina === n)
      if (!e) throw m.excecao('ArgumentException', `${typeof n === 'string' ? `'${n}' is not a supported encoding name.` : `Encoding ${n} data could not be found.`}`)
      return e
    },
  },
}

// BitConverter: bytes em little-endian, como no .NET (x86/x64)
const TAMANHO = { byte: 1, sbyte: 1, short: 2, ushort: 2, int: 4, uint: 4, long: 8, ulong: 8, float: 4, double: 8, char: 2, bool: 1 }
function visao(n) { return new DataView(new ArrayBuffer(n)) }
function bytesDeValor(m, v) {
  if (typeof v === 'boolean') return [v ? 1 : 0]
  const k = typeof v === 'number' ? 'int' : typeof v === 'bigint' ? 'long' : v instanceof Dbl ? 'double' : v instanceof Chr ? 'char' : v instanceof Num ? v.k : v instanceof Flt ? 'float' : null
  if (!k) throw new ErroCS(`BitConverter.GetBytes não aceita ${m.nomeDoTipoDe(v)}`, m.linhaAtual)
  const d = visao(TAMANHO[k])
  const n = v instanceof Dbl || v instanceof Num || v instanceof Chr || v instanceof Flt ? (v.v ?? v.c) : v
  switch (k) {
    case 'sbyte': d.setInt8(0, n); break
    case 'byte': d.setUint8(0, n); break
    case 'short': d.setInt16(0, n, true); break
    case 'ushort': d.setUint16(0, n, true); break
    case 'char': d.setUint16(0, n, true); break
    case 'int': d.setInt32(0, n, true); break
    case 'uint': d.setUint32(0, n, true); break
    case 'long': d.setBigInt64(0, n, true); break
    case 'ulong': d.setBigUint64(0, n, true); break
    case 'float': d.setFloat32(0, n, true); break
    default: d.setFloat64(0, n, true)
  }
  return [...new Uint8Array(d.buffer)]
}
function lerBytes(m, a, ini, tipo) {
  if (a === null || a === undefined) throw m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'value')")
  const t = a.itens.length
  const tam = TAMANHO[tipo]
  if (ini < 0 || ini >= t) throw m.excecao('ArgumentOutOfRangeException', "Index was out of range. Must be non-negative and less than the size of the collection. (Parameter 'startIndex')")
  if (ini > t - tam) throw m.excecao('ArgumentException', 'Destination array is not long enough to copy all the items in the collection. Check array index and length.')
  const d = visao(tam)
  for (let i = 0; i < tam; i += 1) d.setUint8(i, comoNumero(a.itens[ini + i]))
  return d
}
const hex2 = (b) => b.toString(16).padStart(2, '0').toUpperCase()
export const BITCONVERTER = {
  nome: 'BitConverter',
  const: { IsLittleEndian: true },
  estatico: {
    GetBytes: (m, [v]) => paraArrayDeBytes(m, bytesDeValor(m, v)),
    ToInt32: (m, [a, i = 0]) => lerBytes(m, a, i, 'int').getInt32(0, true),
    ToInt64: (m, [a, i = 0]) => lerBytes(m, a, i, 'long').getBigInt64(0, true),
    ToInt16: (m, [a, i = 0]) => new Num('short', lerBytes(m, a, i, 'short').getInt16(0, true)),
    ToUInt16: (m, [a, i = 0]) => new Num('ushort', lerBytes(m, a, i, 'ushort').getUint16(0, true)),
    ToUInt32: (m, [a, i = 0]) => new Num('uint', lerBytes(m, a, i, 'uint').getUint32(0, true)),
    ToUInt64: (m, [a, i = 0]) => new Num('ulong', lerBytes(m, a, i, 'ulong').getBigUint64(0, true)),
    ToSingle: (m, [a, i = 0]) => new Flt(lerBytes(m, a, i, 'float').getFloat32(0, true)),
    ToDouble: (m, [a, i = 0]) => new Dbl(lerBytes(m, a, i, 'double').getFloat64(0, true)),
    ToBoolean: (m, [a, i = 0]) => lerBytes(m, a, i, 'bool').getUint8(0) !== 0,
    ToChar: (m, [a, i = 0]) => new Chr(lerBytes(m, a, i, 'char').getUint16(0, true)),
    DoubleToInt64Bits(m, [v]) { const d = visao(8); d.setFloat64(0, comoNumero(v)); return d.getBigInt64(0) },
    Int64BitsToDouble(m, [v]) { const d = visao(8); d.setBigInt64(0, BigInt(v)); return new Dbl(d.getFloat64(0)) },
    SingleToInt32Bits(m, [v]) { const d = visao(4); d.setFloat32(0, comoNumero(v)); return d.getInt32(0) },
    Int32BitsToSingle(m, [v]) { const d = visao(4); d.setInt32(0, v); return new Flt(d.getFloat32(0)) },
    ToString(m, [a, ini = 0, n]) {
      if (a === null || a === undefined) throw m.excecao('ArgumentNullException', "Value cannot be null. (Parameter 'value')")
      if (ini < 0 || ini > a.itens.length || (ini === a.itens.length && a.itens.length > 0)) throw m.excecao('ArgumentOutOfRangeException', "Index was out of range. Must be non-negative and less than the size of the collection. (Parameter 'startIndex')")
      const fim = n === undefined ? a.itens.length : ini + n
      if (n !== undefined && (n < 0 || fim > a.itens.length)) throw m.excecao('ArgumentOutOfRangeException', 'Index and length must refer to a location within the string. (Parameter \'length\')')
      return a.itens.slice(ini, fim).map((x) => hex2(comoNumero(x))).join('-')
    },
  },
}

// typeof(X) e x.GetType()
export class TipoCS {
  constructor(nome) { this.t = nome }

  nomeCS() { return 'Type' }

  paraTexto(m) { return this.completo(m) }

  completo(m) {
    const def = m.buscarClasse(this.t)
    return def ? def.nomeCompleto : nomeCompleto(this.t)
  }

  igualNativo(b) { return b instanceof TipoCS && b.t === this.t }

  hashNativo() { return `T${this.t}` }
}
const SIMPLES = { int: 'Int32', long: 'Int64', short: 'Int16', byte: 'Byte', sbyte: 'SByte', ushort: 'UInt16', uint: 'UInt32', ulong: 'UInt64', double: 'Double', float: 'Single', decimal: 'Decimal', bool: 'Boolean', char: 'Char', string: 'String', object: 'Object' }
TipoCS.PROPS = {
  Name: {
    get: (m, t) => {
      const nome = (x) => {
        const arr = /(\[,*\])+$/.exec(x) // int[] → Int32[]
        if (arr) return nome(x.slice(0, -arr[0].length)) + arr[0]
        return SIMPLES[x] ?? m.buscarClasse(x)?.nome ?? x.replace(/<.*>$/, (g) => `\`${g.split(',').length}`)
      }
      return nome(semNulo(t.t))
    },
  },
  FullName: { get: (m, t) => t.completo(m) },
  Namespace: { get: (m, t) => m.buscarClasse(t.t)?.ns ?? (SIMPLES[t.t] ? 'System' : null) },
  IsClass: { get: (m, t) => { const d = m.buscarClasse(t.t); return d ? d.tipo === 'class' || d.tipo === 'record' : t.t === 'string' || t.t === 'object' } },
  IsValueType: { get: (m, t) => { const d = m.buscarClasse(t.t); return d ? d.ehTipoValor : !['string', 'object'].includes(t.t) } },
  IsEnum: { get: (m, t) => m.buscarClasse(t.t)?.tipo === 'enum' },
  IsInterface: { get: (m, t) => m.buscarClasse(t.t)?.tipo === 'interface' },
  IsAbstract: { get: (m, t) => !!m.buscarClasse(t.t)?.ehAbstrata },
  IsArray: { get: (m, t) => /\[,*\]$/.test(t.t) },
  BaseType: { get: (m, t) => { const b = m.buscarClasse(t.t)?.base; return b ? new TipoCS(b.nome) : new TipoCS('object') } },
}
TipoCS.METODOS = {
  ToString: (m, t) => t.completo(m),
  Equals: (m, t, [o]) => t.igualNativo(o),
  GetHashCode: () => 0,
  IsAssignableFrom: (m, t, [o]) => { const a = m.buscarClasse(t.t); const b = m.buscarClasse(o.t); return a && b ? b.deriva(a) : t.t === o.t },
  IsSubclassOf: (m, t, [o]) => { const a = m.buscarClasse(t.t); const b = m.buscarClasse(o.t); return !!a && !!b && a !== b && a.deriva(b) },
  GetProperties: (m, t) => new Arr('object', [...(m.buscarClasse(t.t)?.propriedades.values() ?? [])].map((p) => new InfoCS(p.nome, p.tipo))),
  GetFields: (m, t) => new Arr('object', (m.buscarClasse(t.t)?.campos ?? []).map((p) => new InfoCS(p.nome, p.tipo))),
  GetMethods: (m, t) => new Arr('object', [...(m.buscarClasse(t.t)?.metodos.keys() ?? [])].map((n) => new InfoCS(n, 'object'))),
  GetEnumNames: (m, t) => new Arr('string', [...(m.buscarClasse(t.t)?.membrosEnum.keys() ?? [])]),
}

class InfoCS {
  constructor(nome, tipo) { this.nome = nome; this.tipo = tipo }

  nomeCS() { return 'PropertyInfo' }

  paraTexto() { return this.nome }
}
InfoCS.PROPS = {
  Name: { get: (m, i) => i.nome },
  PropertyType: { get: (m, i) => new TipoCS(i.tipo) },
  FieldType: { get: (m, i) => new TipoCS(i.tipo) },
}
InfoCS.METODOS = {
  GetValue: (m, i, [o]) => m.rodarSync(m.lerMembro(o, i.nome)),
  SetValue: (m, i, [o, v]) => { o.campos.set(i.nome, v); return null },
}

export const ENUM = {
  nome: 'Enum',
  const: {},
  estatico: {
    GetValues(m, [tipo]) {
      const def = m.buscarClasse(tipo.t)
      return new Arr(def.nome, [...def.membrosEnum.values()])
    },
    GetNames: (m, [tipo]) => new Arr('string', [...m.buscarClasse(tipo.t).membrosEnum.keys()]),
    GetName: (m, [tipo, v]) => m.buscarClasse(tipo.t).valorDe(comoNumero(v)).nome,
    IsDefined(m, [tipo, v]) {
      const def = m.buscarClasse(tipo.t)
      return typeof v === 'string' ? def.membrosEnum.has(v) : [...def.membrosEnum.values()].some((x) => x.v === comoNumero(v))
    },
    Parse(m, [tipo, s, ignorar], targs) {
      const def = m.buscarClasse(tipo?.t ?? targs?.[0])
      const alvo = String(s).trim()
      const partes = alvo.split(',').map((x) => x.trim())
      let v = 0
      for (const p of partes) {
        const ach = [...def.membrosEnum.values()].find((x) => (ignorar === true ? x.nome.toLowerCase() === p.toLowerCase() : x.nome === p))
        if (ach) v |= ach.v
        else if (/^-?\d+$/.test(p)) v |= Number(p)
        else throw m.excecao('ArgumentException', `Requested value '${s}' was not found.`)
      }
      return def.valorDe(v)
    },
    TryParse(m, args, targs) {
      const saida = args[args.length - 1]
      try {
        const alvo = args.length === 4 || (args.length === 3 && !(args[1] instanceof Ref)) ? args : args
        saida.v = ENUM.estatico.Parse(m, [targs?.[0] ? { t: targs[0] } : args[0], typeof args[0] === 'string' ? args[0] : args[1], args.length > 2 && args[1] === true ? true : false], targs)
        void alvo
        return true
      } catch {
        saida.v = null
        return false
      }
    },
  },
}

// ---- BigInteger ---------------------------------------------------------------------------------------------------------

export class BigCS {
  constructor(v) { this.v = v }

  nomeCS() { return 'BigInteger' }

  paraTexto() { return this.v.toString() }

  operarNativo(m, op, b, esquerda) {
    const o = b instanceof BigCS ? b.v : ehNumero(b) ? BigInt(Math.trunc(comoNumero(b))) : null
    if (o === null) return undefined
    const x = esquerda ? this.v : o
    const y = esquerda ? o : this.v
    switch (op) {
      case '+': return new BigCS(x + y)
      case '-': return new BigCS(x - y)
      case '*': return new BigCS(x * y)
      case '/': if (y === 0n) throw m.excecao('DivideByZeroException', 'Attempted to divide by zero.'); return new BigCS(x / y)
      case '%': if (y === 0n) throw m.excecao('DivideByZeroException', 'Attempted to divide by zero.'); return new BigCS(x % y)
      case '<': return x < y
      case '>': return x > y
      case '<=': return x <= y
      case '>=': return x >= y
      case '==': return x === y
      case '!=': return x !== y
      case '&': return new BigCS(x & y)
      case '|': return new BigCS(x | y)
      case '^': return new BigCS(x ^ y)
      case '<<': return new BigCS(x << y)
      case '>>': return new BigCS(x >> y)
      default: return undefined
    }
  }

  igualNativo(b) { return (b instanceof BigCS && b.v === this.v) || (ehNumero(b) && BigInt(Math.trunc(comoNumero(b))) === this.v) }

  hashNativo() { return `i${this.v}` }

  compararCom(b) { const o = b instanceof BigCS ? b.v : BigInt(comoNumero(b)); return this.v < o ? -1 : this.v > o ? 1 : 0 }

  aNumeroNativo() { return this.v }
}
BigCS.PROPS = {
  IsZero: { get: (m, b) => b.v === 0n },
  IsOne: { get: (m, b) => b.v === 1n },
  IsEven: { get: (m, b) => b.v % 2n === 0n },
  Sign: { get: (m, b) => (b.v < 0n ? -1 : b.v > 0n ? 1 : 0) },
}
BigCS.METODOS = {
  ToString: (m, b, [f]) => (typeof f === 'string' && /^[Xx]/.test(f) ? (b.v < 0n ? -b.v : b.v).toString(16) : b.v.toString()),
  CompareTo: (m, b, [o]) => b.compararCom(o),
  Equals: (m, b, [o]) => b.igualNativo(o),
  GetHashCode: () => 0,
}
const big = (v) => (v instanceof BigCS ? v.v : BigInt(typeof v === 'string' ? v : Math.trunc(comoNumero(v))))
export const BIGINTEGER = {
  nome: 'BigInteger',
  criar: (m, [v]) => new BigCS(v === undefined ? 0n : big(v)),
  const: { Zero: new BigCS(0n), One: new BigCS(1n), MinusOne: new BigCS(-1n) },
  estatico: {
    Parse(m, [s]) {
      if (!/^\s*[+-]?\d+\s*$/.test(String(s))) throw m.excecao('FormatException', 'The value could not be parsed.')
      return new BigCS(BigInt(String(s).trim()))
    },
    TryParse(m, [s, saida]) {
      if (!/^\s*[+-]?\d+\s*$/.test(String(s))) { saida.v = new BigCS(0n); return false }
      saida.v = new BigCS(BigInt(String(s).trim()))
      return true
    },
    Pow: (m, [a, n]) => new BigCS(big(a) ** BigInt(n)),
    Abs: (m, [a]) => new BigCS(big(a) < 0n ? -big(a) : big(a)),
    Add: (m, [a, b]) => new BigCS(big(a) + big(b)),
    Subtract: (m, [a, b]) => new BigCS(big(a) - big(b)),
    Multiply: (m, [a, b]) => new BigCS(big(a) * big(b)),
    Divide: (m, [a, b]) => new BigCS(big(a) / big(b)),
    Remainder: (m, [a, b]) => new BigCS(big(a) % big(b)),
    Negate: (m, [a]) => new BigCS(-big(a)),
    Max: (m, [a, b]) => (big(a) >= big(b) ? a : b),
    Min: (m, [a, b]) => (big(a) <= big(b) ? a : b),
    GreatestCommonDivisor(m, [a, b]) {
      let x = big(a) < 0n ? -big(a) : big(a)
      let y = big(b) < 0n ? -big(b) : big(b)
      while (y) [x, y] = [y, x % y]
      return new BigCS(x)
    },
    ModPow(m, [a, e, mod]) {
      let r = 1n
      let base = big(a) % big(mod)
      let exp = big(e)
      while (exp > 0n) {
        if (exp & 1n) r = (r * base) % big(mod)
        base = (base * base) % big(mod)
        exp >>= 1n
      }
      return new BigCS(r)
    },
    Log10: (m, [a]) => new Dbl(Math.log10(Number(big(a)))),
  },
}

// ---- arquivos em memória (File, Directory, Path, StreamReader, StreamWriter) ------------------------------------------------------

const caminho = (p) => String(p).replace(/\\/g, '/')
const arq = (m) => (m.arquivos ??= new Map())

const naoAchou = (m, p) => m.excecao('FileNotFoundException', `Could not find file '${caminho(p)}'. (O MisterALG roda os programas numa pasta virtual: crie o arquivo antes de ler, com File.WriteAllText ou StreamWriter.)`)
const lerArq = (m, p) => {
  const t = arq(m).get(caminho(p))
  if (t === undefined) throw naoAchou(m, p)
  return t
}

export const FILE = {
  nome: 'File',
  const: {},
  estatico: {
    Exists: (m, [p]) => arq(m).has(caminho(p)),
    ReadAllText: (m, [p]) => lerArq(m, p),
    WriteAllText: (m, [p, t]) => { arq(m).set(caminho(p), m.aTexto(t)); return null },
    AppendAllText: (m, [p, t]) => { arq(m).set(caminho(p), (arq(m).get(caminho(p)) ?? '') + m.aTexto(t)); return null },
    ReadAllLines: (m, [p]) => new Arr('string', lerArq(m, p).split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === ''))),
    ReadLines: (m, [p]) => new SeqCS(() => lerArq(m, p).split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === ''))[Symbol.iterator](), 'string'),
    WriteAllLines: (m, [p, linhas]) => { arq(m).set(caminho(p), `${[...m.iterarSync(linhas)].map((x) => m.aTexto(x)).join('\n')}\n`); return null },
    AppendAllLines: (m, [p, linhas]) => { arq(m).set(caminho(p), `${arq(m).get(caminho(p)) ?? ''}${[...m.iterarSync(linhas)].map((x) => m.aTexto(x)).join('\n')}\n`); return null },
    Delete: (m, [p]) => { arq(m).delete(caminho(p)); return null },
    Copy: (m, [a, b]) => { arq(m).set(caminho(b), lerArq(m, a)); return null },
    Move: (m, [a, b]) => { arq(m).set(caminho(b), lerArq(m, a)); arq(m).delete(caminho(a)); return null },
    Create: (m, [p]) => { arq(m).set(caminho(p), ''); return new EscritorCS(m, caminho(p)) },
  },
}

export const DIRECTORY = {
  nome: 'Directory',
  const: {},
  estatico: {
    Exists: (m, [p]) => caminho(p) === '.' || caminho(p) === '/' || [...arq(m).keys()].some((k) => k.startsWith(`${caminho(p).replace(/\/$/, '')}/`)),
    CreateDirectory: () => null,
    GetFiles: (m, [p]) => new Arr('string', [...arq(m).keys()].filter((k) => k.startsWith(`${caminho(p).replace(/\/$/, '')}/`) || caminho(p) === '.')),
    GetCurrentDirectory: () => '/programa',
    Delete: () => null,
  },
}

export const PATH = {
  nome: 'Path',
  const: { DirectorySeparatorChar: new Chr(47), AltDirectorySeparatorChar: new Chr(92), PathSeparator: new Chr(59) },
  estatico: {
    Combine: (m, a) => a.map(caminho).join('/').replace(/\/+/g, '/'),
    GetFileName: (m, [p]) => caminho(p).split('/').pop(),
    GetFileNameWithoutExtension: (m, [p]) => caminho(p).split('/').pop().replace(/\.[^.]*$/, ''),
    GetExtension: (m, [p]) => /\.[^./]*$/.exec(caminho(p))?.[0] ?? '',
    GetDirectoryName: (m, [p]) => caminho(p).split('/').slice(0, -1).join('/'),
    GetFullPath: (m, [p]) => `/programa/${caminho(p)}`,
    GetTempPath: () => '/tmp/',
    GetRandomFileName: () => `${hex(8)}.tmp`,
    ChangeExtension: (m, [p, e]) => caminho(p).replace(/\.[^./]*$/, '') + (e ? (e.startsWith('.') ? e : `.${e}`) : ''),
    IsPathRooted: (m, [p]) => caminho(p).startsWith('/'),
  },
}

export class EscritorCS {
  constructor(m, p, anexar = false) {
    this.p = caminho(p)
    if (!anexar) arq(m).set(this.p, '')
    else if (!arq(m).has(this.p)) arq(m).set(this.p, '')
    this.fechado = false
  }

  nomeCS() { return 'StreamWriter' }

  Dispose() { this.fechado = true }
}
EscritorCS.METODOS = {
  WriteLine(m, o, a) { arq(m).set(o.p, `${arq(m).get(o.p) ?? ''}${texto(m, a)}\n`); return null },
  Write(m, o, a) { arq(m).set(o.p, (arq(m).get(o.p) ?? '') + texto(m, a)); return null },
  Flush: () => null,
  Close(m, o) { o.fechado = true; return null },
  Dispose(m, o) { o.fechado = true; return null },
}
EscritorCS.PROPS = { AutoFlush: { get: () => true, set: () => {} } }

export class LeitorCS {
  constructor(m, p) {
    this.linhas = lerArq(m, p).split(/\r?\n/)
    if (this.linhas[this.linhas.length - 1] === '') this.linhas.pop()
    this.i = 0
  }

  nomeCS() { return 'StreamReader' }

  Dispose() {}
}
LeitorCS.METODOS = {
  ReadLine(m, o) { return o.i < o.linhas.length ? o.linhas[o.i++] : null },
  ReadToEnd(m, o) { const r = o.linhas.slice(o.i).join('\n'); o.i = o.linhas.length; return r },
  Peek: (m, o) => (o.i < o.linhas.length ? o.linhas[o.i].charCodeAt(0) || 10 : -1),
  Read: (m, o) => (o.i < o.linhas.length ? o.linhas[o.i++].charCodeAt(0) : -1),
  Close: () => null,
  Dispose: () => null,
}
LeitorCS.PROPS = { EndOfStream: { get: (m, o) => o.i >= o.linhas.length } }

export const STREAMWRITER = { nome: 'StreamWriter', criar: (m, [p, anexar]) => new EscritorCS(m, p, anexar === true), const: {}, estatico: {} }
export const STREAMREADER = { nome: 'StreamReader', criar: (m, [p]) => new LeitorCS(m, p), const: {}, estatico: {} }

export { Multicast, Num, Objeto, ValorEnum, converterNumero, ListaCS }
