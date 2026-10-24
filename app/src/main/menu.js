// Menu nativo, com os mesmos menus, itens e dicas do VisuAlg 3.0.7
// (docs/spec/_sintese-B-ide-erros.md §2.3). Cada item manda um comando
// ('menu', id) para o renderer, que é quem sabe o estado da IDE.
//
// Atalhos: os do Mac (⌘) e, quando não conflitam com o sistema, os originais
// do VisuAlg (teclas F, Ctrl+F2, Ctrl+G...). O renderer também aceita Ctrl+L,
// Ctrl+U, F3 e F4.

import { app, Menu } from 'electron'
import { basename } from 'node:path'
import { TEMAS, temaPorId } from '../compartilhado/temas.js'
import { IDIOMAS, tradutor } from '../compartilhado/idiomas.js'

const ehMac = process.platform === 'darwin'

// Atalhos que mudam por sistema: no Mac seguem o padrão ⌘; no Windows/Linux
// ficam os originais do VisuAlg 3.0.7 (Ctrl+A abre, Ctrl+F sai, Ctrl+L localiza).
const ATALHO = ehMac
  ? { abrir: 'Cmd+O', salvarComo: 'Shift+Cmd+S', selecionarTudo: 'Cmd+A', localizar: 'Cmd+F', substituir: 'Alt+Cmd+F' }
  : { abrir: 'Ctrl+A', salvarComo: 'Ctrl+Alt+C', selecionarTudo: 'Ctrl+T', localizar: 'Ctrl+L', substituir: 'Ctrl+U' }

export function montarMenu(janela, prefs, estado = {}) {
  const enviar = (id, dados) => () => janela?.webContents.send('menu', id, dados)
  const tr = tradutor(prefs.idioma)
  const item = (label, id, accelerator, extra = {}) => ({ label: tr(label), accelerator, click: enviar(id), ...extra })

  const recentes = prefs.mru.map((caminho, i) => ({
    label: `&${i + 1}º - ${basename(caminho)}`,
    sublabel: caminho,
    accelerator: `Ctrl+${i + 1}`,
    click: enviar('abrir-recente', caminho),
  }))

  const template = [
    ...(ehMac
      ? [{
          label: app.name,
          submenu: [
            item('Sobre o MisterALG', 'sobre'),
            { type: 'separator' },
            item('Configurações…', 'configuracoes', 'Cmd+,'),
            { type: 'separator' },
            { role: 'services', label: tr('Serviços') },
            { type: 'separator' },
            { role: 'hide', label: tr('Ocultar MisterALG') },
            { role: 'hideOthers', label: tr('Ocultar outros') },
            { role: 'unhide', label: tr('Mostrar tudo') },
            { type: 'separator' },
            item('Sair do MisterALG', 'sair', 'Cmd+Q'),
          ],
        }]
      : []),
    {
      label: tr('&Arquivo'),
      submenu: [
        item('&Novo', 'novo', 'CmdOrCtrl+N'),
        item('&Abrir…', 'abrir', ATALHO.abrir),
        item('&Tela inicial', 'tela-inicial'),
        { type: 'separator' },
        item('&Salvar', 'salvar', 'CmdOrCtrl+S'),
        item('Salvar &Como…', 'salvar-como', ATALHO.salvarComo),
        { type: 'separator' },
        item('&Imprimir…', 'imprimir', 'CmdOrCtrl+P'),
        ...(recentes.length ? [{ type: 'separator' }, ...recentes] : []),
        ...(ehMac ? [] : [{ type: 'separator' }, item('Sai&r', 'sair', 'Ctrl+F')]),
      ],
    },
    {
      label: tr('E&ditar'),
      submenu: [
        item('&Desfazer', 'desfazer', 'CmdOrCtrl+Z'),
        item('&Refazer', 'refazer', 'Shift+CmdOrCtrl+Z'),
        { type: 'separator' },
        { role: 'cut', label: tr('Recor&tar') },
        { role: 'copy', label: tr('&Copiar') },
        { role: 'paste', label: tr('Col&ar') },
        item('&Indentação', 'indentar', 'Ctrl+G'),
        { type: 'separator' },
        { role: 'selectAll', label: tr('&Selecionar tudo'), accelerator: ATALHO.selecionarTudo },
        { type: 'separator' },
        item('&Localizar…', 'localizar', ATALHO.localizar),
        item('Localizar o &Próximo', 'localizar-proximo', 'F3'),
        item('Localizar o &Anterior', 'localizar-anterior', 'F4'),
        { type: 'separator' },
        item('S&ubstituir…', 'substituir', ATALHO.substituir),
        { type: 'separator' },
        item('&Gravar bloco…', 'gravar-bloco', 'Ctrl+W'),
        item('I&nserir bloco…', 'inserir-bloco', 'Ctrl+R'),
      ],
    },
    {
      label: tr('&Run (executar)'),
      submenu: [
        item('Rodar o &Algoritmo', 'executar', 'F9'),
        item('Rodar &Passo a passo', 'passo', 'F8'),
        item('Rodar com Tempo', 'timer', 'Shift+F9'),
        item('&Parar  (stop)', 'parar', 'Ctrl+F2', { enabled: !!estado.executando }),
        { type: 'separator' },
        item('&Liga/desliga breakpoint', 'breakpoint', 'F5'),
        item('&Desmarcar todas (os breakpoints)', 'limpar-breakpoints', 'Ctrl+F5'),
        { type: 'separator' },
        item('Executar em modo &DOS', 'dos', undefined, { type: 'checkbox', checked: true, enabled: false }),
        item('Linhas (Ativa/Desativa)', 'linhas', undefined, { type: 'checkbox', checked: prefs.numerarLinhas }),
        item('&Gerar valores aleatórios', 'aleatorio', undefined, { type: 'checkbox', checked: !!estado.aleatorio }),
        { type: 'separator' },
        item('Per&fil', 'perfil', 'F7'),
        item('&Pilha de ativação', 'pilha', 'Ctrl+F3'),
      ],
    },
    {
      label: tr('&Exportar para'),
      submenu: [
        item('a Linguagem &Pascal…', 'exportar-pascal'),
        item('a Linguagem &C / C++', 'exportar-c', undefined, { enabled: false }),
        item('a Linguagem &Java', 'exportar-java', undefined, { enabled: false }),
      ],
    },
    {
      label: tr('&Manutenção'),
      submenu: [
        item('&Configurações', 'configuracoes', ehMac ? undefined : 'Ctrl+,'),
        {
          label: tr('&Tema (cores)'),
          submenu: TEMAS.map((tema) => ({
            label: tema.nome,
            type: 'radio',
            checked: tema.id === temaPorId(prefs.tema).id,
            click: enviar('tema', tema.id),
          })).concat([{ type: 'separator' }, item('Personalizar as cores do código…', 'configurar-cores')]),
        },
        { type: 'separator' },
        {
          label: tr('&Idioma'),
          submenu: IDIOMAS.map((i) => ({ label: i.nome, type: 'radio', checked: (prefs.idioma ?? 'pt') === i.id, click: enviar('idioma', i.id) })),
        },
        { type: 'separator' },
        item('Assistente de &IA', 'assistente', 'CmdOrCtrl+I'),
        item('Configurar o assistente de IA…', 'configurar-ia'),
        { type: 'separator' },
        item('&A Calculadora', 'calculadora'),
        item('&O Calendário', 'calendario'),
      ],
    },
    {
      label: tr('&Help (Ajuda)'),
      role: ehMac ? 'help' : undefined,
      submenu: [
        item('A &Tela do MisterALG', 'ajuda-tela', 'F1'),
        item('A &Linguagem (Portugol)', 'ajuda-linguagem', 'Ctrl+H'),
        item('&Referência da Linguagem', 'ajuda-referencia', 'Ctrl+Alt+H'),
        { type: 'separator' },
        item('&Dica do dia', 'dica'),
        item('&Procurar atualizações…', 'atualizacoes'),
        item('&Termos de uso e privacidade', 'termos'),
        item('&Sobre os autores do Software', 'sobre', 'Ctrl+F1'),
      ],
    },
    ...(ehMac ? [{ role: 'windowMenu', label: tr('Janela') }] : []),
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
