/** "1.10.0" > "1.9.2"? (só números; um sufixo como -beta conta como versão anterior) */
export function maisNova(a, b) {
  const partes = (v) => String(v).replace(/^v/, '').split('-')
  const [na, sa] = partes(a)
  const [nb, sb] = partes(b)
  const x = na.split('.').map(Number)
  const y = nb.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
  return !sa && !!sb
}
