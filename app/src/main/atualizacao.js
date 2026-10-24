// Atualizações pelo próprio app. A versão nova é procurada na página de Releases do GitHub.
// No Windows (instalado) e no Linux (AppImage), o electron-updater baixa o instalador e troca a versão
// sozinho; no Mac (sem assinatura da Apple), na versão portátil e no .deb/.rpm, o botão abre a página
// de download.

import { app } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater
const REPO = 'victinjr199xs-cyber/MisterALG'
export const PAGINA_RELEASES = `https://github.com/${REPO}/releases/latest`

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false
autoUpdater.logger = null

/** O app consegue se atualizar sozinho aqui? */
export const instalaSozinho = () =>
  app.isPackaged && ((process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR) || (process.platform === 'linux' && !!process.env.APPIMAGE))

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

/** A última release do GitHub, se for mais nova que esta. @returns {Promise<{versao, notas, pagina, automatica} | {atual} | {erro}>} */
export async function procurar() {
  // Só para testar a tela da atualização sem publicar uma versão nova.
  const atual = process.env.MISTERALG_VERSAO_TESTE || app.getVersion()
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return { erro: `GitHub respondeu ${r.status}` }
    const release = await r.json()
    const versao = String(release.tag_name ?? '').replace(/^v/, '')
    if (!versao || !maisNova(versao, atual)) return { atual }
    // Sem o latest.yml na release, o electron-updater não tem o que baixar: fica o botão de download.
    const temManifesto = (release.assets ?? []).some((a) => /^latest(-linux)?\.yml$/.test(a.name))
    return { versao, notas: String(release.body ?? '').slice(0, 4000), pagina: release.html_url ?? PAGINA_RELEASES, automatica: instalaSozinho() && temManifesto }
  } catch (e) {
    return { erro: String(e?.message ?? e) }
  }
}

/** Baixa a versão nova (só onde instalaSozinho()). aoProgresso(0..100). */
export async function baixar(aoProgresso) {
  const ouvir = (p) => aoProgresso(Math.floor(p.percent ?? 0))
  autoUpdater.on('download-progress', ouvir)
  try {
    await autoUpdater.checkForUpdates()
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (e) {
    return { erro: String(e?.message ?? e) }
  } finally {
    autoUpdater.off('download-progress', ouvir)
  }
}

/** Fecha o app, roda o instalador da versão nova sem perguntas e abre o MisterALG de novo. */
export function instalar() {
  autoUpdater.quitAndInstall(true, true)
}
