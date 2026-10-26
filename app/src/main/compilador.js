// Worker que mantém o clang (WebAssembly, @yowasp/clang) carregado entre uma
// compilação e outra: a primeira demora uns segundos, as seguintes bem menos.
// Roda fora do Electron (worker_threads): não importa nada de 'electron'.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parentPort, workerData } from 'node:worker_threads'
import { ARGUMENTOS_AST_C, CABECALHOS_C } from '@misteralg/interpretador-c/cabecalhos'
import { ARGUMENTOS_AST_CPP, CABECALHOS_CPP, cabecalhosCppPara } from '@misteralg/interpretador-c/cabecalhos-cpp'
import { LIB_EXCECOES } from './excecoes-wasm.js'

const LIB_EXCECOES_BYTES = Uint8Array.from(Buffer.from(LIB_EXCECOES, 'base64'))

const { runClang } = await import(workerData.clang)

// Runtime do MisterALG, ligado a todo programa: a saída aparece na hora (sem buffer),
// e system("pause"/"cls"), conio.h e Sleep() funcionam como no Windows, porque os
// cursos de programação no Brasil usam muito.
// No C++ ele é compilado como C++ (o -std=c++20 não vale para arquivos C), daí o extern "C".
const RUNTIME = `#include <stdio.h>
#include <stdio_ext.h>
#include <string.h>
#include <ctype.h>
#include <unistd.h>
#ifdef __cplusplus
extern "C" {
#endif

__attribute__((constructor)) static void misteralg_iniciar(void) { setvbuf(stdout, NULL, _IONBF, 0); }

/* O Enter do último scanf/cin fica no buffer; o pause e o getch do Windows não o veem. */
static void descartar_pendente(void) { while (__freadahead(stdin) > 0) getchar(); }

int system(const char *comando) {
  char c[16];
  size_t i = 0;
  if (!comando) return 0;
  while (comando[i] && i < sizeof c - 1) { c[i] = (char)tolower((unsigned char)comando[i]); i++; }
  c[i] = 0;
  if (!strcmp(c, "cls") || !strcmp(c, "clear")) { fputc('\\f', stdout); return 0; }
  if (!strcmp(c, "pause")) {
    int ch;
    descartar_pendente();
    fputs("Pressione Enter para continuar. . . ", stdout);
    while ((ch = getchar()) != '\\n' && ch != EOF) {}
    return 0;
  }
  if (!strncmp(c, "chcp", 4) || !strncmp(c, "color", 5)) return 0;
  return -1;
}

int getch(void) {
  int ch, resto;
  descartar_pendente();
  ch = getchar();
  if (ch != '\\n') while ((resto = getchar()) != '\\n' && resto != EOF) {}
  return ch;
}
int getche(void) { return getch(); }
int kbhit(void) { return __freadahead(stdin) > 0; }
void clrscr(void) { fputc('\\f', stdout); }
void Sleep(unsigned long ms) { usleep((useconds_t)(ms * 1000)); }
int SetConsoleOutputCP(unsigned int cp) { (void)cp; return 1; }
int SetConsoleCP(unsigned int cp) { (void)cp; return 1; }
#ifdef __cplusplus
}
#endif
`

const CABECALHO = (corpo) => `#pragma once
#ifdef __cplusplus
extern "C" {
#endif
${corpo}
#ifdef __cplusplus
}
#endif
`
const INCLUIR = {
  'conio.h': CABECALHO('int getch(void);\nint getche(void);\nint kbhit(void);\nvoid clrscr(void);'),
  'windows.h': CABECALHO('#define CP_UTF8 65001\nvoid Sleep(unsigned long ms);\nint SetConsoleOutputCP(unsigned int cp);\nint SetConsoleCP(unsigned int cp);'),
  // stdlib.h do WASI não declara system(); este cabeçalho entra em todo programa (-include).
  'misteralg.h': CABECALHO('int system(const char *comando);'),
  // <bits/stdc++.h> é do g++ (muito usado em maratona); o libc++ não tem, então este inclui a biblioteca toda
  bits: {
    'stdc++.h': `#pragma once\n${['cassert', 'cctype', 'cfloat', 'climits', 'cmath', 'cstdio', 'cstdlib', 'cstring', 'ctime', 'cstdint',
      'algorithm', 'array', 'bitset', 'chrono', 'complex', 'deque', 'exception', 'fstream', 'functional', 'iomanip', 'iostream',
      'iterator', 'limits', 'list', 'map', 'memory', 'numeric', 'optional', 'queue', 'random', 'set', 'sstream', 'stack', 'stdexcept',
      'string', 'string_view', 'tuple', 'unordered_map', 'unordered_set', 'utility', 'variant', 'vector'].map((c) => `#include <${c}>`).join('\n')}\n`,
  },
}

const FLAGS_CPP = ['-std=c++20', '-fwasm-exceptions', '-O1', '-fno-color-diagnostics', '-I', 'misteralg']

async function clang(args, arquivos) {
  const decodificador = new TextDecoder()
  let mensagens = ''
  try {
    const r = await runClang(args, arquivos, {
      stdout: null,
      fetchProgress: () => {}, // sem "yowasp-llvm: fetched…" no terminal
      stderr: (bytes) => { if (bytes) mensagens += decodificador.decode(bytes, { stream: true }) },
    })
    return { saidas: r, mensagens }
  } catch (e) {
    return { erros: mensagens || String(e.message) }
  }
}

// ---- cabeçalho pré-compilado (PCH) do C++ ---------------------------------------------
// Quase todo o tempo de compilar C++ vai nos cabeçalhos (<iostream>...). O PCH dos #include
// do começo do programa deixa as compilações seguintes ~5x mais rápidas. Vale só para
// exatamente os mesmos #include, no começo do arquivo, então o programa compila igual.
// Os PCH ficam no disco: os do instalador (resources/pch, de scripts/gerar-pch.mjs: <iostream> e
// <bits/stdc++.h>) e os que o app gera, na pasta de dados (o próximo F9 com esses #include, mesmo
// depois de fechar o app, já não espera). Na memória ficam só os últimos usados (~17 MB cada).
const pchs = new Map() // prefixo de #include → { pch (bytes, ou null se ainda só no disco), cabecalho, caminho }
const MAX_PCHS = 3
const MAX_PCHS_NO_DISCO = 8
// [pastas só de leitura..., a pasta onde o app grava (a última)]
const PASTAS_PCH = workerData.pastasPch ?? []
const PASTA_GRAVAVEL = workerData.pchGravavel === false ? null : PASTAS_PCH[PASTAS_PCH.length - 1]
// Um PCH só serve para o mesmo clang, as mesmas opções e os mesmos cabeçalhos do MisterALG: tudo entra no nome do arquivo.
const VERSAO_PCH = createHash('sha1').update(readFileSync(fileURLToPath(workerData.clang))).update(JSON.stringify([FLAGS_CPP, INCLUIR])).digest('hex')
const nomeDoPch = (prefixo) => createHash('sha1').update(`${VERSAO_PCH}\n${prefixo}`).digest('hex').slice(0, 24)

/** Os PCH já gravados (o prefixo de #include fica num .txt do lado; o nome confere a versão). */
function lerPchsDoDisco() {
  for (const pasta of PASTAS_PCH) {
    let arquivos = []
    try { arquivos = readdirSync(pasta) } catch { continue }
    for (const txt of arquivos.filter((a) => a.endsWith('.txt'))) {
      try {
        const prefixo = readFileSync(join(pasta, txt), 'utf8')
        const nome = txt.slice(0, -4)
        if (nome !== nomeDoPch(prefixo) || !existsSync(join(pasta, `${nome}.pch`)) || pchs.has(prefixo)) continue
        pchs.set(prefixo, { pch: null, cabecalho: `#include "misteralg.h"\n${prefixo}\n`, caminho: join(pasta, `${nome}.pch`) })
      } catch { /* arquivo pela metade: fica para trás */ }
    }
  }
}
lerPchsDoDisco()

function gravarPch(prefixo, pch) {
  if (!PASTA_GRAVAVEL) return null
  try {
    mkdirSync(PASTA_GRAVAVEL, { recursive: true })
    const nome = nomeDoPch(prefixo)
    const caminho = join(PASTA_GRAVAVEL, `${nome}.pch`)
    writeFileSync(`${caminho}.tmp`, pch)
    renameSync(`${caminho}.tmp`, caminho)
    writeFileSync(join(PASTA_GRAVAVEL, `${nome}.txt`), prefixo)
    // os mais antigos (pela data do último uso) saem
    const antigos = readdirSync(PASTA_GRAVAVEL).filter((a) => a.endsWith('.pch'))
      .map((a) => ({ a, t: statSync(join(PASTA_GRAVAVEL, a)).mtimeMs })).sort((x, y) => y.t - x.t).slice(MAX_PCHS_NO_DISCO)
    for (const { a } of antigos) for (const ext of ['.pch', '.txt']) { try { unlinkSync(join(PASTA_GRAVAVEL, a.replace(/\.pch$/, ext))) } catch { /* já foi */ } }
    return caminho
  } catch {
    return null // sem disco (pasta só de leitura, cheia...): fica só na memória
  }
}

/** Os bytes do PCH (lidos do disco se preciso); só os MAX_PCHS últimos ficam na memória. */
function bytesDoPch(prefixo) {
  const p = pchs.get(prefixo)
  if (!p.pch) {
    try { p.pch = readFileSync(p.caminho) } catch { pchs.delete(prefixo); return null }
  }
  if (p.caminho) { try { utimesSync(p.caminho, new Date(), new Date()) } catch { /* só leitura */ } }
  pchs.delete(prefixo) // vai para o fim (o mais recente)
  pchs.set(prefixo, p)
  const naMemoria = [...pchs.entries()].filter(([, x]) => x.pch)
  for (const [k, x] of naMemoria.slice(0, Math.max(0, naMemoria.length - MAX_PCHS))) {
    if (x.caminho) x.pch = null // continua no disco
    else pchs.delete(k)
  }
  return p.pch
}

/** Os "#include <...>" do começo do programa (antes de qualquer outra coisa que não seja comentário). */
export function prefixoDeIncludes(fonte) {
  const sem = fonte.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const includes = []
  for (const linha of sem.split('\n')) {
    const l = linha.replace(/\/\/.*$/, '').trim()
    if (!l) continue
    const m = /^#\s*include\s*<([^>]+)>$/.exec(l)
    if (!m) break
    includes.push(`#include <${m[1]}>`)
  }
  return includes.join('\n')
}

async function gerarPch(prefixo) {
  if (!prefixo || pchs.has(prefixo)) return null
  const cabecalho = `#include "misteralg.h"\n${prefixo}\n`
  const r = await clang(['clang++', ...FLAGS_CPP, '-x', 'c++-header', 'pre.hpp', '-o', 'pre.hpp.pch'], { 'pre.hpp': cabecalho, misteralg: INCLUIR })
  if (r.erros !== undefined) return null // um #include que não existe: o F9 mostra o erro normalmente
  const pch = r.saidas['pre.hpp.pch']
  pchs.set(prefixo, { pch, cabecalho, caminho: gravarPch(prefixo, pch) })
  bytesDoPch(prefixo) // (tira da memória os mais antigos)
  return pchs.get(prefixo).caminho
}

async function compilar(linguagem, fonte) {
  const cpp = linguagem === 'cpp'
  const [principal, runtime] = cpp ? ['programa.cpp', 'misteralg_rt.cpp'] : ['programa.c', 'misteralg_rt.c']
  const entradas = ['-o', 'programa.wasm', runtime, principal]
  const arquivos = { [principal]: fonte, [runtime]: RUNTIME, misteralg: INCLUIR }
  if (!cpp) {
    const r = await clang(['clang', '-std=gnu17', '-O1', '-fno-color-diagnostics', '-I', 'misteralg', '-include', 'misteralg.h', ...entradas], arquivos)
    return r.erros !== undefined ? r : { wasm: r.saidas['programa.wasm'], avisos: r.mensagens }
  }
  // C++: exceções do WebAssembly; a parte da libc++abi que falta no sysroot vem em libexcecoes.a (excecoes-wasm.js).
  arquivos['libexcecoes.a'] = LIB_EXCECOES_BYTES
  const prefixo = prefixoDeIncludes(fonte)
  // Serve o PCH cujos #include são o começo dos do programa (o PCH de <iostream> serve para <iostream> + <vector>).
  const chave = [...pchs.keys()].filter((k) => prefixo === k || prefixo.startsWith(`${k}\n`)).sort((a, b) => b.length - a.length)[0]
  const pre = chave && pchs.get(chave)
  const bytes = pre && bytesDoPch(chave)
  if (bytes) {
    const r = await clang(['clang++', ...FLAGS_CPP, '-include-pch', 'pre.hpp.pch', ...entradas, 'libexcecoes.a'],
      { ...arquivos, 'pre.hpp.pch': bytes, 'pre.hpp': pre.cabecalho })
    if (r.erros !== undefined && /precompiled|\.pch/i.test(r.erros)) { // PCH que não serviu: compila do jeito normal
      pchs.delete(chave)
      if (pre.caminho?.startsWith(PASTA_GRAVAVEL ?? '\0')) { try { unlinkSync(pre.caminho) } catch { /* já foi */ } }
    }
    else {
      if (chave !== prefixo && r.erros === undefined) pendentes.add(prefixo) // na próxima, o PCH com todos os #include
      return r.erros !== undefined ? r : { wasm: r.saidas['programa.wasm'], avisos: r.mensagens, comPch: true } // erro do programa: igual sem o PCH
    }
  }
  const r = await clang(['clang++', ...FLAGS_CPP, '-include', 'misteralg.h', ...entradas, 'libexcecoes.a'], arquivos)
  if (r.erros !== undefined) return r
  pendentes.add(prefixo) // a próxima compilação destes #include já sai com PCH
  return { wasm: r.saidas['programa.wasm'], avisos: r.mensagens }
}

/**
 * Passo a passo (F8): só a árvore do programa, analisada com os cabeçalhos mínimos do interpretador. No C++
 * eles vêm sob medida (sem o que o programa não usa: o JSON da árvore fica bem menor e sai mais rápido);
 * se o clang reclamar, confere de novo com os cabeçalhos inteiros antes de dar o erro.
 */
async function arvore(fonte, linguagem) {
  const chave = `${linguagem}\0${fonte}`
  const pronta = arvoresProntas.get(chave)
  if (pronta) return pronta
  let r
  if (linguagem !== 'cpp') r = await arvoreCom(ARGUMENTOS_AST_C, { 'programa.c': fonte, mini: CABECALHOS_C })
  else {
    r = await arvoreCom(ARGUMENTOS_AST_CPP, { 'programa.cpp': fonte, mini: cabecalhosCppPara(fonte) })
    if (r.erros !== undefined) r = await arvoreCom(ARGUMENTOS_AST_CPP, { 'programa.cpp': fonte, mini: CABECALHOS_CPP })
  }
  if (r.erros === undefined) {
    arvoresProntas.set(chave, r)
    while (arvoresProntas.size > MAX_ARVORES) arvoresProntas.delete(arvoresProntas.keys().next().value)
  }
  return r
}

// Quase todo o tempo do F8 é o clang escrevendo a árvore; ela fica guardada pelo texto do programa e é feita
// de antemão quando o F8 é provável: logo depois de um F9 que deu certo e ao abrir o arquivo (sem o aluno esperar).
const arvoresProntas = new Map() // "linguagem\0fonte" → { ast, avisos }
const MAX_ARVORES = 2
const arvoreDeAntemao = (fonte, linguagem) => (linguagem === 'c' || linguagem === 'cpp') && fonte.trim() && !arvoresProntas.has(`${linguagem}\0${fonte}`)

async function arvoreCom(argumentos, arquivos) {
  const d1 = new TextDecoder()
  const d2 = new TextDecoder()
  let json = ''
  let mensagens = ''
  try {
    await runClang(argumentos, arquivos, {
      stdout: (b) => { if (b) json += d1.decode(b, { stream: true }) },
      stderr: (b) => { if (b) mensagens += d2.decode(b, { stream: true }) },
      fetchProgress: () => {},
    })
    return { ast: json, avisos: mensagens }
  } catch (e) {
    return { erros: mensagens || String(e.message) }
  }
}

// Uma compilação por vez (o aquecimento e a do usuário podem chegar juntas). Os PCH pedidos
// ficam para depois da resposta, para o aluno não esperar por eles.
let fila = Promise.resolve()
const pendentes = new Set()
parentPort.on('message', ({ id, tipo, linguagem, fonte }) => {
  fila = fila.then(async () => {
    if (tipo === 'pch') return parentPort.postMessage({ id, caminho: await gerarPch(fonte) }) // scripts/gerar-pch.mjs
    if (tipo === 'aquecer') {
      // Carrega o clang (a 1ª chamada demora) e, no C++, já prepara o PCH dos #include do programa aberto.
      if (linguagem === 'cpp' && prefixoDeIncludes(fonte)) await gerarPch(prefixoDeIncludes(fonte))
      else await clang(['clang', '-c', 'a.c', '-o', 'a.o'], { 'a.c': 'int main(void) { return 0; }' })
      parentPort.postMessage({ id })
      if (arvoreDeAntemao(fonte, linguagem)) await arvore(fonte, linguagem)
      return
    }
    const r = tipo === 'arvore' ? await arvore(fonte, linguagem) : await compilar(linguagem, fonte)
    parentPort.postMessage({ id, ...r })
    if (tipo === 'compilar' && r.erros === undefined && arvoreDeAntemao(fonte, linguagem)) await arvore(fonte, linguagem)
    for (const prefixo of pendentes) await gerarPch(prefixo)
    pendentes.clear()
  }).catch((e) => parentPort.postMessage({ id, erros: `Erro no compilador: ${e.message}` }))
})
