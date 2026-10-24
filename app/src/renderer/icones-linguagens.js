// Ícones das linguagens da tela inicial, no estilo dos apps ArtCraft: um objeto ilustrado em creme com
// contorno de nanquim e um detalhe laranja, sobre o quadrado colorido da linguagem (a cor vem do CSS).
// Desenhos próprios do MisterALG, grade 64×64.

const TINTA = '#1a1a1a'
const CREME = '#f6efdc'
const DESTAQUE = '#ff7a1a'

const svg = (corpo) =>
  `<svg class="ic" viewBox="0 0 64 64" aria-hidden="true" stroke="${TINTA}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`
const fino = (d) => `<path d="${d}" fill="none" stroke-width="1.3"/>`
const pontos = (lista, r, cor = TINTA) => lista.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${cor}" stroke="none"/>`).join('')
// Traço grosso com miolo creme (corpo de cobra, tromba).
const tubo = (d, largura) =>
  `<path d="${d}" fill="none" stroke-width="${largura}"/><path d="${d}" fill="none" stroke="${CREME}" stroke-width="${largura - 3.6}"/>`

export const ICONES_LINGUAGEM = {
  // Portugol: a folha do algoritmo com o fluxograma (início, decisão, fim).
  portugol: svg(
    `<path d="M17 9 H39 L48 18 V55 H17 Z" fill="${CREME}"/><path d="M39 9 V18 H48" fill="#e3d6b4"/>` +
    fino('M43 24 V51') + fino('M40.5 27 V51') +
    `<rect x="25" y="15" width="12" height="6" rx="3" fill="#fff"/><path d="M31 21 V26 M31 41 V46" fill="none"/>` +
    `<path d="M31 26 L38 33.5 L31 41 L24 33.5 Z" fill="${DESTAQUE}"/><rect x="25" y="46" width="12" height="5" rx="1.2" fill="#fff"/>`),

  // C#: dó sustenido na partitura.
  csharp: svg(
    `<rect x="8" y="12" width="48" height="40" rx="5" fill="${CREME}"/>` +
    [22, 27, 32, 37, 42].map((y) => fino(`M13 ${y} H51`)).join('') +
    `<path d="M20 24 V45 M25.5 23 V44 M16.5 33 L29 30.5 M16.5 39.5 L29 37" fill="none" stroke-width="2.8"/>` +
    `<ellipse cx="38" cy="40" rx="5.2" ry="3.8" transform="rotate(-20 38 40)" fill="${DESTAQUE}"/>` +
    `<path d="M42.7 38.6 V18 C47.5 21 49 24.5 46.5 29" fill="none"/>`),

  // JavaScript: a janela do navegador com o raio entre chaves.
  javascript: svg(
    `<rect x="7" y="12" width="50" height="40" rx="5" fill="${CREME}"/><path d="M7 20.5 H57" fill="none"/>` +
    pontos([[12.5, 16.3], [17.5, 16.3]], 1.6) + pontos([[22.5, 16.3]], 1.6, DESTAQUE) +
    `<path d="M20 27 C16 27 18 34 14 35.5 C18 37 16 44 20 44 M44 27 C48 27 46 34 50 35.5 C46 37 48 44 44 44" fill="none"/>` +
    `<path d="M35 24.5 L25 38 H31.5 L28.5 47.5 L39.5 33 H33 Z" fill="${DESTAQUE}"/>`),

  // TypeScript: máquina de escrever ("type") batendo um T.
  typescript: svg(
    `<rect x="20" y="6" width="24" height="21" rx="1.5" fill="#fff"/><path d="M26 12 H38 M32 12 V22" fill="none" stroke-width="3"/>` +
    `<rect x="13" y="23" width="38" height="7" rx="3.5" fill="${CREME}"/>` +
    pontos([[11, 26.5], [53, 26.5]], 3.4, DESTAQUE) +
    `<circle cx="11" cy="26.5" r="3.4" fill="none"/><circle cx="53" cy="26.5" r="3.4" fill="none"/>` +
    `<path d="M14 31 H50 L55.5 54 H8.5 Z" fill="${CREME}"/>` + fino('M47 34 L51 51') +
    pontos([[20, 37.5], [26, 37.5], [32, 37.5], [38, 37.5], [44, 37.5], [17.5, 43.5], [23.5, 43.5], [29.5, 43.5], [35.5, 43.5], [41.5, 43.5], [47.5, 43.5]], 2.1) +
    `<rect x="22" y="48" width="20" height="2.8" rx="1.4" fill="${TINTA}" stroke="none"/>`),

  // Python: a cobra em S, com escamas e a língua de fora.
  python: svg(
    tubo('M13 52 C13 41 50 42 50 33 C50 23 17 27 17 18.5 C17 12 26 10 33 12.5', 10.5) +
    `<path d="M13 52 C13 41 50 42 50 33 C50 23 17 27 17 18.5 C17 12 26 10 33 12.5" fill="none" stroke="${DESTAQUE}" stroke-width="2.2" stroke-dasharray="0.1 6"/>` +
    `<ellipse cx="40" cy="13.5" rx="8" ry="6" transform="rotate(-12 40 13.5)" fill="${CREME}"/>` +
    pontos([[42.5, 11.5]], 1.7) + fino('M35.5 15.5 Q38 17.5 41 17') +
    `<path d="M47.5 15 L52.5 16 M52.5 16 L55 13.5 M52.5 16 L55 18.5" fill="none" stroke="${DESTAQUE}" stroke-width="1.9"/>`),

  // C: o chip, com a memória e os ponteiros por dentro.
  c: svg(
    [23, 29, 35, 41].map((p) => `<path d="M${p} 9 V16 M${p} 48 V55 M9 ${p} H16 M48 ${p} H55" fill="none"/>`).join('') +
    `<rect x="16" y="16" width="32" height="32" rx="4" fill="${CREME}"/>` + pontos([[20.5, 20.5]], 1.5) +
    `<rect x="23" y="23" width="18" height="18" rx="2" fill="${DESTAQUE}"/>` +
    `<path d="M36.5 27.8 A6 6 0 1 0 36.5 36.2" fill="none" stroke-width="3.2"/>`),

  // C++: a engrenagem (objetos que se encaixam) com o C++ no miolo.
  cpp: svg(
    [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="27.5" y="6" width="9" height="11" rx="1.6" fill="${CREME}" transform="rotate(${a} 32 32)"/>`).join('') +
    `<circle cx="32" cy="32" r="19.5" fill="${CREME}"/><circle cx="32" cy="32" r="14" fill="${DESTAQUE}"/>` +
    `<text x="32" y="37.4" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14.5" font-weight="900" fill="${TINTA}" stroke="none">C++</text>`),

  // SQL: o cilindro do banco de dados, com uma tabela na frente.
  sql: svg(
    `<path d="M12 14 V44 C12 49.5 21 53 32 53 C43 53 52 49.5 52 44 V14" fill="${CREME}"/>` +
    `<ellipse cx="32" cy="14" rx="20" ry="7" fill="#fff"/>` +
    `<path d="M12 24 C12 29.5 21 33 32 33 C43 33 52 29.5 52 24 M12 34 C12 39.5 21 43 32 43 C43 43 52 39.5 52 34" fill="none"/>` +
    `<rect x="30" y="35" width="26" height="22" rx="2.5" fill="#fff"/><path d="M30 42 H56 M30 49.5 H56 M39 42 V57 M47.5 42 V57" fill="none" stroke-width="1.6"/>` +
    `<rect x="30" y="35" width="26" height="7" rx="2.5" fill="${DESTAQUE}"/>`),

  // PHP: o elefante (mascote clássico do PHP), de frente.
  php: svg(
    `<ellipse cx="16" cy="28" rx="11" ry="13.5" fill="${CREME}"/><ellipse cx="48" cy="28" rx="11" ry="13.5" fill="${CREME}"/>` +
    fino('M10 21 Q14 28 10 35') + fino('M13.5 19 Q17.5 28 13.5 37') + fino('M54 21 Q50 28 54 35') + fino('M50.5 19 Q46.5 28 50.5 37') +
    `<ellipse cx="32" cy="27" rx="14" ry="14.5" fill="${CREME}"/>` +
    fino('M27 16.5 Q32 14.5 37 16.5') + fino('M28.5 19.5 Q32 18 35.5 19.5') +
    pontos([[26, 26], [38, 26]], 1.9) +
    `<path d="M26.5 35.5 C25 39 25.5 42 28 43 M37.5 35.5 C39 39 38.5 42 36 43" fill="#fff" stroke-width="2"/>` +
    tubo('M32 34 C32 45 30.5 52 25 52 C21 52 20.5 47.5 23.5 46.5', 9) +
    `<path d="M29.5 43 H34.5 M28.5 47.5 H33" fill="none" stroke="${DESTAQUE}" stroke-width="1.6"/>`),
}
