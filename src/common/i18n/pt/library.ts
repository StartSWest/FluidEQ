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
  'library.karaokeSkipped':
    '{count} músicas de karaokê ignoradas — abra-as na aba Karaokê',

  'library.add': 'Adicionar pasta',
  'library.rescan': 'Escanear novamente',
  'library.rescan.force': 'Forçar nova leitura',
  'library.search': 'Pesquisar na biblioteca',
  'library.searchPlaceholder': 'Pesquisar músicas, artistas, álbuns',

  'library.browse.album': 'Álbuns',
  'library.browse.artist': 'Artistas',
  'library.browse.song': 'Músicas',
  'library.browse.folder': 'Pastas',
  'library.browse.directory': 'Árvore',
  'library.browse.folderHint': 'Todas as pastas com música, de uma vez',
  'library.browse.directoryHint': 'Da pasta raiz para dentro',
  'library.browse.folderReading': 'Como as pastas são lidas',
  'library.jumpTo': 'Ir para uma letra',
  'library.coverflow.previous': 'Capa anterior',
  'library.coverflow.next': 'Próxima capa',
  'library.folderCount': '{count} pastas',
  'library.filterHere': 'Filtrar estas músicas',
  'library.view.list': 'Lista',
  'library.view.grid': 'Grade',
  'library.view.coverflow': 'Cover Flow',
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

  'library.column.title': 'Título',
  'library.column.artist': 'Artista',
  'library.column.album': 'Álbum',
  'library.column.year': 'Ano',
  'library.column.length': 'Duração',
  'library.column.trackNo': 'Número da faixa',

  'library.unknownAlbum': 'Álbum desconhecido',
  'library.unknownArtist': 'Artista desconhecido',
  'library.trackCount': '{count} músicas',
  'library.albumCount': '{count} álbuns',

  'library.videos': 'Vídeos',
  'library.videos.empty': 'Não há vídeos nas pastas que você adicionou.',

  'library.scan.running': 'Lendo {name}',
  'library.scan.counted': '{parsed} de {seen} arquivos',
  'library.scan.cancel': 'Parar',
  'library.scan.background': 'Continuar em segundo plano',
  'library.scan.done': '{count} músicas adicionadas',

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

  'library.upNext': 'A seguir',
  'library.upNext.empty': 'Nada na fila',
  'library.upNext.added': 'As suas escolhas',
  'library.upNext.rest': 'Depois',
  'library.queueAdd': 'Adicionar à fila',

  'library.alsoInFolder': 'Nesta pasta, não neste álbum',
  'library.play': 'Reproduzir',
  'library.pause': 'Pausar',
  'library.stop': 'Parar',
  'library.previous': 'Anterior',
  'library.back5': 'Voltar 5 segundos',
  'library.forward5': 'Avançar 5 segundos',
  'library.next': 'Seguinte',
  'library.shuffle': 'Aleatório',
  'library.repeat': 'Repetir',
  'library.repeat.all': 'Repetir tudo',
  'library.repeat.one': 'Repetir esta música',
  'library.repeat.off': 'Não repetir',
  'library.volume': 'Volume',
  'library.mute': 'Silenciar',
  'library.unmute': 'Reativar som',
  'library.playbackOptions': 'Opções de reprodução',
  'library.position': 'Posição',
  'library.queue': 'Fila',
  'library.queue.remove': 'Remover da fila',
  'library.nowPlaying': 'Tocando agora',
  'library.nothingPlaying': 'Nada tocando',
  'library.nothingPlayingHint': 'Escolhe algo para tocar',
  'library.systemAudio': 'Áudio do sistema',
  'library.fullScreen': 'Tela inteira',

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
};

export default library;
