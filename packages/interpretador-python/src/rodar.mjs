// Ponto de entrada do processo do Python (veja executor.mjs). Uso: node rodar.mjs <url do pyodide.mjs>
import { pathToFileURL } from 'node:url'
import { main } from './executor.mjs'

const pyodideUrl = process.argv[2] ?? import.meta.resolve('pyodide/pyodide.mjs')
await main({ pyodideUrl: pyodideUrl.startsWith('file:') ? pyodideUrl : pathToFileURL(pyodideUrl).href })
