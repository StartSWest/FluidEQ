/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'Dé-esseur',
  'dsp.deEsser.description':
    'Baisse les S, T et CH tranchants d’une voix seulement pendant qu’ils sonnent, et laisse les cymbales et le reste des aigus tranquilles.',
  'dsp.deEsser.isolate': 'Isoler',
  'dsp.deEsser.isolateHint': 'N’entendre que ce que le dé-esseur retire.',
  'dsp.deEsser.isolateOn':
    'Seul ce que le dé-esseur retire est joué. Si vous y entendez des cymbales, il en retire trop.',

  'dsp.deEsser.group.find': 'Trouver',
  'dsp.deEsser.group.findHint':
    'La sensibilité se mesure par rapport au niveau du morceau lui-même : un titre calme et un titre fort sont traités de la même façon.',
  'dsp.deEsser.group.reduce': 'Réduire',
  'dsp.deEsser.group.timing': 'Temporisation',
  'dsp.deEsser.group.timingHint':
    'Saisir le début réagit juste avant chaque S pour ne pas manquer son premier front. Relâcher règle la vitesse à laquelle les aigus reviennent ensuite.',
  'dsp.deEsser.group.where': 'Où',

  'dsp.deEsser.sensitivity': 'Sensibilité',
  'dsp.deEsser.lowHz': 'De',
  'dsp.deEsser.highHz': 'À',
  'dsp.deEsser.rangeDb': 'Jusqu’à',
  'dsp.deEsser.widthOct': 'Largeur',
  'dsp.deEsser.attackMs': 'Saisir le début',
  'dsp.deEsser.releaseMs': 'Relâcher',
  'dsp.deEsser.keepCymbals': 'Épargner les cymbales',

  'dsp.deEsser.mode.label': 'Comment il réduit',
  'dsp.deEsser.mode.spectral': 'Spectral',
  'dsp.deEsser.mode.treble': 'Aigus',
  'dsp.deEsser.mode.whole': 'Voix entière',
  'dsp.deEsser.mode.spectralHint':
    'Baisse seulement les fréquences dont le S est fait, et le suit quand il se déplace.',
  'dsp.deEsser.mode.trebleHint':
    'Baisse tout ce qui est au-dessus du S, comme la plupart des dé-esseurs. Plus ferme, un peu plus terne.',
  'dsp.deEsser.mode.wholeHint':
    'Baisse tout le son à chaque S, y compris tout ce qui joue dessous, et peut donc pomper. Seulement pour une voix enregistrée seule.',

  'dsp.deEsser.where.label': 'Quelle partie de l’image stéréo',
  'dsp.deEsser.where.centre': 'Centre',
  'dsp.deEsser.where.all': 'Tout',
  'dsp.deEsser.where.centreHint':
    'Les voix sont au milieu et les charlestons souvent sur les côtés : il écoute et réduit donc au centre.',
  'dsp.deEsser.where.allHint':
    'Écoute toute l’image stéréo. Pour les disques mono, la parole et les enregistrements live.',

  'dsp.deEsser.graph.s': 'S à',
  'dsp.deEsser.graph.cut': 'Réduction',
  'dsp.deEsser.graph.isolate': 'Seulement ce qui est retiré',
  'dsp.deEsser.graph.spared': 'Cymbales épargnées',
  'dsp.deEsser.graph.now': 'maintenant',
  'dsp.deEsser.graph.voice': 'Voix',
  'dsp.deEsser.graph.notVoice': 'Pas une voix',
  'dsp.deEsser.graph.threshold': 'Où il commence',
  'dsp.deEsser.engineOld':
    'Le FluidEQ Engine installé ici est antérieur au dé-esseur : cet étage ne s’entend donc pas encore. Le reste du rack joue comme avant.',
  'dsp.deEsser.upTo': 'jusqu’à {db}',
  'dsp.deEsser.lens.trebleNow': 'Aigus maintenant',
  'dsp.deEsser.lens.underVoice': '{db} sous la voix',
  'dsp.deEsser.lens.ahead': 'entendu {ms} avant',
  'dsp.deEsser.lens.cymbalNeeds': 'une cymbale doit monter de {db} de plus',
  'dsp.deEsser.lens.cymbal': 'Cymbale',
  'dsp.deEsser.lens.s': 'S',
  'dsp.deEsser.lens.left': 'G',
  'dsp.deEsser.lens.right': 'D',

  'dsp.deEsserPresetGroup.music': 'Musique',
  'dsp.deEsserPresetGroup.speech': 'Parole',
  'dsp.deEsserPreset.gentle': 'Doux',
  'dsp.deEsserPreset.vocalMusic': 'Musique chantée',
  'dsp.deEsserPreset.brightHeadphones': 'Casques brillants',
  'dsp.deEsserPreset.harshStreams': 'Streams durs',
  'dsp.deEsserPreset.live': 'Enregistrements live',
  'dsp.deEsserPreset.podcast': 'Podcast et parole',
} as const;
