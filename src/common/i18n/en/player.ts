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
  'player.menu.fullAppHint': 'On the page you left',
  'player.menu.openIn': 'Open in the full app',
  'player.menu.alwaysOnTop': 'Always on top',
  'player.menu.fold': 'Fold to one line',
  'player.unfold': 'Unfold',
  'player.switch.name': 'Compact player',
  'player.switch.toPlayer': 'Switch to the compact player',
  'player.switch.toApp': 'Back to the full app',
  'player.deck.aria': 'Now playing',
  'player.transport': 'Playback controls',
  'player.clock.aria': 'Time played or time left',
  'player.clock.hint': 'Click to switch between time played and time left',
  'player.readout.level': 'Output level',
  'player.readout.rate': 'Sample rate',
  'player.unit.db': 'dB',
  'player.unit.ms': 'ms',
  'player.unit.khz': 'kHz',
  'player.path.open': 'Open {name}',
  'player.volume.system': 'System volume',
  'player.seek': 'Position in the song',
  'player.seekNone': 'This source cannot jump to another point in the song',
  'player.eq.aria': 'Equalizer',
  'player.eq.onHint': 'Turn FluidEQ on or off',
  'player.eq.smart': 'Smart',
  'player.eq.song': 'Song',
  'player.eq.pre': 'Pre',
  'player.eq.auto': 'Auto',
  'player.eq.autoHint': 'Turn on Auto normalize',
  'player.queue.leftHint': '{duration} left in the queue',
  'player.queue.play': 'Play {title}',
  'player.queue.openLibraryHint': 'Open the Library in the full app',
  'player.queue.drop': 'Drop music here',
  'player.queue.emptyTitle': 'Nothing queued',
  'player.queue.emptyNote':
    'Songs you play from the Library line up here — or drop music files here.',
  'player.sound.title': 'Sound',
  'player.sound.fold': 'Fold the sound controls',
  'player.sound.unfold': 'Show the sound controls',
  'player.sound.bands': '{count}-band EQ',
  'player.sound.on': 'EQ on',
  'player.sound.off': 'EQ off',
  'player.queue.fold': 'Fold the queue',
  'player.queue.unfold': 'Show the queue',
  'player.queue.save': 'Save as playlist',
  'player.playlists.emptyTitle': 'No playlists here yet',
  'player.playlists.emptyNote':
    'Open the Library once and your playlists and Favourites appear here.',
  'player.foot.on': '{engine} on',
  'player.foot.off': '{engine} off',
  'player.eq.pageBack': 'Previous bands',
  'player.eq.pageOn': 'More bands',
  'player.heightGrip': 'Drag to change the height',
};
