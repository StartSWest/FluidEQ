/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Gaming Lab: each game's own sound, copied from a Gaming profile and
 * tuned for that game alone (Ivan, 2026-11-02).
 */
export default {
  'gaming.tab': 'Gaming Lab',
  'gaming.view.games': 'Games',
  'gaming.view.profiles': 'Gaming profiles',
  'gaming.switch': 'Switch when a game is in front',
  'gaming.switch.hint':
    'Off, your games keep your music sound and nothing switches by itself.',
  'gaming.add': 'Add a game',
  'gaming.list.count': 'Your games · {count}',
  'gaming.list.from': 'From {profile}',
  'gaming.list.tuned': 'tuned',
  'gaming.list.playing': 'Playing',
  'gaming.empty.title': 'No games yet',
  'gaming.empty.more':
    'Add a game and it gets a sound of its own, copied from a Gaming profile made for it. You tune the copy here; the profile stays as it was.',
  'gaming.game.where': '{source} · on {output}',
  'gaming.profile.label': 'Gaming profile',
  'gaming.profile.kind.title': 'For this game',
  'gaming.profile.kind.kind': 'By kind',
  'gaming.profile.kind.yours': 'Yours',
  'gaming.profile.kind.chain': 'DSP preset',
  'gaming.profile.gone': 'A profile that is gone',
  'gaming.profile.pickHint':
    'Picking another profile gives this game a fresh copy of it.',
  'gaming.save': 'Save as profile',
  'gaming.save.new': 'Save as a new profile…',
  'gaming.save.newHint':
    'Goes into Yours, so other games can start from it. {game} then starts from it.',
  'gaming.save.update': 'Update {profile}',
  'gaming.save.updateHint':
    'Your profile takes these changes. Games that started from it keep their own copies.',
  'gaming.save.reset': 'Reset to {profile}',
  'gaming.save.resetHint':
    'Throws away this game’s tuning and starts again from the profile.',
  'gaming.save.rename': 'Rename this copy…',
  'gaming.save.delete': 'Delete this copy',
  'gaming.save.deleteHint':
    'Removes this game and its tuning. The profile stays as it is.',
  'gaming.action.unload': 'Unload',
  'gaming.action.unloadHint': 'Your music sound comes back now.',
  'gaming.action.try': 'Try it now',
  'gaming.action.tryHint':
    'Puts {game}’s own sound on now, so you can hear it and tune it.',
  'gaming.status.tuned':
    'This game’s copy of {profile}. Tuned: {parts}. The profile itself is untouched.',
  'gaming.status.tunedNamed':
    '{copy}: this game’s copy of {profile}. Tuned: {parts}. The profile itself is untouched.',
  'gaming.status.same':
    'Same as the profile. Whatever you change here stays with this game; the profile itself never changes.',
  'gaming.rail.game': 'Game',
  'gaming.rail.sound': 'Sound',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'tuned',
  'gaming.stage.footsteps': 'Game filter',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'Curve',
  'gaming.curve.any': 'Any game',
  'gaming.editor.notLoaded': '{game}’s own sound isn’t playing',
  'gaming.editor.notLoadedMore':
    'Try it now to hear it and tune it right here. Your music sound comes back with Unload, or when the game closes.',
  'gaming.editor.eqNote':
    'This game’s own bands, drawn on the graph above when it is showing.',
  'gaming.editor.curveNote':
    'The headphone correction this game plays, from your curves or a headphone’s, and every curve applied with it — each with its × to take it off.',
  'gaming.saveDialog.title': 'Save as a Gaming profile',
  'gaming.saveDialog.hint':
    'Other games can start from it, in the Gaming profiles list.',
  'gaming.saveDialog.placeholder': 'Profile name',
  'gaming.renameDialog.title': 'Rename this copy',
  'gaming.renameDialog.hint': 'Only this game’s copy takes the name.',
  'gaming.renameDialog.placeholder': 'Copy name',
  'gaming.addDialog.title': 'Add a game',
  'gaming.addDialog.intro':
    'Pick the game. It starts from a Gaming profile and gets its own copy: tune the copy for this game, the profile itself never changes.',
  'gaming.addDialog.running': 'Running now',
  'gaming.addDialog.installed': 'Found on this PC',
  'gaming.addDialog.startsFrom': 'Starts from',
  'gaming.addDialog.browse': 'Not here? Browse for the game’s program…',
  'gaming.addDialog.later':
    'You can pick another Gaming profile for it any time.',
  'gaming.addDialog.add': 'Add {game}',
  'gaming.addDialog.cancel': 'Cancel',
  'gaming.addDialog.loading': 'Looking for your games…',
  'gaming.addDialog.none':
    'None of your launchers lists a game that isn’t here yet. Browse for the game’s program instead.',
  'gaming.addDialog.close': 'Close',
  'gaming.profiles.intro':
    'A game takes its own copy of a profile. You tune the copy; the profile never changes.',
  'gaming.profiles.search': 'Search profiles and games',
  'gaming.profiles.searchClear': 'Clear the search',
  'gaming.profiles.noMatch': 'No Gaming profile matches “{query}”.',
  'gaming.profiles.filterLabel': 'Show',
  'gaming.profiles.noCurve': 'No curve: as the game was mixed',
  'gaming.profiles.filter.all': 'All',
  'gaming.profiles.filter.yours': 'Yours',
  'gaming.profiles.yours': 'Yours · saved from a game’s copy',
  'gaming.profiles.yoursEmpty':
    'None yet. Tune a game and use Save as profile to keep its sound here.',
  'gaming.profiles.readyGroup': 'Ready-made · {group}',
  'gaming.profiles.savedFrom': 'Saved from {game}’s copy',
  'gaming.profiles.usedBy': '{games} started from it',
  'gaming.profiles.use': 'Use for a game',
  'gaming.profiles.rename': 'Rename',
  'gaming.profiles.delete': 'Delete',
  'gaming.profiles.confirmDelete': 'Delete it? Games keep their own copies.',
  'gaming.profiles.keep': 'Keep',
  'gaming.profiles.renameTitle': 'Rename Gaming profile',
  'gaming.profiles.renameHint':
    'Games that started from it keep their copies; only the name changes.',
  'gaming.toast.loaded': 'Its own sound is on',
  'gaming.toast.restored': 'Your music sound is back',
  'gaming.paused.notice': 'Paused: {game}’s own sound is playing',
  'gaming.paused.tune': 'Tune {game}',
  'gaming.paused.title': 'Your music rack is waiting',
  'gaming.paused.body':
    'While {game} plays, its own sound is on and this rack is paused. It comes back exactly as it was when the game closes, or now with Unload.',
  'gaming.paused.stages': '{preset} · what comes back',
  'gaming.paused.none': 'Every stage in it is switched off.',
  'gaming.profileSelect.game': '{game} · game sound',
  'gaming.preset.tuned': '{game} (custom)',
  'gaming.preset.openHint':
    '{game}’s own sound is loaded. Its preset is changed in the Gaming Lab.',
  'gaming.now.hint': '{game}’s own sound is playing. Show the game.',
} as const;
