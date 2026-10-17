# Como contribuir

Que bom que você quer ajudar! O MisterALG é feito para estudantes e professores, então toda
melhoria conta — de um erro de digitação na ajuda a um recurso novo.

## Encontrou um problema?

Abra uma **issue** com:

1. o sistema (Windows, macOS, Linux — e a versão);
2. o algoritmo `.alg` que causou o problema (ou um trecho dele);
3. o que aconteceu e o que você esperava. Se o mesmo programa roda diferente no VisuAlg original,
   diga como ele se comporta lá — compatibilidade é prioridade.

## Quer mexer no código?

```bash
npm install
npm test        # precisa continuar tudo verde
npm run dev     # abre a IDE com recarga automática
```

- Leia o [docs/COMO-FUNCIONA.md](docs/COMO-FUNCIONA.md) para se localizar.
- Mudou o interpretador? Acrescente um teste em `packages/interpreter/test/`.
- Mudou algo visível? Rode `scripts/capturas.mjs` (veja o cabeçalho do arquivo) para atualizar as
  imagens da documentação.
- O código, os comentários e as mensagens do programa são em português.

## Uma regra importante

O MisterALG é uma recriação **independente**. Não copie código, textos da ajuda, imagens ou
exemplos do VisuAlg para cá — eles pertencem aos seus autores. Comportamento e mensagens de erro
curtas (necessárias para a compatibilidade) podem ser reproduzidos.
