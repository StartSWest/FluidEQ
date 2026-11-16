/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The Library's tag editor: where it opens, one song's panel, the album,
 * folder and selection editor, and writing. Its own file because
 * `library.ts` is long already.
 */
const libraryTags = {
  // Where it opens
  'library.tags.menu.edit': 'Edit tags…',
  'library.tags.menu.editMany': 'Edit tags of {count} songs…',
  'library.tags.menu.editAlbum': 'Edit album tags…',
  'library.tags.menu.cover': 'Change cover…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count} songs',
  'library.tags.selection.edit': 'Edit tags',
  'library.tags.selection.clear': 'Clear selection',

  // The fields, the same names in every format
  'library.tags.field.title': 'Title',
  'library.tags.field.artist': 'Artist',
  'library.tags.field.composer': 'Composer',
  'library.tags.field.album': 'Album',
  'library.tags.field.albumArtist': 'Album artist',
  'library.tags.field.trackNo': 'Track',
  'library.tags.field.trackTotal': 'Track total',
  'library.tags.field.discNo': 'Disc',
  'library.tags.field.discTotal': 'Disc total',
  'library.tags.field.year': 'Year',
  'library.tags.field.genre': 'Genre',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'Comment',
  'library.tags.field.grouping': 'Grouping',
  'library.tags.field.publisher': 'Label',
  'library.tags.field.copyright': 'Copyright',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'Conductor',
  'library.tags.field.subtitle': 'Subtitle',
  'library.tags.field.remixer': 'Remixed by',
  'library.tags.field.initialKey': 'Key',
  'library.tags.field.compilation': 'Compilation',
  'library.tags.field.titleSort': 'Sort title',
  'library.tags.field.artistSort': 'Sort artist',
  'library.tags.field.albumSort': 'Sort album',
  'library.tags.field.albumArtistSort': 'Sort album artist',
  'library.tags.field.composerSort': 'Sort composer',
  'library.tags.field.musicBrainzTrackId': 'MusicBrainz recording',
  'library.tags.field.musicBrainzReleaseId': 'MusicBrainz release',
  'library.tags.field.musicBrainzArtistId': 'MusicBrainz artist',
  'library.tags.field.musicBrainzReleaseArtistId': 'MusicBrainz album artist',
  'library.tags.field.musicBrainzReleaseGroupId': 'MusicBrainz release group',

  // One song: the side panel
  'library.tags.panel.title': 'Edit tags',
  'library.tags.panel.position': '{index} of {count}',
  'library.tags.panel.previous': 'Previous song (Alt+↑)',
  'library.tags.panel.next': 'Next song (Alt+↓)',
  'library.tags.panel.close': 'Close (Esc) — edits wait',
  'library.tags.panel.reading': 'Reading the file’s tags…',
  'library.tags.panel.readFailed':
    'The tags of this file couldn’t be read. It may be damaged or in use.',
  'library.tags.panel.missing': 'This song is no longer on disk.',
  'library.tags.panel.unsupported':
    'FluidEQ doesn’t edit the tags of this kind of file.',
  'library.tags.group.song': 'Song',
  'library.tags.group.album': 'Album',
  'library.tags.group.details': 'Details',
  'library.tags.group.file': 'File',
  'library.tags.of': 'of',
  'library.tags.sameAsArtist': 'Same as artist',
  'library.tags.putBack': 'Put back',
  'library.tags.noArtist': 'No artist',
  'library.tags.noAlbum': 'No album',
  'library.tags.genre.inLibrary': 'In your Library',
  'library.tags.tip.fileName': 'The title is the file name. Use {title}?',
  'library.tags.tip.fileNameTrack':
    'The title is the file name. Use {title}, track {track}?',
  'library.tags.tip.use': 'Use',

  // The cover
  'library.tags.cover.dropHint': 'Drop or paste an image',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'No cover in this file',
  'library.tags.cover.new': 'New cover · {width} × {height}',
  'library.tags.cover.removed': 'Cover removed on save',
  'library.tags.cover.refused': 'Only a JPEG or PNG image up to 20 MB.',
  'library.tags.cover.emptyClipboard': 'There’s no image on the clipboard.',

  // More fields
  'library.tags.more.toggle': 'More fields',
  'library.tags.more.count': '{count} in this file · add any',
  'library.tags.more.countNone': 'add any',
  'library.tags.more.add': 'Add a field',
  'library.tags.more.addHint': 'Any field the format allows, by its code.',
  'library.tags.more.code': 'Code',
  'library.tags.more.value': 'Value',
  'library.tags.more.addConfirm': 'Add',
  'library.tags.more.badCode':
    'This file’s format can’t keep that code as text.',

  // The file
  'library.tags.file.format': 'Format',
  'library.tags.file.tags': 'Tags in file',
  'library.tags.file.noTags': 'No tags',
  'library.tags.file.writeAs': 'Write as',
  'library.tags.file.keep': 'Keep {version}',
  'library.tags.file.v23Note':
    'v2.3 is what Windows Explorer, car stereos and older players read best. v2.4 stores UTF-8 and several values per field.',
  'library.tags.file.v24Note':
    'Windows Explorer and some car stereos read v2.4 poorly; v2.3 is the safe choice if this file travels.',
  'library.tags.file.id3v1': 'Keep the old ID3v1 tag in step',
  'library.tags.file.readOnly':
    'This file is read-only. You’ll be asked before it’s written.',

  // The foot
  'library.tags.foot.none': 'No changes',
  'library.tags.foot.noneHint': 'Edits wait while you walk the album',
  'library.tags.foot.changes': '{count} unsaved changes',
  'library.tags.foot.changesOne': '1 unsaved change',
  'library.tags.foot.inSongs': 'in {count} songs',
  'library.tags.foot.inSongsOne': 'in 1 song',
  'library.tags.revert': 'Revert',
  'library.tags.save': 'Save',
  'library.tags.saveSongs': 'Save {count} songs',
  'library.tags.saveFailed':
    'Some values couldn’t be written as typed. Check the marked fields.',

  // An album, a folder or a selection
  'library.tags.set.album': 'Album',
  'library.tags.set.reading': 'Reading tags · {done} of {count}',
  'library.tags.set.use': 'Use {value}',
  'library.tags.set.coversMixed': '{count} different covers',
  'library.tags.set.coversNone': '{count} songs have none',
  'library.tags.set.coverOne': 'One cover for all',
  'library.tags.set.coverNoneAll': 'No song has a cover',
  'library.tags.set.coverToAll': 'To all {count} songs',
  'library.tags.set.songs': 'Songs',
  'library.tags.set.renumber': 'Renumber by order',
  'library.tags.set.fixAuto': 'Fix tags automatically',
  'library.tags.set.moreFields': 'More fields ({fields})',
  'library.tags.set.varies': 'Varies:',
  'library.tags.set.variesMore': 'and {count} more',
  'library.tags.set.variesPlaceholder': 'Varies · type one for all',
  'library.tags.set.useForAll': 'Use for all {count} songs',
  'library.tags.set.found': '{count} songs found',
  'library.tags.set.foundOne': '1 song found',
  'library.tags.set.foundNone': 'No title has it',
  'library.tags.cover.change': 'Change cover',
  'library.tags.cover.changeShort': 'Change',
  'library.tags.cover.chooseImage': 'Choose a picture…',
  'library.tags.cover.pasteImage': 'Paste from the clipboard',
  'library.tags.cover.removeCover': 'Remove the cover',
  'library.tags.set.find': 'Find in titles',
  'library.tags.set.replaceWith': 'Replace with',
  'library.tags.set.replaceAll': 'Replace all',
  'library.tags.set.sheetHint':
    'Enter moves down · Tab moves right · Ctrl+D copies the cell above · drag a row by its grip to reorder, then Renumber.',
  'library.tags.set.col.no': '#',
  'library.tags.set.col.time': 'Time',
  'library.tags.set.grip': 'Drag to reorder',
  'library.tags.set.missingCell': 'missing',
  'library.tags.set.groupSongs': '{count} songs',
  'library.tags.set.changes': '{count} changes',
  'library.tags.set.changesOne': '1 change',
  'library.tags.set.files': '{count} files · nothing written yet',
  'library.tags.set.filesOne': '1 file · nothing written yet',
  'library.tags.set.discard': 'Discard',
  'library.tags.set.back': 'Back',
  'library.tags.set.leaveAsk': 'Leave without saving these changes?',
  'library.tags.set.keepEditing': 'Keep editing',
  'library.tags.set.unreadable':
    '{count} songs couldn’t be read and are left out.',

  // Writing
  'library.tags.write.progress': 'Writing tags · {done} of {count}',
  'library.tags.write.undoing': 'Putting tags back · {done} of {count}',
  'library.tags.write.background': 'Continue in background',
  'library.tags.write.show': 'Show',
  'library.tags.write.cancel': 'Cancel',
  'library.tags.write.written': '{done} of {count} written',
  'library.tags.write.needYou': '{count} need you',
  'library.tags.write.review': 'Review {count} files',
  'library.tags.write.reviewOne': 'Review 1 file',
  'library.tags.write.done': '{count} files updated',
  'library.tags.write.doneOne': '1 file updated',
  'library.tags.write.doneNote':
    'The previous tags are kept — Undo puts them all back.',
  'library.tags.write.undo': 'Undo',
  'library.tags.write.undone': 'Undone',
  'library.tags.write.undoneNote':
    'Every file has its previous tags again, cover included.',
  'library.tags.write.stopped': 'Stopped after {done} of {count}',
  'library.tags.write.stoppedNote':
    'The files already written keep their new tags; Undo puts them back.',
  'library.tags.write.failed': '{count} couldn’t be written',
  'library.tags.write.failedOne': '1 couldn’t be written',
  'library.tags.write.dismiss': 'Dismiss',
  'library.tags.problems.title': '{count} files need you',
  'library.tags.problems.titleOne': '1 file needs you',
  'library.tags.problems.allHandled': 'All handled',
  'library.tags.problems.waiting': '{count} wait for their song to end',
  'library.tags.problems.waitingOne': '1 waits for its song to end',
  'library.tags.problems.held':
    'Playing now in FluidEQ — written the moment the song ends.',
  'library.tags.problems.locked':
    'Open in another program. Close it there, then retry.',
  'library.tags.problems.readOnly':
    'This file is read-only, so it can’t be changed as it is.',
  'library.tags.problems.failed':
    'This file couldn’t be written. It’s unchanged; nothing was lost.',
  'library.tags.problems.missing':
    'This file is no longer where the Library found it.',
  'library.tags.problems.retry': 'Retry',
  'library.tags.problems.skip': 'Skip',
  'library.tags.problems.makeWritable': 'Make writable and write',
  'library.tags.problems.skipAll': 'Skip all',
  'library.tags.problems.nothingToDo': 'Nothing to do.',
  'library.tags.problems.everythingElse': 'Everything else is written',
  'library.tags.problems.undoCovers': 'Undo covers these too',

  // Fix tags automatically
  'library.tags.menu.fix': 'Fix tags automatically…',
  'library.tags.menu.fixAlbum': 'Fix this album…',
  'library.tags.menu.fixShortcut': 'Ctrl+Shift+I',
  'library.tags.hero.fix': 'Fix tags',
  'library.tags.selection.fix': 'Fix',
  'library.tags.fix.leadNone':
    'Nothing to fix from the songs’ tags and file names.',
  'library.tags.fix.source.fileName': 'File name',
  'library.tags.fix.source.capitals': 'Capitals',
  'library.tags.fix.source.junk': 'Clean-up',
  'library.tags.fix.source.majority': 'Album majority',
  'library.tags.fix.source.count': 'Song count',
  'library.tags.fix.source.spelling': 'Your spelling',
  'library.tags.fix.source.hand': 'Changed by you',
  'library.tags.fix.songsAll': 'All {count}',
  'library.tags.fix.empty': 'empty',
  'library.tags.fix.apply': 'Apply this change',
  'library.tags.fix.rules.fileNames': 'Titles from file names',
  'library.tags.fix.rules.patternNeedsTitle': 'The pattern needs %title%',
  'library.tags.fix.rules.preview': '{file} → track {track}, title {title}',
  'library.tags.fix.rules.previewTitle': '{file} → title {title}',
  'library.tags.fix.rules.previewNone':
    'No file name in this album fits the pattern',
  'library.tags.fix.rules.strip': 'Strip from titles',
  'library.tags.fix.rules.stripPlaceholder': 'Text to take out',
  'library.tags.fix.rules.stripAdd': 'Add',
  'library.tags.fix.rules.stripRemove': 'Remove {text}',
  'library.tags.fix.rules.capitals': 'Capitals',
  'library.tags.fix.rules.capsReleased': 'As released',
  'library.tags.fix.rules.capsTitle': 'Title Case',
  'library.tags.fix.rules.capsSentence': 'Sentence',
  'library.tags.fix.rules.capsNote':
    '“de”, “la”, “en”, “y”, “of”, “the” stay lower-case inside a title; “¡” and “¿” are kept. As released fixes only titles written all in one case.',
  'library.tags.fix.rules.spellings': 'Spellings learned',
  'library.tags.fix.rules.spellingsNote':
    'On: every album you fix from now on uses it too.',
  'library.tags.fix.rules.spellingsNone':
    'Spellings this album unifies show here; switch one on to keep using it.',
  'library.tags.fix.rules.keepSpelling': 'Always use {to} for {from}',
  'library.tags.fix.changes': '{count} changes',
  'library.tags.fix.changesOne': '1 change',
  'library.tags.fix.files': '{count} files · originals kept for Undo',
  'library.tags.fix.filesOne': '1 file · originals kept for Undo',
  'library.tags.fix.nothing': 'Nothing ticked',
  'library.tags.fix.nothingHint': 'Tick a line to fix it',
  'library.tags.fix.write': 'Write {count} changes',
  'library.tags.fix.writeOne': 'Write 1 change',
  'library.tags.fix.cancel': 'Cancel',
  'library.tags.fix.albums': '{count} albums',
  'library.tags.fix.review': 'Review',
  'library.tags.fix.albumNothing': 'Nothing to fix',
  'library.tags.fix.albumChanges': '{count} changes',
  'library.tags.fix.albumChangesOne': '1 change',
  'library.tags.fix.allAlbums': 'All albums',
  'library.tags.fix.intro':
    'Worked out from the songs’ tags, file names and folders. Change anything before you save. Nothing went online.',
  'library.tags.fix.beforeCol': 'Before',
  'library.tags.fix.now': 'Now: {value}',
  'library.tags.fix.onlySong': 'Only on song {songs}',
  'library.tags.fix.onlySongs': 'Only on songs {songs}',
  'library.tags.fix.settings': 'Rules for titles and spellings',
  'library.tags.fix.source.folder': 'From the folder’s name',
  'library.tags.fix.source.parentFolder': 'From the folder above',
  'library.tags.fix.source.artistInTitle': 'Artist in the title',
};

export default libraryTags;
