const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'Abrir en Karaoke',
  'library.lyrics.karaoke.opening': 'Abriendo…',
  'library.lyrics.karaoke.hintTimed':
    'Empezar un karaoke con esta letra sincronizada y corregir su sincronización en el creador',
  'library.lyrics.karaoke.hintPlain':
    'Empezar un karaoke con esta letra y sincronizarla en el creador',
  'library.lyrics.karaoke.failed': 'No se pudo abrir esta canción en Karaoke.',
  'library.lyrics.remove.button': 'Quitar la letra',
  'library.lyrics.remove.askFile':
    '¿Quitar {name}? Se borra el archivo de letra que está junto a la canción.',
  'library.lyrics.remove.askKept':
    '¿Quitar la copia de esta letra que FluidEQ guarda para la canción?',
  'library.lyrics.remove.busy': 'Quitando la letra…',
  'library.lyrics.remove.confirm': 'Quitar',
  'library.lyrics.remove.keep': 'Conservar',
  'library.lyrics.remove.inSong':
    'Esta letra está dentro del propio archivo de la canción. FluidEQ nunca modifica tus canciones, así que no se puede quitar aquí.',
  'library.lyrics.remove.failed': 'No se pudo quitar la letra.',
  'library.lyrics.remove.understood': 'Entendido',

  'karaoke.maker.song.save': 'Guardar en la biblioteca',
  'karaoke.maker.song.saveHint':
    'Guardar esta sincronización como la letra de la canción en la biblioteca',
  'karaoke.maker.song.openedTimed':
    'Abierto con la letra sincronizada de la canción desde la biblioteca.',
  'karaoke.maker.song.keptTimed':
    'Ya estabas haciendo un karaoke de esta canción, así que se abrió tal como lo dejaste. «Restaurar original» vuelve a empezar desde la letra de la canción.',
  'karaoke.maker.song.keptPlain':
    'Ya estabas haciendo un karaoke de esta canción, así que se abrió tal como lo dejaste. La letra de la canción está en el editor por si prefieres usarla.',
  'karaoke.maker.song.savedBeside': 'Guardada junto a la canción como {name}.',
  'karaoke.maker.song.savedKept':
    'Guardada en la carpeta de letras de FluidEQ: no se puede escribir en la carpeta de la canción.',
  'karaoke.maker.song.untimedLeftOut':
    'Se omitieron las líneas sin sincronizar ({lines}).',
  'karaoke.maker.song.tagsFirst':
    'Las etiquetas de la canción también tienen una letra sincronizada, y la biblioteca muestra esa primero.',
  'karaoke.maker.song.nothingTimed':
    'Aún no hay nada que guardar: ninguna línea tiene tiempo.',
  'karaoke.maker.song.failed': 'No se pudo guardar la letra en la canción.',
  'karaoke.maker.song.gone': 'Esta canción ya no está en la biblioteca.',
  'karaoke.maker.song.replaceTitle': '¿Reemplazar {name}?',
  'karaoke.maker.song.replaceKeptTitle': '¿Reemplazar la copia de FluidEQ?',
  'karaoke.maker.song.replaceBody':
    'La canción ya tiene letra en {name}. Se reemplazará por la sincronización del creador.',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ ya guarda una letra para esta canción. Se reemplazará por la sincronización del creador.',
  'karaoke.maker.song.replace': 'Reemplazar',
} as const;

export default lyricsHandoff;
