/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  'app.dismiss': 'Descartar',

  'tabs.aria': 'Espacio de trabajo de sonido',
  'tabs.eq': 'EQ y tipo de auriculares',
  'tabs.voicing': 'Carácter',
  'tabs.convolution': 'Convolución',
  'tabs.config': 'Config',
  'tabs.video': 'Vídeo',

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
  'video.blockedTitle': 'Ese enlace lleva fuera del reproductor',
  'video.blockedSignInTitle':
    'El inicio de sesión se hace en tu navegador, no aquí',
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
  'autoeq.allDatabases.hint':
    'Busca a la vez en AutoEq oficial y GadgetryTech.',
  'autoeq.pickDevice': 'Elige primero un modelo 🎧',
  'autoeq.noResponses': 'No hay mediciones compatibles 😞',
  'autoeq.pickResponse': '¡Elige una medición! 🔊',
  'autoeq.selectSourcePlaceholder': 'Elige un origen…',
  'autoeq.searchSources': 'Buscar orígenes…',
  'autoeq.noModel': 'Ningún modelo medido coincide con tu búsqueda.',
  'autoeq.searchModels': 'Buscar por marca o modelo…',
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
  'eq.layers.disable': 'Desactiva {layer} sin eliminarla',
  'eq.layers.enable': 'Vuelve a activar {layer}',
  'eq.layers.smart': 'EQ inteligente',
  'eq.layers.smart.fullRange': 'Medido · todo el rango',
  'eq.layers.smart.range': 'Medido · de {low} a {high}',
  'eq.layers.remove': 'Quitar la capa de {layer}',
  'eq.layers.clearBands': 'Poner todas las bandas a 0 dB',
  'eq.layers.clearReference':
    'Borrar el modelo de referencia y las bandas que generó',
  'eq.layers.clearSmart':
    'Quitar la corrección medida. Tus bandas y la referencia se mantienen.',
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

  'config.eyebrow': 'Configuración de Equalizer APO',
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
  'config.empty': 'No incluye nada: esta salida se deja sin tocar.',
  'config.file.missing': 'falta',
  'config.export': 'Exportar cadena',
  'config.import': 'Importar cadena',
  'config.import.hint':
    'La importación se aplica a la salida que estás escuchando.',
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

  'support.game.shareEuphoria': 'Comparte la euforia',

  'support.game.shareTitle': 'Comparte tu puntuación',

  'support.game.shareUnlock':
    'Llega a ×10 y esta tarjeta se convierte en modo euforia, con todo el arcoíris.',

  'support.game.shareNote':
    'Guarda la tarjeta y adjúntala a tu publicación: ninguna de estas redes puede sacar una imagen de un enlace.',

  'support.game.shareSave': 'Guardar tarjeta',

  'support.game.shareCopyCard': 'Copiar tarjeta',

  'support.game.shareCardCopied': 'Copiada — pégala ahí',

  'support.game.shareCopy': 'Copiar texto',

  'support.game.shareCopied': 'Copiado',

  'support.game.shareLinkOnly':
    'Solo comparte el enlace: pega el texto tú mismo',

  'support.game.euphoria': 'Modo euforia',

  'support.game.euphoriaToggle': 'Activa o desactiva el modo euforia',

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

  'language.title': 'Idioma',
  'language.aria': 'Idioma de la interfaz',
  'waveform.style': 'Cambia el estilo del medidor',
};

export default es;
