import { defineConfig } from 'electron-vite'

// Defaults já são src/main, src/preload e src/renderer (ARQUITETURA.md §2.1);
// declarados aqui explícitos para auditoria.
export default defineConfig({
  main: {
    root: 'src/main',
    build: { emptyOutDir: true }
  },
  preload: {
    root: 'src/preload',
    build: { emptyOutDir: true }
  },
  renderer: {
    root: 'src/renderer',
    build: { emptyOutDir: true }
  }
})
