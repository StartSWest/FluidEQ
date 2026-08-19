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
  'library.search': 'Pesquisar na biblioteca',
  'library.searchPlaceholder': 'Pesquisar músicas, artistas, álbuns',

  'library.browse.album': 'Álbuns',
  'library.browse.artist': 'Artistas',
  'library.browse.song': 'Músicas',
  'library.view.list': 'Lista',
  'library.view.grid': 'Grade',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Como a biblioteca é exibida',
  'library.browse.aria': 'O que a biblioteca está mostrando',

  'library.sort': 'Ordenar',
  'library.sort.title': 'Título',
  'library.sort.artist': 'Artista',
  'library.sort.album': 'Álbum',
  'library.sort.year': 'Ano',
  'library.sort.added': 'Adicionados recentemente',

  'library.column.title': 'Título',
  'library.column.artist': 'Artista',
  'library.column.album': 'Álbum',
  'library.column.year': 'Ano',
  'library.column.length': 'Duração',

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
  'library.reveal': 'Mostrar no Explorador de Arquivos',

  'library.unplayable': 'O FluidEQ não consegue reproduzir este formato',
  'library.metadataError': 'O FluidEQ não conseguiu ler as tags deste arquivo.',
  'library.indexReset':
    'O índice da biblioteca não pôde ser lido e foi reconstruído.',

  'library.play': 'Reproduzir',
  'library.pause': 'Pausar',
  'library.previous': 'Anterior',
  'library.next': 'Seguinte',
  'library.shuffle': 'Aleatório',
  'library.repeat': 'Repetir',
  'library.repeat.all': 'Repetir tudo',
  'library.repeat.one': 'Repetir esta música',
  'library.repeat.off': 'Não repetir',
  'library.volume': 'Volume',
  'library.position': 'Posição',
  'library.queue': 'Fila',
  'library.queue.remove': 'Remover da fila',
  'library.nowPlaying': 'Tocando agora',
  'library.fullScreen': 'Tela inteira',
};

export default library;
