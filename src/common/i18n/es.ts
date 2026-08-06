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
  'tabs.video': 'Vídeo',

  'graph.resize': 'Arrastra para cambiar el tamaño de la gráfica',
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
  'eq.smart.fromFlat': 'Desde plano',
  'eq.layers': 'También aplicado',
  'eq.layers.aria': 'Otros ajustes que afectan a esta salida',
  'eq.layers.convolution': 'Convolución',
  'eq.layers.voicing': 'Carácter',
  'eq.layers.driver': 'Transductor',
  'eq.layers.headset': 'Auriculares',
  'eq.layers.smart': 'EQ inteligente',
  'eq.layers.smart.fullRange': 'Medido · todo el rango',
  'eq.layers.smart.range': 'Medido · de {low} a {high}',
  'eq.layers.remove': 'Quitar la capa de {layer}',
  'eq.layers.clearReference':
    'Borrar el modelo de referencia y las bandas que generó',
  'eq.layers.clearSmart':
    'Quitar la corrección medida. Tus bandas y la referencia se mantienen.',
  'eq.fromFlat': 'Desde plano',
  'eq.fromFlat.hint':
    'Descarta la corrección anterior del EQ inteligente antes de escuchar. Úsalo cuando un corte existente esté tapando justo la zona que afecta: la medición no puede ver a través de su propia corrección. Tus bandas nunca se tocan.',
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
  'voicing.none': 'Ninguno',
  'voicing.none.hint': 'Solo tus bandas de EQ, sin nada encima',
  'voicing.strength': 'Intensidad',
  'voicing.off': 'Nada',
  'voicing.full': 'Total',
  'voicing.inert': 'Al 0% de intensidad este carácter no hace nada.',
  'voicing.headroom':
    'Añade hasta +{peak} dB. Normalizar automáticamente reserva el margen; déjalo activado salvo que ajustes la preamplificación a mano.',

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
