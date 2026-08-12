/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** Spanish. Neutral, not regional: "ordenador" and "computadora" both avoided. */
const es: Partial<Dictionary> = {
  'app.tagline': 'Tu sonido. En cada dispositivo. Automáticamente.',
  'app.actions': 'Acciones de FluidEQ',
  'app.actions.title': 'Acciones de audio',
  'app.status.ready': 'Conectado a Equalizer APO',
  'app.status.checking': 'Comprobando Equalizer APO…',
  'app.status.error': 'Equalizer APO no responde',
  'app.menu.importEq': 'Importar ajustes de EQ…',
  'app.menu.importConvolution': 'Importar respuesta al impulso…',
  'app.menu.restartAudio': 'Reiniciar el audio de Windows',
  'app.menu.reconfigure': 'Reconfigurar Equalizer APO',
  'app.menu.apoSettings': 'Ajustes de Equalizer APO',
  'app.menu.support': 'Apoya el proyecto',
  'whatsNew.eyebrow': 'NOTAS DE LA VERSIÓN',
  'whatsNew.title': 'Novedades de FluidEQ',
  'whatsNew.loading': 'Cargando las notas de la versión…',
  'whatsNew.missing':
    'No se han encontrado las notas de la versión en esta compilación. También están en GitHub.',
  'app.menu.whatsNew': 'Novedades',
  'app.menu.language': 'Idioma',
  'app.window.minimize': 'Minimizar',
  'app.window.maximize': 'Maximizar',
  'app.window.restore': 'Restaurar',
  'app.window.close': 'Cerrar',
  'app.window.minimizeApp': 'Minimizar FluidEQ',
  'app.window.maximizeApp': 'Maximizar FluidEQ',
  'app.window.restoreApp': 'Restaurar FluidEQ',
  'app.window.closeApp': 'Cerrar FluidEQ',
  'app.media.previous': 'Pista anterior',
  'app.media.playPause': 'Reproducir o pausar',
  'app.media.next': 'Pista siguiente',
  'app.media.previousAria': 'Pista anterior, en cualquier parte de este equipo',
  'app.media.playPauseAria':
    'Reproducir o pausar, en cualquier parte de este equipo',
  'app.media.nextAria': 'Pista siguiente, en cualquier parte de este equipo',
  'app.dismiss': 'Descartar',

  'tabs.aria': 'Espacio de trabajo de sonido',
  'tabs.eq': 'EQ',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'Carácter',
  'tabs.convolution': 'Convolución',
  'tabs.config': 'Config',
  'tabs.media': 'Multimedia',
  'tabs.karaoke': 'Karaoke',

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
  'karaoke.transport.seek': 'Posición de la canción',
  'karaoke.transport.volume': 'Volumen',
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

  'graph.resize': 'Arrastra para cambiar el tamaño de la gráfica',
  'graph.meter.aria':
    'Nivel de salida en directo, en decibelios reales por debajo del fondo de escala',
  'graph.meter.left': 'I',
  'graph.meter.right': 'D',
  'graph.meter.mono': 'M',
  'video.sites': 'Sitios de vídeo',
  'video.back': 'Atrás',
  'video.forward': 'Adelante',
  'video.reload': 'Recargar',
  'video.stop': 'Detener',
  'video.searchAria': 'Buscar en el sitio actual',
  'video.searchOn': 'Buscar en {site}',
  'video.searchGo': 'Buscar',
  'video.searchClear': 'Borrar la búsqueda',
  'video.searchRecent': 'Búsquedas recientes',
  'video.searchForget': 'Olvidar «{term}»',
  'video.searchForgetAll': 'Borrar las búsquedas recientes',
  'video.adBlock': 'Bloquear anuncios',
  'video.adBlockHint':
    'Salta los anuncios de vídeo y oculta la publicidad en YouTube.',
  'video.signOut': 'Cerrar sesión en todos los sitios',
  'video.signOutBusy': 'Cerrando sesión…',
  'video.signOutHint':
    'Borra todas las cookies, los inicios de sesión y las páginas en caché que guarda el reproductor.',
  'video.signOutDone': 'Sesión cerrada',
  'video.signOutFailed': 'No se pudo cerrar la sesión',
  'video.blockedTitle': 'Ese enlace lleva fuera del reproductor',
  'video.openInBrowser': 'Abrir en el navegador',
  'video.resize': 'Arrastra para cambiar el tamaño del reproductor',

  'notice.apoReconfigured':
    'Equalizer APO se instaló o se reconfiguró. Si no hay sonido, reinicia el servicio de audio de Windows en lugar de reiniciar el equipo.',
  'notice.restartNow': 'Reiniciar el audio ahora',
  'notice.importComplete': 'Importación completada',
  'notice.restartConfirm':
    'El audio se detendrá unos segundos y Windows pedirá permisos de administrador. ¿Continuar?',
  'update.title': 'Actualización de FluidEQ',
  'update.available':
    'La versión {version} está disponible. Descargándola ahora.',
  'update.downloading': 'Descargando la actualización… {percent}%',
  'update.ready':
    'La versión {version} está lista. Reinicia FluidEQ para terminar.',
  'update.restart': 'Reiniciar ahora',
  'update.restarting': 'Reiniciando…',
  'update.mandatory.title': 'Esta versión debe actualizarse',
  'update.mandatory.body':
    'Esta versión corrige un problema lo bastante grave como para que FluidEQ no deba seguir funcionando tal cual. La actualización se está descargando ahora.',
  'update.mandatory.notOptional':
    'No es una actualización opcional. Puedes cerrar este aviso y terminar lo que estabas haciendo: volverá a aparecer hasta que FluidEQ esté actualizado.',
  'update.mandatory.later': 'Ahora no',
  'update.mandatory.waiting': 'Obteniendo la actualización…',
  'update.mandatory.readyPrompt':
    'La actualización ya está descargada. FluidEQ se cerrará mientras se instala y volverá a abrirse después.',
  'update.mandatory.install': 'Instalar y reiniciar',
  'update.mandatory.installing': 'Instalando…',
  'update.mandatory.failedDownload':
    'No se ha podido descargar la actualización. O no se ha podido conectar con el servidor de descargas, o la conexión se ha cortado a mitad.',
  'update.mandatory.failedInstall':
    'La actualización se ha descargado, pero el instalador no ha arrancado. Puede que Windows lo haya rechazado o que el archivo descargado esté dañado.',
  'update.mandatory.manual':
    'También puedes instalarla tú: descarga la última versión desde la página de versiones y ejecútala. Tus ajustes y perfiles se conservan.',
  'update.mandatory.releasePage': 'Abrir la página de descargas',
  'notice.restartDone':
    'El audio de Windows se ha reiniciado. Vuelve a abrir cualquier aplicación que siga en silencio.',

  'sidebar.engine': 'MOTOR',
  'sidebar.systemEq': 'EQ del sistema',
  'sidebar.preamp': 'Preamplificación',
  'sidebar.preampAria': 'Ganancia de preamplificación (dB)',
  'sidebar.preampAuto':
    'Se ajusta sola. Desactiva Normalizar automáticamente para cambiarla.',
  'sidebar.headroom': 'MARGEN DE APO',
  'sidebar.autoPreamp': 'Normalizar automáticamente',
  'sidebar.visualizer': 'VISUALIZADOR',
  'sidebar.graphView': 'Gráfica de respuesta',

  'output.eyebrow': 'SIGUE TU SALIDA',
  'output.title': 'Perfil automático',
  'output.device': 'Dispositivo de salida',
  'output.active': 'ACTIVO',
  'output.none': 'No se han encontrado salidas activas',
  'output.mapping': 'Asignación automática',
  'output.mapping.neutral': 'Salida neutra',
  'output.mapping.live': 'Ajuste en directo asociado',
  'output.mapping.hint':
    'Modifica cualquier control del EQ para guardarlo y asociarlo automáticamente a esta salida.',
  'output.hint':
    'FluidEQ usa el identificador estable del dispositivo, así que este sonido lo acompaña siempre que Windows lo seleccione.',

  'extraOutput.eyebrow': 'SUENA EN DOS SITIOS',
  'extraOutput.title': 'Segunda salida',
  'extraOutput.target': 'Duplicar en',
  'extraOutput.off': 'Desactivado',
  'extraOutput.none': 'No se encontraron otras salidas',
  'extraOutput.active': 'DUPLICANDO',
  'extraOutput.volume': 'Volumen',
  'extraOutput.latency':
    'El sonido duplicado llega con casi un quinto de segundo de retraso. Bien para música en otra habitación, inservible para vídeo o juegos, y un eco si oyes las dos a la vez.',
  'extraOutput.virtual':
    'Hay un controlador de enrutamiento instalado. Apunta tus aplicaciones a él y ambas salidas quedan sincronizadas; luego da a cada una su propio perfil arriba.',
  'extraOutput.ambiguous':
    'Dos salidas comparten este nombre, así que FluidEQ no puede saber a cuál te refieres. Cambia el nombre de una en la configuración de sonido de Windows.',
  'extraOutput.unmatched':
    'Windows muestra esta salida pero FluidEQ no puede alcanzarla, así que no se puede duplicar en ella.',
  'extraOutput.labelsHidden':
    'FluidEQ aún no puede leer los nombres de las salidas, así que no puede emparejarlas. Permite el acceso al micrófono a FluidEQ y vuelve a abrir este panel.',
  'extraOutput.hint':
    'Duplicar reproduce lo que ya oyes en un segundo dispositivo. Solo funciona mientras FluidEQ está abierto.',

  'driver.eyebrow': 'CON QUÉ ESCUCHAS',
  'driver.title': 'Tipo de transductor',
  'driver.none': 'Sin compensación',
  'driver.none.hint': 'Solo tus bandas y el carácter',
  'driver.strength': 'Intensidad',
  'driver.range': '±1,5 dB',

  'profiles.eyebrow': 'TU SONIDO',
  'profiles.title': 'Perfiles guardados',
  'profiles.name': 'Nombre del perfil',
  'profiles.nameAria': 'Nombre del perfil',
  'profiles.new': 'Nuevo perfil',
  'profiles.newAria': 'Crear un perfil nuevo con el EQ actual',
  'profiles.untitled': 'Perfil sin título',
  'profiles.save': 'Guardar como nuevo',
  'profiles.update': 'Actualizar',
  'profiles.saveAria': 'Guardar los ajustes en el perfil',
  'profiles.restore': 'Restaurar',
  'profiles.restoring': 'Restaurando…',
  'profiles.restoreAria':
    'Restaurar la última versión guardada manualmente de este perfil',
  'profiles.attached': 'ACT',
  'profiles.attachedTitle': 'Sonando en esta salida',
  'profiles.detecting': 'Detectando tu salida…',
  'profiles.empty': 'Aún no hay perfiles. Crea tu primer sonido.',
  'profiles.error.empty': 'El nombre del perfil no puede estar vacío.',
  'profiles.error.restricted': 'Nombre no válido, elige otro.',
  'profiles.error.duplicate': 'Ese nombre ya existe, elige otro.',
  'profiles.edit': 'Editar el nombre del perfil',

  'autoeq.page.eyebrow': 'AJUSTA TUS AURICULARES',
  'autoeq.page.title': 'Corrección de auriculares',
  'autoeq.page.intro':
    'Di con qué auriculares estás escuchando y FluidEQ aplica la corrección publicada para ellos. Entra como una capa propia, con su intensidad y su interruptor, así que tus bandas de EQ no se tocan nunca. Cada medición se tomó en un banco real y alguien la publicó; nada se deduce del nombre del modelo.',
  'autoeq.source.hint':
    'De qué base de datos vienen las mediciones. «Todas las bases de datos» busca en todas a la vez.',
  'autoeq.model.hint':
    'Busca por marca o modelo. Si el tuyo no está medido, un pariente cercano de la misma gama suele acercarte bastante.',
  'autoeq.target.hint':
    'La mayoría de los modelos se miden más de una vez —distintos bancos, distintas curvas objetivo— y no suenan igual. Merece la pena probar más de una.',
  'autoeq.eyebrow': 'EMPIEZA POR UNA REFERENCIA',
  'autoeq.title': 'Biblioteca AutoEQ',
  'autoeq.selectSource': 'Elige un origen',
  'autoeq.applied': 'Aplicado: {name}',
  'autoeq.notApplied': 'Sin referencia aplicada',
  'autoeq.source': 'Origen de la medición',
  'autoeq.model': 'Modelo de auriculares',
  'autoeq.target': 'Medición / objetivo',
  'autoeq.apply': 'Aplicar EQ del modelo',
  'autoeq.applying': 'Aplicando…',
  'autoeq.applyAria': 'Aplicar el EQ del modelo seleccionado',
  'autoeq.checking': 'Comprobando la base de datos oficial…',
  'autoeq.updateAvailable': 'Actualización disponible ({count} modelos)',
  'autoeq.upToDate': 'Base de datos al día — {count} modelos',
  'autoeq.updateUnknown': 'No se pudo comprobar la actualización',
  'autoeq.update': 'Actualizar base de datos',
  'autoeq.updating': 'Actualizando…',
  'autoeq.updateAria': 'Actualizar la base de datos de AutoEq',
  'autoeq.allDatabases': 'Todas las bases de datos',
  'autoeq.allDatabases.hint': 'Busca en la base de datos oficial de AutoEq.',
  'autoeq.pickDevice': 'Elige primero un modelo 🎧',
  'autoeq.noResponses': 'No hay mediciones compatibles 😞',
  'autoeq.pickResponse': '¡Elige una medición! 🔊',
  'autoeq.selectSourcePlaceholder': 'Elige un origen…',
  'autoeq.searchSources': 'Buscar orígenes…',
  'autoeq.noModel': 'Ningún modelo medido coincide con tu búsqueda.',
  'autoeq.searchModels': 'Buscar por marca o modelo…',
  'squigImport.eyebrow': 'BRING YOUR CURVE WITH YOU',
  'squigImport.title': 'Import a Squiglink EQ',
  'squigImport.intro':
    'Use Squiglink’s calculator, then import its EQ export here.',
  'squigImport.open': 'Open Squiglink',
  'squigImport.stepOne': 'Choose a headset and target',
  'squigImport.stepTwo': 'Export the EQ text',
  'squigImport.stepThree': 'Paste it here and apply',
  'squigImport.pasteLabel': 'EQ export',
  'squigImport.placeholder': 'Paste the ParametricEQ or GraphicEQ text here…',
  'squigImport.fileAria': 'Choose an EQ export text file',
  'squigImport.chooseFile': 'Choose a .txt file',
  'squigImport.applyAria': 'Apply this imported EQ',
  'squigImport.importing': 'Applying…',
  'squigImport.apply': 'Apply imported EQ',
  'squigImport.applied': 'Applied curve',
  'squigImport.livePreview': 'Live preview',
  'squigImport.notApplied': 'Not applied',
  'squigImport.currentText': 'Current EQ text',
  'squigImport.flatPreview': 'Flat preview',
  'squigImport.flatCurve': 'No curve applied · 0 dB',
  'squigImport.bands': 'bands',
  'squigImport.clear': 'Remove import',
  'squigImport.chartAria': 'Frequency response of the imported EQ',
  'squigImport.emptyTitle': 'Your imported curve will appear here',
  'squigImport.emptyHint': 'Paste an export to preview its shape here.',
  'voicing.quickAria': 'Carácter: {name}',
  'voicing.quickNone': 'Carácter: ninguno',
  'voicing.quickTitle': 'Sin carácter aplicado',
  'voicing.quickLabel': 'Carácter',
  'voicing.quickNoneHint': 'Solo tus bandas de EQ',

  'eq.eyebrow': 'AJUSTE FINO',
  'eq.title': 'EQ paramétrico',
  'eq.smart': 'EQ inteligente',
  'eq.smart.cancel': 'Cancelar',
  'eq.smart.aria': 'EQ inteligente a partir de la salida en directo',
  'eq.smart.cancelAria': 'Cancelar la medición del EQ inteligente',
  'eq.smart.continuous': 'Continuo',
  'eq.smart.continuousAria':
    'Mantener el EQ inteligente midiendo y ajustando mientras suena la música',
  'eq.smart.modeAria': 'Elegir cómo mide el EQ inteligente',
  'eq.smart.mode.once.note': 'Una medición, aplicada de una vez',
  'eq.smart.mode.detail': 'Detalle',
  'eq.smart.mode.detail.note': 'Sigue midiendo · solo picos y huecos',
  'eq.smart.mode.balance': 'Equilibrio',
  'eq.smart.mode.balance.note':
    'Sigue midiendo · también iguala brillo y calidez',
  'eq.smart.mode.target': 'Objetivo',
  'eq.smart.mode.target.note':
    'Sigue midiendo · cada grabación a la misma curva',
  'eq.layers': 'También aplicado',
  'eq.layers.aria': 'Otros ajustes que afectan a esta salida',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '(modificado)',
  'eq.layers.eq.bands': '{count} bandas',
  'eq.layers.convolution': 'Convolución',
  'eq.layers.voicing': 'Carácter',
  'eq.layers.driver': 'Transductor',
  'eq.layers.headphone': 'Auriculares',
  'eq.layers.custom': 'FX personalizados',
  'eq.layers.disable': 'Desactiva {layer} sin eliminarla',
  'eq.layers.enable': 'Vuelve a activar {layer}',
  'eq.layers.smart': 'EQ inteligente',
  'eq.layers.smart.fullRange': 'Medido · todo el rango',
  'eq.layers.smart.range': 'Medido · de {low} a {high}',
  'eq.layers.remove': 'Quitar la capa de {layer}',
  'eq.layers.clearBands': 'Poner todas las bandas a 0 dB',
  'eq.layers.clearReference': 'Quitar la corrección de auriculares',
  'eq.layers.clearSmart':
    'Quitar la corrección medida. Tus bandas y la referencia se mantienen.',
  'eq.layers.clearCustom': 'Borrar los filtros y el texto de FX personalizados',
  'eq.clear': 'Vaciar EQ',
  'eq.addBand': 'Añadir banda',
  'eq.addBandAria': 'Añadir una banda de EQ',
  'eq.quickLayouts': 'Diseños rápidos',
  'eq.bandCount': '{count} bandas',
  'eq.selected': 'Banda seleccionada',
  'eq.filter': 'Filtro',
  'eq.frequency': 'Frecuencia',
  'eq.gain': 'Ganancia',
  'eq.gainDisabled': 'Ganancia · n/d',
  'eq.quality': 'Factor Q',
  'eq.delete': 'Eliminar banda',
  'eq.deleteAria': 'Eliminar la banda de EQ seleccionada',

  // Las cláusulas son sustantivos con «de», que no concuerdan en género:
  // «realce de aire» y «realce de presencia» son ambos correctos, mientras que
  // un participio pospuesto («aire realzado», «presencia realzada») obligaría a
  // declinar el nombre del rango dentro del hueco.
  'eq.smart.range.deepBass': 'graves profundos',
  'eq.smart.range.bass': 'graves',
  'eq.smart.range.lowMids': 'medios bajos',
  'eq.smart.range.mids': 'medios',
  'eq.smart.range.upperMids': 'medios altos',
  'eq.smart.range.presence': 'presencia',
  'eq.smart.range.treble': 'agudos',
  'eq.smart.range.highTreble': 'agudos altos',
  'eq.smart.range.air': 'aire',
  'eq.smart.range.separator': ', ',
  'eq.smart.shape.lifted': 'realce de {range}',
  'eq.smart.shape.eased': 'reducción de {range}',
  'eq.smart.need.more': 'falta de {range}',
  'eq.smart.need.less': 'exceso de {range}',
  'eq.smart.status.listening': 'Escuchando',
  'eq.smart.status.listeningPercent': 'Escuchando {percent}%',
  'eq.smart.status.settling': 'Escuchando {percent}% - estabilizando',
  'eq.smart.status.waitingOn': 'Escuchando {percent}% - esperando {ranges}',
  'eq.smart.status.waitingOnMore':
    'Escuchando {percent}% - esperando {ranges} +{count}',
  'eq.smart.status.paused': 'En pausa',
  'eq.smart.status.pausedResume': 'En pausa - reanuda para terminar',
  'eq.smart.status.pausedSilent': 'En pausa - no suena nada',
  'eq.smart.status.waitingForSound': 'Esperando sonido',
  'eq.smart.status.soundChanged': 'El sonido cambió - midiendo otra vez',
  'eq.smart.status.keptChanging': 'El sonido no dejó de cambiar - detenido',
  'eq.smart.status.notEnoughRange': 'No hay suficiente rango para medir',
  'eq.smart.status.alreadyBalanced': 'Ya está equilibrado',
  'eq.smart.status.applying': 'Aplicando…',
  'eq.smart.status.cancelled': 'Cancelado - no cambió nada',
  'eq.smart.status.failed': 'No se pudo medir la salida.',
  'eq.smart.result.fullRange': 'Equilibrado - rango completo',
  'eq.smart.result.range': 'Equilibrado - solo de {low} a {high}',
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Hz',
  'eq.smart.frequency.khz': '{value} kHz',
  'eq.smart.error.noCapture':
    'La captura de audio no está disponible en este entorno.',
  'eq.smart.error.noLoopback':
    'La captura de la salida del sistema no está disponible en este entorno.',
  'eq.smart.error.streamStopped':
    'La salida se detuvo antes de terminar la medición.',
  'eq.smart.error.analyserPaused':
    'El analizador está en pausa, así que la medición se detuvo.',
  'eq.smart.error.noSound':
    'No sonaba nada. Pon algo de música y vuelve a medir.',
  'eq.smart.error.noAudioTrack':
    'Windows no entregó una señal de audio del sistema.',
  'eq.smart.error.formatChanged':
    'El formato de salida cambió durante la medición. Inténtalo otra vez.',
  'eq.smart.error.deviceChanged':
    'El dispositivo de audio cambió durante la medición. Inténtalo otra vez.',
  'eq.smart.error.captureFailed':
    'No se pudo capturar la salida procesada del sistema.',
  'eq.smart.error.analyserOff':
    'El analizador de salida en vivo no está funcionando, así que no hay nada que medir.',
  'eq.smart.error.alreadyRunning': 'Ya hay una medición en curso.',
  'eq.smart.error.timedOut': 'La medición tardó demasiado. Inténtalo otra vez.',
  'eq.smart.error.closed': 'FluidEQ cerró la medición.',
  // «No cuenta» en vez de «ignorado»: el participio concordaría con el nombre
  // del rango, y en el hueco solo cabe una forma.
  'eq.smart.presence.ignoredBelow': 'no cuenta bajo {db} dB',
  'eq.smart.presence.trustedAbove': 'fiable sobre {db} dB',
  'eq.smart.presence.reset': 'Restablecer {range} en este modo',
  'eq.smart.limit.label': 'Límite Smart EQ {db} dB',
  'eq.smart.gap.title':
    '{range}: cuánto discrepa, frente a lo que hace falta para actuar',
  'eq.smart.gap.countdown': 'escribe en {seconds}s',

  'convolution.eyebrow': 'RESPUESTAS AL IMPULSO DE APO',
  'convolution.title': 'Biblioteca de convolución',
  'convolution.intro':
    'Descarga un impulso de fase mínima verificado para tus auriculares y aplícalo antes del EQ paramétrico. La gráfica de abajo muestra ambas curvas.',
  'convolution.import': 'Importar un WAV…',
  'convolution.importing': 'Importando…',
  'convolution.applied': 'Aplicado a esta salida',
  'convolution.clear': 'Quitar',
  'convolution.search': 'Buscar modelos de auriculares',
  'convolution.searchPlaceholder':
    'Prueba con «Kraken», «HD 650» o el nombre de un laboratorio',
  'convolution.notice':
    'El catálogo descargable lo proporciona AutoEq. Los archivos se importan como WAV de 48 kHz porque Equalizer APO exige que la respuesta al impulso coincida con la frecuencia de muestreo de la salida activa.',
  'convolution.loading': 'Cargando el catálogo oficial…',
  'convolution.empty':
    'No hay respuestas al impulso que coincidan. Prueba con un nombre más corto.',
  'convolution.source': 'Origen',
  'convolution.apply': 'Descargar y aplicar',
  'convolution.downloading': 'Descargando…',
  'convolution.isApplied': 'Aplicado',
  'convolution.none':
    'No hay ninguna convolución cargada. La pestaña de EQ funciona con total independencia.',

  'voicing.eyebrow': 'CURVAS OBJETIVO',
  'voicing.title': 'Carácter',
  'voicing.intro':
    'Un objetivo afinado para lo que estás haciendo de verdad. Cada uno se escribe como su propia capa después de tus bandas, así que tu ajuste nunca se toca y volver a Ninguno lo restaura exactamente.',
  'voicing.refused': 'No se pudo cambiar el voicing',
  'voicing.groupPurpose': 'Para qué',
  'voicing.groupGenre': 'Género',
  'voicing.none': 'Ninguno',
  'voicing.none.hint': 'Solo tus bandas de EQ, sin nada encima',
  'voicing.strength': 'Intensidad',
  'voicing.off': 'Nada',
  'voicing.full': 'Total',
  'voicing.inert': 'Al 0% de intensidad este carácter no hace nada.',
  'voicing.headroom':
    'Añade hasta +{peak} dB. Normalizar automáticamente reserva el margen; déjalo activado salvo que ajustes la preamplificación a mano.',

  'config.eyebrow': 'LO QUE LEE EL MOTOR',
  'config.title': 'Configuración de Equalizer APO',
  'config.lede':
    'Lo que hay ahora mismo en el disco, no lo que FluidEQ pretende.',
  'config.reload': 'Recargar',
  'config.reloadTitle': 'Volver a leer la configuración del disco',
  'config.reading': 'Leyendo…',
  'config.absent':
    'FluidEQ todavía no ha escrito nada en esta instalación de Equalizer APO.',
  'config.status.notIncluded':
    'Equalizer APO no está incluyendo esta configuración. No se aplica nada de lo que hay debajo.',
  'config.status.engineOff':
    'El motor de FluidEQ está apagado: esta configuración no nombra ninguna salida, así que Equalizer APO no aplica nada de ella.',
  'config.status.active':
    'Activa: Equalizer APO está aplicando esta configuración.',
  'config.outputsAria': 'Salidas en la configuración de Equalizer APO',
  'config.filters.one': '{count} filtro',
  'config.filters.many': '{count} filtros',
  'config.impulse': 'impulso',
  'config.playingNow': 'Sonando ahora',
  'config.liveTitle': 'El EQ continuo mantiene esta medición al día',
  'config.layer.on': 'activo',
  'config.layer.off': 'inactivo',
  'config.layers.noFile': 'Sin archivo propio',
  'config.layers.inFile': 'Se escribe en este archivo, no en uno propio.',
  'config.empty': 'No incluye nada: esta salida se deja sin tocar.',
  'config.file.missing': 'falta',
  'config.export': 'Exportar cadena',
  'config.import': 'Importar cadena',
  'config.import.hint':
    'La importación se aplica a la salida que estás escuchando.',
  'config.import.customSkipped':
    'Se omitió el archivo propio del remitente: una línea Include: o Plugin: cargaría código en el audio de Windows.',
  'config.file.yours': 'tuyo',
  'config.hint.custom': 'Es tuyo. Nunca se sobrescribe.',
  'config.hint.generated': 'Generado: se reescribe con el próximo cambio.',
  'config.hint.saving':
    'Al guardar se escribe el archivo; Equalizer APO lo recoge.',
  'config.edit': 'Editar',
  'config.cancel': 'Cancelar',
  'config.save': 'Guardar',

  'support.eyebrow': 'TOTALMENTE OPCIONAL',

  'support.petHint': 'Pulsa espacio para hacerlo saltar',

  'support.game.hint': 'Pulsa al ritmo cuando el pico llegue a la línea',

  'support.game.howTo':
    'Toca la mascota o pulsa espacio en cada golpe. Sigue así y algo pasa al llegar a ×10.',

  'support.game.thanks':
    'Si algo de esto te ha sacado una sonrisa, tus ideas y tu apoyo son lo que lo mantiene vivo.',

  'support.game.noAudio': 'Pon algo de música y el ritmo aparecerá aquí',

  'support.game.listening': 'Buscando el ritmo…',

  'support.game.share': 'Compartir',

  'support.game.shareEuphoria': 'Comparte el arcoíris',

  'support.game.shareTitle': 'Comparte tu puntuación',

  'support.game.shareUnlock':
    'Llega a ×10 y esta tarjeta activa el modo arcoíris, con todo el espectro.',

  'support.game.shareNote':
    'Guarda la tarjeta y adjúntala a tu publicación: ninguna de estas redes puede sacar una imagen de un enlace.',

  'support.game.shareSave': 'Guardar tarjeta',

  'support.game.shareCopyCard': 'Copiar tarjeta',

  'support.game.shareCardCopied': 'Copiada — pégala ahí',

  'support.game.shareCopy': 'Copiar texto',

  'support.game.shareCopied': 'Copiado',

  'support.game.shareLinkOnly':
    'Solo comparte el enlace: pega el texto tú mismo',

  'support.game.euphoria': 'Modo arcoíris',

  'support.game.euphoriaToggle': 'Activa o desactiva el modo arcoíris',

  'support.game.perfect': 'Perfecto',

  'support.game.great': 'Muy bien',

  'support.game.good': 'Bien',

  'support.game.miss': 'Fallaste',
  'support.title': 'Apoya el proyecto',
  'support.close': 'Cerrar',
  'support.pitch':
    'FluidEQ es libre y de código abierto, y va a seguir siéndolo: nada está detrás de un muro de pago y nunca se rastrea nada. Si se ha ganado un sitio en tu equipo, una contribución financia el tiempo que lo mantiene vivo y las próximas ideas que salgan del mismo taller.',
  'support.craft':
    'Esto es el trabajo de una sola persona, hecho con muchísimo cariño y una atención al detalle poco razonable. Cada panel está dibujado a mano y discutido: cómo se lee la curva de un vistazo, cómo se despliega un menú, qué hace un mando cuando lo giras despacio, qué palabras van en un botón. Aquí no hay componentes de catálogo con un tema encima.',
  'support.card': 'Tarjeta o monedero',
  'support.card.hint':
    'Pago seguro alojado por Stripe. Se abre en tu navegador: la aplicación nunca ve los datos de tu tarjeta.',
  'support.coffee': 'Invítame a un café',
  'support.coffee.hint':
    'Una propina puntual, sin necesidad de cuenta. Pulsa para abrirlo en el navegador o escanea el código con el móvil.',
  'support.verify': 'Comprueba la dirección antes de enviar.',
  'support.copy': 'Copiar dirección',
  'support.copied': 'Copiada',
  'support.openWallet': 'Abrir en el monedero',
  'support.contributed': 'He colaborado: desbloquea la estrella y el baile',
  'support.thanks': 'Gracias: tu mascota ya tiene su estrella, y ahora baila.',
  'support.releaseNotes': 'Mira las novedades de esta versión',
  'support.footerBefore':
    '¿Prefieres aportar tiempo? Las incidencias y los pull requests son igual de bienvenidos en',

  'disclaimer.heading': 'Sin garantía y sin responsabilidad',
  'disclaimer.asIs':
    'FluidEQ se entrega tal cual, sin garantía de ningún tipo. Nadie promete que funcione, que sirva para lo que quieres hacer con él, ni que vaya a seguir funcionando. Es lo que dicen las secciones 15 y 16 de la GNU General Public License, y se aplica tanto si te dieron esta copia como si pagaste por ella.',
  'disclaimer.liability':
    'FluidEQ cambia cómo se procesa el audio en tu ordenador, e instala y gobierna Equalizer APO, un programa aparte que se ejecuta con permisos de administrador y se sitúa en la ruta de audio de Windows. En la máxima medida que permita la ley, {author} no responde de ningún daño derivado de su uso: a tu oído, a altavoces, auriculares u otros equipos, a datos o a otros programas, ni a nada más, incluidas las pérdidas que no hubieras podido prever.',
  'disclaimer.volume':
    'El sonido puede ser fuerte, y la ecualización puede hacerlo más fuerte de lo que era el material original. Baja el volumen antes de cambiar un ajuste y súbelo después.',
  'disclaimer.localLaw':
    'Algunos países no permiten que un vendedor excluya determinadas garantías o responsabilidades. Donde sea así, se aplican esas normas y este aviso no te quita los derechos que te da la ley.',
  'disclaimer.accepting': 'Al usar FluidEQ aceptas lo anterior.',
  'disclaimer.language':
    'Este aviso se redactó en inglés. Si una traducción difiere del texto en inglés, prevalece el texto en inglés.',
  'disclaimer.accept': 'Lo entiendo y lo acepto',
  'disclaimer.decline': 'Salir',

  'language.title': 'Idioma',
  'language.aria': 'Idioma de la interfaz',
  'waveform.style': 'Cambia el estilo del medidor',
};

export default es;
