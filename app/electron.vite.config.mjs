import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'

// Defaults já são src/main, src/preload e src/renderer (ARQUITETURA.md §2.1);
// declarados aqui explícitos para auditoria.
export default defineConfig({
  main: {
    root: 'src/main',
    build: {
      emptyOutDir: true,
      rollupOptions: {
        // O worker do compilador e os executores (C/C++, Python, PHP) rodam fora do processo principal
        // (main/clang.js e main/programas.js).
        input: {
          index: resolve('src/main/index.js'),
          compilador: resolve('src/main/compilador.js'),
          'rodar-wasm': resolve('src/main/rodar-wasm.js'),
          'rodar-python': resolve('src/main/rodar-python.js'),
          'rodar-php': resolve('src/main/rodar-php.js'),
          'rodar-sql': resolve('src/main/rodar-sql.js'),
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
    // Duas páginas: a tela inicial sozinha (inicio.html) e a IDE (index.html).
    build: { emptyOutDir: true, rollupOptions: { input: { index: resolve('src/renderer/index.html'), inicio: resolve('src/renderer/inicio.html') } } }
  }
})
