// "Abrir quando o computador ligar" no Linux: o .desktop de ~/.config/autostart (main/autostart.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARG_AO_LIGAR, arquivoAutostart, autostartConfere, executavel, textoAutostart } from './autostart.js'

test('autostartConfere: só vale se a linha Exec= for a deste executável', () => {
  const exe = '/home/ana/Meus "apps"/MisterALG.AppImage'
  assert.equal(autostartConfere(textoAutostart(exe), exe), true)
  assert.equal(autostartConfere(textoAutostart('/opt/outro/misteralg'), exe), false)
  assert.equal(autostartConfere(`# ${exe}\nExec=/bin/true\n`, exe), false)
  assert.equal(autostartConfere('', exe), false)
})

test('o sistema abre o arquivo que o aluno tem, não a cópia temporária do portátil ou do AppImage', () => {
  assert.equal(executavel({}, '/opt/MisterALG/misteralg'), '/opt/MisterALG/misteralg')
  assert.equal(executavel({ APPIMAGE: '/home/ana/MisterALG.AppImage' }, '/tmp/.mount_x/misteralg'), '/home/ana/MisterALG.AppImage')
  assert.equal(executavel({ PORTABLE_EXECUTABLE_FILE: 'C:\\Users\\ana\\MisterALG.exe' }, 'C:\\Temp\\x\\MisterALG.exe'), 'C:\\Users\\ana\\MisterALG.exe')
})

test('o .desktop fica na pasta autostart do XDG e cita o caminho como a especificação pede', () => {
  assert.equal(arquivoAutostart({ XDG_CONFIG_HOME: '/home/ana/.cfg' }), '/home/ana/.cfg/autostart/misteralg.desktop')
  const texto = textoAutostart('/home/ana/Meus "apps"/$MisterALG.AppImage')
  assert.match(texto, /^\[Desktop Entry\]\nType=Application\n/)
  const exec = texto.split('\n').find((l) => l.startsWith('Exec='))
  assert.equal(exec, `Exec="/home/ana/Meus \\"apps\\"/\\$MisterALG.AppImage" ${ARG_AO_LIGAR}`)
  assert.ok(ARG_AO_LIGAR.startsWith('-'), 'main/index.js não confunde o argumento com um arquivo para abrir')
})
