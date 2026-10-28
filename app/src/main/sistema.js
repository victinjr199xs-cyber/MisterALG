// Integração com o sistema: abrir o MisterALG quando o computador liga e o ícone
// na área de notificação (bandeja) quando a janela fica em segundo plano.
//
// Windows e Mac: app.setLoginItemSettings (o registro "Run" do Windows, os itens de
// início de sessão do Mac). Linux: um .desktop em ~/.config/autostart (padrão XDG,
// seguido pelo GNOME, KDE, XFCE, Cinnamon...). No Windows portátil e no AppImage o
// caminho é o do arquivo que o aluno baixou, não o da pasta temporária onde ele roda.

import { app, Menu, nativeImage, Tray } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ARG_AO_LIGAR, arquivoAutostart, executavel, textoAutostart } from './autostart.js'

/** Só o app instalado mexe no início do sistema (em desenvolvimento seria o Electron de node_modules). */
// MISTERALG_TESTE_SISTEMA: so para scripts/teste-sistema.mjs, que testa o registro e a bandeja com pasta de dados propria.
const podeConfigurar = () => !!process.env.MISTERALG_TESTE_SISTEMA || (app.isPackaged && !process.env.MISTERALG_DADOS)

/** Liga ou desliga a abertura junto com o computador. Devolve false se não deu (desenvolvimento, sem permissão...). */
export function definirAbrirAoLigar(ligar) {
  if (!podeConfigurar()) return false
  try {
    if (process.platform === 'linux') {
      const arquivo = arquivoAutostart()
      if (ligar) {
        mkdirSync(dirname(arquivo), { recursive: true })
        writeFileSync(arquivo, textoAutostart(executavel()), 'utf8')
      } else if (existsSync(arquivo)) unlinkSync(arquivo)
      return true
    }
    app.setLoginItemSettings({ openAtLogin: !!ligar, path: executavel(), args: [ARG_AO_LIGAR], name: 'MisterALG' }) // o nome é o que build/installer.nsh apaga ao desinstalar
    return true
  } catch {
    return false
  }
}

/** Se o sistema está mesmo configurado para abrir o MisterALG (o aluno pode ter tirado pelo sistema). */
export function abreAoLigar() {
  if (!podeConfigurar()) return null
  try {
    if (process.platform === 'linux') {
      const arquivo = arquivoAutostart()
      return existsSync(arquivo) && readFileSync(arquivo, 'utf8').includes(executavel())
    }
    // No Windows, openAtLogin vem false mesmo com a entrada certa (os argumentos voltam vazios); vale launchItems.
    const s = app.getLoginItemSettings({ path: executavel(), args: [ARG_AO_LIGAR], name: 'MisterALG' })
    return s.openAtLogin || (s.launchItems ?? []).some((i) => i.enabled && i.name === 'MisterALG') || s.executableWillLaunchAtLogin === true
  } catch {
    return null
  }
}

// ---- bandeja (segundo plano) ----

let bandeja = null

/** O ícone da bandeja: o do app, no tamanho que cada sistema usa. */
function iconeBandeja() {
  const lugares = [join(process.resourcesPath ?? '', 'icone.png'), join(app.getAppPath(), 'build', 'icon.png')]
  const arquivo = lugares.find((l) => existsSync(l))
  const imagem = arquivo ? nativeImage.createFromPath(arquivo) : nativeImage.createEmpty()
  return imagem.isEmpty() ? imagem : imagem.resize({ width: process.platform === 'darwin' ? 18 : 22, height: process.platform === 'darwin' ? 18 : 22 })
}

/**
 * Mostra o ícone na bandeja (uma vez só).
 * @param tr tradutor dos textos  @param abrir mostra a janela  @param sair fecha o MisterALG (perguntando se quer salvar)
 */
export function mostrarBandeja({ tr, abrir, sair }) {
  if (bandeja && !bandeja.isDestroyed()) return bandeja
  try {
    bandeja = new Tray(iconeBandeja())
  } catch {
    bandeja = null // sistema sem área de notificação: abrir o MisterALG de novo traz a janela de volta
    return null
  }
  bandeja.setToolTip(tr('O MisterALG está em segundo plano'))
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: tr('Abrir o MisterALG'), click: abrir },
    { type: 'separator' },
    { label: tr('Sair do MisterALG'), click: sair },
  ]))
  if (process.env.MISTERALG_TESTE_SISTEMA) console.log('[bandeja] criada')
  bandeja.on('click', abrir) // Windows e a maioria dos Linux; no Mac o clique abre o menu
  return bandeja
}

export function esconderBandeja() {
  if (bandeja && !bandeja.isDestroyed()) bandeja.destroy()
  bandeja = null
}
