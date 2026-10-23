// Worker que mantém o clang (WebAssembly, @yowasp/clang) carregado entre uma
// compilação e outra: a primeira demora uns segundos, as seguintes bem menos.
// Roda fora do Electron (worker_threads): não importa nada de 'electron'.

import { parentPort, workerData } from 'node:worker_threads'
import { ARGUMENTOS_AST_C, CABECALHOS_C } from '@misteralg/interpretador-c/cabecalhos'
import { ARGUMENTOS_AST_CPP, CABECALHOS_CPP } from '@misteralg/interpretador-c/cabecalhos-cpp'
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
// shortcut: guardado só na memória (some ao fechar o app, ~17 MB cada); gravar em disco se o 1º F9 incomodar.
const pchs = new Map() // prefixo de #include → { pch, cabecalho }
const MAX_PCHS = 3

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
  if (!prefixo || pchs.has(prefixo)) return
  const cabecalho = `#include "misteralg.h"\n${prefixo}\n`
  const r = await clang(['clang++', ...FLAGS_CPP, '-x', 'c++-header', 'pre.hpp', '-o', 'pre.hpp.pch'], { 'pre.hpp': cabecalho, misteralg: INCLUIR })
  if (r.erros !== undefined) return // um #include que não existe: o F9 mostra o erro normalmente
  pchs.set(prefixo, { pch: r.saidas['pre.hpp.pch'], cabecalho })
  while (pchs.size > MAX_PCHS) pchs.delete(pchs.keys().next().value)
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
  if (pre) {
    const r = await clang(['clang++', ...FLAGS_CPP, '-include-pch', 'pre.hpp.pch', ...entradas, 'libexcecoes.a'],
      { ...arquivos, 'pre.hpp.pch': pre.pch, 'pre.hpp': pre.cabecalho })
    if (r.erros !== undefined && /precompiled|\.pch/i.test(r.erros)) pchs.delete(chave) // PCH que não serviu: compila do jeito normal
    else {
      if (chave !== prefixo && r.erros === undefined) pendentes.add(prefixo) // na próxima, o PCH com todos os #include
      return r.erros !== undefined ? r : { wasm: r.saidas['programa.wasm'], avisos: r.mensagens } // erro do programa: igual sem o PCH
    }
  }
  const r = await clang(['clang++', ...FLAGS_CPP, '-include', 'misteralg.h', ...entradas, 'libexcecoes.a'], arquivos)
  if (r.erros !== undefined) return r
  pendentes.add(prefixo) // a próxima compilação destes #include já sai com PCH
  return { wasm: r.saidas['programa.wasm'], avisos: r.mensagens }
}

/** Passo a passo (F8): só a árvore do programa, analisada com os cabeçalhos mínimos do interpretador. */
async function arvore(fonte, linguagem) {
  const d1 = new TextDecoder()
  const d2 = new TextDecoder()
  let json = ''
  let mensagens = ''
  const cpp = linguagem === 'cpp'
  try {
    const arquivos = cpp ? { 'programa.cpp': fonte, mini: CABECALHOS_CPP } : { 'programa.c': fonte, mini: CABECALHOS_C }
    await runClang(cpp ? ARGUMENTOS_AST_CPP : ARGUMENTOS_AST_C, arquivos, {
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
    if (tipo === 'aquecer') {
      // Carrega o clang (a 1ª chamada demora) e, no C++, já prepara o PCH dos #include do programa aberto.
      if (linguagem === 'cpp' && prefixoDeIncludes(fonte)) await gerarPch(prefixoDeIncludes(fonte))
      else await clang(['clang', '-c', 'a.c', '-o', 'a.o'], { 'a.c': 'int main(void) { return 0; }' })
      return parentPort.postMessage({ id })
    }
    const r = tipo === 'arvore' ? await arvore(fonte, linguagem) : await compilar(linguagem, fonte)
    parentPort.postMessage({ id, ...r })
    for (const prefixo of pendentes) await gerarPch(prefixo)
    pendentes.clear()
  }).catch((e) => parentPort.postMessage({ id, erros: `Erro no compilador: ${e.message}` }))
})
