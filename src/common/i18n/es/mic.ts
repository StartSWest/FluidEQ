/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'Micrófono',
  'mic.label': 'Micrófono',
  'mic.pickHint': 'Elige el micrófono que quieres ajustar',
  'mic.list.heading': 'Micrófonos en este equipo',
  'mic.list.on': 'Activo',
  'mic.list.off': 'Sin configurar',
  'mic.live': 'En vivo en todas las apps',
  'mic.notSetUp': 'Aún no está configurado en este micrófono',
  'mic.state.opening': 'Abriendo el micrófono…',
  'mic.state.noInput':
    'Windows no muestra ninguna entrada para este micrófono ahora',
  'mic.state.blocked': 'Windows no dejó que FluidEQ abriera este micrófono',
  'mic.state.waiting':
    'Micrófono abierto · esperando a que el motor arranque en él',
  'mic.meter.gateOpen': 'Voz pasando',
  'mic.meter.gateClosed': 'Puerta cerrada',
  'mic.meter.compressor': 'Compresor',
  'mic.meter.limiter': 'Limitador',
  'mic.monitor.label': 'Escuchar el resultado final',
  'mic.monitor.hint':
    'Reproduce lo que oyen los demás en la salida que estás escuchando',
  'mic.monitor.warning':
    'Usa auriculares: en altavoces tu voz vuelve al micrófono y se acopla.',
  'mic.effectsOff.short':
    'Las mejoras de audio de Windows están desactivadas en este micrófono',
  'mic.effectsOff.title': 'Las mejoras de audio están desactivadas en {mic}',
  'mic.effectsOff.body':
    'Desactivadas, Windows no aplica ningún efecto a este micrófono y FluidEQ no puede procesarlo. Activa «Mejoras de audio» en las propiedades del micrófono.',
  'mic.effectsOff.button': 'Abrir la configuración de sonido de Windows',
  'mic.picture.label':
    'Tu voz: lo que capta el micrófono, tenue, y lo que oyen los demás, brillante',
  'mic.picture.raw': 'Tu micrófono',
  'mic.picture.heard': 'Lo que oyen los demás',
  'mic.picture.gate': 'Puerta',
  'mic.profile.label': 'Perfil de micrófono',
  'mic.profile.pickHint':
    'Empieza con un perfil hecho para cómo usas el micrófono',
  'mic.profile.group.use': 'Por uso',
  'mic.profile.group.mic': 'Por micrófono',
  'mic.profile.tuned': 'ajustado',
  'mic.profile.stream': 'Streaming',
  'mic.profile.stream.hint':
    'Voz cálida, cercana y estable para Twitch y YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': 'Una voz natural con un control suave',
  'mic.profile.chat': 'Chat de juego',
  'mic.profile.chat.hint':
    'Voz clara y presente en Discord y en el chat de equipo, sin ruido entre palabras',
  'mic.profile.sing': 'Canto',
  'mic.profile.sing.hint':
    'Abierta y aireada, sin bombeo, conservando cada respiración',
  'mic.profile.broadcast': 'Locución',
  'mic.profile.broadcast.hint':
    'Voz de radio: graves amplios, compacta y densa',
  'mic.profile.noisy': 'Cuarto ruidoso',
  'mic.profile.noisy.hint':
    'Ventiladores, niños, tráfico: el limpiador al máximo y una puerta suave',
  'mic.profile.meet': 'Reuniones',
  'mic.profile.meet.hint':
    'Teams y Zoom: palabras claras, sin pisar la limpieza que ya hacen ellos',
  'mic.profile.laptop': 'Micrófono de laptop',
  'mic.profile.laptop.hint':
    'Delgado, lejano y con mucha sala: corte de graves alto, limpiador fuerte',
  'mic.profile.headset': 'Micrófono de diadema',
  'mic.profile.headset.hint':
    'Una cápsula pequeña cerca de la boca: recupera la calidez y quita los golpes de aire',
  'mic.reset': 'Restablecer a {profile}',
  'mic.setup.title': 'El FluidEQ Engine aún no está en {mic}.',
  'mic.setup.body':
    'Windows pide permiso una sola vez. Tus salidas siguen sonando mientras se configura.',
  'mic.setup.button': 'Configurar en este micrófono',
  'mic.setup.working': 'Configurando…',
  'mic.setup.declined': 'Windows no dio permiso, así que no cambió nada.',
  'mic.setup.failed': 'No se pudo configurar en este micrófono.',
  'mic.notFluid.title':
    'El sonido de cada micrófono se reproduce en el FluidEQ Engine.',
  'mic.notFluid.body':
    'Su sonido queda guardado y empieza a sonar en cuanto elijas el FluidEQ Engine.',
  'mic.empty.backTitle': 'Windows está recuperando tus micrófonos',
  'mic.empty.backBody':
    'Aparecen aquí en cuanto Windows vuelve a listarlos, normalmente un momento después de reiniciar su audio.',
  'mic.empty.lookAgain': 'Buscar de nuevo',
  'mic.stage.level': 'Nivel de voz',
  'mic.level.title': 'Nivel de voz',
  'mic.level.description':
    'Lleva tu voz a un nivel estable mientras hablas: la sube cuando hablas bajo o lejos del micro y la baja cuando gritas. Nunca sube la sala entre palabras.',
  'mic.level.group': 'El nivel',
  'mic.level.groupHint':
    'Objetivo es donde se mantiene tu voz. Subida máxima es cuánto puede subir una voz baja.',
  'mic.level.target': 'Objetivo',
  'mic.level.maxLift': 'Subida máxima',
  'mic.level.live.title': 'Tu voz, nivelada',
  'mic.level.live.label':
    'Tu voz en los últimos diez segundos tal como llega y ya nivelada, frente al objetivo',
  'mic.level.live.keyArrives': 'Tal como llega',
  'mic.level.live.keyLevelled': 'Nivelada',
  'mic.level.live.keyTarget': 'Objetivo',
  'mic.level.live.target': 'objetivo {db} dB',
  'mic.level.live.lifted': 'Ganancia ahora',
  'mic.level.live.state': 'Ahora',
  'mic.level.live.following': 'Siguiendo tu voz',
  'mic.level.live.holding': 'Manteniendo el nivel',
  'mic.preset.lowCut.speech': 'Voz hablada',
  'mic.preset.lowCut.deep': 'Voz grave',
  'mic.preset.lowCut.headset': 'Headset cerca',
  'mic.preset.lowCut.rumble': 'Contra retumbos',
  'mic.preset.lowCut.distant': 'Micro de mesa a distancia',
  'mic.preset.denoise.light': 'Ligero',
  'mic.preset.denoise.studio': 'Estudio',
  'mic.preset.denoise.home': 'Oficina en casa',
  'mic.preset.denoise.noisy': 'Sala ruidosa',
  'mic.preset.denoise.fan': 'Ventilador y aire',
  'mic.preset.gate.gentle': 'Suave',
  'mic.preset.gate.calls': 'Llamadas',
  'mic.preset.gate.podcast': 'Pódcast',
  'mic.preset.gate.stream': 'Streaming',
  'mic.preset.gate.tight': 'Ajustado',
  'mic.preset.level.gentle': 'Suave',
  'mic.preset.level.calls': 'Llamadas',
  'mic.preset.level.podcast': 'Pódcast',
  'mic.preset.level.stream': 'Streaming',
  'mic.preset.level.soft': 'Voz baja',
  'mic.picture.taken': 'El gris que asoma = lo que quitaron los filtros',
  'mic.preset.level.everyday': 'Voz cotidiana',
  'mic.stage.reverb': 'Reverb',
  'mic.reverb.title': 'Reverb',
  'mic.reverb.description':
    'Pone tu voz en un espacio: una placa para cantar, una sala pequeña para un poco de aire. Solo se añade la cola, así tu voz conserva su tiempo.',
  'mic.reverb.group.type': 'Espacio',
  'mic.reverb.type.plate': 'Placa',
  'mic.reverb.type.vocalPlate': 'Placa vocal',
  'mic.reverb.type.room': 'Sala',
  'mic.reverb.type.chamber': 'Cámara',
  'mic.reverb.type.hall': 'Auditorio',
  'mic.reverb.typeHint.plate':
    'Brillante y densa desde el primer momento, el sonido clásico detrás de una voz cantada.',
  'mic.reverb.typeHint.vocalPlate':
    'Más oscura y corta: queda detrás de la voz sin taparla.',
  'mic.reverb.typeHint.room':
    'Pequeña y cercana: un poco de aire alrededor de la voz, nunca un eco.',
  'mic.reverb.typeHint.chamber':
    'Cálida y redonda, con un comienzo más suave que una placa.',
  'mic.reverb.typeHint.hall':
    'Grande y de crecimiento lento, con una cola larga para baladas.',
  'mic.reverb.group.tail': 'La cola',
  'mic.reverb.group.tailHint':
    'Mezcla es cuánto suena la cola junto a tu voz. El predelay deja un hueco para que las palabras sigan claras.',
  'mic.reverb.mix': 'Mezcla',
  'mic.reverb.decay': 'Caída',
  'mic.reverb.predelay': 'Predelay',
  'mic.reverb.group.colour': 'Color',
  'mic.reverb.group.colourHint':
    'Tono oscurece la cola, Corte de graves deja fuera el barro de la voz, Amplitud la abre en un micro estéreo.',
  'mic.reverb.tone': 'Tono',
  'mic.reverb.lowCut': 'Corte de graves',
  'mic.reverb.width': 'Amplitud',
  'mic.reverb.group.duck': 'Mientras hablas',
  'mic.reverb.group.duckHint':
    'La cola se retira mientras hablas y florece en las pausas, para que cada palabra siga clara.',
  'mic.reverb.duckDb': 'Se retira',
  'mic.reverb.tail.title': 'La forma de la cola',
  'mic.reverb.tail.label':
    'Tu voz y la cola de reverb después, desde su nivel hasta 60 dB abajo durante la caída',
  'mic.reverb.tail.keyVoice': 'Tu voz',
  'mic.reverb.tail.keyTail': 'La cola',
  'mic.reverb.tail.keyDucked': 'Mientras hablas',
  'mic.reverb.tail.voice': 'voz',
  'mic.reverb.tail.mix': '{db} dB',
  'mic.reverb.tail.decay': '−60 dB a {time}',
  'mic.reverb.tail.ducked': '−{db} dB mientras hablas',
  'mic.preset.reverb.plate': 'Placa',
  'mic.preset.reverb.vocalPlate': 'Placa vocal',
  'mic.preset.reverb.intimate': 'Sala íntima',
  'mic.preset.reverb.chamber': 'Cámara',
  'mic.preset.reverb.hall': 'Sala de conciertos',
  'mic.preset.reverb.streamAir': 'Aire para streaming',
  'mic.profile.group.singing': 'Canto',
  'mic.profile.group.fx': 'Efectos de voz',
  'mic.profile.singPlate': 'Canto · Placa',
  'mic.profile.singPlate.hint': 'Canto con una placa brillante detrás',
  'mic.profile.singHall': 'Canto · Auditorio',
  'mic.profile.singHall.hint':
    'Canto en un auditorio grande con una cola larga',
  'mic.profile.singRoom': 'Canto · Sala',
  'mic.profile.singRoom.hint': 'Canto en una sala íntima',
  'mic.profile.streamAir': 'Streaming · Aire',
  'mic.profile.streamAir.hint':
    'Streaming con un poco de sala que se retira mientras hablas',
  'mic.profile.radio': 'Radio AM',
  'mic.profile.radio.hint':
    'Un receptor antiguo: la banda AM y un nivel apretado',
  'mic.profile.phone': 'Teléfono',
  'mic.profile.phone.hint': 'La banda telefónica, estrecha en ambos extremos',
  'mic.profile.whisper': 'Susurro',
  'mic.profile.whisper.hint': 'Un susurro traído al frente, con aire arriba',
  'mic.profile.megaphone': 'Megáfono',
  'mic.profile.megaphone.hint':
    'Medios estrechos y empujados, y un golpe corto de sala',
  'mic.stage.own': 'Efectos propios del micro',
  'mic.own.title': 'Efectos propios del micro',
  'mic.own.description':
    'El procesado que pone el fabricante de tu micro antes de que FluidEQ oiga tu voz. Quítalo y solo FluidEQ procesa tu voz; vuelve a ponerlo y queda exactamente como estaba.',
  'mic.own.group.brings': 'Lo que trae tu micro',
  'mic.own.group.taken': 'Quitados',
  'mic.own.group.how': 'Cómo cambia',
  'mic.own.how':
    'Windows pide permiso cada vez y su sonido se corta un momento mientras se reinicia. Todas las apps que usan este micro oyen el cambio.',
  'mic.own.none':
    'Este micro no trae efectos propios: solo FluidEQ lo procesa.',
  'mic.own.unknown':
    'Actualiza el FluidEQ Engine para ver los efectos propios de este micro.',
  'mic.own.unnamed': 'Efecto sin nombre',
  'mic.own.stateOn': 'Activado',
  'mic.own.stateOff': 'Quitado',
  'mic.own.prompt': 'Windows pedirá permiso.',
  'mic.own.working': 'Esperando a Windows…',
  'mic.own.declined': 'Windows no dio permiso, así que no cambió nada.',
  'mic.own.failed': 'No se pudo cambiar en este micro.',
  'mic.empty.title': 'No se encontró ningún micrófono',
  'mic.empty.body':
    'Conecta un micrófono o actualiza el FluidEQ Engine para que pueda mostrarlos.',
  'mic.stage.lowCut': 'Corte graves',
  'mic.stage.cleaner': 'Cancelación de ruido',
  'mic.stage.gate': 'Puerta',
  'mic.stage.deEsser': 'De-esser',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Compresor',
  'mic.stage.limiter': 'Limitador',
  'mic.lowCut.title': 'Corte de graves',
  'mic.lowCut.description':
    'Quita el retumbe, los golpes en el escritorio y el ventilador por debajo de la voz, antes de que el limpiador los oiga.',
  'mic.lowCut.group.below': 'Debajo de la voz',
  'mic.lowCut.group.belowHint':
    'Proximidad quita los graves de más que gana una voz a pocos centímetros de la cápsula.',
  'mic.lowCut.cut': 'Corte en',
  'mic.lowCut.proximity': 'Proximidad',
  'mic.lowCut.group.pops': 'Explosivas',
  'mic.lowCut.group.popsHint':
    'Suaviza el golpe de una P o una B y deja intacta una voz sostenida.',
  'mic.lowCut.plosive': 'Antipop',
  'mic.gate.title': 'Puerta de ruido',
  'mic.gate.description':
    'Cierra el micrófono entre palabras para dejar fuera la sala, el ventilador y el teclado. Con poca reducción se vuelve un expansor suave.',
  'mic.gate.group.level': 'Cuándo se abre',
  'mic.gate.group.levelHint':
    'Mira la línea punteada en la imagen: tu voz debe superarla y la sala debe quedar por debajo.',
  'mic.gate.threshold': 'Umbral',
  'mic.gate.range': 'Reducción',
  'mic.gate.group.time': 'Velocidad',
  'mic.gate.group.timeHint':
    'Retención la mantiene abierta entre sílabas, así nunca se cortan los finales de las palabras.',
  'mic.gate.attack': 'Apertura',
  'mic.gate.hold': 'Retención',
  'mic.gate.release': 'Cierre',
  'mic.monitor.on': 'Escuchando el resultado final',
  'mic.delay.label': 'Retardo',
  'mic.delay.measured':
    'medido por el motor en este micrófono, de la cápsula a cada app',
  'mic.delay.unknown': 'el motor aún no ha medido este micrófono',
  'mic.rail.master': 'Procesar el micrófono',
  'mic.rail.note':
    'Cada interruptor apaga su etapa por completo: sin cambio de sonido ni retardo. El número junto a una etapa es el retardo que añade.',
  'mic.meter.noise': 'Ruido quitado',
  'mic.cleaner.description':
    'Quita teclados, ventiladores y la sala de debajo de tu voz mientras hablas.',
  'mic.cleaner.strength': 'Intensidad',
  'mic.gate.live.title': 'Tu voz frente a la puerta de ruido',
  'mic.gate.live.hint':
    'Arrastra la línea hacia arriba o hacia abajo. Los tramos grises son donde la puerta bajó la sala.',
  'mic.gate.live.opens': 'abre a {db} dB',
  'mic.live.ago': '−{seconds} s',
  'mic.live.now': 'ahora',
  'mic.gate.live.stateOpen': 'Abierta',
  'mic.gate.live.stateClosed': 'Cerrada',
  'mic.gate.live.waiting': 'Esperando tu voz',
  'mic.gate.live.keyLevel': 'Lo que oye la puerta',
  'mic.gate.live.keyClosed': 'Atenuado',
  'mic.gate.live.keyOpens': 'Abre',
  'mic.gate.live.keyCloses': 'Cierra',
  'mic.gate.live.label':
    'El nivel que oye la puerta en los últimos cinco segundos, frente a donde abre y donde cierra',
  'mic.gate.live.openShare': 'Abierta, últimos {seconds} s',
  'mic.lowCut.live.title': 'Dónde está tu voz',
  'mic.lowCut.live.keyKept': 'Tu voz, conservada',
  'mic.lowCut.live.keyTaken': 'Quitado',
  'mic.lowCut.live.keyCut': 'El corte',
  'mic.lowCut.live.label':
    'Tu voz tal como llega, con lo que quita el corte de graves',
  'mic.lowCut.live.chip': '{hz} Hz · {slope} dB/oct',
  'mic.lowCut.live.hum': 'zumbido {hz} Hz',
  'mic.lowCut.live.taken': 'Retumbe quitado ahora',
  'mic.lowCut.live.lowest': 'La nota más grave de tu voz',
  'mic.lowCut.live.hint':
    'Arrastra el punto a izquierda o derecha y mantenlo por debajo de tu nota más grave.',
  'mic.cleaner.live.title': 'Voz y sala, ahora',
  'mic.cleaner.live.keyBefore': 'Lo que oye el micrófono',
  'mic.cleaner.live.keyAfter': 'Tras la limpieza',
  'mic.cleaner.live.label': 'Tu voz y tu sala antes y después de la limpieza',
  'mic.cleaner.live.roomBefore': 'Sala antes',
  'mic.cleaner.live.roomAfter': 'Sala después',
  'mic.cleaner.live.taken': 'Sala quitada',
  'mic.cleaner.live.over': 'Voz sobre la sala',
  'mic.cleaner.live.hint':
    'El gris es tu sala tal como la oye el micrófono; el color es lo que deja la limpieza.',
  'mic.cleaner.strengthHint':
    'Cuánto de la sala quita la limpieza. Por encima del 80 % la voz empieza a sonar procesada.',
  'mic.preset.limiter.catch': 'Atrapar picos',
  'mic.preset.limiter.calls': 'Llamadas',
  'mic.preset.limiter.stream': 'Streaming',
  'mic.preset.limiter.loud': 'Alto sobre el juego',
  'mic.preset.dynamics.gentle': 'Voz suave',
  'mic.preset.dynamics.broadcast': 'Voz de radio',
  'mic.preset.dynamics.callouts': 'Avisos en partida',
  'mic.preset.dynamics.singing': 'Canto',
  'mic.preset.deEsser.soft': 'Suave',
  'mic.preset.deEsser.podcast': 'Pódcast',
  'mic.preset.deEsser.bright': 'Micro brillante',
  'mic.preset.eq.warm': 'Voz cálida',
  'mic.preset.eq.clear': 'Voz clara',
  'mic.preset.eq.radio': 'Radio',
  'mic.preset.eq.headset': 'Corrección de headset',
  'mic.preset.eq.thin': 'Rellenar micro fino',
};
