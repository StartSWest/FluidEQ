/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.key.now': 'La banda ahora',
  'dsp.dynamics.key.lifted': 'Subido',
  'dsp.dynamics.key.held': 'Contenido',
  'dsp.dynamics.untouched': 'Sin tocar',
  'dsp.dynamics.dragHint':
    'Arrastra un punto: hueco donde empieza una banda, relleno cuánto actúa.',
  'dsp.dynamics.idleHint':
    'No suena nada. El punto de cada banda recorre su curva en cuanto llega el sonido.',
  'dsp.dynamics.state.lifting': 'Subiendo',
  'dsp.dynamics.state.holding': 'Conteniendo',
  'dsp.dynamics.state.silent': 'Sin sonido',
  'dsp.dynamics.bands': 'Bandas',
  'dsp.dynamics.axisIn': 'Entrada',
  'dsp.dynamics.axisOut': 'Salida',
  'dsp.dynamics.table.starts': 'Empieza',
  'dsp.dynamics.table.atMost': 'Como máximo',
  'dsp.dynamics.table.liftUnder': 'Subir bajo',
  'dsp.dynamics.table.holdOver': 'Contener sobre',
  'dsp.dynamics.point.liftStart': 'Dónde empieza la subida',
  'dsp.dynamics.point.liftTop': 'Hasta dónde llega la subida',
  'dsp.dynamics.point.liftPull': 'Sacar una subida',
  'dsp.dynamics.point.holdStart': 'Dónde empieza la contención',
  'dsp.dynamics.point.holdEnd': 'Cuánto contiene',
  'dsp.dynamics.engineLiveOld':
    'Actualiza el motor para ver el movimiento de Dynamics. El sonido ya se está procesando.',
  'dsp.dynamics.title': 'Dinámica',
  'dsp.dynamics.description':
    'Sube lo que suena bajo y contiene lo que suena fuerte, en tres bandas, para que un susurro y una explosión se encuentren en el medio. No añade retardo.',
  'dsp.dynamics.engineOld':
    'Dinámica necesita el FluidEQ Engine más reciente. El resto del rack está sonando; este filtro empieza cuando se actualice el motor.',
  'dsp.dynamics.graphLabel': 'Lo que hace cada banda con su nivel',
  'dsp.dynamics.band.low': 'Graves',
  'dsp.dynamics.band.lowRange': 'bajo 150 Hz',
  'dsp.dynamics.band.lowHint':
    'Por debajo de 150 Hz: el retumbo de una explosión, un bombo, un motor.',
  'dsp.dynamics.band.mid': 'Medios',
  'dsp.dynamics.band.midRange': '150 Hz – 4 kHz',
  'dsp.dynamics.band.midHint':
    'De 150 Hz a 4 kHz: voces, pasos y casi todo el sonido.',
  'dsp.dynamics.band.high': 'Agudos',
  'dsp.dynamics.band.highRange': 'sobre 4 kHz',
  'dsp.dynamics.band.highHint':
    'Por encima de 4 kHz: detalle, aire, el filo de un paso.',
  'dsp.dynamics.lift': 'Subir',
  'dsp.dynamics.hold': 'Contener',
  'dsp.dynamics.upThreshold': 'Por debajo de',
  'dsp.dynamics.upRatio': 'Proporción',
  'dsp.dynamics.upMax': 'Hasta',
  'dsp.dynamics.downThreshold': 'Por encima de',
  'dsp.dynamics.downRatio': 'Proporción',
  'dsp.dynamics.timing': 'Tiempo y nivel',
  'dsp.dynamics.timingHint':
    'Qué tan rápido llega la contención y vuelve la subida, y qué tan fuerte queda el resultado.',
  'dsp.dynamics.attack': 'Ataque',
  'dsp.dynamics.release': 'Liberación',
  'dsp.dynamics.makeup': 'Compensación',
  'dsp.dynamics.mix': 'Mezcla',
  'dsp.dynamicsPreset.gentle': 'Nivelado suave',
  'dsp.dynamicsPreset.speech': 'Voz hablada',
  'dsp.gamingPreset.quietLift': 'Subir lo bajo',
  'dsp.gamingPreset.blastGuard': 'Freno de explosiones',
  'dsp.gamingPreset.longSession': 'Sesión larga',
  'dsp.gamingPreset.competitiveLight': 'Competitivo ligero',
};
