/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Ayuda',
  'help.title': 'Guía de usuario',
  'help.subtitle': 'Encuentra tu sonido. Siéntete como en casa.',
  'help.intro':
    'Una guía práctica de FluidEQ, ilustrada con capturas reales. Empieza por tu primera sesión de escucha y luego explora cada parte de la app a tu ritmo.',
  'help.offline': 'Disponible sin conexión',
  'help.search': 'Buscar en la guía',
  'help.searchHint': 'Prueba motor, graves, visualizador…',
  'help.contents': 'En esta guía',
  'help.results': '{count} capítulos',
  'help.empty':
    'No hay resultados. Prueba una frase más corta o borra la búsqueda.',
  'help.clear': 'Borrar búsqueda',
  'help.close': 'Cerrar guía',
  'help.enlarge': 'Ampliar captura: {title}',
  'help.closeImage': 'Cerrar captura',
  'help.controlsOf': 'Qué hace cada control: {title}',
  'help.captureNote':
    'Capturas reales de FluidEQ 1.6 y 1.7. Los colores, nombres y posiciones pueden variar en tu versión. Los ajustes son ejemplos, no presets recomendados.',
  'help.steps': 'Pruébalo',
  'help.tip': 'Conviene saber',
  'help.back': 'Volver arriba',

  'help.group.start': 'Primeros pasos',
  'help.group.sound': 'Moldea tu sonido',
  'help.group.visuals': 'Mira tu música',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': 'Escucha, canta y comparte',
  'help.group.help': 'Cuando necesites ayuda',

  'help.start.title': 'Tus primeros cinco minutos',
  'help.start.intro':
    'Empieza con una canción conocida a un volumen cómodo. El panel izquierdo tiene el interruptor de FluidEQ y la preamplificación; el centro es tu espacio de trabajo; el panel derecho sigue a tu salida y sus perfiles. La barra de la parte inferior de la ventana controla lo que esté sonando.',
  'help.start.steps':
    'Instala FluidEQ y deja seleccionado el Motor FluidEQ cuando el instalador pregunte cómo procesar tu sonido. Windows pide permiso una sola vez, sin reiniciar.\nElige tu dispositivo de escucha en Dispositivo de salida. Activa EQ del sistema y deja Normalizar automáticamente activado.\nReproduce una canción, abre EQ → Bandas, cambia algo ligeramente y compara activando y desactivando EQ del sistema.',
  'help.start.tip':
    'El EQ para todo el sistema necesita Windows y un motor de audio: el Motor FluidEQ o Equalizer APO. En macOS y Linux la app muestra salidas de demostración, así que ahí una gráfica en movimiento no demuestra que se esté procesando nada.',

  'help.requirements.title': 'Qué necesita tu PC',
  'help.requirements.intro':
    'FluidEQ funciona en cualquier PC con Windows de los últimos diez años. Dos partes piden más que el resto: los visualizadores de Plus dibujan en la tarjeta gráfica, y el karaoke con IA descarga sus modelos la primera vez que lo usas.',
  'help.requirements.steps':
    'Mira qué Windows tienes: Windows 10 versión 1803 o posterior, o Windows 11, de 64 bits, 4 GB de memoria y unos 600 MB de disco. Procesar todo lo que suena en el PC necesita el Motor FluidEQ o Equalizer APO, y Windows pide permiso una vez mientras se instala.\nAbre un visualizador: cualquier tarjeta gráfica o gráfica integrada de 2013 en adelante. A 1080p la integrada basta; para 4K, o un fondo de escritorio en varias pantallas a la vez, va mejor una tarjeta dedicada. Con la tarjeta ocupada, FluidEQ dibuja la escena más pequeña y suelta las que no estás viendo.\nPrueba el karaoke con IA: separar la voz descarga un modelo de 713 MB la primera vez, el de afinación añade unos 180 MB y el de quitar ruido 11 MB. Con una tarjeta gráfica con DirectX 12, una canción de cuatro minutos se separa en medio minuto; solo con el procesador tarda unos cuatro minutos. Deja 2 GB de memoria libres mientras trabaja.\nApunta a esto si puedes: Windows 11, 8 GB de memoria, gráfica de 2018 en adelante y 3 GB de disco libres si usas las funciones con IA.',
  'help.requirements.tip':
    'Todo menos los modelos de IA viene en el instalador, y esos se descargan solo cuando usas la función por primera vez. Procesos, en el menú de acciones, muestra qué está usando cada parte de FluidEQ en tu equipo ahora mismo.',

  'help.engine.title': 'El Motor FluidEQ',
  'help.engine.intro':
    'FluidEQ procesa tu sonido con su propio motor o con Equalizer APO. El Motor FluidEQ funciona dentro del servicio de audio de Windows, después de los efectos de tu tarjeta de sonido; lleva tu EQ y el rack DSP a todo lo que suena en el PC y se aparta en cuanto se cierra FluidEQ.',
  'help.engine.steps':
    'Abre el menú de acciones (el botón con el icono de pulso, arriba a la derecha) y pulsa la tarjeta del motor, arriba del todo.\nElige Motor FluidEQ y pulsa Aplicar. Windows pide permiso y el audio se detiene unos segundos mientras se reinicia.\nSi una salida muestra DESACT., pulsa Activar en su aviso. Si un aviso dice que el motor no está funcionando, pulsa Reiniciar el audio de Windows.',
  'help.engine.tip':
    'Equalizer APO sigue disponible para los comandos personalizados de APO, Peace y los plugins VST. Cuando una actualización trae un motor más nuevo, un aviso ofrece Actualizar el motor. Salir de FluidEQ desde la bandeja del sistema apaga el EQ en todas las salidas.',
  'help.engine.fluid':
    'Recomendado. Los efectos de tu tarjeta de sonido siguen funcionando, y el EQ y el rack DSP llegan a todas las apps.',
  'help.engine.apo':
    'Ejecuta comandos personalizados de APO, Peace y plugins VST. El rack DSP se limita a la reproducción de la Biblioteca.',
  'help.engine.apply':
    'Cambia el motor. Windows pide permiso una vez y el audio se reinicia durante unos segundos.',

  'help.eq.title': 'Moldea el sonido con EQ',
  'help.eq.intro':
    'Frecuencia elige dónde actúa una banda; Ganancia, cuánto sube o baja; Q, su anchura: una Q mayor es más estrecha. Empieza con cambios pequeños y amplios, y compara a menudo.',
  'help.eq.steps':
    'Selecciona una banda en EQ → Bandas. Gira sus mandos de Frecuencia, Ganancia y Factor Q, o arrastra su punto en la gráfica.\nHaz clic derecho en una banda para restablecerla, desactivarla o añadir otra a su lado. Haz Ctrl+clic en un deslizador o un mando para devolverlo a su valor predeterminado.\nPulsa Vaciar EQ para poner todas las ganancias a 0 dB sin perder tus bandas. Antes pide confirmación.',
  'help.eq.tip':
    'La curva de respuesta representa tus filtros; el espectro en movimiento representa el sonido. Si desactivas una banda con Activa, sus ajustes se conservan para más tarde.',
  'help.eq.bandsCaption': 'La página Bandas',
  'help.eq.voicing': 'Da carácter a tu sonido al momento, como Music o Movies.',
  'help.eq.smart':
    'Escucha lo que suena y lo corrige: Detalle, Equilibrio u Objetivo.',
  'help.eq.clear':
    'Pone todas las ganancias a 0 dB y conserva tus bandas. Pide confirmación antes.',
  'help.eq.mode':
    'Con qué intensidad se aplican tu EQ y tus curvas, la Q de las bandas y la fase.',
  'help.eq.add': 'Añade una banda junto a la seleccionada.',
  'help.eq.layouts':
    'Cuántas bandas usar, y los diseños de bandas que has guardado.',
  'help.eq.frequency': 'Dónde actúa la banda seleccionada, de 1 Hz a 20 kHz.',
  'help.eq.gain': 'Cuánto sube o baja. Ctrl+clic la devuelve a 0 dB.',
  'help.eq.q': 'Lo ancha que es: cuanto mayor, más estrecha.',
  'help.eq.delete':
    'Pulsa dos veces para eliminar la banda; si cambias de idea, pulsa Conservar.',
  'help.eq.menuCaption': 'El menú de clic derecho de una banda',
  'help.eq.reset': 'Vuelve a poner la ganancia a 0 dB y la Q a 2.',
  'help.eq.disable': 'Saca la banda del sonido y conserva sus ajustes.',
  'help.eq.addLeft': 'Añade una banda a medio camino de su vecina más grave.',
  'help.eq.addRight': 'Añade una banda a medio camino de su vecina más aguda.',

  'help.eqmode.title': 'Modo EQ y diseños de bandas',
  'help.eqmode.intro':
    'Modo EQ cambia cómo se aplican tus bandas y tus curvas de corrección, sin editarlas. Los diseños de bandas guardan las frecuencias y la Q de una distribución que te guste, listos para cualquier salida.',
  'help.eqmode.steps':
    'Abre Modo EQ en la barra de herramientas de Bandas. Prueba una opción de Intensidad, Q de bandas o Suavizado de curvas mientras suena música; el panel se queda abierto.\nCon el Motor FluidEQ, elige la fase Mínima o Lineal. Pulsa Restablecer para volver a dejarlo todo en Normal.\nPulsa el botón de diseños, junto a Añadir banda. Elige 6, 10, 15 o 31 bandas, o pulsa Guardar diseño… para ponerle nombre a la distribución actual.',
  'help.eqmode.tip':
    'Un diseño guarda solo frecuencias y Q: al cargarlo, todas las bandas empiezan en 0 dB. La fase lineal añade retardo y puede resonar antes de los golpes secos.',
  'help.eqmode.modeCaption': 'Modo EQ',
  'help.eqmode.strength':
    'Normal, Estudio ×1.5 o ×2, para tu EQ y tus curvas por separado.',
  'help.eqmode.q':
    'Constante mantiene cada Q; Proporcional y Asimétrica estrechan las bandas a medida que crecen.',
  'help.eqmode.smoothing': 'Suaviza las curvas de corrección muestreadas.',
  'help.eqmode.phase': 'Mínima o Lineal. Solo con el Motor FluidEQ.',
  'help.eqmode.reset': 'Todo vuelve a Normal.',
  'help.eqmode.designsCaption': 'Diseños de bandas',
  'help.eqmode.builtIn': 'Diseños estándar de 6, 10, 15 o 31 bandas.',
  'help.eqmode.save':
    'Guarda las frecuencias y la Q actuales como un diseño con nombre, que aparece en Mis diseños.',

  'help.headphones.title': 'Corrección de auriculares e importación',
  'help.headphones.intro':
    'La corrección compensa un modelo medido y sirve de punto de partida junto a tus bandas y voicing. Comprueba el modelo exacto y el autor de la medición.',
  'help.headphones.steps':
    'Abre EQ → Presets EQ y busca tu modelo de auriculares. Revisa las mediciones disponibles y elige la que corresponda.\nPara texto de EQ de otra herramienta, usa Importar ajustes de EQ en el menú de acciones. Revisa las bandas y la curva detectadas antes de aplicar.\nPara Squiglink, pega su exportación en el panel de importación. Aplicar como EQ reemplaza tus bandas; Aplicar como curva la añade como una corrección de auriculares con su propia intensidad.',
  'help.headphones.tip':
    'Una vista previa marcada como no aplicada no cambia el sonido. Evita acumular dos correcciones completas del mismo auricular por accidente; compara apagando la capa de auriculares.',

  'help.convolution.title': 'Usa una respuesta al impulso',
  'help.convolution.intro':
    'Convolución aplica un impulso WAV como otra capa de corrección. Puedes buscar en el catálogo AutoEq o importar tu WAV; las bandas paramétricas siguen siendo independientes.',
  'help.convolution.steps':
    'Abre EQ → Convolución y busca el modelo o autor.\nRevisa la fuente y pulsa Descargar y aplicar; la descarga coincide con la frecuencia de tu salida. Usa Importar un WAV para un archivo que ya tengas.\nEscucha con la capa de convolución activada y desactivada en También aplicado.',
  'help.convolution.tip':
    'El Motor FluidEQ convierte él mismo cualquier frecuencia del impulso. Equalizer APO necesita un WAV importado a la frecuencia de la propia salida. Descargar del catálogo requiere conexión; esta guía no.',

  'help.profiles.title': 'Dispositivos, perfiles y segunda salida',
  'help.profiles.intro':
    'Tu EQ sigue al dispositivo de salida. Asignación automática guarda los cambios en la salida actual, mientras que Perfiles guardados te permite conservar sonidos alternativos. Segunda salida duplica la reproducción en otros dispositivos, con un nivel independiente para cada uno.',
  'help.profiles.steps':
    'Confirma el Dispositivo de salida antes de editar. Nuevo perfil conserva un sonido; Actualizar guarda sus cambios y Restaurar recupera los ajustes guardados.\nAbre Segunda salida, activa un dispositivo accesible y ajusta su nivel. Elige justo debajo el perfil de EQ guardado de ese dispositivo.\nElige Juego/Vídeo para una reserva inicial menor o Música para más margen. Comprueba la sincronización real.',
  'help.profiles.tip':
    'Cada salida duplicada usa su propio perfil con cualquiera de los dos motores. La duplicación funciona mientras FluidEQ está abierto; al cambiar la salida principal se detienen las duplicaciones anteriores. La latencia del dispositivo sigue afectando a la sincronización.',

  'help.config.title': 'Inspecciona y respalda una cadena',
  'help.config.intro':
    'EQ → Config muestra lo que el motor de audio tiene realmente en disco. Sus salidas y árbol de inclusiones permiten comprobar dispositivos y capas. Exporta antes de experimentar o mover una configuración.',
  'help.config.steps':
    'Abre EQ → Config y selecciona la salida. Lee su estado y capas activas.\nUsa Exportar cadena para guardar un archivo .fluideq en un lugar fácil de encontrar.\nPara recuperarlo, selecciona primero la salida correcta, usa Importar cadena y revisa el resultado.',
  'help.config.tip':
    'Los archivos de capas generados se reescriben al cambiar sus ajustes; pon las líneas manuales permanentes en el archivo personalizado de cada salida. El Motor FluidEQ lee sus líneas Filter, Preamp, GraphicEQ y Convolution; los demás comandos de APO y los plugins necesitan Equalizer APO.',

  'help.dsp.title': 'Explora el rack DSP',
  'help.dsp.intro':
    'El rack DSP es una cadena de etapas de estudio. Con el Motor FluidEQ procesa todo lo que suena en el PC; con Equalizer APO, las pistas de audio de la Biblioteca. Mientras FluidEQ está apagado, el rack también lo está.',
  'help.dsp.steps':
    'Abre DSP. Elige una cadena en Ajustes, o selecciona una etapa en las pestañas laterales y actívala.\nCambia un control cada vez y compara con la etapa desactivada a un volumen parecido. Aislar te permite oír solo lo que añade una etapa.\nGuarda un rack que te guste y usa Exportar e Importar para compartirlo.',
  'help.dsp.tip':
    'Lo que suena más fuerte suele parecer mejor solo por sonar más fuerte, así que compara con niveles igualados. Haz Ctrl+clic en un mando para devolverlo a su valor predeterminado.',
  'help.dsp.normalizer':
    'Iguala la sonoridad. Con audio en directo, nivela canción a canción.',
  'help.dsp.denoise':
    'Repara siseo, zumbido y chasquidos. El limpiador de voz neuronal funciona con pistas de la Biblioteca.',
  'help.dsp.exciter': 'Añade armónicos para dar cuerpo y aire.',
  'help.dsp.bassForge':
    'Añade una octava real por debajo del bajo, o sus armónicos para altavoces pequeños.',
  'help.dsp.equaliser': 'Quince bandas paramétricas, con fase mínima o lineal.',
  'help.dsp.bassPunch':
    'Moldea el ataque, el sostenimiento y el florecimiento del bajo.',
  'help.dsp.dimension': 'Ensancha la imagen estéreo sin cambiar la suma mono.',
  'help.dsp.maximizer':
    'Sube el nivel sin dejar que los picos pasen del techo.',
  'help.dsp.master':
    'Nivel final, objetivo de sonoridad y protección de picos.',
  'help.dsp.crossfade': 'Funde una pista de la Biblioteca con la siguiente.',
  'help.dsp.presets':
    'Cadenas completas del rack para géneros, dispositivos y reparaciones.',
  'help.dsp.scopeName': 'En todo el sistema',
  'help.dsp.scope':
    'Dónde funciona el rack y el retardo que añada la fase lineal.',

  'help.room.title': 'La Sala: surround en los auriculares',
  'help.room.intro':
    'La Sala convierte los auriculares en una sala de escucha. Cada canal del sonido pasa a ser un altavoz alrededor de tu cabeza, renderizado a través de una cabeza medida y de las reflexiones de una sala a la que tú das forma, así que una película se sitúa delante de ti y un juego te rodea. Necesita el FluidEQ Engine y auriculares; en altavoces no sirve de nada.',
  'help.room.steps':
    'Abre DSP, elige Sala en el carril y actívala. El estéreo son dos altavoces delante de ti; una película 5.1, cinco y el sub; un juego 7.1, el anillo entero. El indicador junto al interruptor dice cuál.\nElige una sala arriba — estudio, salón, cine, sala de conciertos y más — o gira Tamaño, Paredes y Distancia tú mismo y arrastra un altavoz por el anillo. Los altavoces a los que la señal no llega se dibujan dormidos.\nPulsa Ajustar y responde cinco pares de escucha: la sala toma la cabeza que pone los sonidos delante de ti. Pequeña, Mediana y Grande también se eligen a mano.\nGuarda una sala que te guste con un nombre; una sala guardada vuelve con una pulsación y nunca cambia tu cabeza.',
  'help.room.tip':
    'Dar forma a la sala — los diales, arrastrar un altavoz, Ajustar y guardar — es parte de Plus; las salas y la elección de cabeza son para todos. Los juegos y las películas solo envían sus canales surround a una salida que Windows cree que tiene tantos altavoces: cuando el controlador lo admite, el panel de salida ofrece un solo clic a 7.1.',
  'help.room.picker':
    'Las salas de partida, agrupadas como los perfiles de las demás etapas; Personalizada en cuanto das forma a una.',
  'help.room.picture':
    'La sala vista desde arriba: paredes que se apagan al absorber, los altavoces en su anillo, la cabeza en el centro. Arrastra un altavoz para moverlo. Púlsalo para ajustarlo por separado: su nivel, su propia distancia, su ángulo en grados, y Silenciar y Solo para oírlo a solas.',
  'help.room.dialsName': 'Tamaño, Paredes, Distancia, Central, Sub',
  'help.room.dials':
    'El lado de la sala en metros, cuánto absorben sus paredes, a qué distancia están los altavoces y el nivel del central y del sub.',
  'help.room.fit':
    'Cinco pares de escucha que eligen la cabeza para tus oídos.',
  'help.room.head':
    'La cabeza medida con la que se renderiza la sala: pequeña, mediana o grande.',
  'help.room.saved':
    'Ponle nombre a la sala tal como está; vuelve con una pulsación.',
  'help.room.liveName': 'Qué está haciendo la sala',
  'help.room.live':
    'Leído del motor: a qué altavoces llega la señal que suena, o por qué la sala está inactiva.',

  'help.denoise.title': 'Reducción de ruido y análisis',
  'help.denoise.intro':
    'Reducción de ruido atenúa el siseo, el zumbido de la red eléctrica y los chasquidos. Con el Motor FluidEQ funciona en directo sobre todo lo que suena en el PC; el limpiador de voz neuronal y el suelo de ruido analizado son para pistas de la Biblioteca. Reducir más no siempre es mejor.',
  'help.denoise.steps':
    'Reproduce algo con el ruido que quieras reducir y selecciona Reducción de ruido en DSP.\nActiva Siseo, Zumbido o Chasquidos con un ajuste suave y escucha los pasajes tranquilos y el detalle musical.\nAumenta la reducción poco a poco y luego desactiva la etapa para comprobar que la mejora compensa cualquier pérdida de detalle.',
  'help.denoise.tip':
    'Presta atención a los detalles suavizados y a las texturas acuosas o con bombeo. No sirve para limpiar el micrófono. Si no oyes ningún cambio, confirma que el rack y la etapa estén activados.',

  'help.graph.title': 'La gráfica y sus controles',
  'help.graph.intro':
    'La gráfica de respuesta dibuja tus curvas de EQ sobre el sonido en directo. La barra que tiene encima elige qué se dibuja y cómo, y cambia según lo que haya en la gráfica: un estilo estándar o un visualizador Plus.',
  'help.graph.steps':
    'Haz clic en el nombre del estilo actual para elegir otro estilo o un visualizador. Las flechas de al lado, Espacio y Ctrl+Espacio pasan de uno a otro.\nAbre Vista para cambiar el tamaño de la gráfica, lo que muestra y la altura y la posición de la onda. La velocidad de fotogramas también está ahí: todos los fotogramas que ofrezca tu pantalla, o 60 o 30, y 60 con batería.\nUn visualizador Plus añade sus propios controles a Vista —lo que su autor te dejó ajustar— y Restaurar devuelve la onda a la altura y la posición que eligió ese autor.\nHaz doble clic en la gráfica para verla a pantalla completa. Un solo clic oculta o muestra la barra.',
  'help.graph.tip':
    'Todo esto cambia solo el dibujo, nunca tu sonido. Esc sale de las vistas ampliada y de pantalla completa.',
  'help.graph.stripCaption': 'Con un estilo estándar',
  'help.graph.live': 'Muestra u oculta la onda en directo.',
  'help.graph.previous': 'Vuelve al estilo anterior.',
  'help.graph.picker': 'Abre todos los estilos y visualizadores.',
  'help.graph.next': 'Pasa al estilo siguiente.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto':
    'Cambia de estilo a intervalos de entre 10 segundos y 2 minutos.',
  'help.graph.colouring':
    'Colorea el estilo: Auto, Plano, Frecuencia, Nivel o Calor.',
  'help.graph.newLook': 'Diseña un estilo propio a partir de este.',
  'help.graph.bandsName': 'Bandas de escucha',
  'help.graph.bands': 'Sombrea las bandas que más oyes.',
  'help.graph.bandsMenu':
    'El mismo sombreado; aparece en gris sobre un visualizador Plus, que nunca lo dibuja.',
  'help.graph.gridName': 'Cuadrícula',
  'help.graph.grid': 'Muestra u oculta la cuadrícula y las escalas.',
  'help.graph.viewName': 'Vista',
  'help.graph.view': 'Tamaño, qué se dibuja y la onda.',
  'help.graph.plusCaption': 'Con un visualizador Plus',
  'help.graph.tintName': 'Colores de la ventana',
  'help.graph.tint':
    'El tema de la app, los colores del visualizador o sus colores con luz (Ambiente).',
  'help.graph.lighting': 'Ilumina tus dispositivos RGB con esta escena.',
  'help.graph.desktop':
    'Pone este visualizador detrás de los iconos del escritorio.',
  'help.graph.viewCaption': 'El menú Vista',
  'help.graph.expand': 'La gráfica crece por encima del editor.',
  'help.graph.fullscreen': 'La gráfica ocupa toda la pantalla.',
  'help.graph.showingName': 'Mostrando',
  'help.graph.showing': 'Va cambiando lo que muestra la gráfica.',
  'help.graph.waveName': 'La onda',
  'help.graph.wave': 'El dibujo del espectro en directo.',
  'help.graph.topWaveName': 'Onda superior',
  'help.graph.topWave': 'La onda pequeña de la barra de título.',
  'help.graph.meterName': 'Medidor de nivel',
  'help.graph.meter': 'El medidor de salida del panel izquierdo.',
  'help.graph.waveHeight': 'Lo alta que se dibuja la onda.',
  'help.graph.wavePosition': 'Desde el borde inferior hasta el centro.',
  'help.graph.attack': 'Lo rápido que sube un visualizador Plus con la música.',
  'help.graph.release': 'Lo despacio que vuelve a bajar tras cada golpe.',
  'help.graph.ownTiming':
    'Vuelve a los tiempos con los que venía el visualizador.',
  'help.looks.title': 'Estilos y visualizadores Plus',
  'help.looks.intro':
    'Los estilos estándar son dibujos gratuitos del sonido en directo que puedes colorear y diseñar a tu gusto: Línea y Área para un trazo limpio, Bloques LED y Picos para dar pegada, y Cercha, Horizonte y Llamas danzantes para escenas completas. Los visualizadores Plus son escenas dibujadas en la tarjeta gráfica, como Alpino, Aurora, Floración y Ciudad de neón, en las que los graves, el ritmo y los agudos mueven cada uno algo distinto.',
  'help.looks.steps':
    'Haz clic en el nombre del estilo que hay sobre la gráfica. Busca, o filtra los estilos por Líneas, Rellenos, Barras, Puntos o Escenas.\nElige un visualizador Plus a la derecha. Sin Plus aparece bloqueado, y al elegirlo se explica cómo conseguirlo.\nCon un estilo estándar, pulsa Nuevo estilo para cambiar sus colores, su movimiento y sus picos, y guárdalo; aparecerá en Tuyos.',
  'help.looks.tip':
    'Un visualizador Plus trae sus propios colores: ajusta su ataque y su liberación en Vista. Si una escena no puede funcionar en este ordenador, la gráfica dibuja un estilo gratuito en lugar de quedarse en blanco.',
  'help.looks.searchName': 'Buscar',
  'help.looks.search':
    'Encuentra estilos y visualizadores por nombre, creador o categoría.',
  'help.looks.styles':
    'Estilos gratuitos que dibuja FluidEQ y los estilos que has guardado.',
  'help.looks.familiesName': 'Filtros de estilo',
  'help.looks.families': 'Líneas, Rellenos, Barras, Puntos, Escenas y Tuyos.',
  'help.looks.plus':
    'Escenas de FluidEQ y de los miembros, cada una con su imagen.',
  'help.looks.categoriesName': 'Categorías',
  'help.looks.categories': 'Naturaleza, Ciudades, Abstracto y más.',

  'help.plus.title': 'FluidEQ Plus y tu cuenta',
  'help.plus.intro':
    'La cuenta es opcional: todo lo que era gratis funciona en este ordenador sin ella, y con cualquier cuenta puedes hacer una escena en el Estudio. FluidEQ Plus, mensual o anual, añade Visualizadores, la Clasificación, la Iluminación dinámica y el visualizador de escritorio, y lleva lo que haces en el Estudio a tus estilos, a la galería y a otros miembros.',
  'help.plus.steps':
    'Abre Cuenta en el menú de acciones. Inicia sesión, o crea una cuenta y escribe el código de seis dígitos que llega a tu correo.\nPulsa Pasar a Plus, lee las condiciones, marca que las aceptas y paga en Buy Me a Coffee, en tu navegador, con el mismo correo.\nAbre la pestaña Plus. Su barra lateral lleva a Clasificación, Visualizadores, Estudio e Iluminación dinámica.',
  'help.plus.tip':
    'La app nunca ve tu tarjeta; para cambiar o cancelar la suscripción, usa Gestionar suscripción. Una cuenta mantiene la sesión iniciada en hasta cinco ordenadores, y Plus sigue funcionando sin conexión durante un tiempo.',
  'help.plus.leaderboard':
    'Quién escucha más, entre los miembros Plus que se unen.',
  'help.plus.visualizers':
    'Escenas de FluidEQ y de los miembros, listas para tu música.',
  'help.plus.studio': 'Crea tus propias escenas con tu IA.',
  'help.plus.lighting': 'Tus dispositivos RGB siguen la escena.',
  'help.plus.fold':
    'Contrae la barra dejando solo sus iconos; se vuelve a abrir al pasar el ratón por encima.',

  'help.gallery.title': 'La galería de Visualizadores',
  'help.gallery.intro':
    'Visualizadores reúne las escenas de FluidEQ y las que publican los miembros. Cualquier cuenta puede explorar la galería y probar durante diez segundos las muestras gratuitas de FluidEQ; Plus reproduce todas las escenas con tu música y las añade a tus estilos.',
  'help.gallery.steps':
    'Abre Plus → Visualizadores. Busca, ordena por Más gustadas, Esta semana o Más nuevas, o elige una categoría.\nAbre una escena, pulsa Añadir a mis estilos y después Poner en el gráfico. Las flechas, o ← y →, pasan de una escena a otra.\nDale me gusta con el corazón a las escenas de los miembros, y denuncia la que no debería estar ahí.',
  'help.gallery.tip':
    'Las escenas de tus estilos se actualizan solas, y la página de cada escena cuenta qué cambió en cada versión. Abrir en el Estudio muestra cómo están hechas las escenas de FluidEQ.',
  'help.gallery.search': 'Encuentra escenas y creadores.',
  'help.gallery.sortName': 'Ordenar',
  'help.gallery.sort':
    'Las más gustadas, las más gustadas esta semana o las más nuevas.',
  'help.gallery.categoriesName': 'Categorías',
  'help.gallery.categories': 'Muestra un solo tipo de escena.',
  'help.gallery.mine': 'Las escenas que has publicado, con sus me gusta.',
  'help.gallery.cardName': 'Una escena',
  'help.gallery.card':
    'Su imagen abre la escena; Añadir la pone en tus estilos.',
  'help.gallery.manage':
    'Lo que muestra cada monitor como fondo de escritorio.',
  'help.gallery.stop': 'Detiene todos los fondos de escritorio.',
  'help.gallery.sceneCaption': 'La página de una escena',
  'help.gallery.back': 'Vuelve a la galería, donde la dejaste.',
  'help.gallery.stepName': 'Anterior y siguiente',
  'help.gallery.step': 'Recorre la lista desde la que abriste la escena.',
  'help.gallery.play': 'Añade la escena a tus estilos o la pone en la gráfica.',
  'help.gallery.desktop': 'Pone la escena detrás de los iconos del escritorio.',
  'help.gallery.inspect':
    'Abre la escena de FluidEQ en el Estudio para ver cómo está hecha.',

  'help.leaderboard.title': 'La Clasificación',
  'help.leaderboard.intro':
    'La Clasificación ordena a los miembros Plus que se unen a ella según cuánto escuchan y los me gusta que reciben sus escenas. Está desactivada salvo que te unas.',
  'help.leaderboard.steps':
    'Abre Cuenta y pulsa Unirme a la clasificación.\nAbre Plus → Clasificación. Elige el alias y el nombre con los que apareces en la clasificación, y cambia entre Histórico y Este mes.\nPara dejarlo, pulsa Salir de la clasificación. Eliminar todos mis datos borra todo lo que has enviado.',
  'help.leaderboard.tip':
    'De tu ordenador sale un solo número al día, los minutos de música que han sonado, y nunca lo que escuchas. Cada número se comprueba en el servidor. Tu apodo y tu nombre se pueden cambiar después desde Cuenta → Cambiar nombre; la clasificación y tus escenas publicadas lo siguen.',
  'help.leaderboard.periodName': 'Histórico o Este mes',
  'help.leaderboard.period': 'Todo el historial, o solo este mes.',
  'help.leaderboard.standing':
    'Tu puesto y tus puntos, y cuánto te falta para el siguiente puesto.',
  'help.leaderboard.earn':
    '10 puntos por hora, 20 por cada día de 30 minutos o más y 5 por cada me gusta.',

  'help.studio.title': 'Crea escenas en el Estudio',
  'help.studio.intro':
    'El Estudio convierte una descripción en un visualizador. Tu propio asistente de IA escribe la escena en una carpeta de proyecto, y FluidEQ reproduce cada versión con tu música en cuanto se guarda.',
  'help.studio.steps':
    'Abre Plus → Estudio, pulsa Proyecto nuevo… y ponle un nombre; FluidEQ crea su carpeta con una escena que ya se mueve.\nDescribe tu idea, abre la carpeta en tu asistente de IA y pega el prompt que copias con Copiar prompt para IA.\nMira el escenario mientras se guardan los archivos y usa las señales de prueba. Después, con Plus, pulsa Añadir a mis estilos, Publicar… o Exportar…',
  'help.studio.tip':
    'Haz doble clic en el escenario para verlo a pantalla completa. Ver por dentro una escena de FluidEQ… abre una de las escenas de FluidEQ para aprender de ella; no se puede publicar. Las escenas que parpadean demasiado o son demasiado pesadas quedan bloqueadas.',
  'help.studio.project':
    'Tus proyectos y escenas de FluidEQ para ver por dentro.',
  'help.studio.switchName': 'Proyecto anterior y siguiente',
  'help.studio.switch': 'Retrocede o avanza entre tus proyectos.',
  'help.studio.stageName': 'Escenario',
  'help.studio.stage':
    'La escena, reproduciéndose con tu música. Haz doble clic para verla a pantalla completa.',
  'help.studio.code':
    'El código de la escena, en directo, actualizado a medida que tu IA lo guarda.',
  'help.studio.prompt':
    'Copia el prompt que explica a tu IA cómo se hacen las escenas.',
  'help.studio.hears':
    'Lo que recibe la escena: nivel, golpe, graves, medios, agudos.',
  'help.studio.signals': 'Señales de prueba que solo mueven esta vista previa.',
  'help.studio.size':
    'Prueba la escena en la gráfica o en un panel estrecho, ancho o a pantalla completa.',
  'help.studio.wave':
    'Prueba la altura y la posición de la onda que puede ajustar quien use la escena.',

  'help.desktop.title': 'El visualizador de escritorio',
  'help.desktop.intro':
    'El visualizador de escritorio pone un visualizador Plus detrás de los iconos del escritorio, en un monitor o en cada uno de ellos, mientras FluidEQ esté en marcha.',
  'help.desktop.steps':
    'Pon un visualizador Plus en la gráfica y pulsa el botón del monitor junto a su nombre, o elige Vista → Usar como fondo de escritorio.\nPulsa los monitores en el mapa, elige Con la música o Tranquilo y pulsa Establecer fondo.\nPara cambiarlo o detenerlo, abre Plus → Visualizadores y usa Administrar o Detener todos en la parte superior.',
  'help.desktop.tip':
    'Se pausa mientras las ventanas cubren el monitor, con el PC bloqueado y, si lo eliges, al usar la batería, y vuelve cuando se inicia FluidEQ. Al salir de FluidEQ se detiene. Solo en Windows.',
  'help.desktop.monitors':
    'Tus monitores tal como los organiza Windows. Pulsa los que quieras usar.',
  'help.desktop.music': 'Se mueve con lo que esté sonando.',
  'help.desktop.calm': 'Una animación lenta y serena que ignora la música.',
  'help.desktop.battery':
    'Ahorra energía mientras el equipo está desenchufado.',
  'help.desktop.start': 'Lo inicia en los monitores que has elegido.',

  'help.lighting.title': 'Iluminación dinámica (beta)',
  'help.lighting.intro':
    'Con la iluminación dinámica, tu teclado, ratón, alfombrilla, auriculares y soporte se iluminan con el visualizador Plus de la gráfica, mediante Windows Dynamic Lighting y Razer Chroma. Está en beta, así que cuéntanos cómo se comportan tus dispositivos.',
  'help.lighting.steps':
    'Abre Plus → Iluminación dinámica y actívala, o pulsa el botón de iluminación junto a un visualizador Plus en la gráfica.\nElige el estilo de iluminación de este visualizador (Escena, Onda de color, Espectro u Onda al ritmo) y ajusta su brillo y a qué responde.\nHaz clic en un dispositivo de Tus dispositivos para ajustarlo por separado; con Todos los dispositivos vuelves a ajustarlos todos.',
  'help.lighting.tip':
    'Si Windows reserva un dispositivo para otra app, la página te dice qué ajuste cambiar y lo abre por ti. Los dispositivos Razer necesitan Razer Synapse abierto, con Chroma Apps activado.',
  'help.lighting.switch':
    'Ilumina tus dispositivos mientras suena un visualizador Plus.',
  'help.lighting.browse': 'Abre la galería para elegir un visualizador.',
  'help.lighting.previewName': 'Vista previa del escritorio',
  'help.lighting.preview':
    'Tu propio escritorio, iluminado con los colores que se le envían.',
  'help.lighting.devices':
    'Todos los dispositivos encontrados. Haz clic en uno para ajustarlo por separado.',
  'help.lighting.all': 'Vuelve a ajustar todos los dispositivos a la vez.',
  'help.lighting.style':
    'Escena, Onda de color, Espectro u Onda al ritmo, guardado para cada visualizador.',

  'help.online.title': 'Escucha con Medios en línea',
  'help.online.intro':
    'Multimedia en línea mantiene los sitios compatibles junto a tu EQ. La reproducción y el inicio de sesión en cada sitio siguen dependiendo del proveedor y de tu conexión. La barra de la parte inferior de FluidEQ sigue al reproductor activo, y su volumen es el del propio sitio.',
  'help.online.steps':
    'Abre Medios en línea, elige un sitio y reproduce algo en su página.\nCambia a EQ para ajustar mientras escuchas; vuelve a la página para sus controles propios.\nActiva Un reproductor a la vez para que FluidEQ y otros reproductores se pausen mutuamente.',
  'help.online.tip':
    'Con el Motor FluidEQ, Multimedia en línea pasa por tu EQ y por el rack DSP como cualquier otra app. Con Equalizer APO, el rack se limita a las pistas de la Biblioteca.',

  'help.library.title': 'Crea tu biblioteca local',
  'help.library.intro':
    'Biblioteca reúne música y vídeo de tus unidades. Explora por álbumes, artistas, géneros, canciones, carpetas, un árbol de carpetas o tus listas. Las portadas y los datos proceden de tus archivos, así que la misma colección puede verse distinta según sus etiquetas.',
  'help.library.steps':
    'Abre Biblioteca y añade tu carpeta de medios. Deja que termine el escaneo antes de decidir qué falta.\nElige un artista o álbum, o busca una canción y reprodúcela.\nUsa la barra de la parte inferior de la ventana para pausar, moverte por la pista y saltar. Su volumen es un único nivel para todos los reproductores.',
  'help.library.tip':
    'Pasa el ratón por el botón de FluidEQ en la barra de tareas de Windows para tener Anterior, Reproducir y Siguiente, incluso con la app minimizada. Biblioteca necesita los archivos originales: vuelve a conectar la unidad o añade de nuevo una carpeta que hayas movido.',

  'help.queue.title': 'Álbumes y cola de reproducción',
  'help.queue.intro':
    'La cola define el orden de escucha. Abrir otro álbum permite explorar sin convertirlo en la canción actual. La pista activa y A continuación te ayudan a orientarte.',
  'help.queue.steps':
    'Abre un álbum y reproduce la pista que quieras.\nHaz clic derecho en una canción para Añadir a la cola, Añadir a Favoritos o Añadir a una lista.\nAbre A continuación para ver lo que suena después, y activa Seguir sonando para continuar con más del mismo género.',
  'help.queue.tip':
    'Iniciar Biblioteca toma el relevo de los otros reproductores de FluidEQ. La pista actual que muestra la barra te confirma qué fuente tiene la reproducción.',

  'help.karaoke.title': 'Canta con Karaoke',
  'help.karaoke.intro':
    'Karaoke combina tu audio con letras. Las letras temporizadas siguen la reproducción; los objetivos de tono requieren datos de notas. Un micrófono configurado añade tu tono en directo.',
  'help.karaoke.steps':
    'Abre Karaoke y usa Añadir archivos o Añadir carpeta para importar audio y letras correspondientes.\nElige una canción, reprodúcela y comprueba que letras y acompañamiento coincidan.\nConfigura el micrófono, ajusta el tamaño de letra y usa el control de pantalla completa del escenario.',
  'help.karaoke.tip':
    'Un archivo de solo letras no contiene notas objetivo. Karaoke sigue el Volumen de la app; los niveles de la melodía, la base y la voz guía están en Ajustes de mezcla.',

  'help.maker.title': 'Crea en Karaoke Maker',
  'help.maker.intro':
    'Maker convierte audio en un proyecto editable con audio, letras y notas en una línea de tiempo. Revisa siempre las palabras y los tiempos generados automáticamente.',
  'help.maker.steps':
    'Abre Crear desde Karaoke y carga el audio. Elige las herramientas de separación o transcripción disponibles que necesites.\nSigue el progreso: el primer uso de IA puede requerir descargar modelos. Revisa letras y notas en la línea de tiempo.\nEscucha fragmentos, corrige texto y tiempos, guarda el proyecto y exporta los archivos de karaoke.',

  'help.maker.lyricsCaption': 'La letra, y cuándo se canta cada palabra',
  'help.maker.referenceName': 'Letra de referencia',
  'help.maker.reference':
    'La canción entera como texto, una línea por fila. Pégala o carga un archivo; FluidEQ saca de ahí los tiempos.',
  'help.maker.timingName': 'Tiempo por palabra',
  'help.maker.timing':
    'Todas las palabras en orden, con cuántas llevan tiempo asignado. Pulsa una para trabajarla.',
  'help.maker.wordName': 'Palabra seleccionada',
  'help.maker.word':
    'Dónde empieza la palabra elegida y cuánto dura. Mover su borde le da o le quita tiempo a la de al lado; la línea conserva su duración.',
  'help.maker.toolsCaption':
    'Las herramientas de IA y los modelos que necesitan',
  'help.maker.separate':
    'Separa la grabación en voz y música, para que el karaoke suene sin el cantante.',
  'help.maker.loadVocals':
    'Usa un archivo de solo voz que ya tengas, en vez de separarlo aquí.',
  'help.maker.redetectTiming':
    'Vuelve a escuchar la voz y recalcula los tiempos de las palabras que ya tienes.',
  'help.maker.redetectNotes':
    'Vuelve a escuchar la melodía y reescribe las notas bajo las palabras.',
  'help.maker.modelsName': 'Memoria de los modelos de IA',
  'help.maker.models':
    'Qué necesita cada modelo y si está en este ordenador. Se descargan la primera vez que usas uno.',
  'help.maker.idleName': 'Cuando está inactivo',
  'help.maker.idle':
    'Si un modelo sigue en memoria entre usos, y durante cuánto. Liberarlo deja memoria libre; mantenerlo hace que la próxima vez arranque al instante.',

  'help.makerBar.caption': 'Las herramientas de la parte de arriba del maker',
  'help.makerBar.import':
    'Abre un archivo de karaoke o un proyecto guardado, y conserva el audio que ya tenías.',
  'help.makerBar.lyrics': 'Las palabras y sus tiempos, en una sola ventana.',
  'help.makerBar.timing':
    'Mueve palabras y notas a la vez, para una canción que va adelantada o atrasada desde el primer segundo.',
  'help.makerBar.pan':
    'Arrastra por la línea de tiempo para recorrer la canción sin cambiar nada.',
  'help.makerBar.language':
    'En qué idioma están las palabras, y un segundo al lado para poder cantarla en cualquiera de los dos.',
  'help.makerBar.record':
    'Pon la canción y pulsa una tecla al empezar y al terminar cada línea. El tiempo sale de tus pulsaciones.',
  'help.makerBar.select':
    'Dibuja un recuadro sobre las notas para moverlas o borrarlas juntas.',
  'help.makerBar.paint':
    'Dibuja la melodía directamente sobre la rejilla de tonos.',
  'help.makerBar.split':
    'Parte una palabra en sílabas, para que una palabra larga lleve una nota en cada una.',
  'help.makerBar.repair':
    'Las herramientas que escuchan por ti, y los modelos que necesitan.',
  'help.makerBar.export':
    'Guarda el karaoke terminado como proyecto de FluidEQ, UltraStar TXT, LRC o LRC mejorado.',
  'help.maker.tip':
    'Los modelos requieren conexión y espacio. La duración del proceso depende del equipo y la canción. Utiliza audio que tengas permiso para trabajar y revisa antes de compartir.',

  'help.share.title': 'Comparte audio entre ordenadores',
  'help.share.intro':
    'Compartir audio envía el sonido del sistema entre ordenadores de la misma red privada. El receptor tiene los auriculares o altavoces; los demás son emisores. Es distinto de duplicar a un segundo dispositivo del mismo ordenador.',
  'help.share.steps':
    'En el ordenador de escucha, abre Compartir audio, elige Reproducir audio en este ordenador y pulsa Crear código de conexión. Empieza con poco volumen.\nEn cada ordenador de origen, elige Enviar el audio de este ordenador, selecciona Música o Juego/Vídeo, pega el código de tu red y pulsa Conectar y enviar.\nVigila el monitor de conexión. Al terminar, pulsa Dejar de enviar o Dejar de escuchar; Crear código nuevo desconecta todos los emparejamientos guardados.',
  'help.share.tip':
    'El código de conexión autoriza el emparejamiento: mantenlo privado. Varios emisores se mezclan y elevan el nivel, y el Volumen del receptor lo ajusta. Con el Motor FluidEQ, el audio recibido también pasa por el rack DSP.',

  'help.trouble.title': 'Cuando algo suena mal',
  'help.trouble.intro':
    'Empieza por la fuente y la salida, y después aísla la capa. Una gráfica, un preset guardado o un interruptor activado no demuestran por sí solos que el sonido llegue al dispositivo previsto. El menú Ayuda también lleva a la solución de problemas de audio, al informe de problemas y al Foro.',
  'help.trouble.steps':
    'Sin sonido: comprueba reproducción, salida, volumen y conexión. La opción Un solo reproductor puede haber pausado otra fuente.\nSin cambio de EQ: confirma que EQ del sistema está activado y que la salida no muestra DESACT.; si lo muestra, pulsa Activar. Si un aviso dice que el motor no está funcionando, pulsa Reiniciar el audio de Windows.\nTodo parece correcto y el EQ sigue sin hacer nada: puede que Windows esté reproduciendo la música por fuera del motor. El aviso lo dice y ofrece moverlo de un toque a donde Windows sí lo use; cuesta un permiso y un segundo de silencio.\nDistorsión o graves excesivos: deja activado Normalizar automáticamente, reduce las ganancias y desactiva las capas de una en una. Si persiste, usa Informar de un problema y revisa el informe antes de enviarlo.',
  'help.trouble.tip':
    'F1 abre esta guía. Esc cierra primero la captura ampliada y después la guía. Si la interfaz se ve demasiado grande, Ctrl + 0 restablece el zoom. Procesos, en el menú de acciones, muestra qué está haciendo cada parte de FluidEQ.',

  'help.forum.title': 'Pregunta en el Foro',
  'help.forum.intro':
    'El Foro trae a la app las GitHub Discussions de FluidEQ: anuncios, ideas, preguntas y ajustes de los que la gente está orgullosa. Cualquiera puede leer; para publicar se usa tu cuenta de GitHub, no una de FluidEQ.',
  'help.forum.steps':
    'Abre Ayuda → Foro y elige una categoría: Anuncios, General, Ideas, Encuestas, Q&A o Muestra lo tuyo.\nBusca en el foro o abre un tema para leer las respuestas.\nPulsa Iniciar sesión con GitHub, termina en tu navegador y publica un Nuevo tema o una respuesta.',
  'help.forum.tip':
    'Todo lo que se publica es público en GitHub, con tu nombre de GitHub. En Q&A, marca la respuesta que te funcionó para que la encuentre quien venga después.',
};

export default help;
