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

/** The Library tab: local music and video files. */
import { Dictionary } from '../en';

const library: Partial<Dictionary> = {
  'tabs.library': 'Biblioteca',

  'library.empty.title': 'Ainda sem música',
  'library.empty.body':
    'Adicione uma pasta e o FluidEQ vai ler as músicas e os vídeos que ela contém.',
  'library.empty.add': 'Adicionar pasta',
  'library.empty.drop': 'ou solte uma pasta aqui',
  'library.empty.feature.sound': 'Cada música toca pelo seu EQ e DSP',
  'library.empty.feature.lyrics': 'Letras que acendem palavra por palavra',
  'library.empty.feature.browse':
    'Álbuns, Cover Flow, A seguir e Me surpreenda',
  'library.karaokeSkipped':
    '{count} músicas de karaokê ignoradas — abra-as na aba Karaokê',

  'library.add': 'Adicionar pasta',
  'library.rescan': 'Escanear novamente',
  'library.rescan.force': 'Forçar nova leitura',
  'library.searchPlaceholder': 'Pesquisar músicas, artistas, álbuns',

  'library.browse.album': 'Álbuns',
  'library.browse.artist': 'Artistas',
  'library.browse.genre': 'Gêneros',
  'library.browse.song': 'Músicas',
  'library.browse.folder': 'Pastas',
  'library.jumpTo': 'Ir para uma letra',
  'library.coverflow.previous': 'Capa anterior',
  'library.coverflow.next': 'Próxima capa',
  'library.coverflow.emptyTitle': 'Nada aqui',
  'library.coverflow.emptyHint':
    'Esta estante não tem nada para mostrar aqui. Escolha outra estante ou pasta.',
  'library.coverflow.noMatchTitle': 'Nenhum resultado para “{query}”',
  'library.coverflow.noMatchHint': 'Tente outras palavras ou limpe a busca.',
  'library.filterHere': 'Filtrar estas músicas',
  'library.view.list': 'Detalhes',
  'library.view.grid': 'Grade',
  'library.view.coverflow': 'Cover Flow',
  'library.rail.library': 'Biblioteca',
  'library.rail.allPlaylists': 'Todas as playlists',
  'library.roots.manage': 'Suas pastas',
  'library.rail.resize': 'Largura da lista',
  'library.tree.more': 'Mais {count}…',
  'library.history': 'Voltar e avançar',
  'library.forward': 'Avançar',
  'library.length.minutes': '{minutes} min',
  'library.length.hours': '{hours} h {minutes} min',
  'library.status.songs': '{count} músicas',
  'library.status.songsOne': '{count} música',
  'library.status.albums': '{count} álbuns',
  'library.status.albumsOne': '{count} álbum',
  'library.status.videos': '{count} vídeos',
  'library.status.videosOne': '{count} vídeo',
  'library.status.upToDate': 'Biblioteca atualizada',
  'library.sort.plays': 'Mais tocadas',
  'library.sort.length': 'Duração',
  'library.column.genre': 'Gênero',
  'library.column.format': 'Formato',
  'library.column.plays': 'Reproduções',
  'library.columns.choose': 'Escolher colunas',
  'library.kind.album': 'Álbum',
  'library.kind.artist': 'Artista',
  'library.kind.genre': 'Gênero',
  'library.kind.folder': 'Pasta',
  'library.kind.folderAlbum': 'Pasta · álbum dentro',
  'library.kind.playlist': 'Playlist',
  'library.pane.details': 'Detalhes',
  'library.pane.lyrics': 'Letra',
  'library.pane.tabs': 'O que o painel mostra',
  'library.now.nothing': 'Nada tocando',
  'library.now.nothingHint': 'Escolha uma música para começar',
  'library.facts.nothing': 'Toque uma música para ver os detalhes',
  'library.facts.song': 'Música',
  'library.facts.file': 'Arquivo',
  'library.facts.sound': 'Som',
  'library.facts.location': 'Local',
  'library.facts.track': 'Faixa',
  'library.facts.disc': 'Disco',
  'library.facts.codec': 'Codec',
  'library.facts.bitrate': 'Taxa de bits',
  'library.facts.sampleRate': 'Taxa de amostragem',
  'library.facts.bitDepth': 'Profundidade de bits',
  'library.facts.channels': 'Canais',
  'library.facts.mono': 'Mono',
  'library.facts.stereo': 'Estéreo',
  'library.facts.channelCount': '{count} canais',
  'library.facts.duration': 'Duração',
  'library.facts.size': 'Tamanho',
  'library.facts.loudness': 'Loudness',
  'library.facts.truePeak': 'Pico real',
  'library.facts.lossless': 'Sem perdas',
  'library.facts.lossy': 'Com perdas',
  'library.facts.kbps': '{value} kbps',
  'library.facts.khz': '{value} kHz',
  'library.facts.bits': '{value} bits',
  'library.facts.mb': '{value} MB',
  'library.facts.lufs': '{value} LUFS',
  'library.facts.dbtp': '{value} dBTP',
  'library.facts.readFailed':
    'O FluidEQ não conseguiu ler os detalhes deste arquivo.',
  'library.lyrics.nothing': 'Toque uma música para ver a letra',
  'library.lyrics.none': 'Esta música não tem letra',
  'library.lyrics.looked':
    'O FluidEQ procurou nas tags da música e um arquivo .lrc ou .txt com o mesmo nome ao lado.',
  'library.lyrics.fromTags': 'Das tags da música',
  'library.lyrics.fromFile': 'De {name}',
  'library.lyrics.reading': 'Procurando a letra…',
  'library.lyrics.follow': 'Voltar para a linha que está tocando',
  'library.lyrics.listLabel':
    'Letra. Clique em uma linha para tocar a partir dela.',
  'library.lyrics.find.heading': 'Encontre on-line',
  'library.lyrics.find.free': 'Grátis, sincronizadas',
  'library.lyrics.find.licensed': 'Letras licenciadas',
  'library.lyrics.find.open':
    'Pesquisar esta música no {site} no seu navegador',
  'library.lyrics.find.searches':
    'Pesquisa “{query}”. Baixe ou copie a letra lá e depois traga-a aqui embaixo.',
  'library.lyrics.import.heading': 'Guardar com a música',
  'library.lyrics.import.file': 'Importar letra…',
  'library.lyrics.import.paste': 'Colar',
  'library.lyrics.import.drop': 'Ou solte um arquivo .lrc ou .txt nesta aba.',
  'library.lyrics.import.pasteLabel': 'Letra para guardar com esta música',
  'library.lyrics.import.pastePlaceholder':
    'Cole a letra ou um .lrc sincronizado',
  'library.lyrics.import.save': 'Salvar letra',
  'library.lyrics.import.cancel': 'Cancelar',
  'library.lyrics.import.busy': 'Salvando a letra…',
  'library.lyrics.import.exists':
    '{name} já está ao lado da música. Substituir?',
  'library.lyrics.import.existsKept':
    'O FluidEQ já guarda uma letra para esta música. Substituir?',
  'library.lyrics.import.replace': 'Substituir',
  'library.lyrics.import.keep': 'Manter a antiga',
  'library.lyrics.import.savedBeside': 'Salva ao lado da música como {name}',
  'library.lyrics.import.savedKept':
    'Salva na pasta de letras do FluidEQ: não é possível gravar na pasta da música',
  'library.lyrics.import.shadowed':
    'Salva como {name}. A letra que já está na música aparece primeiro.',
  'library.lyrics.import.shadowedKept':
    'Salva na pasta de letras do FluidEQ. A letra que já está na música aparece primeiro.',
  'library.lyrics.import.tooBig':
    'O arquivo tem mais de 512 KB, grande demais para ser uma letra.',
  'library.lyrics.import.notText': 'O arquivo não é de texto.',
  'library.lyrics.import.empty': 'Não há nenhuma letra nele.',
  'library.lyrics.import.notLyricsFile':
    'Só é possível importar arquivos .lrc ou .txt.',
  'library.lyrics.import.failed': 'Não foi possível salvar a letra.',
  'library.lyrics.fromKept':
    'Da pasta de letras do FluidEQ: não é possível gravar na pasta da música',
  'library.lyrics.other': 'Encontrar outra letra',
  'library.lyrics.back': 'Voltar à letra',
  'library.view.aria': 'Como a biblioteca é exibida',
  'library.browse.aria': 'O que a biblioteca está mostrando',

  'library.sort': 'Ordenar',
  'library.sortBy': 'Ordenar: {value}',
  'library.sort.direction': 'Direção da ordenação',
  'library.sort.title': 'Título',
  'library.sort.artist': 'Artista',
  'library.sort.album': 'Álbum',
  'library.sort.year': 'Ano',
  'library.sort.added': 'Adicionados recentemente',
  'library.sort.track': 'Ordem do disco',
  'library.sort.name': 'Nome',
  'library.sort.count': 'Mais faixas',

  'library.column.title': 'Título',
  'library.column.artist': 'Artista',
  'library.column.album': 'Álbum',
  'library.column.year': 'Ano',
  'library.column.length': 'Tempo',
  'library.column.trackNo': 'Número da faixa',

  'library.unknownAlbum': 'Álbum desconhecido',
  'library.unknownArtist': 'Artista desconhecido',
  'library.genre.unknown': 'Gênero desconhecido',
  'library.trackCount': '{count} músicas',
  'library.albumCount': '{count} álbuns',
  'library.artistCount': '{count} artistas',
  'library.trackCountOne': '1 música',
  'library.albumCountOne': '1 álbum',
  'library.artistCountOne': '1 artista',

  'library.videos': 'Vídeos',
  'library.videos.empty': 'Não há vídeos nas pastas que você adicionou.',

  'library.scan.running': 'Lendo {name}',
  'library.scan.counted': '{parsed} de {seen} arquivos',
  'library.scan.cancel': 'Parar',
  'library.scan.hide': 'Ocultar este aviso',
  'library.scan.hideHint':
    'Ocultar este aviso. A Biblioteca continua lendo seus arquivos.',
  'library.scan.chip': 'Lendo {percent}%',
  'library.scan.chipFinding': 'Lendo…',
  'library.scan.show': 'Mostrar de novo o progresso e Parar',

  'library.roots': 'Pastas',
  'library.root.remove': 'Remover esta pasta',
  'library.root.offline': 'Esta pasta não está disponível no momento',
  // Sem "de Arquivos": a linha do menu tem 232px e o nome longo era cortado.
  'library.reveal': 'Mostrar no Explorador',
  'library.trackMenu': 'Mais ações',

  'library.unplayable': 'O FluidEQ não consegue reproduzir este formato',
  'library.metadataError': 'O FluidEQ não conseguiu ler as tags deste arquivo.',
  'library.pending':
    'Este arquivo foi encontrado e seus dados ainda estão sendo lidos.',
  'library.indexReset':
    'O índice da biblioteca não pôde ser lido e foi reconstruído.',

  'library.back': 'Voltar',
  'library.place.aria': 'Onde você está na biblioteca',
  'library.place.allHint': 'Sair desta pasta e mostrar toda a sua biblioteca',
  'library.search.near': 'Em {folder}',
  'library.search.nearEmpty': 'Nada em {folder}',
  'library.search.elsewhere': 'No resto da sua biblioteca',

  'library.upNext': 'A seguir',
  'library.upNext.empty': 'Nada na fila',
  'library.upNext.added': 'Suas escolhas',
  'library.upNext.rest': 'Depois',
  'library.upNext.continued': 'Mais deste estilo',
  'library.upNext.keepPlaying': 'Continuar tocando',
  'library.upNext.keepPlayingHint':
    'Quando a lista acabar, continua com mais música do mesmo gênero e, quando não houver mais, com uma surpresa',
  'library.upNext.surprise': 'Me surpreenda',
  'library.upNext.surpriseHint':
    'Tocar uma música aleatória da sua biblioteca e depois mais do mesmo estilo',
  'library.upNext.surpriseStart':
    'Uma música aleatória da sua biblioteca e depois mais do mesmo estilo.',
  'library.upNext.surpriseNext':
    'Quando esta música acabar, Me surpreenda escolhe a próxima.',
  'library.upNext.surpriseNothing':
    'No momento, nada na sua biblioteca pode ser tocado.',
  'library.queueAdd': 'Adicionar à fila',

  'library.alsoInFolder': 'Nesta pasta, não neste álbum',
  'library.play': 'Reproduzir',
  'library.pause': 'Pausar',
  'library.stop': 'Parar',
  'library.previous': 'Anterior',
  'library.back5': 'Voltar 5 segundos',
  'library.forward5': 'Avançar 5 segundos',
  'library.next': 'Próximo',
  'library.shuffle': 'Aleatório',
  'library.repeat.all': 'Repetir tudo',
  'library.repeat.one': 'Repetir esta música',
  'library.repeat.off': 'Não repetir',
  'library.volume': 'Volume',
  'library.mute': 'Silenciar',
  'library.unmute': 'Reativar som',
  'library.playbackOptions': 'Opções de reprodução',
  'library.position': 'Posição',
  'library.queue.remove': 'Remover da fila',
  'library.nowPlaying': 'Tocando agora',
  'library.nothingPlaying': 'Nada tocando',
  'library.nothingPlayingHint': 'Escolha algo para tocar',
  'library.systemAudio': 'Áudio do sistema',
  'library.remoteAudio': 'Reprodução remota · {name}',
  'library.remoteAudioDelay': 'Reprodução remota · {name} · {milliseconds} ms',

  'library.trackActions': 'O que fazer com esta música',
  'library.browse.playlist': 'Playlists',
  'library.playlist.favorites': 'Favoritos',
  'library.playlist.addToFavorites': 'Adicionar aos Favoritos',
  'library.playlist.removeFromFavorites': 'Remover dos Favoritos',
  'library.playlist.favorite': 'Nos seus Favoritos',
  'library.playlist.addTo': 'Adicionar a uma playlist',
  'library.playlist.alreadyIn': 'Já está nesta playlist',
  'library.playlist.removeFrom': 'Remover desta playlist',
  'library.playlist.new': 'Nova playlist',
  'library.playlist.newName': 'Nome da playlist',
  'library.playlist.create': 'Criar',
  'library.playlist.rename': 'Renomear',
  'library.playlist.keep': 'Manter',
  'library.playlist.delete': 'Excluir a playlist',
  'library.playlist.deleteConfirm':
    'Excluir “{name}”? As músicas continuam na sua biblioteca.',
  'library.playlist.builtIn':
    'Favoritos está sempre aqui e não pode ser removido',
  'library.playlist.songCount': '{count} músicas',
  'library.playlist.songCountOne': '1 música',
  'library.playlist.empty': 'Ainda não há nada nesta playlist',
  'library.playlist.emptyHint':
    'Clique com o botão direito numa música e escolha “Adicionar a uma playlist”.',
  'library.playlist.missing':
    '{count} músicas desta playlist não estão na sua biblioteca no momento',
  'library.playlist.reset':
    'Não foi possível ler as suas playlists e elas foram redefinidas.',
  'library.karaoke.send': 'Enviar para o Karaokê',
  'library.karaoke.sending': 'Enviando para o Karaokê…',
  'library.karaoke.failed':
    'Não foi possível enviar este arquivo para o Karaokê — ele pode ser grande demais ou ilegível.',
  'library.drop.empty': 'Não há música no que você soltou',
  'library.drop.already': 'Tudo o que você soltou já está em “A seguir”',
  'library.drop.failed': 'Não foi possível adicionar a música que você soltou',
};

export default library;
