// Processo à parte que guarda o banco de dados do SQL (PGlite). Uso: rodar-sql.js <url do @electric-sql/pglite/dist/index.js>
// O código está em packages/interpretador-sql (executor.mjs); aqui só se liga a entrada e a saída.

import { main } from '@misteralg/interpretador-sql/executor'

await main({ pgliteUrl: process.argv[2] })