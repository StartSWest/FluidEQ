/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Ayuda',
  'help.title': 'Guía de usuario',
  'help.subtitle': 'Encuentra tu sonido. Siéntete como en casa.',
  'help.intro':
    'Una guía práctica de FluidEQ, con ilustraciones hechas con los propios controles de la app. Empieza por tu primera escucha y explora a tu ritmo.',
  'help.offline': 'Disponible sin conexión',
  'help.search': 'Buscar en la guía',
  'help.searchHint': 'Prueba motor, graves, escena…',
  'help.contents': 'En esta guía',
  'help.results': '{count} capítulos',
  'help.resultsOne': '{count} capítulo',
  'help.empty':
    'No hay resultados. Prueba una frase más corta o borra la búsqueda.',
  'help.clear': 'Borrar búsqueda',
  'help.close': 'Cerrar guía',
  'help.enlarge': 'Ampliar captura: {title}',
  'help.closeImage': 'Cerrar captura',
  'help.controlsOf': 'Qué hace cada control: {title}',
  'help.captureNote':
    'Las ilustraciones en vivo siguen tu idioma y los colores de tu ventana. Los ajustes de ejemplo ilustran los controles; no son presets recomendados.',
  'help.steps': 'Pruébalo',
  'help.tip': 'Conviene saber',
  'help.back': 'Volver arriba',

  'help.group.start': 'Primeros pasos',
  'help.group.sound': 'Moldea tu sonido',
  'help.group.visuals': 'Mira tu música',
  'help.group.plus': 'Escenas y tu cuenta',
  'help.group.listen': 'Escucha, canta y comparte',
  'help.group.help': 'Cuando necesites ayuda',

  'help.start.title': 'Tus primeros cinco minutos',
  'help.start.intro':
    'Empieza con una canción conocida a un volumen cómodo. El panel izquierdo tiene el botón de encendido de FluidEQ y la preamplificación; el centro es tu espacio de trabajo, con el gráfico sobre tus bandas; el panel de sonido de la derecha sigue a tu salida y sus perfiles. La barra al pie de la ventana controla lo que esté sonando. El recorrido de abajo solo se transmite cuando pulsas Reproducir. Para la página de juegos, consulta Laboratorio gaming.',
  'help.start.steps':
    'Instala FluidEQ y deja seleccionado el Motor FluidEQ cuando el instalador pregunte cómo procesar tu sonido. Windows pide permiso una vez, sin reiniciar.\nElige tu dispositivo de escucha en la tarjeta Salida del panel de sonido. Pulsa el botón de encendido arriba del panel izquierdo y deja Normalizar automáticamente activado.\nPon una canción, abre EQ → Bandas, mueve un poco el deslizador de una banda y compara con el botón de encendido apagado y encendido.',
  'help.start.tip':
    'El EQ para todo el sistema necesita Windows y un motor de audio: el Motor FluidEQ o Equalizer APO. En macOS y Linux la app muestra salidas de demostración, así que ahí una gráfica en movimiento no demuestra que se esté procesando nada.',
  'help.start.keywords':
    'instalación, primeros pasos, empezar, comenzar, inicio rápido, guía rápida, tutorial, cómo usar, principiante, novato, básico, introducción, configurar, configuración inicial, manual, botón de encendido, gráfico, pestañas, bandas',
  'help.start.pagesName': 'Las páginas del EQ',
  'help.start.pages':
    'Bandas, Correcciones de auriculares, Convolución y Config: lo que da forma al sonido, una página cada cosa.',
  'help.start.engineName': 'El motor',
  'help.start.engine':
    'Qué motor reproduce tu EQ: el Motor FluidEQ o Equalizer APO. Un punto rojo significa que no llega a la salida que estás escuchando.',
  'help.start.delay':
    'Con cuánto retraso reproduce el motor el sonido en esta salida. Púlsalo para ver qué añade cada etapa.',
  'help.start.graphName': 'El gráfico',
  'help.start.graph':
    'La curva de tu EQ y un punto en cada banda, con lo que oyes moviéndose detrás. Arrastra un punto para dar forma al sonido; el resto está en el capítulo del gráfico.',
  'help.start.tabsName': 'Tu EQ, Preset, Tono',
  'help.start.tabs':
    'Tres pestañas bajo el gráfico: tus propias bandas, un preset listo debajo de ellas, y los cortes y diales de Tono. Las herramientas de cada pestaña están al final de la fila.',
  'help.start.bandsName': 'Tus bandas',
  'help.start.bands':
    'Un deslizador por banda, con su frecuencia arriba y su ganancia abajo. El capítulo del EQ muestra cada parte.',
  'help.video.play': 'Reproducir el vídeo: {title}',
  'help.video.loading': 'Cargando desde fluideq.com…',
  'help.video.failed':
    'No se pudo cargar el vídeo. Se reproduce desde fluideq.com, así que necesita conexión a internet.',
  'help.video.retry': 'Reintentar',

  'help.window.title': 'Un recorrido por la ventana',
  'help.window.intro':
    'El encabezado te lleva de una página de FluidEQ a otra y muestra el sonido mientras suena. El panel izquierdo tiene el botón de encendido de FluidEQ, la preamplificación y el medidor de nivel; el panel de sonido de la derecha sigue a tu salida y sus perfiles.',
  'help.window.steps':
    'Abre una página desde la cabecera: Escenas, Compartir audio, Micrófono, Laboratorio gaming, EQ, DSP, Biblioteca, Karaoke, Multimedia en línea.\nPulsa el botón de encendido arriba del panel izquierdo para activar FluidEQ, y deja Normalizar automáticamente activado, para que ningún realce sature.\nPulsa el medidor de nivel para pasar a su siguiente estilo; con Ctrl vuelves al anterior.\nEn el menú ≡, lleva Brillo a donde quieras, de oscuro del todo a blanco del todo, y dale a Tono un segundo color para dibujar las bandas, el título y los controles encendidos en un degradado entre los dos.\nPara conmutar el procesamiento desde otra app, abre ≡ → Tecla de encendido/apagado y elige una combinación. No hay ninguna asignada al principio; un aviso sobre las ventanas confirma si FluidEQ está encendido o apagado.\nHaz clic derecho en cualquier campo de texto para Cortar, Copiar, Pegar y Seleccionar todo. Las búsquedas ignoran mayúsculas, tildes, espacios y puntuación: escribir kpop encuentra K-pop.',
  'help.window.tip':
    'El menú Ayuda abre esta guía, Novedades, el solucionador de problemas de audio e Informar de un problema. El menú ≡ que hay a su lado tiene dos columnas. A la izquierda: la tarjeta del motor, Solucionar problemas de audio, Reiniciar el audio de Windows, la Tecla de encendido/apagado, la importación de ajustes de EQ o de una respuesta al impulso, Procesos, que muestra qué está usando cada parte de FluidEQ, Restablecer todos los ajustes, las animaciones, Iniciar con Windows (FluidEQ arranca entonces en la bandeja y da forma a tu sonido sin abrir ninguna ventana) y el idioma. A la derecha, el aspecto de la ventana: Brillo, Tono (sus dos muestras son el color de la ventana y un segundo color para un degradado), Teñir el icono (desactivado al principio; pone el icono de la barra de tareas, el de la bandeja y el de su menú con los colores de la ventana), los deslizadores del EQ y Usar como fondo de escritorio. Los avisos se apilan abajo a la derecha de la ventana. El interruptor que sigue a los menús convierte la ventana en el Reproductor compacto.',
  'help.window.keywords':
    'interfaz, pestañas, cabecera, secciones, navegación, barra superior, barra inferior, barra de reproducción, panel lateral, botones, vúmetro, tono, color, segundo color, degradado, tint, colour, second colour, gradient, tour, donar, donaciones, tema, modo oscuro, modo claro, tema oscuro, tema claro, modo nocturno, idioma, lenguaje, cambiar idioma, iniciar con windows, arrancar con windows, inicio automático, arranque automático, al iniciar windows, buscar, búsqueda, mayúsculas, minúsculas, tildes, espacios, puntuación, search, accents, spaces, punctuation, case insensitive, encendido, botón de encendido, brillo, ventana blanca, clic derecho, menú contextual, cortar, copiar, pegar, avisos, micrófono',
  'help.window.headerLeftCaption': 'El encabezado, hasta la señal',
  'help.window.headerRightCaption': 'El encabezado, después de la señal',
  'help.window.railCaption': 'El panel izquierdo',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch y Suno, reproducidos dentro de FluidEQ con tu EQ aplicado.',
  'help.window.share':
    'Envía el sonido de este ordenador a otro, o reproduce aquí el de otro.',
  'help.window.mic':
    'Tus micrófonos, cada uno con su propio sonido de voz, que oyen todas las apps.',
  'help.window.gaming':
    'Tus juegos, cada uno con un sonido propio, ajustado para ese juego.',
  'help.window.eq':
    'Tus bandas, presets, corrección de auriculares y la configuración del motor.',
  'help.window.waveName': 'Señal de audio',
  'help.window.wave':
    'Lo que está sonando, mientras suena, con su nivel de pico; el menú Vista del gráfico puede ocultarla.',
  'help.window.dsp':
    'El rack de efectos: presets, la Sala y todas las etapas de la cadena.',
  'help.window.library':
    'Tus archivos de música, álbumes y cola de reproducción.',
  'help.window.karaoke':
    'Canta con la música y convierte tus propias canciones en karaoke.',
  'help.window.plus':
    'Escenas: la galería, el Estudio y la Iluminación dinámica.',
  'help.window.support': 'Formas de apoyar el desarrollo de FluidEQ.',
  'help.window.help':
    'Esta guía, Novedades, Notas de la versión completas, Foro, el diagnóstico de audio, Informar de un problema y Acerca de FluidEQ. Las notas completas se abren directamente. Acerca de incluye enlaces a sus secciones y, si el enlace de apoyo está disponible, una tarjeta de Buy Me a Coffee con código QR.',
  'help.window.actions':
    'Dos columnas. Órdenes y comportamiento: el motor, Solucionar problemas de audio, Reiniciar el audio de Windows, la Tecla de encendido/apagado (un atajo que apaga y enciende todo el procesamiento de FluidEQ mientras otra app está delante; al principio no hay ninguno, y una tarjeta sobre tus otras ventanas confirma cada cambio), la importación de ajustes de EQ o de una respuesta al impulso, Procesos, Restablecer todos los ajustes, las animaciones, Iniciar con Windows y el idioma. Aspecto: Brillo, Tono y su segundo color, Teñir el icono, los deslizadores del EQ y Usar como fondo de escritorio.',
  'help.window.systemEq':
    'El botón de encendido de FluidEQ: activa o desactiva su procesamiento para todo lo que suena en el PC. La línea de debajo nombra el motor; se pone en rojo cuando el motor no llega a la salida que estás escuchando, y entonces una pulsación pregunta por el motor.',
  'help.window.preamp':
    'Baja el nivel antes del EQ para que los realces tengan margen. Mientras Normalizar automáticamente la controla, indica AUTO; con él desactivado, gira el dial o pulsa su número para escribir un nivel. Ctrl+clic la devuelve a 0 dB.',
  'help.window.autoNormalize':
    'Mantiene la preamplificación justo lo bastante baja para que nada de lo que realces sature.',
  'help.window.responseGraph': 'Muestra u oculta la gráfica de respuesta.',
  'help.window.meterName': 'Medidor de nivel',
  'help.window.meter':
    'El nivel de salida, izquierdo y derecho, en decibelios reales, con el pico del canal más fuerte encima. Púlsalo para pasar a su siguiente estilo; con Ctrl vuelves al anterior.',
  'help.player.title': 'El Reproductor compacto',
  'help.player.intro':
    'Un interruptor convierte la ventana de FluidEQ en el Reproductor compacto, una sola columna estrecha: arriba, una escena o un estilo con la canción encima y los controles de reproducción debajo; luego Sonido, tu ecualizador; y luego A continuación y tus listas. Lo que esté sonando sigue sonando, y el mismo interruptor te devuelve a la app completa, en la página que dejaste.',
  'help.player.steps':
    'Pulsa el interruptor del Reproductor compacto en la barra de título, junto a Ayuda. En el reproductor, el mismo interruptor te devuelve a la app completa.\nPliega Sonido, o A continuación y Listas, hasta su cabecera, y la imagen ocupa el espacio; pulsa la cabecera para volver a abrirlo. Arrastra el borde superior o inferior del reproductor para hacerlo más alto o más bajo.\nHaz doble clic en la imagen para que llene la pantalla; Esc lo devuelve a su sitio. Pulsa el nombre del estilo, junto a Aleatorio y Repetir, para elegir entre todos los estilos y escenas.\nElige Plegar en una línea en el menú del logotipo de FluidEQ para plegar el reproductor en una sola línea; el logotipo lo despliega.\nEn ese mismo menú, ajusta el Brillo propio del reproductor, la Transparencia sobre una escena o el Tono de la ventana sobre un estilo estándar, y la Luz del día de una escena. Siempre visible, ahí o en la cabecera, lo mantiene por encima de las demás ventanas.\nSuelta archivos de música en cualquier parte del reproductor: se suman a la Biblioteca y al final de A continuación o, sobre la lista, al punto donde los sueltes.\nEn Sonido, elige Tone para graves, medios y agudos o Bandas para el EQ completo. El preset y el modo EQ cambian la misma salida que la app completa. Explorar escenas abre la galería; el cambio automático de escena también funciona en el reproductor compacto.',
  'help.player.tip':
    'El volumen del reproductor es el de tu ordenador, el mismo que en Windows, así que ajusta el nivel de todo lo que suena en el ordenador. Si el reproductor acaba fuera de la pantalla, haz clic derecho en el icono de FluidEQ en la bandeja del sistema y elige Recuperar la ventana. Mientras suena un juego, su botón muestra solo el nombre del juego para caber en el reproductor compacto.',
  'help.player.keywords':
    'mini player, mini reproductor, minirreproductor, reproductor pequeño, compacto, modo compacto, modo mini, winamp, amp, modo reproductor, siempre visible, siempre encima, always on top, fijar, plegar, contraer, una línea, cola, a continuación, soltar archivos, arrastrar archivos, tema, tema claro, tema oscuro, modo oscuro, modo claro, ventana pequeña, reproductor flotante, volumen',
  'help.player.topCaption': 'Arriba: la canción y cómo se reproduce',
  'help.player.eqCaption': 'Sonido, tu ecualizador',
  'help.player.queueCaption': 'A continuación',
  'help.player.menuCaption': 'El menú del reproductor',
  'help.player.foldedCaption': 'Plegado en una línea',
  'help.player.menu':
    'Volver a la app completa o a una de sus páginas; el Brillo propio del reproductor, la Transparencia o el Tono, la Luz del día de una escena, Teñir el icono y los deslizadores del EQ; Siempre visible y Plegar en una línea.',
  'help.player.pin':
    'Mantiene el reproductor por encima de las demás ventanas.',
  'help.player.switch': 'Volver a la app completa, en la página que dejaste.',
  'help.player.clock':
    'Tiempo reproducido. Haz clic para ver el tiempo restante.',
  'help.player.level':
    'El nivel del sonido que sale de FluidEQ, en decibelios.',
  'help.player.volume':
    'El volumen de tu ordenador, el mismo que en Windows: ajusta el nivel de todo lo que suena en el ordenador.',
  'help.player.seek': 'Por dónde va la canción. Arrastra para saltar.',
  'help.player.playingName': 'Controles de reproducción',
  'help.player.playing':
    'Anterior, retroceder cinco segundos, reproducir o pausar, avanzar cinco segundos, siguiente y detener.',
  'help.player.orderName': 'Aleatorio y repetir',
  'help.player.order':
    'Pone A continuación en orden aleatorio, y repite todo, solo esta canción o nada.',
  'help.player.lookName': 'Estilo',
  'help.player.look':
    'El estilo o la escena del reproductor. Púlsalo para elegir entre todos.',
  'help.player.bands':
    'Arrastra una banda arriba o abajo para realzarla o atenuarla. Debajo lleva escrita su frecuencia.',
  'help.player.tone':
    'Tono muestra los mandos de Graves, Medios y Agudos; la pestaña de al lado, todas las bandas.',
  'help.player.upNext':
    'A continuación y Listas, cada pestaña con cuántos elementos tiene, y el tiempo que le queda a la cola.',
  'help.player.songsName': 'Las canciones',
  'help.player.songs':
    'Lo que suena después. Haz clic en una canción para reproducirla, arrástrala para moverla, o suelta aquí archivos de música para añadirlos donde los sueltes.',
  'help.player.openIn': 'Abre la app completa en una de sus páginas.',
  'help.player.theme':
    'El Brillo propio del reproductor, independiente del de la app completa; la Transparencia sobre una escena, o el Tono de la ventana sobre un estilo estándar; la Luz del día de una escena; y Teñir el icono, desactivado al principio, para el icono de la barra de tareas, el de la bandeja y el de su menú en los colores de la ventana.',
  'help.player.fold': 'Pliega el reproductor en una línea.',
  'help.player.unfold':
    'Despliega el reproductor. La flecha del otro extremo también.',
  'help.player.foldedPlaying': 'Reproducir o pausar.',
  'help.player.fullScreen':
    'Llena la pantalla con la escena o el estilo. Un doble clic en la imagen hace lo mismo, y Esc devuelve la pantalla.',
  'help.player.sourceName': 'Origen',
  'help.player.source':
    'De dónde viene la canción: la Biblioteca, Multimedia en línea, Karaoke, otro ordenador u otro programa de este PC. Al pulsarlo se abre esa página en la app completa.',
  'help.player.heart':
    'Añade una canción de la Biblioteca a tus Favoritos, o la quita.',
  'help.player.soundFold':
    'Pliega los controles de sonido hasta esta fila, que deja a mano el preset, la Corrección inteligente y el interruptor, y los vuelve a abrir.',
  'help.player.mode':
    'Abre el Modo EQ: con cuánta fuerza actúan tu EQ y las curvas, su Q de banda, su fase y sus agudos.',
  'help.player.save': 'Guarda A continuación como una lista propia.',
  'help.player.queueFold':
    'Pliega A continuación y Listas hasta sus pestañas, y la imagen ocupa el espacio.',
  'help.player.remove':
    'Quita de A continuación una canción que aún no ha sonado.',
  'help.player.output':
    'Adónde va el sonido: la salida por la que reproduce Windows.',
  'help.player.engineName': 'Motor',
  'help.player.engine':
    'Qué motor da forma al sonido; se ilumina mientras FluidEQ está activado.',
  'help.player.sliders':
    'Tiradores redondos o tapas rectangulares en los deslizadores del EQ, aquí y en la página del EQ.',

  'help.requirements.title': 'Qué necesita tu PC',
  'help.requirements.intro':
    'FluidEQ funciona en cualquier PC con Windows de los últimos diez años. Dos partes piden más que el resto: las escenas dibujan en la tarjeta gráfica, y el karaoke con IA descarga sus modelos la primera vez que lo usas.',
  'help.requirements.steps':
    'Mira qué Windows tienes: Windows 10 versión 1803 o posterior, o Windows 11, de 64 bits, 4 GB de memoria y unos 600 MB de disco. Procesar todo lo que suena en el PC necesita el Motor FluidEQ o Equalizer APO, y Windows pide permiso una vez mientras se instala.\nPara reproducir escenas: cualquier tarjeta gráfica o gráfica integrada de 2013 en adelante. A 1080p la integrada basta; para 4K, o un fondo de escritorio en varias pantallas a la vez, va mejor una tarjeta dedicada. Con la tarjeta ocupada, FluidEQ dibuja la escena más pequeña y suelta las que no estás viendo.\nPrueba el karaoke con IA: separar la voz descarga un modelo de 713 MB la primera vez, el de afinación añade unos 360 MB y el de quitar ruido 11 MB. Con una tarjeta gráfica con DirectX 12, una canción de cuatro minutos se separa en medio minuto; solo con el procesador tarda unos cuatro minutos. Deja 2 GB de memoria libres mientras trabaja.\nApunta a esto si puedes: Windows 11, 8 GB de memoria, gráfica de 2018 en adelante y 3 GB de disco libres si usas las funciones con IA.',
  'help.requirements.tip':
    'Todo menos los modelos de IA viene en el instalador, y esos se descargan solo cuando usas la función por primera vez. Procesos, en el menú de acciones, muestra qué está usando cada parte de FluidEQ en tu equipo ahora mismo.',
  'help.requirements.keywords':
    'requisitos del sistema, requisitos mínimos, especificaciones, hardware, ordenador, computadora, portátil, laptop, GPU, tarjeta de video, CPU, RAM, espacio en disco, almacenamiento, recomendado, rendimiento, consumo, lento, lag, compatible, compatibilidad, macOS, Linux, viejo, antiguo',

  'help.engine.title': 'El Motor FluidEQ',
  'help.engine.intro':
    'FluidEQ procesa tu sonido con su propio motor o con Equalizer APO. El Motor FluidEQ funciona dentro del servicio de audio de Windows, después de los efectos de tu tarjeta de sonido; lleva tu EQ y el rack DSP a todo lo que suena en el PC y se aparta en cuanto se cierra FluidEQ.',
  'help.engine.steps':
    'Abre el menú de acciones (≡) y pulsa la tarjeta del motor situada arriba.\nElige Motor FluidEQ y pulsa Aplicar. Windows pide permiso y el audio se detiene unos segundos mientras se reinicia.\nSi una salida muestra DESACT., pulsa Activar en su aviso. Si un aviso dice que el motor no está funcionando, pulsa Reiniciar el audio de Windows.',
  'help.engine.tip':
    'Equalizer APO sigue disponible para los comandos personalizados de APO, Peace y los plugins VST. Cuando una actualización trae un motor más nuevo, un aviso ofrece Actualizar el motor. Salir de FluidEQ desde la bandeja del sistema apaga el EQ en todas las salidas.',
  'help.engine.keywords':
    'driver, controlador de audio, global, todas las aplicaciones, Spotify, Discord, navegador, habilitar, encender, permisos de administrador',
  'help.engine.fluid':
    'Recomendado. Los efectos de tu tarjeta de sonido siguen funcionando, y el EQ y el rack DSP llegan a todas las apps.',
  'help.engine.apo':
    'Ejecuta comandos personalizados de APO, Peace y plugins VST. El rack DSP se limita a la reproducción de la Biblioteca.',
  'help.engine.apply':
    'Cambia el motor. Windows pide permiso una vez y el audio se reinicia durante unos segundos.',
  'help.engine.nowName': 'El motor actual',
  'help.engine.now':
    'Qué motor reproduce tu sonido ahora; Aplicar sigue desactivado hasta que eliges el otro.',

  'help.eq.title': 'Moldea el sonido con EQ',
  'help.eq.intro':
    'Tu EQ son las bandas que moldeas tú. La frecuencia elige dónde actúa una banda, la ganancia fija el realce o el corte, y Q su anchura: cuanto más alto, más estrecha. Bajo el gráfico, tres pestañas comparten la página: Tu EQ, Preset y Tono, cada una una capa propia. Empieza con cambios pequeños y amplios, y compara a menudo.',
  'help.eq.steps':
    'Abre EQ → Bandas. Tu EQ tiene tus bandas; Preset pone un sonido listo debajo de ellas, y Nuevo preset crea uno tuyo; Tono tiene Corte graves, Corte agudos, Graves, Medios y Agudos, dibujados como una línea propia.\nArrastra el deslizador de una banda, o su punto en el gráfico, para realzar o cortar; la curva te sigue mientras mueves. Haz clic en la frecuencia de una banda, o en su punto, para seleccionarla. Ctrl+rueda sobre una banda cambia su Q.\nMantén Mayús con una banda seleccionada y aparece su ventana emergente al lado: su filtro, los diales de Frecuencia, Ganancia y Q, Activa y la papelera. Mayús+Tab y Mayús+← → pasan a la banda anterior o siguiente; Esc o × la cierran.\nTodo funciona también con el teclado: ve con Tab a un deslizador, un dial o un punto del gráfico, y las flechas lo mueven; Re Pág y Av Pág dan pasos más grandes.\nHaz clic derecho en una banda para restablecerla, desactivarla, eliminarla (pide una segunda pulsación), añadir una banda al lado o elegir Izquierdo + derecho: una banda para cada oído en la misma frecuencia, con la curva del oído izquierdo continua y la del derecho discontinua. Ambos oídos las vuelve a unir.\nSelecciona varias bandas con Ctrl o Mayús, o arrastra un recuadro alrededor, para moverlas juntas; Ctrl+A en el gráfico selecciona todas.\nGuardar EQ guarda lo que suena como un EQ guardado que puedes volver a poner, actualizar o gestionar. Vaciar pone cada ganancia a 0 dB y conserva tus bandas; pregunta antes.\nUn preset tuyo (Preset → Nuevo preset) empieza su curva desde un preset o plana; la moldeas en el gráfico y su rack en la página DSP. El menú de su tarjeta lo exporta a un archivo, e Importar en la pestaña Preset lo vuelve a leer.',
  'help.eq.tip':
    'Curvas enumera lo que da forma a esta salida además de tus bandas, cada cosa con su intensidad y su ×. Modo juego, junto al nombre del motor sobre el gráfico, reduce el retardo que añade FluidEQ, para juegos y llamadas; los presets de gaming lo activan. Mientras el EQ está apagado desde su chip, sus bandas se atenúan y no se pueden cambiar por accidente; la pestaña Tono sigue funcionando.',
  'help.eq.keywords':
    'ecualizador, ecualización, ecualizar, paramétrico, potenciar graves, bass boost, bajos, pasa altos, pasa bajos, peaking, realzar, atenuar, controles de tono, claridad de voz, voces claras, mejorar el sonido, mejorar el audio, ajustar el sonido, preajustes, agregar banda, resetear, poner a cero, plano, latencia, etiquetas, etiquetas de bandas, etiquetas del eq, valores, teclado, flechas, teclas de flecha, accesibilidad, lector de pantalla, oído izquierdo, oído derecho, cada oído, por oído, izquierdo y derecho, eq estéreo, eliminar banda, borrar banda, ventana emergente, mayús, guardar eq, eq guardados, tu eq, pestaña preset, tono, nuevo preset, preset propio, exportar, importar',
  'help.eq.rowCaption': 'Las pestañas bajo el gráfico, en Tu EQ',
  'help.eq.tabBands': 'Tus propias bandas, y cuántas hay.',
  'help.eq.tabPreset':
    'El preset bajo tus bandas, y los presets para elegir: por género, por uso y los tuyos.',
  'help.eq.tabTone':
    'Corte graves, Corte agudos, Graves, Medios y Agudos: tono rápido que deja tus bandas como están. Dice Apagado mientras no se usa ninguno.',
  'help.eq.bandsCaption': 'Tus bandas',
  'help.eq.bandCaption':
    'La ventana emergente de una banda, mientras mantienes Mayús',
  'help.eq.gameMode':
    'Reduce el retardo que añade FluidEQ, para juegos y llamadas. Los presets de Juegos lo activan.',
  'help.eq.layers':
    'Qué más da forma a esta salida — un preset, una corrección de auriculares, la corrección inteligente, una convolución —, cada cosa con su intensidad, su interruptor y su ×.',
  'help.eq.bandName': 'Una banda',
  'help.eq.band':
    'Arrastra su deslizador para realzar o cortar, o muévelo con las flechas. Ctrl+rueda encima cambia su Q.',
  'help.eq.caption':
    'Haz clic para seleccionar la banda. Ctrl+clic o doble clic la devuelve a la frecuencia del diseño.',
  'help.eq.gainCaption': 'La ganancia de la banda, en dB.',
  'help.eq.scaleName': 'Escala en dB',
  'help.eq.scale':
    'De +20 a −20 dB junto a los deslizadores, con 0 dB marcado, como una mesa la imprime junto a sus faders.',
  'help.eq.stepName': 'Banda anterior y siguiente',
  'help.eq.step':
    '‹ y › llevan la ventana a la banda de abajo o de arriba, como Mayús+Tab y Tab dentro de ella.',
  'help.eq.close':
    'Cierra la ventana y deja la banda seleccionada. Soltar Mayús hace lo mismo.',
  'help.eq.filter':
    'Su forma: un pico, un estante, una muesca o un filtro de paso.',
  'help.eq.voicing':
    'Una cadena ya hecha para el sonido, como Música o un género. Ninguno deja solo tus bandas.',
  'help.eq.smart':
    'EQ automático: el sonido guardado de cada canción, el sonido de su álbum desde la Biblioteca y, por encima, la Corrección inteligente.',
  'help.eq.clear':
    'Pone cada ganancia, y el Tono, a 0 dB y conserva tus bandas. Pregunta antes.',
  'help.eq.saveEq':
    'Guarda lo que suena como un EQ guardado, actualiza el que está puesto, pone otro o los abre todos para gestionarlos.',
  'help.eq.mode':
    'Con cuánta fuerza se aplican tu EQ y las curvas, la Q de las bandas, la fase, los agudos y el suavizado; dice Normal hasta que cambias algo. Con la tarjeta Modo EQ fijada, la trae a la vista.',
  'help.eq.add':
    'Añade una banda junto a la seleccionada, con la Q de las bandas que ya hay.',
  'help.eq.layouts':
    'Cuántas bandas: números de bandas que empiezan todas con una misma Q, los diseños de bandas que guardaste y restablecer el diseño.',
  'help.eq.frequency': 'Dónde actúa la banda, de 1 Hz a 20 kHz.',
  'help.eq.gain': 'Cuánto realza o corta. Ctrl+clic la devuelve a 0 dB.',
  'help.eq.q':
    'Lo ancha que es: más alta, más estrecha. Ctrl+clic la devuelve a la Q del diseño.',
  'help.eq.delete':
    'Púlsala una vez para armarla y otra para eliminar la banda; la × de al lado te deja arrepentirte.',
  'help.eq.menuDelete':
    'Se pone en rojo y pide una segunda pulsación antes de eliminar la banda.',
  'help.eq.ears':
    'Una banda para cada oído en la misma frecuencia, para moverlas por separado; Ambos oídos las vuelve a unir.',
  'help.eq.menuCaption': 'El menú de clic derecho de una banda',
  'help.eq.reset': 'Vuelve a poner la ganancia a 0 dB y la Q a 2.',
  'help.eq.disable': 'Saca la banda del sonido y conserva sus ajustes.',
  'help.eq.addLeft': 'Añade una banda a medio camino de su vecina más grave.',
  'help.eq.addRight': 'Añade una banda a medio camino de su vecina más aguda.',

  'help.eqmode.title': 'Modo EQ y diseños de bandas',
  'help.eqmode.intro':
    'El modo EQ cambia cómo se da forma a tu sonido, sin editar nada. Es un botón entre las herramientas de Tu EQ bajo el gráfico, y fijado es la primera tarjeta del panel de sonido, junto a las curvas que cambia. Tiene dos pestañas: Tu EQ abarca tus bandas, el Tono, los presets, el tipo de controlador y la corrección inteligente; Correcciones abarca las correcciones de auriculares y las curvas importadas o propias. Los diseños de bandas guardan las frecuencias y la Q de una disposición que te guste, lista para cualquier salida.',
  'help.eqmode.steps':
    'Pulsa Modo EQ entre las herramientas de Tu EQ bajo el gráfico. Si está fijado, la tarjeta aparece en el panel de sonido; si no, se abre como un menú sobre el gráfico.\nElige la pestaña Tu EQ o Correcciones y prueba una Intensidad o una Q de banda mientras suena música. Con el Motor FluidEQ, elige agudos precisos o clásicos para cada pestaña, y fase mínima o lineal donde una pestaña la ofrezca.\nEn Correcciones, el suavizado de curva puede suavizar curvas muestreadas a 1/12 o 1/3 de octava; está desactivado hasta que elijas. Restablecer lo devuelve todo a Normal, y el suavizado a desactivado.\n¿Prefieres un menú? Pulsa la chincheta de la tarjeta: el modo EQ se abre entonces como un menú sobre el gráfico, y la chincheta de ese menú devuelve la tarjeta.\nAbre el botón del número de bandas entre las herramientas de Tu EQ. Elige 6, 10, 15, 20 o 31 bandas, o pulsa Guardar diseño… para dar nombre a la disposición actual.',
  'help.eqmode.tip':
    'Un diseño nuevo empieza todas las bandas con una misma Q, y una banda que añades toma la Q de las demás. Un diseño guarda solo frecuencias y Q: al cargarlo, todas las bandas empiezan en 0 dB. La fase lineal añade retardo y puede resonar antes de los golpes secos. Al elegir una distribución integrada empieza de cero: sus propias frecuencias y Q, cada banda a 0 dB y en ambos oídos.',
  'help.eqmode.keywords':
    'número de bandas, cantidad de bandas, cuántas bandas, ecualizador gráfico, plantillas, bandas personalizadas, linear phase, agudos, preciso, clásico, intensidad, fase lineal, fase mínima, suavizado, q constante, q proporcional, chincheta, fijar, anclar, pin, desfijar, tarjeta, panel lateral, menú, pestañas, tu eq, correcciones, 1/12 de octava',
  'help.eqmode.modeCaption': 'La tarjeta Modo EQ',
  'help.eqmode.tabsName': 'Tu EQ y Correcciones',
  'help.eqmode.tabs': 'Dos pestañas, cada una con sus propios ajustes.',
  'help.eqmode.pin':
    'Devuelve estos ajustes a un menú sobre la gráfica. La chincheta del menú devuelve la tarjeta.',
  'help.eqmode.strength':
    'Normal, Estudio ×1.5 o ×2. Cada pestaña guarda la suya.',
  'help.eqmode.q':
    'Constante mantiene cada Q; Proporcional y Asimétrica estrechan las bandas a medida que crecen. En Tu EQ solo da forma a tus propias bandas, nunca a un preset ni a una corrección.',
  'help.eqmode.treble':
    'Preciso suena como está dibujado; Clásico, como en Equalizer APO. Solo con el Motor FluidEQ.',
  'help.eqmode.reset':
    'Todo vuelve a Normal, y Suavizado de curvas a Desactivado.',
  'help.eqmode.designsCaption': 'Diseños de bandas',
  'help.eqmode.builtIn': 'Diseños estándar de 6, 10, 15, 20 o 31 bandas.',
  'help.eqmode.resetBands':
    'Devuelve cada banda a la frecuencia y la Q de su disposición; las ganancias no cambian.',
  'help.eqmode.saved':
    'Un diseño que guardaste: púlsalo para cargar sus frecuencias y su Q, con cada banda a 0 dB. La papelera de al lado lo elimina tras preguntar.',
  'help.eqmode.sampleDesign': 'Monitores de estudio',
  'help.eqmode.save':
    'Da nombre a las frecuencias y la Q actuales como un diseño, que aparece en Mis diseños.',

  'help.games.title': 'Laboratorio gaming',
  'help.games.intro':
    'Dale a cada juego su propio sonido. Un juego parte de un perfil gaming hecho para él y recibe su propia copia: ajustas la copia en el Laboratorio gaming y el perfil nunca cambia. Cuando el juego pasa al frente, FluidEQ pone su sonido y lo mantiene hasta que cierras el juego, aunque cambies con Alt+Tab entre medias. Después vuelve tu sonido de música.',
  'help.games.steps':
    'Abre el Laboratorio gaming en la barra de título y pulsa Añadir un juego. Elige uno de tus launchers, un programa abierto ahora, o busca su programa. Parte del perfil gaming que se le sugiere; elige otro en su lista de perfiles gaming cuando quieras. La lista ofrece 32 perfiles para títulos concretos, incluidos Counter-Strike 2, Valorant y Fortnite, además de 9 tipos de juego.\nPulsa Probar ahora para poner el sonido del juego. Elige una parte a la izquierda —el Filtro Juego, EQ, Curva o cualquier etapa DSP— y ajústala ahí mismo. Cada cambio se queda en la copia de este juego.\nGuardar como perfil conserva la copia como uno de tus propios perfiles gaming para otros juegos, actualiza el tuyo, devuelve la copia a su perfil, la renombra o la borra.\nInicia el juego. Una tarjeta en el escritorio dice que su sonido está puesto, y otra dice que tu sonido de música ha vuelto cuando lo cierras. La notificación muestra el nombre del perfil cargado y el del perfil de música cuando se restaura.',
  'help.games.tip':
    'Mientras suena el sonido de un juego, la página DSP muestra tu rack de música en pausa con un botón para ajustar el juego, y la lista de perfiles queda en reposo, así que nada de lo que hagas ahí puede sobrescribir tu perfil de música con el sonido del juego. El Filtro Juego sube los pasos y las recargas bajos en el momento en que suenan y pasa las voces al frente.',
  'help.games.list':
    'Tus juegos van a la izquierda, con su propio desplazamiento. Arrastra el borde del panel para cambiar su anchura. La chincheta lo pliega a los iconos de los juegos, que lo abren sobre la página mientras el puntero está encima; pulsa la chincheta otra vez para dejarlo abierto. Se recuerdan su anchura y si está plegado.',
  'help.games.keywords':
    'gaming, gamer, videojuegos, agregar juego, perfiles de juego, por aplicación, automático, launcher, FPS, shooter, competitivo, pasos, pisadas, escuchar pasos, oír pasos, game filter, dialogue, voices, ambience, environment, hooves, laboratorio gaming, gaming lab, perfil gaming, copia',
  'help.games.switch':
    'Deja que un juego al frente ponga su propio sonido. Apagado, tus juegos conservan tu sonido de música.',
  'help.games.add':
    'Añade un juego de Steam, Epic, EA, GOG, Ubisoft, Battle.net o Xbox, o cualquier programa que esté abierto ahora. Se excluyen FluidEQ, el Explorador de Windows, los procesos conocidos del sistema y de los lanzadores, y los instaladores de componentes compartidos.',
  'help.games.gameName': 'Un juego',
  'help.games.game':
    'Un juego. El abierto queda marcado, y un punto al final significa que está al frente ahora. Su descripción emergente dice el perfil del que partió su sonido y si lo ajustaste.',
  'help.games.profile':
    'El perfil gaming del que parte la copia de este juego. Elegir otro le da al juego una copia nueva de él.',
  'help.games.save':
    'Guarda la copia como perfil nuevo o actualiza uno de los tuyos, la devuelve a su perfil, la renombra o la borra. El perfil en sí nunca cambia.',
  'help.games.try':
    'Pone ahora el sonido del juego, para que oigas lo que ajustas. Mientras está puesto, aquí aparece Descargar, que devuelve tu sonido de música.',
  'help.games.statusName': 'Qué se ajustó',
  'help.games.status': 'Qué partes de esta copia son distintas de su perfil.',
  'help.games.railName': 'Sus partes',
  'help.games.rail':
    'Cada parte del sonido del juego, cada una ajustada en su propio editor junto a la lista. Ajustado marca lo que se alejó del perfil.',

  'help.headphones.title': 'Corrección de auriculares e importación',
  'help.headphones.intro':
    'La corrección compensa un modelo medido y sirve de punto de partida junto a tus bandas y presets. Comprueba el modelo exacto y el autor de la medición.',
  'help.headphones.steps':
    'Abre EQ → Correcciones de auriculares. Se abre en Mis curvas, tu propia lista; la pestaña Biblioteca OPRA de al lado tiene correcciones medidas para miles de modelos de auriculares. Busca tu modelo exacto y elige la entrada que coincide.\nPara texto de EQ de otra herramienta, usa Importar ajustes de EQ en el menú de acciones. Revisa las bandas y la curva leídas antes de aplicar.\nPara Squiglink, pulsa Importar desde Squiglink en Mis curvas, pega su exportación y revisa la vista previa en vivo de la curva; luego úsala como curva o como EQ editable.\nAñadir curva admite una exportación de Squiglink, un archivo .txt, tu EQ tal como está o una elección de OPRA, y pregunta para qué oídos es: ambos, el izquierdo o el derecho. Cada curva tiene Aplicar como curva y Aplicar como EQ; Aplicar como EQ sustituye solo las bandas de esos oídos, tras preguntar.\nEl menú de una curva (≡) la renombra, edita sus bandas, la duplica, la copia como texto o la elimina. Exportar lista e Importar lista llevan la lista entera a otro ordenador.',
  'help.headphones.tip':
    'Una vista previa marcada como no aplicada no cambia el sonido. Evita acumular dos correcciones completas del mismo auricular por accidente; compara apagando la capa de auriculares.',
  'help.headphones.keywords':
    'AutoEq, audífonos, cascos, IEM, in-ear, intraurales, earbuds, Harman, curva objetivo, target, Crinacle, oratory1990, respuesta en frecuencia, perfil de auriculares, ecualizador para auriculares, ecualización de auriculares, oído izquierdo, oído derecho, un oído, mis curvas, curvas guardadas, lista de curvas, exportar lista, importar lista',
  'help.headphones.tabsName': 'Mis curvas y OPRA',
  'help.headphones.tabs':
    'Tus propias curvas, con cuántas guardas, y la biblioteca de OPRA de correcciones de auriculares medidas.',
  'help.headphones.libraryName': 'Actualizaciones de OPRA',
  'help.headphones.library':
    'Si la biblioteca de OPRA está al día y cuántos modelos tiene; si hay una más nueva, Actualizar base de datos la descarga.',
  'help.headphones.add':
    'Una exportación de Squiglink, un archivo .txt, tu EQ tal como está o una elección de OPRA, para ambos oídos o uno. Importar desde Squiglink, al lado, pega directamente desde Squiglink; Importar lista y Exportar lista llevan la lista entera.',
  'help.headphones.searchName': 'Búsqueda y orden',
  'help.headphones.search':
    'Encuentra una curva por su nombre; Recientes y A–Z, al lado, ordenan la lista.',
  'help.headphones.applyEq':
    'Aplicar como curva la reproduce como capa de corrección y conserva tus bandas; Aplicar como EQ la pone en tus bandas (solo en los oídos para los que se guardó), tras preguntar.',
  'help.headphones.moreName': 'Menú de una curva',
  'help.headphones.more':
    'Renombrar, editar sus bandas, duplicar, copiar como texto o eliminar.',

  'help.convolution.title': 'Usa una respuesta al impulso',
  'help.convolution.intro':
    'Convolución aplica un impulso WAV como otra capa de corrección. Puedes buscar en el catálogo AutoEq o importar tu WAV; las bandas paramétricas siguen siendo independientes.',
  'help.convolution.steps':
    'Abre EQ → Convolución y busca el modelo o autor.\nRevisa la fuente y pulsa Descargar y aplicar; la descarga coincide con la frecuencia de tu salida. Usa Importar un WAV para un archivo que ya tengas.\nEscucha con la capa de convolución activada y desactivada en Curvas.',
  'help.convolution.tip':
    'El Motor FluidEQ convierte él mismo cualquier frecuencia del impulso. Equalizer APO necesita un WAV importado a la frecuencia de la propia salida. Descargar del catálogo requiere conexión; esta guía no.',
  'help.convolution.keywords':
    'IRs, impulse response, convolver, FIR, REW, corrección acústica, calibración, frecuencia de muestreo, sample rate',
  'help.convolution.import':
    'Aplica un WAV que ya tienes, a cualquier frecuencia con el Motor FluidEQ.',
  'help.convolution.applied':
    'El impulso que suena ahora en esta salida. Quitar lo retira.',
  'help.convolution.search':
    'Busca en el catálogo de AutoEq por modelo o autor de la medición.',
  'help.convolution.resultName': 'Un resultado',
  'help.convolution.result':
    'El modelo, quién lo midió, y la fase y la frecuencia del impulso. Origen abre donde se publicó.',
  'help.convolution.apply':
    'Descarga el impulso a la frecuencia de tu salida y lo aplica. Aplicado marca el que suena.',

  'help.profiles.title': 'Dispositivos, perfiles y segunda salida',
  'help.profiles.intro':
    'Cada salida conserva su propio sonido: el EQ, el preset, el Tono, los cortes, el rack DSP, la Sala y la nivelación se guardan con ella y vuelven en cuanto cambias a ella. Los perfiles guardan otros sonidos para la misma salida. Segunda salida suena a la vez en otro dispositivo, con su propio sonido y su propio nivel.',
  'help.profiles.steps':
    'Comprueba la salida en la parte superior de la tarjeta Salida antes de editar; los auriculares Bluetooth muestran su batería al lado. Nuevo perfil conserva un sonido; Actualizar guarda sus cambios y Restaurar recupera los ajustes guardados.\nEl sonido propio de cada canción está ahora en EQ automático, en la página EQ: una canción conserva su preset, su Tono y su EQ en todas las salidas, y la Biblioteca fija uno para un álbum.\nAbre Segunda salida, activa un dispositivo y ajusta su nivel. Elige su perfil justo debajo, o pulsa Editar sonido para cambiar su sonido en la página EQ sin cambiar la salida principal; Listo o Editar principal te devuelve.\nCada segunda salida sigue el ritmo sola y muestra su retardo en milisegundos; con Compartir audio, el sonido de otro ordenador muestra su propio retardo, red incluida.',
  'help.profiles.tip':
    'Con el Motor FluidEQ, una segunda salida suena directamente desde el motor, y la salida principal nunca la espera. EQ automático empieza desactivado. En la página EQ, el panel empieza con la tarjeta Modo EQ; pliégala para llegar antes a tus salidas.',
  'help.profiles.keywords':
    'altavoces, bocinas, parlantes, audífonos, cascos, salida de audio, dispositivo de audio, Bluetooth, retraso, desfase, delay, eco, desincronizado, sincronizar audio, varias salidas, múltiples salidas, simultáneo, guardar configuración, salida, perfil, segunda salida, por dispositivo, por salida, cada salida, sonido propio, batería, editar sonido, editar principal',
  'help.profiles.list':
    'Sonidos que guardaste. ACTIVO marca el que usa esta salida; pulsa otro para cambiar. El lápiz de un perfil lo renombra y su papelera lo elimina, tras preguntar.',
  'help.profiles.update':
    'Guarda tus cambios en el perfil en el que estás. Restaurar, a su lado, devuelve el perfil a como lo guardaste por última vez.',
  'help.profiles.new': 'Crea un perfil nuevo a partir del EQ que tienes ahora.',
  'help.profiles.output':
    'La salida por la que estás escuchando, con su batería si son auriculares Bluetooth. DESACT. significa que tu EQ no llega a ella; ACTIVO, que Windows está reproduciendo por ella.',
  'help.profiles.onePlayer':
    'Iniciar algo en FluidEQ pausa lo que suena en otra parte del PC, y al revés.',
  'help.profiles.outputs':
    'Tus otras salidas. Activa una para que suene también allí, con su propio sonido, nivel y retardo en milisegundos. Editar sonido cambia su sonido en la página EQ sin cambiar la salida principal.',
  'help.profiles.driver':
    'Un punto de partida suave según con qué escuchas: auriculares de diadema o in-ear, un tamaño o un material de transductor. Déjalo en Sin compensación si el sonido ya está bien.',
  'help.profiles.sampleHeadset': 'Auriculares (audio USB)',
  'help.profiles.sampleSpeakers': 'Altavoces (Realtek Audio)',
  'help.profiles.sampleMusic': 'Música',
  'help.profiles.sampleMovies': 'Películas',
  'help.profiles.sampleNight': 'De madrugada',

  'help.config.title': 'Inspecciona y respalda una cadena',
  'help.config.intro':
    'EQ → Config muestra lo que el motor de audio tiene realmente en disco. Sus salidas y árbol de inclusiones permiten comprobar dispositivos y capas. Exporta antes de experimentar o mover una configuración.',
  'help.config.steps':
    'Abre EQ → Config y selecciona la salida. Lee su estado y capas activas.\nUsa Exportar cadena para guardar un archivo .fluideq en un lugar fácil de encontrar.\nPara recuperarlo, selecciona primero la salida correcta, usa Importar cadena y revisa el resultado.',
  'help.config.tip':
    'Los archivos de capas generados se reescriben al cambiar sus ajustes; pon las líneas manuales permanentes en el archivo personalizado de cada salida. El Motor FluidEQ lee sus líneas Filter, Preamp, GraphicEQ y Convolution; los demás comandos de APO y los plugins necesitan Equalizer APO.',
  'help.config.keywords':
    'hacer copia de seguridad, backup, restaurar, archivo de texto, config.txt, include, líneas personalizadas, configuración avanzada, migrar',
  'help.config.statusName': 'Si se aplica',
  'help.config.status':
    'Si el motor está leyendo esta configuración, dicho antes que nada.',
  'help.config.outputsName': 'Salidas',
  'help.config.outputs':
    'Cada salida de la configuración, con su perfil y cuántos filtros aplica; Sonando ahora marca la que oyes. Pulsa una para ver su cadena.',
  'help.config.transferName': 'Exportar e importar',
  'help.config.transfer':
    'Exportar cadena guarda la cadena de esta salida como archivo .fluideq; Importar cadena trae una a la salida que estás escuchando.',
  'help.config.treeName': 'Los archivos de la cadena',
  'help.config.tree':
    'El archivo de la salida y, debajo, el de cada capa, en el orden en que los lee el motor, con lo que dice cada uno.',
  'help.config.customName': 'Tu propio archivo',
  'help.config.custom':
    'El único archivo que FluidEQ nunca reescribe: pon aquí con Editar tus propias líneas permanentes.',
  'help.config.reload': 'Vuelve a leer la configuración del disco.',

  'help.dsp.title': 'Explora el rack DSP',
  'help.dsp.intro':
    'El rack DSP es una cadena de etapas de estudio. Con el Motor FluidEQ procesa todo lo que suena en el PC; con Equalizer APO, las pistas de audio de la Biblioteca. Mientras FluidEQ está apagado, el rack también lo está.',
  'help.dsp.steps':
    'Abre DSP y elige una cadena en Cadena completa, arriba: ajusta todas las etapas a la vez. Notas abre las notas de una cadena de género, con ejemplos para escuchar en YouTube.\nPulsa una etapa en el riel para abrirla y enciéndela con su propio interruptor. Su selector de presets ajusta solo esa etapa, y Guardar a su lado guarda solo esa etapa.\nEl Normalizer va aparte de las cadenas: elegir una cadena nunca lo cambia.\nCompara con la etapa apagada a un volumen parecido. Aislar, donde una etapa lo tiene, reproduce solo lo que esa etapa cambia. Ctrl+clic en un dial lo devuelve a su valor.\nGuardar conserva todo el rack como una cadena tuya; Exportar e Importar lo llevan a otro ordenador, y Restablecer devuelve la cadena a como estaba.\nTodos los canales aplica el rack a cada canal de una salida envolvente; el interruptor de al lado enciende o apaga todo el rack.\nDynamics, De-esser, Denoise, la Sala y Crossfade tienen capítulos propios. El filtro de juego está en el Gaming Lab; mientras suena el sonido propio de un juego, esta página descansa para que nada aquí lo sobrescriba.',
  'help.dsp.tip':
    'Lo que suena más fuerte suele parecer mejor solo por sonar más fuerte, así que compara con niveles igualados. Haz Ctrl+clic en un mando para devolverlo a su valor predeterminado.',
  'help.dsp.keywords':
    'efectos de sonido, limitador, limiter, loudness, LUFS, normalizar volumen, normalización, nivelador de volumen, volumen entre canciones, exciter, amplitud estéreo, ancho estéreo, stereo widener, subgraves, subarmónicos, punch, transitorios, masterización, mastering, clipping, crossfade, gapless, subir volumen, de-esser, desesador, sibilancia, eses, s aguda, voz, pódcast, perfiles, guardar perfil, pasos, oír pasos, footsteps, juegos, sonido de juegos, recargas, ecualización de sonoridad, game, game filter, dialogue, voice clarity, voices forward, ambience, environment, rain, wind, hooves, horses, headset',
  'help.dsp.normalizer':
    'Iguala el nivel de la fuente antes de cualquier efecto: Sonoridad, True Peak o apagado. Elegir una cadena nunca lo cambia.',
  'help.dsp.denoise':
    'Repara siseo, zumbido y chasquidos. El limpiador de voz neuronal funciona con pistas de la Biblioteca.',
  'help.dsp.exciter': 'Añade armónicos para dar cuerpo y aire.',
  'help.dsp.bassForge':
    'Añade una octava real por debajo del bajo, o sus armónicos para altavoces pequeños.',
  'help.dsp.equaliser': 'Quince bandas paramétricas, con fase mínima o lineal.',
  'help.dsp.bassPunch':
    'Moldea el ataque, el sostenimiento y el florecimiento del bajo.',
  'help.dsp.dimension': 'Ensancha la imagen estéreo sin cambiar la suma mono.',
  'help.dsp.room':
    'Surround en los auriculares: cada canal se vuelve un altavoz en una sala a tu alrededor.',
  'help.dsp.maximizer':
    'Sube el nivel sin dejar que los picos pasen del techo.',
  'help.dsp.master':
    'Nivel final, objetivo de sonoridad y protección de picos.',
  'help.dsp.crossfade': 'Funde una pista de la Biblioteca con la siguiente.',
  'help.dsp.presets':
    'Cadenas listas para música, géneros, dispositivos y reparaciones. Elegir una ajusta todas las etapas a la vez.',
  'help.dsp.chainActionsName': 'Acciones de la cadena',
  'help.dsp.chainActions':
    'Restablecer devuelve la cadena; Guardar conserva el rack como una cadena tuya; Exportar e Importar lo llevan a otro ordenador.',
  'help.dsp.switchesName': 'Interruptores del rack',
  'help.dsp.switches':
    'Todos los canales aplica el rack a cada canal de una salida envolvente, o solo al par frontal; Encendido activa todo el rack.',
  'help.dsp.stagePresetName': 'Preset de la etapa',
  'help.dsp.stagePreset':
    'Los presets propios de la etapa abierta, con sus flechas, Restablecer y Guardar, que afectan solo a esta etapa.',

  'help.room.title': 'La Sala: surround en los auriculares',
  'help.room.intro':
    'La Sala convierte los auriculares en una sala de escucha. Cada canal del sonido pasa a ser un altavoz alrededor de tu cabeza, renderizado a través de una cabeza medida y de las reflexiones de una sala a la que tú das forma, así que una película se sitúa delante de ti y un juego te rodea. Necesita el Motor FluidEQ y auriculares; en altavoces no sirve de nada.',
  'help.room.steps':
    'Abre DSP, elige Sala en el riel y enciéndela. El estéreo se vuelve dos altavoces delante de ti; una película 5.1, cinco y el subgrave; un juego 7.1, el anillo entero. La línea bajo los presets dice cuál.\nElige una sala en Preset de sala —primero las destacadas, luego las clásicas y las tuyas— o gira tú Espacio, Ambiente y Distancia y arrastra un altavoz por el anillo. Los altavoces a los que no llega lo que suena se dibujan dormidos.\nPulsa un altavoz: el panel junto al dibujo pasa a ser suyo, con su ángulo, su distancia, su nivel y Silenciar o Solo.\nEn Tu cabeza, pulsa Empezar la prueba de escucha y responde cinco pares cortos: la sala toma la cabeza que pone los sonidos delante de ti. Pequeña, Mediana y Grande también se eligen a mano.\nGuarda con un nombre una sala que te guste; una sala guardada vuelve con un clic y nunca cambia tu cabeza.',
  'help.room.tip':
    'Los juegos y las películas solo envían sus canales surround a una salida que Windows cree que tiene tantos altavoces: cuando el controlador lo admite, el panel de salida ofrece un solo clic a 7.1.',
  'help.room.keywords':
    'sonido envolvente, surround virtual, altavoces virtuales, parlantes, bocinas, audio espacial, audio 3D, binaural, HRTF, virtualizador, reverberación, eco, cine en casa, home theater, habitación, audífonos, cascos, soundstage, crossfeed',
  'help.room.picker':
    'Las salas de partida, agrupadas como los presets de las demás etapas; Personalizado en cuanto das forma a una.',
  'help.room.picture':
    'La sala vista desde arriba: paredes que se apagan al absorber, los altavoces en su anillo, la cabeza en el centro. Todo está dibujado a una sola escala, así que un altavoz situado más lejos de lo que mide la sala se dibuja fuera de sus paredes. Arrastra uno y su pareja se mueve con él; mantén Mayús para moverlo solo.',
  'help.room.speaker':
    'Pulsa un altavoz de la sala y este panel pasa a ser el suyo: su ángulo en grados, su propia distancia, su nivel, y Silenciar o Solo para oírlo a solas.',
  'help.room.speakerName': 'El altavoz elegido',
  'help.room.dials':
    'Cuánto oyes de las paredes, la cola suave que viene después y a qué distancia están los altavoces. Tamaño, Paredes y la duración y el tono de la cola están en Carácter de la sala, debajo.',
  'help.room.head':
    'La cabeza medida con la que la sala suena —pequeña, mediana o grande— y la prueba de escucha que la elige para tus oídos.',
  'help.room.bass':
    'Envía los graves de los altavoces al subgrave o los deja en rango completo, con el corte que elijas, y ajusta los niveles del centro y del subgrave.',
  'help.room.stereo':
    'Solo para una fuente estéreo: mantenerla como escenario frontal o llenar la sala a tu alrededor en la cantidad que elijas.',
  'help.room.saved':
    'Ponle nombre a la sala tal como está; vuelve con una pulsación.',
  'help.room.liveName': 'Qué está haciendo la sala',
  'help.room.live':
    'Leído del motor: a qué altavoces llega la señal que suena, o por qué la sala está inactiva.',

  'help.denoise.title': 'Reducción de ruido y análisis',
  'help.denoise.intro':
    'Reducción de ruido atenúa el siseo, el zumbido de la red eléctrica y los chasquidos. Con el Motor FluidEQ funciona en directo sobre todo lo que suena en el PC; el limpiador de voz neuronal y el suelo de ruido analizado son para pistas de la Biblioteca. Reducir más no siempre es mejor.',
  'help.denoise.steps':
    'Reproduce algo con el ruido que quieras reducir y selecciona Reducción de ruido en DSP.\nActiva Siseo, Zumbido o Chasquidos con un ajuste suave y escucha los pasajes tranquilos y el detalle musical.\nAumenta la reducción poco a poco y luego desactiva la etapa para comprobar que la mejora compensa cualquier pérdida de detalle.\nCon un archivo de Biblioteca, espera al análisis de la fuente antes de comparar el piso de ruido medido o el limpiador neuronal de voz. El audio del sistema usa reducción de siseo, zumbido y clics; el limpiador neuronal es para Biblioteca.',
  'help.denoise.tip':
    'Presta atención a los detalles suavizados y a las texturas acuosas o con bombeo. No sirve para limpiar el micrófono. Si no oyes ningún cambio, confirma que el rack y la etapa estén activados.',
  'help.denoise.keywords':
    'quitar ruido, eliminar ruido, ruido de fondo, supresión de ruido, denoiser, hiss, soplido, ruido blanco, crujidos, estática, vinilo, limpiar audio, restauración, grabaciones antiguas',
  'help.denoise.preset':
    'Puntos de partida para una limpieza suave o intensa, siseo, zumbido, chasquidos, vinilo, cinta o un pódcast. Guardar conserva los tuyos.',
  'help.denoise.isolate':
    'Reproduce solo lo que Denoise quita, para comprobar que no se lleva nada que quieras conservar.',
  'help.denoise.graphName': 'Imagen del ruido',
  'help.denoise.graph':
    'El sonido frente a su suelo de ruido, con la reducción de siseo, el zumbido y las reparaciones de chasquidos dibujados mientras ocurren.',
  'help.denoise.analysis':
    'En una pista de la Biblioteca: el suelo de ruido, el zumbido y los chasquidos por minuto, medidos del propio archivo. Reanalizar vuelve a medir.',
  'help.denoise.hiss':
    'Baja el siseo constante bajo la música. El límite de reducción deja un poco, para que lo que queda no burbujee.',
  'help.denoise.hum':
    'Recorta el zumbido de la red y sus armónicos. Auto toma 50 o 60 Hz de lo que encontró el análisis.',
  'help.denoise.clicks':
    'Encuentra y salva chasquidos y crepitaciones cortos; lo más largo se deja, así la batería sobrevive.',
  'help.denoise.voice':
    'El limpiador neuronal de voz, para la reproducción de la Biblioteca. Su modelo se descarga la primera vez que lo usas.',
  'help.denoise.liveName': 'Lo que está haciendo',
  'help.denoise.live':
    'Cuánto está reduciendo ahora, los chasquidos reparados y cualquier momento en que el limpiador de voz se quedó atrás.',

  'help.graph.title': 'La gráfica y sus controles',
  'help.graph.intro':
    'El gráfico de respuesta dibuja tus curvas de EQ sobre el sonido en vivo. Sus opciones descansan fuera de la vista y vuelven bajo el puntero: la leyenda en una esquina, Vista y pantalla completa en la otra, y al pie la galería de aspectos, el del gráfico en el centro con sus interruptores, el anterior y el siguiente en los extremos. Lo que ofrece la galería cambia con el aspecto: un estilo estándar o una escena.',
  'help.graph.steps':
    'Haz clic en el nombre del aspecto para elegir un estilo o una escena. Las flechas de al lado, Espacio y Ctrl+Espacio los recorren.\nAbre Vista para lo que dibuja la gráfica —cada dibujo tiene su interruptor, también cada curva—, el rango de frecuencias, la altura y la posición de la onda y Cómo se dibuja: la tasa de fotogramas (todos los que ofrece tu pantalla, o 60 o 30, fija en 60 con batería), la resolución y el suavizado. Los estilos estándar guardan sus propias opciones, aparte de las escenas.\nUna escena añade sus propios controles a Vista —lo que su autor dejó para que ajustes— y Usar su onda original devuelve la onda a la altura y posición que eligió ese autor.\nHaz doble clic en la gráfica para que llene la pantalla, y otra vez para volver. En pantalla completa, el borde superior de la ventana trae la cabecera y el inferior los controles de reproducción; un clic los guarda.\nTeclas: Ctrl+F pantalla completa, Esc volver, Ctrl+G la cuadrícula, Ctrl+W y Ctrl+S recorren Solo onda, Onda con curvas y Solo curvas, Ctrl+I hacia dónde mira la onda, Ctrl+A todas las bandas. Sobre el punto de una banda, arrastra para moverla, usa las flechas para ajustarla y haz clic derecho para su menú; Ctrl+rueda cambia la Q de un punto seleccionado.\nPulsa el nombre de una curva en la leyenda de la gráfica para ocultar o mostrar su dibujo. Esto no cambia el sonido. Quita o cambia la capa en Curvas cuando quieras cambiar lo que oyes.',
  'help.graph.tip': 'Todo esto cambia solo el dibujo, nunca tu sonido.',
  'help.graph.keywords':
    'analizador de espectro, FPS, cuadros por segundo, frames, tasa de refresco, forma de onda, rejilla, tiempo real, fullscreen, atajos, atajos de teclado, doble clic, ampliada, etiquetas, etiquetas de bandas, etiquetas del eq, teclado, flechas, teclas de flecha, gráficos, resolución, suavizado, galería, leyenda, rango de frecuencias, inclinación del analizador',
  'help.graph.stripCaption': 'Con un estilo estándar',
  'help.graph.legend':
    'El nombre de cada curva dibujada, y Salida en vivo para la onda. Pulsa uno para ocultar o mostrar su dibujo; el sonido no cambia.',
  'help.graph.previous': 'Vuelve al estilo anterior.',
  'help.graph.picker': 'Abre todos los estilos y escenas.',
  'help.graph.placeName': 'Posición en el recorrido',
  'help.graph.place':
    'Dónde está este aspecto entre los que recorren las flechas.',
  'help.graph.next': 'Pasa al estilo siguiente.',
  'help.graph.auto':
    'Cambia de estilo a intervalos de entre 10 segundos y 2 minutos.',
  'help.graph.colouring':
    'Colorea el estilo: Auto, Plano, Frecuencia, Nivel o Calor.',
  'help.graph.newLook': 'Diseña un estilo propio a partir de este.',
  'help.graph.gridName': 'Cuadrícula',
  'help.graph.grid': 'Muestra u oculta la cuadrícula y las escalas.',
  'help.graph.hintName': 'Cómo editar en el gráfico',
  'help.graph.hint':
    'Pasa el puntero por encima para ver los gestos: arrastra un punto, Ctrl o Mayús para seleccionar, Ctrl+rueda para la Q, Ctrl+arrastrar mueve un grupo como una campana.',
  'help.graph.viewName': 'Vista',
  'help.graph.view':
    'Qué dibuja el gráfico y cómo: cada curva, las etiquetas, la leyenda, la onda, la cuadrícula, el rango de frecuencias y el medidor.',
  'help.graph.plusCaption': 'Con una escena',
  'help.graph.creditName': 'La escena y quien la hizo',
  'help.graph.credit':
    'Qué escena suena y quién la hizo. Púlsala para elegir otro estilo u otra escena.',
  'help.graph.likeName': 'Me gusta',
  'help.graph.like':
    'Da me gusta a la escena que suena y suma puntos a quien la hizo. En una escena tuya muestra cuántos me gusta tiene.',
  'help.graph.lighting': 'Ilumina tus dispositivos RGB con esta escena.',
  'help.graph.desktop': 'Pone esta escena detrás de los iconos del escritorio.',
  'help.graph.viewCaption': 'El menú Vista',
  'help.graph.fullscreen': 'La gráfica ocupa toda la pantalla.',
  'help.graph.curves':
    'Un interruptor por cada curva que dibuja el gráfico, en el orden en que se aplican. Ctrl+W pasa por Solo la onda, Onda con curvas y Solo curvas; Ctrl+S vuelve atrás.',
  'help.graph.labels':
    'La frecuencia, la Q y la ganancia de cada banda sobre su punto.',
  'help.graph.wave':
    'La onda en vivo de lo que oyes, dibujada con el aspecto que elegiste.',
  'help.graph.range':
    'Cuánto espectro abarca el gráfico: 10 Hz–20 kHz de entrada, 20 Hz–20 kHz, 10 Hz–30 kHz, o 20 Hz–16 kHz, donde las grabaciones tienen sonido. Sin cuadrícula abarca 20 Hz–16 kHz.',
  'help.graph.slope':
    'Inclina el analizador hasta 6 dB por octava, para que la música, que cae hacia los agudos, se vea más plana. Desactivado por defecto; solo en estilos que dibujan el analizador.',
  'help.graph.meter': 'El medidor de salida del panel izquierdo.',
  'help.graph.drawing':
    'Fotogramas, resolución y suavizado, por separado para los estilos estándar y las escenas.',
  'help.graph.sampleScene': 'Aurora',
  'help.graph.sampleScenePrevious': 'Bloom',
  'help.graph.sampleSceneNext': 'Neon City',
  'help.graph.sampleMaker': 'Lumen Works',
  'help.looks.title': 'Estilos y escenas',
  'help.looks.intro':
    'Los estilos estándar son dibujos gratuitos del sonido en directo que puedes colorear y diseñar a tu gusto: Línea y Área para un trazo limpio, Bloques LED y Picos para dar pegada, y Cercha, Horizonte y Llamas danzantes para escenas completas. Las escenas son imágenes vivas dibujadas en la tarjeta gráfica, como Alpino, Aurora, Floración y Ciudad de neón, en las que los graves, el ritmo y los agudos mueven cada uno algo distinto.',
  'help.looks.steps':
    'Haz clic en el nombre del estilo que hay sobre la gráfica. Elige una sección a la izquierda, o busca en todo a la vez.\nCon «De» ves solo los de FluidEQ, las escenas de los miembros o los tuyos. Si una escena todavía no es tuya aparece bloqueada, y al elegirla se explica cómo conseguirla.\nCon un estilo estándar, pulsa Nuevo estilo para cambiar sus colores, su movimiento y sus picos, y guárdalo; aparecerá en «De: Tuyos».',
  'help.looks.tip':
    'Una escena trae sus propios colores: ajusta su ataque y su liberación en Vista. Los estilos estándar tienen sus propios ajustes de gráficos en Vista, aparte de las escenas: de entrada, resolución completa y escalado simple. Si una escena no puede funcionar en este ordenador, la gráfica dibuja un estilo gratuito en lugar de quedarse en blanco.',
  'help.looks.keywords':
    'apariencia, aspecto, look, skins, personalizar, personalización, animaciones, escena, escenas, visualizador, visualización, gráficos, ajustes de gráficos, resolución, calidad',
  'help.looks.searchName': 'Buscar',
  'help.looks.search':
    'Encuentra estilos y escenas por nombre, creador o categoría.',
  'help.looks.placesName': 'Secciones',
  'help.looks.places':
    'Todo, Nuevas y actualizadas, los tipos de estilo y cada categoría de escenas, cada uno con cuántos tiene.',
  'help.looks.from': 'Quién lo hizo: FluidEQ, los miembros o tú.',
  'help.looks.viewName': 'Vista y orden',
  'help.looks.view':
    'Imágenes o una lista detallada, ordenadas por las más nuevas, actualizadas hace poco, nombre o más usadas.',
  'help.looks.plus':
    'Cada estilo como una imagen. Nueva o Actualizada marca lo que cambió, y Sonando marca el que está en la gráfica.',

  'help.plus.title': 'Tu cuenta, los créditos y la pestaña Escenas',
  'help.plus.intro':
    'La cuenta es opcional: todo lo que era gratis funciona en este equipo sin ella. Con la sesión iniciada, la pestaña Escenas reúne la Galería, el Estudio, la Iluminación dinámica y el fondo de escritorio. Una escena de la Galería cuesta un crédito y es tuya para siempre; una cuenta confirmada recibe 1 crédito gratis, y los paquetes de créditos se pagan una sola vez.',
  'help.plus.steps':
    'Abre la pestaña Escenas y pulsa Iniciar sesión, o Crea tu cuenta gratis y escribe el código de seis dígitos que llega a tu correo. Una vez dentro, tu cuenta es la tarjeta al pie de la columna izquierda de la pestaña.\nElige Galería. Abre una escena, mírala y pulsa Conseguir para gastar un crédito en ella.\nPara tener más créditos, abre tu cuenta desde esa tarjeta y elige un paquete. Se paga una sola vez en Stripe, en tu navegador.',
  'help.plus.tip':
    'La app nunca ve tu tarjeta y nada se renueva. Una cuenta puede tener la sesión abierta en hasta cinco equipos.',
  'help.plus.keywords':
    'cuenta, iniciar sesión, entrar, registrarse, crear cuenta, créditos, crédito, paquete, comprar, precio, precios, coste, pago, pagar, premium, de pago, escena, suscripción, cancelar, membresía, miembro, código de correo',
  'help.plus.visualizers':
    'Escenas de FluidEQ y de los miembros, listas para tu música.',
  'help.plus.studio': 'Crea tus propias escenas con tu IA.',
  'help.plus.lighting': 'Tus dispositivos RGB siguen la escena.',
  'help.plus.fold':
    'Contrae la barra dejando solo sus iconos; se vuelve a abrir al pasar el ratón por encima.',

  'help.gallery.title': 'La galería de escenas',
  'help.gallery.intro':
    'La galería reúne las escenas de FluidEQ y las que publican los miembros. Cualquier cuenta puede explorar la galería. Si una escena tiene una vista previa publicada, el vídeo de diez segundos sin sonido se repite hasta que cambias de escena. Si no tiene vídeo, verás su portada. Las escenas que consigues con un crédito se reproducen con tu música y se quedan en tus estilos.',
  'help.gallery.steps':
    'Abre Escenas → Galería. Busca, ordena por Más gustadas, Esta semana o Más nuevas, o elige una categoría.\nAbre una escena y pulsa Conseguir para quedártela con un crédito, y después Poner en la gráfica. Las flechas, o ← y →, pasan de una escena a otra.\nDale me gusta con el corazón a las escenas que tienes, y denuncia la que no debería estar ahí.',
  'help.gallery.tip':
    'Las escenas de tus estilos se actualizan solas, y la página de cada escena cuenta qué cambió en cada versión. Una escena que publicas aparece cuando la aprueba el creador de FluidEQ. Abrir en el Estudio muestra cómo están hechas las escenas de FluidEQ. Una escena 3D lo dice en su tarjeta y en su página, con las teclas que mueven su cámara. Mientras suena una escena, Vista → Colores de la ventana elige lo que lleva la ventana: Original, Colores o Ambiente.',
  'help.gallery.keywords':
    'descargar escenas, galería de escenas, descargar visualizadores, agregar escenas, gratis, comunidad, likes, reportar, populares, tendencias',
  'help.gallery.search': 'Encuentra escenas y creadores.',
  'help.gallery.sortName': 'Ordenar',
  'help.gallery.sort':
    'Las más gustadas, las más gustadas esta semana o las más nuevas.',
  'help.gallery.categoriesName': 'Categorías',
  'help.gallery.categories': 'Muestra un solo tipo de escena.',
  'help.gallery.mine': 'Las escenas que has publicado, con sus me gusta.',
  'help.gallery.cardName': 'Una escena',
  'help.gallery.card':
    'Su imagen abre la escena. Conseguir la guarda con un crédito, y el corazón le da me gusta.',
  'help.gallery.manage':
    'Lo que muestra cada monitor como fondo de escritorio.',
  'help.gallery.stop': 'Detiene todos los fondos de escritorio.',
  'help.gallery.sceneCaption': 'La página de una escena',
  'help.gallery.back': 'Vuelve a la galería, donde la dejaste.',
  'help.gallery.play':
    'Pone la escena en la gráfica. Una escena que aún no tienes ofrece Conseguir, por un crédito.',
  'help.gallery.desktop': 'Pone la escena detrás de los iconos del escritorio.',
  'help.gallery.inspect':
    'Abre la escena de FluidEQ en el Estudio para ver cómo está hecha.',

  'help.studio.title': 'Crea escenas en el Estudio',
  'help.studio.intro':
    'El Estudio convierte una descripción en una escena. Tu propio asistente de IA escribe la escena en una carpeta de proyecto, y FluidEQ reproduce cada versión con tu música en cuanto se guarda. El Estudio es gratis para todas las cuentas.',
  'help.studio.steps':
    'Abre Escenas → Estudio, pulsa Proyecto nuevo… y ponle un nombre; FluidEQ crea su carpeta con una escena que ya se mueve.\nDescribe tu idea, abre la carpeta en tu asistente de IA y pega el prompt que copias con Copiar prompt para IA.\nO escribe qué debe cambiar en el chat junto al escenario: Claude Code en este equipo, con tu propio plan, edita la escena y reproduce cada versión. Cada respuesta guarda su versión, con Recuperar.\nMira el escenario mientras se guardan los archivos y usa las señales de prueba. Después pulsa Añadir a mis estilos, Publicar… o Exportar…\nEn Publicar…, escribe una línea sobre la escena o pulsa Escribir con IA, y luego Enviar a revisión: FluidEQ graba al enviar la vista previa de diez segundos sin sonido para la Galería con la canción de demostración.',
  'help.studio.tip':
    'Haz doble clic en el escenario para verlo a pantalla completa. Ver por dentro una escena de FluidEQ… abre una de las escenas de FluidEQ para aprender de ella; no se puede publicar. Las escenas que parpadean demasiado o son demasiado pesadas quedan bloqueadas. Una escena que publicas la lee antes el creador de FluidEQ, y una vez aprobada suena gratis para ti en todas partes.',
  'help.studio.keywords':
    'crear escenas, hacer visualizadores, shader, GLSL, programar, ChatGPT, Claude, Gemini, inteligencia artificial, editor de escenas, creador de visualizadores, subir escena, chat, chat del estudio, pedir un cambio, claude code, recuperar, versiones',
  'help.studio.project':
    'Tus proyectos y escenas de FluidEQ para ver por dentro.',
  'help.studio.stageName': 'Escenario',
  'help.studio.stage':
    'La escena, reproduciéndose con tu música. Haz doble clic para verla a pantalla completa.',
  'help.studio.hears':
    'Lo que recibe la escena: nivel, golpe, graves, medios, agudos.',
  'help.studio.tabs':
    'Ajustar prueba la onda y los ajustes propios de la escena, Código muestra su código a medida que tu IA lo guarda, Rendimiento cómo funciona aquí, y debajo está abierto Lo que escucha ahora.',
  'help.studio.chat':
    'Pide a Claude un cambio con tus propias palabras. Cada respuesta que cambió la escena puede recuperar esa versión.',
  'help.studio.signals': 'Señales de prueba que solo mueven esta vista previa.',
  'help.studio.size': 'Prueba la escena a pantalla completa.',

  'help.desktop.title': 'El fondo de escritorio',
  'help.desktop.intro':
    'El fondo de escritorio pone una escena detrás de los iconos del escritorio, en un monitor o en cada uno de ellos, mientras FluidEQ esté en marcha.',
  'help.desktop.steps':
    'Pon una escena en la gráfica y pulsa el botón del monitor junto a su nombre, o elige Vista → Usar como fondo de escritorio.\nPulsa los monitores en el mapa, elige Con la música o Tranquilo y pulsa Establecer fondo.\nPara cambiarlo o detenerlo, abre Escenas → Galería y usa Administrar o Detener todos en la parte superior.',
  'help.desktop.tip':
    'Se pausa mientras las ventanas cubren el monitor, con el PC bloqueado y, si lo eliges, al usar la batería, y vuelve cuando se inicia FluidEQ. Al salir de FluidEQ se detiene. Solo en Windows.',
  'help.desktop.keywords':
    'fondo de pantalla, wallpaper, fondo animado, live wallpaper, varios monitores, segundo monitor, dos monitores, Wallpaper Engine',
  'help.desktop.monitors':
    'Tus monitores tal como los organiza Windows. Pulsa los que quieras usar.',
  'help.desktop.music': 'Se mueve con lo que esté sonando.',
  'help.desktop.calm': 'Una animación lenta y serena que ignora la música.',
  'help.desktop.follow':
    'Cambia con la escena de la gráfica, la elijas tú o el cambio automático.',
  'help.desktop.battery':
    'Ahorra energía mientras el equipo está desenchufado.',
  'help.desktop.start': 'Lo inicia en los monitores que has elegido.',

  'help.lighting.title': 'Iluminación dinámica (beta)',
  'help.lighting.intro':
    'Con la Iluminación dinámica, tu teclado, ratón, alfombrilla, auriculares y soporte se iluminan con la escena de la gráfica, mediante Windows Dynamic Lighting y Razer Chroma. Está en beta, así que cuéntanos cómo se comportan tus dispositivos.',
  'help.lighting.steps':
    'Abre Escenas → Iluminación dinámica y actívala, o pulsa el botón de iluminación junto a una escena en la gráfica.\nElige el estilo de iluminación de esta escena (Escena, Onda de color, Espectro u Onda al ritmo) y ajusta su brillo y a qué responde.\nHaz clic en un dispositivo de Tus dispositivos para ajustarlo por separado; con Todos los dispositivos vuelves a ajustarlos todos.',
  'help.lighting.tip':
    'Si Windows reserva un dispositivo para otra app, la página te dice qué ajuste cambiar y lo abre por ti. Los dispositivos Razer necesitan Razer Synapse abierto, con Chroma Apps activado.',
  'help.lighting.keywords':
    'RGB, luces LED, mouse, mousepad, iluminación ambiental, retroiluminación, periféricos',
  'help.lighting.switch': 'Ilumina tus dispositivos mientras suena una escena.',
  'help.lighting.browse': 'Abre la galería para elegir una escena.',
  'help.lighting.previewName': 'Vista previa del escritorio',
  'help.lighting.preview':
    'Tu propio escritorio, iluminado con los colores que se le envían.',
  'help.lighting.devices':
    'Todos los dispositivos encontrados. Haz clic en uno para ajustarlo por separado; el botón Todos los dispositivos, encima de la lista, vuelve a ajustarlos todos a la vez.',
  'help.lighting.style':
    'Escena, Onda de color, Espectro u Onda al ritmo, guardado para cada escena.',

  'help.online.title': 'Escucha con Multimedia en línea',
  'help.online.intro':
    'Multimedia en línea reproduce YouTube, YouTube Music, Bandcamp, Twitch y Suno dentro de FluidEQ, con el mismo diseño que la Biblioteca: los sitios y tus búsquedas recientes en la barra lateral, y la barra de herramientas sobre la página. Lo que suena pasa por tu EQ como cualquier otra app; la reproducción y el inicio de sesión dependen de cada sitio.',
  'help.online.steps':
    'Elige un sitio en la barra lateral. Búscalo desde la barra de herramientas o encuentra algo en su página y ponlo.\nPulsa una búsqueda reciente para repetirla en el sitio abierto.\nCambia de pestaña mientras suena: la página sigue sonando y la barra del pie de la ventana la sigue.\nActiva Un solo reproductor si quieres que FluidEQ y otros reproductores se pausen entre sí en lugar de sonar a la vez.',
  'help.online.tip':
    'Con el Motor FluidEQ, Multimedia en línea pasa por tu EQ y por el rack DSP como cualquier otra app. Con Equalizer APO, el rack se limita a las pistas de la Biblioteca.',
  'help.online.keywords':
    'youtube, youtube music, bandcamp, twitch, suno, streaming, web, sitio web, navegador, en línea, historial de búsqueda, búsquedas recientes, cerrar sesión, colores, página oscura',
  'help.online.sites':
    'Los sitios. Un punto a su lado indica que está sonando. La chincheta sobre la barra lateral la pliega a sus iconos.',
  'help.online.recent':
    'Lo que buscaste antes. Pulsa una para buscar de nuevo en el sitio abierto; su × la olvida.',
  'help.online.colours':
    'Colorea la página del sitio a juego con FluidEQ, solo en tu pantalla. Los vídeos, imágenes y logotipos no cambian nunca, y los sitios de páginas claras mantienen las suyas.',
  'help.online.signOut':
    'Borra todos los inicios de sesión, cookies y páginas en caché que guarda el reproductor.',
  'help.online.navName': 'Atrás, adelante y recargar',
  'help.online.nav':
    'Recorre las páginas que abriste en el sitio o vuelve a cargar la página.',
  'help.online.search':
    'Busca en el sitio abierto y guarda la búsqueda en Búsquedas recientes.',

  'help.library.title': 'Explora y ordena tu Biblioteca',
  'help.library.intro':
    'La Biblioteca reúne la música y los vídeos de tus unidades en una página: los estantes en la barra lateral, una barra para encontrarlos y ordenarlos, y debajo dónde estás. Las portadas y los datos salen de las etiquetas de los archivos, que el editor de etiquetas corrige.',
  'help.library.steps':
    'Pulsa Añadir carpeta al pie de la barra lateral y elige la carpeta de tu música. La línea de estado bajo la página dice cuándo la Biblioteca está al día.\nElige un estante: Álbumes, Artistas, Géneros, Canciones, Carpetas (tus carpetas se abren como árbol debajo), Vídeos o una lista. Un vídeo se reproduce en la página, con una pestaña Subtítulos para sus subtítulos.\nBusca desde la barra, muestra el estante en Detalles, Cuadrícula o Cover Flow, y ordénalo con Ordenar. Las flechas vuelven atrás y adelante por donde has estado.\nAbre un álbum, un artista o una carpeta para ver sus canciones. El nombre de un artista, esté donde esté, abre su página: sus álbumes y todas las canciones en las que aparece.\nPara corregir etiquetas, haz clic derecho en una canción, en varias o en un álbum y elige Editar etiquetas (Ctrl+I) o Corregir etiquetas automáticamente (Ctrl+Mayús+I). Una canción se abre junto a la página; un álbum, una carpeta o una selección se abren como la página.\nRevisa los cambios y pulsa Guardar. Los archivos se escriben en segundo plano, y la tarjeta de la esquina ofrece Deshacer, que devuelve las etiquetas anteriores.',
  'help.library.tip':
    'Pasa el puntero sobre el botón de FluidEQ en la barra de tareas de Windows para Anterior, Reproducir y Siguiente, incluso minimizado. Suelta música sobre la Biblioteca para reproducirla. La Biblioteca necesita los archivos donde los encontró: vuelve a conectar la unidad o añade de nuevo una carpeta movida.',
  'help.library.keywords':
    'reproductor de música, archivos locales, MP3, FLAC, AAC, WAV, playlist, carátulas, portadas, árbol de carpetas, cover flow, cuadrícula, subtítulos, etiquetas, editar etiquetas, corregir etiquetas, ID3, metadatos, renombrar archivos, musicbrainz, deshacer, escanear, añadir música, Listas, Nueva lista',
  'help.library.shelvesName': 'Estantes',
  'help.library.shelves':
    'Lo que tiene la Biblioteca, con cuánto hay en cada uno. Carpetas abre debajo un árbol de tus carpetas.',
  'help.library.playlists':
    'Todas tus listas, donde se crea una nueva; debajo, Favoritos y las tuyas.',
  'help.library.addFolder':
    'Añade una carpeta de música o vídeos. Tus carpetas, debajo, las lista y quita una.',
  'help.library.history':
    'Vuelve atrás y adelante por los lugares que abriste.',
  'help.library.search':
    'Encuentra canciones, artistas y álbumes en toda la Biblioteca.',
  'help.library.views': 'Detalles, Cuadrícula o Cover Flow, en cada estante.',
  'help.library.sort':
    'Ordena el estante por título, artista, año, añadido recientemente, más reproducido y más. La flecha invierte el orden.',
  'help.library.upNext':
    'Abre y pliega el panel derecho: la canción que suena, A continuación, Detalles y Letra.',
  'help.library.album':
    'Abre el álbum. Haz clic derecho para reproducirlo, ponerlo en cola, guardarlo en una lista o etiquetarlo entero.',
  'help.library.rescan':
    'Dice si la Biblioteca está al día. Volver a escanear revisa tus carpetas en busca de cambios; Forzar nuevo análisis, al lado, lee de nuevo cada archivo.',
  'help.library.tagsCaption':
    'Un álbum en el editor de etiquetas, tras corregirlo',
  'help.library.fixAuto':
    'Rellena lo que falta a partir de los nombres de archivo, el nombre de la carpeta, una hoja .cue y lo que comparten la mayoría de canciones, con la imagen de la carpeta como portada. No se consulta nada en internet.',
  'help.library.searchWeb':
    'Abre el álbum en MusicBrainz en tu navegador. FluidEQ no descarga nada.',
  'help.library.cover':
    'Una portada para todas las canciones. Púlsala para elegir una imagen, pegarla o buscarla, o suelta una imagen encima.',
  'help.library.albumFields':
    'Valores escritos una vez para todas las canciones. Lo que cambió va en color, con el valor reemplazado tachado debajo; la flecha devuelve el anterior.',
  'help.library.findReplace':
    'Encuentra palabras en todos los títulos y las reemplaza de una vez.',
  'help.library.fileNames':
    'Renombra los archivos a partir de sus etiquetas con un patrón. Cada nombre nuevo aparece bajo su canción, con el anterior tachado.',
  'help.library.sheet':
    'El número, título y artista de cada canción, editados como en una hoja de cálculo. Arrastra una fila por su asa y pulsa Renumerar por orden.',
  'help.library.save':
    'Escribe los cambios; antes no cambia nada en el disco. Descartar los desecha todos.',
  'help.library.changesCaption': 'Cambios: lo que escribirá Guardar',
  'help.library.changes':
    'Todo lo que escribirá Guardar, contado. Ocupa el lugar de A continuación mientras el editor está abierto.',
  'help.library.changesAlbum':
    'Lo que cambia en todas las canciones. Un valor puesto donde no había ninguno va en verde; uno reemplazado muestra el anterior tachado.',
  'help.library.changesSongs':
    'Los cambios propios de cada canción y, después, los archivos que reciben un nombre nuevo.',

  'help.queue.title': 'Álbumes, A continuación y letras',
  'help.queue.intro':
    'Un álbum se abre bajo su portada sin detener lo que suena. A su lado, el panel derecho muestra la canción que suena sobre tres pestañas: A continuación, los Detalles de la canción y su Letra.',
  'help.queue.steps':
    'Abre un álbum y pulsa Reproducir, o pulsa una canción para empezar por ella. Una segunda pulsación en una canción la vuelve a empezar desde el principio.\nHaz clic derecho en una canción para Añadir a la cola, Añadir a Favoritos o Añadir a una lista; elige varias con Ctrl o Mayús.\nEn A continuación, pulsa una canción para ponerla ya, arrástrala para cambiar el orden, o pasa el puntero y pulsa × para quitarla.\nActiva Seguir sonando para continuar con más del mismo género cuando se acabe la lista. Sorpréndeme, al pie de A continuación y en la barra de reproducción, pone una canción al azar de tu Biblioteca y sigue en su estilo.\nLetra muestra las palabras de la canción desde sus etiquetas, o desde un archivo .lrc o .txt con el mismo nombre a su lado. Las líneas con tiempos siguen la canción palabra por palabra.\n¿Sin letra, o con la equivocada? Buscar otra letra busca la canción en internet desde tu navegador. Importa el archivo que descargues, pega el texto o suelta el archivo en la pestaña; FluidEQ lo guarda con la canción.',
  'help.queue.tip':
    'Abrir en Karaoke convierte la letra de una canción en un karaoke en el Creador de karaoke, donde se puede corregir su sincronización. En Windows, suelta archivos o carpetas de música sobre el Reproductor compacto para añadirlos a la Biblioteca y a la cola.',
  'help.queue.keywords':
    'cola, a continuación, siguiente canción, aleatorio, repetir, favoritos, lista, seguir sonando, reproducción automática, sorpréndeme, al azar, reproduciendo ahora, letra, letras, lrc, letra sincronizada, lrclib, genius, musixmatch, karaoke, orden',
  'help.queue.recordCaption': 'Un álbum abierto',
  'help.queue.place':
    'Dónde estás: el estante y luego el álbum. Pulsa el estante para volver a él.',
  'help.queue.artist':
    'Abre la página del artista: sus álbumes y todas las canciones en las que aparece.',
  'help.queue.fix':
    'Abre el álbum en el editor de etiquetas con las propuestas de la corrección ya escritas.',
  'help.queue.actionsName': 'Los botones del álbum',
  'help.queue.actions':
    'Reproducir, Aleatorio, Añadir a la cola, Mostrar en el Explorador y el menú del álbum: Favoritos, listas, Editar etiquetas y más.',
  'help.queue.albumSound':
    'Un sonido para este álbum, un EQ guardado o un preset, que suena con cualquiera de sus canciones.',
  'help.queue.filter':
    'Filtra las canciones de este álbum mientras escribes. La búsqueda de la barra mira en toda la Biblioteca.',
  'help.queue.songsName': 'Las canciones',
  'help.queue.songs':
    'Pulsa una canción para reproducirla. Las barras marcan la que suena y la estrella tus Favoritos; el clic derecho abre su menú.',
  'help.queue.paneCaption': 'El panel derecho, en A continuación',
  'help.queue.now':
    'La canción que suena. El nombre del artista abre su página.',
  'help.queue.tabs':
    'A continuación, los Detalles de la canción (archivo, formato y sonoridad) y su Letra. En un vídeo, la última pestaña es Subtítulos.',
  'help.queue.keep':
    'Cuando se acaba la lista, sigue con más del mismo género y luego con una sorpresa.',
  'help.queue.rowsName': 'Lo que suena después',
  'help.queue.rows':
    'El resto de lo que estabas escuchando, encabezado por su álbum. Pulsa una canción para ponerla ya, arrástrala para reordenar y pasa el puntero para ver su ×.',
  'help.queue.picks':
    'Las canciones que añadiste, tras el resto del álbum, en el orden en que las añadiste.',
  'help.queue.surprise':
    'Una canción al azar de tu Biblioteca ya, y luego más de su estilo.',
  'help.queue.lyricsCaption': 'Letra, y Buscar otra letra',
  'help.queue.lyricsLine':
    'La línea que se canta, iluminada palabra por palabra. Pulsa cualquier línea para reproducir desde ella.',
  'help.queue.sourceName': 'De dónde vienen',
  'help.queue.source':
    'Las etiquetas de la canción, o el archivo de letra a su lado, por su nombre. La papelera borra un archivo de letra guardado con la canción; la letra dentro del propio archivo de la canción no se cambia nunca.',
  'help.queue.karaoke':
    'Crea un karaoke con esta letra en el Creador de karaoke, donde se puede corregir su sincronización.',
  'help.queue.findOther':
    'Abre el buscador, a la derecha, para traer otra letra.',
  'help.queue.sites':
    'Busca la canción en LRCLIB (letras gratis y sincronizadas), Genius o Musixmatch, en tu navegador. FluidEQ no descarga letras por su cuenta.',
  'help.queue.import':
    'Guarda la letra con la canción: un archivo que descargaste, texto pegado o un archivo soltado en la pestaña (.lrc, .srt, .vtt, .ttml, .json, .yaml o .txt).',

  'help.karaoke.title': 'Canta con Karaoke',
  'help.karaoke.intro':
    'Karaoke pone tus propias canciones en un escenario: la letra mientras se canta, los acordes y una franja de tono que dibuja tu voz sobre las notas de la canción y puntúa cada línea. Tus canciones están en una lista al lado, como en la Biblioteca, y cada una suena por el reproductor de la Biblioteca, con tus ajustes de sonido.',
  'help.karaoke.steps':
    'Abre Karaoke y pulsa + junto a Canciones para añadir archivos o una carpeta entera: cada canción con su archivo de letra. Haz doble clic en una canción para cantarla.\nUsa la fila de arriba del escenario: Tono y Acordes muestran u ocultan la franja de tono y los acordes, cada uno por su cuenta; Escena, Portada, Vídeo o Ninguno elige qué hay detrás de la letra. Con Escena aparece a su lado el selector de escenas.\nActiva el micrófono en la esquina de la franja de tono y canta. Cada nota es una caja y tu voz una línea que la cruza: verde afinada, amarilla cerca, roja fuera. Cada nota recibe su veredicto al terminar.\nBajo la franja, cada línea de la canción es una fila de celdas con su puntuación. Pulsa una línea para cantarla otra vez desde justo antes. Al acabar la canción, el resumen muestra tu puntuación sobre 10.000, lo que más costó, un consejo y cada línea frente a tu mejor intento; Ver resultados lo vuelve a abrir.\nAbre Ajustes de mezcla en la barra del reproductor para el volumen, el tono guía, la pista base y, cuando el Creador ha separado la canción, la Voz guía: la voz del cantante bajo la música, tan alta como quieras.\nPantalla completa le da la ventana al escenario. La fila y la barra del reproductor se apartan tras unos segundos quietos: lleva el puntero al borde superior para la cabecera o al inferior para la barra, o fíjalas con los botones junto a pantalla completa.',
  'help.karaoke.tip':
    'Un archivo de letra solo con palabras no trae notas, así que la franja no tiene nada que cantar ni puntuar; los archivos UltraStar las traen y el Creador de karaoke puede añadirlas. Los acordes salen de los propios archivos de la canción cuando los tiene, una hoja de acordes junto a la canción o acordes dentro de su letra, y si no se deducen de la música. El micrófono se analiza en este ordenador para el nivel y el tono; FluidEQ nunca lo graba ni lo reproduce por tus altavoces.',
  'help.karaoke.keywords':
    'cantar, letra, micrófono, mic, tono, puntuación, acordes, voz guía, pantalla completa, lrc, ultrastar, canciones, lyrics, sing',
  'help.karaoke.stageCaption':
    'El escenario: la letra, los acordes, tu tono y tu puntuación',
  'help.karaoke.guides':
    'Tono muestra la franja de notas y Acordes, los acordes. Cada uno se activa por su cuenta; con los dos apagados el escenario muestra solo la letra.',
  'help.karaoke.background':
    'Lo que hay detrás de la letra: la escena, la portada de la canción, su vídeo o nada. Portada y Vídeo están cuando la canción los trae.',
  'help.karaoke.maker':
    'Abre esta canción en el Creador de karaoke para corregir sus tiempos, su letra o sus notas.',
  'help.karaoke.textSize':
    'Agranda o achica la letra según la distancia desde la que cantas.',
  'help.karaoke.micSettings':
    'Qué micrófono usar, cuánto te oye y su volumen. Se ilumina mientras el micrófono está activo.',
  'help.karaoke.fullScreen':
    'Da toda la ventana al escenario; un doble clic en el escenario hace lo mismo. En pantalla completa, dos botones más aquí mantienen visibles la cabecera o la barra del reproductor.',
  'help.karaoke.chords':
    'El acorde que acaba de sonar, el que suena ahora, resaltado, y los dos siguientes.',
  'help.karaoke.pitch':
    'Las notas que cantar como cajas y tu voz como una línea que las cruza: verde afinada, amarilla cerca, roja fuera. Arrástrala para moverte por la canción y arrastra el asa de encima para hacerla más alta.',
  'help.karaoke.micToggle':
    'Activa o desactiva el micrófono. Mientras escucha, a su lado aparece la nota que estás cantando.',
  'help.karaoke.score':
    'Cada línea como una fila de celdas, una por nota, del color de su veredicto, con tu puntuación acumulada y tu racha. Pulsa una línea para cantarla otra vez.',
  'help.karaoke.playlistCaption': 'Tus canciones, junto al escenario',
  'help.karaoke.search':
    'Busca una canción en la lista por su título o el nombre de su archivo.',
  'help.karaoke.add':
    'Añade archivos o una carpeta, agrupa la lista por carpeta o vacíala.',
  'help.karaoke.fold':
    'Pliega la lista para dejarle el sitio al escenario. El botón Lista de reproducción al principio de la fila del escenario la devuelve.',
  'help.karaoke.singingName': 'La canción del escenario',
  'help.karaoke.singing':
    'Lleva barras en movimiento mientras se canta. Haz clic en una canción para elegirla y doble clic para cantarla; pasa el puntero por una fila para subirla, bajarla o quitarla de la lista.',
  'help.karaoke.folderName': 'Una carpeta',
  'help.karaoke.folder':
    'Con la lista agrupada por carpeta, pulsa una carpeta para plegar sus canciones o volver a abrirlas. El número es cuántas canciones tiene.',
  'help.karaoke.mixCaption':
    'Ajustes de mezcla, en la barra del reproductor al pie de la ventana',
  'help.karaoke.volume':
    'El volumen de tu ordenador, el mismo deslizador que tiene la barra de cada pestaña. Su icono silencia el sonido.',
  'help.karaoke.melody':
    'Un tono que toca las notas de la canción para cantar con él. Su botón lo activa o lo apaga.',
  'help.karaoke.backing':
    'La música: la propia canción, o su pista base cuando el Creador de karaoke le ha separado la voz.',
  'help.karaoke.vocal':
    'La voz del propio cantante, puesta bajo la pista base cuando la canción se ha separado. A cero para la música sola.',
  'help.karaoke.scene':
    'Con la escena detrás de la letra, cuánto se transparenta y cuánto se desenfoca. Karaoke guarda los suyos, aparte de los del gráfico.',
  'help.karaoke.micCaption': 'Ajustes del micrófono',
  'help.karaoke.micInput': 'El micrófono en el que cantas.',
  'help.karaoke.micOn':
    'Empieza o deja de escuchar. Si está activo se ve arriba a la derecha del panel.',
  'help.karaoke.micLevel':
    'Cuánto te oye el micrófono ahora mismo. Canta y mira cómo se mueve.',
  'help.karaoke.micVolume':
    'Sube un micrófono demasiado bajo para que se oiga tu tono, o baja uno demasiado alto.',
  'help.karaoke.scoreCaption': 'El resumen al final de una canción',
  'help.karaoke.total':
    'Tu puntuación sobre 10.000, su calificación y cómo queda frente a tu mejor intento en esta canción.',
  'help.karaoke.statsName': 'Afinación · A tiempo · Notas',
  'help.karaoke.stats':
    'Cuánto tiempo cantaste dentro de las notas, en cuántas notas entraste a tiempo y cuántas acertaste, con cada veredicto contado debajo.',
  'help.karaoke.hardest':
    'La línea que más te costó y por qué, con algo que probar la próxima vez debajo.',
  'help.karaoke.practise':
    'Te lleva a justo antes de esa línea para cantarla otra vez.',
  'help.karaoke.again': 'Toda la canción otra vez, desde el principio.',
  'help.karaoke.map':
    'Cada línea con su calificación y cuántos puntos se movió desde tu mejor intento. Pulsa una línea para practicarla.',
  'help.karaoke.attempts':
    'Tus últimos intentos con esta canción, entre ellos este y el mejor.',

  'help.maker.title': 'Crea en el Creador de karaoke',
  'help.maker.intro':
    'El Creador de karaoke convierte una canción en un karaoke que puedes cantar: su letra, cuándo se canta cada palabra y las notas de la melodía. Se abre sobre la canción del escenario, en un solo editor: las herramientas arriba, el sonido de la canción con la letra y las notas debajo, y una vista previa en vivo de cómo las mostrará el escenario.',
  'help.maker.steps':
    'En el escenario de Karaoke, pulsa Abrir en el Creador. Pulsa Letra y pega la letra de la canción o carga un archivo de letra, una línea por fila, con cada repetición escrita.\nPulsa Detectar tiempos y melodía para que FluidEQ escuche cuándo se canta cada palabra y qué notas la llevan, o Aceptar y grabar tiempos para marcar tú cada línea mientras suena la canción. La primera vez se descargan los modelos de IA que hacen falta.\nRevisa el resultado en la cuadrícula: las palabras van en carriles sobre las notas, y las notas se dibujan como en el escenario. Arrastra una palabra o una nota para moverla, o su borde para cambiar su duración. Seleccionar notas dibuja un recuadro alrededor de varias; Pintar notas dibuja notas nuevas.\nMuévete por la canción con la vista general bajo la cuadrícula, o arrastra con el botón central del ratón en cualquier punto de la cuadrícula para moverte en el tiempo y en el tono a la vez. El Rango de tono, contra el borde izquierdo de la cuadrícula, amplía y desplaza las notas. Seguir la letra mantiene el cabezal a la vista y pasa de página al llegar al borde.\nPulsa Usar en el reproductor para cantarla en el escenario. Exportar la guarda como proyecto de FluidEQ, UltraStar TXT, LRC o LRC mejorado; una canción de tu Biblioteca también puede guardarse de vuelta con Guardar en la biblioteca.',
  'help.maker.editorCaption':
    'El editor: el sonido de la canción, su letra y sus notas',
  'help.maker.gridName': 'La cuadrícula',
  'help.maker.grid':
    'Arriba el sonido de la canción, debajo su letra en tres carriles y sus notas como cajas sobre la cuadrícula de tono, como las dibuja el escenario. Arrastra con el botón central del ratón para moverte en el tiempo y en el tono.',
  'help.maker.pitchRange':
    'Dónde está la cuadrícula en tono, frente a todo el rango. Arrastra sus extremos para ampliar y su centro para desplazar; doble clic para ajustarla a las notas.',
  'help.maker.overview':
    'Toda la canción, con la parte que muestra la cuadrícula enmarcada. Arrastra el marco para moverte y sus bordes para ampliar.',
  'help.maker.follow':
    'Mantiene el cabezal a la vista mientras suena la canción y pasa de página al llegar al borde.',
  'help.maker.preview':
    'La letra tal como la mostrará el escenario mientras suena la canción. Su deslizador A cambia el tamaño; ocúltala para tener más sitio.',
  'help.maker.checked':
    'Cuántas palabras has ajustado a mano y cuántas siguen como se detectaron o importaron, con las notas, palabras y comprobaciones de la canción al lado.',

  'help.maker.lyricsCaption': 'La letra, y cuándo se canta cada palabra',
  'help.maker.reference':
    'La canción entera como texto, una línea por fila. Pégala o carga un archivo; FluidEQ saca de ahí los tiempos.',
  'help.maker.timing':
    'Todas las palabras en orden, con cuántas llevan tiempo asignado. Pulsa una para trabajarla.',
  'help.maker.word':
    'Dónde empieza la palabra elegida y cuánto dura. Mover su borde le da o le quita tiempo a la de al lado; la línea conserva su duración.',
  'help.maker.toolsCaption':
    'Herramientas de reparación y los modelos de IA que necesitan',
  'help.maker.separate':
    'Divide la grabación en voz y música. El karaoke puede sonar entonces sin el cantante, el deslizador Voz guía puede devolver la voz debajo y la detección oye la letra con más claridad.',
  'help.maker.loadVocals':
    'Usa un archivo de solo voz que ya tengas, en vez de separarlo aquí.',
  'help.maker.redetectTiming':
    'Vuelve a escuchar la voz separada y reajusta los tiempos de las palabras que ya tienes. Espera a que la voz esté separada.',
  'help.maker.redetectNotes':
    'Vuelve a escuchar la melodía en la voz separada y reescribe las notas bajo la letra. Espera a que la voz esté separada.',
  'help.maker.models':
    'Qué necesita cada modelo y si está en este ordenador. Se descargan la primera vez que usas uno.',
  'help.maker.idle':
    'Si un modelo sigue en memoria entre usos, y durante cuánto. Liberarlo deja memoria libre; mantenerlo hace que la próxima vez arranque al instante.',

  'help.makerBar.caption': 'Las herramientas de la parte superior del Creador',
  'help.makerBar.import':
    'Abre un archivo de karaoke o un proyecto guardado, y conserva el audio que ya tenías.',
  'help.makerBar.lyrics': 'Las palabras y sus tiempos, en una sola ventana.',
  'help.makerBar.timing':
    'Mueve palabras y notas a la vez, para una canción que va adelantada o atrasada desde el primer segundo.',
  'help.makerBar.language':
    'En qué idioma están las palabras, y un segundo al lado para poder cantarla en cualquiera de los dos.',
  'help.makerBar.record':
    'Pon la canción y pulsa una tecla al empezar y al terminar cada línea. El tiempo sale de tus pulsaciones.',
  'help.makerBar.select':
    'Dibuja un recuadro sobre las notas para moverlas o borrarlas juntas.',
  'help.makerBar.paint':
    'Dibuja la melodía directamente sobre la rejilla de tonos.',
  'help.makerBar.repair':
    'Separa la voz de la música y vuelve a escuchar la letra o la melodía, con los modelos de IA que necesitan.',
  'help.makerBar.export':
    'Guarda el karaoke terminado como proyecto de FluidEQ, TXT de UltraStar, LRC o LRC mejorado.',
  'help.makerBar.apply':
    'Pasa el karaoke terminado al escenario y cierra el Creador.',
  'help.maker.tip':
    'La detección es un punto de partida: reproduce pasajes cortos y corrige las palabras y las notas contra la grabación. Separar primero la voz de la música hace que la detección oiga la letra con más claridad y da al reproductor su deslizador de Voz guía. Los modelos necesitan conexión y espacio en disco la primera vez; usa audio y letras con los que tengas permiso para trabajar.',
  'help.maker.keywords':
    'quitar la voz, voces, vocal remover, instrumental, acapella, pistas, separar voz, aislar voz, sincronizar letra, tiempos, melodía, notas, tono, ultrastar, lrc, crear karaoke, transcribir, creador',

  'help.share.title': 'Comparte audio entre ordenadores',
  'help.share.intro':
    'Compartir audio une ordenadores de la misma red privada en un grupo, y cada uno reproduce el sonido de los demás: te sientes en el que te sientes, oyes al resto. Cada ordenador envía su propio sonido directamente a los demás, sin tocar, y nunca reenvía lo que recibe, así que no hay eco; el ordenador en el que escuchas aplica su propio EQ, curvas y DSP. Esto es distinto de duplicar a un segundo dispositivo en un mismo ordenador.',
  'help.share.steps':
    'En un ordenador, abre Compartir audio, pulsa Añadir ordenador y luego Copiar código. Empieza con poco volumen.\nEn el otro ordenador, pulsa Añadir ordenador, pega el código en Código del otro ordenador y pulsa Enlazar. Los dos ordenadores se reproducen al instante. Enlaza más ordenadores igual: cada uno se une a todo el grupo, y los que llegan a través de otro aparecen con Recibir apagado hasta que lo enciendas.\nEn Todo el grupo, cada ordenador tiene dos interruptores, Recibir y Enviar; Compartir apaga el sonido de este ordenador para todos. Tu mezcla ajusta el volumen de Este PC y uno por ordenador.\nPausar, Reanudar y Desenlazar están en el menú de cada ordenador. Un ordenador ausente sigue en la lista como Sin conexión, y el grupo se vuelve a encontrar tras un reinicio, la suspensión, un corte de red o un cambio de motor.\nActiva Fluid junto a Compartir para música en una conexión con cortes. Añade un pequeño colchón de reproducción; desactívalo si necesitas menos retardo.\nSi un equipo guardado sigue sin conexión, abre su menú ••• y elige Reconectar. Reintenta el código guardado sin olvidar el enlace; si cambió su dirección, copia y pega su código actual.',
  'help.share.tip':
    'El código de conexión autoriza el enlace: mantenlo privado. Con el Motor FluidEQ, este ordenador mantiene su DSP mientras comparte, y el ordenador que reproduce su sonido aplica el suyo. Reproducir y enviar a la vez requiere Windows en ese ordenador; en otros, un enlace funciona en una sola dirección.',
  'help.share.keywords':
    'red local, LAN, wifi, otro PC, otra computadora, transmitir audio, remoto, emparejar, dos direcciones, bidireccional, enlazar, desenlazar, pausar, reanudar, volumen, grupo, añadir ordenador, recibir, enviar, compartir, mezcla, sin conexión, varios ordenadores',
  'help.share.mix':
    'El volumen de este PC y un nivel para cada ordenador que oyes.',
  'help.share.outputName': 'Salida',
  'help.share.output': 'Por dónde suena el grupo en este ordenador.',
  'help.share.add':
    'Copia el código de este ordenador, o pega el de otro y pulsa Enlazar.',
  'help.share.shareSwitch':
    'Compartir envía el sonido de este ordenador a todo el grupo; Fluid, a su lado, añade un pequeño colchón para una conexión que se atasca.',
  'help.share.switchesName': 'Recibir y Enviar',
  'help.share.switches':
    'Recibir reproduce ese ordenador aquí; Enviar reproduce este allí. Su menú ••• lo pausa, reanuda, reconecta o desvincula.',
  'help.share.laneName': 'Lo que suena',
  'help.share.lane':
    'La canción de ese ordenador y su sonido según llega, con el retardo en cada sentido.',

  'help.trouble.title': 'Cuando algo suena mal',
  'help.trouble.intro':
    'Empieza por la fuente y la salida, y después aísla la capa. Una gráfica, un preset guardado o un interruptor activado no demuestran por sí solos que el sonido llegue al dispositivo previsto. El menú Ayuda también lleva a la solución de problemas de audio, al informe de problemas y al Foro.',
  'help.trouble.steps':
    'Sin sonido: comprueba que la reproducción está en marcha, la salida esperada está elegida, el volumen está alto y el dispositivo está conectado. Mira si Un solo reproductor pausó otra fuente.\nEl EQ no cambia nada: comprueba que el botón de encendido arriba del panel izquierdo está activado y que la salida no muestra la insignia DESACT.; si la muestra, pulsa Activar. Si el aviso del motor dice que no está en marcha, pulsa Reiniciar el audio de Windows.\nTodo parece correcto y el EQ sigue sin hacer nada: puede que Windows esté reproduciendo la música por fuera del motor. El aviso lo dice y ofrece, con una pulsación, mover el motor a donde Windows lo use; cuesta un aviso de permisos y un segundo de silencio.\nDistorsión o demasiados graves: deja Normalizar automáticamente activado, reduce los realces y desactiva capas una a una. Si sigue, usa Informar de un problema y revisa el informe antes de enviarlo.',
  'help.trouble.tip':
    'F1 abre esta guía. Esc cierra primero la captura ampliada y después la guía. Si la interfaz se ve demasiado grande, Ctrl + 0 restablece el zoom. Procesos, en el menú de acciones, muestra qué está haciendo cada parte de FluidEQ.',
  'help.trouble.keywords':
    'no se oye, no se escucha, no hay sonido, ecualizador no funciona, suena raro, error, fallo, bug, cortes, se corta, entrecortado, crujidos, chasquidos, distorsionado, saturación, clipping, volumen bajo, demasiado fuerte, arreglar, solucionar, soporte técnico, reportar, diagnóstico, atajos de teclado, ruidos raros',
  'help.trouble.noticeName': 'El aviso del motor',
  'help.trouble.notice':
    'Dice qué salida no alcanza el motor y por qué, abajo a la derecha de la ventana, en cuanto se oye sonido en ella.',
  'help.trouble.useApo': 'Cambia a Equalizer APO, desde el diálogo del motor.',
  'help.trouble.restart':
    'Reinicia el audio de Windows, lo que suele devolver el motor. Windows pide permiso.',

  'help.forum.title': 'Pregunta en el Foro',
  'help.forum.intro':
    'El Foro trae a la app las GitHub Discussions de FluidEQ: anuncios, ideas, preguntas y ajustes de los que la gente está orgullosa. Cualquiera puede leer; para publicar se usa tu cuenta de GitHub, no una de FluidEQ.',
  'help.forum.steps':
    'Abre Ayuda → Foro y elige una categoría: Anuncios, General, Ideas, Encuestas, Q&A, Muestra lo tuyo, Trucos y consejos o Apoya FluidEQ. Nuevo para ti reúne lo que llegó desde la última vez, e Incidencias muestra los problemas reportados en GitHub.\nBusca en el foro o abre un tema para leer las respuestas.\nPulsa Iniciar sesión con GitHub, termina en tu navegador y publica un Nuevo tema o una respuesta.',
  'help.forum.tip':
    'Todo lo que se publica es público en GitHub, con tu nombre de GitHub. En Q&A, marca la respuesta que te funcionó para que la encuentre quien venga después. El número amarillo de cada sección indica temas con actividad que no has visto; Problemas cuenta los que siguen abiertos. Los temas y respuestas a medio escribir se guardan al salir. Pulsa una imagen de una publicación para ampliarla dentro de FluidEQ.',
  'help.forum.keywords':
    'comunidad, sugerencias, sugerir, pedir una función, feedback, opiniones, comentarios, contacto, contactar al desarrollador, soporte, discusiones',
  'help.forum.boardsName': 'Tableros',
  'help.forum.boards':
    'Cada tablero con su número. Nuevo para ti reúne lo que llegó desde tu última visita, e Issues lista los problemas reportados en GitHub.',
  'help.forum.textSize':
    'Agranda o achica el texto del Foro y el de esta guía.',
  'help.forum.meName': 'Tu cuenta de GitHub',
  'help.forum.me':
    'Con quién publicas. Cerrar sesión deja el Foro legible y deja de publicar.',
  'help.forum.newTopic':
    'Nuevo tema abre una discusión; Marcar todo como leído vacía los contadores, y la flecha trae lo nuevo.',
  'help.forum.search': 'Busca en los temas y respuestas de todos los tableros.',
  'help.forum.topicsName': 'Temas',
  'help.forum.topics':
    'La actividad más reciente primero, cada uno con su tablero, su estado, sus respuestas y sus votos. Abre uno para leerlo y responder.',
  'help.games.profiles':
    'Abre Perfiles de juego para buscar por perfil, juego, curva o cadena. Los filtros siguen en una sola línea y cada tipo de juego tiene su color. Tus perfiles guardados también muestran su curva, los niveles del filtro Juego y su cadena. Usar en un juego crea una copia nueva.',
  'help.mic.title': 'El sonido de tu micrófono',
  'help.mic.intro':
    'La pestaña Micrófono da a cada micrófono un rack de voz propio. El FluidEQ Engine lo ejecuta en el propio micrófono, así Discord, OBS, un juego o una llamada oyen tu voz tal como la moldeaste. Necesita el FluidEQ Engine.',
  'help.mic.steps':
    'Abre Micrófono en la cabecera y elige tu micrófono arriba. Si FluidEQ aún no está en él, pulsa Configurar en este micrófono; Windows pide permiso una vez.\nElige un Perfil de micrófono por uso —Streaming, Podcast, Chat de juego, Reuniones—, por micrófono, para cantar o un efecto de voz. Ajusta cada etapa para una voz; una etapa que cambias marca el perfil como ajustado, y Restablecer lo devuelve.\nPulsa una etapa en el riel para abrirla. Cada una tiene su interruptor, un medidor que se mueve con tu voz y el retardo que añade; una etapa apagada desaparece del sonido por completo.\nHabla y mira el dibujo: lo tenue es lo que capta el micrófono, lo brillante es lo que oyen los demás y el gris que asoma es lo que quitaron los filtros. Escuchar el resultado final te lo reproduce; usa auriculares o se acopla.\nEfectos propios del micro muestra lo que el fabricante del micrófono pone en tu voz antes de FluidEQ. Apagarlos evita limpiar la voz dos veces; Windows pide permiso y, al volver a encenderlos, regresan exactamente como estaban.',
  'help.mic.tip':
    'Una etapa apagada deja la voz intacta y no añade retardo; si Retardo marca alto, apaga lo que no necesites. Con Equalizer APO, la pestaña Micrófono no tiene dónde ejecutarse.',
  'help.mic.keywords':
    'micrófono, mic, voz, streaming, obs, discord, pódcast, llamadas, reuniones, cancelación de ruido, supresión de ruido, puerta de ruido, gate, de-esser, compresor, limitador, reverberación, efectos de voz, cantar, micrófono usb, micrófono de auriculares, efectos propios',
  'help.mic.own':
    'Lo que el fabricante del micrófono pone en tu voz antes de FluidEQ. Su interruptor pide permiso a Windows en cada sentido.',
  'help.mic.master': 'Enciende o apaga todo el rack de voz de este micrófono.',
  'help.mic.stagesName': 'Las etapas',
  'help.mic.stages':
    'En el orden en que tu voz las atraviesa, cada una con su interruptor, un medidor que se mueve con tu voz y el retardo que añade. Pulsa una para abrirla.',
  'help.mic.pick':
    'El micrófono que estás moldeando; cada uno guarda su propio sonido. La línea de debajo dice si el motor está trabajando en él ahora.',
  'help.mic.pictureName': 'Tu voz',
  'help.mic.picture':
    'Lo tenue es lo que capta el micrófono, lo brillante es lo que oyen los demás y el gris que asoma es lo que quitaron los filtros.',
  'help.mic.profile':
    'Sonidos de voz listos por uso, por micrófono, para cantar y como efectos de voz. Un cambio marca el perfil como ajustado; Restablecer lo devuelve.',
  'help.mic.delay':
    'Cuánto retrasa tu voz todo el rack, según lo mide el motor.',
};

export default help;
