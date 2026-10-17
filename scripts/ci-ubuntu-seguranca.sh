#!/usr/bin/env bash
# Testa o MisterALG no Ubuntu com a MESMA restrição de segurança do Ubuntu
# desktop (23.10+): o AppArmor proíbe user namespaces para apps sem perfil.
#
# 1. .deb instalado → precisa abrir COM a sandbox do Chromium ligada (sem
#    --no-sandbox), graças ao perfil do AppArmor que o pacote instala. Se não
#    abrir, o teste falha.
# 2. AppImage nas mesmas condições → só registra o resultado (informativo).
set -u
cd "$(dirname "$0")/.."

echo "== Ativando a restrição do Ubuntu desktop =="
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=1
sysctl kernel.apparmor_restrict_unprivileged_userns
sudo aa-status --enabled && echo "AppArmor ativo" || echo "AVISO: AppArmor inativo neste runner"

echo "== Instalando o .deb =="
sudo apt-get install -y ./app/dist/misteralg_*_amd64.deb
ls -l /etc/apparmor.d/misteralg && cat /etc/apparmor.d/misteralg
ls -l /opt/MisterALG/chrome-sandbox

rodar() { # $1 = comando, $2 = porta, $3 = log
  xvfb-run -a --server-args="-screen 0 1366x860x24" bash -c "
    $1 --remote-debugging-port=$2 > $3 2>&1 &
    sleep 10
    node scripts/cdp.mjs $2 scripts/fumaca-ide.mjs
    s=\$?
    kill %1 2>/dev/null || true
    exit \$s
  "
}

echo "== MisterALG instalado pelo .deb, sandbox LIGADA =="
rodar "misteralg" 9333 deb.log
status_deb=$?
if [ $status_deb -ne 0 ]; then
  echo "FALHOU: o .deb não abriu com a sandbox ligada"; cat deb.log
  exit 1
fi
grep -i "sandbox" deb.log || echo "(nenhum aviso de sandbox no log)"

echo "== AppImage nas mesmas condições (só para registro) =="
chmod +x app/dist/MisterALG-*-x86_64.AppImage
sudo apt-get install -y libfuse2t64 >/dev/null 2>&1 || true
if rodar "./app/dist/MisterALG-*-x86_64.AppImage" 9334 appimage.log; then
  echo "RESULTADO AppImage: abriu com a sandbox ligada"
else
  echo "RESULTADO AppImage: NÃO abriu sem --no-sandbox (esperado no Ubuntu 23.10+). Log:"
  head -20 appimage.log
fi
exit 0
