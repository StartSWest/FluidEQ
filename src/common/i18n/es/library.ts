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

  'library.empty.title': 'Todavía no hay música',
  'library.empty.body':
    'Añade una carpeta y FluidEQ leerá las canciones y los vídeos que contenga.',
  'library.empty.add': 'Añadir carpeta',
  'library.empty.drop': 'o suelta una carpeta aquí',
  'library.karaokeSkipped':
    '{count} canciones de karaoke omitidas — ábrelas en la pestaña Karaoke',

  'library.add': 'Añadir carpeta',
  'library.rescan': 'Volver a escanear',
  'library.search': 'Buscar en la biblioteca',
  'library.searchPlaceholder': 'Buscar canciones, artistas, álbumes',

  'library.browse.album': 'Álbumes',
  'library.browse.artist': 'Artistas',
  'library.browse.song': 'Canciones',
  'library.view.list': 'Lista',
  'library.view.grid': 'Cuadrícula',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Cómo se muestra la biblioteca',
  'library.browse.aria': 'Qué está mostrando la biblioteca',

  'library.sort': 'Ordenar',
  'library.sort.title': 'Título',
  'library.sort.artist': 'Artista',
  'library.sort.album': 'Álbum',
  'library.sort.year': 'Año',
  'library.sort.added': 'Añadidos recientemente',

  'library.column.title': 'Título',
  'library.column.artist': 'Artista',
  'library.column.album': 'Álbum',
  'library.column.year': 'Año',
  'library.column.length': 'Duración',

  'library.unknownAlbum': 'Álbum desconocido',
  'library.unknownArtist': 'Artista desconocido',
  'library.trackCount': '{count} canciones',
  'library.albumCount': '{count} álbumes',

  'library.videos': 'Vídeos',
  'library.videos.empty': 'No hay vídeos en las carpetas que has añadido.',

  'library.scan.running': 'Leyendo {name}',
  'library.scan.counted': '{parsed} de {seen} archivos',
  'library.scan.cancel': 'Detener',
  'library.scan.background': 'Continuar en segundo plano',
  'library.scan.done': '{count} canciones añadidas',

  'library.roots': 'Carpetas',
  'library.root.remove': 'Quitar esta carpeta',
  'library.root.offline': 'Esta carpeta no está disponible en este momento',
  'library.reveal': 'Mostrar en el Explorador de archivos',

  'library.unplayable': 'FluidEQ no puede reproducir este formato',
  'library.metadataError':
    'FluidEQ no pudo leer las etiquetas de este archivo.',
  'library.indexReset':
    'El índice de la biblioteca no se pudo leer y se ha reconstruido.',

  'library.play': 'Reproducir',
  'library.pause': 'Pausar',
  'library.previous': 'Anterior',
  'library.next': 'Siguiente',
  'library.shuffle': 'Aleatorio',
  'library.repeat': 'Repetir',
  'library.repeat.all': 'Repetir todo',
  'library.repeat.one': 'Repetir esta canción',
  'library.repeat.off': 'No repetir',
  'library.volume': 'Volumen',
  'library.position': 'Posición',
  'library.queue': 'Cola',
  'library.queue.remove': 'Quitar de la cola',
  'library.nowPlaying': 'Reproduciendo ahora',
  'library.fullScreen': 'Pantalla completa',
};

export default library;
