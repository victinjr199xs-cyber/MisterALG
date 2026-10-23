export function compilarPHP(fonte) {
  // Simples compilador PHP-para-JavaScript para demonstração
  // Suporta: <?php echo, print, variáveis básicas, HTML
  let javascript = `
let _html = '';
function echo(...args) {
  _html += args.join('');
}
function print_(s) {
  _html += s;
  return 1;
}
const printf = (fmt, ...args) => { /* simplificado */ }
`

  // Remove tags PHP e transforma em JS
  let código = fonte
    .replace(/<\?php\s*/gi, '')
    .replace(/\?>/g, '')
    .replace(/echo\s+([^;]+);/g, 'echo($1);')
    .replace(/print\s+([^;]+);/g, 'print_($1);')

  javascript += '\n' + código + '\nreturn _html;'

  try {
    const fn = new Function(javascript)
    const html = fn()
    return { html, erro: null, status: 'ok' }
  } catch (e) {
    return { html: '', erro: String(e), status: 'erro' }
  }
}

export async function rodarPHP(fonte) {
  try {
    const { html, erro, status } = compilarPHP(fonte)

    if (erro) {
      return {
        html: `<pre style="color:red">${erro}</pre>`,
        status: 'erro',
        erro: { mensagem: erro, linha: 0 }
      }
    }

    return {
      html: html || '(nenhuma saída)',
      status: 'terminado',
      erro: undefined
    }
  } catch (e) {
    return {
      html: `<pre style="color:red">${e}</pre>`,
      status: 'erro',
      erro: { mensagem: String(e), linha: 0 }
    }
  }
}
