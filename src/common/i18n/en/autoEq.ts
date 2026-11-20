/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel's old switch's place. */
export default {
  'autoEq.title': 'Auto EQ',
  'autoEq.aria': 'Auto EQ: what decides each song’s sound',
  'autoEq.tagline': 'Each song’s sound, chosen for you',
  'autoEq.state.measuring': 'Measuring',
  'autoEq.state.paused': 'Paused',
  'autoEq.state.song': 'Song',
  'autoEq.state.album': 'Album',
  'autoEq.state.yours': 'Yours',
  'autoEq.aside':
    'Stepping aside while DSP is off, a Gaming chain is on or a game plays its own sound. It comes back as it was.',
  'autoEq.now.nothing': 'Nothing playing',
  'autoEq.now.yours': 'your sound',
  'autoEq.now.yoursWhy':
    'Nothing saved for this song: it plays the last sound you picked.',
  'autoEq.now.song': 'this song’s sound',
  'autoEq.now.songWhy': 'Comes back every time this song plays.',
  'autoEq.now.album': '{album}’s sound',
  'autoEq.now.albumUnnamed': 'its album’s sound',
  'autoEq.now.albumWhy': 'Set in the Library for the whole album.',
  'autoEq.songs.title': 'Song sounds',
  'autoEq.songs.hint':
    'A song with a saved sound plays it. Change it and press Save changes to keep it. Other songs play yours.',
  'autoEq.songs.nothing': 'Play a song to save its sound',
  'autoEq.songs.saved': 'Saved for this song',
  'autoEq.songs.none': 'Nothing saved for this song',
  'autoEq.songs.save': 'Save for this song',
  'autoEq.songs.forget': 'Forget',
  'autoEq.button.save': 'Save',
  'autoEq.state.changed': 'Changed',
  'autoEq.songs.changed': 'Changed, not saved',
  'autoEq.songs.revert': 'Back to saved',
  'autoEq.songs.saveChanges': 'Save changes',
  'autoEq.button.saveFor': 'Save what plays for {title}',
  'autoEq.button.saved': 'Saved',
  'autoEq.holds.preset': 'Preset',
  'autoEq.holds.eq': 'Your EQ',
  'autoEq.holds.curves': 'Curves',
  'autoEq.holds.bands': '{count} bands',
  'autoEq.holds.bandsOne': '1 band',
  'autoEq.holds.flat': 'Flat',
  'autoEq.holds.none': 'None',
  'autoEq.holds.curve': '{preset} curve',
  'autoEq.holds.correction': 'Headphone correction stays with the output',
  'autoEq.albums.title': 'Album sounds',
  'autoEq.albums.hint':
    'Library only. Every song on the album plays it, except a song with its own preset.',
  'autoEq.albums.nothing': 'Set an album’s sound on its page in the Library',
  'autoEq.albums.libraryOnly': 'Library only: not for other players',
  'autoEq.albums.set': '{album}: {preset}',
  'autoEq.albums.none': 'This album has no sound set',
  'autoEq.smart.title': 'Smart correction',
  'autoEq.smart.hint':
    'Measures each song from the source and keeps its correction for that song. On top of any preset.',
  'autoEq.smart.modes': 'How it corrects',
  'autoEq.smart.waiting': 'Waiting for a song',
  'autoEq.smart.willSave': 'Saved for this song when it ends',
  'autoEq.smart.savesIn': 'Saved for this song in {remaining}',
  'autoEq.smart.onceHint': 'One measurement of what plays, applied at once',
  'autoEq.smart.once': 'Measure once',
  'autoEq.smart.phase.listening': 'Listening',
  'autoEq.smart.phase.settling': 'Settling',
  'autoEq.smart.phase.held': 'Held for this song',
  'autoEq.smart.phase.paused': 'Paused',
  'autoEq.smart.heard': '{seconds} s',
  'autoEq.smart.note.listening':
    'What plays now keeps playing until this song’s correction holds.',
  'autoEq.smart.note.waitingOn':
    'Waiting on {ranges}. What plays now keeps playing until this song’s correction holds.',
  'autoEq.smart.note.settling':
    'Checking the curve has stopped moving before it is written.',
  'autoEq.smart.note.held':
    'Measuring has stopped. It listens again on the next song.',
  'autoEq.smart.note.heldMissing':
    'Not on this record, so left alone: {ranges}. Measuring has stopped.',
  'autoEq.smart.note.heldShort':
    'Too little of the record to correct, so the sound stays as it was.',
  'autoEq.smart.again': 'Measure again',
  'autoEq.smart.againHint':
    'Listen to this song again and replace its correction',
  'autoEq.savedCount': 'Saved: {songs} · {albums}',
  'autoEq.manage': 'Manage',
  'autoEq.manage.title': 'Saved sounds',
  'autoEq.manage.back': 'Back to Auto EQ',
  'autoEq.manage.songs': 'Songs',
  'autoEq.manage.albums': 'Albums',
  'autoEq.manage.search': 'Search saved sounds',
  'autoEq.manage.wholeSound': '{preset} with its Tone and EQ',
  'autoEq.manage.forget': 'Forget',
  'autoEq.manage.others': 'Songs from other players: {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube and the browser. Their names are never kept.',
  'autoEq.manage.empty': 'Nothing saved yet',
  'autoEq.manage.noMatch': 'Nothing matches',
  'autoEq.manage.resetKeeps':
    'Reset all settings keeps these. Only Forget removes them.',
  'autoEq.manage.forgetAll': 'Forget all',
  'autoEq.manage.forgetAllConfirm': 'Forget all, for good',
  'autoEq.moved.title': 'Each song’s sound is in Auto EQ now',
  'autoEq.moved.body':
    'Remember each song’s sound moved to Auto EQ on the EQ page. Your {count} saved songs came with it.',
  'autoEq.moved.bodyOne':
    'Remember each song’s sound moved to Auto EQ on the EQ page. Your saved song came with it.',
  'autoEq.moved.open': 'Open Auto EQ',
  'autoEq.moved.dismiss': 'Got it',
};
