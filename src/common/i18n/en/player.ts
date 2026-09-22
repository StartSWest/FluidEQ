/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The compact player the window turns into, and the switch that does it.
 *
 * The keys on its decks are words on hardware: short, and set in capitals by
 * the stylesheet, so `player.deck.*` and the `player.eq` key labels stay one
 * word wherever a language allows it.
 */
export default {
  'player.aria': 'FluidEQ player',
  'player.menu': 'Player menu',
  'player.menu.fullApp': 'Back to the full app',
  'player.menu.openIn': 'Open in the full app',
  'player.menu.alwaysOnTop': 'Always on top',
  'player.menu.fold': 'Fold to one line',
  'player.menu.foldHint': 'Double-click the strip',
  'player.unfold': 'Unfold',
  'player.switch.name': 'Compact player',
  'player.switch.toPlayer': 'Switch to the compact player',
  'player.switch.toApp': 'Back to the full app',
  'player.deck.aria': 'Now playing',
  'player.deck.eqHint': 'Show or hide the equalizer',
  'player.deck.vis': 'Vis',
  'player.deck.visHint': 'Show or hide the visualizer',
  'player.deck.queue': 'Queue',
  'player.deck.queueHint': 'Show or hide what plays next',
  'player.clock.aria': 'Time played or time left',
  'player.clock.hint': 'Click to switch between time played and time left',
  'player.well.aria': 'Spectrum analyzer',
  'player.well.hint': 'Click to switch between bars and the wave',
  'player.readout.level': 'Output level',
  'player.readout.rate': 'Sample rate',
  'player.readout.channels': "The output's channel layout",
  'player.readout.stereo': 'Stereo',
  'player.readout.mono': 'Mono',
  'player.unit.db': 'dB',
  'player.unit.ms': 'ms',
  'player.unit.khz': 'kHz',
  'player.volume.system': 'System volume',
  'player.seek': 'Position in the song',
  'player.seekNone': 'This source cannot jump to another point in the song',
  'player.eq.aria': 'Equalizer',
  'player.eq.on': 'On',
  'player.eq.onHint': 'Turn FluidEQ on or off',
  'player.eq.short': 'EQ',
  'player.eq.smart': 'Smart',
  'player.eq.song': 'Song',
  'player.eq.songSaves': 'Saves for this song',
  'player.eq.curve': 'Equalizer curve',
  'player.eq.nothingApplied': 'Nothing else is applied',
  'player.eq.pre': 'Pre',
  'player.eq.auto': 'Auto',
  'player.eq.autoHint': 'Turn on Auto normalize',
  'player.vis.aria': 'Visualizer',
  'player.vis.resize': 'Drag to resize the visualizer and the queue',
  'player.queue.summary': '{position} of {total}',
  'player.queue.leftHint': '{duration} left in the queue',
  'player.queue.play': 'Play {title}',
  'player.queue.openLibraryHint': 'Open the Library in the full app',
  'player.mark.hint':
    'Next look · Ctrl for the one before · Right-click for all of them',
  'player.queue.drop': 'Drop music here',
  'player.queue.emptyTitle': 'Nothing queued',
  'player.queue.emptyNote':
    'Songs you play from the Library line up here — or drop music files here.',
};
