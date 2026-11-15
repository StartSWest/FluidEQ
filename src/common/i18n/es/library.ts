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
  'library.empty.feature.sound': 'Cada canción suena con tu EQ y tu DSP',
  'library.empty.feature.lyrics': 'Letras que se iluminan palabra por palabra',
  'library.empty.feature.browse':
    'Álbumes, Cover Flow, A continuación y Sorpréndeme',
  'library.karaokeSkipped':
    '{count} canciones de karaoke omitidas — ábrelas en la pestaña Karaoke',

  'library.add': 'Añadir carpeta',
  'library.rescan': 'Volver a escanear',
  'library.rescan.force': 'Forzar nuevo análisis',
  'library.searchPlaceholder': 'Buscar canciones, artistas, álbumes',

  'library.browse.album': 'Álbumes',
  'library.browse.artist': 'Artistas',
  'library.browse.genre': 'Géneros',
  'library.browse.song': 'Canciones',
  'library.browse.folder': 'Carpetas',
  'library.jumpTo': 'Ir a una letra',
  'library.coverflow.previous': 'Portada anterior',
  'library.coverflow.next': 'Portada siguiente',
  'library.filterHere': 'Filtrar estas canciones',
  'library.view.list': 'Detalles',
  'library.view.grid': 'Cuadrícula',
  'library.view.coverflow': 'Cover Flow',
  'library.rail.library': 'Biblioteca',
  'library.rail.allPlaylists': 'Todas las listas',
  'library.roots.manage': 'Tus carpetas',
  'library.rail.resize': 'Ancho de la lista',
  'library.tree.more': '{count} más…',
  'library.history': 'Atrás y adelante',
  'library.forward': 'Adelante',
  'library.length.minutes': '{minutes} min',
  'library.length.hours': '{hours} h {minutes} min',
  'library.status.songs': '{count} canciones',
  'library.status.songsOne': '{count} canción',
  'library.status.albums': '{count} álbumes',
  'library.status.albumsOne': '{count} álbum',
  'library.status.videos': '{count} vídeos',
  'library.status.videosOne': '{count} vídeo',
  'library.status.upToDate': 'Biblioteca al día',
  'library.sort.plays': 'Más escuchadas',
  'library.sort.length': 'Duración',
  'library.column.genre': 'Género',
  'library.column.format': 'Formato',
  'library.column.plays': 'Escuchas',
  'library.columns.choose': 'Elegir columnas',
  'library.kind.album': 'Álbum',
  'library.kind.artist': 'Artista',
  'library.kind.genre': 'Género',
  'library.kind.folder': 'Carpeta',
  'library.kind.folderAlbum': 'Carpeta · álbum dentro',
  'library.kind.playlist': 'Lista',
  'library.pane.details': 'Detalles',
  'library.pane.lyrics': 'Letra',
  'library.pane.tabs': 'Qué muestra el panel',
  'library.now.nothing': 'No suena nada',
  'library.now.nothingHint': 'Elige una canción para empezar',
  'library.facts.nothing': 'Reproduce una canción para ver sus detalles',
  'library.facts.song': 'Canción',
  'library.facts.file': 'Archivo',
  'library.facts.sound': 'Sonido',
  'library.facts.location': 'Ubicación',
  'library.facts.track': 'Pista',
  'library.facts.disc': 'Disco',
  'library.facts.codec': 'Códec',
  'library.facts.bitrate': 'Tasa de bits',
  'library.facts.sampleRate': 'Frecuencia de muestreo',
  'library.facts.bitDepth': 'Profundidad de bits',
  'library.facts.channels': 'Canales',
  'library.facts.mono': 'Mono',
  'library.facts.stereo': 'Estéreo',
  'library.facts.channelCount': '{count} canales',
  'library.facts.duration': 'Duración',
  'library.facts.size': 'Tamaño',
  'library.facts.loudness': 'Sonoridad',
  'library.facts.truePeak': 'Pico real',
  'library.facts.lossless': 'Sin pérdida',
  'library.facts.lossy': 'Con pérdida',
  'library.facts.kbps': '{value} kbps',
  'library.facts.khz': '{value} kHz',
  'library.facts.bits': '{value} bits',
  'library.facts.mb': '{value} MB',
  'library.facts.lufs': '{value} LUFS',
  'library.facts.dbtp': '{value} dBTP',
  'library.facts.readFailed':
    'FluidEQ no pudo leer los detalles de este archivo.',
  'library.lyrics.nothing': 'Reproduce una canción para ver su letra',
  'library.lyrics.none': 'Esta canción no tiene letra',
  'library.lyrics.looked':
    'FluidEQ buscó en las etiquetas de la canción y un archivo .lrc o .txt con el mismo nombre a su lado.',
  'library.lyrics.fromTags': 'De las etiquetas de la canción',
  'library.lyrics.fromFile': 'De {name}',
  'library.lyrics.reading': 'Buscando la letra…',
  'library.lyrics.follow': 'Volver a la línea que suena',
  'library.lyrics.listLabel':
    'Letra. Pulsa una línea para reproducir desde ahí.',
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
  'library.sort.name': 'Nombre',
  'library.sort.count': 'Más pistas',

  'library.column.title': 'Título',
  'library.column.artist': 'Artista',
  'library.column.album': 'Álbum',
  'library.column.year': 'Año',
  'library.column.length': 'Tiempo',
  'library.column.trackNo': 'Número de pista',

  'library.unknownAlbum': 'Álbum desconocido',
  'library.unknownArtist': 'Artista desconocido',
  'library.genre.unknown': 'Género desconocido',
  'library.trackCount': '{count} canciones',
  'library.albumCount': '{count} álbumes',
  'library.artistCount': '{count} artistas',
  'library.trackCountOne': '1 canción',
  'library.albumCountOne': '1 álbum',
  'library.artistCountOne': '1 artista',

  'library.videos': 'Vídeos',
  'library.videos.empty': 'No hay vídeos en las carpetas que has añadido.',

  'library.scan.running': 'Leyendo {name}',
  'library.scan.counted': '{parsed} de {seen} archivos',
  'library.scan.cancel': 'Detener',
  'library.scan.hide': 'Ocultar este aviso',
  'library.scan.hideHint':
    'Ocultar este aviso. La Biblioteca sigue leyendo tus archivos.',
  'library.scan.chip': 'Leyendo {percent} %',
  'library.scan.chipFinding': 'Leyendo…',
  'library.scan.show': 'Volver a mostrar el progreso y Detener',

  'library.roots': 'Carpetas',
  'library.root.remove': 'Quitar esta carpeta',
  'library.root.offline': 'Esta carpeta no está disponible en este momento',
  // Sin "de archivos": es como lo llama Windows, y la fila del menú mide
  // 232px — el nombre largo se cortaba con puntos suspensivos.
  'library.reveal': 'Mostrar en el Explorador',
  'library.trackMenu': 'Más acciones',

  'library.unplayable': 'FluidEQ no puede reproducir este formato',
  'library.metadataError':
    'FluidEQ no pudo leer las etiquetas de este archivo.',
  'library.pending':
    'Este archivo se ha encontrado y todavía se están leyendo sus datos.',
  'library.indexReset':
    'El índice de la biblioteca no se pudo leer y se ha reconstruido.',

  'library.back': 'Atrás',
  'library.place.aria': 'Dónde estás en la biblioteca',
  'library.place.allHint': 'Salir de esta carpeta y ver toda tu biblioteca',
  'library.search.near': 'En {folder}',
  'library.search.nearEmpty': 'Nada en {folder}',
  'library.search.elsewhere': 'En el resto de tu biblioteca',

  'library.upNext': 'A continuación',
  'library.upNext.empty': 'Nada en cola todavía',
  'library.upNext.added': 'Tu selección',
  'library.upNext.rest': 'Después',
  'library.upNext.continued': 'Más de este estilo',
  'library.upNext.keepPlaying': 'Seguir sonando',
  'library.upNext.keepPlayingHint':
    'Cuando se acabe la lista, continúa con más música del mismo género y, cuando no quede, con una sorpresa',
  'library.upNext.surprise': 'Sorpréndeme',
  'library.upNext.surpriseHint':
    'Reproduce una canción al azar de tu biblioteca y después más de su estilo',
  'library.upNext.surpriseStart':
    'Una canción al azar de tu biblioteca y después más de su estilo.',
  'library.upNext.surpriseNext':
    'Cuando termine esta canción, Sorpréndeme elegirá la siguiente.',
  'library.upNext.surpriseNothing':
    'Ahora mismo no hay nada en tu biblioteca que se pueda reproducir.',
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
  'library.repeat.all': 'Repetir todo',
  'library.repeat.one': 'Repetir esta canción',
  'library.repeat.off': 'No repetir',
  'library.volume': 'Volumen',
  'library.mute': 'Silenciar',
  'library.unmute': 'Activar sonido',
  'library.playbackOptions': 'Opciones de reproducción',
  'library.position': 'Posición',
  'library.queue.remove': 'Quitar de la cola',
  'library.nowPlaying': 'Reproduciendo ahora',
  'library.nothingPlaying': 'No suena nada',
  'library.nothingPlayingHint': 'Elige algo para reproducir',
  'library.systemAudio': 'Audio del sistema',
  'library.remoteAudio': 'Reproduciendo remoto · {name}',
  'library.remoteAudioDelay':
    'Reproduciendo remoto · {name} · {milliseconds} ms',

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
  'library.drop.empty': 'No hay música en lo que soltaste',
  'library.drop.already': 'Todo lo que soltaste ya está en «A continuación»',
  'library.drop.failed': 'No se pudo añadir la música que soltaste',
};

export default library;
