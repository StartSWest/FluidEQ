/**
 * A song's lyrics between the Library and the Karaoke tab, and removing the
 * lyrics file kept with a song: the Lyrics tab's "Open in Karaoke" and
 * "Remove lyrics", and the Karaoke Maker's "Save to Library". Its own file
 * because `karaoke.ts` is already past the project's length limit.
 */
const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'Open in Karaoke',
  'library.lyrics.karaoke.opening': 'Opening…',
  'library.lyrics.karaoke.hintTimed':
    'Start a karaoke from these timed lyrics and fix their timing in the Maker',
  'library.lyrics.karaoke.hintPlain':
    'Start a karaoke from these lyrics and time them in the Maker',
  'library.lyrics.karaoke.failed': 'This song couldn’t be opened in Karaoke.',
  'library.lyrics.remove.button': 'Remove lyrics',
  'library.lyrics.remove.askFile':
    'Remove {name}? The lyrics file beside the song is deleted.',
  'library.lyrics.remove.askKept':
    'Remove the copy of these lyrics that FluidEQ keeps for this song?',
  'library.lyrics.remove.busy': 'Removing the lyrics…',
  'library.lyrics.remove.confirm': 'Remove',
  'library.lyrics.remove.keep': 'Keep',
  'library.lyrics.remove.inSong':
    'These lyrics are inside the song’s own file. FluidEQ never changes your songs, so they can’t be removed here.',
  'library.lyrics.remove.failed': 'The lyrics couldn’t be removed.',
  'library.lyrics.remove.understood': 'OK',

  'karaoke.maker.song.save': 'Save to Library',
  'karaoke.maker.song.saveHint':
    'Save this timing as the song’s lyrics in the Library',
  'karaoke.maker.song.openedTimed':
    'Opened with the song’s timed lyrics from the Library.',
  'karaoke.maker.song.keptTimed':
    'You were already making a karaoke of this song, so it opened as you left it. Restore original starts again from the song’s lyrics.',
  'karaoke.maker.song.keptPlain':
    'You were already making a karaoke of this song, so it opened as you left it. The song’s lyrics are in the editor if you want them instead.',
  'karaoke.maker.song.savedBeside': 'Saved beside the song as {name}.',
  'karaoke.maker.song.savedKept':
    'Saved in FluidEQ’s lyrics folder: the song’s folder can’t be written.',
  'karaoke.maker.song.untimedLeftOut':
    'Lines without timing were left out ({lines}).',
  'karaoke.maker.song.tagsFirst':
    'The song’s own tags have timed lyrics too, and the Library shows those first.',
  'karaoke.maker.song.nothingTimed': 'Nothing to save yet: no line has a time.',
  'karaoke.maker.song.failed': 'The lyrics couldn’t be saved to the song.',
  'karaoke.maker.song.gone': 'This song is no longer in the Library.',
  'karaoke.maker.song.replaceTitle': 'Replace {name}?',
  'karaoke.maker.song.replaceKeptTitle': 'Replace FluidEQ’s copy?',
  'karaoke.maker.song.replaceBody':
    'The song already has lyrics in {name}. They will be replaced by the timing from the Maker.',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ already keeps lyrics for this song. They will be replaced by the timing from the Maker.',
  'karaoke.maker.song.replace': 'Replace',
} as const;

export default lyricsHandoff;
