/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'De-esser',
  'dsp.deEsser.description':
    'Baja las S, T y SH afiladas de una voz solo mientras suenan, y deja en paz los platillos y el resto de los agudos.',
  'dsp.deEsser.isolate': 'Aislar',
  'dsp.deEsser.isolateHint': 'Escuchar solo lo que quita el De-esser.',
  'dsp.deEsser.isolateOn':
    'Sonando solo lo que quita el De-esser. Si oyes platillos ahí, está quitando demasiado.',

  'dsp.deEsser.group.find': 'Encontrar',
  'dsp.deEsser.group.findHint':
    'La sensibilidad se mide contra el nivel de la propia canción, así que una pista suave y una fuerte se tratan igual.',
  'dsp.deEsser.group.reduce': 'Reducir',
  'dsp.deEsser.group.timing': 'Tiempos',
  'dsp.deEsser.group.timingHint':
    'Atrapar el inicio reacciona justo antes de cada S, para no perder su primer borde. Soltar decide lo rápido que vuelven los agudos después.',
  'dsp.deEsser.group.where': 'Dónde',

  'dsp.deEsser.sensitivity': 'Sensibilidad',
  'dsp.deEsser.lowHz': 'Desde',
  'dsp.deEsser.highHz': 'Hasta',
  'dsp.deEsser.rangeDb': 'Hasta',
  'dsp.deEsser.widthOct': 'Ancho',
  'dsp.deEsser.attackMs': 'Atrapar el inicio',
  'dsp.deEsser.releaseMs': 'Soltar',
  'dsp.deEsser.keepCymbals': 'Respetar platillos',

  'dsp.deEsser.mode.label': 'Cómo reduce',
  'dsp.deEsser.mode.spectral': 'Espectral',
  'dsp.deEsser.mode.treble': 'Agudos',
  'dsp.deEsser.mode.whole': 'Voz entera',
  'dsp.deEsser.mode.spectralHint':
    'Baja solo las frecuencias de las que está hecha la S, y la sigue cuando se mueve.',
  'dsp.deEsser.mode.trebleHint':
    'Baja todo lo que está por encima de la S, como la mayoría de los de-essers. Más firme, algo más apagado.',
  'dsp.deEsser.mode.wholeHint':
    'Baja todo el sonido mientras dura cada S. Natural en la voz hablada, demasiado en la música.',

  'dsp.deEsser.where.label': 'Qué parte de la imagen estéreo',
  'dsp.deEsser.where.centre': 'Centro',
  'dsp.deEsser.where.all': 'Todo',
  'dsp.deEsser.where.centreHint':
    'Las voces van en el medio y los hi-hats suelen ir a los lados, así que escucha y recorta en el centro.',
  'dsp.deEsser.where.allHint':
    'Escucha toda la imagen estéreo. Para discos mono, voz hablada y grabaciones en vivo.',

  'dsp.deEsser.graph.s': 'S en',
  'dsp.deEsser.graph.cut': 'Recorte',
  'dsp.deEsser.graph.isolate': 'Solo lo que se quita',
  'dsp.deEsser.graph.spared': 'Platillos respetados',
  'dsp.deEsser.graph.now': 'ahora',
  'dsp.deEsser.graph.voice': 'Voz',
  'dsp.deEsser.graph.notVoice': 'No es voz',
  'dsp.deEsser.graph.threshold': 'Dónde empieza',
  'dsp.deEsser.engineOld':
    'El FluidEQ Engine instalado aquí es anterior al De-esser, así que esta etapa todavía no se oye. El resto del rack suena como antes.',
  'dsp.deEsser.upTo': 'hasta {db}',

  'dsp.deEsserPresetGroup.music': 'Música',
  'dsp.deEsserPresetGroup.speech': 'Voz hablada',
  'dsp.deEsserPreset.gentle': 'Suave',
  'dsp.deEsserPreset.vocalMusic': 'Música con voz',
  'dsp.deEsserPreset.brightHeadphones': 'Auriculares brillantes',
  'dsp.deEsserPreset.harshStreams': 'Streams ásperos',
  'dsp.deEsserPreset.live': 'Grabaciones en vivo',
  'dsp.deEsserPreset.podcast': 'Pódcast y voz',
} as const;
