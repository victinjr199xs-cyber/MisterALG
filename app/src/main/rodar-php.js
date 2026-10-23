// Processo à parte que executa o PHP (php-wasm). Uso: rodar-php.js <url do @php-wasm/node/index.js>
// O código está em packages/interpretador-php (executor.mjs); aqui só se liga a entrada e a saída.

import { main } from '@misteralg/interpretador-php/executor'

await main({ phpUrl: process.argv[2] })
