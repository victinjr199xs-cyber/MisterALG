// Ícones das linguagens da tela inicial: desenhos próprios do MisterALG (não são os logotipos oficiais),
// todos na mesma gramática: grade 48×48, traço branco arredondado de 3,2, um ponto de cor viva.
// Cada traço tem pathLength="100" para o CSS "desenhá-lo" (stroke-dashoffset) na entrada e no hover.

const traco = (d, extra = '') => `<path class="ic-traco" pathLength="100" d="${d}" ${extra}/>`
const ponto = (cx, cy, r = 2.4) => `<circle class="ic-ponto" cx="${cx}" cy="${cy}" r="${r}"/>`
const svg = (corpo) =>
  `<svg class="ic" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`

export const ICONES_LINGUAGEM = {
  // Fluxograma: o losango de decisão e o fio que sai dele.
  portugol: svg(traco('M24 6 L39 21 L24 36 L9 21 Z') + traco('M24 36 V42') + ponto(24, 21)),
  // O "#" de C# em quatro traços.
  csharp: svg(traco('M19 9 L16 39') + traco('M32 9 L29 39') + traco('M10 18.5 H39') + traco('M9 30 H38')),
  // Chaves de bloco com a faísca no meio.
  javascript: svg(traco('M18 9 C12 9 15 20 9 24 C15 28 12 39 18 39') + traco('M30 9 C36 9 33 20 39 24 C33 28 36 39 30 39') + ponto(24, 24, 2.8)),
  // Colchetes angulares de tipo e o T.
  typescript: svg(traco('M14 14 L6 24 L14 34') + traco('M34 14 L42 24 L34 34') + traco('M19 17 H29') + traco('M24 17 V32')),
  // Duas voltas que se encaixam, cada uma com seu olho.
  python: svg(
    traco('M33 22 V13 A5 5 0 0 0 28 8 H20 A5 5 0 0 0 15 13 V18 H28') +
    traco('M15 26 V35 A5 5 0 0 0 20 40 H28 A5 5 0 0 0 33 35 V30 H20') +
    ponto(21, 13.2, 1.9) + ponto(27, 34.8, 1.9)),
  // O anel aberto do C, com um ponteiro dentro.
  c: svg(traco('M34 15.6 A13 13 0 1 0 34 32.4') + ponto(24, 24, 2.6)),
  // O anel menor e os dois "+".
  cpp: svg(traco('M21.4 19.2 A8 8 0 1 0 21.4 28.8') + traco('M27.5 24 H33.5') + traco('M30.5 21 V27') + traco('M37.5 24 H43.5') + traco('M40.5 21 V27')),
  // A tag <? ?> com o ponto de interrogação.
  php: svg(traco('M14 14 L6 24 L14 34') + traco('M34 14 L42 24 L34 34') + traco('M20 19.5 A4.2 4.2 0 1 1 25 23.2 C24 24 24 25.2 24 27') + ponto(24, 32, 1.9)),
}
