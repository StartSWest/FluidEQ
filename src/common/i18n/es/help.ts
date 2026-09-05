/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.share.title': 'Comparte audio entre ordenadores',
  'help.share.intro':
    'Compartir audio envía el sonido del sistema entre ordenadores de la misma red privada. El receptor tiene los auriculares o altavoces; los demás son emisores. Es distinto de duplicar a un segundo dispositivo del mismo ordenador.',
  'help.share.steps':
    'En el ordenador de escucha, abre Compartir audio, elige Reproducir audio en este ordenador y crea un código. Empieza con poco volumen.\nEn cada origen, elige Enviar el audio de este ordenador, pega el código del receptor y conecta. Mantén FluidEQ abierto en ambos.\nRevisa el monitor y detén el envío o la escucha al terminar. Si falla, comprueba la red privada compartida y el permiso del cortafuegos.',
  'help.share.tip':
    'El código autoriza el emparejamiento: mantenlo privado. Varios emisores se mezclan y pueden elevar el nivel. El audio recibido no pasa por el rack DSP de Biblioteca.',
  'help.menu': 'Ayuda',
  'help.title': 'Guía de usuario',
  'help.subtitle': 'Encuentra tu sonido. Siéntete como en casa.',
  'help.intro':
    'Una guía práctica de FluidEQ con capturas reales. Empieza por tu primera sesión y explora cada espacio a tu ritmo.',
  'help.offline': 'Disponible sin conexión',
  'help.search': 'Buscar en la guía',
  'help.searchHint': 'Prueba perfiles, graves, letras…',
  'help.contents': 'En esta guía',
  'help.results': '{count} capítulos',
  'help.empty':
    'No hay resultados. Prueba una frase más corta o borra la búsqueda.',
  'help.clear': 'Borrar búsqueda',
  'help.close': 'Cerrar guía',
  'help.enlarge': 'Ampliar captura: {title}',
  'help.closeImage': 'Cerrar captura',
  'help.captureNote':
    'Capturas reales de FluidEQ 1.6.x. Los colores, nombres y posiciones pueden variar en tu versión. Los ajustes son ejemplos, no presets recomendados.',
  'help.steps': 'Pruébalo',
  'help.tip': 'Conviene saber',
  'help.back': 'Volver arriba',
  'help.start.title': 'Tus primeros cinco minutos',
  'help.start.intro':
    'Empieza con una canción conocida y un volumen cómodo. A la izquierda están la EQ del sistema y el margen; en el centro, el espacio de trabajo; a la derecha, la salida y sus perfiles. El transporte está abajo.',
  'help.start.steps':
    'En Windows, instala Equalizer APO cuando lo ofrezca el instalador, marca tu dispositivo en su selector y reinicia cuando se solicite.\nElige ese dispositivo en Dispositivo de salida. Activa EQ del sistema y deja Normalizar automáticamente activado.\nReproduce una canción, abre EQ → Bandas, cambia algo ligeramente y compara activando y desactivando EQ del sistema.',
  'help.start.tip':
    'La EQ del sistema requiere Windows y Equalizer APO. macOS y Linux muestran dispositivos de demostración: un gráfico en movimiento no demuestra procesamiento del sistema.',
  'help.eq.title': 'Moldea el sonido con EQ',
  'help.eq.intro':
    'Frecuencia elige dónde actúa una banda; Ganancia, cuánto sube o baja; Q, su anchura: una Q mayor es más estrecha. Los graves aportan cuerpo, los medios contienen buena parte de la voz y los agudos añaden brillo.',
  'help.eq.steps':
    'Selecciona una banda en EQ → Bandas. Ajusta frecuencia, ganancia y Q, o arrastra su punto en el gráfico.\nEmpieza con una banda ancha y suave; compara antes de añadir otra. El selector de filtro cambia la forma, incluidos pico y estanterías.\nCompara las capas de auriculares, EQ, voicing y Smart EQ con sus interruptores e intensidades. Mantén la normalización automática al aumentar ganancias.',
  'help.eq.tip':
    'La curva representa filtros; el espectro móvil representa la señal medida. Smart EQ necesita audio para medir. Detail, Balance y Target corrigen de maneras distintas: compara un modo cada vez.',
  'help.headphones.title': 'Corrección de auriculares e importación',
  'help.headphones.intro':
    'La corrección compensa un modelo medido y sirve de punto de partida junto a tus bandas y voicing. Comprueba el modelo exacto y el autor de la medición.',
  'help.headphones.steps':
    'Abre EQ → Presets de EQ, busca tus auriculares y elige la medición correspondiente.\nPara texto de otra herramienta, usa Importar ajustes de EQ en Acciones de audio. Revisa las bandas y la curva antes de aplicar.\nEn Squiglink, exporta el texto de EQ, pégalo en el panel y pulsa Aplicar EQ importada cuando la vista previa sea correcta.',
  'help.headphones.tip':
    'Una vista previa marcada como no aplicada no cambia el sonido. Evita acumular dos correcciones completas del mismo auricular por accidente; compara apagando la capa de auriculares.',
  'help.convolution.title': 'Usa una respuesta al impulso',
  'help.convolution.intro':
    'Convolución aplica un impulso WAV como otra capa de corrección. Puedes buscar en el catálogo AutoEq o importar tu WAV; las bandas paramétricas siguen siendo independientes.',
  'help.convolution.steps':
    'Abre EQ → Convolución y busca el modelo o autor.\nRevisa la fuente y frecuencia de muestreo; pulsa Descargar y aplicar o Importar un WAV para un archivo local.\nCompara con la capa activada y desactivada. Ajusta su intensidad antes de tocar otras capas.',
  'help.convolution.tip':
    'Para Equalizer APO, la frecuencia de muestreo del impulso debe coincidir con la salida. Descargar del catálogo requiere conexión; esta guía no.',
  'help.profiles.title': 'Dispositivos, perfiles y segunda salida',
  'help.profiles.intro':
    'La EQ sigue al dispositivo de salida. El mapeo automático guarda los cambios en la salida actual; los perfiles con nombre conservan sonidos alternativos. Segunda salida duplica el audio con un nivel por dispositivo.',
  'help.profiles.steps':
    'Confirma la salida antes de editar. Nuevo perfil conserva un sonido; Actualizar guarda sus cambios y Restaurar recupera los ajustes guardados.\nAbre Segunda salida, activa un dispositivo accesible y ajusta su nivel. En versiones actuales puedes elegir su perfil de EQ debajo.\nElige Juego/Vídeo para una reserva inicial menor o Música para más margen. Comprueba la sincronización real.',
  'help.profiles.tip':
    'Cada salida duplicada de Windows utiliza su perfil APO. La duplicación necesita FluidEQ abierto y se detiene al cambiar la salida principal. La latencia del dispositivo también cuenta.',
  'help.config.title': 'Inspecciona y respalda una cadena',
  'help.config.intro':
    'EQ → Config muestra lo que Equalizer APO tiene realmente en disco. Sus salidas y árbol de inclusiones permiten comprobar dispositivos y capas. Exporta antes de experimentar o mover una configuración.',
  'help.config.steps':
    'Abre EQ → Config y selecciona la salida. Lee su estado y capas activas.\nUsa Exportar cadena para guardar un archivo .fluideq en un lugar fácil de encontrar.\nPara recuperarlo, selecciona primero la salida correcta, usa Importar cadena y revisa el resultado.',
  'help.config.tip':
    'Los archivos de capas generados se reescriben al cambiar ajustes. Los comandos APO manuales duraderos deben ir en el archivo personalizado de cada salida que FluidEQ deja intacto.',
  'help.online.title': 'Escucha con Medios en línea',
  'help.online.intro':
    'Medios en línea mantiene los sitios compatibles junto a la EQ. Reproducción e inicio de sesión dependen del proveedor y de tu conexión. El transporte inferior sigue al reproductor activo.',
  'help.online.steps':
    'Abre Medios en línea, elige un sitio y reproduce algo en su página.\nCambia a EQ para ajustar mientras escuchas; vuelve a la página para sus controles propios.\nActiva Un reproductor a la vez para que FluidEQ y otros reproductores se pausen mutuamente.',
  'help.online.tip':
    'El rack DSP procesa pistas de audio de Biblioteca, no Medios en línea. En Windows, la EQ del sistema puede seguir afectando a la salida habilitada para APO.',
  'help.library.title': 'Crea tu biblioteca local',
  'help.library.intro':
    'Biblioteca reúne música y vídeo de tus unidades. Explora álbumes, artistas, canciones, carpetas o vídeos. Las portadas y metadatos proceden de los archivos.',
  'help.library.steps':
    'Abre Biblioteca y añade tu carpeta de medios. Espera a que termine la indexación.\nElige un artista o álbum, o busca una canción y reprodúcela.\nUsa el transporte inferior para pausar, desplazarte, saltar y ajustar volumen desde cualquier pestaña.',
  'help.library.tip':
    'Biblioteca necesita los archivos originales. Si desconectas una unidad o mueves una carpeta, reconéctala o añade la nueva ubicación.',
  'help.queue.title': 'Álbumes y cola de reproducción',
  'help.queue.intro':
    'La cola define el orden de escucha. Abrir otro álbum permite explorar sin convertirlo en la canción actual. La pista activa y A continuación te ayudan a orientarte.',
  'help.queue.steps':
    'Abre un álbum y reproduce la pista que quieras.\nEn el menú de una pista, elige reproducir después o añadir a la cola.\nRevisa A continuación y usa aleatorio o repetición para cambiar el orden.',
  'help.queue.tip':
    'Iniciar Biblioteca toma el relevo de los otros reproductores de FluidEQ. El transporte identifica la pista y fuente activas.',
  'help.dsp.title': 'Explora el rack DSP',
  'help.dsp.intro':
    'DSP procesa solo pistas de audio de Biblioteca. Karaoke, vídeos, audio compartido recibido y otras aplicaciones no pasan por este rack. Incluye Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer y Master.',
  'help.dsp.steps':
    'Reproduce una pista de audio de Biblioteca, abre DSP y activa el rack. Empieza con un preset o una etapa.\nCambia un control y compara desactivando esa etapa a un volumen parecido.\nVigila los niveles de salida. Guarda el rack; Exportar e Importar intercambian racks completos.',
  'help.dsp.tip':
    'El Equaliser de DSP y la EQ del sistema son etapas distintas: ambas pueden afectar a Biblioteca en Windows. Compara a volúmenes parecidos para no confundir mayor volumen con mejor sonido.',
  'help.denoise.title': 'Reducción de ruido y análisis',
  'help.denoise.intro':
    'Denoise reduce ruido no deseado en el audio de Biblioteca. Su análisis ayuda a ver a qué responde la etapa. Una reducción excesiva puede suavizar detalles o producir bombeo.',
  'help.denoise.steps':
    'Reproduce una pista de Biblioteca con el ruido y selecciona Denoise en DSP.\nActiva una reducción ligera y escucha pasajes silenciosos y detalles musicales.\nAumenta gradualmente y compara desactivando la etapa.',
  'help.denoise.tip':
    'No limpia el micrófono ni procesa Medios en línea. Si no cambia nada, confirma que sea audio de Biblioteca y que rack y etapa estén activos.',
  'help.visuals.title': 'Personaliza el reproductor',
  'help.visuals.intro':
    'La curva, espectro y medidor muestran aspectos distintos del sonido. El visualizador ofrece formas, paletas y picos; cambiar el aspecto no cambia la EQ.',
  'help.visuals.steps':
    'Activa Gráfico de respuesta a la izquierda y elige su tamaño en Vista.\nElige una forma y abre Nuevo aspecto para ajustar color, relleno, brillo, separación y picos. Guárdalo con un nombre.\nEn Acciones de audio puedes cambiar tema e idioma. Ctrl + más, menos o 0 amplía, reduce o restablece el zoom.',
  'help.visuals.tip':
    'Un espectro en movimiento no demuestra que la EQ llegue al dispositivo. Compara lo que oyes y comprueba el estado de salida.',
  'help.karaoke.title': 'Canta con Karaoke',
  'help.karaoke.intro':
    'Karaoke combina tu audio con letras. Las letras temporizadas siguen la reproducción; los objetivos de tono requieren datos de notas. Un micrófono configurado añade tu tono en directo.',
  'help.karaoke.steps':
    'Abre Karaoke y usa Añadir archivos o Añadir carpeta para importar audio y letras correspondientes.\nElige una canción, reprodúcela y comprueba que letras y acompañamiento coincidan.\nConfigura el micrófono, ajusta el tamaño de letra y usa el control de pantalla completa del escenario.',
  'help.karaoke.tip':
    'Un archivo de solo letras no contiene notas objetivo. Su ausencia no demuestra por sí sola un fallo del micrófono.',
  'help.maker.title': 'Crea en Karaoke Maker',
  'help.maker.intro':
    'Maker convierte audio en un proyecto editable con audio, letras y notas en una línea de tiempo. Revisa siempre las palabras y los tiempos generados automáticamente.',
  'help.maker.steps':
    'Abre Crear desde Karaoke y carga el audio. Elige las herramientas de separación o transcripción disponibles que necesites.\nSigue el progreso: el primer uso de IA puede requerir descargar modelos. Revisa letras y notas en la línea de tiempo.\nEscucha fragmentos, corrige texto y tiempos, guarda el proyecto y exporta los archivos de karaoke.',
  'help.maker.tip':
    'Los modelos requieren conexión y espacio. La duración del proceso depende del equipo y la canción. Utiliza audio que tengas permiso para trabajar y revisa antes de compartir.',
  'help.trouble.title': 'Cuando algo suena mal',
  'help.trouble.intro':
    'Empieza por fuente y salida, después aísla las capas. Un gráfico o interruptor activado no demuestra que el audio llegue al dispositivo previsto. Ayuda incluye reparación y reporte de problemas.',
  'help.trouble.steps':
    'Sin sonido: comprueba reproducción, salida, volumen y conexión. Un reproductor a la vez puede haber pausado otra fuente.\nSin cambio de EQ: confirma EQ del sistema y la selección del dispositivo en Equalizer APO. Usa Solucionar problemas de audio; los reinicios interrumpen el sonido.\nDistorsión o graves excesivos: activa normalización automática, reduce ganancias y desactiva capas de una en una. Si persiste, revisa el informe antes de enviarlo desde Reportar un problema.',
  'help.trouble.tip':
    'F1 abre esta guía. Escape cierra primero la captura ampliada y después la guía. Ctrl + 0 restablece el zoom. Para probar DSP, utiliza una pista de audio de Biblioteca.',
};

export default help;
