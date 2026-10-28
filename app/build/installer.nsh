; Personalização do instalador NSIS do MisterALG (incluído pelo electron-builder).

; Antes de tudo: confirma se a pessoa quer mesmo instalar.
!macro customInit
  IfSilent pularPergunta
  MessageBox MB_YESNO|MB_ICONQUESTION "Deseja instalar o MisterALG ${VERSION} neste computador?$\r$\n$\r$\nO MisterALG é um interpretador e editor de algoritmos em Portugol, compatível com o VisuAlg 3.0.7." IDYES pularPergunta
    Quit
  pularPergunta:
!macroend

; Página de boas-vindas.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao instalador do MisterALG ${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente vai instalar o MisterALG no seu computador.$\r$\n$\r$\nCom ele você escreve, executa e depura algoritmos em Portugol, com a mesma linguagem, os mesmos menus e as mesmas teclas do VisuAlg 3.0.7. Os arquivos .alg feitos no VisuAlg abrem direto no MisterALG.$\r$\n$\r$\nNa próxima tela você vai ler os Termos de Uso e a Política de Privacidade.$\r$\n$\r$\nClique em Avançar para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Desinstalar tira o MisterALG do início do Windows ("Abrir quando o computador ligar", src/main/sistema.js).
; Numa atualização o app novo grava a entrada de novo ao abrir.
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MisterALG"
!macroend
