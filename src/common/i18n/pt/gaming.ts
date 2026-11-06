/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'Laboratório gamer',
  'gaming.view.games': 'Jogos',
  'gaming.view.profiles': 'Perfis gamer',
  'gaming.switch': 'Trocar quando um jogo estiver em primeiro plano',
  'gaming.switch.hint':
    'Desligado, seus jogos mantêm seu som de música e nada troca sozinho.',
  'gaming.add': 'Adicionar um jogo',
  'gaming.list.show': 'Mostrar nomes dos jogos',
  'gaming.list.hide': 'Mostrar ícones dos jogos',
  'gaming.list.resize': 'Redimensionar lista de jogos',
  'gaming.list.count': 'Seus jogos · {count}',
  'gaming.list.from': 'De {profile}',
  'gaming.list.tuned': 'ajustado',
  'gaming.list.playing': 'Jogando',
  'gaming.empty.title': 'Nenhum jogo ainda',
  'gaming.empty.more':
    'Adicione um jogo e ele ganha um som próprio, copiado de um perfil gamer feito para ele. Você ajusta a cópia aqui; o perfil fica como estava.',
  'gaming.game.where': '{source} · em {output}',
  'gaming.profile.label': 'Perfil gamer',
  'gaming.profile.kind.title': 'Para este jogo',
  'gaming.profile.kind.kind': 'Por tipo',
  'gaming.profile.kind.yours': 'Seus',
  'gaming.profile.kind.chain': 'Preset DSP',
  'gaming.profile.gone': 'Um perfil que não existe mais',
  'gaming.profile.pickHint':
    'Escolher outro perfil dá a este jogo uma cópia nova dele.',
  'gaming.save': 'Salvar como perfil',
  'gaming.save.new': 'Salvar como perfil novo…',
  'gaming.save.newHint':
    'Vai para Seus, para que outros jogos possam partir dele. {game} passa a partir dele.',
  'gaming.save.update': 'Atualizar {profile}',
  'gaming.save.updateHint':
    'Seu perfil recebe estas mudanças. Os jogos que partiram dele mantêm suas próprias cópias.',
  'gaming.save.reset': 'Voltar para {profile}',
  'gaming.save.resetHint':
    'Descarta o ajuste deste jogo e começa de novo a partir do perfil.',
  'gaming.save.rename': 'Renomear esta cópia…',
  'gaming.save.delete': 'Excluir esta cópia',
  'gaming.save.deleteHint':
    'Remove este jogo e o ajuste dele. O perfil fica como está.',
  'gaming.action.unload': 'Descarregar',
  'gaming.action.unloadHint': 'Seu som de música volta agora.',
  'gaming.action.try': 'Experimentar agora',
  'gaming.action.tryHint':
    'Liga agora o som próprio de {game}, para você ouvir e ajustar.',
  'gaming.status.tuned':
    'A cópia de {profile} deste jogo. Ajustado: {parts}. O perfil em si não é tocado.',
  'gaming.status.tunedNamed':
    '{copy}: a cópia de {profile} deste jogo. Ajustado: {parts}. O perfil em si não é tocado.',
  'gaming.status.same':
    'Igual ao perfil. O que você mudar aqui fica com este jogo; o perfil em si nunca muda.',
  'gaming.rail.game': 'Jogo',
  'gaming.rail.sound': 'Som',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'ajustado',
  'gaming.stage.footsteps': 'Filtro Jogo',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'Curva',
  'gaming.curve.any': 'Qualquer jogo',
  'gaming.editor.notLoaded': 'O som próprio de {game} não está tocando',
  'gaming.editor.notLoadedMore':
    'Experimente agora para ouvir e ajustar aqui mesmo. Seu som de música volta com Descarregar, ou quando o jogo fecha.',
  'gaming.editor.eqNote':
    'As bandas próprias deste jogo, desenhadas no gráfico acima quando ele aparece.',
  'gaming.editor.curveNote':
    'A correção de fone que este jogo toca, das suas curvas ou a de um fone, e cada curva aplicada com ela, cada uma com seu × para tirá-la.',
  'gaming.saveDialog.title': 'Salvar como perfil gamer',
  'gaming.saveDialog.hint':
    'Outros jogos podem partir dele, na lista de perfis gamer.',
  'gaming.saveDialog.placeholder': 'Nome do perfil',
  'gaming.renameDialog.title': 'Renomear esta cópia',
  'gaming.renameDialog.hint': 'Só a cópia deste jogo recebe o nome.',
  'gaming.renameDialog.placeholder': 'Nome da cópia',
  'gaming.addDialog.title': 'Adicionar um jogo',
  'gaming.addDialog.intro':
    'Escolha o jogo. Ele parte de um perfil gamer e ganha uma cópia própria: você ajusta a cópia para este jogo, o perfil em si nunca muda.',
  'gaming.addDialog.running': 'Aberto agora',
  'gaming.addDialog.installed': 'Encontrado neste PC',
  'gaming.addDialog.startsFrom': 'Parte de',
  'gaming.addDialog.browse': 'Não está aqui? Procure o programa do jogo…',
  'gaming.addDialog.later':
    'Você pode escolher outro perfil gamer para ele quando quiser.',
  'gaming.addDialog.add': 'Adicionar {game}',
  'gaming.addDialog.cancel': 'Cancelar',
  'gaming.addDialog.loading': 'Procurando seus jogos…',
  'gaming.addDialog.none':
    'Nenhum dos seus launchers lista um jogo que ainda não esteja aqui. Procure o programa do jogo em vez disso.',
  'gaming.addDialog.close': 'Fechar',
  'gaming.profiles.intro':
    'Um jogo ganha sua própria cópia de um perfil. Você ajusta a cópia; o perfil nunca muda.',
  'gaming.profiles.search': 'Buscar perfis e jogos',
  'gaming.profiles.searchClear': 'Limpar a busca',
  'gaming.profiles.noMatch': 'Nenhum perfil gamer corresponde a “{query}”.',
  'gaming.profiles.filterLabel': 'Mostrar',
  'gaming.profiles.noCurve': 'Sem curva: como o jogo foi mixado',
  'gaming.profiles.filter.all': 'Todos',
  'gaming.profiles.filter.yours': 'Seus',
  'gaming.profiles.yours': 'Seus · salvos da cópia de um jogo',
  'gaming.profiles.yoursEmpty':
    'Nenhum ainda. Ajuste um jogo e use Salvar como perfil para guardar o som dele aqui.',
  'gaming.profiles.readyGroup': 'Prontos · {group}',
  'gaming.profiles.savedFrom': 'Salvo da cópia de {game}',
  'gaming.profiles.usedBy': '{games} partiu dele',
  'gaming.profiles.use': 'Usar para um jogo',
  'gaming.profiles.rename': 'Renomear',
  'gaming.profiles.delete': 'Excluir',
  'gaming.profiles.confirmDelete':
    'Excluir? Os jogos mantêm suas próprias cópias.',
  'gaming.profiles.keep': 'Manter',
  'gaming.profiles.renameTitle': 'Renomear perfil gamer',
  'gaming.profiles.renameHint':
    'Os jogos que partiram dele mantêm suas cópias; só o nome muda.',
  'gaming.toast.loaded': 'Perfil do jogo carregado',
  'gaming.toast.restored': 'Perfil de música restaurado',
  'gaming.paused.notice': 'Pausado: o som próprio de {game} está tocando',
  'gaming.paused.tune': 'Ajustar {game}',
  'gaming.paused.title': 'Seu rack de música está esperando',
  'gaming.paused.body':
    'Enquanto {game} está aberto, o som próprio dele está ligado e este rack fica em pausa. Ele volta exatamente como estava quando o jogo fecha, ou agora com Descarregar.',
  'gaming.paused.stages': '{preset} · o que volta',
  'gaming.paused.none': 'Todas as etapas dele estão desligadas.',
  'gaming.profileSelect.game': '{game} · som do jogo',
  'gaming.preset.tuned': '{game} (personalizado)',
  'gaming.preset.openHint':
    'O som próprio de {game} está carregado. O preset dele é trocado no Laboratório gamer.',
  'gaming.now.hint': 'O som próprio de {game} está tocando. Mostrar o jogo.',
} as const;
