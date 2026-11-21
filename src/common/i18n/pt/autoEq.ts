/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
export default {
  'autoEq.title': 'EQ automático',
  'autoEq.aria': 'EQ automático: o que decide o som de cada música',
  'autoEq.chip.title': 'Tocando {sound}. Abrir o EQ automático',
  'autoEq.chip.changedAlbum': 'Alterado à mão. O álbum toca {preset}',
  'autoEq.chip.changedSong': 'Alterado à mão. Esta música toca {preset}',
  'autoEq.chip.backAlbum': 'Voltar ao som do álbum · {preset}',
  'autoEq.chip.backSong': 'Voltar ao som desta música · {preset}',
  'autoEq.chip.open': 'Abrir o EQ automático',
  'autoEq.albums.revert': 'Voltar para {preset}',
  'autoEq.tagline': 'O som de cada música, escolhido para você',
  'autoEq.state.measuring': 'Medindo',
  'autoEq.state.paused': 'Em pausa',
  'autoEq.state.song': 'Música',
  'autoEq.state.album': 'Álbum',
  'autoEq.state.yours': 'O seu',
  'autoEq.aside':
    'Fica de lado enquanto o DSP está desligado, uma cadeia de Jogos está ativa ou um jogo toca o próprio som. Depois volta como estava.',
  'autoEq.now.nothing': 'Nada tocando',
  'autoEq.now.yours': 'o seu som',
  'autoEq.now.yoursWhy':
    'Nada salvo para esta música: ela toca o último som que você escolheu.',
  'autoEq.now.song': 'o som desta música',
  'autoEq.now.songWhy': 'Volta toda vez que esta música toca.',
  'autoEq.now.album': 'o som de {album}',
  'autoEq.now.albumUnnamed': 'o som do álbum dela',
  'autoEq.now.albumWhy': 'Definido na Biblioteca para o álbum inteiro.',
  'autoEq.now.changedWhy': 'Alterado à mão: agora toca {preset}.',
  'autoEq.songs.title': 'Sons das músicas',
  'autoEq.songs.hint':
    'Uma música com um som salvo toca com ele. Mude-o e toque em Salvar alterações para guardá-lo. As outras músicas tocam com o seu.',
  'autoEq.songs.nothing': 'Toque uma música para salvar o som dela',
  'autoEq.songs.saved': 'Salvo para esta música',
  'autoEq.songs.none': 'Nada salvo para esta música',
  'autoEq.songs.save': 'Salvar para esta música',
  'autoEq.songs.forget': 'Esquecer',
  'autoEq.button.save': 'Salvar',
  'autoEq.state.changed': 'Alterado',
  'autoEq.songs.changed': 'Alterado, não salvo',
  'autoEq.songs.revert': 'Voltar ao salvo',
  'autoEq.songs.saveChanges': 'Salvar alterações',
  'autoEq.button.saveFor': 'Salvar o que toca para {title}',
  'autoEq.button.saved': 'Salvo',
  'autoEq.holds.preset': 'Predefinição',
  'autoEq.holds.eq': 'Seu EQ',
  'autoEq.holds.curves': 'Curvas',
  'autoEq.holds.bands': '{count} bandas',
  'autoEq.holds.bandsOne': '1 banda',
  'autoEq.holds.flat': 'Plano',
  'autoEq.holds.none': 'Nenhuma',
  'autoEq.holds.curve': 'Curva de {preset}',
  'autoEq.holds.correction': 'A correção dos fones fica com a saída',
  'autoEq.albums.title': 'Sons dos álbuns',
  'autoEq.albums.hint':
    'Só na Biblioteca. Todas as músicas do álbum tocam com ele, exceto uma música com preset próprio.',
  'autoEq.albums.nothing':
    'Defina o som de um álbum na página dele na Biblioteca',
  'autoEq.albums.libraryOnly': 'Só na Biblioteca: não vale para outros players',
  'autoEq.albums.set': '{album}: {preset}',
  'autoEq.albums.none': 'Este álbum não tem som definido',
  'autoEq.smart.title': 'Correção inteligente',
  'autoEq.smart.hint':
    'Mede cada música a partir da fonte e guarda a correção para aquela música. Por cima de qualquer preset.',
  'autoEq.smart.modes': 'Como corrige',
  'autoEq.smart.waiting': 'Aguardando uma música',
  'autoEq.smart.willSave': 'Salva para esta música quando ela terminar',
  'autoEq.smart.savesIn': 'Salva para esta música em {remaining}',
  'autoEq.smart.onceHint':
    'Uma medição do que está tocando, aplicada de uma vez',
  'autoEq.smart.once': 'Medir uma vez',
  'autoEq.smart.phase.listening': 'Ouvindo',
  'autoEq.smart.phase.settling': 'Estabilizando',
  'autoEq.smart.phase.held': 'Fixada para esta música',
  'autoEq.smart.phase.paused': 'Em pausa',
  'autoEq.smart.heard': '{seconds} s',
  'autoEq.smart.note.listening':
    'O que toca agora continua tocando até a correção desta música ser fixada.',
  'autoEq.smart.note.waitingOn':
    'Esperando {ranges}. O que toca agora continua tocando até a correção desta música ser fixada.',
  'autoEq.smart.note.settling':
    'Conferindo se a curva parou de se mover antes de gravá-la.',
  'autoEq.smart.note.held':
    'A medição parou. Ela volta a ouvir na próxima música.',
  'autoEq.smart.note.heldMissing':
    'Não está nesta gravação, então ficou como está: {ranges}. A medição parou.',
  'autoEq.smart.note.heldShort':
    'Pouco demais da gravação para corrigir, então o som fica como estava.',
  'autoEq.smart.again': 'Medir de novo',
  'autoEq.smart.againHint':
    'Ouvir esta música de novo e substituir a correção dela',
  'autoEq.savedCount': 'Salvos: {songs} · {albums}',
  'autoEq.manage': 'Gerenciar',
  'autoEq.manage.title': 'Sons salvos',
  'autoEq.manage.back': 'Voltar ao EQ automático',
  'autoEq.manage.songs': 'Músicas',
  'autoEq.manage.albums': 'Álbuns',
  'autoEq.manage.search': 'Pesquisar sons salvos',
  'autoEq.manage.wholeSound': '{preset} com o Tom e o EQ',
  'autoEq.manage.forget': 'Esquecer',
  'autoEq.manage.others': 'Músicas de outros players: {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube e o navegador. Os nomes delas nunca são guardados.',
  'autoEq.manage.empty': 'Nada salvo ainda',
  'autoEq.manage.noMatch': 'Nada corresponde',
  'autoEq.manage.resetKeeps':
    'Redefinir todas as configurações mantém estes. Só Esquecer os remove.',
  'autoEq.manage.forgetAll': 'Esquecer tudo',
  'autoEq.manage.forgetAllConfirm': 'Esquecer tudo, para sempre',
  'autoEq.moved.title': 'O som de cada música agora está no EQ automático',
  'autoEq.moved.body':
    'Lembrar o som de cada música foi para o EQ automático, na página EQ. Suas {count} músicas salvas foram junto.',
  'autoEq.moved.bodyOne':
    'Lembrar o som de cada música foi para o EQ automático, na página EQ. Sua música salva foi junto.',
  'autoEq.moved.open': 'Abrir EQ automático',
  'autoEq.moved.dismiss': 'Entendi',
  'autoEq.eqs.title': 'EQs salvos',
  'autoEq.eqs.saveThis': 'Salvar este EQ',
  'autoEq.eqs.empty': 'Nada salvo ainda',
  'autoEq.eqs.name': 'Nome',
  'autoEq.eqs.defaultName': 'Meu EQ {count}',
  'autoEq.eqs.keepPreset': 'Salvar o preset junto',
  'autoEq.eqs.anyPreset': 'Toca sobre qualquer preset',
  'autoEq.eqs.stays':
    'A correção dos fones e a correção inteligente ficam onde estão.',
  'autoEq.eqs.cancel': 'Cancelar',
  'autoEq.eqs.save': 'Salvar',
  'autoEq.eqs.saveFailed': 'Não foi possível salvar. Tente de novo.',
  'autoEq.eqs.putOn': 'Colocar',
  'autoEq.eqs.update': 'Atualizar',
  'autoEq.eqs.updateWithLive': 'Atualizar com o que está tocando',
  'autoEq.eqs.playing': 'Tocando',
  'autoEq.eqs.more': 'Mais para {name}',
  'autoEq.eqs.renameLabel': 'Novo nome para {name}',
  'autoEq.eqs.deleteAsk': 'Excluir {name}?',
  'autoEq.eqs.deleteKeeps':
    'Usado por {what}. Cada um mantém o som dele como próprio.',
  'autoEq.eqs.usedBy': 'em {what}',
  'autoEq.eqs.use': 'Usar um EQ salvo',
  'autoEq.eqs.saveNew': 'Salvar como novo EQ…',
  'autoEq.eqs.updateNamed': 'Atualizar “{name}” com o que está tocando',
  'autoEq.eqs.manageAll': 'Gerenciar EQs salvos…',
  'autoEq.eqs.search': 'Buscar EQs salvos',
  'autoEq.eqs.putOnNamed': 'Colocar {name}',
  'autoEq.songs.follows': 'Segue {name}',
};
