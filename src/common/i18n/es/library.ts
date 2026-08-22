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
  'library.rescan.force': 'Forzar nuevo análisis',
  'library.search': 'Buscar en la biblioteca',
  'library.searchPlaceholder': 'Buscar canciones, artistas, álbumes',

  'library.browse.album': 'Álbumes',
  'library.browse.artist': 'Artistas',
  'library.browse.song': 'Canciones',
  'library.browse.folder': 'Carpetas',
  'library.browse.directory': 'Árbol',
  'library.browse.folderHint': 'Todas las carpetas con música, de una vez',
  'library.browse.directoryHint': 'Desde la carpeta raíz hacia dentro',
  'library.browse.folderReading': 'Cómo se leen las carpetas',
  'library.jumpTo': 'Ir a una letra',
  'library.coverflow.previous': 'Portada anterior',
  'library.coverflow.next': 'Portada siguiente',
  'library.folderCount': '{count} carpetas',
  'library.filterHere': 'Filtrar estas canciones',
  'library.groupByFolder': 'Agrupar por carpeta',
  'library.view.list': 'Lista',
  'library.view.grid': 'Cuadrícula',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Cómo se muestra la biblioteca',
  'library.browse.aria': 'Qué está mostrando la biblioteca',

  'library.sort': 'Ordenar',
  'library.sortBy': 'Ordenar: {value}',
  'library.sort.direction': 'Dirección de ordenación',
  'library.sort.title': 'Título',
  'library.sort.artist': 'Artista',
  'library.sort.album': 'Álbum',
  'library.sort.year': 'Año',
  'library.sort.added': 'Añadidos recientemente',
  'library.sort.track': 'Orden del disco',

  'library.column.title': 'Título',
  'library.column.artist': 'Artista',
  'library.column.album': 'Álbum',
  'library.column.year': 'Año',
  'library.column.length': 'Duración',
  'library.column.trackNo': 'Número de pista',

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
  'library.pending':
    'Este archivo se ha encontrado y todavía se están leyendo sus datos.',
  'library.indexReset':
    'El índice de la biblioteca no se pudo leer y se ha reconstruido.',

  'library.back': 'Atrás',

  'library.upNext': 'A continuación',
  'library.upNext.empty': 'Nada en cola todavía',
  'library.upNext.added': 'Tu selección',
  'library.upNext.rest': 'Después',
  'library.queueAdd': 'Añadir a la cola',

  'library.alsoInFolder': 'En esta carpeta, no en este álbum',
  'library.play': 'Reproducir',
  'library.pause': 'Pausar',
  'library.stop': 'Detener',
  'library.previous': 'Anterior',
  'library.back5': 'Retroceder 5 segundos',
  'library.forward5': 'Avanzar 5 segundos',
  'library.next': 'Siguiente',
  'library.shuffle': 'Aleatorio',
  'library.repeat': 'Repetir',
  'library.repeat.all': 'Repetir todo',
  'library.repeat.one': 'Repetir esta canción',
  'library.repeat.off': 'No repetir',
  'library.volume': 'Volumen',
  'library.mute': 'Silenciar',
  'library.unmute': 'Activar sonido',
  'library.playbackOptions': 'Opciones de reproducción',
  'library.position': 'Posición',
  'library.queue': 'Cola',
  'library.queue.remove': 'Quitar de la cola',
  'library.nowPlaying': 'Reproduciendo ahora',
  'library.nothingPlaying': 'No suena nada',
  'library.nothingPlayingHint': 'Elige algo para reproducir',
  'library.systemAudio': 'Audio del sistema',
  'library.fullScreen': 'Pantalla completa',

  'library.trackActions': 'Qué hacer con esta canción',
  'library.browse.playlist': 'Listas',
  'library.playlist.favorites': 'Favoritos',
  'library.playlist.addToFavorites': 'Añadir a Favoritos',
  'library.playlist.removeFromFavorites': 'Quitar de Favoritos',
  'library.playlist.favorite': 'En tus Favoritos',
  'library.playlist.addTo': 'Añadir a una lista',
  'library.playlist.alreadyIn': 'Ya está en esta lista',
  'library.playlist.removeFrom': 'Quitar de esta lista',
  'library.playlist.new': 'Nueva lista',
  'library.playlist.newName': 'Nombre de la lista',
  'library.playlist.create': 'Crear',
  'library.playlist.rename': 'Cambiar el nombre',
  'library.playlist.keep': 'Conservarla',
  'library.playlist.delete': 'Eliminar la lista',
  'library.playlist.deleteConfirm':
    '¿Eliminar «{name}»? Las canciones seguirán en tu biblioteca.',
  'library.playlist.builtIn':
    'Favoritos siempre está aquí y no se puede quitar',
  'library.playlist.songCount': '{count} canciones',
  'library.playlist.songCountOne': '1 canción',
  'library.playlist.empty': 'Esta lista todavía está vacía',
  'library.playlist.emptyHint':
    'Haz clic derecho en una canción y elige «Añadir a una lista».',
  'library.playlist.missing':
    '{count} canciones de esta lista no están en tu biblioteca ahora mismo',
  'library.playlist.reset':
    'No se pudieron leer tus listas y se han reiniciado.',
  'library.karaoke.send': 'Enviar a Karaoke',
  'library.karaoke.sending': 'Enviando a Karaoke…',
  'library.karaoke.failed':
    'No se pudo enviar este archivo a Karaoke: puede ser demasiado grande o ilegible.',
};

export default library;
