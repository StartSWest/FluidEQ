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
  'autoEq.tagline': 'El sonido de cada canción, elegido por ti',
  'autoEq.state.measuring': 'Midiendo',
  'autoEq.state.paused': 'En pausa',
  'autoEq.state.song': 'Canción',
  'autoEq.state.album': 'Álbum',
  'autoEq.state.yours': 'El tuyo',
  'autoEq.aside':
    'Se aparta mientras el DSP está apagado, hay una cadena de Juegos activa o un juego usa su propio sonido. Vuelve tal como estaba.',
  'autoEq.now.nothing': 'Nada sonando',
  'autoEq.now.yours': 'tu sonido',
  'autoEq.now.yoursWhy':
    'No hay nada guardado para esta canción: suena el último sonido que elegiste.',
  'autoEq.now.song': 'el sonido de esta canción',
  'autoEq.now.songWhy': 'Vuelve cada vez que suena esta canción.',
  'autoEq.now.album': 'el sonido de {album}',
  'autoEq.now.albumUnnamed': 'el sonido de su álbum',
  'autoEq.now.albumWhy': 'Fijado en la Biblioteca para todo el álbum.',
  'autoEq.songs.title': 'Sonidos de canciones',
  'autoEq.songs.hint':
    'Una canción con un sonido guardado lo reproduce. Cámbialo y pulsa Guardar cambios para conservarlo. Las demás canciones suenan con el tuyo.',
  'autoEq.songs.nothing': 'Reproduce una canción para guardar su sonido',
  'autoEq.songs.saved': 'Guardado para esta canción',
  'autoEq.songs.none': 'No hay nada guardado para esta canción',
  'autoEq.songs.save': 'Guardar para esta canción',
  'autoEq.songs.forget': 'Olvidar',
  'autoEq.button.save': 'Guardar',
  'autoEq.state.changed': 'Cambiado',
  'autoEq.songs.changed': 'Cambiado, sin guardar',
  'autoEq.songs.revert': 'Volver a lo guardado',
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
  'autoEq.smart.modes': 'Cómo corrige',
  'autoEq.smart.waiting': 'Esperando una canción',
  'autoEq.smart.willSave': 'Se guardará para esta canción cuando termine',
  'autoEq.smart.savesIn': 'Se guardará para esta canción en {remaining}',
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
  'autoEq.eqs.hint':
    'Guarda un EQ que te guste. Ponlo o dáselo a canciones y álbumes.',
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
  'autoEq.eqs.putOn': 'Poner',
  'autoEq.eqs.update': 'Actualizar',
  'autoEq.eqs.updateWithLive': 'Actualizar con lo que suena',
  'autoEq.eqs.playing': 'Sonando',
  'autoEq.eqs.more': 'Más opciones de {name}',
  'autoEq.eqs.renameLabel': 'Nuevo nombre para {name}',
  'autoEq.eqs.deleteAsk': '¿Eliminar {name}?',
  'autoEq.eqs.deleteKeeps':
    'Las canciones y álbumes que lo usan conservan su sonido como propio.',
  'autoEq.eqs.usedBy': 'en {what}',
  'autoEq.eqs.moreCount': '{count} más',
  'autoEq.eqs.seeAll': 'Ver los {count}',
  'autoEq.eqs.use': 'Usar un EQ guardado',
  'autoEq.eqs.saveNew': 'Guardar como EQ nuevo…',
  'autoEq.eqs.updateNamed': 'Actualizar «{name}» con lo que suena',
  'autoEq.eqs.manageAll': 'Gestionar EQ guardados…',
  'autoEq.eqs.putOnNamed': 'Poner {name}',
  'autoEq.songs.follows': 'Sigue {name}',
};
