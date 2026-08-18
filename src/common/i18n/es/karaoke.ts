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

/** The Karaoke tab, its player and the Maker. */
import { Dictionary } from '../en';

const karaoke: Partial<Dictionary> = {
  'karaoke.eyebrow': 'KARAOKE LOCAL',
  'karaoke.title': 'Un escenario hecho para tu música',
  'karaoke.intro':
    'Este espacio reunirá canciones, letras sincronizadas, monitoreo del micrófono y guía de afinación, todo localmente en tu equipo.',
  'karaoke.fullscreen.enter': 'Entrar en pantalla completa',
  'karaoke.fullscreen.exit': 'Salir de pantalla completa',
  'karaoke.fullscreen.hideHeader': 'Ocultar el encabezado de FluidEQ',
  'karaoke.fullscreen.showHeader': 'Mostrar el encabezado de FluidEQ',
  'karaoke.actions': 'Acciones de karaoke',
  'karaoke.readiness.resize':
    'Cambiar el tamaño de los paneles de micrófono y afinación',
  'karaoke.empty.title': 'Tu escenario está listo',
  'karaoke.empty.body':
    'Abre audio con letras opcionales o añade una carpeta completa. FluidEQ enlaza los archivos con el mismo nombre en una lista.',
  'karaoke.import.pending': 'Lo siguiente: importar canciones',
  'karaoke.import.open': 'Abrir canción',
  'karaoke.import.replace': 'Cambiar canción',
  'karaoke.import.addFiles': 'Añadir archivos',
  'karaoke.import.folder': 'Añadir carpeta',
  'karaoke.import.clear': 'Quitar',
  'karaoke.import.loading': 'Preparando tu canción…',
  'karaoke.import.formats':
    'Audio: MP3, WAV, OGG, FLAC o M4A · Letras: LRC, eLRC o TXT de UltraStar',
  'karaoke.import.drop': 'Suelta aquí canciones, letras o carpetas',
  'karaoke.error.missingAudio':
    'Añade un archivo de audio junto con ese archivo de letras.',
  'karaoke.error.ambiguous':
    'Hay más de una combinación posible. Selecciona un audio y, opcionalmente, un archivo de letras.',
  'karaoke.error.unsupported':
    'Ninguno de esos archivos es todavía un audio o archivo de letras compatible.',
  'karaoke.error.read':
    'FluidEQ no pudo leer los archivos locales seleccionados.',
  'karaoke.error.playback':
    'Esta versión de Chromium no pudo reproducir ese archivo o códec de audio.',
  'karaoke.warning.lyrics':
    'no se pudo interpretar; el audio seguirá disponible sin letras sincronizadas.',
  'karaoke.song.unknownArtist': 'Canción local',
  'karaoke.playlist.title': 'Lista de reproducción',
  'karaoke.playlist.groupFolders': 'Agrupar por carpeta',
  'karaoke.playlist.looseFiles': 'Archivos sueltos',
  'karaoke.playlist.resize': 'Cambiar el ancho de la lista y el escenario',
  'karaoke.playlist.collapse': 'Contraer lista de reproducción',
  'karaoke.playlist.expand': 'Expandir lista de reproducción',
  'karaoke.playlist.select': 'Seleccionar {title}',
  'karaoke.playlist.moveUp': 'Subir {title}',
  'karaoke.playlist.moveDown': 'Bajar {title}',
  'karaoke.playlist.remove': 'Quitar {title}',
  'karaoke.source.audioOnly': 'Solo audio',
  'karaoke.source.lrc': 'LRC · por línea',
  'karaoke.source.elrc': 'eLRC · por palabra',
  'karaoke.source.ultrastar': 'UltraStar · sílabas + afinación',
  'karaoke.lyrics.none':
    'No elegiste letras sincronizadas. La reproducción y el afinador siguen disponibles.',
  'karaoke.lyrics.line': 'Línea de letra {number}',
  'karaoke.lyrics.previous': 'Letra anterior',
  'karaoke.lyrics.next': 'Letra siguiente',
  'karaoke.lyrics.follow': 'Seguir la letra',
  'karaoke.lyrics.textSize': 'Tamaño del texto de la letra',
  'karaoke.transport.title': 'Controles de reproducción de Karaoke',
  'karaoke.transport.restart': 'Reiniciar canción',
  'karaoke.transport.play': 'Reproducir',
  'karaoke.transport.pause': 'Pausar',
  'karaoke.transport.spaceShortcut': '{action} · Espacio',
  'karaoke.transport.seek': 'Posición de la canción',
  'karaoke.transport.volume': 'Volumen',
  'karaoke.transport.vocalLevel': 'Voz guía',
  'karaoke.transport.vocalOff': 'Solo base',
  'karaoke.transport.vocalFull': 'Original',
  'karaoke.mic.title': 'Micrófono',
  'karaoke.mic.settings': 'Ajustes del micrófono',
  'karaoke.mic.off': 'Apagado',
  'karaoke.mic.hint':
    'Elige una entrada. FluidEQ solo pide acceso al micrófono cuando lo activas.',
  'karaoke.mic.select': 'Entrada de micrófono',
  'karaoke.mic.default': 'Predeterminado del sistema',
  'karaoke.mic.unnamed': 'Micrófono {number}',
  'karaoke.mic.turnOn': 'Activar micrófono',
  'karaoke.mic.turnOff': 'Desactivar micrófono',
  'karaoke.mic.requesting': 'Conectando…',
  'karaoke.mic.live': 'Activo',
  'karaoke.mic.denied': 'Permiso denegado',
  'karaoke.mic.unavailable': 'Sin micrófono',
  'karaoke.mic.disconnected': 'Desconectado',
  'karaoke.mic.error': 'No se pudo iniciar',
  'karaoke.mic.level': 'Nivel de entrada del micrófono',
  'karaoke.mic.levelValue': 'Nivel de entrada del micrófono: {percent} %',
  'karaoke.mic.privacy':
    'Solo análisis local de nivel y afinación. FluidEQ no graba ni reproduce el micrófono por tus altavoces.',
  'karaoke.mic.volume': 'Volumen del micrófono',
  'karaoke.mic.volumeValue': 'Volumen del micrófono: {percent}%',
  'karaoke.pitch.title': 'Guía de afinación',
  'karaoke.pitch.resize': 'Cambiar el tamaño de la guía de afinación',
  'karaoke.pitch.guide': 'Guía melódica',
  'karaoke.pitch.toneGuide': 'Tono guía',
  'karaoke.pitch.toneEnable': 'Reproducir el tono de la melodía',
  'karaoke.pitch.toneDisable': 'Detener el tono de la melodía',
  'karaoke.pitch.toneVolume': 'Volumen del tono guía',
  'karaoke.pitch.scrubHint':
    'Arrastra a izquierda o derecha para moverte por la canción; al soltar quedará pausada.',
  'karaoke.pitch.viewSelector': 'Vista de afinación',
  'karaoke.pitch.viewNotes': 'Notas',
  'karaoke.pitch.viewWave': 'Curva',
  'karaoke.pitch.waveCanvas':
    'Curva del tono del cantante en tiempo real sobre las notas de la canción',
  'karaoke.pitch.waveSong': 'Canción',
  'karaoke.pitch.waveVoice': 'Tu voz',
  'karaoke.pitch.waveFooter':
    'Los bloques azules son las notas de la canción; la curva fina en vivo es el tono que entra por tu micrófono.',
  'karaoke.pitch.review': 'Revisión de la interpretación',
  'karaoke.pitch.reviewCount': '{count} partes para practicar',
  'karaoke.pitch.issueHigh': 'Afinación alta en {time}. Practica esta parte.',
  'karaoke.pitch.issueLow': 'Afinación baja en {time}. Practica esta parte.',
  'karaoke.pitch.issueMissed': 'Notas omitidas en {time}. Practica esta parte.',
  'karaoke.practice.go': '¡YA!',
  'karaoke.practice.ready': 'Prepárate para cantar de nuevo',
  'karaoke.countIn.ready': 'Prepárate: la canción empieza después de ¡YA!',
  'karaoke.pitch.canvas':
    'Gráfica del tono en vivo del micrófono y de las notas objetivo',
  'karaoke.pitch.micOff': 'Activa el micrófono para ver tu afinación.',
  'karaoke.pitch.loading': 'Iniciando análisis de afinación…',
  'karaoke.pitch.unavailable':
    'El análisis de afinación no está disponible. El nivel del micrófono sigue funcionando.',
  'karaoke.pitch.noSignal': 'Canta en el micrófono para trazar tu afinación.',
  'karaoke.pitch.empty':
    'Las notas objetivo solo aparecerán cuando la canción importada las incluya de verdad.',
  'karaoke.pitch.high': 'Alto',
  'karaoke.pitch.tuned': 'Afinado',
  'karaoke.pitch.low': 'Bajo',
  'karaoke.pitch.ultrastar':
    'Las barras azules son las notas objetivo; el trazo indica si tu voz está alta, afinada o baja.',
  'karaoke.chords.aria':
    'Acordes de guitarra estimados a partir de la pista musical',
  'karaoke.chords.analyzing': 'Buscando acordes… {percent}%',
  'karaoke.chords.estimate': 'Acorde estimado',
  'karaoke.chords.next': 'Siguiente',
  'karaoke.chords.in': 'en {seconds}s',
  'karaoke.chords.none': 'No se encontró un acorde estable',
  'karaoke.chords.confidence':
    'Confianza de la estimación de audio: {percent}%',
  'karaoke.maker.open': 'Crear',
  'karaoke.maker.openTitle': 'Crear o editar este karaoke',
  'karaoke.maker.dialog': 'Creador de karaoke',
  'karaoke.maker.eyebrow': 'CREADOR DE KARAOKE DE FLUIDEQ',
  'karaoke.maker.close': 'Cerrar el creador',
  'karaoke.maker.songTitle': 'Título de la canción',
  'karaoke.maker.untitled': 'Karaoke sin título',
  'karaoke.maker.undo': 'Deshacer',
  'karaoke.maker.redo': 'Rehacer',
  'karaoke.maker.preview': 'Vista previa · 1, 2, 3',
  'karaoke.maker.apply': 'Usar en el reproductor',
  'karaoke.maker.applyHint':
    'Usa estos cambios en el reproductor. El karaoke original no cambia; Exportar crea un archivo nuevo.',
  'karaoke.maker.lyrics': 'Letra',
  'karaoke.maker.toolsEdit': 'Herramientas de edición',
  'karaoke.maker.toolsAnalysis': 'Herramientas de análisis',
  'karaoke.maker.lyricsTiming': 'Tiempo de la letra',
  'karaoke.maker.timingAll': 'Canción completa',
  'karaoke.maker.timingFromWord': 'Desde la palabra',
  'karaoke.maker.timingAllHint':
    'Mueve juntas todas las palabras y notas sincronizadas.',
  'karaoke.maker.timingFromWordHint':
    'Mueve «{word}» y todo lo posterior. Lo anterior queda bloqueado.',
  'karaoke.maker.earlier': 'Mover toda la letra antes',
  'karaoke.maker.later': 'Mover toda la letra después',
  'karaoke.maker.openProject': 'Importar karaoke',
  'karaoke.maker.projectLoaded':
    'Proyecto cargado. El audio actual permanece conectado.',
  'karaoke.maker.karaokeImported':
    'Sincronización importada. El audio actual permanece conectado.',
  'karaoke.maker.tapWords': 'Marcar palabras',
  'karaoke.maker.recordLines': 'Grabar entradas de líneas',
  'karaoke.maker.syncLinesFromHere': 'Sincronizar líneas desde aquí',
  'karaoke.maker.syncWordsFromHere': 'Sincronizar palabras desde aquí',
  'karaoke.maker.syncNow': 'Ahora',
  'karaoke.maker.syncNext': 'Siguiente: {item}',
  'karaoke.maker.markLine': 'Marcar inicio',
  'karaoke.maker.markLineEnd': 'Marcar final',
  'karaoke.maker.captureEnd': 'Escuchando el final',
  'karaoke.maker.capturePressStart': 'Paso 1 · Pulsa Enter al INICIO',
  'karaoke.maker.captureReplaceStart':
    'Siguiente letra lista · Enter reemplaza su INICIO',
  'karaoke.maker.captureStartSaved':
    'Inicio guardado en {time} · Pulsa Enter al FINAL',
  'karaoke.maker.captureAutomaticStart':
    'Inicio automático {time} · Pulsa Enter al FINAL',
  'karaoke.maker.captureAutomaticSuggestion':
    'Inicio sugerido {time} · Enter ahora graba el INICIO',
  'karaoke.maker.captureFixEnd': 'Línea grabada · Enter corrige el FINAL',
  'karaoke.maker.captureStartPoint': 'INICIO',
  'karaoke.maker.captureEndPoint': 'FINAL',
  'karaoke.maker.captureGuideTitle': 'Sincronización de línea',
  'karaoke.maker.captureSetupTitle': '¿Listo para grabar los tiempos?',
  'karaoke.maker.captureSetupBody':
    'Escucha al cantante. Pulsa Enter cuando comience la línea, opcionalmente pulsa Tab en cada palabra nueva y vuelve a pulsar Enter cuando termine. Así una última palabra sostenida conserva toda su duración.',
  'karaoke.maker.captureSetupStatus':
    'Lee la guía en la vista previa y luego inicia la grabación.',
  'karaoke.maker.captureStartRecording': 'Iniciar grabación',
  'karaoke.maker.captureMoveGuide':
    'Arrastra para mover esta guía. Haz doble clic para centrarla.',
  'karaoke.maker.selectionPanel': 'Herramientas de selección',
  'karaoke.maker.selectionMoveGuide':
    'Arrastra para mover las herramientas. Haz doble clic para centrarlas.',
  'karaoke.maker.dismissSelection': 'Cerrar herramientas de selección',
  'karaoke.maker.captureCountdownReady': 'Prepárate para la primera línea',
  'karaoke.maker.captureGuideNext': 'Luego viene',
  'karaoke.maker.captureGuideAudio':
    'mueve el audio 2 segundos · Shift: 1 segundo',
  'karaoke.maker.captureGuideLyrics': 'elige la línea de letra',
  'karaoke.maker.captureGuidePlayback': 'reproduce o pausa',
  'karaoke.maker.captureGuideWords': 'marca la palabra siguiente',
  'karaoke.maker.captureGuideUndo': 'deshace la última marca',
  'karaoke.maker.stopRecording': 'Detener grabación',
  'karaoke.maker.markWord': 'Marcar palabra',
  'karaoke.maker.markNextWord': 'Siguiente palabra',
  'karaoke.maker.done': 'Terminar',
  'karaoke.maker.ignoreLine': 'Ignorar línea',
  'karaoke.maker.lineTimingComplete':
    'Sincronización de líneas terminada. Lista para revisar y usar en el reproductor.',
  'karaoke.maker.recordLinesHint':
    'ENTER marca inicio/final de línea · TAB marca la palabra siguiente · ↑ selecciona la letra anterior y salta a su inicio grabado · ↓ selecciona la letra siguiente · ←/→ solo mueve el audio 2 s · ESPACIO reproduce o pausa · Retroceso deshace',
  'karaoke.maker.panView': 'Mano · mover línea de tiempo',
  'karaoke.maker.panHint':
    'Herramienta Mano: arrastra cualquier parte del canvas para recorrer la canción sin editar.',
  'karaoke.maker.scrubHint':
    'Arrastra el cabezal para moverlo en silencio. Sobre la letra, FluidEQ reproduce solo una muestra muy corta.',
  'karaoke.maker.addNote': 'Nota',
  'karaoke.maker.selectNotes': 'Seleccionar notas',
  'karaoke.maker.paintNotes': 'Pintar notas',
  'karaoke.maker.selectNotesHint':
    'Arrastra un cuadro alrededor de las notas. Arrastra cualquier nota seleccionada para mover todo el grupo. Ctrl-clic en una sílaba para vincular la selección.',
  'karaoke.maker.paintNotesHint':
    'Arrastra sobre la cuadrícula de afinación para pintar una nota. La herramienta sigue activa para añadir varias notas.',
  'karaoke.maker.notesSelected': 'notas seleccionadas',
  'karaoke.maker.copyNotes': 'Copiar notas seleccionadas',
  'karaoke.maker.pasteNotes': 'Pegar notas en el cabezal',
  'karaoke.maker.notePasted': 'Nota pegada en el cabezal.',
  'karaoke.maker.notesPasted': '{count} notas pegadas en el cabezal.',
  'karaoke.maker.attachNotesByTime': 'Vincular a la letra',
  'karaoke.maker.detachNotes': 'Desvincular de la letra',
  'karaoke.maker.noteAttachHelp':
    'Mantén Ctrl y arrastra una nota seleccionada sobre una palabra o sílaba para vincularla. Las notas vinculadas siguen su tiempo y quedan totalmente bloqueadas hasta desvincularlas.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C copia la selección · Ctrl+V pega su primera nota en el cabezal.',
  'karaoke.maker.attachedTo': 'Vinculada a «{word}»',
  'karaoke.maker.noteUnattached': 'Sin vínculo con la letra',
  'karaoke.maker.splitWordSyllables': 'Dividir palabra en sílabas',
  'karaoke.maker.syllableEditorEyebrow': 'Editor de sílabas',
  'karaoke.maker.syllableEditorTitle': 'Dividir “{word}”',
  'karaoke.maker.syllableEditorHint':
    'Haz clic entre las letras para añadir o quitar una separación silábica.',
  'karaoke.maker.syllableSplitPoint': 'Cambiar separación después de “{text}”',
  'karaoke.maker.syllableEditorPreview': 'Sílabas resultantes',
  'karaoke.maker.applySyllableSplit': 'Aplicar división silábica',
  'karaoke.maker.hearNote': 'Escuchar nota',
  'karaoke.maker.split': 'Dividir',
  'karaoke.maker.delete': 'Eliminar',
  'karaoke.maker.analyze': 'Analizar melodía',
  'karaoke.maker.prepare': 'Preparar karaoke',
  'karaoke.maker.advanced': 'Herramientas de reparación',
  'karaoke.maker.prepared':
    'Este karaoke ya tiene letra y melodía sincronizadas.',
  'karaoke.maker.repairLyrics': 'Volver a detectar tiempos de letra',
  'karaoke.maker.repairMelody': 'Volver a detectar notas de melodía',
  'karaoke.maker.rebuildKaraoke': 'Reconstruir letra + melodía',
  'karaoke.maker.autoAlign': 'Alinear automáticamente',
  'karaoke.maker.aiMelody': 'Melodía con IA',
  'karaoke.maker.transcribe': 'Transcribir',
  'karaoke.maker.vocalStem': 'Cargar pista solo de voz',
  'karaoke.maker.vocalStemLoaded': 'Pista solo de voz cargada',
  'karaoke.maker.groupVoice': 'Voz y música',
  'karaoke.maker.stemsTitle': 'Pistas separadas',
  'karaoke.maker.stemBacking': 'Pista base',
  'karaoke.maker.stemVoice': 'Voz',
  'karaoke.maker.stemSave': 'Guardar',
  'karaoke.maker.groupLyrics': 'Letra y sincronización',
  'karaoke.maker.removeBackground': 'Separar la voz de la música',
  'karaoke.maker.removeBackgroundDone': 'Voz ya separada',
  'karaoke.maker.separationDownloading':
    'Descargando el modelo de separación ({percent}%) · una sola vez, unos 700 MB',
  'karaoke.maker.separationReading': 'Leyendo la canción',
  'karaoke.maker.separating': 'Separando la voz de la música',
  'karaoke.maker.separationDone':
    'Voz separada. La detección de letra está lista.',
  'karaoke.maker.separationSlow':
    'Sin aceleración gráfica en este equipo, así que tardará unos minutos en vez de menos de uno.',
  'karaoke.maker.separationRequired':
    'Separa primero la voz: la detección de letra lee la pista vocal aislada.',
  'karaoke.maker.wizardTitle': 'Preparar esta canción automáticamente',
  'karaoke.maker.wizardIntro':
    'Esta canción aún no tiene tiempos de letra. FluidEQ puede separar la voz de la música y leer de ella las palabras y sus tiempos. Todo se ejecuta en este ordenador.',
  'karaoke.maker.wizardStepSeparate': 'Separar la voz',
  'karaoke.maker.wizardStepTranscribe': 'Leer las palabras y los tiempos',
  'karaoke.maker.wizardLanguage': 'Idioma de la letra',
  'karaoke.maker.wizardLanguageAuto': 'Detectar automáticamente',
  'karaoke.maker.wizardStart': 'Preparar automáticamente',
  'karaoke.maker.wizardSkip': 'Lo haré yo',
  'karaoke.maker.wizardCancel': 'Detener',
  'karaoke.maker.wizardHide': 'Continuar en segundo plano',
  'karaoke.maker.wizardCancelled': 'Detenido. Se ha conservado lo terminado.',
  'karaoke.maker.vocalFocus': 'Enfocar voz central',
  'karaoke.maker.export': 'Exportar',
  'karaoke.maker.exportProject': 'Proyecto de FluidEQ',
  'karaoke.maker.exportUltraStar': 'TXT de UltraStar',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'LRC mejorado',
  'karaoke.maker.exportInstrumental': 'Pista base (sin voz)',
  'karaoke.maker.tapHint':
    'ESPACIO o ENTER marca «{word}» · ←/→ ajusta 25 ms · ↑/↓ cambia palabra · Retroceso deshace',
  'karaoke.maker.editHint':
    'Selecciona notas con un cuadro para moverlas o borrarlas juntas. Pinta notas en la cuadrícula. Ctrl-clic en una sílaba vincula las notas seleccionadas. Ctrl + rueda amplía.',
  'karaoke.maker.stats': '{notes} notas · {words} palabras · {checks} avisos',
  'karaoke.maker.wordStateLegend': 'Estado del trabajo de sincronización',
  'karaoke.maker.userAdjustedWords': '{count} ajustadas',
  'karaoke.maker.pendingWords': '{count} pendientes',
  'karaoke.maker.artist': 'Artista',
  'karaoke.maker.bpm': 'PPM',
  'karaoke.maker.zoom': 'Ampliación',
  'karaoke.maker.songPosition': 'Posición en la canción',
  'karaoke.maker.previousView': 'Sección anterior',
  'karaoke.maker.nextView': 'Sección siguiente',
  'karaoke.maker.resetZoom': 'Doble clic para ajustar la letra temporizada',
  'karaoke.maker.livePreview': 'Vista previa en vivo',
  'karaoke.maker.showPreview': 'Mostrar vista previa',
  'karaoke.maker.hidePreview': 'Ocultar vista previa',
  'karaoke.maker.previewEmpty':
    'Añade o alinea la letra temporizada para ver la vista previa.',
  'karaoke.maker.noteNormal': 'Nota',
  'karaoke.maker.noteGolden': 'Dorada',
  'karaoke.maker.noteFree': 'Libre',
  'karaoke.maker.untimed': 'Sin tiempo',
  'karaoke.maker.applyUntimed':
    'Aún hay {count} palabras sin un tiempo de voz verificado. Detéctalas o colócalas antes de usar este karaoke en el reproductor.',
  'karaoke.maker.selectHint':
    'Selecciona una palabra o nota melódica para inspeccionarla.',
  'karaoke.maker.rights':
    'Tengo permiso para usar y exportar este audio y esta letra.',
  'karaoke.maker.cancel': 'Cancelar',
  'karaoke.maker.localAnalysis': 'Análisis local',
  'karaoke.maker.lyricsEyebrow': 'LETRA',
  'karaoke.maker.lyricsTitle': 'Pega o edita una línea de letra por fila',
  'karaoke.maker.lyricsWarning':
    'Al reemplazar el texto se borran los enlaces de palabras para poder volver a marcarlas o alinearlas con seguridad.',
  'karaoke.maker.lyricsReferenceHint':
    'Añade la letra completa, incluidas las líneas repetidas y marcadores como [Verso] o [Coro]. FluidEQ conserva este texto y usa reconocimiento local para encontrar sus tiempos.',
  'karaoke.maker.referenceLyrics': 'Letra de referencia',
  'karaoke.maker.wordTiming': 'Sincronización por palabra',
  'karaoke.maker.lyricsWordCount': '{count} palabras en la referencia',
  'karaoke.maker.lyricsTimedCount': '{timed} de {total} sincronizadas',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Acepta la letra nueva antes de editar sus tiempos',
  'karaoke.maker.lyricsNoTimedWords': 'Todavía no hay palabras sincronizadas',
  'karaoke.maker.lyricsTimingEditorHint':
    'Después de detectar, selecciona cualquier palabra para corregir el texto, inicio o duración.',
  'karaoke.maker.lyricsSelectWord':
    'Selecciona una palabra para editar su tiempo.',
  'karaoke.maker.lyricsSelectedWord': 'Palabra seleccionada',
  'karaoke.maker.lyricsWordNavigation': 'Navegación entre palabras',
  'karaoke.maker.previousWord': 'Palabra anterior',
  'karaoke.maker.nextWord': 'Palabra siguiente',
  'karaoke.maker.lyricsPlaceholder':
    'Pega aquí la letra completa…\n\n[Verso]\nPrimera línea\nSegunda línea',
  'karaoke.maker.loadLyricsFile': 'Cargar archivo de letra',
  'karaoke.maker.lyricsFileLoaded': 'Se cargó la letra desde {file}.',
  'karaoke.maker.lyricsRequired':
    'Añade o pega la letra completa antes de detectar los tiempos y la melodía.',
  'karaoke.maker.detectTimingMelody': 'Detectar tiempos y melodía',
  'karaoke.maker.acceptLyrics': 'Aceptar letra',
  'karaoke.maker.acceptAndRecordLines': 'Aceptar y grabar tiempos',
  'karaoke.maker.continueInBackground': 'Continuar en segundo plano',
  'karaoke.maker.clearLyrics': 'Borrar letra',
  'karaoke.maker.clearLyricsTitle': '¿Borrar toda la letra?',
  'karaoke.maker.clearLyricsBody':
    'Esto elimina toda la letra y sus tiempos. Las notas permanecen, pero pierden sus enlaces a palabras. Se puede deshacer después.',
  'karaoke.maker.clearNotes': 'Borrar notas',
  'karaoke.maker.clearNotesTitle': '¿Borrar todas las notas melódicas?',
  'karaoke.maker.clearNotesBody':
    'Esto elimina todas las notas melódicas y conserva la letra con sus tiempos. Se puede deshacer después.',
  'karaoke.maker.notesCleared': 'Se borraron todas las notas melódicas.',
  'karaoke.maker.lyricsCleared':
    'Se borró toda la letra. Las notas existentes se conservaron sin enlaces a palabras.',
  'karaoke.maker.restore': 'Restaurar original',
  'karaoke.maker.restoreTitle': '¿Restaurar el karaoke original?',
  'karaoke.maker.restoreBody':
    'Esto descarta todas las ediciones de esta sesión y reconstruye el karaoke tal como se importó, incluido su borrador guardado. Se puede deshacer después de restaurar.',
  'karaoke.maker.restored': 'Se restauró el original importado.',
  'karaoke.maker.replaceLyricsWarning':
    'Las palabras cambiaron. Al reemplazarlas se reconstruyen sus identificadores y tiempos automáticos; las correcciones manuales existentes no se pueden transferir de forma fiable. Las notas permanecen y se volverán a enlazar.',
  'karaoke.maker.replaceAndDetect': 'Reemplazar y detectar',
  'karaoke.maker.wordText': 'Palabra',
  'karaoke.maker.wordStart': 'Inicio (ms)',
  'karaoke.maker.wordPosition': 'Posición',
  'karaoke.maker.wordDuration': 'Duración (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Ajusta el límite compartido: la palabra vecina cede o recibe tiempo sin cambiar el rango de la línea.',
  'karaoke.maker.usePlayhead': 'Usar cabezal',
  'karaoke.maker.playWord': 'Reproducir palabra',
  'karaoke.maker.allowAutoTiming': 'Permitir ajuste automático',
  'karaoke.maker.replaceLyrics': 'Reemplazar letra',
  'karaoke.maker.lyricsAutoAligned':
    'La letra nueva se aplicó y alineó con la melodía disponible.',
  'karaoke.maker.lyricsNeedPreparation':
    'Se aplicó la letra nueva. Pulsa Preparar karaoke para detectar sus tiempos.',
  'karaoke.maker.transcriptionEyebrow': 'MODELO LOCAL DE UNA SOLA DESCARGA',
  'karaoke.maker.transcriptionTitle': '¿Descargar el modelo de voz?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ descargará el modelo {model} con licencia MIT desde Hugging Face y lo guardará en este PC: unos 700 MB para separar la voz, una sola vez. Tu audio nunca sale de este ordenador. La primera vez tarda unos minutos y usa bastante memoria.',
  'karaoke.maker.transcriptionReview':
    'El reconocimiento es solo un punto de partida. FluidEQ conserva la ortografía de tu letra al comparar el texto y todos los tiempos siguen siendo editables.',
  'karaoke.maker.notNow': 'Ahora no',
  'karaoke.maker.downloadTranscribe': 'Descargar y transcribir',
  'karaoke.maker.downloadPrepare': 'Descargar y preparar la letra',
  'karaoke.maker.downloadingWhisper': 'Descargando el modelo de voz',
  'karaoke.maker.downloadOverall': 'Descarga total',
  'karaoke.maker.downloadFiles': '{complete} de {total} archivos',
  'karaoke.maker.loadingWhisper': 'Cargando el modelo de voz',
  'karaoke.maker.analysisRunning': 'Analizando la afinación localmente',
  'karaoke.maker.analysisAligned':
    'Se alinearon las palabras sin editar con {count} regiones de notas detectadas. Se conservó la sincronización manual.',
  'karaoke.maker.analysisFound':
    'El análisis encontró {count} regiones de notas.',
  'karaoke.maker.basicPitchRunning':
    'Ejecutando el modelo Basic Pitch incluido',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch encontró {count} notas melódicas editables. Una pista vocal limpia ofrece el mejor resultado.',
  'karaoke.maker.whisperPreparing': 'Preparando tiempos de letra',
  'karaoke.maker.whisperDecoding': 'Decodificando el audio localmente',
  'karaoke.maker.whisperTranscribing': 'Detectando tiempos de letra',
  'karaoke.maker.whisperTranscribingProgress':
    'Detectando tiempos · pasada {pass}/{passes} · bloque {chunk}/{chunks}',
  'karaoke.maker.whisperComplete': 'Tiempos de letra detectados',
  'karaoke.maker.whisperMatched':
    'Whisper relacionó {count} palabras reconocidas. Revisa su sincronización editable antes de exportar.',
  'karaoke.maker.autoAlignComplete':
    'La letra sin editar se alineó con la melodía detectada. Se conservó la sincronización manual.',
  'karaoke.maker.speechMemory': 'Memoria del modelo de voz',
  'karaoke.maker.speechMemoryReady': 'Listo en RAM',
  'karaoke.maker.speechMemoryCached': 'Guardado en disco',
  'karaoke.maker.speechMemoryMissing': 'Sin descargar',
  'karaoke.maker.freeMemory': 'Liberar RAM ahora',
  'karaoke.maker.memoryReleased':
    'El modelo de voz salió de la RAM. Sus archivos descargados siguen guardados.',
  'karaoke.maker.memoryReleaseBusy':
    'El modelo de voz está ocupado y todavía no puede liberarse.',
  'karaoke.maker.memoryAfterUse': 'Cuando esté inactivo',
  'karaoke.maker.memoryPolicy.ask': 'Preguntarme',
  'karaoke.maker.memoryPolicy.auto': 'Liberar automáticamente',
  'karaoke.maker.memoryPolicy.keep': 'Mantener cargado',
  'karaoke.maker.memoryAfter': 'Después de',
  'karaoke.maker.memoryMinutes': '{count} min',
  'karaoke.maker.memoryPromptTitle': '¿Liberar la memoria del modelo de voz?',
  'karaoke.maker.memoryPromptBody':
    'El modelo local está inactivo. Liberarlo ahorra RAM; sus archivos siguen guardados para cargarlo más rápido.',
  'karaoke.maker.keepLoaded': 'Mantener cargado',
  'karaoke.maker.exported': 'Se exportó {file}',
  'karaoke.maker.exportFallback': 'archivo de karaoke',
  'karaoke.maker.projectTooLarge': 'El proyecto supera los 16 MB.',
  'karaoke.maker.previewResize': 'Cambiar el tamaño de la vista previa en vivo',
  'karaoke.maker.seekBack': 'Retroceder {seconds} segundos',
  'karaoke.maker.seekForward': 'Avanzar {seconds} segundos',
  'karaoke.maker.jumpToStart': 'Ir al inicio de la canción',
  'karaoke.maker.jumpToEnd': 'Ir al final de la canción',
  'karaoke.maker.errorAudioLimits':
    'El análisis local admite audios de hasta 1 GB y grabaciones de menos de 30 minutos.',
  'karaoke.maker.errorComponentUnavailable':
    'No está disponible un componente necesario para el análisis local. Reinicia FluidEQ e inténtalo de nuevo.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ no pudo analizar este audio localmente.',
  'karaoke.maker.errorExportNeedsNotes':
    'Para exportar a UltraStar hace falta al menos una nota melódica.',
  'karaoke.maker.errorExport': 'FluidEQ no pudo exportar este karaoke.',
  'karaoke.maker.errorProjectVersion':
    'Este proyecto del Creador de karaoke se creó con una versión de FluidEQ no compatible.',
  'karaoke.maker.errorImport':
    'FluidEQ no pudo importar este karaoke o archivo de proyecto.',
  'karaoke.maker.errorParse':
    'No se pudo interpretar el archivo de letra o karaoke seleccionado.',
  'karaoke.maker.downloadFailed': 'Falló la descarga del modelo Whisper',
  'karaoke.maker.localAnalysisFailed': 'Falló el análisis local',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ no pudo descargar el modelo desde Hugging Face. Comprueba tu conexión a Internet o el firewall e inténtalo de nuevo.',
  'karaoke.maker.tryAgain': 'Intentar de nuevo',
  'karaoke.maker.dismiss': 'Cerrar error',
  'karaoke.maker.analysisSource':
    'Se usará «{file}» solamente como fuente local para el análisis.',
  'karaoke.maker.rightsRequired':
    'Confirma que tienes derechos sobre el audio y la letra antes de publicar una exportación.',
  'karaoke.maker.draftRestored': 'Borrador restaurado',
  'karaoke.maker.playerTimingLoaded':
    'Usando los tiempos actuales del reproductor. Deshacer restaura tu borrador guardado.',
};

export default karaoke;
