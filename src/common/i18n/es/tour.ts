/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
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
  'tour.rail.new': 'NUEVO EN ESTA VERSIÓN',
  'tour.rail.always': 'TAMBIÉN EN FLUIDEQ',
  'tour.newBadge': 'NUEVO',
  'tour.howTitle': 'Cómo empezar',

  'tour.theme.kicker': 'UN NUEVO ASPECTO',
  'tour.theme.title': 'Conoce el tema Negro',
  'tour.theme.subtitle': 'Negro puro, para las noches y las pantallas OLED',
  'tour.theme.lead':
    'FluidEQ tiene ahora una segunda cara. Negro elimina todo rastro del azul pizarra con el que nació la app: paneles, menús y barras pasan a monocromo, el acento se mantiene y el espectro es el único color de la sala.',
  'tour.theme.point1':
    'Fondos negro puro: en una pantalla OLED los píxeles alrededor de la gráfica se apagan.',
  'tour.theme.point2':
    'Todas las ventanas lo siguen: menús, diálogos, el escenario de karaoke y la Biblioteca cambian a la vez.',
  'tour.theme.point3':
    'Tu color de acento y el modo arcoíris se conservan. Tu sonido no cambia nada: solo la pintura.',
  'tour.theme.howTitle': 'Cómo cambiarlo',
  'tour.theme.how':
    'Abre el menú del icono de pulso en la esquina superior derecha y elige Tema → Negro. Océano queda a un clic si quieres volver.',
  'tour.theme.tryBlack': 'Cambiar a Negro ahora',
  'tour.theme.tryOcean': 'Volver a Océano',
  'tour.theme.imageAlt':
    'FluidEQ con el tema Negro: la pestaña EQ con quince bandas y el espectro en vivo reproduciendo una canción.',

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
    'Abre FluidEQ allí, ve a Compartir audio, elige «Enviar el audio de este ordenador», pega el código y pulsa «Conectar y enviar». Su audio del sistema empieza a fluir.',
  'tour.share.step3Title': 'Elige una prioridad y escucha',
  'tour.share.step3':
    'Música mantiene un búfer mayor para escuchar sin cortes; Juego/Vídeo funciona con el menor retardo para la sincronía labial. Cada emisor se mezcla en la salida del receptor y pasa por su EQ. La barra de reproducción del receptor muestra la canción de cada emisor y sus botones funcionan a través de la red.',
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
    'Señala una carpeta y FluidEQ lee cada canción y vídeo que contiene, con etiquetas y portadas, y los convierte en una colección que recorres por álbum, artista, género, canción o carpeta. La reproducción pasa por el propio reproductor de FluidEQ, así que el EQ y la cadena DSP están siempre en el camino.',
  'tour.library.point1':
    'Tres formas de ver el mismo estante: lista, cuadrícula y cover flow, con salto a una letra para colecciones grandes.',
  'tour.library.point2':
    'Una cola de «A continuación» con «Seguir reproduciendo», que continúa con más del mismo género cuando la lista se acaba.',
  'tour.library.point3':
    'Listas de reproducción y una lista de Favoritos permanente. Clic derecho en cualquier canción para añadirla a una u otra, o a la cola.',
  'tour.library.point4':
    'Memoria de EQ por canción: activa «Guardar para esta canción» mientras suena y la corrección que hagas se recuerda para ese tema.',
  'tour.library.how':
    'Abre la pestaña Biblioteca, pulsa «Añadir carpeta» o suelta una carpeta en la página y espera a «Canciones añadidas». Elige Álbumes, Artistas, Géneros, Canciones, Carpetas o Árbol y pulsa Reproducir.',
  'tour.library.open': 'Abrir Biblioteca',

  'tour.dsp.kicker': 'UN RACK DE MASTERIZACIÓN',
  'tour.dsp.title': 'El rack DSP',
  'tour.dsp.subtitle': 'Nueve etapas, cada una con su gráfica',
  'tour.dsp.lead':
    'Todo lo que reproduce la Biblioteca puede pasar por un rack de etapas de estudio, en orden: Normalizador, Denoise, Exciter, Bass Forge, Ecualizador, Bass Punch, Dimension, Maximizador y Master, más un crossfade entre pistas. Cada etapa es una tarjeta con gráfica en vivo, presets y un botón Aislar para oír solo lo que hace.',
  'tour.dsp.point1':
    'Denoise repara la propia grabación: siseo, zumbido, clics y un limpiador de voz neuronal, medidos a partir de un análisis de la pista.',
  'tour.dsp.point2':
    'Bass Forge añade una octava real por debajo del bajo; Bass Punch moldea su ataque, sostenido, bloom y duck.',
  'tour.dsp.point3':
    'Un Ecualizador paramétrico de quince bandas con fase mínima o lineal, mid/side, sobremuestreo y decenas de presets con nombre.',
  'tour.dsp.point4':
    'Master con objetivo de sonoridad LUFS y protección true-peak, presets de entrega de Streaming a Vinilo, y un ajuste de ganancia para comparar sonido, no volumen.',
  'tour.dsp.how':
    'Reproduce una pista de la Biblioteca, abre la pestaña DSP, elige una cadena en Presets, luego haz clic en una etapa en las pestañas laterales y actívala.',
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
    'Un reproductor a la vez: iniciar algo en FluidEQ pausa el resto de la máquina, y al revés.',
  'tour.output.point4':
    'Juego/Vídeo empieza con unos 30 ms de reserva y se resincroniza tras una interrupción; Música empieza con unos 100 ms para una escucha más fluida. El búfer del dispositivo añade retardo.',
  'tour.output.how':
    'Abre la pestaña EQ y despliega Segunda salida a la derecha. Activa un dispositivo, elige su perfil de EQ bajo el nombre, ajusta el volumen y selecciona Juego/Vídeo o Música.',
  'tour.output.open': 'Abrir EQ',
  'tour.output.imageAlt':
    'El panel Segunda salida con unos BlackShark V2 Pro activados, su selector de perfil de EQ, el volumen y los modos Juego/Vídeo y Música.',

  'tour.looks.kicker': 'TU PROPIO VISUALIZADOR',
  'tour.looks.title': 'Estilos propios para la gráfica',
  'tour.looks.subtitle': 'Cincuenta y siete formas, tus colores, tu movimiento',
  'tour.looks.lead':
    'El espectro bajo el EQ puede dibujarse como quieras. Elige una de cincuenta y siete formas, desde barras y líneas hasta crestas, seda, skyline y matriz de puntos; coloréala plana, por frecuencia, por nivel o por calor; decide con qué rapidez ataca y cuánto se sostiene un pico, y marca los picos con chispas, cometas, halos o coronas. Guárdalo como un estilo propio y compártelo como archivo.',
  'tour.looks.point1':
    'Cincuenta y siete formas, cada una con sus controles: piezas, hueco, relleno, grosor y si va rellena o trazada.',
  'tour.looks.point2':
    'Color por frecuencia, nivel o calor con una rampa de tus propios colores, o un solo color plano.',
  'tour.looks.point3':
    'Ataque y liberación fijan el movimiento; los picos encendidos y dieciocho marcas de pico deciden cómo se ve un golpe.',
  'tour.looks.point4':
    'El modo arcoíris añade un brillo al ritmo y un borde que recorre toda la rueda de color. Los estilos se exportan a un archivo y se importan desde uno.',
  'tour.looks.how':
    'En la pestaña EQ, pulsa «Nuevo estilo» en la barra de la gráfica. Elige una forma con el selector o pulsa Espacio para recorrerlas, ajusta colores y movimiento mientras suena la música y luego Guardar.',
  'tour.looks.open': 'Abrir EQ',

  'tour.karaoke.kicker': 'UN ESCENARIO EN CASA',
  'tour.karaoke.title': 'Karaoke con guía de tono',
  'tour.karaoke.subtitle': 'Tus canciones, tus letras, tu micrófono',
  'tour.karaoke.lead':
    'Suelta una canción con o sin archivo de letra y FluidEQ los empareja en una lista, muestra la letra sincronizada sobre la portada o el vídeo, escucha tu micrófono y dibuja tu tono contra la melodía. Todo se queda en este ordenador; el micro nunca se graba ni se reproduce.',
  'tour.karaoke.point1':
    'Un deslizador de Voz guía que va del original a solo la base, quitando la voz principal sin necesitar otro archivo.',
  'tour.karaoke.point2':
    'Un carril de tono en vista Notas o Curva: las notas de la canción como bloques, tu voz como una línea en vivo, con aviso de Alto, Afinado y Bajo.',
  'tour.karaoke.point3':
    'Una revisión de la actuación al terminar, con las partes que practicar y una cuenta atrás para otro intento.',
  'tour.karaoke.point4':
    'Lee LRC, LRC mejorado con tiempos por palabra y UltraStar con sílabas y tono, sobre MP3, FLAC, WAV, OGG, M4A y más. Con letras traducidas y acordes de guitarra estimados.',
  'tour.karaoke.how':
    'Abre la pestaña Karaoke, pulsa «Abrir canción» o «Añadir carpeta», elige una pista en la lista, activa el micro, muestra la guía de tono y pulsa Reproducir.',
  'tour.karaoke.open': 'Abrir Karaoke',

  'tour.maker.kicker': 'HAZ EL TUYO',
  'tour.maker.title': 'El Creador de Karaoke',
  'tour.maker.subtitle': 'Cualquier canción se vuelve un archivo de karaoke',
  'tour.maker.lead':
    'Un estudio de autoría completo dentro de la pestaña Karaoke. Puede hacer todo el trabajo solo: separar la voz de la música, leer las palabras y sus tiempos con un modelo de voz local y detectar las notas de la melodía. O marcas, grabas y dibujas cada tiempo a mano en una línea de tiempo con zoom. Todo se ejecuta en este ordenador.',
  'tour.maker.point1':
    '«Configurar esta canción automáticamente»: separa la voz y luego lee las palabras y los tiempos, con opción de continuar en segundo plano.',
  'tour.maker.point2':
    'Conserva las pistas separadas: la voz y la base, cada una guardable, incluso como MP3.',
  'tour.maker.point3':
    'Herramientas manuales para el detalle: marcar palabras, grabar entradas de línea, un inspector de palabra con inicio y duración, y dividir una palabra en sílabas.',
  'tour.maker.point4':
    'Pinta la melodía en una rejilla de tono, marca notas doradas y exporta como proyecto FluidEQ, UltraStar TXT, LRC, LRC mejorado o base sin voz.',
  'tour.maker.how':
    'En Karaoke, carga una canción y pulsa «Crear». Acepta «Configurar automáticamente» en el asistente, corrige las palabras en la línea de tiempo y luego «Usar en el reproductor» y «Exportar».',
  'tour.maker.open': 'Abrir Karaoke',

  'tour.media.kicker': 'LA WEB, A TRAVÉS DE TU EQ',
  'tour.media.title': 'Medios en línea',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch y Suno',
  'tour.media.lead':
    'Un reproductor integrado para los sitios de streaming, para que lo que ves y escuchas en línea pase por tu EQ en vez de por otro navegador. Hay cinco sitios preparados, cada uno con su buscador, y los enlaces que salen del sitio se detienen con la opción «Abrir en el navegador».',
  'tour.media.point1':
    'Un solo campo de búsqueda que busca en el sitio que esté abierto, con búsquedas recientes que puedes borrar.',
  'tour.media.point2':
    '«Bloquear anuncios» salta los anuncios de vídeo y oculta los espacios publicitarios en YouTube.',
  'tour.media.point3':
    'Reanudar: el reproductor recuerda la última página y por dónde ibas, y te devuelve allí.',
  'tour.media.point4':
    'Descargas con indicador de progreso y «Mostrar en la carpeta» al terminar, y un botón «Cerrar sesión en todos los sitios» que borra cada cookie e inicio de sesión de una vez.',
  'tour.media.how':
    'Abre la pestaña Medios en línea, elige un sitio de la fila superior, escribe en el campo de búsqueda y pulsa Buscar. Atrás, Adelante y Recargar funcionan como en un navegador.',
  'tour.media.open': 'Abrir Medios en línea',
};

export default tour;
