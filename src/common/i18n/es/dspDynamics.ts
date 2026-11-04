/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.appliedGain': 'Ganancia aplicada',
  'dsp.dynamics.graphHint':
    'Música antes y después de Dynamics. La curva sube al realzar y baja al comprimir.',
  'dsp.dynamics.engineLiveOld':
    'Actualiza el motor para ver el movimiento de Dynamics. El sonido ya se está procesando.',
  'dsp.dynamics.title': 'Dinámica',
  'dsp.dynamics.description':
    'Sube lo que suena bajo y contiene lo que suena fuerte, en tres bandas, para que un susurro y una explosión se encuentren en el medio. No añade retardo.',
  'dsp.dynamics.engineOld':
    'Dinámica necesita el FluidEQ Engine más reciente. El resto del rack está sonando; este filtro empieza cuando se actualice el motor.',
  'dsp.dynamics.graphLabel': 'Lo que hace cada banda con su nivel',
  'dsp.dynamics.band.low': 'Graves',
  'dsp.dynamics.band.lowHint':
    'Por debajo de 150 Hz: el retumbo de una explosión, un bombo, un motor.',
  'dsp.dynamics.band.mid': 'Medios',
  'dsp.dynamics.band.midHint':
    'De 150 Hz a 4 kHz: voces, pasos y casi todo el sonido.',
  'dsp.dynamics.band.high': 'Agudos',
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
