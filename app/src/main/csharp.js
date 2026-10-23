// C#: o tree-sitter (WebAssembly) lê o programa aqui no processo principal e manda a árvore para a IDE,
// onde o interpretador (packages/interpretador-csharp) a executa passo a passo.

import { app } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { criarAnalisador } from '@misteralg/interpretador-csharp/analisar'
import { PRELUDIO } from '@misteralg/interpretador-csharp/preludio'

// No app instalado, os dois .wasm vão em resources/linguagens/csharp (extraResources); em desenvolvimento, no node_modules.
const caminhos = () => {
  if (app.isPackaged) {
    const base = join(process.resourcesPath, 'linguagens', 'csharp')
    return { moduloTreeSitter: join(base, 'web-tree-sitter', 'tree-sitter.js'), wasmMotor: join(base, 'web-tree-sitter', 'tree-sitter.wasm'), wasmLinguagem: join(base, 'tree-sitter-c_sharp.wasm') }
  }
  const requerer = createRequire(import.meta.url)
  return { wasmMotor: requerer.resolve('web-tree-sitter/tree-sitter.wasm'), wasmLinguagem: requerer.resolve('tree-sitter-wasms/out/tree-sitter-c_sharp.wasm') }
}

let analisador = null
let preludio = null

async function preparar() {
  analisador ??= criarAnalisador(caminhos())
  const a = await analisador
  preludio ??= a.analisar(PRELUDIO)
  return a
}

/** @returns { ast } | { erros: [{ linha, coluna, mensagem }] } */
export async function analisarCSharp(fonte) {
  const a = await preparar()
  return a.analisar(String(fonte))
}

/** A árvore do prelúdio (exceções, interfaces e enums escritos em C#): igual para todo programa. */
export async function preludioCSharp() {
  await preparar()
  return preludio
}

export const aquecerCSharp = () => { preparar().catch(() => {}) }
