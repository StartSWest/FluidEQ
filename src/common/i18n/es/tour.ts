/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Por favor, contribuye',
  'tour.rainbow.title': 'Te damos la bienvenida al modo arcoíris',
  'tour.rainbow.subtitle': 'Actívalo con un clic',
  'tour.rainbow.lead':
    'Colores del arcoíris, detalles luminosos y un borde que recorre el espectro — y un movimiento más suave: la gráfica, los medidores y la onda se dibujan a la frecuencia completa de tu pantalla en lugar de a treinta fotogramas por segundo. Tu sonido nunca cambia.',
  'tour.rainbow.how':
    'Actívalo aquí al instante, sin llegar a ×10. Tu elección se guarda y puedes desactivarlo cuando quieras. Contribuir es opcional.',
  'tour.rainbow.enable': 'Activar el modo arcoíris',
  'tour.rainbow.disable': 'Desactivar el modo arcoíris',
  'tour.rainbow.waveform': 'Vista previa de la onda superior',
  'tour.rainbow.toggleHint':
    'Haz clic en el interruptor «RAINBOW MODE» de arriba para activarlo o desactivarlo.',
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
    'Un interruptor en la barra de título convierte la ventana en el Reproductor compacto: la canción, tu ecualizador, un visualizador y «A continuación» en una columna estrecha. El mismo interruptor te devuelve a la página que dejaste.',
  'tour.player.point1':
    'Todo el ecualizador te acompaña: presets, diseños de bandas, Modo EQ, EQ inteligente, Graves, Medios y Agudos.',
  'tour.player.point2':
    'Pliégalo en una línea, mantenlo por encima de las demás ventanas o haz doble clic en el visualizador para verlo a pantalla completa.',
  'tour.player.point3':
    'Un tema Claro u Oscuro propio, y las canciones que sueltas en «A continuación» se suman a la Biblioteca y a la cola.',
  'tour.player.how':
    'Pulsa el interruptor del Reproductor compacto en la barra de título, junto a Ayuda. En el reproductor, el mismo interruptor te devuelve a la app completa.',
  'tour.player.open': 'Probar el Reproductor compacto',
  'tour.player.imageAlt':
    'El Reproductor compacto dos veces, con su tema Oscuro y con su tema Claro: la canción y su reloj arriba, el ecualizador con quince bandas, «A continuación» debajo; y el mismo reproductor plegado en una línea.',
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
    'La página Presets de juego con cuatro juegos, cada uno con su propio sonido, y las tarjetas que FluidEQ muestra en el escritorio cuando un juego pasa al frente y cuando se cierra.',
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
    'Publica una escena y, cuando se apruebe, tu próximo mes de Plus es gratis.',
  'tour.studio.point2':
    'Cada escena de un miembro se revisa antes de llegar a la galería.',
  'tour.studio.point3':
    'Todo lo que creaste antes se conserva, en la carpeta que indica el Estudio.',
  'tour.studio.how':
    'Abre Plus y elige Estudio en su barra lateral. Sin Plus, esa página te ofrece la prueba gratuita.',
  'tour.studio.open': 'Abrir Plus',
  'tour.studio.imageAlt':
    'Una aurora sobre montañas creada en el Estudio, la idea de la que nació, la prueba de quince días y el mes que se gana con una escena aprobada.',
  'tour.studio.idea':
    'Aurora boreal sobre un lago de montaña. Los graves hacen crecer la aurora y las estrellas titilan al compás.',
  'tour.studio.earned': 'Aprobada: próximo mes gratis',
  'tour.help.kicker': 'AYUDA',
  'tour.help.title': 'Pregunta a la guía con tus palabras',
  'tour.help.subtitle': 'Erratas, plurales y diez idiomas',
  'tour.help.lead':
    'Busca en la guía como se lo preguntarías a un amigo — «no hay sonido», «limitador», «fondo de pantalla» — en cualquiera de diez idiomas. El mejor capítulo aparece primero, y la guía te lleva al control, rodeado con un círculo en la imagen.',
  'tour.help.point1':
    'Perdona las erratas y los plurales, y conoce las palabras que la gente usa para las cosas.',
  'tour.help.point2':
    'Cada control de una imagen va numerado como en un manual impreso, y las imágenes siguen tu tema.',
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
    'Un solo selector para todo: 28 estilos gratuitos que puedes moldear y colorear, y los visualizadores Plus por categorías.',
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

  'tour.theme.kicker': 'UN NUEVO ASPECTO',
  'tour.theme.title': 'Conoce el tema Oscuro',
  'tour.theme.subtitle': 'Casi negro, para las noches y las pantallas OLED',
  'tour.theme.lead':
    'FluidEQ tiene ahora una segunda cara. Oscuro elimina todo rastro del azul pizarra con el que nació la app: paneles, menús y barras pasan a monocromo, el acento se mantiene y el espectro es el único color de la sala.',
  'tour.theme.point1':
    'Fondos casi negros: en una pantalla OLED, el espacio alrededor de la gráfica queda casi a oscuras.',
  'tour.theme.point2':
    'Todas las páginas lo siguen: menús, diálogos, el escenario de karaoke y la Biblioteca cambian a la vez. El Reproductor compacto tiene su propio tema.',
  'tour.theme.point3':
    'Tu color de acento y el modo arcoíris se conservan. Tu sonido no cambia nada: solo la pintura.',
  'tour.theme.howTitle': 'Cómo cambiarlo',
  'tour.theme.how':
    'Abre el menú del icono de pulso en la esquina superior derecha y elige Oscuro junto a Tema, en los ajustes al pie del menú. Claro queda a un clic si quieres volver.',
  'tour.theme.tryBlack': 'Cambiar a Oscuro ahora',
  'tour.theme.tryOcean': 'Volver a Claro',
  'tour.theme.imageAlt':
    'FluidEQ con el tema Oscuro: la pestaña EQ con quince bandas y el espectro en vivo reproduciendo una canción.',

  'tour.share.kicker': 'ESCUCHA TODOS TUS PC',
  'tour.share.title': 'Comparte audio entre tus ordenadores',
  'tour.share.subtitle': 'Unos auriculares, todas las máquinas de tu mesa',
  'tour.share.lead':
    'Tu PC de juegos, el portátil del trabajo y el equipo multimedia suenan en los auriculares que llevas puestos: por tu propia red, sin pérdidas, cifrado y a través del EQ que ya tienes ajustado.',
  'tour.share.receiverLabel': 'RECEPTOR',
  'tour.share.receiverName': 'El PC con tus auriculares',
  'tour.share.senderLabel': 'EMISORES',
  'tour.share.senderName': 'Los demás ordenadores',
  'tour.share.wireLabel': 'Sin pérdidas · Cifrado · LAN privada',
  'tour.share.stepsTitle': 'Configúralo en tres pasos',
  'tour.share.step1Title': 'En el PC de los auriculares, crea un código',
  'tour.share.step1':
    'Abre la pestaña Compartir audio, elige «Reproducir audio en este ordenador» y pulsa «Crear código de conexión». Copia el código de tu red.',
  'tour.share.step2Title': 'En cada otro PC, pégalo',
  'tour.share.step2':
    'Abre FluidEQ allí, ve a Compartir audio, elige «Enviar el audio de este ordenador», pega el código y pulsa «Conectar y enviar». Su audio del sistema empieza a fluir, intacto: los efectos se aplican en el ordenador en el que escuchas.',
  'tour.share.step3Title': 'Escucha y ajusta el nivel',
  'tour.share.step3':
    'Los emisores suenan con un búfer corto que se pone al día por sí solo tras un corte. Cada emisor se mezcla en la salida del receptor y pasa por su EQ. La barra de reproducción del receptor muestra la canción del último emisor, y sus botones funcionan a través de la red.',
  'tour.share.fact1Title': 'Sin pérdidas',
  'tour.share.fact1':
    'PCM Float32 de extremo a extremo. Sin códec, sin pérdida de generación.',
  'tour.share.fact2Title': 'Cifrado',
  'tour.share.fact2':
    'AES-256-GCM en cada paquete. El código es la clave; sin él nadie puede escuchar.',
  'tour.share.fact3Title': 'Emparejamiento fijo',
  'tour.share.fact3':
    'El emparejamiento sobrevive a cierres y reinicios. Solo crear un código nuevo lo desconecta.',
  'tour.share.tip':
    'Empieza bajito: varios ordenadores suman rápido. Baja el volumen de los auriculares antes de la primera conexión.',
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
    'Usa el selector de perfil de EQ bajo ese dispositivo para elegir uno de sus perfiles guardados. La salida principal conserva su ajuste.',
  'tour.output.point3':
    'Un solo reproductor: iniciar algo en FluidEQ pausa el resto de la máquina, y al revés.',
  'tour.output.point4':
    'Juego/Vídeo empieza con unos 30 ms de reserva y se resincroniza tras una interrupción; Música empieza con unos 100 ms para una escucha más fluida. El búfer del dispositivo añade retardo.',
  'tour.output.how':
    'Abre la pestaña EQ y despliega Segunda salida a la derecha. Activa un dispositivo, elige su perfil de EQ bajo el nombre, ajusta el volumen y selecciona Juego/Vídeo o Música.',
  'tour.output.open': 'Abrir EQ',
  'tour.output.imageAlt':
    'El panel Segunda salida con unos BlackShark V2 Pro activados, su selector de perfil de EQ, el volumen y los modos Juego/Vídeo y Música.',

  'tour.looks.kicker': 'TU PROPIO ESTILO',
  'tour.looks.title': 'Estilos propios para la gráfica',
  'tour.looks.subtitle': 'Veintiocho formas, tus colores, tu movimiento',
  'tour.looks.lead':
    'El espectro bajo el EQ puede dibujarse como quieras. Elige una de veintiocho formas, desde barras y líneas sencillas hasta terrazas, horizontes y un puente nocturno con tráfico; dale su propio coloreado Auto o coloréala por frecuencia, por nivel o por calor; decide con qué rapidez ataca y cuánto se sostiene un pico, y marca los picos con chispas, cometas u ondas expansivas. Guárdalo como un estilo propio y compártelo como archivo.',
  'tour.looks.point1':
    'Veintiocho formas, cada una con sus controles: piezas, separación, relleno, grosor y si va rellena o trazada.',
  'tour.looks.point2':
    'Pinta cada forma con su propio coloreado Auto, por frecuencia, nivel o calor con un degradado de tus colores, o de un solo color plano.',
  'tour.looks.point3':
    'Ataque y caída fijan el movimiento; los picos iluminados, los picos rellenos y doce marcas de pico deciden cómo se ve un golpe.',
  'tour.looks.point4':
    'El resplandor funciona en todos los modos, y el modo arcoíris añade un borde que recorre toda la rueda de color. Los estilos se exportan a un archivo y se importan desde uno.',
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
