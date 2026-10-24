/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** Spanish of `./en.ts`, the Linux wording; see there. */
const es: Partial<Dictionary> = {
  'app.menu.restartAudio': 'Reiniciar el audio',
  'restart.title': 'Reiniciar el audio',
  'restart.failed': 'No se pudo reiniciar el audio.',
  'notice.restartConfirm':
    'El audio se detendrá unos segundos mientras el Motor FluidEQ vuelve a arrancar. ¿Continuar?',
  'notice.restartDone':
    'El audio se ha reiniciado. Vuelve a abrir cualquier aplicación que siga en silencio.',
  'troubleshoot.restart.title': 'Reiniciar el audio',
  'troubleshoot.restart.cost':
    'Unos segundos de silencio mientras el Motor FluidEQ vuelve a arrancar. Sin contraseña.',
  'engine.title': 'Cómo procesa FluidEQ tu sonido',
  'engine.subtitle':
    'El Motor FluidEQ funciona junto a tu servidor de sonido, PipeWire o PulseAudio, mientras FluidEQ esté abierto.',
  'engine.fluid.l1':
    'Funciona con PipeWire y PulseAudio, en cualquier distribución',
  'engine.fluid.l2':
    'El EQ y el rack DSP se aplican a todo lo que oyes, sin reiniciar',
  'engine.fluid.l3':
    'Las líneas Plugin: y los plugins VST de la configuración no funcionan',
  'output.hint':
    'Los cambios se guardan en el perfil activo y acompañan a esta salida siempre que sea la que está sonando.',
  'extraOutput.ambiguous':
    'Dos salidas comparten este nombre, así que FluidEQ no puede saber a cuál te refieres. Cambia el nombre de una en tu configuración de sonido.',
  'extraOutput.unmatched':
    'Tu configuración de sonido muestra esta salida pero FluidEQ no puede alcanzarla, así que no se puede duplicar en ella.',
  'convolution.eyebrow': 'RESPUESTAS AL IMPULSO',
  'convolution.notice.fluid':
    'El catálogo descargable lo proporciona AutoEq. Cada descarga coincide con la frecuencia a la que funciona tu salida, y el Motor FluidEQ convierte él mismo cualquier otra frecuencia.',
  'graph.scene.gpu.auto': 'Decide el sistema',
  'settingsReset.body':
    'La gráfica y los visualizadores, Colores de la ventana, el reproductor, la Biblioteca, el idioma, Animaciones e Iniciar con la sesión vuelven a como empieza FluidEQ recién instalado.',
  'app.processes.hint':
    'Tu sistema llama a todos estos igual que a la aplicación, porque son el mismo programa. Esto es lo que hace cada uno en realidad para FluidEQ.',
  'app.processes.what.engine':
    'El motor propio de FluidEQ. Descodifica lo que reproduces y aplica el ecualizador sobre la marcha. Es un programa aparte del resto, así que una ventana ocupada no puede atascar la música.',
  'app.processes.what.devices':
    'Lo inicia Chromium cuando la app pregunta qué dispositivos de audio hay; esa misma consulta enumera también los de vídeo. No abre ninguna cámara ni graba nada.',
  'app.processes.name.systemEngine': 'Motor FluidEQ (audio del sistema)',
  'app.processes.what.systemEngine':
    'El ecualizador entre tus apps y tu servidor de sonido, que lo aplica a todo lo que oyes. FluidEQ lo arranca y lo detiene consigo; su memoria y su CPU se muestran pero no se suman al total.',
  'dsp.normalizer.liveGuidance':
    'La nivelación en directo sigue la canción que está sonando. Un pasaje fuerte baja la ganancia para el resto de la canción; la siguiente mantiene ese nivel salvo que sea mucho más suave. Las canciones ya escuchadas se nivelan desde el primer segundo. La ganancia sube como máximo 6 dB dentro del margen de picos; el objetivo no está garantizado. Desactívala y actívala para analizar de nuevo. No repara la distorsión existente.',
  'dsp.latency.hint':
    'Retardo añadido por el procesamiento del motor. No incluye el servidor de sonido, el dispositivo ni la red.',
  'dsp.latency.note':
    'Búferes informados por el motor a la frecuencia de muestreo actual. No incluye el servidor de sonido, el dispositivo ni la red.',
  'dsp.surround.onHint':
    'Pasa el rack por todos los canales de una salida 5.1 o 7.1, según lo que tenga configurado tu salida, con una sola decisión de nivel para todos.',
  'update.mandatory.failedInstall':
    'La actualización se ha descargado, pero el instalador no ha arrancado. Puede que el archivo descargado esté dañado.',
  'startup.label': 'Iniciar con la sesión',
  'startup.blocked':
    'Tu escritorio lo tiene desactivado en sus aplicaciones de inicio',
  'startup.failed': 'Tu sistema no permitió cambiarlo',
  'disclaimer.liability':
    'FluidEQ cambia cómo se procesa el audio en tu ordenador: su motor se sitúa entre tus apps y tu servidor de sonido y procesa todo lo que oyes. En la máxima medida que permita la ley, {author} no responde de ningún daño derivado de su uso: a tu oído, a altavoces, auriculares u otros equipos, a datos o a otros programas, ni a nada más, incluidas las pérdidas que no hubieras podido prever.',
  'provenance.body':
    'Los paquetes oficiales de FluidEQ se entregan únicamente a través de fluideq.com. Las compilaciones desde el código fuente deben partir del repositorio oficial. La GPL permite que terceros copien, modifiquen, recompilen y vendan FluidEQ, pero sus versiones no están revisadas, respaldadas ni aprobadas por FluidEQ. Si una descarga afirma ser oficial y no procede de fluideq.com ni del repositorio oficial, ciérrala e informa de ella.',
  'engineHealth.offBody':
    'Esta salida está sonando sin tu EQ. Reiniciar el audio suele recuperar el motor, y todo lo demás en FluidEQ sigue funcionando mientras tanto.',
  'engineHealth.rackNeedsEngine':
    'Los efectos DSP se ejecutan dentro del propio motor. Reiniciar el audio lo vuelve a arrancar; si eso no ayuda, reinstalar FluidEQ vuelve a poner su propio motor en su sitio.',
  'tour.engine.lead':
    'FluidEQ tiene ahora un motor de audio propio. Funciona junto a tu servidor de sonido, PipeWire o PulseAudio, y lleva tu EQ y el rack DSP completo a todo lo que suena en el ordenador: juegos, navegadores y apps de streaming, no solo a la Biblioteca.',
  'tour.engine.flow.inside': 'Junto a tu servidor de sonido',
  'tour.dsp.lead':
    'Un rack de etapas de estudio: Normalizador, Reducción de ruido, Excitador, Forja de graves, Ecualizador, Pegada de graves, Dimensión, Sala, Maximizador y Master, más un fundido cruzado entre pistas de la Biblioteca. Se aplica a todo lo que suena en el ordenador. Cada etapa tiene su propia página con una vista en vivo, la mayoría tiene presets y cinco tienen un interruptor Aislar para oír solo lo que hacen.',
  'tour.dsp.how':
    'Abre la pestaña DSP, elige una cadena en Presets, luego haz clic en una etapa en las pestañas laterales y actívala.',
  'help.start.steps':
    'Instala FluidEQ desde su .deb o AppImage y ábrelo: el Motor FluidEQ arranca con él, sin contraseña y sin reiniciar.\nElige tu dispositivo de escucha en Dispositivo de salida. Activa EQ del sistema y deja Normalizar automáticamente activado.\nReproduce una canción, abre EQ → Bandas, cambia algo ligeramente y compara activando y desactivando EQ del sistema.',
  'help.start.tip':
    'El EQ para todo el sistema en Linux necesita PipeWire o PulseAudio, que usan todos los escritorios actuales. Mientras FluidEQ está abierto, todo lo que reproduces pasa por él; al salir, tu sonido vuelve intacto.',
  'help.window.tip':
    'El menú Ayuda abre esta guía, Novedades, el solucionador de problemas de audio e Informar de un problema. El botón con el icono de pulso que hay a su lado reúne la tarjeta del motor, tu cuenta, la importación de ajustes de EQ o de una respuesta al impulso, el reinicio del audio y Procesos, que muestra qué está usando cada parte de FluidEQ; al pie del menú están Brillo y Transparencia, las animaciones, Iniciar con la sesión y el idioma. El interruptor que sigue a esos dos botones convierte la ventana en el Reproductor compacto.',
  'help.window.actions':
    'El motor, tu cuenta, la importación de ajustes de EQ, el reinicio del audio y Procesos; Brillo y Transparencia, las animaciones, Iniciar con la sesión y el idioma.',
  'help.player.tip':
    'El volumen del reproductor es el de tu ordenador, así que ajusta el nivel de todo lo que suena en el ordenador. Si el reproductor acaba fuera de la pantalla, haz clic derecho en el icono de FluidEQ en la barra superior y elige Recuperar la ventana.',
  'help.player.volume':
    'El volumen de tu ordenador: ajusta el nivel de todo lo que suena en el ordenador.',
  'help.requirements.intro':
    'FluidEQ funciona en cualquier escritorio Linux de 64 bits de los últimos años: Ubuntu, Debian, Fedora, Mint, Arch y el resto. Dos partes piden más que el resto: los visualizadores de Plus dibujan en la tarjeta gráfica, y el karaoke con IA descarga sus modelos la primera vez que lo usas.',
  'help.requirements.steps':
    'Mira qué sistema tienes: Linux de 64 bits con PipeWire o PulseAudio (todos los escritorios actuales tienen uno), 4 GB de memoria y unos 600 MB de disco. El .deb es para Ubuntu, Debian y sus derivados; el AppImage funciona en el resto.\nAbre un visualizador: cualquier tarjeta gráfica o gráfica integrada de 2013 en adelante. A 1080p la integrada basta; para 4K va mejor una tarjeta dedicada. Con la tarjeta ocupada, FluidEQ dibuja la escena más pequeña y suelta las que no estás viendo.\nPrueba el karaoke con IA: separar la voz descarga un modelo de 713 MB la primera vez, el de afinación añade unos 180 MB y el de quitar ruido 11 MB. Funciona en el procesador, donde una canción de cuatro minutos se separa en unos cuatro minutos. Deja 2 GB de memoria libres mientras trabaja.\nApunta a esto si puedes: 8 GB de memoria, gráfica de 2018 en adelante y 3 GB de disco libres si usas las funciones con IA.',
  'help.requirements.keywords':
    'requisitos del sistema, requisitos mínimos, especificaciones, hardware, ordenador, computadora, portátil, laptop, GPU, tarjeta de video, CPU, RAM, espacio en disco, almacenamiento, Linux, Ubuntu, Debian, Fedora, Mint, Arch, PipeWire, PulseAudio, deb, AppImage, recomendado, rendimiento, consumo, lento, lag, compatible, compatibilidad, viejo, antiguo',
  'help.engine.intro':
    'FluidEQ procesa tu sonido con su propio motor. El Motor FluidEQ funciona junto a tu servidor de sonido (PipeWire o PulseAudio): se convierte en la salida del sistema, lleva tu EQ y el rack DSP a todo lo que suena en el ordenador, envía el resultado a tu salida real y se aparta en cuanto se cierra FluidEQ.',
  'help.engine.steps':
    'Abre el menú de acciones (el botón con el icono de pulso, arriba a la derecha). La tarjeta del motor, arriba del todo, indica si el motor está funcionando.\nElige la salida por la que escuchas en el panel Salida. FluidEQ reproduce por ella y te sigue cuando eliges otra en tu configuración de sonido.\nSi un aviso dice que el motor no está funcionando, pulsa Reiniciar el audio.',
  'help.engine.tip':
    'Deja FluidEQ como salida del sistema: elegir altavoces o unos auriculares en tu configuración de sonido no es problema, FluidEQ los sigue. Al salir de FluidEQ, todas las apps vuelven a la salida que elegiste.',
  'help.engine.keywords':
    'motor de audio, driver, controlador de audio, global, todas las aplicaciones, Spotify, Discord, navegador, PipeWire, PulseAudio, servidor de sonido, salida, salida predeterminada, reiniciar el audio',
  'help.engine.apo':
    'No en Linux: Equalizer APO es un programa de Windows, y aquí hace su trabajo el Motor FluidEQ.',
  'help.engine.apply':
    'No hace falta en Linux: el Motor FluidEQ es el único motor y ya es el que está en uso.',
  'help.convolution.tip':
    'El Motor FluidEQ convierte él mismo cualquier frecuencia del impulso. Descargar del catálogo requiere conexión; esta guía no.',
  'help.profiles.output':
    'La salida por la que estás escuchando, con su batería si son auriculares Bluetooth. DESACT. significa que tu EQ no llega a ella; ACTIVO, que es la salida que está sonando ahora.',
  'help.config.tip':
    'Los archivos de capas generados se reescriben al cambiar sus ajustes; pon las líneas manuales permanentes en el archivo personalizado de cada salida. El Motor FluidEQ lee sus líneas Filter, Preamp, GraphicEQ y Convolution; las líneas Plugin: y los plugins VST no funcionan en Linux.',
  'help.dsp.intro':
    'El rack DSP es una cadena de etapas de estudio. Con el Motor FluidEQ procesa todo lo que suena en el ordenador. Mientras FluidEQ está apagado, el rack también lo está.',
  'help.room.tip':
    'Los juegos y las películas solo envían sus canales surround a una salida configurada con tantos altavoces: si tu dispositivo los tiene, elige 5.1 o 7.1 para él en tu configuración de sonido.',
  'help.online.tip':
    'Con el Motor FluidEQ, Multimedia en línea pasa por tu EQ y por el rack DSP como cualquier otra app.',
  'help.library.tip':
    'Biblioteca necesita los archivos originales: vuelve a conectar la unidad o añade de nuevo una carpeta que hayas movido.',
  'help.share.tip':
    'El código de conexión autoriza el enlace: mantenlo privado. Este ordenador mantiene su DSP mientras comparte, y el ordenador que reproduce su sonido aplica el suyo. Reproducir y enviar a la vez requiere Windows, o el Motor FluidEQ en Linux, en ese ordenador; en otros, un enlace funciona en una sola dirección.',
  'help.trouble.steps':
    'Sin sonido: comprueba reproducción, salida, volumen y conexión. La opción Un solo reproductor puede haber pausado otra fuente.\nSin cambio de EQ: confirma que EQ del sistema está activado y que la salida no muestra DESACT. Si un aviso dice que el motor no está funcionando, pulsa Reiniciar el audio.\nTodo parece correcto y el EQ sigue sin hacer nada: comprueba que FluidEQ sigue siendo la salida en tu configuración de sonido; reiniciar el audio lo vuelve a poner.\nDistorsión o graves excesivos: deja activado Normalizar automáticamente, reduce las ganancias y desactiva las capas de una en una. Si persiste, usa Informar de un problema y revisa el informe antes de enviarlo.',
  'troubleshoot.description':
    'En Linux un solo paso resuelve casi cualquier problema: reiniciar el Motor FluidEQ, que tarda unos segundos.',
  'troubleshoot.footer':
    '¿Sigue fallando después de eso? Usa **{report}** en el mismo menú: reúne los registros, quita todo lo que pueda identificarte y te lo muestra completo antes de enviar nada.',
  'help.window.plus': 'Visualizadores, la galería y el Estudio.',
  'help.plus.intro':
    'La cuenta es opcional: todo lo que era gratis funciona en este equipo sin ella. Con la sesión iniciada, la pestaña Plus reúne Visualizadores y el Estudio. Una escena de Visualizadores cuesta un crédito y es tuya para siempre; una cuenta confirmada recibe algunos créditos gratis, y los paquetes de créditos se pagan una sola vez.',
  'help.gallery.desktop':
    'Solo en Windows: pone la escena detrás de los iconos del escritorio.',
  'help.gallery.manage':
    'Solo en Windows: lo que muestra cada monitor como fondo de escritorio.',
  'help.gallery.stop':
    'Solo en Windows: detiene todos los fondos de escritorio.',
  'help.library.steps':
    'Abre Biblioteca y añade tu carpeta de medios. Deja que termine el escaneo antes de decidir qué falta.\nElige un artista o álbum, o busca una canción y reprodúcela.\nUsa la barra de la parte inferior de la ventana para pausar, moverte por la pista y saltar. Su volumen es el de tu ordenador.',
};

export default es;
