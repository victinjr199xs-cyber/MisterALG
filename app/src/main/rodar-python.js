// Processo à parte que roda um programa Python (Pyodide). Uso: rodar-python.js <url do pyodide.mjs>
// O código está em packages/interpretador-python (executor.mjs); aqui só se liga a entrada e a saída.

import { main } from '@misteralg/interpretador-python/executor'

await main({ pyodideUrl: process.argv[2] })
