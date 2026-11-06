/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dinámica: pasajes suaves y fuertes',
  'help.dynamics.intro':
    'Dinámica es un compresor de tres bandas: eleva los pasajes suaves y contiene los fuertes sin añadir retardo. Sirve para música, películas, voz y el sonido de cada juego.',
  'help.dynamics.steps':
    'Abre DSP → Dinámica, activa la etapa y elige un preset. Los de uso diario están aquí; los de juegos, en Gaming Lab.\nLas bandas cubren graves por debajo de 150 Hz, medios de 150 Hz a 4 kHz y agudos por encima de 4 kHz. Ajusta la que contiene el sonido que quieres cambiar.\nEn Subir, Por debajo de fija cuándo subir el sonido suave, Proporción cuánto y Hasta limita la ganancia. Una relación 1:1 no lo cambia.\nEn Contener, Por encima de fija cuándo reducir el sonido fuerte y Proporción con qué intensidad. Bajar el umbral hace que actúe más a menudo.\nAjusta Ataque y Liberación para la respuesta, Mezcla para mezclar con el original y Compensación para el nivel final. Compara a un volumen parecido.\nEl gráfico muestra el sonido antes y después y la ganancia aplicada: hacia arriba eleva, hacia abajo contiene. Un aviso de actualización del motor puede afectar solo a la visualización en directo; el procesamiento ya puede estar funcionando.',
  'help.dynamics.tip':
    'Elevar mucho también acerca el ruido de fondo. Reduce la mezcla si quieres conservar más movimiento del original.',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': 'De-esser: suavizar las voces estridentes',
  'help.deesser.intro':
    'Reduce las S, T y SH fuertes solo cuando aparecen. Sus cuatro grupos controlan qué escucha, qué reduce, la rapidez y dónde actúa en el estéreo.',
  'help.deesser.steps':
    'Abre DSP → De-esser, activa la etapa y prueba un preset mientras suena una voz con sibilancia.\nEn Encontrar, coloca las frecuencias inferior y superior alrededor del sonido molesto. Sube Sensibilidad hasta detectarlo sin reaccionar a cada nota brillante.\nEn Reducir, Espectral sigue las frecuencias problemáticas y Agudos baja la banda alta. Voz entera reduce todo el sonido y está pensado para una voz aislada. Ajusta la reducción máxima y el ancho donde esté disponible.\nEn Tiempos, ajusta cómo captura el inicio y recupera los agudos. En Dónde, Centro se centra en la voz del centro y Respetar platillos protege los golpes brillantes.\nActiva Aislar para oír solo lo que se retira y desactívalo para juzgar la grabación completa. El gráfico sigue el control que estás ajustando.\nGuarda un ajuste útil en la barra de presets de la etapa. Si quieres conservar la combinación completa, guarda también la cadena: elegir otra puede sustituir varias etapas.',
  'help.deesser.tip':
    'Si la voz cecea o la música pierde aire, baja la sensibilidad o la reducción máxima. Procesa la reproducción, no el micrófono.',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': 'Normalizador y control de nivel en directo',
  'help.normalizer.intro':
    'Ajusta el nivel de entrada antes de las etapas creativas. Los archivos de Biblioteca pueden analizarse completos; el resto del audio se aprende mientras suena.',
  'help.normalizer.steps':
    'Elige Apagado, Pico real o Sonoridad en DSP → Normalizador. Pico real reduce los picos sin amplificar. Sonoridad toma como referencia los pasajes de tres segundos más intensos; los clips cortos usan la sonoridad integrada.\nEspera a que termine el análisis de la Biblioteca y revisa la sonoridad de primer plano, la ganancia aplicada y el límite indicado. La sonoridad integrada sigue midiendo toda la pista por separado.\nEn vivo aprende durante la reproducción y puede ajustar la ganancia al llegar un pasaje más fuerte. Los pasajes suaves conservan su nivel relativo, por lo que la media de toda la pista puede variar. El margen de pico y el límite de amplificación pueden impedir alcanzar el objetivo.',
  'help.normalizer.tip':
    'No es la normalización automática del panel izquierdo, que protege el margen del EQ, ni Master, que ajusta la salida final. Ninguno repara distorsión ya grabada.',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title': 'Fundido cruzado y curvas de transición propias',
  'help.crossfade.intro':
    'Solapa canciones consecutivas de Biblioteca. Es una opción de reproducción independiente de los filtros; no hace transiciones entre otras apps ni en Karaoke.',
  'help.crossfade.steps':
    'Pon al menos dos canciones en la cola de Biblioteca. En DSP, elige Fundido cruzado bajo las opciones de reproducción y actívalo.\nAjusta la duración y elige potencia constante, suave o lineal. Deja que termine la primera canción para escuchar el solapamiento.\nElige Personalizada y arrastra los puntos de las curvas de salida y entrada. También puedes enfocarlos y usar las flechas del teclado.\nObserva ambas curvas y su suma: mantener las dos altas puede subir el volumen de la transición.\nGuardar curva conserva la forma con un nombre; selecciónala después en la lista guardada. Restablecer forma devuelve la forma editable a su estado inicial.',
  'help.crossfade.tip':
    'Si los controles no están disponibles, inicia una pista de audio de Biblioteca. La curva cambia la transición, no el EQ de las canciones.',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': 'Filtro Juego: pasos, entorno y voces',
  'help.gamefilter.intro':
    'Cada juego tiene controles propios para las señales suaves, el ambiente y el diálogo. Empieza con su perfil y ajusta su copia mientras escuchas.',
  'help.gamefilter.steps':
    'Abre Gaming Lab, selecciona un juego y prueba su sonido si aún no está cargado. Elige Juego entre sus partes.\nSube los pasos para acercar pisadas, recargas y puertas suaves. Calm contiene los eventos fuertes que distraen; compara antes de exagerar ambos controles.\nLa opción de cascos y pasos pesados añade el peso grave de botas, caballos y vehículos. Déjala apagada si engorda demasiado las señales.\nEntorno baja o sube el fondo del juego. Deja de actuar cuando sobresale un paso u otro sonido definido para no bajarlo junto con el ambiente.\nDiálogo acerca una voz centrada. La opción de hacer espacio baja un poco el resto mientras alguien habla.\nUsa el aislamiento para oír qué cambia y vuelve a la mezcla completa. Guardar como perfil conserva el ajuste para otros juegos; restablecer recupera el perfil de partida.',
  'help.gamefilter.tip':
    'Un juego con audio 3D propio puede usar un perfil que mantenga Room apagado para no posicionar dos veces. Room es para auriculares. Al descargar el sonido del juego vuelve el de tu música.',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': 'Recordar el sonido de cada canción',
  'help.songs.intro':
    'Cada canción puede recordar su preset, Tone y EQ por dispositivo de salida. Lo que ajustas con auriculares no cambia la memoria de los altavoces.',
  'help.songs.steps':
    'Bajo los perfiles de la salida, activa Recordar el sonido de cada canción. Al principio está desactivado.\nReproduce una canción identificable y cambia su preset, Tone o EQ. Un aviso confirma que se guardará; usa la acción de no guardar si solo estabas probando.\nAl volver a sonar en la misma salida, se carga temporalmente su ajuste. Deshacer lo omite esta vez; Olvidar esta canción también borra la memoria.\nAl terminar vuelve el sonido anterior de la salida. Elegir otro perfil te devuelve el control de forma explícita.\nSmart EQ tiene su propio control para guardar esta canción mientras mide. Conserva la corrección medida y es independiente de recordar tus ajustes manuales.',
  'help.songs.tip':
    'La identidad viene del archivo o de la información del reproductor. Los títulos ausentes o incorrectos pueden impedir reconocer la canción. El preamplificador no se guarda; un juego cargado tiene prioridad.',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': 'Mis curvas: importar, editar y compartir',
  'help.mycurves.intro':
    'Tu colección de curvas está junto a la biblioteca de mediciones. Guarda una curva, revisa su respuesta y elige si se aplica como corrección o como bandas editables.',
  'help.mycurves.steps':
    'Abre EQ Presets → Mis curvas. Busca u ordena la lista para encontrar una curva.\nAñadir curva acepta tu EQ actual, texto, un archivo o una medición de la biblioteca. Importar desde Squiglink acepta su exportación de EQ. Revisa la vista previa antes de guardar.\nAplicar como curva añade una capa sin sustituir tus bandas. Aplicar como EQ reemplaza las bandas del oído seleccionado tras confirmar; el destino permite ambos oídos, izquierdo o derecho.\nEl menú de cada curva permite renombrar, editar bandas, duplicar, copiar como texto o borrar. No hace falta volver a importarla para editarla.\nExportar lista e Importar lista trasladan la colección entre equipos. Conserva claros el modelo y el autor de la medición al compartirla.',
  'help.mycurves.tip':
    'Una curva describe una respuesta en frecuencia; un perfil de salida también conserva el resto del sonido de ese dispositivo. Comprueba el modelo y la fuente antes de corregirlo.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
