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
  'library.coverflow.emptyTitle': 'Aquí no hay nada',
  'library.coverflow.emptyHint':
    'Este estante no tiene nada que mostrar aquí. Elige otro estante o carpeta.',
  'library.coverflow.noMatchTitle': 'Sin resultados para «{query}»',
  'library.coverflow.noMatchHint':
    'Prueba con otras palabras o borra la búsqueda.',
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
  'library.lyrics.find.heading': 'Búscala en internet',
  'library.lyrics.find.free': 'Gratis, con tiempos',
  'library.lyrics.find.licensed': 'Letras con licencia',
  'library.lyrics.find.open': 'Buscar esta canción en {site} en tu navegador',
  'library.lyrics.find.searches':
    'Busca «{query}». Descarga o copia la letra allí y luego tráela aquí abajo.',
  'library.lyrics.import.heading': 'Guárdala con la canción',
  'library.lyrics.import.file': 'Importar letra…',
  'library.lyrics.import.paste': 'Pegar',
  'library.lyrics.import.drop':
    'O suelta un archivo de letra en esta pestaña: .lrc, .srt, .vtt, .ttml, .json, .yaml o .txt.',
  'library.lyrics.import.pasteLabel': 'Letra que se guardará con esta canción',
  'library.lyrics.import.pastePlaceholder':
    'Pega la letra o un .lrc con tiempos',
  'library.lyrics.import.save': 'Guardar letra',
  'library.lyrics.import.cancel': 'Cancelar',
  'library.lyrics.import.busy': 'Guardando la letra…',
  'library.lyrics.import.exists':
    '{name} ya está junto a la canción. ¿Reemplazarlo?',
  'library.lyrics.import.existsKept':
    'FluidEQ ya guarda una letra para esta canción. ¿Reemplazarla?',
  'library.lyrics.import.replace': 'Reemplazar',
  'library.lyrics.import.keep': 'Conservar la anterior',
  'library.lyrics.import.savedBeside':
    'Guardada junto a la canción como {name}',
  'library.lyrics.import.savedKept':
    'Guardada en la carpeta de letras de FluidEQ: no se puede escribir en la carpeta de la canción',
  'library.lyrics.import.shadowed':
    'Guardada como {name}. Se muestra primero la letra que ya trae la canción.',
  'library.lyrics.import.shadowedKept':
    'Guardada en la carpeta de letras de FluidEQ. Se muestra primero la letra que ya trae la canción.',
  'library.lyrics.import.tooBig':
    'El archivo pasa de 512 KB: es demasiado grande para ser una letra.',
  'library.lyrics.import.notText': 'El archivo no es de texto.',
  'library.lyrics.import.empty': 'No contiene ninguna letra.',
  'library.lyrics.import.notLyricsFile':
    'Solo se pueden importar archivos de letra: .lrc, .srt, .vtt, .ttml, .json, .yaml o .txt.',
  'library.lyrics.import.failed': 'No se pudo guardar la letra.',
  'library.lyrics.fromKept':
    'De la carpeta de letras de FluidEQ: no se puede escribir en la carpeta de la canción',
  'library.lyrics.other': 'Buscar otra letra',
  'library.lyrics.back': 'Volver a la letra',
  'library.pane.subtitles': 'Subtítulos',
  'library.subtitles.reading': 'Buscando subtítulos…',
  'library.subtitles.none': 'Este vídeo no tiene subtítulos',
  'library.subtitles.looked':
    'FluidEQ buscó junto al vídeo un archivo .srt o .vtt con el mismo nombre. Tras el nombre puede ir un idioma: {example}.',
  'library.subtitles.variant': '{language} · {variant}',
  'library.subtitles.unreadable':
    'FluidEQ no pudo leer ninguna línea con tiempos en {name}.',
  'library.subtitles.find.heading': 'Búscalos en internet',
  'library.subtitles.find.moviesAndTv': 'Películas y series',
  'library.subtitles.find.tv': 'Series',
  'library.subtitles.find.open': 'Buscar este vídeo en {site} en tu navegador',
  'library.subtitles.find.searches':
    'Busca «{query}». Descarga allí un archivo .srt o .vtt y luego tráelo aquí abajo.',
  'library.subtitles.import.heading': 'Guárdalos con el vídeo',
  'library.subtitles.import.file': 'Importar subtítulos…',
  'library.subtitles.import.drop':
    'O suelta un archivo .srt o .vtt en esta pestaña. Se guarda junto al vídeo, con su nombre.',
  'library.subtitles.import.busy': 'Guardando los subtítulos…',
  'library.subtitles.import.saved': 'Guardados junto al vídeo como {name}',
  'library.subtitles.import.failed':
    'No se pudieron guardar los subtítulos junto al vídeo.',
  'library.subtitles.import.empty': 'No contiene ninguna línea con tiempos.',
  'library.subtitles.import.tooBig':
    'El archivo pasa de 2 MB, demasiado grande para ser subtítulos.',
  'library.subtitles.import.notText': 'El archivo no es de texto.',
  'library.subtitles.import.notSubtitles':
    'Solo se puede importar un archivo de subtítulos: .srt o .vtt.',
  'library.subtitles.unnamed': 'Subtítulos {number}',
  'library.subtitles.sample': 'Aquí aparecen los subtítulos',
  'library.subtitles.dragHint': 'Arrastra para colocar los subtítulos',
  'library.subtitles.menu': 'Subtítulos',
  'library.subtitles.show': 'Mostrar subtítulos',
  'library.subtitles.files': 'Archivos de subtítulos',
  'library.subtitles.settings': 'Estilo de los subtítulos',
  'library.subtitles.size': 'Tamaño',
  'library.subtitles.size.s': 'S',
  'library.subtitles.size.m': 'M',
  'library.subtitles.size.l': 'L',
  'library.subtitles.size.xl': 'XL',
  'library.subtitles.colour': 'Color',
  'library.subtitles.colour.white': 'Blanco',
  'library.subtitles.colour.yellow': 'Amarillo',
  'library.subtitles.colour.cyan': 'Cian',
  'library.subtitles.colour.green': 'Verde',
  'library.subtitles.colour.pink': 'Rosa',
  'library.subtitles.background': 'Fondo',
  'library.subtitles.background.none': 'Ninguno',
  'library.subtitles.background.outline': 'Contorno',
  'library.subtitles.background.box': 'Caja',
  'library.subtitles.opacity': 'Opacidad de la caja',
  'library.subtitles.edge': 'Borde',
  'library.subtitles.edge.thin': 'Fino',
  'library.subtitles.edge.thick': 'Grueso',
  'library.subtitles.place': 'Posición',
  'library.subtitles.place.topLeft': 'Arriba a la izquierda',
  'library.subtitles.place.topCentre': 'Arriba al centro',
  'library.subtitles.place.topRight': 'Arriba a la derecha',
  'library.subtitles.place.middleLeft': 'En medio a la izquierda',
  'library.subtitles.place.middleCentre': 'Centro',
  'library.subtitles.place.middleRight': 'En medio a la derecha',
  'library.subtitles.place.bottomLeft': 'Abajo a la izquierda',
  'library.subtitles.place.bottomCentre': 'Abajo al centro',
  'library.subtitles.place.bottomRight': 'Abajo a la derecha',
  'library.subtitles.move': 'Mover sobre la imagen',
  'library.subtitles.moveDone': 'Terminar',
  'library.subtitles.remove.label': 'Quitar {name}',
  'library.subtitles.remove.ask': '¿Quitar {name}? Irá a la papelera.',
  'library.subtitles.remove.confirm': 'Quitar',
  'library.subtitles.remove.cancel': 'Cancelar',
  'library.subtitles.remove.failed': 'No se pudo quitar {name}.',
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
  'library.column.sound': 'Sonido',
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
  'library.video.skip': '{seconds} s',
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
  'library.sound.title': 'Sonido',
  'library.sound.albumTitle': 'Sonido del álbum',
  'library.sound.albumAria': 'Sonido del álbum {album}',
  'library.sound.none': 'Ninguno',
  'library.sound.choose': 'Elegir un sonido…',
  'library.sound.search': 'Buscar EQ guardados y presets',
  'library.sound.albumIs': 'El álbum suena con {preset}',
  'library.sound.albumNone': 'El álbum no tiene un sonido fijado',
  'library.sound.ownIs': 'Su propio sonido: {preset}',
  'library.sound.noOwn': 'Suena con el sonido de su álbum o con el tuyo',
  'library.sound.someOwn': '{count} de {total} tienen su propio sonido',
  'library.sound.usePlaying': 'Usar lo que suena ahora',
  'library.sound.usePlayingHint': 'preset y ajustes',
  'library.sound.forgetOwn': 'Olvidar su propio sonido',
  'library.sound.forgetTheirs': 'Olvidar los sonidos propios de las canciones',
  'library.sound.noAlbumSound': 'Sin sonido de álbum',
  'library.sound.tagOwn': 'Propio · {preset}',
  'library.sound.tagAlbum': 'Álbum · {preset}',
  'library.sound.tagChanged': 'Cambiado · {preset}',
  'library.sound.detailsYours': 'Tu sonido',
  'library.sound.change': 'Cambiar',
  'library.sound.keptAlbum': 'Guardado para el álbum: {preset}',
  'library.sound.keptSong': 'Guardado para esta canción: {preset}',
  'library.sound.keptSongs': 'Guardado para {count}: {preset}',
  'library.sound.albumsOff':
    'Sonidos de álbumes está desactivado, así que aún no sonará.',
  'library.sound.songsOff':
    'Sonidos de canciones está desactivado, así que aún no sonará.',
  'library.sound.turnOnAlbums': 'Activar Sonidos de álbumes',
  'library.sound.turnOnSongs': 'Activar Sonidos de canciones',
  'library.sound.offWhere':
    'Puedes desactivarlo de nuevo en EQ automático, en la página EQ.',
};

export default library;
