// Tela de abertura: o ícone Fluxo Vivo se desenha enquanto a IDE carrega por trás.
// É uma página estática (só CSS, sem JavaScript), carregada como data: URL.

import { BrowserWindow } from 'electron'
import { ICONE_SVG } from '../compartilhado/marca.js'

const DURACAO = 1900 // ms: o tempo da animação inteira
const LIMITE = 5000 // ms: se a abertura não aparecer, a IDE não fica esperando por ela

// Trechos de código das linguagens que flutuam ao fundo.
const TRECHOS = [
  'escreval("Olá!")', 'print("Olá!")', 'printf("Olá!\\n");', 'console.log("Olá!")',
  'std::cout << "Olá!";', '<?php echo "Olá!"; ?>', 'let x: number = 42', 'para i de 1 ate 10 faca',
]

const escapar = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

const pagina = (versao) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>MisterALG</title><style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;overflow:hidden;user-select:none;cursor:default}
  body{background:radial-gradient(120% 140% at 0% 0%,#3b1c8c 0%,#1d1466 45%,#06263f 100%);color:#fff;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Ubuntu,'Helvetica Neue',Arial,sans-serif}
  .luz{position:absolute;border-radius:50%;filter:blur(60px);opacity:.45;animation:flutuar 6s ease-in-out infinite alternate}
  .luz.a{width:320px;height:320px;left:-80px;top:-120px;background:#7b5cff}
  .luz.b{width:280px;height:280px;right:-60px;bottom:-140px;background:#00d4ff;animation-delay:-3s}
  .trechos{position:absolute;inset:0;font:13px Consolas,Menlo,'DejaVu Sans Mono',monospace;color:#fff}
  .trechos span{position:absolute;opacity:0;white-space:nowrap;animation:subir 3.2s linear forwards}
  .conteudo{position:relative;height:100%;display:flex;align-items:center;gap:34px;padding:0 48px}
  .marca{width:150px;height:150px;flex:none;filter:drop-shadow(0 14px 22px rgb(0 0 0 / .45))}
  .m-traco{stroke-dasharray:100;stroke-dashoffset:100;animation:desenhar 1s .15s cubic-bezier(.6,0,.2,1) forwards}
  .m-losango{transform-box:fill-box;transform-origin:center;transform:scale(0);animation:surgir .5s .95s cubic-bezier(.3,1.6,.5,1) forwards}
  .m-ponto{opacity:0;animation:aparecer .25s .9s forwards}
  .m-rastro{opacity:0;animation:piscar 1s calc(1.25s + var(--i) * .12s) infinite}
  h1{margin:0;font-size:46px;font-weight:800;letter-spacing:-1px;line-height:1;
    background:linear-gradient(90deg,#ffe066,#ff8fb1 50%,#7df9ff);-webkit-background-clip:text;background-clip:text;color:transparent;
    opacity:0;transform:translateY(10px);animation:entrar .6s .55s ease-out forwards}
  p{margin:10px 0 0;font-size:15px;color:#d9d3ff;opacity:0;animation:entrar .6s .8s ease-out forwards}
  .rodape{position:absolute;left:0;right:0;bottom:0;padding:0 18px 14px;display:flex;justify-content:space-between;font-size:11px;color:#a99fe0}
  .barra{position:absolute;left:0;bottom:0;height:3px;width:0;background:linear-gradient(90deg,#ffe066,#ff8fb1,#7df9ff);
    animation:carregar ${DURACAO}ms cubic-bezier(.4,0,.2,1) forwards}
  @keyframes desenhar{to{stroke-dashoffset:0}}
  @keyframes surgir{to{transform:scale(1)}}
  @keyframes aparecer{to{opacity:1}}
  @keyframes piscar{0%,100%{opacity:.25}40%{opacity:1}}
  @keyframes entrar{to{opacity:1;transform:none}}
  @keyframes carregar{to{width:100%}}
  @keyframes flutuar{to{transform:translate(30px,20px) scale(1.1)}}
  @keyframes subir{0%{opacity:0;transform:translateY(0)}20%{opacity:.13}80%{opacity:.13}100%{opacity:0;transform:translateY(-60px)}}
  @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important}}
</style></head><body>
  <div class="luz a"></div><div class="luz b"></div>
  <div class="trechos">${TRECHOS.map((t, i) =>
    `<span style="left:${8 + ((i * 37) % 72)}%;top:${12 + ((i * 29) % 70)}%;animation-delay:${(i * 0.22).toFixed(2)}s">${escapar(t)}</span>`).join('')}</div>
  <div class="conteudo">
    ${ICONE_SVG}
    <div><h1>MisterALG</h1><p>Aprenda a programar vendo o código rodar.</p></div>
  </div>
  <div class="rodape"><span>Carregando…</span><span>versão ${escapar(versao)}</span></div>
  <div class="barra"></div>
</body></html>`

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Mostra a abertura. `pronta` resolve quando a animação terminou (ou no limite);
 * a janela principal espera por ela antes de aparecer e então chama `fechar()`.
 */
export function mostrarAbertura(versao) {
  const janela = new BrowserWindow({
    width: 600,
    height: 330,
    center: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    title: 'MisterALG',
    backgroundColor: '#1d1466',
    webPreferences: { sandbox: true, javascript: false, spellcheck: false },
  })
  const apareceu = new Promise((r) => janela.once('ready-to-show', () => { janela.show(); r() }))
  janela.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pagina(versao))}`)

  return {
    pronta: Promise.race([apareceu.then(() => esperar(DURACAO)), esperar(LIMITE)]),
    fechar: () => { if (!janela.isDestroyed()) janela.destroy() },
  }
}
