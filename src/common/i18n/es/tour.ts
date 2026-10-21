/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Por favor, contribuye',
  'tour.eyebrow': 'NOVEDADES DE ESTA VERSIÓN',
  'tour.title': 'Novedades de FluidEQ',
  'tour.close': 'Cerrar',
  'tour.rail': 'Nuevas funciones',
  'tour.stepOf': '{current} de {total}',
  'tour.back': 'Atrás',
  'tour.next': 'Siguiente',
  'tour.done': 'Entendido',
  'tour.dontShowAgain': 'No volver a mostrar en esta versión',
  'tour.releaseNotes': 'Notas de la versión completas',
  'tour.rail.newIn': 'NUEVO EN {version}',
  'tour.rail.always': 'TAMBIÉN EN FLUIDEQ',
  'tour.newBadge': 'NUEVO',
  'tour.howTitle': 'Cómo empezar',
  'tour.beta': 'Beta',
  'tour.player.kicker': 'EL REPRODUCTOR COMPACTO',
  'tour.player.title': 'FluidEQ, plegado en un reproductor',
  'tour.player.subtitle': 'Un interruptor convierte la ventana en reproductor',
  'tour.player.lead':
    'Un interruptor en la barra de título convierte todo FluidEQ en un reproductor. Es el amplificador clásico, con su reloj LED, sus pilotos y el ecualizador completo; con {backdrop}, sobre un visualizador Plus, se vuelve de cristal. El mismo interruptor te devuelve a la página que dejaste.',
  'tour.player.point1':
    'Todo el ecualizador te acompaña: presets, diseños de bandas, Modo EQ, EQ inteligente, Graves, Medios y Agudos.',
  'tour.player.point2':
    'Pliégalo en una línea, mantenlo por encima de las demás ventanas o haz doble clic en el visualizador para verlo a pantalla completa.',
  'tour.player.point3':
    'Un tema propio, y las canciones que sueltas en «A continuación» se suman a la Biblioteca y a la cola.',
  'tour.player.how':
    'Pulsa el interruptor del Reproductor compacto en la barra de título, junto a Ayuda. En el reproductor, el mismo interruptor te devuelve a la app completa.',
  'tour.player.open': 'Probar el Reproductor compacto',
  'tour.player.imageAlt':
    'La esquina de la barra de título con el interruptor {player} marcado, y los dos reproductores que abre: el amplificador clásico con su reloj LED, pilotos, ecualizador y cola, y el reproductor de cristal, más ancho, sobre una aurora con {backdrop}.',
  'tour.player.classic': 'Amplificador clásico',
  'tour.player.glass': 'Cristal, con {backdrop}',
  'tour.look.kicker': 'UN ASPECTO NUEVO',
  'tour.look.title': 'Una ventana nueva, con colores nuevos',
  'tour.look.subtitle':
    'Un solo control de tema y un visualizador detrás de todo',
  'tour.look.lead':
    'Los paneles se apoyan en un único suelo abierto con los colores del nuevo icono, y un solo control, {brightness}, lleva toda la ventana de casi negro a un azul océano claro. Con un visualizador Plus en la gráfica, la ventana puede tomar sus colores o mostrarlo detrás de todo.',
  'tour.look.point1':
    '{brightness} está en el menú del icono de pulso, y junto a {transparency} en {windowColours}.',
  'tour.look.point2':
    '{windowColours} ofrece {original}, {colours}, {ambient} y {backdrop}, cada uno con una línea sobre lo que hace con la ventana.',
  'tour.look.point3':
    'Los diálogos y los menús comparten un mismo material, y el {rainbow} recorre los colores del icono, o los de un visualizador.',
  'tour.look.how':
    'Mueve {brightness} en el menú de acciones (el icono de pulso, arriba a la derecha). Con un visualizador Plus en la gráfica, abre {windowColours} desde la barra de la gráfica y elige {backdrop}.',
  'tour.look.open': 'Abrir EQ',
  'tour.look.imageAlt':
    'FluidEQ con sus propios colores en la página del EQ, el Analizador dibujando una canción bajo las curvas, y el menú del icono de pulso abierto sobre su esquina, con el Brillo a la mitad y el Modo arcoíris activado.',
  'tour.gpu.kicker': 'UN NUEVO MOTOR DE VISUALIZADORES',
  'tour.gpu.title': 'Todos los visualizadores en tu tarjeta gráfica',
  'tour.gpu.subtitle': 'Cuarenta estilos al ritmo de tu pantalla, y mundos 3D',
  'tour.gpu.lead':
    'Los cuarenta estilos de la gráfica ahora se dibujan con el motor de las escenas Plus: en tu tarjeta gráfica y a la frecuencia de refresco de tu pantalla, así que barras, partículas y picos se deslizan donde antes saltaban. Y un visualizador Plus ya puede ser un auténtico mundo 3D.',
  'tour.gpu.point1':
    'Dieciocho estilos nuevos en {scenes}, entre ellos {synthwave}, {horizon}, {towers} y {ledwall}; un estilo sin colores propios lleva los de la ventana.',
  'tour.gpu.point2':
    'Los mundos 3D pisan con el bombo, se mecen con la caja, saltan en el drop y pasan de la noche al día con {brightness}; arrastra uno para verlo desde otro lado.',
  'tour.gpu.point3':
    'Al cambiar de estilo, uno se funde con el siguiente, y un mundo 3D devuelve su memoria gráfica mientras la ventana está tapada.',
  'tour.gpu.how':
    'Haz clic en el nombre del estilo en la gráfica y elige uno en {scenes}.',
  'tour.gpu.open': 'Abrir EQ',
  'tour.gpu.imageAlt':
    'Un visualizador Plus que es una ciudad 3D de noche, y cuatro estilos nuevos fotografiados en la gráfica —{synthwave}, {horizon}, {towers} y {ledwall}—, con el selector de estilos marcado en el primero.',
  'tour.gpu.world': 'Mundo 3D',
  'tour.sparks.kicker': 'CHISPAS DEL PUNTERO',
  'tour.sparks.title': 'Visualizadores que responden a tu ratón',
  'tour.sparks.subtitle': 'Chispas, pétalos o nieve desde el puntero',
  'tour.sparks.lead':
    'Pasa el ratón por un visualizador Plus y lanza aquello de lo que está hecho —chispas, pétalos, nieve, brasas— en una estela tras el puntero, y estalla donde haces clic. En {ambient} y con {backdrop}, sus pájaros, pétalos y luces también flotan por toda la ventana.',
  'tour.sparks.point1':
    'Cada visualizador lanza lo suyo: nieve una escena de invierno, brasas una hoguera, pétalos un jardín.',
  'tour.sparks.point2':
    'El escenario del Studio siempre las muestra, para que quien crea una escena pueda dar forma a lo que lanza.',
  'tour.sparks.point3':
    'Un interruptor para todos los visualizadores: {sparks}, en {windowColours} bajo {rainbow}.',
  'tour.sparks.how':
    'Con un visualizador Plus en la gráfica, pasa el ratón por encima y haz clic. {sparks} está en {windowColours}, bajo {rainbow}.',
  'tour.sparks.open': 'Abrir EQ',
  'tour.sparks.imageAlt':
    'Un visualizador de aurora con una estela de chispas brillantes tras el puntero y un estallido donde hizo clic, y {windowColours} con su interruptor {sparks} marcado.',
  'tour.sound.kicker': 'EL MOTOR FLUIDEQ',
  'tour.sound.title': 'El sonido tal como lo dibujaste',
  'tour.sound.subtitle': 'Agudos tal cual, cambios sin clics, nivel en un paso',
  'tour.sound.lead':
    'Con el Motor FluidEQ tu curva ahora suena exactamente como la dibujaste hasta los 20 kHz, cada cambio se funde en vez de hacer clic y {autoNormalize} llega al nivel de una curva nueva en un solo paso. Cómo se construyen los agudos lo eliges tú: {precise} o {classic}.',
  'tour.sound.point1':
    '{precise} construye cada banda tal como está dibujada; en una salida de 48 kHz los agudos llegaban 3,8 dB por debajo a 20 kHz. {classic} las construye como Equalizer APO, y como AutoEQ ajusta una corrección.',
  'tour.sound.point2':
    'Los presets se funden al cambiar: 534 de 636 cambios crepitaban, y ahora ninguno supera los −80 dBFS.',
  'tour.sound.point3':
    'Cada ajuste se oye en el momento en que lo haces, y {autoNormalize} va luego a su nivel en un solo paso, calculado con los últimos diez segundos de música.',
  'tour.sound.how':
    'Abre el EQ y pulsa {eqMode}. En {treble}, elige {precise} o {classic}, para tu EQ y para las correcciones por separado.',
  'tour.sound.open': 'Abrir EQ',
  'tour.sound.imageAlt':
    'El menú {eqMode} abierto bajo su botón con {treble} en {precise}; una curva de agudos que {precise} reproduce tal como está dibujada y {classic} 3,8 dB por debajo a 20 kHz en una salida de 48 kHz; y el sonido por encima de 5 kHz al cambiar de preset: un clic de −26 dBFS antes de la 2.0 y nada por encima de −80 dBFS ahora.',
  'tour.sound.trebleChart': 'Agudos, de 1 a 20 kHz',
  'tour.sound.switchChart': 'Por encima de 5 kHz, al cambiar de preset',
  'tour.sound.before': 'Antes de la 2.0',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': 'VISTAS DE ESTUDIO',
  'tour.graph.title': 'Una gráfica que lee el sonido como un estudio',
  'tour.graph.subtitle': 'Doce vistas y un analizador de 80 dB',
  'tour.graph.lead':
    'La gráfica mide lo que suena como lo hacen los analizadores de estudio: doce vistas, del espectrograma y la cascada al estéreo, la sonoridad y la fase, en escalas que no se mueven mientras la música sí.',
  'tour.graph.point1':
    '{analyzer}, {spectrogram}, {rta}, {waterfall}, {scope} y siete más, en {analysis} dentro del selector de estilos.',
  'tour.graph.point2':
    'El sonido en directo se dibuja con 80 dB de profundidad y hasta 10 Hz, un doceavo de octava por punto, así que un tono se lee a su nivel real.',
  'tour.graph.point3':
    'Tu EQ conserva sus ±20 dB, con margen en los bordes para una curva que va más allá, y las frecuencias se rotulan 10, 20, 50, 100, como las imprimen los analizadores.',
  'tour.graph.how':
    'Haz clic en el nombre del estilo que hay sobre la gráfica y elige una vista en {analysis}. Doble clic en la gráfica para llenar la pantalla; Ctrl+G muestra u oculta la cuadrícula.',
  'tour.graph.open': 'Abrir EQ',
  'tour.graph.imageAlt':
    'El Analizador de la gráfica con una canción sonando: el espectro en directo con 80 dB de profundidad y sus picos encima, las curvas del EQ arriba y, en la esquina, la lista de vistas de Análisis.',

  'tour.games.kicker': 'PRESETS DE JUEGO',
  'tour.games.title': 'Cada juego, su propio sonido',
  'tour.games.subtitle': 'Cambia en cuanto el juego pasa al frente',
  'tour.games.lead':
    'Elige una vez un sonido para cada juego. Cuando el juego pasa al frente, FluidEQ cambia a ese sonido y lo mantiene hasta que cierras el juego, por mucho que uses Alt+Tab, y después vuelve a lo que tenías.',
  'tour.games.point1':
    'Juegos de Steam, Epic Games, EA, GOG, Ubisoft, Battle.net y Xbox, o cualquier programa que esté abierto.',
  'tour.games.point2':
    'Los presets de Juegos activan el Modo juego, que reduce el retardo que añade FluidEQ, y la página muestra ese retardo medido.',
  'tour.games.point3':
    'Una tarjeta en tu escritorio indica qué se ha cambiado, y otra, qué ha vuelto al cerrarse el juego.',
  'tour.games.how':
    'Abre EQ, elige Presets de juego y pulsa Añadir un juego. Luego elige su sonido en el selector de su fila.',
  'tour.games.open': 'Abrir Presets de juego',
  'tour.games.imageAlt':
    'Tres momentos en el escritorio: un juego al frente con la tarjeta de FluidEQ que dice que su sonido se cargó, el mismo juego minimizado con su sonido aún activo, y el juego cerrado con la tarjeta que dice que el sonido de antes ha vuelto.',
  'tour.games.stepFront': 'Al frente: se carga su sonido',
  'tour.games.stepAway': 'Minimizado o con Alt+Tab: su sonido sigue',
  'tour.games.stepClosed': 'Cerrado: vuelve tu sonido',
  'tour.presets.kicker': 'NUEVOS PRESETS',
  'tour.presets.title': 'Presets que suenan a su música',
  'tour.presets.subtitle': 'Cadenas completas, a la misma sonoridad',
  'tour.presets.lead':
    'Cada preset se ha vuelto a medir y a nivelar: cambiar de uno a otro altera el carácter, no el volumen, y ahora cada uno se oye igual de claro con el Motor FluidEQ que con Equalizer APO.',
  'tour.presets.point1':
    '{chains} cadenas, {styles} de ellas estilos musicales, más copias para la Sala de Música, Cine y Juegos.',
  'tour.presets.point2':
    'La curva de un preset aparece en la gráfica como una capa propia, con una intensidad que puedes bajar.',
  'tour.presets.point3':
    'Cada estilo se explica solo: señala uno y sus notas se abren junto a la lista.',
  'tour.presets.how':
    'Abre EQ y pulsa Presets, o elige una cadena en la parte superior de DSP.',
  'tour.presets.open': 'Abrir EQ',
  'tour.presets.imageAlt':
    'El selector de presets con Rock elegido y sus notas junto a la lista: su curva con puntos numerados, para qué sirve cada punto y a qué volumen suena.',
  'tour.tone.kicker': 'CONTROLES DE TONO',
  'tour.tone.title': 'Graves, Medios y Agudos, como un amplificador',
  'tour.tone.subtitle': 'Tres mandos con su propia curva',
  'tour.tone.lead':
    'Sin ninguna banda seleccionada, Graves, Medios y Agudos dan forma al sonido como una curva propia, con un corte de graves y uno de agudos a los lados: la forma más rápida de dar calidez o brillo a una canción, y cada banda queda tal como la dejaste.',
  'tour.tone.point1':
    'El ecualizador se abre con todas las bandas a la vista y ninguna seleccionada.',
  'tour.tone.point2':
    'Un nuevo diseño de veinte bandas, y todos los diseños en las frecuencias estándar.',
  'tour.tone.point3':
    'Las bandas se abren tan anchas como su separación: sin huecos entre ellas y sin que dos toquen la misma nota.',
  'tour.tone.how':
    'Abre EQ sin ninguna banda seleccionada y gira Graves, Medios o Agudos. Haz Ctrl+clic en un mando para dejar su tercio plano de nuevo.',
  'tour.tone.open': 'Abrir EQ',
  'tour.tone.imageAlt':
    'La curva del ecualizador en sus tercios de graves, medios y agudos, los tres mandos que los mueven y los diseños rápidos de seis a treinta y una bandas.',
  'tour.studio.kicker': 'FLUIDEQ PLUS',
  'tour.studio.title': 'Crea tu propio visualizador',
  'tour.studio.subtitle': 'Gratis durante 15 días, o gánate un mes',
  'tour.studio.lead':
    'El Estudio convierte una idea en una escena que se mueve con tu música. Ahora forma parte de Plus, y una cuenta nueva puede probarlo gratis durante quince días, sin tarjeta y sin ningún cobro al terminar la prueba.',
  'tour.studio.point1':
    'Cada escena se revisa antes de llegar a la galería, y una aprobada te regala el próximo mes de Plus.',
  'tour.studio.point2':
    'Las escenas pueden ser mundos 3D de verdad que pisan al ritmo del bombo y saltan en el drop.',
  'tour.studio.point3':
    'Copia el prompt para la IA y tu asistente de IA podrá ver tu escena y oír cómo se mueve la canción.',
  'tour.studio.how':
    'Abre Plus y elige Estudio en su barra lateral. Sin Plus, esa página te ofrece la prueba gratuita.',
  'tour.studio.open': 'Abrir Plus',
  'tour.studio.imageAlt':
    'El Estudio con Alpine en su escenario, un lago bajo picos nevados y una aurora, debajo los tres pasos para crear una escena con tu IA, y luego la prueba de quince días y el mes que se gana con una escena aprobada.',
  'tour.studio.earned': 'Aprobada: próximo mes gratis',
  'tour.help.kicker': 'AYUDA',
  'tour.help.title': 'Pregunta a la guía con tus palabras',
  'tour.help.subtitle': 'Erratas, plurales y diez idiomas',
  'tour.help.lead':
    'Busca en la guía como se lo preguntarías a un amigo — «no hay sonido», «limitador», «fondo de pantalla» — en cualquiera de diez idiomas. El mejor capítulo aparece primero, y la guía te lleva al control, rodeado con un círculo en la imagen.',
  'tour.help.point1':
    'Perdona las erratas y los plurales, y conoce las palabras que la gente usa para las cosas.',
  'tour.help.point2':
    'Cada control de una imagen va numerado, como en un manual impreso.',
  'tour.help.point3':
    'F1 la abre desde cualquier parte, y Enter salta a la siguiente coincidencia.',
  'tour.help.how':
    'Pulsa F1, o abre el libro de la barra de título y elige Guía de usuario; luego escribe lo que buscas.',
  'tour.help.open': 'Abrir Ayuda',
  'tour.help.imageAlt':
    'La guía de usuario con la búsqueda «no hay sonido»: sus capítulos ordenados con las palabras marcadas, y una imagen con sus controles numerados.',
  'tour.help.query': 'no hay sonido',

  'tour.engine.kicker': 'NUESTRO PROPIO MOTOR DE AUDIO',
  'tour.engine.title': 'Conoce el Motor FluidEQ',
  'tour.engine.subtitle': 'EQ y DSP para todo lo que oyes',
  'tour.engine.lead':
    'FluidEQ tiene ahora un motor de audio propio. Funciona dentro del servicio de audio de Windows, después de los efectos de tu tarjeta de sonido, y lleva tu EQ y el rack DSP completo a todo lo que suena en el ordenador: juegos, navegadores y apps de streaming, no solo a la Biblioteca.',
  'tour.engine.point1':
    'El rack DSP en todo el audio del sistema, aunque no suene nada en FluidEQ.',
  'tour.engine.point2':
    'Nivelación en directo que reconoce la canción, y Reducción de ruido que limpia sobre la marcha.',
  'tour.engine.point3':
    'Sal de FluidEQ y tu sonido vuelve a la normalidad al instante, incluso tras un cierre inesperado.',
  'tour.engine.how':
    'Elige el Motor FluidEQ al instalar, o abre el menú de acciones (el icono de pulso, arriba a la derecha), pulsa la tarjeta del motor, arriba del todo, elige Motor FluidEQ y pulsa Aplicar. Después abre DSP y activa una etapa mientras suena cualquier app.',
  'tour.engine.open': 'Abrir DSP',
  'tour.engine.flow.label':
    'Todo lo que suena en el ordenador pasa por el Motor FluidEQ (primero tu EQ y después el rack DSP) de camino a tus auriculares y altavoces.',
  'tour.engine.flow.games': 'Juegos',
  'tour.engine.flow.browser': 'Navegadores',
  'tour.engine.flow.music': 'Apps de música',
  'tour.engine.flow.video': 'Vídeos',
  'tour.engine.flow.inside': 'Dentro del audio de Windows',
  'tour.engine.flow.eq': 'Tu EQ',
  'tour.engine.flow.rack': 'Rack DSP',
  'tour.engine.flow.headphones': 'Auriculares',
  'tour.engine.flow.speakers': 'Altavoces',

  'tour.room.kicker': 'SURROUND EN LOS AURICULARES',
  'tour.room.title': 'Siéntate en la Sala',
  'tour.room.subtitle': 'Veinticuatro salas, todas gratis',
  'tour.room.lead':
    'La Sala convierte tus auriculares en una sala de escucha, con cada canal como un altavoz a tu alrededor. Trece salas nuevas se suman a las once clásicas, cada una distinta de las demás según las mediciones, y todo es gratis.',
  'tour.room.point1':
    'El estéreo son dos altavoces delante de ti, o llena la sala si lo pides; una película 5.1, cinco y el sub; un juego 7.1, el anillo entero.',
  'tour.room.point2':
    'Elige una sala en Destacadas, Salas clásicas o Tuyos; todo lo que compone una sala está en su página.',
  'tour.room.point3':
    'Una prueba de escucha elige de oído la cabeza que pone los sonidos delante de ti, en cinco pares.',
  'tour.room.how':
    'Abre DSP, elige Sala en el carril y actívala. Elige una sala, luego arrastra un altavoz o gira un dial; en «Tu cabeza», pulsa «Empezar la prueba de escucha».',
  'tour.room.open': 'Abrir la Sala',
  'tour.room.imageAlt':
    'Una sala vista desde arriba: siete altavoces y un sub alrededor de una cabeza en el centro, cada uno con su camino hasta los oídos.',

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Te damos la bienvenida a FluidEQ Plus',
  'tour.plus.subtitle': 'Visualizadores, Estudio, iluminación y más',
  'tour.plus.lead':
    'Una membresía opcional que permite que FluidEQ siga creciendo, con una pestaña nueva solo para ella: escenas dibujadas en tu tarjeta gráfica, un Estudio para crear las tuyas, la clasificación, fondos de escritorio e iluminación dinámica. El ecualizador, el rack y los reproductores siguen siendo gratis, como siempre lo han sido.',
  'tour.plus.point1':
    'Inicia sesión desde Cuenta, en el menú de acciones; el pago se hace en tu navegador y Plus se activa solo.',
  'tour.plus.point2':
    'Mensual o anual, con las condiciones en lenguaje claro antes de pagar. La app nunca ve tu tarjeta.',
  'tour.plus.point3':
    'Con la sesión iniciada en hasta cinco ordenadores, y con nuevos visualizadores que irán llegando.',
  'tour.plus.how':
    'Abre la pestaña Plus: en su lateral izquierdo tienes Clasificación, Visualizadores, Estudio e Iluminación dinámica.',
  'tour.plus.open': 'Abrir Plus',
  'tour.plus.imageAlt':
    'La pestaña Plus: Clasificación, Visualizadores, Estudio e Iluminación dinámica en el lateral, y la galería de Visualizadores con Cromo, Floración, Aurora, Alpino y Ciudad de neón.',
  'tour.scene.alpine': 'Alpino',
  'tour.scene.aurora': 'Aurora',
  'tour.scene.bloom': 'Floración',
  'tour.scene.chrome': 'Cromo',
  'tour.scene.neonCity': 'Ciudad de neón',

  'tour.visualizers.kicker': 'VISUALIZADORES',
  'tour.visualizers.title': 'Escenas que se mueven con tu música',
  'tour.visualizers.subtitle': 'Dibujadas en tu tarjeta gráfica',
  'tour.visualizers.lead':
    'Los visualizadores Plus son escenas vivas, como montañas bajo las estrellas, cortinas de aurora o una ciudad de neón, que tu tarjeta gráfica dibuja detrás de tus curvas de EQ. Los graves, el ritmo y los agudos mueven cada uno algo distinto, y la ventana que las rodea puede tomar sus colores.',
  'tour.visualizers.point1':
    'Un solo selector para todo: {styles} estilos gratuitos que puedes moldear y colorear, y los visualizadores Plus por categorías.',
  'tour.visualizers.point2':
    'Explora la galería, prueba durante diez segundos las muestras de FluidEQ y añade las escenas que te gusten.',
  'tour.visualizers.point3':
    'Cambia de estilo automáticamente, pasa a pantalla completa y ajusta el ataque y la liberación de una escena en Vista.',
  'tour.visualizers.how':
    'Haz clic en el nombre del estilo que hay sobre la gráfica y elige una escena en Visualizadores Plus, o explóralas todas en Plus → Visualizadores.',
  'tour.visualizers.open': 'Abrir EQ',
  'tour.visualizers.imageAlt':
    'Alpino, un visualizador Plus de montañas sobre un lago nocturno, reproduciéndose en la gráfica detrás de las curvas de EQ, con otras cuatro escenas debajo.',

  'tour.desktop.kicker': 'VISUALIZADOR DE ESCRITORIO',
  'tour.desktop.title': 'Tu música detrás del escritorio',
  'tour.desktop.subtitle': 'Una escena en cada monitor',
  'tour.desktop.lead':
    'Pon un visualizador Plus detrás de los iconos del escritorio. Se mueve con lo que estés escuchando, o con calma por su cuenta, y cada monitor puede mostrar su propia escena.',
  'tour.desktop.point1':
    'Elige los monitores en un mapa de tu escritorio, cada uno con su propio visualizador.',
  'tour.desktop.point2':
    'Se pausa mientras las ventanas cubren el monitor, con el PC bloqueado y al usar la batería.',
  'tour.desktop.point3': 'Vuelve solo la próxima vez que se inicie FluidEQ.',
  'tour.desktop.how':
    'Con un visualizador Plus en la gráfica, pulsa el botón del monitor junto a su nombre o elige Vista → Usar como fondo de escritorio.',
  'tour.desktop.open': 'Abrir EQ',
  'tour.desktop.imageAlt':
    'Tres monitores, cada uno con un visualizador Plus (Aurora, Alpino y Ciudad de neón) detrás de sus iconos del escritorio y su barra de tareas.',

  'tour.lighting.kicker': 'ILUMINACIÓN DINÁMICA',
  'tour.lighting.title': 'Tu escritorio se ilumina con la escena',
  'tour.lighting.subtitle':
    'Beta · tus dispositivos RGB siguen al visualizador',
  'tour.lighting.lead':
    'Tu teclado, ratón, alfombrilla, auriculares y soporte toman los colores y el ritmo del visualizador Plus de la gráfica, mediante Windows Dynamic Lighting y Razer Chroma.',
  'tour.lighting.point1':
    'Cuatro estilos para cada visualizador: Escena, Onda de color, Espectro y Onda al ritmo.',
  'tour.lighting.point2':
    'Ajusta cada dispositivo por separado y elige qué pasa cuando la música se detiene.',
  'tour.lighting.point3':
    'Una vista previa en directo dibuja tu propio escritorio mientras se ilumina. Está en beta: cuéntanos cómo se comportan tus dispositivos.',
  'tour.lighting.how':
    'Abre Plus → Iluminación dinámica y actívala; después pon un visualizador Plus en la gráfica.',
  'tour.lighting.open': 'Abrir Plus',
  'tour.lighting.imageAlt':
    'Un teclado, un ratón y una alfombrilla iluminados con el rosa, el violeta y el cian de Ciudad de neón.',

  'tour.share.kicker': 'CADA PC, EN LAS DOS DIRECCIONES',
  'tour.share.title': 'Comparte audio entre tus ordenadores',
  'tour.share.subtitle':
    'Oye los dos ordenadores, te sientes en el que te sientes',
  'tour.share.lead':
    'Tu PC de juegos y tu portátil suenan el uno en el otro: te sientes en el que te sientes, oyes los dos, por tu propia red, sin pérdida, cifrado y con el EQ que ajustaste en ese ordenador.',
  'tour.share.pairLabel': 'EN LAS DOS DIRECCIONES',
  'tour.share.pairName': 'Cada ordenador reproduce el sonido del otro',
  'tour.share.wireLabel': 'Sin pérdidas · Cifrado · LAN privada',
  'tour.share.stepsTitle': 'Configúralo en tres pasos',
  'tour.share.step1Title': 'En un ordenador, copia su código',
  'tour.share.step1':
    'Abre la pestaña Compartir audio y pulsa «Copiar código». El código es siempre el mismo.',
  'tour.share.step2Title': 'En el otro, pégalo y enlaza',
  'tour.share.step2':
    'Abre allí Compartir audio, pega el código en «Código del otro ordenador» y pulsa «Enlazar». Los dos empiezan a reproducirse al instante, sin tocar: cada uno aplica su propio EQ a lo que oye.',
  'tour.share.step3Title': 'Elige qué va adónde',
  'tour.share.step3':
    'Cada ordenador enlazado tiene dos interruptores, «Reproducir aquí» y «Enviar mi sonido»: apaga uno si quieres una sola dirección. La barra muestra la canción del otro ordenador y sus botones funcionan a través del enlace. Un deslizador junto a «Reproducir aquí» fija su volumen, y «Pausar» detiene ambos sentidos hasta que pulses «Reanudar».',
  'tour.share.fact1Title': 'Sin pérdidas',
  'tour.share.fact1':
    'PCM Float32 de extremo a extremo. Sin códec, sin pérdida de generación.',
  'tour.share.fact2Title': 'Cifrado',
  'tour.share.fact2':
    'AES-256-GCM en cada paquete. El código es la clave; sin él nadie puede escuchar.',
  'tour.share.fact3Title': 'Sigue enlazado',
  'tour.share.fact3':
    'El enlace sobrevive a cerrar la app y a los reinicios, desde cualquiera de los dos lados. Solo «Desenlazar» lo termina.',
  'tour.share.tip':
    'Empieza bajito: dos ordenadores sonando a la vez se suman. Baja el volumen antes del primer enlace.',
  'tour.share.open': 'Abrir Compartir audio',

  'tour.library.kicker': 'TU MÚSICA, TU REPRODUCTOR',
  'tour.library.title': 'Una Biblioteca para la música que tienes',
  'tour.library.subtitle': 'Entran carpetas, salen álbumes',
  'tour.library.lead':
    'Señala una carpeta y FluidEQ lee cada canción y vídeo que contiene, con etiquetas y portadas, y los convierte en una colección que recorres por álbum, artista, género, canción o carpeta. La reproducción pasa por el propio reproductor de FluidEQ, así que el EQ y el rack DSP están siempre en el camino.',
  'tour.library.point1':
    'Tres formas de ver el mismo estante: lista, cuadrícula y cover flow, con salto a una letra para colecciones grandes.',
  'tour.library.point2':
    'Una cola de «A continuación» con «Seguir sonando», que continúa con más del mismo género cuando la lista se acaba.',
  'tour.library.point3':
    'Listas de reproducción y una lista de Favoritos permanente. Clic derecho en cualquier canción para añadirla a una u otra, o a la cola.',
  'tour.library.point4':
    'Memoria del EQ inteligente por canción: mientras el EQ inteligente sigue midiendo, activa «Guardar para esta canción» y, a los dos minutos, su corrección se guarda para ese tema y se recupera cuando vuelve a sonar.',
  'tour.library.how':
    'Abre la pestaña Biblioteca, pulsa «Añadir carpeta» o suelta una carpeta en la página y deja que termine el escaneo. Elige Álbumes, Artistas, Géneros, Canciones, Carpetas o Árbol y pulsa Reproducir.',
  'tour.library.open': 'Abrir Biblioteca',

  'tour.dsp.kicker': 'UN RACK DE MASTERIZACIÓN',
  'tour.dsp.title': 'El rack DSP',
  'tour.dsp.subtitle': 'Diez etapas, cada una en su propia página',
  'tour.dsp.lead':
    'Un rack de etapas de estudio: Normalizador, Reducción de ruido, Excitador, Forja de graves, Ecualizador, Pegada de graves, Dimensión, Sala, Maximizador y Master, más un fundido cruzado entre pistas de la Biblioteca. Con el Motor FluidEQ se aplica a todo lo que suena en el ordenador; con Equalizer APO, a la Biblioteca. Cada etapa tiene su propia página con una vista en vivo, la mayoría tiene presets y cinco tienen un interruptor Aislar para oír solo lo que hacen.',
  'tour.dsp.point1':
    'Reducción de ruido repara el siseo, el zumbido y los chasquidos mientras suenan, y un limpiador de voz neuronal trabaja con las pistas de la Biblioteca.',
  'tour.dsp.point2':
    'Forja de graves añade una octava real por debajo del bajo; Pegada de graves moldea su ataque, sostenimiento y florecimiento, con una Mezcla de hasta el 200 %.',
  'tour.dsp.point3':
    'Un Ecualizador paramétrico de 6 a 31 bandas, quince de entrada, con fase mínima o lineal, centro/lados, sobremuestreo y más de cien presets con nombre.',
  'tour.dsp.point4':
    'Master con objetivo de sonoridad LUFS y protección de pico verdadero, presets de entrega de Streaming a Vinilo, y la opción Igualar ganancia para comparar sonido, no volumen.',
  'tour.dsp.how':
    'Abre la pestaña DSP, elige una cadena en Presets, luego haz clic en una etapa en las pestañas laterales y actívala. Con Equalizer APO, reproduce antes una pista de la Biblioteca.',
  'tour.dsp.open': 'Abrir DSP',

  'tour.output.kicker': 'SUENA EN DOS SITIOS',
  'tour.output.title': 'Perfiles de la segunda salida',
  'tour.output.subtitle':
    'Auriculares y altavoces a la vez, cada uno con su perfil',
  'tour.output.lead':
    'Escucha por auriculares y altavoces a la vez con EQ independiente. La segunda salida recibe el sonido antes del EQ de la principal y aplica su propio perfil guardado. No hace falta un controlador de enrutamiento.',
  'tour.output.point1':
    'Activa otro dispositivo en Segunda salida y ajusta su volumen.',
  'tour.output.point2':
    'Elige uno de sus perfiles guardados bajo el dispositivo, o pulsa {editSound} a su lado para cambiar su sonido sin cambiar la salida principal. La salida principal conserva su ajuste.',
  'tour.output.point3':
    'Un solo reproductor: iniciar algo en FluidEQ pausa el resto de la máquina, y al revés.',
  'tour.output.point4':
    'Cada salida sigue el ritmo sola: empieza unos 30 ms por detrás, añade un poco solo tras un corte y muestra su retardo en milisegundos, incluido el sonido de otro ordenador cuando Compartir audio lo reproduce aquí.',
  'tour.output.how':
    'Abre la pestaña EQ y despliega Segunda salida a la derecha. Activa un dispositivo, elige su perfil de EQ bajo el nombre y ajusta el volumen; debajo verás su retardo.',
  'tour.output.open': 'Abrir EQ',
  'tour.output.imageAlt':
    'El panel Segunda salida con unos BlackShark V2 Pro activados, su selector de perfil de EQ, el volumen y el retardo.',

  'tour.outputs.kicker': 'CADA SALIDA RECUERDA',
  'tour.outputs.title': 'Cada salida conserva su propio sonido',
  'tour.outputs.subtitle': 'Auriculares y altavoces, cada uno a su manera',
  'tour.outputs.lead':
    'Pasa de los auriculares a los altavoces y cada salida trae su sonido consigo: el EQ, el preset, el Tono, los cortes, el rack DSP, la Sala y la nivelación se guardan con cada salida.',
  'tour.outputs.point1':
    'Elige una salida y todo lo que ajustaste para ella vuelve al instante. Auriculares y altavoces ya no comparten el mismo preset ni la misma curva.',
  'tour.outputs.point2':
    'Una segunda salida suena directamente desde el Motor FluidEQ con un sonido propio, y la principal nunca la espera. {editSound}, a su lado, cambia ese sonido sin cambiar la salida principal.',
  'tour.outputs.point3':
    'Los auriculares Bluetooth muestran su batería junto a la salida, y una segunda salida muestra en milisegundos cuánto va por detrás.',
  'tour.outputs.how':
    'Abre el EQ y elige una salida en {output}, a la derecha: lo que ajustes desde entonces se queda con ella. Para una segunda, actívala en {secondOutput} y pulsa {editSound}.',
  'tour.outputs.open': 'Abrir EQ',
  'tour.outputs.imageAlt':
    'La tarjeta Salida con unos auriculares y unos altavoces, cada uno con su preset, su curva y sus etapas DSP, sonando por turnos, y al lado una segunda salida que suena a la vez con su propio sonido, su batería y Editar sonido.',

  'tour.bands.kicker': 'EL EQ, EN NÚMEROS',
  'tour.bands.title': 'Los valores de cada banda, en la propia gráfica',
  'tour.bands.subtitle': 'Etiquetas sobre la curva, Modo EQ a su lado',
  'tour.bands.lead':
    'Cada banda puede mostrar su frecuencia, su Q y su ganancia sobre su propio punto, y las etiquetas no se estorban entre sí. El Modo EQ ahora está junto a la gráfica en vez de encima, así que las curvas siguen a la vista mientras cambias cómo suenan.',
  'tour.bands.point1':
    'Una etiqueta se coloca justo encima o debajo de su punto, nunca sobre otra, se queda quieta mientras arrastras su banda y vuelve a su sitio en cuanto hay espacio.',
  'tour.bands.point2':
    '{eqMode} es la primera tarjeta del panel lateral, con una pestaña para {yourEq} y otra para {corrections}. Su botón sobre la gráfica trae la tarjeta a la vista.',
  'tour.bands.point3':
    'Cada punto, deslizador y perilla funciona con el teclado, y mover un deslizador redibuja la curva en el mismo fotograma.',
  'tour.bands.how':
    'Abre el EQ, elige {view} → {everything} sobre la gráfica (o pulsa {shortcut}) y mueve una banda: sus valores la siguen. {eqMode} espera arriba del todo en el panel de la derecha.',
  'tour.bands.open': 'Abrir EQ',
  'tour.bands.imageAlt':
    'La gráfica del EQ con la frecuencia, la Q y la ganancia de cada banda sobre su punto, una banda que se mueve con las flechas del teclado y, debajo, la tarjeta Modo EQ con Tu EQ y Correcciones.',
  'tour.bands.shortcut': 'Ctrl+W',

  'tour.ears.kicker': 'UNA BANDA, DOS OÍDOS',
  'tour.ears.title': 'Ajusta cada oído por separado',
  'tour.ears.subtitle': 'Izquierdo + derecho en el menú de la banda',
  'tour.ears.lead':
    'Haz clic derecho en una banda y elige {split}: se convierte en una banda para cada oído, en la misma frecuencia, y mueves cada una por su cuenta. La curva del oído izquierdo se dibuja continua y la del derecho, discontinua.',
  'tour.ears.point1':
    '{both} las vuelve a unir en su punto medio, a mitad de camino en frecuencia y ganancia. {reset} y {clear} también las unen.',
  'tour.ears.point2':
    '{delete} está en el mismo menú, en el EQ principal y en el rack DSP, y pide una segunda pulsación antes de borrar.',
  'tour.ears.point3':
    'Una curva de Squiglink se puede importar en un solo oído: {importInto} llena solo el izquierdo o el derecho y deja el otro como estaba.',
  'tour.ears.how':
    'Abre EQ, haz clic derecho en una banda de la gráfica y elige {split}. El EQ del rack DSP tiene el mismo menú mientras se aplica a Estéreo.',
  'tour.ears.open': 'Abrir EQ',
  'tour.ears.imageAlt':
    'La gráfica del EQ con una banda dividida en una para el oído izquierdo y otra para el derecho, que se separan y se vuelven a unir en su punto medio, la curva del izquierdo continua y la del derecho discontinua, junto al menú de la banda con Ambos oídos e Izquierdo + derecho.',
  // Film voice: generated from .claude/video-kit/films/narration/lines.cjs — edit there.
  'tour.film.eachEar.intro':
    'Ahora cada banda de FluidEQ puede sonar distinta en cada oído.',
  'tour.film.eachEar.menu': 'Haz clic derecho en una banda para abrir su menú.',
  'tour.film.eachEar.split':
    'Elige Izquierdo + derecho. La banda se divide en dos, una mitad para cada oído.',
  'tour.film.eachEar.lines':
    'Arrastra cada mitad por separado. La línea continua es tu oído izquierdo y la discontinua, el derecho.',
  'tour.film.eachEar.sliders':
    'Cada oído también tiene su propio deslizador, marcado con L o R.',
  'tour.film.eachEar.join':
    'Para unirlas otra vez, elige Ambos oídos. Las dos mitades se encuentran en el medio.',
  'tour.film.sound.intro':
    'Cada cambio que haces en FluidEQ se oye al instante, y con suavidad.',
  'tour.film.sound.glide':
    'Mueve una banda mientras suena la música. Cada cambio entra deslizándose, sin ningún clic.',
  'tour.film.sound.precise':
    'En el menú Modo EQ, Agudos está en Preciso. Cada banda suena tal como está dibujada, hasta los veinte kilohercios.',
  'tour.film.sound.classic':
    'Elige Clásico para construir las bandas como lo hace Equalizer APO.',
  'tour.film.games.intro':
    'FluidEQ puede darle a cada uno de tus juegos su propio sonido.',
  'tour.film.games.add':
    'Pulsa Añadir un juego y elígelo entre los juegos que tienen instalados tus lanzadores.',
  'tour.film.games.sound': 'Luego elige el sonido que debe tener.',
  'tour.film.games.front':
    'Cuando el juego pasa al frente, su sonido se carga solo.',
  'tour.film.games.closed': 'Cierra el juego y vuelve tu propio sonido.',
  'tour.film.compact.intro':
    'Cuando solo necesitas los controles, FluidEQ se pliega en un reproductor pequeño.',
  'tour.film.compact.go':
    'Pulsa el botón del reproductor arriba y la ventana se convierte en el Reproductor compacto.',
  'tour.film.compact.eq':
    'Tu EQ viene contigo. Gira una perilla y lo oyes al instante.',
  'tour.film.compact.back':
    'Una sola pulsación te devuelve a la ventana completa.',
  'tour.film.deleteImport.intro': 'Dos pequeños cambios que protegen tu EQ.',
  'tour.film.deleteImport.asks':
    'Eliminar banda ahora pregunta primero. Púlsalo otra vez para eliminar la banda de verdad.',
  'tour.film.deleteImport.oneEar':
    'Una importación también puede llenar solo un oído. Elige Importar en y luego Oído izquierdo.',
  'tour.film.deleteImport.otherEar':
    'Solo se reemplaza el oído izquierdo. El derecho queda exactamente como estaba.',
  'tour.film.outputs.intro':
    'Cada salida de tu ordenador guarda su propio sonido.',
  'tour.film.outputs.each':
    'Cambia de los altavoces a los auriculares y el EQ pasa a ser el de los auriculares.',
  'tour.film.outputs.back':
    'Vuelve atrás y los altavoces suenan exactamente como los dejaste.',
  'tour.film.outputs.second':
    'También puedes sonar por una Segunda salida al mismo tiempo, con su propio sonido.',
  'tour.film.outputs.edit':
    'Pulsa Editar sonido para ajustarla aquí mismo, mientras la salida principal sigue sonando.',
  'tour.film.dsp.intro':
    'El rack DSP da forma a todo lo que oyes, después de tu EQ.',
  'tour.film.dsp.preset':
    'Elige un preset y configura todo el rack de una vez.',
  'tour.film.dsp.stages':
    'Cada etapa tiene su propia página, con todos los controles a la vista.',
  'tour.film.dsp.meters':
    'Sus medidores se mueven con la música, así ves lo que hace.',
  'tour.film.deesser.intro':
    'El rack DSP ahora tiene un De-esser, para voces con eses ásperas.',
  'tour.film.deesser.cuts':
    'Elige un preset como Pódcast y voz. Cada ese áspera se atenúa y se muestra en ámbar, mientras los platillos quedan intactos.',
  'tour.film.deesser.isolate': 'Pulsa Aislar para oír solo lo que quita.',
  'tour.film.headphones.intro':
    'FluidEQ puede corregir tus auriculares con mediciones hechas por otros.',
  'tour.film.headphones.search':
    'Abre Presets EQ y busca tus auriculares en la biblioteca de OPRA.',
  'tour.film.headphones.measure':
    'Elige una medición. Cada una dice quién la hizo.',
  'tour.film.headphones.applied':
    'Pulsa Aplicar EQ del modelo. La corrección va en una capa propia y tus bandas quedan como están.',
  'tour.film.headphones.paste':
    'También puedes pegar una exportación de Squiglink.',
  'tour.film.headphones.ears':
    'Aplícala como tu EQ, a ambos oídos o solo a uno.',
  'tour.film.headphones.curve': 'O aplícala como una curva propia.',
  'tour.film.karaoke.intro':
    'Karaoke convierte FluidEQ en un escenario para tus propias canciones.',
  'tour.film.karaoke.open':
    'Pulsa Abrir canción y elige la canción junto con su archivo de letra.',
  'tour.film.karaoke.words':
    'Pulsa reproducir. Cada palabra se ilumina mientras se canta.',
  'tour.film.karaoke.pitch':
    'Debajo, la guía de afinación muestra cada nota que hay que cantar. Activa tu micrófono para ver tu propia voz en ella.',
  'tour.film.maker.intro':
    'El Creador de karaoke convierte una canción en un archivo de karaoke.',
  'tour.film.maker.timeline':
    'Carga una canción y pulsa Crear. Cada palabra y cada nota quedan en una línea de tiempo.',
  'tour.film.maker.play':
    'Reprodúcela y el cabezal pasa por cada palabra y nota. Arrastra cualquiera para corregir su tiempo o su tono.',
  'tour.film.maker.use':
    'El Creador también puede preparar una canción por sí solo, a partir de la voz del cantante. Cuando suene bien, pulsa Usar en el reproductor.',
  'tour.film.looks.intro':
    'El espectro bajo tu EQ se puede dibujar como más te guste.',
  'tour.film.looks.open':
    'Pulsa Nuevo estilo en la barra de herramientas del gráfico.',
  'tour.film.looks.forms':
    'Recorre las formas con la flecha: barras LED, barras de neón, horizontes de ciudad, torres de cristal y más.',
  'tour.film.looks.shape':
    'Luego dale forma. Piezas define cuántas barras hay, y los colores, los espacios y el movimiento también son cosa tuya.',
  'tour.film.looks.save':
    'Pulsa Guardar para quedártelo como un estilo propio, o compártelo como archivo.',
  'tour.film.engine.intro':
    'FluidEQ tiene su propio motor de audio. Lleva tu EQ y el rack DSP a todo lo que suena en el ordenador.',
  'tour.film.engine.choose':
    'Abre el menú de acciones arriba a la derecha y pulsa la tarjeta del motor. El Motor FluidEQ es el que debes elegir.',
  'tour.film.engine.rack':
    'Después abre DSP y elige un preset. Juegos, navegadores y apps de música suenan todos a través de él.',
  'tour.film.library.intro':
    'La Biblioteca reproduce la música que tienes, a través de tu EQ.',
  'tour.film.library.albums':
    'Tus álbumes aparecen como portadas. Pásalos con las flechas.',
  'tour.film.library.album':
    'Haz clic en un álbum para abrirlo, con todas sus canciones.',
  'tour.film.library.play':
    'Pulsa reproducir y suena a través del mismo EQ y rack DSP que todo lo demás.',
  // End of film voice.
  'tour.film.soundOn': 'Activar el sonido',
  'tour.film.soundOff': 'Desactivar el sonido',
  'tour.film.watch': 'Ver el video',
  'tour.film.close': 'Cerrar el video',

  'tour.songs.kicker': 'UN SONIDO PARA CADA CANCIÓN',
  'tour.songs.title': 'Canciones que recuerdan cómo te gustan',
  'tour.songs.subtitle': 'Ajústala una vez y suena así siempre',
  'tour.songs.lead':
    'Activa {songSound} y el preset, el Tono y el EQ con que termina una canción vuelven la próxima vez que suene, en la salida en la que la ajustaste.',
  'tour.songs.point1':
    'Cambia el preset, el Tono o una banda mientras suena una canción y eso es lo que guarda. Una canción que nunca tocas no guarda nada.',
  'tour.songs.point2':
    'Vuelve con un aviso que nombra la canción y lo que trae, con {undo} y {forget} ahí mismo.',
  'tour.songs.point3':
    'Cuando la canción termina, vuelve el sonido que tenías antes, y cada salida recuerda el suyo: una misma canción puede sonar de una forma en los auriculares y de otra en los altavoces.',
  'tour.songs.how':
    'Abre el EQ y activa {songSound} en {output}, a la derecha. Pon una canción, elige un preset o gira el Tono, y déjala terminar o sáltala.',
  'tour.songs.open': 'Abrir EQ',
  'tour.songs.imageAlt':
    'Una cola de cuatro canciones que suenan por turnos, tres con el preset y la curva con que se quedaron y una nunca ajustada, y encima el aviso que muestra una canción recordada, con Deshacer y Olvidar esta canción.',

  'tour.deesser.kicker': 'UNA S MÁS SUAVE',
  'tour.deesser.title': 'Un De-esser en el rack DSP',
  'tour.deesser.subtitle': 'Las S agudas, más bajas; los platillos, intactos',
  'tour.deesser.lead':
    '{deEsser} baja las S, T y CH agudas de una voz solo mientras suenan, y deja los platillos, los hi-hats y el resto de los agudos como estaban.',
  'tour.deesser.point1':
    'Encuentra cada S según el nivel propio de la canción, así trata igual una pista suave y una fuerte, y ves cada una que atrapó y cuánto quitó.',
  'tour.deesser.point2':
    'Baja solo las frecuencias de las que está hecha la S, todo lo que hay por encima o la voz entera, y {isolate} reproduce solo lo que quita.',
  'tour.deesser.point3':
    '{speech}, {podcast} y {audiobook} lo activan. Cada filtro del rack ahora puede guardar perfiles propios.',
  'tour.deesser.how':
    'Abre DSP y elige {deEsser} en la lista de la izquierda, o el preset {podcast}. Empieza con un perfil y sube {sensitivity} hasta que atrape cada S.',
  'tour.deesser.open': 'Abrir DSP',
  'tour.deesser.imageAlt':
    'La franja del De-esser pasando: cada S de una voz por encima de la línea donde empieza la etapa, con su recorte colgando debajo en ámbar, y los hi-hats en gris, intactos; arriba la etapa con Espectral elegido y abajo Voz, Pódcast y Audiolibro.',

  'tour.chat.kicker': 'UNA ESCENA CON SOLO PEDIRLA',
  'tour.chat.title': 'Pide un cambio y míralo en el escenario',
  'tour.chat.subtitle': 'Un chat junto al escenario del Estudio',
  'tour.chat.lead':
    'El {studio} ahora tiene un chat junto a su escenario. Di qué debe cambiar —cómo se ve una escena, cómo se mueve con la música, sus colores o su luz— y tu propia IA edita la escena y reproduce cada versión en el escenario sobre la marcha.',
  'tour.chat.point1':
    'Cada respuesta guarda la versión que hizo, y {bringBack} vuelve a poner una anterior. Cada escena guarda sus chats anteriores.',
  'tour.chat.point2':
    '{attach} envía una imagen de la escena con tu mensaje, y puedes dibujar encima para mostrar lo que quieres decir. Los mensajes que envías mientras trabaja esperan en una cola y salen juntos.',
  'tour.chat.point3':
    'Funciona con Claude Code instalado en este equipo, con tu propio plan, y muestra cuánto te queda de tus límites. Con ChatGPT conectado puede pintar imágenes para la escena, y te pregunta antes de cada una.',
  'tour.chat.how':
    'Abre {plus}, elige {studio} en su barra lateral, elige una escena o empieza una y escribe en el cuadro junto al escenario.',
  'tour.chat.open': 'Abrir Plus',
  'tour.chat.imageAlt':
    'El escenario del Estudio junto a su chat: una petición para que las luces del escenario destellen con la caja, los pasos de la respuesta marcándose uno a uno, la versión 2 guardada con Recuperar, y las luces del escenario empezando a destellar cuando suena la versión 2.',
  'tour.chat.ask': 'Haz que las luces del escenario destellen con la caja.',
  'tour.chat.reply':
    'Hecho: los dos focos destellan en blanco con cada golpe de caja y vuelven al rosa.',

  'tour.looks.kicker': 'TU PROPIO ESTILO',
  'tour.looks.title': 'Estilos propios para la gráfica',
  'tour.looks.subtitle': 'Tus formas, tus colores, tu movimiento',
  'tour.looks.lead':
    'El espectro bajo el EQ puede dibujarse como quieras. Elige una de {forms} formas, desde barras LED y neón hasta terrazas, horizontes y torres de cristal; dale su propio coloreado Auto o coloréala por frecuencia, por nivel o por calor; decide con qué rapidez ataca y cuánto se sostiene un pico, y marca los picos con chispas, cometas u ondas expansivas. Guárdalo como un estilo propio y compártelo como archivo.',
  'tour.looks.point1':
    '{forms} formas, cada una con sus controles: piezas, separación, relleno, grosor y si va rellena o trazada.',
  'tour.looks.point2':
    'Pinta cada forma con su propio coloreado Auto, por frecuencia, nivel o calor con un degradado de tus colores, o de un solo color plano.',
  'tour.looks.point3':
    'Ataque y caída fijan el movimiento; los picos iluminados, los picos rellenos y doce marcas de pico deciden cómo se ve un golpe.',
  'tour.looks.point4':
    'El resplandor funciona en todos los modos, y los estilos se exportan a un archivo y se importan desde uno.',
  'tour.looks.how':
    'En la pestaña EQ, pulsa «Nuevo estilo» en la barra de la gráfica. Elige una forma con el selector o pulsa Espacio para recorrerlas, ajusta colores y movimiento mientras suena la música y luego Guardar.',
  'tour.looks.open': 'Abrir EQ',

  'tour.karaoke.kicker': 'UN ESCENARIO EN CASA',
  'tour.karaoke.title': 'Karaoke con guía de afinación',
  'tour.karaoke.subtitle': 'Tus canciones, tus letras, tu micrófono',
  'tour.karaoke.lead':
    'Suelta una canción con o sin archivo de letra y FluidEQ los empareja en una lista, muestra la letra sincronizada sobre la portada o el vídeo, escucha tu micrófono y dibuja tu tono contra la melodía. Todo se queda en este ordenador; el micro nunca se graba ni se reproduce.',
  'tour.karaoke.point1':
    'Un deslizador de Voz guía, una vez que FluidEQ ha separado la voz de la canción en el Creador: va de solo la base al original completo, sin necesitar un archivo instrumental.',
  'tour.karaoke.point2':
    'Una guía de afinación: las notas de la canción como bloques y tu voz como una línea en vivo sobre ellas, con aviso de Alto, Afinado y Bajo.',
  'tour.karaoke.point3':
    'Una revisión de la interpretación al terminar, con las partes que practicar y una cuenta atrás para otro intento.',
  'tour.karaoke.point4':
    'Lee LRC, LRC mejorado con tiempos por palabra y UltraStar con sílabas y tono, sobre MP3, FLAC, WAV, OGG, M4A y más. Con letras traducidas y acordes de guitarra estimados.',
  'tour.karaoke.how':
    'Abre la pestaña Karaoke, pulsa «Abrir canción» o «Añadir carpeta», elige una pista en la lista, activa el micro, muestra la guía de afinación y pulsa Reproducir.',
  'tour.karaoke.open': 'Abrir Karaoke',

  'tour.maker.kicker': 'HAZ EL TUYO',
  'tour.maker.title': 'El Creador de karaoke',
  'tour.maker.subtitle': 'Cualquier canción se vuelve un archivo de karaoke',
  'tour.maker.lead':
    'Un estudio de autoría completo dentro de la pestaña Karaoke. Puede hacer todo el trabajo solo: separar la voz de la música, leer las palabras y sus tiempos con un modelo de voz local y detectar las notas de la melodía. O marcas, grabas y dibujas cada tiempo a mano en una línea de tiempo con zoom. Todo se ejecuta en este ordenador.',
  'tour.maker.point1':
    '«Preparar esta canción automáticamente»: separa la voz y luego lee las palabras y los tiempos, con opción de continuar en segundo plano.',
  'tour.maker.point2':
    'Conserva las pistas separadas: la voz y la pista base, cada una guardable, incluso como MP3.',
  'tour.maker.point3':
    'Herramientas manuales para el detalle: marcar palabras, grabar entradas de línea, un inspector de palabra con inicio y duración, y dividir una palabra en sílabas.',
  'tour.maker.point4':
    'Pinta la melodía en una rejilla de tono, marca notas doradas y exporta como proyecto de FluidEQ, TXT de UltraStar, LRC, LRC mejorado o pista base sin voz.',
  'tour.maker.how':
    'En Karaoke, carga una canción y pulsa «Crear». Acepta «Preparar automáticamente» en el asistente, corrige las palabras en la línea de tiempo y luego «Usar en el reproductor» y «Exportar».',
  'tour.maker.open': 'Abrir Karaoke',

  'tour.media.kicker': 'LA WEB, A TRAVÉS DE TU EQ',
  'tour.media.title': 'Multimedia en línea',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch y Suno',
  'tour.media.lead':
    'Un reproductor integrado para los sitios de streaming, para que lo que ves y escuchas en línea pase por tu EQ en vez de por otro navegador. Hay cinco sitios preparados, cada uno con su buscador, y los enlaces que salen del sitio se detienen con la opción «Abrir en el navegador».',
  'tour.media.point1':
    'Un solo campo de búsqueda que busca en el sitio que esté abierto, con búsquedas recientes que puedes borrar.',
  'tour.media.point2':
    'Inicia sesión una vez: el reproductor guarda tus sesiones entre visitas hasta que las cierres.',
  'tour.media.point3':
    'Reanudar: el reproductor recuerda la última página y por dónde ibas, y te devuelve allí.',
  'tour.media.point4':
    'Descargas con indicador de progreso y «Mostrar en la carpeta» al terminar, y un botón para cerrar sesión, la puerta al final de la barra de herramientas, que borra cada cookie e inicio de sesión de una vez.',
  'tour.media.how':
    'Abre la pestaña Multimedia en línea, elige un sitio de la fila superior, escribe en el campo de búsqueda y pulsa Buscar. Atrás, Adelante y Recargar funcionan como en un navegador.',
  'tour.media.open': 'Abrir Multimedia en línea',
};

export default tour;
