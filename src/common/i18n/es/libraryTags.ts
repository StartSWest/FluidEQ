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
  'library.tags.menu.edit': 'Editar etiquetas…',
  'library.tags.menu.editMany': 'Editar etiquetas de {count} canciones…',
  'library.tags.menu.editAlbum': 'Editar etiquetas del álbum…',
  'library.tags.menu.cover': 'Cambiar portada…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count} canciones',
  'library.tags.selection.edit': 'Editar etiquetas',
  'library.tags.selection.clear': 'Quitar la selección',

  'library.tags.field.title': 'Título',
  'library.tags.field.artist': 'Artista',
  'library.tags.field.composer': 'Compositor',
  'library.tags.field.album': 'Álbum',
  'library.tags.field.albumArtist': 'Artista del álbum',
  'library.tags.field.trackNo': 'Pista',
  'library.tags.field.trackTotal': 'Total de pistas',
  'library.tags.field.discNo': 'Disco',
  'library.tags.field.discTotal': 'Total de discos',
  'library.tags.field.year': 'Año',
  'library.tags.field.genre': 'Género',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'Comentario',
  'library.tags.field.grouping': 'Agrupación',
  'library.tags.field.publisher': 'Sello',
  'library.tags.field.copyright': 'Copyright',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'Director',
  'library.tags.field.subtitle': 'Subtítulo',
  'library.tags.field.remixer': 'Remezcla de',
  'library.tags.field.initialKey': 'Tonalidad',
  'library.tags.field.compilation': 'Recopilatorio',
  'library.tags.field.titleSort': 'Orden del título',
  'library.tags.field.artistSort': 'Orden del artista',
  'library.tags.field.albumSort': 'Orden del álbum',
  'library.tags.field.albumArtistSort': 'Orden del artista del álbum',
  'library.tags.field.composerSort': 'Orden del compositor',
  'library.tags.field.musicBrainzTrackId': 'Grabación de MusicBrainz',
  'library.tags.field.musicBrainzReleaseId': 'Edición de MusicBrainz',
  'library.tags.field.musicBrainzArtistId': 'Artista de MusicBrainz',
  'library.tags.field.musicBrainzReleaseArtistId':
    'Artista del álbum de MusicBrainz',
  'library.tags.field.musicBrainzReleaseGroupId':
    'Grupo de ediciones de MusicBrainz',

  'library.tags.panel.title': 'Editar etiquetas',
  'library.tags.panel.position': '{index} de {count}',
  'library.tags.panel.previous': 'Canción anterior (Alt+↑)',
  'library.tags.panel.next': 'Canción siguiente (Alt+↓)',
  'library.tags.panel.close': 'Cerrar (Esc): los cambios esperan',
  'library.tags.panel.reading': 'Leyendo las etiquetas del archivo…',
  'library.tags.panel.readFailed':
    'No se pudieron leer las etiquetas de este archivo. Puede estar dañado o en uso.',
  'library.tags.panel.missing': 'Esta canción ya no está en el disco.',
  'library.tags.panel.unsupported':
    'FluidEQ no edita las etiquetas de este tipo de archivo.',
  'library.tags.group.song': 'Canción',
  'library.tags.group.album': 'Álbum',
  'library.tags.group.details': 'Detalles',
  'library.tags.group.file': 'Archivo',
  'library.tags.of': 'de',
  'library.tags.sameAsArtist': 'Igual que el artista',
  'library.tags.putBack': 'Restaurar',
  'library.tags.noArtist': 'Sin artista',
  'library.tags.noAlbum': 'Sin álbum',
  'library.tags.genre.inLibrary': 'En tu biblioteca',
  'library.tags.tip.fileName':
    'El título es el nombre del archivo. ¿Usar {title}?',
  'library.tags.tip.fileNameTrack':
    'El título es el nombre del archivo. ¿Usar {title}, pista {track}?',
  'library.tags.tip.use': 'Usar',

  'library.tags.cover.dropHint': 'Suelta o pega una imagen',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'Este archivo no tiene portada',
  'library.tags.cover.new': 'Portada nueva · {width} × {height}',
  'library.tags.cover.removed': 'La portada se quita al guardar',
  'library.tags.cover.refused': 'Solo una imagen JPEG o PNG de hasta 20 MB.',
  'library.tags.cover.emptyClipboard':
    'No hay ninguna imagen en el portapapeles.',

  'library.tags.more.toggle': 'Más campos',
  'library.tags.more.count': '{count} en este archivo · añade cualquiera',
  'library.tags.more.countNone': 'añade cualquiera',
  'library.tags.more.add': 'Añadir un campo',
  'library.tags.more.addHint':
    'Cualquier campo que permita el formato, por su código.',
  'library.tags.more.code': 'Código',
  'library.tags.more.value': 'Valor',
  'library.tags.more.addConfirm': 'Añadir',
  'library.tags.more.badCode':
    'El formato de este archivo no puede guardar ese código como texto.',

  'library.tags.file.format': 'Formato',
  'library.tags.file.tags': 'Etiquetas del archivo',
  'library.tags.file.noTags': 'Sin etiquetas',
  'library.tags.file.writeAs': 'Escribir como',
  'library.tags.file.keep': 'Mantener {version}',
  'library.tags.file.v23Note':
    'v2.3 es lo que mejor leen el Explorador de Windows, los equipos de coche y los reproductores antiguos. v2.4 guarda UTF-8 y varios valores por campo.',
  'library.tags.file.v24Note':
    'El Explorador de Windows y algunos equipos de coche leen mal v2.4; v2.3 es la opción segura si este archivo viaja.',
  'library.tags.file.id3v1': 'Mantener al día la antigua etiqueta ID3v1',
  'library.tags.file.readOnly':
    'Este archivo es de solo lectura. Se te preguntará antes de escribirlo.',

  'library.tags.foot.none': 'Sin cambios',
  'library.tags.foot.noneHint':
    'Los cambios esperan mientras recorres el álbum',
  'library.tags.foot.changes': '{count} cambios sin guardar',
  'library.tags.foot.changesOne': '1 cambio sin guardar',
  'library.tags.foot.inSongs': 'en {count} canciones',
  'library.tags.foot.inSongsOne': 'en 1 canción',
  'library.tags.revert': 'Deshacer cambios',
  'library.tags.save': 'Guardar',
  'library.tags.saveSongs': 'Guardar {count} canciones',
  'library.tags.saveFailed':
    'Algunos valores no se pudieron escribir tal como están. Revisa los campos marcados.',

  'library.tags.set.reading': 'Leyendo etiquetas · {done} de {count}',
  'library.tags.set.use': 'Usar {value}',
  'library.tags.set.coversMixed': '{count} portadas distintas',
  'library.tags.set.coversNone': '{count} canciones no tienen',
  'library.tags.set.coverOne': 'Una portada para todas',
  'library.tags.set.coverNoneAll': 'Ninguna canción tiene portada',
  'library.tags.set.coverToAll': 'Para las {count} canciones',
  'library.tags.set.songs': 'Canciones',
  'library.tags.set.renumber': 'Renumerar por orden',
  'library.tags.set.fixAuto': 'Corregir automáticamente',
  'library.tags.set.moreFields': 'Más campos ({fields})',
  'library.tags.set.varies': 'Varía:',
  'library.tags.set.variesPlaceholder': 'Varía · escribe uno para todas',
  'library.tags.set.useForAll': 'Usar en las {count} canciones',
  'library.tags.set.found': '{count} canciones encontradas',
  'library.tags.set.foundOne': '1 canción encontrada',
  'library.tags.set.foundNone': 'Ningún título lo tiene',
  'library.tags.cover.change': 'Cambiar portada',
  'library.tags.cover.changeShort': 'Cambiar',
  'library.tags.cover.chooseImage': 'Elegir una imagen…',
  'library.tags.cover.pasteImage': 'Pegar del portapapeles',
  'library.tags.cover.removeCover': 'Quitar la portada',
  'library.tags.set.find': 'Buscar en los títulos',
  'library.tags.set.replaceWith': 'Reemplazar por',
  'library.tags.set.replaceAll': 'Reemplazar todo',
  'library.tags.set.sheetHint':
    'Intro baja · Tab va a la derecha · Ctrl+D copia la celda de arriba · arrastra una fila por su asa para reordenar y luego Renumerar.',
  'library.tags.set.col.no': '#',
  'library.tags.set.col.time': 'Duración',
  'library.tags.set.grip': 'Arrastrar para reordenar',
  'library.tags.set.missingCell': 'falta',
  'library.tags.set.groupSongs': '{count} canciones',
  'library.tags.set.changes': '{count} cambios',
  'library.tags.set.changesOne': '1 cambio',
  'library.tags.set.files': '{count} archivos · todavía no se escribe nada',
  'library.tags.set.filesOne': '1 archivo · todavía no se escribe nada',
  'library.tags.set.discard': 'Descartar',
  'library.tags.set.back': 'Volver',
  'library.tags.set.leaveAsk': '¿Salir sin guardar estos cambios?',
  'library.tags.set.keepEditing': 'Seguir editando',
  'library.tags.set.unreadable':
    '{count} canciones no se pudieron leer y quedan fuera.',

  'library.tags.write.progress': 'Escribiendo etiquetas · {done} de {count}',
  'library.tags.write.undoing': 'Restaurando etiquetas · {done} de {count}',
  'library.tags.write.background': 'Seguir en segundo plano',
  'library.tags.write.show': 'Mostrar',
  'library.tags.write.cancel': 'Cancelar',
  'library.tags.write.written': '{done} de {count} escritos',
  'library.tags.write.needYou': '{count} te necesitan',
  'library.tags.write.review': 'Revisar {count} archivos',
  'library.tags.write.reviewOne': 'Revisar 1 archivo',
  'library.tags.write.done': '{count} archivos actualizados',
  'library.tags.write.doneOne': '1 archivo actualizado',
  'library.tags.write.doneNote':
    'Las etiquetas anteriores se guardan: Deshacer las devuelve todas.',
  'library.tags.write.undo': 'Deshacer',
  'library.tags.write.undone': 'Deshecho',
  'library.tags.write.undoneNote':
    'Cada archivo vuelve a tener sus etiquetas anteriores, portada incluida.',
  'library.tags.write.stopped': 'Detenido tras {done} de {count}',
  'library.tags.write.stoppedNote':
    'Los archivos ya escritos conservan sus etiquetas nuevas; Deshacer las devuelve.',
  'library.tags.write.failed': '{count} no se pudieron escribir',
  'library.tags.write.failedOne': '1 no se pudo escribir',
  'library.tags.write.dismiss': 'Cerrar',
  'library.tags.problems.title': '{count} archivos te necesitan',
  'library.tags.problems.titleOne': '1 archivo te necesita',
  'library.tags.problems.allHandled': 'Todo resuelto',
  'library.tags.problems.waiting': '{count} esperan a que termine su canción',
  'library.tags.problems.waitingOne': '1 espera a que termine su canción',
  'library.tags.problems.held':
    'Suena ahora en FluidEQ: se escribe en cuanto termine la canción.',
  'library.tags.problems.locked':
    'Está abierto en otro programa. Ciérralo allí y vuelve a intentarlo.',
  'library.tags.problems.readOnly':
    'Este archivo es de solo lectura, así que no se puede cambiar tal como está.',
  'library.tags.problems.failed':
    'No se pudo escribir este archivo. Sigue igual; no se perdió nada.',
  'library.tags.problems.missing':
    'Este archivo ya no está donde la biblioteca lo encontró.',
  'library.tags.problems.retry': 'Reintentar',
  'library.tags.problems.skip': 'Omitir',
  'library.tags.problems.makeWritable': 'Permitir escritura y escribir',
  'library.tags.problems.skipAll': 'Omitir todos',
  'library.tags.problems.nothingToDo': 'No hay nada que hacer.',
  'library.tags.problems.everythingElse': 'Todo lo demás está escrito',
  'library.tags.problems.undoCovers': 'Deshacer también los incluye',
  'library.tags.menu.fix': 'Corregir etiquetas automáticamente…',
  'library.tags.menu.fixAlbum': 'Corregir este álbum…',
  'library.tags.menu.fixShortcut': 'Ctrl+Mayús+I',
  'library.tags.hero.fix': 'Corregir etiquetas',
  'library.tags.selection.fix': 'Corregir',
  'library.tags.fix.empty': 'vacío',
  'library.tags.fix.albums': '{count} álbumes',
  'library.tags.fix.albumChanges': '{count} cambios',
  'library.tags.fix.albumChangesOne': '1 cambio',
  'library.tags.fix.nothingFound':
    'FluidEQ no encontró nada que corregir en estas canciones.',
  'library.tags.fix.noPicture':
    'La imagen de la carpeta del álbum no se pudo usar.',
  'library.tags.fix.filled':
    'FluidEQ completó lo que faltaba. Lo cambiado está en color, con lo viejo tachado al lado: revísalo y guarda, o descártalo.',
  'library.tags.fix.fixAlbum': 'Corregir',
  'library.tags.fix.openAlbum': 'Abrir',
  'library.tags.fix.editByHand': 'Editar todo a mano',
  'library.tags.fix.albumComplete': 'Completo',
  'library.tags.changes.title': 'Cambios',
  'library.tags.changes.none':
    'Todavía no hay cambios. Lo que cambies se lista aquí antes de guardar.',
  'library.tags.changes.album': 'Para todo el álbum',
  'library.tags.changes.songs': 'Canción por canción',
  'library.tags.changes.removed': 'se quita',
  'library.tags.changes.cover': 'Portada',
  'library.tags.changes.coverNew': 'Imagen nueva',
  'library.tags.changes.coverRemoved': 'Se quita',
  'library.tags.cover.useOne': 'Usar una en todas las canciones',
  'library.tags.cover.useThis': 'Usar esta portada en todas las canciones',
  'library.tags.cover.searchWeb': 'Buscar portada en internet…',
  'library.tags.cover.searchHint':
    'En el navegador, copia la imagen que quieras y pulsa Pegar, o arrástrala sobre la portada.',
  'library.tags.set.searchWeb': 'Buscar el álbum en internet',
  'library.tags.set.searchWebNote':
    'Abre el álbum en MusicBrainz, en tu navegador. FluidEQ no descarga nada.',
  'library.tags.write.undoAsk':
    '¿Devolver las etiquetas anteriores a {count} archivos?',
  'library.tags.write.undoAskOne':
    '¿Devolver las etiquetas anteriores a 1 archivo?',
  'library.tags.write.undoKeep': 'No',
  'library.tags.write.undoConfirm': 'Deshacer',
};

export default libraryTags;
