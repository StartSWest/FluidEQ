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
  'mic.live': 'En vivo en todas las apps · baja latencia, {ms} ms',
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
  'mic.monitor.label': 'Escucharme',
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
    'Ventiladores, niños, tráfico: limpiador y puerta al máximo',
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
  'mic.empty.title': 'No se encontró ningún micrófono',
  'mic.empty.body':
    'Conecta un micrófono o actualiza el FluidEQ Engine para que pueda mostrarlos.',
  'mic.stage.lowCut': 'Corte graves',
  'mic.stage.cleaner': 'Limpiador de voz',
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
};
