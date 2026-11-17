/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Library's tag editor. See `../en/libraryTags.ts`. */
const libraryTags = {
  'library.tags.menu.edit': 'Editar tags…',
  'library.tags.menu.editMany': 'Editar tags de {count} músicas…',
  'library.tags.menu.editAlbum': 'Editar tags do álbum…',
  'library.tags.menu.cover': 'Trocar capa…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count} músicas',
  'library.tags.selection.edit': 'Editar tags',
  'library.tags.selection.clear': 'Limpar seleção',

  'library.tags.field.title': 'Título',
  'library.tags.field.artist': 'Artista',
  'library.tags.field.composer': 'Compositor',
  'library.tags.field.album': 'Álbum',
  'library.tags.field.albumArtist': 'Artista do álbum',
  'library.tags.field.trackNo': 'Faixa',
  'library.tags.field.trackTotal': 'Total de faixas',
  'library.tags.field.discNo': 'Disco',
  'library.tags.field.discTotal': 'Total de discos',
  'library.tags.field.year': 'Ano',
  'library.tags.field.genre': 'Gênero',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'Comentário',
  'library.tags.field.grouping': 'Agrupamento',
  'library.tags.field.publisher': 'Gravadora',
  'library.tags.field.copyright': 'Copyright',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'Regente',
  'library.tags.field.subtitle': 'Subtítulo',
  'library.tags.field.remixer': 'Remixado por',
  'library.tags.field.initialKey': 'Tom',
  'library.tags.field.compilation': 'Coletânea',
  'library.tags.field.titleSort': 'Ordem do título',
  'library.tags.field.artistSort': 'Ordem do artista',
  'library.tags.field.albumSort': 'Ordem do álbum',
  'library.tags.field.albumArtistSort': 'Ordem do artista do álbum',
  'library.tags.field.composerSort': 'Ordem do compositor',
  'library.tags.field.musicBrainzTrackId': 'Gravação no MusicBrainz',
  'library.tags.field.musicBrainzReleaseId': 'Lançamento no MusicBrainz',
  'library.tags.field.musicBrainzArtistId': 'Artista no MusicBrainz',
  'library.tags.field.musicBrainzReleaseArtistId':
    'Artista do álbum no MusicBrainz',
  'library.tags.field.musicBrainzReleaseGroupId':
    'Grupo de lançamentos no MusicBrainz',

  'library.tags.panel.title': 'Editar tags',
  'library.tags.panel.position': '{index} de {count}',
  'library.tags.panel.previous': 'Música anterior (Alt+↑)',
  'library.tags.panel.next': 'Próxima música (Alt+↓)',
  'library.tags.panel.close': 'Fechar (Esc): as edições esperam',
  'library.tags.panel.reading': 'Lendo as tags do arquivo…',
  'library.tags.panel.readFailed':
    'Não foi possível ler as tags deste arquivo. Ele pode estar danificado ou em uso.',
  'library.tags.panel.missing': 'Esta música não está mais no disco.',
  'library.tags.panel.unsupported':
    'O FluidEQ não edita as tags deste tipo de arquivo.',
  'library.tags.group.song': 'Música',
  'library.tags.group.album': 'Álbum',
  'library.tags.group.details': 'Detalhes',
  'library.tags.group.file': 'Arquivo',
  'library.tags.of': 'de',
  'library.tags.sameAsArtist': 'Igual ao artista',
  'library.tags.putBack': 'Restaurar',
  'library.tags.noArtist': 'Sem artista',
  'library.tags.noAlbum': 'Sem álbum',
  'library.tags.genre.inLibrary': 'Na sua biblioteca',
  'library.tags.tip.fileName': 'O título é o nome do arquivo. Usar {title}?',
  'library.tags.tip.fileNameTrack':
    'O título é o nome do arquivo. Usar {title}, faixa {track}?',
  'library.tags.tip.use': 'Usar',

  'library.tags.cover.dropHint': 'Solte ou cole uma imagem',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'Este arquivo não tem capa',
  'library.tags.cover.new': 'Capa nova · {width} × {height}',
  'library.tags.cover.removed': 'A capa é removida ao salvar',
  'library.tags.cover.refused': 'Só uma imagem JPEG ou PNG de até 20 MB.',
  'library.tags.cover.emptyClipboard':
    'Não há imagem na área de transferência.',

  'library.tags.more.toggle': 'Mais campos',
  'library.tags.more.count': '{count} neste arquivo · adicione qualquer um',
  'library.tags.more.countNone': 'adicione qualquer um',
  'library.tags.more.add': 'Adicionar um campo',
  'library.tags.more.addHint':
    'Qualquer campo que o formato permita, pelo código.',
  'library.tags.more.code': 'Código',
  'library.tags.more.value': 'Valor',
  'library.tags.more.addConfirm': 'Adicionar',
  'library.tags.more.badCode':
    'O formato deste arquivo não consegue guardar esse código como texto.',

  'library.tags.file.format': 'Formato',
  'library.tags.file.tags': 'Tags no arquivo',
  'library.tags.file.noTags': 'Sem tags',
  'library.tags.file.writeAs': 'Gravar como',
  'library.tags.file.keep': 'Manter {version}',
  'library.tags.file.v23Note':
    'A v2.3 é o que o Explorador do Windows, os sons de carro e os players antigos leem melhor. A v2.4 guarda UTF-8 e vários valores por campo.',
  'library.tags.file.v24Note':
    'O Explorador do Windows e alguns sons de carro leem mal a v2.4; a v2.3 é a escolha segura se este arquivo for viajar.',
  'library.tags.file.id3v1': 'Manter a antiga tag ID3v1 em dia',
  'library.tags.file.readOnly':
    'Este arquivo é somente leitura. Você será consultado antes de ele ser gravado.',

  'library.tags.foot.none': 'Nenhuma alteração',
  'library.tags.foot.noneHint':
    'As edições esperam enquanto você percorre o álbum',
  'library.tags.foot.changes': '{count} alterações não salvas',
  'library.tags.foot.changesOne': '1 alteração não salva',
  'library.tags.foot.inSongs': 'em {count} músicas',
  'library.tags.foot.inSongsOne': 'em 1 música',
  'library.tags.revert': 'Desfazer edições',
  'library.tags.save': 'Salvar',
  'library.tags.saveSongs': 'Salvar {count} músicas',
  'library.tags.saveFailed':
    'Alguns valores não puderam ser gravados como foram digitados. Confira os campos marcados.',

  'library.tags.set.reading': 'Lendo tags · {done} de {count}',
  'library.tags.set.use': 'Usar {value}',
  'library.tags.set.coversMixed': '{count} capas diferentes',
  'library.tags.set.coversNone': '{count} músicas não têm',
  'library.tags.set.coverOne': 'Uma capa para todas',
  'library.tags.set.coverNoneAll': 'Nenhuma música tem capa',
  'library.tags.set.coverToAll': 'Para as {count} músicas',
  'library.tags.set.songs': 'Músicas',
  'library.tags.set.renumber': 'Renumerar pela ordem',
  'library.tags.set.fixAuto': 'Corrigir automaticamente',
  'library.tags.set.moreFields': 'Mais campos ({fields})',
  'library.tags.set.varies': 'Varia:',
  'library.tags.set.variesPlaceholder': 'Varia · digite um para todas',
  'library.tags.set.useForAll': 'Usar nas {count} músicas',
  'library.tags.set.found': '{count} músicas encontradas',
  'library.tags.set.foundOne': '1 música encontrada',
  'library.tags.set.foundNone': 'Nenhum título tem isso',
  'library.tags.cover.change': 'Trocar capa',
  'library.tags.cover.changeShort': 'Trocar',
  'library.tags.cover.chooseImage': 'Escolher uma imagem…',
  'library.tags.cover.pasteImage': 'Colar da área de transferência',
  'library.tags.cover.removeCover': 'Remover a capa',
  'library.tags.set.find': 'Localizar nos títulos',
  'library.tags.set.replaceWith': 'Substituir por',
  'library.tags.set.replaceAll': 'Substituir tudo',
  'library.tags.set.sheetHint':
    'Enter desce · Tab vai para a direita · Ctrl+D copia a célula de cima · arraste uma linha pela alça para reordenar e depois use Renumerar.',
  'library.tags.set.col.no': '#',
  'library.tags.set.col.time': 'Duração',
  'library.tags.set.grip': 'Arraste para reordenar',
  'library.tags.set.missingCell': 'falta',
  'library.tags.set.groupSongs': '{count} músicas',
  'library.tags.set.changes': '{count} alterações',
  'library.tags.set.changesOne': '1 alteração',
  'library.tags.set.files': '{count} arquivos · nada gravado ainda',
  'library.tags.set.filesOne': '1 arquivo · nada gravado ainda',
  'library.tags.set.discard': 'Descartar',
  'library.tags.set.back': 'Voltar',
  'library.tags.set.leaveAsk': 'Sair sem salvar estas alterações?',
  'library.tags.set.keepEditing': 'Continuar editando',
  'library.tags.set.unreadable':
    '{count} músicas não puderam ser lidas e ficaram de fora.',

  'library.tags.write.progress': 'Gravando tags · {done} de {count}',
  'library.tags.write.undoing': 'Restaurando tags · {done} de {count}',
  'library.tags.write.background': 'Continuar em segundo plano',
  'library.tags.write.show': 'Mostrar',
  'library.tags.write.cancel': 'Cancelar',
  'library.tags.write.written': '{done} de {count} gravados',
  'library.tags.write.needYou': '{count} precisam de você',
  'library.tags.write.review': 'Revisar {count} arquivos',
  'library.tags.write.reviewOne': 'Revisar 1 arquivo',
  'library.tags.write.done': '{count} arquivos atualizados',
  'library.tags.write.doneOne': '1 arquivo atualizado',
  'library.tags.write.doneNote':
    'As tags anteriores ficam guardadas: Desfazer traz todas de volta.',
  'library.tags.write.undo': 'Desfazer',
  'library.tags.write.undone': 'Desfeito',
  'library.tags.write.undoneNote':
    'Cada arquivo voltou às tags anteriores, capa incluída.',
  'library.tags.write.stopped': 'Parado depois de {done} de {count}',
  'library.tags.write.stoppedNote':
    'Os arquivos já gravados ficam com as tags novas; Desfazer traz as antigas de volta.',
  'library.tags.write.failed': '{count} não puderam ser gravados',
  'library.tags.write.failedOne': '1 não pôde ser gravado',
  'library.tags.write.dismiss': 'Fechar',
  'library.tags.problems.title': '{count} arquivos precisam de você',
  'library.tags.problems.titleOne': '1 arquivo precisa de você',
  'library.tags.problems.allHandled': 'Tudo resolvido',
  'library.tags.problems.waiting': '{count} esperam a música terminar',
  'library.tags.problems.waitingOne': '1 espera a música terminar',
  'library.tags.problems.held':
    'Tocando agora no FluidEQ: é gravado assim que a música terminar.',
  'library.tags.problems.locked':
    'Aberto em outro programa. Feche-o lá e tente de novo.',
  'library.tags.problems.readOnly':
    'Este arquivo é somente leitura, então não pode ser alterado como está.',
  'library.tags.problems.failed':
    'Não foi possível gravar este arquivo. Ele continua igual; nada se perdeu.',
  'library.tags.problems.missing':
    'Este arquivo não está mais onde a biblioteca o encontrou.',
  'library.tags.problems.retry': 'Tentar de novo',
  'library.tags.problems.skip': 'Pular',
  'library.tags.problems.makeWritable': 'Permitir gravação e gravar',
  'library.tags.problems.skipAll': 'Pular todos',
  'library.tags.problems.failedCopy':
    'Não foi possível criar ao lado a cópia usada para gravar. O arquivo continua igual. Tente de novo; se o disco estiver cheio ou ocupado, libere-o antes.',
  'library.tags.problems.failedTags':
    'Não foi possível gravar as tags: o arquivo pode estar danificado ou ser incomum. Ele continua igual. Tente de novo ou abra-o em outro editor de tags.',
  'library.tags.problems.failedCheck':
    'Na verificação, a cópia gravada não era lida como a mesma música, então não foi usada. O arquivo continua igual.',
  'library.tags.problems.failedUndo':
    'Não foi possível guardar o que Desfazer precisa, então nada foi gravado. O arquivo continua igual.',
  'library.tags.problems.failedPlace':
    'A cópia gravada não pôde ocupar o lugar do arquivo. O arquivo continua igual. Se um app de sincronização como o OneDrive estiver mexendo nele, tente de novo quando terminar.',
  'library.tags.problems.options': 'Opções deste arquivo',
  'library.tags.problems.openTags': 'Ver as tags',
  'library.tags.problems.reveal': 'Mostrar no Explorador',
  'library.tags.problems.nothingToDo': 'Nada a fazer.',
  'library.tags.problems.everythingElse': 'Todo o resto foi gravado',
  'library.tags.problems.undoCovers': 'Desfazer também vale para estes',
  'library.tags.menu.fix': 'Corrigir tags automaticamente…',
  'library.tags.menu.fixAlbum': 'Corrigir este álbum…',
  'library.tags.menu.fixShortcut': 'Ctrl+Shift+I',
  'library.tags.hero.fix': 'Corrigir tags',
  'library.tags.selection.fix': 'Corrigir',
  'library.tags.fix.empty': 'vazio',
  'library.tags.fix.albums': '{count} álbuns',
  'library.tags.fix.albumChanges': '{count} mudanças',
  'library.tags.fix.albumChangesOne': '1 mudança',
  'library.tags.fix.nothingFound':
    'O FluidEQ não encontrou nada para corrigir nestas músicas.',
  'library.tags.fix.noPicture':
    'Não foi possível usar a imagem da pasta do álbum.',
  'library.tags.fix.filled':
    'O FluidEQ completou o que faltava. O que mudou está em cor, com o valor antigo riscado ao lado: confira e salve, ou descarte.',
  'library.tags.fix.fixAlbum': 'Corrigir',
  'library.tags.fix.openAlbum': 'Abrir',
  'library.tags.fix.editByHand': 'Editar tudo à mão',
  'library.tags.fix.albumComplete': 'Completo',
  'library.tags.changes.title': 'Alterações',
  'library.tags.changes.none':
    'Ainda não há alterações. O que você mudar aparece aqui antes de salvar.',
  'library.tags.changes.album': 'Para o álbum inteiro',
  'library.tags.changes.songs': 'Música por música',
  'library.tags.changes.removed': 'removido',
  'library.tags.changes.cover': 'Capa',
  'library.tags.changes.coverNew': 'Nova imagem',
  'library.tags.changes.coverRemoved': 'Removida',
  'library.tags.cover.useOne': 'Usar uma em todas as músicas',
  'library.tags.cover.useThis': 'Usar esta capa em todas as músicas',
  'library.tags.cover.searchWeb': 'Buscar capa na internet…',
  'library.tags.cover.searchHint':
    'No navegador, copie a imagem que quiser e escolha Colar, ou arraste-a para a capa.',
  'library.tags.set.searchWeb': 'Buscar o álbum na internet',
  'library.tags.set.searchWebNote':
    'Abre o álbum no MusicBrainz, no seu navegador. O FluidEQ não baixa nada.',
  'library.tags.write.undoAsk':
    'Restaurar as tags anteriores de {count} arquivos?',
  'library.tags.write.undoAskOne': 'Restaurar as tags anteriores de 1 arquivo?',
  'library.tags.write.undoKeep': 'Não',
  'library.tags.write.undoConfirm': 'Desfazer',
};

export default libraryTags;
