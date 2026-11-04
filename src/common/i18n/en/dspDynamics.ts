/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Dynamics stage's page (`dsp.dynamics.*`) and its profiles' names, in a
 * file of their own as the De-esser's and the Game filter's are: `dsp.ts` is
 * past the size this project allows.
 */
export default {
  'dsp.dynamics.title': 'Dynamics',
  'dsp.dynamics.description':
    'Lifts what is quiet and holds what is loud, in three bands, so a whisper and an explosion meet in the middle. It adds no delay.',
  'dsp.dynamics.engineOld':
    'Dynamics needs the newest FluidEQ Engine. The rest of the rack is playing; this filter starts once the engine is updated.',
  'dsp.dynamics.graphLabel': 'What each band does to its level',
  'dsp.dynamics.graphIn': 'In',
  'dsp.dynamics.graphOut': 'Out',
  'dsp.dynamics.band.low': 'Lows',
  'dsp.dynamics.band.lowHint':
    'Under 150 Hz: the boom of a blast, a kick, an engine.',
  'dsp.dynamics.band.mid': 'Middle',
  'dsp.dynamics.band.midHint':
    '150 Hz to 4 kHz: voices, steps and most of the sound.',
  'dsp.dynamics.band.high': 'Highs',
  'dsp.dynamics.band.highHint': 'Over 4 kHz: detail, air, the edge of a step.',
  'dsp.dynamics.lift': 'Lift',
  'dsp.dynamics.hold': 'Hold',
  'dsp.dynamics.upThreshold': 'Below',
  'dsp.dynamics.upRatio': 'Ratio',
  'dsp.dynamics.upMax': 'Up to',
  'dsp.dynamics.downThreshold': 'Above',
  'dsp.dynamics.downRatio': 'Ratio',
  'dsp.dynamics.timing': 'Timing and level',
  'dsp.dynamics.timingHint':
    'How fast a hold arrives and a lift comes back, and how loud the result is.',
  'dsp.dynamics.attack': 'Attack',
  'dsp.dynamics.release': 'Release',
  'dsp.dynamics.makeup': 'Make-up',
  'dsp.dynamics.mix': 'Mix',
  'dsp.dynamicsPreset.gentle': 'Gentle leveling',
  'dsp.dynamicsPreset.speech': 'Speech',
  'dsp.gamingPreset.quietLift': 'Quiet lift',
  'dsp.gamingPreset.blastGuard': 'Blast guard',
  'dsp.gamingPreset.longSession': 'Long session',
  'dsp.gamingPreset.competitiveLight': 'Competitive light',
};
