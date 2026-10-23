import { defineConfig } from 'electron-vite'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// O Python roda offline: os arquivos do Pyodide saem do node_modules e vão para <renderer>/pyodide/
// (build) ou são servidos em /pyodide/ (dev). Nada é baixado de CDN.
const ARQUIVOS_PYODIDE = ['pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']
function pyodideLocal() {
  const pasta = dirname(createRequire(import.meta.url).resolve('pyodide/package.json'))
  return {
    name: 'pyodide-local',
    configureServer(server) {
      server.middlewares.use('/pyodide/', (req, res, next) => {
        const nome = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\//, '')
        if (!ARQUIVOS_PYODIDE.includes(nome)) return next()
        res.setHeader('Content-Type', nome.endsWith('.wasm') ? 'application/wasm' : nome.endsWith('.json') ? 'application/json' : nome.endsWith('.js') ? 'text/javascript' : 'application/zip')
        res.end(readFileSync(resolve(pasta, nome)))
      })
    },
    generateBundle() {
      for (const nome of ARQUIVOS_PYODIDE) this.emitFile({ type: 'asset', fileName: `pyodide/${nome}`, source: readFileSync(resolve(pasta, nome)) })
    },
  }
}

// Defaults já são src/main, src/preload e src/renderer (ARQUITETURA.md §2.1);
// declarados aqui explícitos para auditoria.
export default defineConfig({
  main: {
    root: 'src/main',
    build: {
      emptyOutDir: true,
      rollupOptions: {
        // O worker do compilador e o executor de C/C++ rodam fora do processo principal (main/clang.js).
        input: {
          index: resolve('src/main/index.js'),
          compilador: resolve('src/main/compilador.js'),
          'rodar-wasm': resolve('src/main/rodar-wasm.js'),
        },
      },
    },
  },
  preload: {
    root: 'src/preload',
    build: { emptyOutDir: true }
  },
  renderer: {
    root: 'src/renderer',
    // node-fetch: só o pyodide.mjs no Node o usa (ramo que nunca roda no renderer).
    build: { emptyOutDir: true, rollupOptions: { external: ['node-fetch'] } },
    plugins: [pyodideLocal()],
  }
})
