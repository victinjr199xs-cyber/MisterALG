// Ponto de entrada do processo do PHP (veja executor.mjs). Uso: node rodar.mjs <url do @php-wasm/node/index.js>
import { pathToFileURL } from 'node:url'
import { main } from './executor.mjs'

const alvo = process.argv[2] ?? import.meta.resolve('@php-wasm/node')
await main({ phpUrl: alvo.startsWith('file:') ? alvo : pathToFileURL(alvo).href })
