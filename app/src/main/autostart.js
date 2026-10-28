// O que dá para conferir sem o Electron: o caminho e o texto do autostart do Linux (main/sistema.js).

import { homedir } from 'node:os'
import { posix } from 'node:path' // o .desktop só existe no Linux

const { join } = posix

/** O argumento que marca a abertura junto com o computador (main/index.js o ignora ao procurar arquivos). */
export const ARG_AO_LIGAR = '--ao-ligar'

/** O programa que o sistema deve abrir: o .exe portátil, o AppImage ou o executável instalado. */
export const executavel = (env = process.env, execPath = process.execPath) => env.PORTABLE_EXECUTABLE_FILE || env.APPIMAGE || execPath

const pastaAutostart = (env = process.env) => join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'autostart')
export const arquivoAutostart = (env = process.env) => join(pastaAutostart(env), 'misteralg.desktop')

/** O .desktop do autostart do Linux. Exec segue a especificação: caminho entre aspas, com \ " ` $ escapados. */
export function textoAutostart(exec) {
  const citado = `"${exec.replace(/[\\"`$]/g, (c) => `\\${c}`)}"`
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=MisterALG',
    'Comment=Abrir o MisterALG quando o computador ligar',
    `Exec=${citado} ${ARG_AO_LIGAR}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
}
