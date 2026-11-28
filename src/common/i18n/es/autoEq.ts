/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
export default {
  'autoEq.title': 'EQ automático',
  'autoEq.aria': 'EQ automático: qué decide el sonido de cada canción',
  'autoEq.chip.title': 'Suena {sound}. Abrir EQ automático',
  'autoEq.chip.song': 'Canción · {preset}',
  'autoEq.restore': 'Restaurar {preset}',
  'autoEq.now.albumSound': 'Sonido del álbum: {preset}',
  'autoEq.now.songSound': 'Sonido de esta canción: {preset}',
  'autoEq.now.playingNow': 'Suena ahora: {preset}',
  'autoEq.chip.changedAlbum': 'Cambiado a mano. El álbum suena con {preset}',
  'autoEq.chip.changedSong': 'Cambiado a mano. Esta canción suena con {preset}',
  'autoEq.chip.open': 'Abrir EQ automático',
  'autoEq.tagline': 'El sonido de cada canción, elegido por ti',
  'autoEq.state.measuring': 'Midiendo',
  'autoEq.state.song': 'Canción',
  'autoEq.state.album': 'Álbum',
  'autoEq.state.yours': 'El tuyo',
  'autoEq.aside':
    'Un juego está sonando con su propio sonido, así que los sonidos de canciones y álbumes esperan. Vuelven cuando termina.',
  'autoEq.now.nothing': 'Nada sonando',
  'autoEq.now.yours': 'tu sonido',
  'autoEq.now.yoursWhy':
    'No hay nada guardado para esta canción: suena tu propio sonido, tal como lo dejaste.',
  'autoEq.now.song': 'el sonido de esta canción',
  'autoEq.now.songWhy': 'Vuelve cada vez que suena esta canción.',
  'autoEq.now.album': 'el sonido de {album}',
  'autoEq.now.albumUnnamed': 'el sonido de su álbum',
  'autoEq.now.albumWhy': 'Fijado en la Biblioteca para todo el álbum.',
  'autoEq.now.showPreset': 'Mostrar {preset} en la pestaña Preset',
  'autoEq.songs.title': 'Sonidos de canciones',
  'autoEq.songs.hint':
    'Una canción con un sonido guardado lo reproduce. Tus cambios se quedan con esa canción hasta que los guardes. Las demás canciones suenan con el tuyo.',
  'autoEq.songs.nothing': 'Reproduce una canción para guardar su sonido',
  'autoEq.songs.saved': 'Guardado para esta canción',
  'autoEq.songs.none': 'No hay nada guardado para esta canción',
  'autoEq.songs.save': 'Guardar para esta canción',
  'autoEq.songs.forget': 'Olvidar',
  'autoEq.button.save': 'Guardar',
  'autoEq.state.changed': 'Cambiado',
  'autoEq.songs.changed': 'Cambiado, sin guardar',
  'autoEq.songs.saveChanges': 'Guardar cambios',
  'autoEq.button.saveFor': 'Guardar lo que suena para {title}',
  'autoEq.button.saved': 'Guardado',
  'autoEq.holds.preset': 'Preset',
  'autoEq.holds.eq': 'Tu ecualizador',
  'autoEq.holds.curves': 'Curvas',
  'autoEq.holds.bands': '{count} bandas',
  'autoEq.holds.bandsOne': '1 banda',
  'autoEq.holds.flat': 'Plano',
  'autoEq.holds.none': 'Ninguno',
  'autoEq.holds.curve': 'Curva de {preset}',
  'autoEq.holds.correction':
    'La corrección de auriculares se queda con la salida',
  'autoEq.albums.title': 'Sonidos de álbumes',
  'autoEq.albums.hint':
    'Solo en la Biblioteca. Todas las canciones del álbum suenan con él, salvo una canción con su propio preset.',
  'autoEq.albums.nothing':
    'Fija el sonido de un álbum en su página de la Biblioteca',
  'autoEq.albums.libraryOnly':
    'Solo la Biblioteca: no para otros reproductores',
  'autoEq.albums.set': '{album}: {preset}',
  'autoEq.albums.none': 'Este álbum no tiene un sonido fijado',
  'autoEq.smart.title': 'Corrección inteligente',
  'autoEq.smart.hint':
    'Mide cada canción desde la fuente y guarda su corrección para esa canción. Por encima de cualquier preset.',
  'autoEq.smart.waiting': 'Esperando una canción',
  'autoEq.smart.onceHint': 'Una medición de lo que suena, aplicada de una vez',
  'autoEq.smart.once': 'Medir una vez',
  'autoEq.smart.phase.listening': 'Escuchando',
  'autoEq.smart.phase.settling': 'Asentándose',
  'autoEq.smart.phase.held': 'Fijada para esta canción',
  'autoEq.smart.phase.paused': 'En pausa',
  'autoEq.smart.heard': '{seconds} s',
  'autoEq.smart.note.listening':
    'Lo que suena ahora sigue sonando hasta que se fije la corrección de esta canción.',
  'autoEq.smart.note.waitingOn':
    'Esperando {ranges}. Lo que suena ahora sigue sonando hasta que se fije la corrección de esta canción.',
  'autoEq.smart.note.listeningLive': 'La corrección entra mientras escucha.',
  'autoEq.smart.note.waitingOnLive':
    'Esperando {ranges}. La corrección entra mientras escucha.',
  'autoEq.smart.note.settling':
    'Comprobando que la curva ha dejado de moverse antes de escribirla.',
  'autoEq.smart.note.held':
    'La medición se ha detenido. Vuelve a escuchar con la siguiente canción.',
  'autoEq.smart.note.heldMissing':
    'No está en esta grabación, así que se deja como está: {ranges}. La medición se ha detenido.',
  'autoEq.smart.note.heldShort':
    'Muy poco de la grabación para corregir, así que el sonido queda como estaba.',
  'autoEq.smart.again': 'Medir de nuevo',
  'autoEq.smart.againHint':
    'Escuchar esta canción otra vez y reemplazar su corrección',
  'autoEq.savedCount': 'Guardados: {songs} · {albums}',
  'autoEq.manage': 'Administrar',
  'autoEq.manage.title': 'Sonidos guardados',
  'autoEq.manage.back': 'Volver a EQ automático',
  'autoEq.manage.songs': 'Canciones',
  'autoEq.manage.albums': 'Álbumes',
  'autoEq.manage.search': 'Buscar sonidos guardados',
  'autoEq.manage.wholeSound': '{preset} con su Tono y su EQ',
  'autoEq.manage.forget': 'Olvidar',
  'autoEq.manage.others': 'Canciones de otros reproductores: {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube y el navegador. Sus nombres nunca se guardan.',
  'autoEq.manage.empty': 'Todavía no hay nada guardado',
  'autoEq.manage.noMatch': 'No hay coincidencias',
  'autoEq.manage.resetKeeps':
    'Restablecer todos los ajustes los conserva. Solo Olvidar los elimina.',
  'autoEq.manage.forgetAll': 'Olvidar todo',
  'autoEq.manage.forgetAllConfirm': 'Olvidar todo, para siempre',
  'autoEq.moved.title': 'El sonido de cada canción está ahora en EQ automático',
  'autoEq.moved.body':
    'Recordar el sonido de cada canción se ha trasladado a EQ automático, en la página EQ. Tus {count} canciones guardadas vinieron con él.',
  'autoEq.moved.bodyOne':
    'Recordar el sonido de cada canción se ha trasladado a EQ automático, en la página EQ. Tu canción guardada vino con él.',
  'autoEq.moved.open': 'Abrir EQ automático',
  'autoEq.moved.dismiss': 'Entendido',
  'autoEq.eqs.title': 'EQ guardados',
  'autoEq.eqs.saveThis': 'Guardar este EQ',
  'autoEq.eqs.empty': 'Aún no hay nada guardado',
  'autoEq.eqs.name': 'Nombre',
  'autoEq.eqs.defaultName': 'Mi EQ {count}',
  'autoEq.eqs.keepPreset': 'Guardar el preset con él',
  'autoEq.eqs.anyPreset': 'Suena sobre cualquier preset',
  'autoEq.eqs.stays':
    'La corrección de auriculares y la corrección inteligente se quedan donde están.',
  'autoEq.eqs.cancel': 'Cancelar',
  'autoEq.eqs.save': 'Guardar',
  'autoEq.eqs.saveFailed': 'No se pudo guardar. Inténtalo de nuevo.',
  'autoEq.eqs.update': 'Actualizar',
  'autoEq.eqs.updateWithLive': 'Actualizar con lo que suena',
  'autoEq.eqs.playing': 'Sonando',
  'autoEq.eqs.more': 'Más opciones de {name}',
  'autoEq.eqs.renameLabel': 'Nuevo nombre para {name}',
  'autoEq.eqs.deleteAsk': '¿Eliminar {name}?',
  'autoEq.eqs.deleteKeeps':
    'Lo usan {what}. Cada uno conserva su sonido como propio.',
  'autoEq.eqs.usedBy': 'en {what}',
  'autoEq.eqs.use': 'Usar un EQ guardado',
  'autoEq.eqs.saveNew': 'Guardar como EQ nuevo…',
  'autoEq.eqs.manageAll': 'Gestionar EQ guardados…',
  'autoEq.eqs.search': 'Buscar EQ guardados',
  'autoEq.eqs.load': 'Cargar',
  'autoEq.eqs.reload': 'Recargar',
  'autoEq.eqs.loadNamed': 'Cargar {name}',
  'autoEq.eqs.reloadNamed': 'Recargar {name} tal como se guardó',
  'autoEq.eqs.saveChangesNamed': 'Guardar los cambios en «{name}»',
  'autoEq.eqs.usedByWhat': 'Lo usan {what}',
  'autoEq.eqs.savedNamed': '«{name}» está guardado',
  'autoEq.eqs.undo': 'Deshacer',
  'autoEq.eqs.undoNamed': 'Deshacer el guardado de «{name}»',
  'autoEq.eqs.replaceAsk': '¿Sustituir «{name}» por lo que suena?',
  'autoEq.eqs.replaceReach': 'Lo usan {what}. Sonarán con el sonido nuevo.',
  'autoEq.eqs.replace': 'Sustituir',
  'autoEq.songs.follows': 'Sigue {name}',
};
