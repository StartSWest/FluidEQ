/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Game filter's page (`dsp.footsteps.*` from when it was Footsteps
 * alone, `dsp.game.*` for its other parts). `dsp.` keys in a file of their
 * own, as the De-esser's are: `dsp.ts` is past the size this project allows,
 * and a stage's words are found by the stage's name. Game names are brands
 * and stay as they are in every language.
 */
export default {
  'dsp.footsteps.title': 'Game',
  'dsp.footsteps.description':
    'Everything that makes a game sound right: quiet steps brought up as they happen, voices forward, the weather and hum of a level turned down or up, and the world around you. It adds no delay.',
  'dsp.footsteps.isolate': 'Isolate',
  'dsp.footsteps.isolateHint': 'Hear only what Game changes.',
  'dsp.footsteps.isolateOn':
    'Playing only what Game changes. You should hear steps and small sounds come up, never gunfire.',
  'dsp.footsteps.engineOld':
    'Game needs the newest FluidEQ Engine. The rest of the rack is playing; this filter starts once the engine is updated.',

  'dsp.footsteps.lift': 'Lift',
  'dsp.footsteps.liftHint':
    'How far a quiet sound comes up while it arrives. Anything already loud stays as it is.',
  'dsp.footsteps.calm': 'Calm',
  'dsp.footsteps.upTo': 'Up to {db} dB',
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

  'dsp.footstepsPresetGroup.kinds': 'By kind of game',
  'dsp.footstepsPresetGroup.competitive': 'Competitive shooters',
  'dsp.footstepsPresetGroup.battle': 'Battle royale and large battles',
  'dsp.footstepsPresetGroup.tactical': 'Tactical and survival',
  'dsp.footstepsPresetGroup.moba': 'MOBA and strategy',
  'dsp.footstepsPresetGroup.rpg': 'MMO and RPG',
  'dsp.footstepsPresetGroup.story': 'Story and horror',
  'dsp.footstepsPreset.competitive': 'Competitive',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Tactical survival',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Story and horror',
  'dsp.footstepsPreset.storyGames': 'Single-player games and open worlds',
  'dsp.footstepsPreset.immersive': 'Any game, the Room around you',
  'dsp.footstepsPreset.immersiveGames': 'Stereo games on headphones',
  'dsp.footstepsPreset.topDown': 'Top-down',
  'dsp.footstepsPreset.topDownGames': 'MOBA, RTS, strategy',
  'dsp.footstepsPreset.worlds': 'Worlds',
  'dsp.footstepsPreset.worldsGames': 'MMO, open-world RPG',
  'dsp.footstepsPreset.speed': 'Speed',
  'dsp.footstepsPreset.speedGames': 'Racing and driving',
  'dsp.footstepsPreset.impact': 'Impact',
  'dsp.footstepsPreset.impactGames': 'Fighting, action, sports',

  'dsp.game.hintOwn3d': 'Its own 3D sound',
  'dsp.game.hintRoom': 'Room: {room}',
  'dsp.game.noteOwn3d':
    '{game} places its sounds around you itself, so the Room stays off: two of them would put a step in two places.',
  'dsp.game.noteRoom': '{game}: on headphones, the Room puts it in {room}.',
  'dsp.game.hintNoRoom': 'Best without the Room',
  'dsp.game.noteNoRoom':
    '{game} is at its most frightening as it was mixed, so the Room stays off.',
  'dsp.game.engineOld':
    'Dialogue, Environment and the hooves need the newest FluidEQ Engine. Footsteps already plays; the rest starts once the engine is updated.',

  'dsp.game.footsteps': 'Footsteps',
  'dsp.game.heavy': 'Hooves and heavy steps',
  'dsp.game.heavyHint': 'The low thud of a boot or a horse comes up too.',

  'dsp.game.dialogue': 'Dialogue',
  'dsp.game.dialogueHint':
    'While someone speaks in the middle of the scene, their voice comes forward.',
  'dsp.game.voices': 'Voices',
  'dsp.game.duck': 'Make room for voices',
  'dsp.game.duckHint':
    'Music and effects step back a little while a line is spoken.',
  'dsp.game.voiceMeter': 'Someone speaking',

  'dsp.game.environment': 'Environment',
  'dsp.game.environmentHint':
    'The weather and hum of a level: rain, wind, the drone of a room. Down to hear the cues over it, up for the atmosphere.',
  'dsp.game.environmentDial': 'Ambience',
  'dsp.game.environmentDown': 'Down by up to {db} dB',
  'dsp.game.environmentUp': 'Up by up to {db} dB',
  'dsp.game.environmentLeft': 'As the game made it',
  'dsp.game.ambienceMeter': 'Environment heard',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'Gaming',
  'dsp.deEsserPresetGroup.gaming': 'Gaming',
  'dsp.gamingPreset.tightLows': 'Tight lows',
  'dsp.gamingPreset.impact': 'Impact',
  'dsp.gamingPreset.night': 'Night',
  'dsp.gamingPreset.positionSafe': 'Position safe',
  'dsp.gamingPreset.openWorld': 'Open world',
  'dsp.gamingPreset.battlefieldView': 'Battlefield view',
  'dsp.gamingPreset.cleanCeiling': 'Clean ceiling',
  'dsp.gamingPreset.battle': 'Battle',
  'dsp.gamingPreset.cinematicPunch': 'Cinematic punch',
  'dsp.gamingPreset.rumble': 'Rumble on small drivers',
  'dsp.gamingPreset.engineWeight': 'Engine weight',
  'dsp.gamingPreset.cueDetail': 'Cue detail',
  'dsp.gamingPreset.dullHeadset': 'Dull headset',
  'dsp.gamingPreset.callouts': 'Callouts',
  'dsp.gamingPreset.footstepFocus': 'Footstep focus',
  'dsp.gamingPreset.blastTamer': 'Blast tamer',
  'dsp.gamingPreset.voicesForward': 'Voices forward',
  'dsp.gamingPreset.cinematicWeight': 'Cinematic weight',
  'dsp.gamingPreset.dread': 'Dread',
  'dsp.gamingPreset.engineTyres': 'Engine and tyres',
  'dsp.gamingPreset.abilityClarity': 'Ability clarity',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'Pinpoint',
  'dsp.gamingChain.blast': 'Survive the blast',
  'dsp.gamingChain.stealth': 'Stealth',
  'dsp.gamingChain.cinematic': 'Cinematic',
  'dsp.gamingChain.dread': 'Dread',
  'dsp.gamingChain.topDown': 'Top-down',
  'dsp.gamingChain.worlds': 'Worlds',
  'dsp.gamingChain.speed': 'Speed',
  'dsp.gamingChain.impact': 'Impact',
  'dsp.gamingChain.night': 'Night play',
};
