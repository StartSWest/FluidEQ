/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps' page. `dsp.` keys in a file of their own, as the De-esser's are:
 * `dsp.ts` is past the size this project allows, and a stage's words are
 * found by the stage's name. Game names are brands and stay as they are in
 * every language.
 */
export default {
  'dsp.footsteps.title': 'Footsteps',
  'dsp.footsteps.description':
    'Brings up the quiet sounds of a game, like steps, reloads and doors, as they happen. Gunfire, explosions, rain and echoes are left alone, both ears get the same lift, and it adds no delay.',
  'dsp.footsteps.isolate': 'Isolate',
  'dsp.footsteps.isolateHint': 'Hear only what Footsteps adds.',
  'dsp.footsteps.isolateOn':
    'Playing only what Footsteps adds. You should hear steps and other small sounds, never gunfire.',
  'dsp.footsteps.engineOld':
    'Footsteps needs the newest FluidEQ Engine. The rest of the rack is playing; this stage starts once the engine is updated.',

  'dsp.footsteps.lift': 'Lift',
  'dsp.footsteps.liftHint':
    'How far a quiet sound comes up while it arrives. Anything already loud stays as it is.',
  'dsp.footsteps.calm': 'Calm',
  'dsp.footsteps.calmHint':
    'How far an explosion’s rumble comes down. It lets go within a tenth of a second, so the next step is heard.',
  'dsp.footsteps.upTo': 'Up to {db} dB',
  'dsp.footsteps.bands': 'What it lifts',
  'dsp.footsteps.bandsHint':
    'The same lift on every speaker, so a sound stays where it is.',
  'dsp.footsteps.band.weight': 'Weight of a step',
  'dsp.footsteps.band.steps': 'Steps and gear',
  'dsp.footsteps.band.detail': 'Front, back, up and down',

  'dsp.footsteps.graph.now': 'now',
  'dsp.footsteps.graph.lifting': 'Lifting',
  'dsp.footsteps.graph.calming': 'Calming',
  'dsp.footsteps.graph.background': 'Background',
  'dsp.footsteps.graph.isolate': 'Only what it adds',
  'dsp.footsteps.graph.everything': 'Everything',
  'dsp.footsteps.graph.steps': 'Steps band',
  'dsp.footsteps.graph.lifted': 'Lifted',
  'dsp.footsteps.graph.calmed': 'Calmed',

  'dsp.footstepsPresetGroup.games': 'By kind of game',
  'dsp.footstepsPreset.competitive': 'Competitive',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Tactical survival',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Story and horror',
  'dsp.footstepsPreset.storyGames': 'Single-player games and open worlds',
};
