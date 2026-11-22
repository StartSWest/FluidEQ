/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': 'Compartilhar {name}',
  'presetShare.menu.community': 'Compartilhar com a comunidade…',
  'presetShare.menu.copyLink': 'Copiar link de compartilhamento',
  'presetShare.menu.export': 'Exportar…',
  'presetShare.linkCopied': 'Link de compartilhamento copiado',
  'presetShare.linkMaking': 'Criando o link…',
  'presetShare.linkFailed.signedOut': 'Entre para criar um link',
  'presetShare.linkFailed.suspended': 'Esta conta não pode compartilhar agora',
  'presetShare.linkFailed.rateLimited': 'Links demais nesta hora',
  'presetShare.linkFailed.tooMany': 'Esta conta atingiu o limite de links',
  'presetShare.linkFailed.takenDown': 'Este link foi retirado',
  'presetShare.linkFailed.offline': 'O servidor do FluidEQ não respondeu',

  'presetShare.text.title': '{name} · preset do FluidEQ',
  'presetShare.text.curve': 'Curva: {count} bandas',
  'presetShare.text.rack': 'Rack: {stages}',
  'presetShare.text.open': 'Abrir no FluidEQ',

  'presetShare.chip.curve': 'Curva · {count} bandas',
  'presetShare.chip.flat': 'Sem alterações',

  'presetShare.export.title': 'Exportar {name}',
  'presetShare.export.hint':
    'A curva e cada etapa do rack. Seu Normalizador e a cabeça da sua Sala continuam sendo seus.',
  'presetShare.export.tab.forum': 'Para qualquer fórum',
  'presetShare.export.tab.file': 'Arquivo',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · outros fóruns',
  'presetShare.format.plain': 'Texto simples',
  'presetShare.format.plainFor': 'Qualquer outro lugar',
  'presetShare.export.withLink':
    'Adicionar um link curto para a página dele em fluideq.com',
  'presetShare.export.linkSignIn': 'Entre para adicionar um link curto',
  'presetShare.export.fits':
    '{count} caracteres · cabe em uma mensagem do Discord',
  'presetShare.export.long':
    '{count} caracteres · longo demais para uma mensagem do Discord. Envie só o link curto.',
  'presetShare.export.pasteHint':
    'Qualquer pessoa com o FluidEQ pode colar isto em Importar.',
  'presetShare.export.fileHint':
    'JSON legível com a curva e cada etapa, o arquivo que a página DSP salva. Solte-o em Importar para trazê-lo de volta.',
  'presetShare.export.apoNoCurve':
    'Este preset não tem curva: todo o som dele está no rack, que precisa do FluidEQ.',
  'presetShare.export.apoRack':
    'Neste formato só a curva vai junto. {stages} precisam do FluidEQ.',
  'presetShare.export.copy': 'Copiar',
  'presetShare.export.copyCurve': 'Copiar curva',
  'presetShare.export.save': 'Salvar arquivo…',
  'presetShare.export.copied': 'Copiado',
  'presetShare.export.saved': 'Salvo',
  'presetShare.export.failed': 'Não deu certo. Tente de novo.',

  'presetShare.forum.attached': 'Preset anexado',
  'presetShare.forum.remove': 'Remover o preset',
  'presetShare.forum.template':
    'Feito para: \nOuvido em: \nExperimente com: \n\nO que faz: ',

  'presetShare.card.by': 'Compartilhado por @{author}',
  'presetShare.card.sharedBy': 'Compartilhado por {author}',
  'presetShare.card.sharedByMember': 'Compartilhado por um membro do FluidEQ',
  'presetShare.card.add': 'Adicionar aos meus presets',
  'presetShare.card.added': 'Em Seus · tocando',
  'presetShare.card.try': 'Experimentar',
  'presetShare.card.stopTrying': 'Parar de experimentar',
  'presetShare.card.tryingNote':
    'Toca até você parar ou sair da publicação; depois o seu próprio som volta.',

  'presetShare.import.button': 'Importar',
  'presetShare.import.title': 'Importar um preset',
  'presetShare.import.hint':
    'Cole uma publicação de fórum, um link de compartilhamento ou um arquivo de preset. Só o preset que está dentro é lido.',
  'presetShare.import.placeholder': 'Cole aqui…',
  'presetShare.import.chooseFile': 'Escolher arquivo…',
  'presetShare.import.found': 'Um preset encontrado',
  'presetShare.import.missing':
    'Este texto não contém nenhum preset do FluidEQ. Cole a publicação inteira ou o link de compartilhamento.',
  'presetShare.import.newer':
    'Este preset foi feito com um FluidEQ mais novo. Atualize o FluidEQ para lê-lo.',
  'presetShare.import.damaged':
    'O código do preset está cortado ou danificado. Copie-o de novo do início ao fim.',
  'presetShare.import.gone':
    'Este preset não é mais compartilhado. Peça o código dele.',
  'presetShare.import.offline':
    'O FluidEQ não conseguiu falar com o servidor para abrir este link. Verifique a conexão e tente de novo.',

  'presetShare.link.title': 'Adicionar este preset?',
  'presetShare.link.hint':
    'Vem de um link que você abriu. Nada toca nem é salvo até você apertar.',
  'presetShare.link.notNow': 'Agora não',
  'presetShare.link.fetching': 'Buscando o preset no FluidEQ…',
} as const;
