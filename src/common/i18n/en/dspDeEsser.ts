/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's page. `dsp.` keys in a file of their own, as the genre
 * notes are `genre.` keys in theirs: `dsp.ts` is past the size this project
 * allows, and a stage's words are found by the stage's name.
 */
export default {
  'dsp.deEsser.title': 'De-esser',
  'dsp.deEsser.description':
    'Turns down the sharp S, T and SH of a voice only while they sound, and leaves cymbals and the rest of the treble alone.',
  'dsp.deEsser.isolate': 'Isolate',
  'dsp.deEsser.isolateHint': 'Hear only what the De-esser takes away.',
  'dsp.deEsser.isolateOn':
    'Playing only what the De-esser takes away. If you hear cymbals in it, it is taking too much.',

  'dsp.deEsser.group.find': 'Find',
  'dsp.deEsser.group.findHint':
    'Sensitivity is measured against the song’s own level, so a quiet track and a loud one are treated alike.',
  'dsp.deEsser.group.reduce': 'Reduce',
  'dsp.deEsser.group.timing': 'Timing',
  'dsp.deEsser.group.timingHint':
    'Catch the start reacts just before each S, so its first edge is not missed. Let go sets how fast the treble comes back after it.',
  'dsp.deEsser.group.where': 'Where',

  'dsp.deEsser.sensitivity': 'Sensitivity',
  'dsp.deEsser.lowHz': 'From',
  'dsp.deEsser.highHz': 'To',
  'dsp.deEsser.rangeDb': 'Up to',
  'dsp.deEsser.widthOct': 'Width',
  'dsp.deEsser.attackMs': 'Catch the start',
  'dsp.deEsser.releaseMs': 'Let go',
  'dsp.deEsser.keepCymbals': 'Keep cymbals',

  'dsp.deEsser.mode.label': 'How it reduces',
  'dsp.deEsser.mode.spectral': 'Spectral',
  'dsp.deEsser.mode.treble': 'Treble',
  'dsp.deEsser.mode.whole': 'Whole voice',
  'dsp.deEsser.mode.spectralHint':
    'Turns down only the frequencies the S is made of, and follows it as it moves.',
  'dsp.deEsser.mode.trebleHint':
    'Turns down everything above the S, like most de-essers. Firmer, a little duller.',
  'dsp.deEsser.mode.wholeHint':
    'Dips the whole sound for each S, everything under it included, so it can pump. Only for a voice recorded on its own.',

  'dsp.deEsser.where.label': 'Which part of the stereo picture',
  'dsp.deEsser.where.centre': 'Centre',
  'dsp.deEsser.where.all': 'Everything',
  'dsp.deEsser.where.centreHint':
    'Voices sit in the middle and hi-hats are usually to the sides, so it listens and cuts in the centre.',
  'dsp.deEsser.where.allHint':
    'Listens to the whole stereo picture. For mono records, speech and live recordings.',

  'dsp.deEsser.graph.s': 'S at',
  'dsp.deEsser.graph.cut': 'Cut',
  'dsp.deEsser.graph.isolate': 'Only what is taken away',
  'dsp.deEsser.graph.spared': 'Cymbals let through',
  'dsp.deEsser.graph.now': 'now',
  'dsp.deEsser.graph.voice': 'Voice',
  'dsp.deEsser.graph.notVoice': 'Not a voice',
  'dsp.deEsser.graph.threshold': 'Where it starts',
  'dsp.deEsser.engineOld':
    'The FluidEQ Engine installed here is older than the De-esser, so this stage is not heard yet. The rest of the rack plays as before.',
  'dsp.deEsser.upTo': 'up to {db}',
  'dsp.deEsser.lens.trebleNow': 'Treble now',
  'dsp.deEsser.lens.underVoice': '{db} under the voice',
  'dsp.deEsser.lens.ahead': 'heard {ms} ahead',
  'dsp.deEsser.lens.cymbalNeeds': 'a cymbal needs {db} more',
  'dsp.deEsser.lens.cymbal': 'Cymbal',
  'dsp.deEsser.lens.s': 'S',
  'dsp.deEsser.lens.left': 'L',
  'dsp.deEsser.lens.right': 'R',

  'dsp.deEsserPresetGroup.music': 'Music',
  'dsp.deEsserPresetGroup.speech': 'Speech',
  'dsp.deEsserPreset.gentle': 'Gentle',
  'dsp.deEsserPreset.vocalMusic': 'Vocal music',
  'dsp.deEsserPreset.brightHeadphones': 'Bright headphones',
  'dsp.deEsserPreset.harshStreams': 'Harsh streams',
  'dsp.deEsserPreset.live': 'Live recordings',
  'dsp.deEsserPreset.podcast': 'Podcast & speech',
} as const;
