/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Pasos',
  'dsp.footsteps.description':
    'Sube los sonidos bajos de un juego, como pasos, recargas y puertas, en el momento en que suenan. Los disparos, las explosiones, la lluvia y los ecos se quedan como están, los dos oídos reciben la misma subida y no añade retardo.',
  'dsp.footsteps.isolate': 'Aislar',
  'dsp.footsteps.isolateHint': 'Escuchar solo lo que añade Pasos.',
  'dsp.footsteps.isolateOn':
    'Suena solo lo que añade Pasos. Deberías oír pasos y otros sonidos pequeños, nunca disparos.',
  'dsp.footsteps.engineOld':
    'Pasos necesita el FluidEQ Engine más reciente. El resto del rack está sonando; esta etapa empieza en cuanto se actualice el motor.',

  'dsp.footsteps.lift': 'Subir',
  'dsp.footsteps.liftHint':
    'Cuánto sube un sonido bajo mientras llega. Lo que ya suena fuerte se queda como está.',
  'dsp.footsteps.calm': 'Calmar',
  'dsp.footsteps.calmHint':
    'Cuánto baja el retumbar de una explosión. Lo suelta en una décima de segundo, para que se oiga el siguiente paso.',
  'dsp.footsteps.upTo': 'Hasta {db} dB',
  'dsp.footsteps.bands': 'Qué sube',
  'dsp.footsteps.bandsHint':
    'La misma subida en todos los altavoces, para que un sonido siga donde está.',
  'dsp.footsteps.band.weight': 'Peso de un paso',
  'dsp.footsteps.band.steps': 'Pasos y equipo',
  'dsp.footsteps.band.detail': 'Delante, detrás, arriba y abajo',

  'dsp.footsteps.graph.now': 'ahora',
  'dsp.footsteps.graph.lifting': 'Subiendo',
  'dsp.footsteps.graph.calming': 'Calmando',
  'dsp.footsteps.graph.background': 'Fondo',
  'dsp.footsteps.graph.isolate': 'Solo lo que añade',
  'dsp.footsteps.graph.everything': 'Todo',
  'dsp.footsteps.graph.steps': 'Banda de los pasos',
  'dsp.footsteps.graph.lifted': 'Subido',
  'dsp.footsteps.graph.calmed': 'Calmado',

  'dsp.footstepsPresetGroup.games': 'Por tipo de juego',
  'dsp.footstepsPreset.competitive': 'Competitivo',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Supervivencia táctica',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Historia y terror',
  'dsp.footstepsPreset.storyGames': 'Juegos para un jugador y mundos abiertos',
};
